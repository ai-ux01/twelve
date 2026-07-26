# Design Document

## Introduction

This document describes the technical design for the Backtesting Engine — a Python-based module that simulates trading strategies against historical OHLCV data. The engine is built with pure Python/numpy (no pandas), integrates with existing calculator modules, and exposes FastAPI endpoints consumed by a Next.js frontend page.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                     │
│  apps/web/app/backtesting/page.tsx                       │
│  apps/web/components/backtesting/                        │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (POST /quant/backtesting/run)
                         │ HTTP (GET /quant/backtesting/results/{id})
┌────────────────────────▼────────────────────────────────┐
│                 FastAPI Router Layer                      │
│  apps/quant/backtesting/router.py                        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Backtesting Engine Core                      │
│  apps/quant/backtesting/engine.py                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ DataLoader   │  │ Indicator    │  │ Rule         │  │
│  │              │  │ Engine       │  │ Evaluator    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Position     │  │ Cost         │  │ Metrics      │  │
│  │ Manager      │  │ Model        │  │ Calculator   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ reuses
┌────────────────────────▼────────────────────────────────┐
│           Existing Modules                               │
│  apps/quant/calculators/ (RSI, MACD, ATR, EMA, VWAP)    │
│  apps/quant/trade_analysis/performance_calculator.py     │
└─────────────────────────────────────────────────────────┘
```

## Module Structure

```
apps/quant/backtesting/
├── __init__.py
├── router.py          # FastAPI endpoints
├── engine.py          # Core backtest execution loop
├── models.py          # Pydantic models and dataclasses
├── data_loader.py     # OHLCV data loading (JSON, API)
├── indicator_engine.py # Indicator computation orchestrator
├── rule_evaluator.py  # Entry/exit rule evaluation
├── position_manager.py # Position tracking, stop/target/trailing
├── cost_model.py      # Slippage and brokerage simulation
├── metrics.py         # Performance metrics (wraps TradePerformanceCalculator)
├── walk_forward.py    # Walk-forward testing logic
└── bias_guard.py      # Look-ahead/leakage prevention checks
```

## Data Models

### Strategy Configuration (Input)

```python
@dataclass
class BacktestConfig:
    symbol: str
    ohlcv_source: OHLCVSource        # JSON path or API URL
    initial_capital: float
    indicators: List[IndicatorConfig]  # Which indicators + params
    entry_rules: List[RuleConfig]      # AND-combined conditions
    stop_loss: Optional[StopLossConfig]
    target: Optional[TargetConfig]
    trailing_stop: Optional[TrailingStopConfig]
    max_holding_period: Optional[int]  # bars
    slippage: SlippageConfig
    brokerage: BrokerageConfig
    test_mode: TestMode                # IN_SAMPLE, OUT_OF_SAMPLE, WALK_FORWARD
    split_ratio: float = 0.7          # for in/out-of-sample split
    walk_forward_windows: Optional[WalkForwardConfig]
```

### Backtest Result (Output)

```python
@dataclass
class BacktestResult:
    backtest_id: str
    symbol: str
    test_mode: TestMode
    start_date: datetime
    end_date: datetime
    initial_capital: float
    final_equity: float
    trades: List[TradeRecord]
    equity_curve: List[EquityPoint]
    metrics: PerformanceMetrics
    per_window_metrics: Optional[List[WindowMetrics]]  # walk-forward only
    survivorship_bias_warning: bool
    config: BacktestConfig
```

### PerformanceMetrics

```python
@dataclass
class PerformanceMetrics:
    total_return_pct: float
    cagr: float
    win_rate: float
    profit_factor: float
    expectancy: float
    average_winner: float
    average_loser: float
    max_drawdown_pct: float
    sharpe_ratio: float
    total_trades: int
    average_holding_period: float  # in bars
```

## Component Design

### 1. DataLoader (`data_loader.py`)

Responsibilities:
- Load OHLCV data from JSON files or HTTP API
- Validate data integrity (no gaps, chronological order, no NaN values)
- Store data in numpy arrays for performance
- Provide indexed access by bar position

Key design decisions:
- Uses numpy structured arrays: `timestamps`, `opens`, `highs`, `lows`, `closes`, `volumes`
- Validates on load; rejects malformed data immediately
- No pandas dependency — pure numpy + json/httpx

### 2. IndicatorEngine (`indicator_engine.py`)

Responsibilities:
- Orchestrate indicator computation using existing calculators
- Maintain indicator state per bar (rolling computation)
- Enforce warmup period tracking
- Provide point-in-time indicator values (no look-ahead)

Key design decisions:
- Wraps existing `apps/quant/calculators/` functions (RSI, MACD, EMA, ADX, ATR, VWAP)
- Pre-computes all indicator series on load, stores as numpy arrays
- Provides `get_value(indicator_name, bar_index)` that returns NaN for warmup bars
- Trendline evaluation uses price distance and crossover detection

### 3. RuleEvaluator (`rule_evaluator.py`)

Responsibilities:
- Evaluate entry conditions at each bar
- Support AND-combination of multiple conditions
- Each condition references an indicator, a comparator, and a threshold or another indicator
- Enforce look-ahead prevention (only access current or past bars)

Rule condition format:
```python
@dataclass
class RuleCondition:
    indicator: str          # e.g., "RSI_14"
    comparator: str         # "GT", "LT", "CROSSES_ABOVE", "CROSSES_BELOW"
    value: Union[float, str]  # numeric threshold or another indicator name
