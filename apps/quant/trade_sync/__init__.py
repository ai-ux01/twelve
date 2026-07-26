"""
Trade Sync Module for the Quant Engine.

Provides automatic synchronization of completed trades from all trading
sources (paper trading, live stock, live options) into the Trade Analysis module.
"""

from .models import (
    SyncCycleResult,
    SyncStatus,
    SyncedEntry,
    PendingEntry,
    MatchResult,
)
from .ledger import SyncLedger
from .mapper import TradeMapper, MappingError
from .service import TradeSyncService
from .router import router as trade_sync_router, set_trade_sync_service

__all__ = [
    "SyncCycleResult",
    "SyncStatus",
    "SyncedEntry",
    "PendingEntry",
    "MatchResult",
    "SyncLedger",
    "TradeMapper",
    "MappingError",
    "TradeSyncService",
    "trade_sync_router",
    "set_trade_sync_service",
]
