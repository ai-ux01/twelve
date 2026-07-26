"""
Trade Sync FastAPI Router.

Provides the status endpoint for the Trade Sync Service.
Requirements: 4.5
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trade-sync", tags=["trade-sync"])

# Module-level reference to the trade sync service (set during lifespan startup)
_trade_sync_service = None


def set_trade_sync_service(service):
    """Set the TradeSyncService instance for status endpoint access."""
    global _trade_sync_service
    _trade_sync_service = service


class SyncCycleResultResponse(BaseModel):
    """Response model for last cycle result."""

    timestamp: Optional[str] = None
    paper_trades_synced: int = 0
    live_stock_trades_synced: int = 0
    live_options_trades_synced: int = 0
    errors: List[str] = []
    kotak_session_valid: bool = False


class SyncStatusResponse(BaseModel):
    """Response model for trade sync status endpoint."""

    running: bool = False
    last_sync_timestamp: Optional[str] = None
    last_cycle_result: Optional[SyncCycleResultResponse] = None
    total_synced_count: int = 0
    pending_count: int = 0


@router.get("/status", response_model=SyncStatusResponse)
async def get_trade_sync_status():
    """
    GET /api/trade-sync/status

    Return trade sync service running state, last sync timestamp,
    trades synced in last cycle, and any errors from last cycle.
    """
    if _trade_sync_service is None:
        return SyncStatusResponse(running=False)

    status = _trade_sync_service.get_status()

    last_cycle = None
    if status.last_cycle_result is not None:
        last_cycle = SyncCycleResultResponse(
            timestamp=status.last_cycle_result.timestamp.isoformat()
            if status.last_cycle_result.timestamp
            else None,
            paper_trades_synced=status.last_cycle_result.paper_trades_synced,
            live_stock_trades_synced=status.last_cycle_result.live_stock_trades_synced,
            live_options_trades_synced=status.last_cycle_result.live_options_trades_synced,
            errors=status.last_cycle_result.errors,
            kotak_session_valid=status.last_cycle_result.kotak_session_valid,
        )

    return SyncStatusResponse(
        running=status.running,
        last_sync_timestamp=status.last_sync_timestamp.isoformat()
        if status.last_sync_timestamp
        else None,
        last_cycle_result=last_cycle,
        total_synced_count=status.total_synced_count,
        pending_count=status.pending_count,
    )