```

### 4. PositionManager (`position_manager.py`)

Responsibilities:
- Track open positions (one position at a time for simplicity)
- Evaluate stop loss, target, trailing stop each bar
- Handle maximum holding period expiry
- Determine exit price considering intra-bar high/low logic

Key design decisions:
- Single position model (no pyramiding in v1)
- Stop/target evaluation uses high/low of current bar
- Same-bar stop+target conflict: assume stop hit first for longs when open closer to stop
- Trailing stop updates: for longs, new_stop = max(current_stop, high - trail_amount)

### 5. CostModel (`cost_model.py`)

Responsibilities:
- Apply slippage to entry/exit prices
- Calculate brokerage fees per trade
- Provide net P&L after costs

```python
@dataclass
class SlippageConfig:
    model: str       # "fixed" or "percentage"
    value: float     # points or percentage

@dataclass
class BrokerageConfig:
    model: str       # "fixed" or "percentage"
    value: float     # flat fee or percentage of trade value
```

### 6. MetricsCalculator (`metrics.py`)

Responsibilities:
- Calculate all 11 performance metrics from trade list and equity curve
- Reuse TradePerformanceCalculator for overlapping metrics
- Add CAGR, Sharpe Ratio, Total Return, Average Winner/Loser, Average Holding Period

Key design decisions:
- Wraps `TradePerformanceCalculator.calculate_metrics()` for win rate, profit factor, expectancy, max drawdown
- Implements CAGR, Sharpe, and averages directly
- Sharpe uses annualized daily returns (√252 scaling)

### 7. Engine (`engine.py`)

Core execution loop:
```
1. Load OHLCV data via DataLoader
2. Compute all indicators via IndicatorEngine
3. For each bar from warmup_end to last_bar:
   a. If no open position: evaluate entry rules
   b. If entry signal: open position on NEXT bar open + slippage
   c. If open position: evaluate exit conditions (stop/target/trailing/holding)
   d. If exit triggered: close position, record trade, apply costs
4. Calculate metrics from completed trades
5. Return BacktestResult
```

### 8. BiasGuard (`bias_guard.py`)

Responsibilities:
- Validate that indicator engine only accesses data ≤ current bar
- Enforce next-bar execution for entry signals
- Log survivorship bias warnings
- In walk-forward mode: ensure windows don't overlap

### 9. WalkForward (`walk_forward.py`)

Responsibilities:
- Split data into rolling in-sample/out-of-sample windows
- Run engine independently on each window
- Aggregate out-of-sample results
- Report per-window and combined metrics

Window configuration:
```python
@dataclass
class WalkForwardConfig:
    in_sample_bars: int     # e.g., 252 (1 year of daily bars)
    out_of_sample_bars: int # e.g., 63 (3 months)
    step_bars: int          # e.g., 63 (step forward by OOS size)
```

### 10. Router (`router.py`)

Endpoints:
- `POST /quant/backtesting/run` — Accepts BacktestConfig, runs engine, stores result, returns BacktestResult
- `GET /quant/backtesting/results/{backtest_id}` — Retrieves stored result by ID

In-memory store: `Dict[str, BacktestResult]` with UUID keys.

### 11. Frontend Components

```
apps/web/app/backtesting/page.tsx          # Main page
apps/web/components/backtesting/
├── BacktestConfigForm.tsx                  # Strategy configuration form
├── BacktestResults.tsx                     # Results container
├── MetricsSummary.tsx                      # Performance metrics grid
├── EquityCurveChart.tsx                    # Line chart of equity over time
├── TradeList.tsx                           # Table of individual trades
└── WalkForwardResults.tsx                  # Per-window results display
```

## Look-Ahead Bias Prevention Strategy

1. **Indicator computation**: All indicator arrays are pre-computed, but accessed via `get_value(name, bar_index)` which caps at current index
2. **Entry execution**: Signal on bar N → execution on bar N+1 open
3. **Exit evaluation**: Uses current bar's OHLC only (not future bars)
4. **Walk-forward isolation**: Each window starts indicator computation fresh

## Data Flow

```
User Config (JSON) → Router → Engine.run()
  → DataLoader.load() → numpy arrays
  → IndicatorEngine.compute_all() → indicator arrays
  → Loop: RuleEvaluator + PositionManager + CostModel
  → MetricsCalculator.calculate() → PerformanceMetrics
  → BacktestResult → stored in memory → returned to client
```

## Error Handling

- Invalid config: HTTP 422 with field-level validation errors (Pydantic)
- Data load failure: HTTP 400 with descriptive message
- Insufficient data for indicators: Return result with warning, skip evaluation for warmup bars
- No trades generated: Return valid result with zero metrics

## Performance Considerations

- numpy arrays for OHLCV and indicator storage (vectorized where possible)
- Pre-compute all indicators in one pass before the main loop
- No pandas dependency — avoids overhead for this use case
- In-memory result storage (no database round-trips)
