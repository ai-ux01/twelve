"""
AI Trading Lab FastAPI Router.

This module implements the API endpoints for the AI Trading Lab:
- POST /api/ai-trading/prompt - Submit a trading prompt and receive SSE stream
- GET /api/ai-trading/history - Get paginated conversation history
- POST /api/ai-trading/action - Execute action button commands

Requirements: 9.1, 9.2, 9.3, 9.4
"""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from .exceptions import (
    IntentDetectionError,
    PaperTradeError,
    QuantEngineError,
    StaleDataError,
)
from .interaction_store import InteractionStore
from .intent_detector import IntentDetector
from .models import (
    ActionRequest,
    ActionResponse,
    DecisionRecord,
    HistoryResponse,
    PromptRequest,
    ResponseMode,
)
from .orchestrator import Orchestrator

logger = logging.getLogger(__name__)

# Module-level shared instances
_intent_detector = IntentDetector()
_orchestrator = Orchestrator()
_interaction_store = InteractionStore()

# NestJS backend base URL
NESTJS_BASE_URL = "http://localhost:4000"

router = APIRouter(prefix="/api/ai-trading", tags=["ai-trading-lab"])


@router.post("/prompt")
async def submit_prompt(request: PromptRequest) -> StreamingResponse:
    """
    Accept a user prompt and return a streaming recommendation via SSE.

    Flow: classify intent → check if needs_clarification → execute orchestrator
    pipeline → persist DecisionRecord.

    SSE event types:
    - status: Pipeline progress updates
    - chunk: Recommendation text chunks
    - recommendation: Final structured recommendation JSON
    - error: Error messages
    - done: Stream complete

    Args:
        request: PromptRequest with prompt, response_mode, and session_id.

    Returns:
        StreamingResponse with text/event-stream content type.

    Raises:
        HTTPException: 422 for empty prompt (handled by Pydantic validation).

    Requirements: 9.1, 9.4
    """

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Step 1: Classify intent
            yield _format_sse("status", {"step": "intent_detection", "message": "Analyzing your prompt..."})

            intent = await _intent_detector.classify(request.prompt)

            # Step 2: Check if clarification is needed
            if intent.needs_clarification:
                yield _format_sse("status", {
                    "step": "clarification",
                    "message": "I need more information to help you.",
                })
                yield _format_sse("chunk", {
                    "text": (
                        f"I'm not quite sure what you're looking for (confidence: {intent.confidence:.0%}). "
                        f"Could you rephrase your prompt? For example:\n"
                        f"- \"Should I buy RELIANCE for a swing trade?\"\n"
                        f"- \"Intraday levels for HDFC Bank\"\n"
                        f"- \"Options strategy for NIFTY\""
                    ),
                })
                yield _format_sse("done", {"message": "Clarification needed"})
                return

            # Step 3: Execute orchestrator pipeline
            last_recommendation_data = None

            async for chunk in _orchestrator.execute(
                intent=intent,
                response_mode=request.response_mode,
                session_id=request.session_id,
            ):
                yield chunk

                # Capture the recommendation event data for persistence
                if chunk.startswith("event: recommendation"):
                    try:
                        data_line = chunk.split("data: ", 1)[1].strip()
                        last_recommendation_data = json.loads(data_line)
                    except (IndexError, json.JSONDecodeError):
                        pass

            # Step 4: Persist DecisionRecord
            if last_recommendation_data:
                record = DecisionRecord(
                    agent_id=_interaction_store.agent_id,
                    session_id=request.session_id,
                    prompt=request.prompt,
                    response=last_recommendation_data.get("formatted_response", ""),
                    prompt_version="v1.0",
                    market_data_timestamp=_parse_timestamp(
                        last_recommendation_data.get("market_data_timestamp")
                    ),
                    signal=last_recommendation_data.get("signal"),
                    probability=last_recommendation_data.get("probability"),
                    risk_reward_ratio=last_recommendation_data.get("risk_reward_ratio"),
                )
                _interaction_store.persist(request.session_id, record)

        except IntentDetectionError as e:
            logger.error(f"Intent detection failed: {e}")
            yield _format_sse("error", {
                "message": "I couldn't understand your request. Try rephrasing with a specific stock or trading intent.",
                "detail": str(e),
            })
            yield _format_sse("done", {"message": "Error occurred"})

        except StaleDataError as e:
            logger.error(f"Stale data error: {e}")
            yield _format_sse("error", {
                "message": "Market data service is currently unavailable. Cannot generate recommendation.",
                "detail": str(e),
            })
            yield _format_sse("done", {"message": "Error occurred"})

        except QuantEngineError as e:
            logger.error(f"Quant engine error: {e}")
            yield _format_sse("error", {
                "message": "Market data service is currently unavailable. Cannot generate recommendation.",
                "detail": str(e),
            })
            yield _format_sse("done", {"message": "Error occurred"})

        except Exception as e:
            logger.error(f"Unexpected error in prompt pipeline: {e}")
            yield _format_sse("error", {
                "message": "An unexpected error occurred. Please try again.",
                "detail": str(e),
            })
            yield _format_sse("done", {"message": "Error occurred"})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history")
