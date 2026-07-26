# Design Document

## Overview

This document describes the technical design for the AI Trade Coach — a Python/FastAPI backend module that analyzes stored trade records to detect behavioral patterns, generate AI-powered coaching reports, and compare performance across trade sources. The frontend is a Next.js page at `/trade-coach` that displays coaching insights. The module reuses existing infrastructure from Phase 12's trade_analysis (TradePerformanceCalculator, GroupingEngine, TradeRepository) and Phase 12's AI analysis pattern (GPT-4 with factual context).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                     │
│  apps/web/app/trade-coach/page.tsx                       │
│  apps/web/components/trade-coach/                        │
│    ├── CoachReport.tsx                                   │
│    ├── BehaviorList.tsx                                  │
│    ├── SourceComparison.tsx                              │
│    └── types.ts                                          │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP
                         │ POST /api/trade-coach/analyze
                         │ GET  /api/trade-coach/behaviors
                         │ GET  /api/trade-coach/compare
┌────────────────────────▼────────────────────────────────┐
│                 FastAPI Router Layer                      │
│  apps/quant/trade_coach/router.py                        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Trade Coach Core                             │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ BehaviorDetector │  │ ReportGenerator  │             │
│  │ (10 patterns)    │  │ (GPT-4 + fallback)│            │
│  └──────────────────┘  └──────────────────┘             │
│  ┌──────────────────┐                                   │
│  │ SourceComparator │                                   │
│  │ (paper/live/bt)  │                                   │
│  └──────────────────┘                                   │
└────────────────────────┬────────────────────────────────┘
                         │ reuses
┌────────────────────────▼────────────────────────────────┐
│           Existing Modules (Phase 12)                    │
│  trade_analysis/performance_calculator.py                │
│  trade_analysis/grouping_engine.py                       │
│  trade_analysis/repository.py (shared instance)          │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Module Structure

```
apps/quant/trade_coach/
├── __init__.py              # Module exports
├── router.py                # FastAPI endpoints (/api/trade-coach/*)
├── models.py                # Enums, dataclasses, Pydantic models
├── behavior_detector.py     # 10 behavioral pattern detection algorithms
├── report_generator.py      # GPT-4 coaching report generation + fallback
└── source_comparator.py     # Paper/Live/Backtest comparison logic
```

## Data Models

### Enums

```python
class BehaviorPattern(str, Enum):
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

class BehaviorSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
```

### Core Dataclasses

```python
@dataclass
class BehaviorDetection:
    pattern: BehaviorPattern
    severity: BehaviorSeverity
    count: int
    description: str
    trade_ids: List[str]
    details: Optional[str]

@dataclass
class CoachReport:
    strengths: List[str]
    weaknesses: List[str]
    best_setups: List[str]
    worst_setups: List[str]
    best_conditions: List[str]
    common_mistakes: List[str]
    recommendations: List[str]
    generated_at: datetime

@dataclass
class SourceMetrics:
    source: str                # "paper", "live", "backtest"
    total_trades: int
    win_rate: float
    profit_factor: float
    expectancy: float
    average_r: float
    total_pnl: float
    max_drawdown: float

@dataclass
class SourceComparison:
    paper: Optional[SourceMetrics]
    live: Optional[SourceMetrics]
    backtest: Optional[SourceMetrics]
    insights: List[str]
```

### Pydantic API Models

```python
class CoachRequest(BaseModel):
    user_id: str = "default"
    time_range_days: Optional[int] = None
    source_filter: Optional[str] = None

class CoachResponse(BaseModel):
    success: bool
    report: Optional[CoachReportResponse]
    behaviors: List[BehaviorDetectionResponse]
    total_trades_analyzed: int
    data_source: str
    generated_at: Optional[str]

class BehaviorsResponse(BaseModel):
    success: bool
    total_patterns_detected: int
    behaviors: List[BehaviorDetectionResponse]

class SourceComparisonResponse(BaseModel):
    success: bool
    paper: Optional[SourceMetricsResponse]
    live: Optional[SourceMetricsResponse]
    backtest: Optional[SourceMetricsResponse]
    insights: List[str]
```

### Component: BehaviorDetector (`behavior_detector.py`)

Responsibilities:
- Analyze TradeRecord lists for 10 specific behavioral patterns
- Classify severity based on occurrence count thresholds
- Return only patterns that are actually detected (skip absent patterns)
- Skip trades that lack required enrichment data for specific detections

Detection algorithms and thresholds:

| Pattern | Detection Logic | Severity Thresholds |
|---------|----------------|-------------------|
| Overtrading | >5 trades/day OR >20 trades/week | (1, 3, 5) instances |
| Revenge Trading | New trade within 5 min of a losing exit | (1, 3, 5) trades |
| Oversizing | Position value > 3% of portfolio (default ₹10L) | (1, 3, 7) trades |
| Chasing | Entry > 1% from fair value (midpoint of entry and stop) | (2, 5, 10) trades |
| Weak Setups | Trade probability < 50% | (2, 5, 10) trades |
| Counter-Trend | Direction opposite to regime+RSI signal | (1, 3, 5) trades |
| Poor R:R | Risk/reward ratio < 1.5 | (3, 7, 15) trades |
| Moving Stops | MAE > 120% of initial stop distance | (1, 3, 5) trades |
| Early Exits | Realized P&L < 50% of MFE (winners only) | (2, 5, 10) trades |
| Late Exits | Holding period > 30 days | (1, 3, 5) trades |

