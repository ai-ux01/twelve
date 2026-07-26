"""
Trade Coach Data Models.

Defines enums, dataclasses, and Pydantic models for the AI Trade Coach system.
Includes behavior patterns, detection results, coaching reports, and source comparisons.

Phase 15 - AI Trade Coach
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class BehaviorPattern(str, Enum):
    """Detectable trading behavior patterns (10 core + live-specific patterns)."""
    OVERTRADING = "overtrading"
    REVENGE_TRADING = "revenge_trading"
    OVERSIZING = "oversizing"
    CHASING = "chasing"
    WEAK_SETUPS = "weak_setups"
    COUNTER_TREND = "counter_trend"
    POOR_RISK_REWARD = "poor_risk_reward"
    MOVING_STOPS = "moving_stops"
    EARLY_EXITS = "early_exits"
    LATE_EXITS = "late_exits"
    PARTIAL_FILLS = "partial_fills"


class BehaviorSeverity(str, Enum):
    """Severity levels for detected behaviors."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class BehaviorDetection:
    """A single detected behavior pattern instance."""
    pattern: BehaviorPattern
    severity: BehaviorSeverity
    count: int
    description: str
    trade_ids: List[str] = field(default_factory=list)
    details: Optional[str] = None


@dataclass
class CoachReport:
    """Full AI coaching report with structured sections."""
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)
    best_setups: List[str] = field(default_factory=list)
    worst_setups: List[str] = field(default_factory=list)
    best_conditions: List[str] = field(default_factory=list)
    common_mistakes: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SourceMetrics:
    """Performance metrics for a single trade source."""
    source: str
    total_trades: int = 0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    expectancy: float = 0.0
    average_r: float = 0.0
    total_pnl: float = 0.0
    max_drawdown: float = 0.0


@dataclass
class SourceComparison:
    """Comparison of metrics across Paper, Live, and Backtest sources."""
    paper: Optional[SourceMetrics] = None
    live: Optional[SourceMetrics] = None
    backtest: Optional[SourceMetrics] = None
    insights: List[str] = field(default_factory=list)


# === Pydantic API Models ===


class CoachRequest(BaseModel):
    """Request for coaching analysis."""
    user_id: str = Field(default="default", description="User ID to analyze")
    time_range_days: Optional[int] = Field(
        default=None,
        description="Number of days to analyze (None = all trades)"
    )
    source_filter: Optional[str] = Field(
        default=None,
        description="Filter by source: paper, live, backtest"
    )
    data_source: str = Field(
        default="paper",
        description="Data source mode: paper, live, or combined"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Kotak Neo session ID, required when data_source is live or combined"
    )


class BehaviorDetectionResponse(BaseModel):
    """Single behavior detection in API response."""
    pattern: str
    severity: str
    count: int
    description: str
    trade_ids: List[str] = []
    details: Optional[str] = None


class BehaviorsResponse(BaseModel):
    """Response from behaviors endpoint."""
    success: bool
    total_patterns_detected: int
    behaviors: List[BehaviorDetectionResponse] = []


class CoachReportResponse(BaseModel):
    """AI coaching report in API response."""
    strengths: List[str] = []
    weaknesses: List[str] = []
    best_setups: List[str] = []
    worst_setups: List[str] = []
    best_conditions: List[str] = []
    common_mistakes: List[str] = []
    recommendations: List[str] = []


class CoachResponse(BaseModel):
    """Full response from coaching analysis endpoint."""
    success: bool
    report: Optional[CoachReportResponse] = None
    behaviors: List[BehaviorDetectionResponse] = []
    total_trades_analyzed: int = 0
    data_source: str = "stored_trade_statistics"
    live_trade_count: Optional[int] = None
    paper_trade_count: Optional[int] = None
    slippage_summary: Optional[Dict] = None
    generated_at: Optional[str] = None


class SourceMetricsResponse(BaseModel):
    """Metrics for a single source in API response."""
    source: str
    total_trades: int = 0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    expectancy: float = 0.0
    average_r: float = 0.0
    total_pnl: float = 0.0
    max_drawdown: float = 0.0


class SourceComparisonResponse(BaseModel):
    """Response from source comparison endpoint."""
    success: bool
    paper: Optional[SourceMetricsResponse] = None
    live: Optional[SourceMetricsResponse] = None
    backtest: Optional[SourceMetricsResponse] = None
    insights: List[str] = []