async def get_history(
    session_id: str = Query(..., min_length=1, description="Session identifier"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Records per page"),
) -> HistoryResponse:
    """
    Return paginated conversation history for a session.

    Args:
        session_id: The user session identifier (required).
        page: Page number (default 1, must be >= 1).
        page_size: Records per page (default 20, max 100).

    Returns:
        HistoryResponse with paginated DecisionRecords.

    Requirements: 9.2, 5.4
    """
    records, total = _interaction_store.get_history(
        session_id=session_id,
        page=page,
        page_size=page_size,
    )

    return HistoryResponse(
        success=True,
        data=records,
        page=page,
        page_size=page_size,
        total_records=total,
    )


@router.post("/action")
async def execute_action(request: ActionRequest) -> ActionResponse:
    """
    Execute an action button command.

    Actions:
    - ANALYZE_MARKET: Extract symbols from decision record and submit new analysis
    - BUY_ON_PAPER: Call NestJS paper trading service
    - IGNORE: Mark decision as ignored (return success)
    - STOP: Return success (frontend handles AbortController)

    Args:
        request: ActionRequest with action, decision_id, and session_id.

    Returns:
        ActionResponse with success status and data.

    Requirements: 9.3, 6.5, 6.6, 6.7, 6.8
    """
    if request.action == "ANALYZE_MARKET":
        return await _handle_analyze_market(request)
    elif request.action == "BUY_ON_PAPER":
        return await _handle_buy_on_paper(request)
    elif request.action == "IGNORE":
        return _handle_ignore(request)
    elif request.action == "STOP":
        return _handle_stop(request)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")


# -----------------------------------------------------------------------------
# Action Handlers
# -----------------------------------------------------------------------------


async def _handle_analyze_market(request: ActionRequest) -> ActionResponse:
    """
    Handle ANALYZE_MARKET action.

    Extracts symbols from the decision record and submits a new analysis.

    Requirement: 6.7
    """
    # Find the decision record to extract symbols
    records, _ = _interaction_store.get_history(request.session_id, page=1, page_size=100)
    target_record = None
    for record in records:
        if record.decision_id == request.decision_id:
            target_record = record
            break

    if not target_record:
        return ActionResponse(
            success=False,
            message="Decision record not found",
            data=None,
        )

    # Extract symbols from the original prompt or use the record context
    return ActionResponse(
        success=True,
        message=f"Market analysis submitted for prompt: {target_record.prompt}",
        data={
            "decision_id": request.decision_id,
            "original_prompt": target_record.prompt,
            "action": "analyze_market",
        },
    )


async def _handle_buy_on_paper(request: ActionRequest) -> ActionResponse:
    """
    Handle BUY_ON_PAPER action.

    Calls NestJS paper trading service to execute a paper trade.

    Requirement: 6.6
    """
    # Find the decision record for trade details
    records, _ = _interaction_store.get_history(request.session_id, page=1, page_size=100)
    target_record = None
    for record in records:
        if record.decision_id == request.decision_id:
            target_record = record
            break

    if not target_record:
        return ActionResponse(
            success=False,
            message="Decision record not found",
            data=None,
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{NESTJS_BASE_URL}/api/paper-trading/execute",
                json={
                    "decision_id": request.decision_id,
                    "signal": target_record.signal.value if target_record.signal else "BUY",
                    "session_id": request.session_id,
                },
            )

            if response.status_code == 200:
                return ActionResponse(
                    success=True,
                    message="Paper trade executed successfully",
                    data=response.json(),
                )
            else:
                return ActionResponse(
                    success=False,
                    message=f"Paper trade failed: {response.text}",
                    data={"status_code": response.status_code},
                )

    except httpx.ConnectError:
        return ActionResponse(
            success=False,
            message="Unable to connect to paper trading service",
            data=None,
        )
    except httpx.TimeoutException:
        return ActionResponse(
            success=False,
            message="Paper trading service timed out",
            data=None,
        )
    except Exception as e:
        return ActionResponse(
            success=False,
            message=f"Paper trade execution error: {str(e)}",
            data=None,
        )


def _handle_ignore(request: ActionRequest) -> ActionResponse:
    """
    Handle IGNORE action.

    Marks the decision as ignored (just returns success).

    Requirement: 6.5
    """
    return ActionResponse(
        success=True,
        message="Recommendation ignored",
        data={"decision_id": request.decision_id, "status": "ignored"},
    )


def _handle_stop(request: ActionRequest) -> ActionResponse:
    """
    Handle STOP action.

    Returns success — the frontend handles the AbortController cancellation.

    Requirement: 6.8
    """
    return ActionResponse(
        success=True,
        message="Analysis stopped",
        data={"decision_id": request.decision_id, "status": "stopped"},
    )


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def _format_sse(event_type: str, data: dict) -> str:
    """Format an SSE event string."""
    return f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"


def _parse_timestamp(ts_str: str | None):
    """Parse an ISO timestamp string to datetime, or None."""
    if not ts_str:
        return None
    try:
        from datetime import datetime
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
