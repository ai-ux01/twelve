"""
Trade Sync Data Models.

Dataclasses for the trade synchronization service, ledger, and mapper.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Tuple


@dataclass
class SyncCycleResult:
    """Summary result of a single trade sync cycle."""

    timestamp: datetime = field(default_factory=datetime.utcnow)
    paper_trades_synced: int = 0
    live_stock_trades_synced: int = 0
    live_options_trades_synced: int = 0
    errors: List[str] = field(default_factory=list)
    kotak_session_valid: bool = False


@dataclass
class SyncStatus:
    """Current status of the Trade Sync Service."""

    running: bool
    last_sync_timestamp: Optional[datetime]
    last_cycle_result: Optional[SyncCycleResult]
    total_synced_count: int
    pending_count: int


@dataclass
class SyncedEntry:
    """Record of a successfully synced trade in the ledger."""

    source: str  # "paper_trade" | "live_stock" | "live_options"
    source_id: str  # Paper trade ID or Kotak order ID
    trade_analysis_id: str  # ID in TradeRepository
    sync_timestamp: datetime


@dataclass
class PendingEntry:
    """An unmatched order waiting for its counterpart."""

    source: str  # "live_stock" | "live_options"
    source_id: str  # Kotak order ID
    symbol: str
    direction: str  # "BUY" | "SELL"
    price: float
    quantity: int
    timestamp: datetime
    # Options-specific fields
    strike_price: Optional[float] = None
    expiry: Optional[str] = None
    option_type: Optional[str] = None  # "CE" | "PE"


@dataclass
class MatchResult:
    """Result of matching buy/sell orders into trade pairs."""

    matched_pairs: List[Tuple[dict, dict]]  # (buy_order, sell_order)
    unmatched_orders: List[dict]