Interface:
```python
class BehaviorDetector:
    def __init__(self, portfolio_value: float = 1_000_000.0): ...
    def detect_all(self, trades: List[TradeRecord]) -> List[BehaviorDetection]: ...
    def detect_overtrading(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]: ...
    def detect_revenge_trading(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]: ...
    # ... one method per pattern
```

### Component: ReportGenerator (`report_generator.py`)

Responsibilities:
- Compute aggregate metrics and grouped breakdowns using Phase 12 calculators
- Build factual context string from computed statistics + detected behaviors
- Call GPT-4 with system prompt that enforces data-grounded analysis
- Parse structured JSON response into CoachReport
- Provide fallback report when GPT-4 is unavailable

Interface:
```python
class ReportGenerator:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None): ...
    async def generate_report(self, trades: List[TradeRecord], behaviors: List[BehaviorDetection]) -> CoachReport: ...
```

AI Integration pattern:
1. Compute PerformanceMetrics via TradePerformanceCalculator
2. Compute GroupedMetrics via GroupingEngine (strategy, market_regime, time_of_day, setup)
3. Build context string with all metrics + behavior detections
4. Call GPT-4 with system prompt + context
5. Parse JSON response into CoachReport
6. On failure: generate rule-based fallback from metrics

Retry logic: 2 retries with exponential backoff (1s → 2s).

### Component: SourceComparator (`source_comparator.py`)

Responsibilities:
- Classify trades by source using strategy/setup metadata keywords
- Compute per-source metrics using TradePerformanceCalculator
- Generate comparison insights based on metric gaps

Interface:
```python
class SourceComparator:
    def compare_sources(self, trades: List[TradeRecord]) -> SourceComparison: ...
```

Source classification rules:
- Paper indicators: "paper", "simulated", "demo", "virtual" in strategy/setup
- Backtest indicators: "backtest", "historical", "replay" in strategy/setup
- Live indicators: "live", "real", "actual" in strategy/setup
- Default (no match): classified as "live"

### Component: Router (`router.py`)

Endpoints:
- `POST /api/trade-coach/analyze` — Full coaching analysis (behaviors + AI report)
- `GET /api/trade-coach/behaviors?user_id=` — Behavior detection only
- `GET /api/trade-coach/compare?user_id=` — Source comparison only

### Component: Frontend

```
apps/web/app/trade-coach/page.tsx              # Main page with analyze button
apps/web/components/trade-coach/
├── CoachReport.tsx                             # Renders 7-section coaching report
├── BehaviorList.tsx                            # List of detected patterns with severity badges
├── SourceComparison.tsx                        # Side-by-side source metrics + insights
├── types.ts                                    # TypeScript interfaces for API responses
└── index.ts                                    # Barrel exports
```

## Testing Strategy

### Unit Tests
- BehaviorDetector: Test each detection method with trades that trigger and don't trigger the pattern
- SourceComparator: Test classification logic with various strategy/setup keywords
- ReportGenerator: Test fallback report generation, context building, JSON parsing

### Property-Based Tests
- Severity monotonicity: higher counts never produce lower severity
- Source classification exhaustiveness: all trades accounted for, no duplicates
- Detect_all consistency: returned detections always have count > 0

### Integration Tests
- Router endpoints with pre-loaded TradeRepository data
- Full pipeline: POST /analyze returns valid response with behaviors and report

## Error Handling

- No trades: Return success=True with descriptive empty-state messages
- GPT-4 failure: Fall back to rule-based report generation (never crash)
- Individual detector failure: Log warning, skip that pattern, continue with others
- API validation: Pydantic handles request validation (422 for invalid payloads)
- Network errors (frontend): Display error message, don't crash page
- Missing enrichment data: Skip trade for that specific detection rather than fabricating

## Correctness Properties

### Property 1: Behavior Detection Validity

For any list of trades, `detect_all()` returns only `BehaviorDetection` instances where `count > 0`, and each detection corresponds to trades that genuinely violate the pattern threshold.

**Validates: Requirements 1.12**

### Property 2: Severity Monotonicity

For any pattern, if count_A >= count_B then severity(count_A) >= severity(count_B). Severity levels never decrease as occurrence counts increase.

**Validates: Requirements 1.11**

### Property 3: Source Classification Exhaustiveness

For any list of N trades, `_classify_trades(trades)` produces three lists whose combined length equals N. No trade is lost or duplicated during classification.

**Validates: Requirements 3.1**

### Property 4: Report Structure Completeness

For any valid input (non-empty trades list), `generate_report()` returns a CoachReport where all list fields are initialized (non-None, may be empty lists) and `generated_at` is set.

**Validates: Requirements 2.1**

### Property 5: Data Grounding

The context string passed to GPT-4 contains only values derived from the provided trade records via TradePerformanceCalculator and GroupingEngine computations. No hardcoded or fabricated statistics appear in the context.

**Validates: Requirements 6.2**
