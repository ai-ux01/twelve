"""
Paper Trading FastAPI Router.

Provides endpoints for performance metrics and trade monitor status.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from .models import ClosedTradeData
from .performance_calculator import PerformanceCalculator, PerformanceMetrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/paper-trading", tags=["paper-trading"])

# Module-level reference to the trade monitor (set during lifespan startup)
_trade_monitor = None


def set_trade_monitor(monitor):
    """Set the trade monitor instance for status endpoint access."""
    global _trade_monitor
    _trade_monitor = monitor


class MetricsResponse(BaseModel):
    """Response model for performance metrics endpoint."""

    win_rate: float = 0.0
    profit_factor: float = 0.0
    total_pnl: float = 0.0
    expectancy: float = 0.0
    average_r: float = 0.0
    max_drawdown: float = 0.0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0


class MonitorStatusResponse(BaseModel):
    """Response model for monitor status endpoint."""

    running: bool = False
    interval: int = 30
    last_cycle_trades_checked: int = 0
    last_cycle_trades_closed: int = 0
    last_cycle_trades_updated: int = 0
    last_cycle_errors: int = 0
    last_cycle_timestamp: Optional[str] = None


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    user_id: str = Query(..., description="User ID to fetch metrics for"),
    trade_type: Optional[str] = Query(None, description="Optional trade type filter"),
):
    """
    GET /api/paper-trading/metrics

    Fetch closed trades from the NestJS API, calculate and return performance metrics.
    """
    api_base_url = os.environ.get("API_BASE_URL", "http://localhost:4000")
    calculator = PerformanceCalculator()

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Fetch closed trades from NestJS
            params = {
                "userId": user_id,
                "status": "TARGET_HIT,STOP_HIT,MANUAL_EXIT,EXPIRED",
                "pageSize": "10000",
            }
            response = await client.get(f"{api_base_url}/api/paper-trades", params=params)
            response.raise_for_status()
            data = response.json()

        trades_data = data.get("data", []) if isinstance(data, dict) else data

        # Convert to ClosedTradeData
        closed_trades = []
        for t in trades_data:
            if t.get("realizedPnL") is None:
                continue
            closed_trades.append(ClosedTradeData(
                id=t["id"],
                symbol=t["symbol"],
                direction=t["direction"],
                trade_type=t.get("tradeType", "SWING"),
                entry_price=t["entryPrice"],
                exit_price=t.get("exitPrice", t["entryPrice"]),
                stop_loss=t["stopLoss"],
                target=t["target"],
                quantity=t["quantity"],
                realized_pnl=t["realizedPnL"],
                status=t["status"],
            ))

        # Calculate metrics
        metrics = calculator.calculate_metrics(closed_trades, trade_type=trade_type)

        return MetricsResponse(
            win_rate=metrics.win_rate,
            profit_factor=metrics.profit_factor if metrics.profit_factor != float("inf") else 999999.0,
            total_pnl=metrics.total_pnl,
            expectancy=metrics.expectancy,
            average_r=metrics.average_r,
            max_drawdown=metrics.max_drawdown,
            total_trades=metrics.total_trades,
            winning_trades=metrics.winning_trades,
            losing_trades=metrics.losing_trades,
        )

    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch trades from API: {e}")
        # Return zeros if API is unavailable
        return MetricsResponse()
    except Exception as e:
        logger.error(f"Error calculating metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monitor/status", response_model=MonitorStatusResponse)
async def get_monitor_status():
    """
    GET /api/paper-trading/monitor/status

    Return trade monitor running status and last cycle result.
    """
    if _trade_monitor is None:
        return MonitorStatusResponse(running=False)

    last_result = _trade_monitor.last_cycle_result
    return MonitorStatusResponse(
        running=_trade_monitor.is_running,
        interval=_trade_monitor.interval,
        last_cycle_trades_checked=last_result.trades_checked if last_result else 0,
        last_cycle_trades_closed=last_result.trades_closed if last_result else 0,
        last_cycle_trades_updated=last_result.trades_updated if last_result else 0,
        last_cycle_errors=len(last_result.errors) if last_result else 0,
        last_cycle_timestamp=last_result.timestamp.isoformat() if last_result else None,
    )
