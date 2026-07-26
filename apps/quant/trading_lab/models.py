"""
AI Trading Lab Data Models.

This module defines Pydantic v2 models for the AI Trading Lab module,
including enums, request/response models, domain models, and SSE event models.

Requirements: 1.4, 2.1, 4.1, 5.1, 5.2, 5.3, 9.1, 9.2, 9.3
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


# --- Enums ---


class TradingIntent(str, Enum):
    """
    Trading intent types detected from user prompts.

    Requirement: 1.4
    """

    SWING_STOCK = "SWING_STOCK"
    INTRADAY_STOCK = "INTRADAY_STOCK"
    OPTIONS_SCALPING = "OPTIONS_SCALPING"
    TRADE_ANALYSIS = "TRADE_ANALYSIS"
    PORTFOLIO_ANALYSIS = "PORTFOLIO_ANALYSIS"
    MARKET_ANALYSIS = "MARKET_ANALYSIS"
    STRATEGY_ANALYSIS = "STRATEGY_ANALYSIS"
    PAPER_TRADE = "PAPER_TRADE"


class ResponseMode(str, Enum):
    """
    User-selectable response display modes.

    Requirement: 4.4, 4.5, 4.6, 4.7, 4.8
    """

    QUICK = "QUICK"
    DETAILED = "DETAILED"
    TRADER = "TRADER"
    QUANT = "QUANT"
    COACH = "COACH"


class SignalDirection(str, Enum):
    """
    Trade signal direction.

    Requirement: 4.1
    """

    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


# --- Domain Models ---


class IntentClassification(BaseModel):
    """
    Result of intent detection from a user prompt.

    Contains the classified intent, extracted symbols, confidence score,
    and whether clarification is needed.

    Requirement: 1.4
    """

    intent: TradingIntent = Field(..., description="Detected trading intent")
    symbols: List[str] = Field(
        default_factory=list, description="Extracted stock symbols from prompt"
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Classification confidence (0.0-1.0)"
    )
    needs_clarification: bool = Field(
        default=False,
        description="Whether the system needs clarification from the user",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "intent": "SWING_STOCK",
                    "symbols": ["RELIANCE"],
                    "confidence": 0.85,
                    "needs_clarification": False,
                }
            ]
        }
    }


class PipelineContext(BaseModel):
    """
    Context passed through the orchestration pipeline steps.

    Accumulates data as each pipeline step completes.

    Requirement: 2.1
    """

    intent: TradingIntent = Field(..., description="Detected trading intent")
    symbols: List[str] = Field(
        default_factory=list, description="Target stock symbols"
    )
    market_data: Optional[Dict[str, Any]] = Field(
        None, description="Fetched market data"
    )
    market_data_timestamp: Optional[datetime] = Field(
        None, description="Timestamp of the market data"
    )
    quant_analysis: Optional[Dict[str, Any]] = Field(
        None, description="Quantitative analysis results"
    )
    trendline_analysis: Optional[Dict[str, Any]] = Field(
        None, description="Trendline analysis results"
    )
    risk_assessment: Optional[Dict[str, Any]] = Field(
        None, description="Risk engine evaluation results"
    )
    recommendation: Optional[Dict[str, Any]] = Field(
        None, description="Final recommendation data"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "intent": "SWING_STOCK",
                    "symbols": ["TCS"],
                    "market_data": None,
                    "market_data_timestamp": None,
                    "quant_analysis": None,
                    "trendline_analysis": None,
                    "risk_assessment": None,
                    "recommendation": None,
                }
            ]
        }
    }


class Recommendation(BaseModel):
    """
    Structured trading recommendation output.

    Contains signal direction, probability, risk/reward ratio, price levels,
    position sizing, and risk flags.

    Requirement: 4.1, 4.2, 7.2, 7.3
    """

    signal: SignalDirection = Field(..., description="Trade signal direction")
    probability: float = Field(
        ..., ge=0.0, le=100.0, description="Confidence percentage (0-100)"
    )
    risk_reward_ratio: float = Field(
        ..., ge=0.0, description="Risk/reward ratio"
    )
    entry_price: Optional[float] = Field(
        None, gt=0, description="Suggested entry price"
    )
    stop_loss: Optional[float] = Field(
        None, gt=0, description="Stop loss price level"
    )
    target_price: Optional[float] = Field(
        None, gt=0, description="Target price level"
    )
    position_size: Optional[int] = Field(
        None, ge=0, description="Suggested position size (shares/lots)"
    )
    rationale: str = Field(
        ..., min_length=1, description="AI-generated reasoning for the recommendation"
    )
    is_low_confidence: bool = Field(
        default=False,
        description="Flagged when probability < 60%",
    )
    is_high_risk: bool = Field(
        default=False,
        description="Flagged when risk/reward ratio < 1.5",
    )
    warnings: List[str] = Field(
        default_factory=list, description="Risk warnings and caveats"
    )
    market_data_timestamp: datetime = Field(
        ..., description="Timestamp of market data used for this recommendation"
    )

    @field_validator("is_low_confidence", mode="before")
    @classmethod
    def validate_low_confidence(cls, v: bool, info) -> bool:
        """Auto-flag low confidence based on probability threshold."""
        return v

    @field_validator("is_high_risk", mode="before")
    @classmethod
    def validate_high_risk(cls, v: bool, info) -> bool:
        """Auto-flag high risk based on R:R threshold."""
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "signal": "BUY",
                    "probability": 75.5,
                    "risk_reward_ratio": 2.5,
                    "entry_price": 2450.0,
                    "stop_loss": 2400.0,
                    "target_price": 2575.0,
                    "position_size": 200,
                    "rationale": "Strong bullish momentum with RSI above 60 and MACD crossover.",
                    "is_low_confidence": False,
                    "is_high_risk": False,
                    "warnings": [],
                    "market_data_timestamp": "2024-12-20T10:30:00Z",
                }
            ]
        }
    }


class RiskAssessment(BaseModel):
    """
    Risk evaluation result from the Risk Engine.

    Requirement: 7.1, 7.2, 7.3, 7.4
    """

    risk_reward_ratio: float = Field(
        ..., ge=0.0, description="Calculated risk/reward ratio"
    )
    max_loss_amount: float = Field(
        ..., ge=0.0, description="Maximum loss amount based on position size"
    )
    position_size_suggested: int = Field(
        ..., ge=0, description="Suggested position size for 2% max risk"
    )
    is_high_risk: bool = Field(
        ..., description="Flagged when R:R < 1.5"
    )
    warnings: List[str] = Field(
        default_factory=list, description="Risk-related warnings"
    )
    passed: bool = Field(
        ..., description="Whether the trade passes risk evaluation"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "risk_reward_ratio": 2.5,
                    "max_loss_amount": 20000.0,
                    "position_size_suggested": 400,
                    "is_high_risk": False,
                    "warnings": [],
                    "passed": True,
                }
            ]
        }
    }


class DecisionRecord(BaseModel):
    """
    A stored interaction record capturing the full context of a recommendation.

    Requirement: 5.1, 5.2, 5.3
    """

    decision_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique decision identifier (UUID)",
    )
    agent_id: str = Field(
        ..., description="AI Trading Lab instance identifier"
    )
    session_id: str = Field(
        ..., description="User session identifier"
    )
    prompt: str = Field(
        ..., min_length=1, description="Original user prompt"
    )
    response: str = Field(
        ..., description="AI-generated response text"
    )
    prompt_version: str = Field(
        ..., description="Version of the prompt template used"
    )
    market_data_timestamp: Optional[datetime] = Field(
        None, description="Timestamp of market data used"
    )
    signal: Optional[SignalDirection] = Field(
        None, description="Recommendation signal direction"
    )
    probability: Optional[float] = Field(
        None, ge=0.0, le=100.0, description="Recommendation probability"
    )
    risk_reward_ratio: Optional[float] = Field(
        None, ge=0.0, description="Risk/reward ratio"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Record creation timestamp",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "decision_id": "550e8400-e29b-41d4-a716-446655440000",
                    "agent_id": "ai-trading-lab-a1b2c3d4",
                    "session_id": "user-session-123",
                    "prompt": "Should I buy RELIANCE for swing trade?",
                    "response": "BUY signal with 75% confidence...",
                    "prompt_version": "v1.0",
                    "market_data_timestamp": "2024-12-20T10:30:00Z",
                    "signal": "BUY",
                    "probability": 75.5,
                    "risk_reward_ratio": 2.5,
                    "created_at": "2024-12-20T10:30:05Z",
                }
            ]
        }
    }


# --- Request Models ---


class PromptRequest(BaseModel):
    """
    Request model for the POST /api/ai-trading/prompt endpoint.

    Requirement: 9.1
    """

    prompt: str = Field(
        ..., min_length=1, max_length=1000, description="User trading prompt"
    )
    response_mode: ResponseMode = Field(
        default=ResponseMode.QUICK,
        description="Selected response display mode",
    )
    session_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Session identifier (auto-generated if not provided)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "prompt": "Should I buy RELIANCE for a swing trade?",
                    "response_mode": "QUICK",
                    "session_id": "550e8400-e29b-41d4-a716-446655440000",
                }
            ]
        }
    }


class ActionRequest(BaseModel):
    """
    Request model for the POST /api/ai-trading/action endpoint.

    Requirement: 9.3
    """

    action: Literal["ANALYZE_MARKET", "BUY_ON_PAPER", "IGNORE", "STOP"] = Field(
        ..., description="Action to execute"
    )
    decision_id: str = Field(
        ..., min_length=1, description="Associated decision record ID"
    )
    session_id: str = Field(
        ..., min_length=1, description="Session identifier"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "action": "BUY_ON_PAPER",
                    "decision_id": "550e8400-e29b-41d4-a716-446655440000",
                    "session_id": "user-session-123",
                }
            ]
        }
    }


# --- Response Models ---


class HistoryResponse(BaseModel):
    """
    Response model for the GET /api/ai-trading/history endpoint.

    Requirement: 9.2
    """

    success: bool = Field(default=True, description="Request success status")
    data: List[DecisionRecord] = Field(
        default_factory=list, description="Decision records for the session"
    )
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Records per page")
    total_records: int = Field(..., ge=0, description="Total number of records")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "data": [],
                    "page": 1,
                    "page_size": 20,
                    "total_records": 0,
                }
            ]
        }
    }


class ActionResponse(BaseModel):
    """
    Response model for the POST /api/ai-trading/action endpoint.

    Requirement: 9.3
    """

    success: bool = Field(..., description="Whether the action succeeded")
    message: str = Field(..., description="Human-readable result message")
    data: Optional[Dict[str, Any]] = Field(
        None, description="Additional response data"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "Paper trade executed successfully",
                    "data": {"trade_id": "trade-123"},
                }
            ]
        }
    }


# --- SSE Event Models ---


class SSEEvent(BaseModel):
    """
    Server-Sent Event wrapper model.

    Defines the event type and JSON-encoded payload for SSE streaming.

    Requirement: 9.4
    """

    event: Literal["status", "chunk", "recommendation", "error", "done"] = Field(
        ..., description="SSE event type"
    )
    data: str = Field(..., description="JSON-encoded event payload")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "event": "status",
                    "data": '{"step": "data_fetch", "message": "Fetching market data..."}',
                }
            ]
        }
    }


class StatusEvent(BaseModel):
    """
    Payload for SSE 'status' events during pipeline execution.

    Requirement: 9.4
    """

    step: str = Field(..., description="Current pipeline step identifier")
    message: str = Field(..., description="Human-readable progress message")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "step": "quant_analysis",
                    "message": "Running quantitative analysis...",
                }
            ]
        }
    }


class RecommendationEvent(BaseModel):
    """
    Payload for the SSE 'recommendation' event containing the final structured result.

    Requirement: 9.4, 4.1
    """

    decision_id: str = Field(..., description="Associated decision record ID")
    signal: SignalDirection = Field(..., description="Trade signal direction")
    probability: float = Field(
        ..., ge=0.0, le=100.0, description="Confidence percentage"
    )
    risk_reward_ratio: float = Field(
        ..., ge=0.0, description="Risk/reward ratio"
    )
    entry_price: Optional[float] = Field(None, description="Entry price")
    stop_loss: Optional[float] = Field(None, description="Stop loss price")
    target_price: Optional[float] = Field(None, description="Target price")
    position_size: Optional[int] = Field(None, description="Position size")
    rationale: str = Field(..., description="AI-generated rationale")
    is_low_confidence: bool = Field(
        default=False, description="Low confidence flag"
    )
    is_high_risk: bool = Field(
        default=False, description="High risk flag"
    )
    warnings: List[str] = Field(
        default_factory=list, description="Risk warnings"
    )
    market_data_timestamp: str = Field(
        ..., description="ISO timestamp of market data used"
    )
    formatted_response: str = Field(
        ..., description="Mode-formatted recommendation text"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "decision_id": "550e8400-e29b-41d4-a716-446655440000",
                    "signal": "BUY",
                    "probability": 75.5,
                    "risk_reward_ratio": 2.5,
                    "entry_price": 2450.0,
                    "stop_loss": 2400.0,
                    "target_price": 2575.0,
                    "position_size": 200,
                    "rationale": "Strong bullish momentum...",
                    "is_low_confidence": False,
                    "is_high_risk": False,
                    "warnings": [],
                    "market_data_timestamp": "2024-12-20T10:30:00Z",
                    "formatted_response": "📈 BUY RELIANCE @ ₹2450 | SL: ₹2400 | Target: ₹2575",
                }
            ]
        }
    }
