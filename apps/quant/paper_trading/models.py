"""
Paper Trading Data Models.

Dataclasses for the paper trading trade monitor and performance calculator.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List


@dataclass
class PaperTradeData:
    """Represents a paper trade fetched from the NestJS API."""

    id: str
    symbol: str
    direction: str  # "LONG" | "SHORT"
    trade_type: str  # "SWING" | "INTRADAY" | "OPTIONS_SCALPING"
    entry_price: float
    stop_loss: float
    target: float
    quantity: int
    status: str  # "OPEN" | "TARGET_HIT" | "STOP_HIT" | etc.
    current_price: Optional[float] = None
    strike_price: Optional[float] = None
    option_type: Optional[str] = None  # "CE" | "PE"
    expiry_date: Optional[date] = None
    underlying: Optional[str] = None


@dataclass
class TradeAction:
    """Result of evaluating a single trade against current market price."""

    trade_id: str
    action: str  # "CLOSE" | "UPDATE" | "NONE"
    new_status: Optional[str] = None  # "TARGET_HIT" | "STOP_HIT" | "EXPIRED"
    exit_price: Optional[float] = None
    current_price: float = 0.0
    unrealized_pnl: float = 0.0


@dataclass
class MonitorCycleResult:
    """Summary result of a single trade monitoring cycle."""

    timestamp: datetime = field(default_factory=datetime.utcnow)
    trades_checked: int = 0
    trades_closed: int = 0
    trades_updated: int = 0
    errors: List[str] = field(default_factory=list)


@dataclass
class ClosedTradeData:
    """Represents a closed paper trade for performance calculation."""

    id: str
    symbol: str
    direction: str
    trade_type: str
    entry_price: float
    exit_price: float
    stop_loss: float
    target: float
    quantity: int
    realized_pnl: float
    status: str  # "TARGET_HIT" | "STOP_HIT" | "MANUAL_EXIT" | "EXPIRED" | "CANCELLED"
    entered_at: Optional[datetime] = None
    exited_at: Optional[datetime] = None
