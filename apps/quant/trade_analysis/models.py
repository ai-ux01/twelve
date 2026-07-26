"""
Trade Analysis Engine Data Models.

Defines all enums, dataclasses, and Pydantic models for the trade analysis system.

Requirements: 2.1, 5.1, 6.1, 9.1, 9.6
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# === Enums ===


class TradeDirection(str, Enum):
    """Direction of a trade."""
    LONG = "LONG"
    SHORT = "SHORT"


class MarketRegime(str, Enum):
    """Market regime classification."""
    TRENDING = "trending"
    RANGING = "ranging"
    VOLATILE = "volatile"


class TimeBucket(str, Enum):
    """Time-of-day buckets for grouping."""
    PRE_MARKET = "pre_market"
    MORNING = "morning"
    MIDDAY = "midday"
    AFTERNOON = "afternoon"
    CLOSING = "closing"


class HoldingPeriodBucket(str, Enum):
    """Holding period buckets for grouping."""
    INTRADAY = "intraday"
    ONE_TO_THREE_DAYS = "1-3 days"
    FOUR_TO_SEVEN_DAYS = "4-7 days"
    ONE_TO_TWO_WEEKS = "1-2 weeks"
    TWO_PLUS_WEEKS = "2+ weeks"


# === Core Dataclasses ===


@dataclass
class TradeAction:
    """A single parsed trade action from CSV."""
    row_number: int
    date: datetime
    symbol: str
    action: str  # "BUY" or "SELL"
    quantity: int
    price: float
    strategy: Optional[str] = None
    setup: Optional[str] = None
    sector: Optional[str] = None


@dataclass
class TradeRecord:
    """Complete trade record with entry/exit and computed fields."""
    id: str
    user_id: str
    symbol: str
    direction: TradeDirection
    entry_date: datetime
    exit_date: datetime
    entry_price: float
    exit_price: float
    quantity: int
    realized_pnl: float
    holding_period_days: int

    # Optional fields from import
    strategy: Optional[str] = None
    setup: Optional[str] = None
    sector: Optional[str] = None
    stop_loss: Optional[float] = None
    probability: Optional[float] = None

    # Enrichment fields (populated after enrichment)
    mfe: Optional[float] = None
    mae: Optional[float] = None
    rsi_at_entry: Optional[float] = None
    adx_at_entry: Optional[float] = None
    volume_ratio: Optional[float] = None
    market_regime: Optional[MarketRegime] = None
    trendline_context: Optional[str] = None
    risk_reward_ratio: Optional[float] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class UnmatchedEntry:
    """An unmatched BUY or SELL that has no corresponding counterpart."""
    row_number: int
    symbol: str
    action: str  # "BUY" or "SELL"
    date: datetime
    price: float
    quantity: int
    reason: str  # e.g., "No matching SELL found"


@dataclass
class PerformanceMetrics:
    """Aggregate performance metrics."""
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0          # percentage (0-100)
    profit_factor: float = 0.0     # ratio (can be inf)
    total_pnl: float = 0.0
    expectancy: float = 0.0        # average P&L per trade
    max_drawdown: float = 0.0      # negative value
    average_r: float = 0.0         # mean R-multiple
    mfe_mean: Optional[float] = None
    mfe_median: Optional[float] = None
    mfe_max: Optional[float] = None
    mae_mean: Optional[float] = None
    mae_median: Optional[float] = None
    mae_max: Optional[float] = None


@dataclass
class GroupedMetrics:
    """Performance metrics for a single group."""
    dimension_value: str
    trade_count: int
    win_rate: float
    profit_factor: float
    expectancy: float
    total_pnl: float
    average_r: float


@dataclass
class CSVRowError:
    """Error for a single CSV row."""
    row_number: int
    field_name: str
    message: str


@dataclass
class CSVParseResult:
    """Result of CSV parsing step."""
    trade_actions: List[TradeAction] = field(default_factory=list)
    errors: List[CSVRowError] = field(default_factory=list)


@dataclass
class TradeMatchResult:
    """Result of trade matching step."""
    matched_trades: List[TradeRecord] = field(default_factory=list)
    unmatched_entries: List[UnmatchedEntry] = field(default_factory=list)


# === Pydantic API Models ===


class ManualTradeRequest(BaseModel):
    """Request model for manual trade entry."""
    symbol: str = Field(..., min_length=1)
    entry_date: datetime
    entry_price: float = Field(..., gt=0)
    exit_date: datetime
    exit_price: float = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    direction: TradeDirection
    strategy: Optional[str] = None
    setup: Optional[str] = None
    sector: Optional[str] = None
    stop_loss: Optional[float] = Field(None, gt=0)


class FieldError(BaseModel):
    """Single field-level validation error."""
    field: str
    message: str


class ErrorResponse(BaseModel):
    """Structured error response."""
    detail: str
    errors: List[FieldError] = []


class CSVRowErrorResponse(BaseModel):
    """CSV row error response."""
    row_number: int
    field_name: str
    message: str


class UnmatchedEntryResponse(BaseModel):
    """Unmatched entry response."""
    row_number: int
    symbol: str
    action: str
    date: datetime
    price: float
    quantity: int
    reason: str


class TradeRecordResponse(BaseModel):
    """Trade record response."""
    id: str
    symbol: str
    direction: TradeDirection
    entry_date: datetime
    exit_date: datetime
    entry_price: float
    exit_price: float
    quantity: int
    realized_pnl: float
    holding_period_days: int
    strategy: Optional[str] = None
    setup: Optional[str] = None
    sector: Optional[str] = None
    stop_loss: Optional[float] = None
    mfe: Optional[float] = None
    mae: Optional[float] = None
    rsi_at_entry: Optional[float] = None
    adx_at_entry: Optional[float] = None
    volume_ratio: Optional[float] = None
    market_regime: Optional[str] = None
    risk_reward_ratio: Optional[float] = None


class CSVImportResponse(BaseModel):
    """Response from CSV import endpoint."""
    success: bool
    trades_imported: int
    trades: List[TradeRecordResponse] = []
    errors: List[CSVRowErrorResponse] = []
    unmatched: List[UnmatchedEntryResponse] = []


class PerformanceMetricsResponse(BaseModel):
    """Performance metrics as JSON response."""
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    total_pnl: float = 0.0
    expectancy: float = 0.0
    max_drawdown: float = 0.0
    average_r: float = 0.0
    mfe_mean: Optional[float] = None
    mfe_median: Optional[float] = None
    mfe_max: Optional[float] = None
    mae_mean: Optional[float] = None
    mae_median: Optional[float] = None
    mae_max: Optional[float] = None


class MetricsResponse(BaseModel):
    """Response from metrics endpoint."""
    success: bool
    metrics: PerformanceMetricsResponse


class GroupedMetricsItem(BaseModel):
    """Single grouped metrics item."""
    dimension_value: str
    trade_count: int
    win_rate: float
    profit_factor: float
    expectancy: float
    total_pnl: float
    average_r: float


class GroupedMetricsResponse(BaseModel):
    """Response from grouped metrics endpoint."""
    success: bool
    dimension: str
    groups: List[GroupedMetricsItem] = []


class AIAnalyzeRequest(BaseModel):
    """Request for AI analysis."""
    prompt: str = Field(..., min_length=1, max_length=1000)


class AIAnalysisResponse(BaseModel):
    """Response from AI analysis endpoint."""
    success: bool
    analysis: str
    metrics_used: Optional[PerformanceMetricsResponse] = None
    data_source: str = "stored_trade_statistics"
