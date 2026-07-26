"""
Backtesting Engine FastAPI Router.

Endpoints:
- POST /quant/backtesting/run — Run backtest, store result, return response
- GET /quant/backtesting/results/{backtest_id} — Retrieve stored result

Uses in-memory Dict[str, BacktestResult] for result storage.
"""

from __future__ import annotations

import logging
from typing import Dict

from fastapi import APIRouter, HTTPException

from .engine import BacktestEngine
from .models import (
    BacktestResult,
    BacktestRunRequest,
    BacktestRunResponse,
    TestMode,
    request_to_config,
    result_to_response,
)
from .walk_forward import WalkForwardRunner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quant/backtesting", tags=["backtesting"])

# In-memory result store
_results_store: Dict[str, BacktestResult] = {}


@router.post("/run", response_model=BacktestRunResponse)
async def run_backtest(request: BacktestRunRequest) -> BacktestRunResponse:
    """
    Run a backtest with the given configuration.

    Validates the request, executes the backtest engine,
    stores the result, and returns the response.

    Args:
        request: BacktestRunRequest with strategy configuration.

    Returns:
        BacktestRunResponse with results.

    Raises:
        HTTPException 400: If data loading fails.
        HTTPException 422: If validation fails (automatic from Pydantic).
        HTTPException 500: If unexpected error occurs.
    """
    try:
        # Convert request to internal config
        config = request_to_config(request)

        # Run based on test mode
        if config.test_mode == TestMode.WALK_FORWARD:
            runner = WalkForwardRunner()
            result = runner.run_walk_forward(config)
        else:
            engine = BacktestEngine()
            result = engine.run(config)

        # Store result
        _results_store[result.backtest_id] = result

        # Convert to response
        response = result_to_response(result)
        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=f"Data file not found: {e}")
    except Exception as e:
        logger.error(f"Backtest execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error during backtest execution: {str(e)}",
        )


@router.get("/results/{backtest_id}", response_model=BacktestRunResponse)
async def get_backtest_result(backtest_id: str) -> BacktestRunResponse:
    """
    Retrieve a stored backtest result by ID.

    Args:
        backtest_id: UUID of the backtest result.

    Returns:
        BacktestRunResponse with results.

    Raises:
        HTTPException 404: If result not found.
    """
    result = _results_store.get(backtest_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Backtest result not found: {backtest_id}",
        )

    return result_to_response(result)
