"""
Backtesting Engine Data Models.

Defines all Pydantic models and dataclasses for the backtesting system.
Includes strategy configuration, trade records, and result structures.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


# === Enums ===


class TestMode(str, Enum):
    """Backtesting test mode."""
    IN_SAMPLE = "in_sample"
    OUT_OF_SAMPLE = "out_of_sample"
    WALK_FORWARD = "walk_forward"


class Comparator(str, Enum):
    """Rule condition comparators."""
    GT = "GT"
    LT = "LT"
    GTE = "GTE"
    LTE = "LTE"
    EQ = "EQ"
    CROSSES_ABOVE = "CROSSES_ABOVE"
    CROSSES_BELOW = "CROSSES_BELOW"


class TradeDirection(str, Enum):
    """Trade direction."""
    LONG = "long"
    SHORT = "short"


# === Configuration Dataclasses ===


@dataclass
class OHLCVSource:
    """OHLCV data source configuration."""
    file_path: Optional[str] = None
    api_url: Optional[str] = None
    symbol: Optional[str] = None
    timeframe: str = "day"


@dataclass
class IndicatorConfig:
    """Indicator computation configuration."""
    name: str  # e.g., "RSI_14", "EMA_20", "MACD_12_26_9"
    indicator_type: str  # "RSI", "EMA", "MACD", "ATR", "ADX", "VWAP"
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RuleCondition:
    """A single rule condition."""
    indicator: str  # e.g., "RSI_14"
    comparator: str  # "GT", "LT", "CROSSES_ABOVE", etc.
    value: Union[float, str]  # numeric threshold or another indicator name


@dataclass
class RuleConfig:
    """A rule consisting of AND-combined conditions."""
    conditions: List[RuleCondition] = field(default_factory=list)


@dataclass
class StopLossConfig:
    """Stop loss configuration."""
    model: str = "fixed"  # "fixed" or "percentage"
    value: float = 0.0  # points or percentage


@dataclass
class TargetConfig:
    """Target/take-profit configuration."""
    model: str = "fixed"  # "fixed" or "percentage"
    value: float = 0.0


@dataclass
class TrailingStopConfig:
    """Trailing stop configuration."""
    model: str = "fixed"  # "fixed" or "percentage"
    value: float = 0.0  # trail distance


@dataclass
class SlippageConfig:
    """Slippage model configuration."""
    model: str = "fixed"  # "fixed" or "percentage"
    value: float = 0.0  # points or percentage


@dataclass
class BrokerageConfig:
    """Brokerage fee configuration."""
    model: str = "fixed"  # "fixed" or "percentage"
    value: float = 0.0  # flat fee or percentage of trade value


@dataclass
class WalkForwardConfig:
    """Walk-forward window configuration."""
    in_sample_bars: int = 252  # e.g., 1 year of daily bars
    out_of_sample_bars: int = 63  # e.g., 3 months
    step_bars: int = 63  # step forward by OOS size


@dataclass
class BacktestConfig:
    """Complete backtesting strategy configuration."""
    symbol: str = ""
    ohlcv_source: OHLCVSource = field(default_factory=OHLCVSource)
    initial_capital: float = 100000.0
    indicators: List[IndicatorConfig] = field(default_factory=list)
    entry_rules: List[RuleConfig] = field(default_factory=list)
    stop_loss: Optional[StopLossConfig] = None
    target: Optional[TargetConfig] = None
    trailing_stop: Optional[TrailingStopConfig] = None
    max_holding_period: Optional[int] = None  # bars
    slippage: SlippageConfig = field(default_factory=SlippageConfig)
    brokerage: BrokerageConfig = field(default_factory=BrokerageConfig)
    test_mode: TestMode = TestMode.IN_SAMPLE
    split_ratio: float = 0.7  # for in/out-of-sample split
    walk_forward_config: Optional[WalkForwardConfig] = None
    position_size: float = 1.0  # fraction of capital per trade (0-1)


# === Result Dataclasses ===


@dataclass
class TradeRecord:
    """Record of a single completed trade."""
    trade_id: int = 0
    direction: TradeDirection = TradeDirection.LONG
    entry_bar: int = 0
    exit_bar: int = 0
    entry_price: float = 0.0
    exit_price: float = 0.0
    quantity: float = 0.0
    gross_pnl: float = 0.0
    net_pnl: float = 0.0
    entry_cost: float = 0.0
    exit_cost: float = 0.0
    exit_reason: str = ""  # "stop_loss", "target", "trailing_stop", "holding_period", "end_of_data"
    holding_period: int = 0  # bars


@dataclass
class EquityPoint:
    """A single point on the equity curve."""
    bar_index: int = 0
    equity: float = 0.0
    timestamp: Optional[float] = None


@dataclass
class WindowMetrics:
    """Metrics for a single walk-forward window."""
    window_index: int = 0
    in_sample_start: int = 0
    in_sample_end: int = 0
    out_of_sample_start: int = 0
    out_of_sample_end: int = 0
    total_trades: int = 0
    total_return_pct: float = 0.0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    sharpe_ratio: float = 0.0


@dataclass
class PerformanceMetrics:
    """All performance metrics for a backtest run."""
    total_return_pct: float = 0.0
    cagr: float = 0.0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    expectancy: float = 0.0
    average_winner: float = 0.0
    average_loser: float = 0.0
    max_drawdown_pct: float = 0.0
    sharpe_ratio: float = 0.0
    total_trades: int = 0
    average_holding_period: float = 0.0  # in bars


@dataclass
class BacktestResult:
    """Complete backtest result."""
    backtest_id: str = ""
    symbol: str = ""
    test_mode: TestMode = TestMode.IN_SAMPLE
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    initial_capital: float = 0.0
    final_equity: float = 0.0
    trades: List[TradeRecord] = field(default_factory=list)
    equity_curve: List[EquityPoint] = field(default_factory=list)
    metrics: PerformanceMetrics = field(default_factory=PerformanceMetrics)
    per_window_metrics: Optional[List[WindowMetrics]] = None
    survivorship_bias_warning: bool = False
    config: Optional[BacktestConfig] = None


# === Pydantic API Models ===


class OHLCVSourceModel(BaseModel):
    """Pydantic model for OHLCV source."""
    file_path: Optional[str] = None
    api_url: Optional[str] = None
    symbol: Optional[str] = None
    timeframe: str = "day"


class IndicatorConfigModel(BaseModel):
    """Pydantic model for indicator config."""
    name: str
    indicator_type: str
    params: Dict[str, Any] = Field(default_factory=dict)


class RuleConditionModel(BaseModel):
    """Pydantic model for rule condition."""
    indicator: str
    comparator: str
    value: Union[float, str]


class RuleConfigModel(BaseModel):
    """Pydantic model for rule config."""
    conditions: List[RuleConditionModel] = Field(default_factory=list)


class StopLossConfigModel(BaseModel):
    """Pydantic model for stop loss config."""
    model: str = "fixed"
    value: float = 0.0


class TargetConfigModel(BaseModel):
    """Pydantic model for target config."""
    model: str = "fixed"
    value: float = 0.0


class TrailingStopConfigModel(BaseModel):
    """Pydantic model for trailing stop config."""
    model: str = "fixed"
    value: float = 0.0


class SlippageConfigModel(BaseModel):
    """Pydantic model for slippage config."""
    model: str = "fixed"
    value: float = 0.0


class BrokerageConfigModel(BaseModel):
    """Pydantic model for brokerage config."""
    model: str = "fixed"
    value: float = 0.0


class WalkForwardConfigModel(BaseModel):
    """Pydantic model for walk-forward config."""
    in_sample_bars: int = 252
    out_of_sample_bars: int = 63
    step_bars: int = 63


class BacktestRunRequest(BaseModel):
    """API request model for running a backtest."""
    symbol: str = Field(..., description="Trading symbol")
    ohlcv_source: OHLCVSourceModel = Field(default_factory=OHLCVSourceModel)
    initial_capital: float = Field(default=100000.0, gt=0)
    indicators: List[IndicatorConfigModel] = Field(default_factory=list)
    entry_rules: List[RuleConfigModel] = Field(default_factory=list)
    stop_loss: Optional[StopLossConfigModel] = None
    target: Optional[TargetConfigModel] = None
    trailing_stop: Optional[TrailingStopConfigModel] = None
    max_holding_period: Optional[int] = Field(default=None, ge=1)
    slippage: SlippageConfigModel = Field(default_factory=SlippageConfigModel)
    brokerage: BrokerageConfigModel = Field(default_factory=BrokerageConfigModel)
    test_mode: TestMode = TestMode.IN_SAMPLE
    split_ratio: float = Field(default=0.7, ge=0.1, le=0.99)
    walk_forward_config: Optional[WalkForwardConfigModel] = None
    position_size: float = Field(default=1.0, gt=0, le=1.0)


class TradeRecordResponse(BaseModel):
    """API response model for a trade record."""
    trade_id: int
    direction: str
    entry_bar: int
    exit_bar: int
    entry_price: float
    exit_price: float
    quantity: float
    gross_pnl: float
    net_pnl: float
    entry_cost: float
    exit_cost: float
    exit_reason: str
    holding_period: int


class EquityPointResponse(BaseModel):
    """API response model for equity point."""
    bar_index: int
    equity: float
    timestamp: Optional[float] = None


class PerformanceMetricsResponse(BaseModel):
    """API response model for performance metrics."""
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
    average_holding_period: float


class WindowMetricsResponse(BaseModel):
    """API response model for window metrics."""
    window_index: int
    in_sample_start: int
    in_sample_end: int
    out_of_sample_start: int
    out_of_sample_end: int
    total_trades: int
    total_return_pct: float
    win_rate: float
    profit_factor: float
    sharpe_ratio: float


class BacktestRunResponse(BaseModel):
    """API response model for backtest results."""
    backtest_id: str
    symbol: str
    test_mode: str
    initial_capital: float
    final_equity: float
    trades: List[TradeRecordResponse]
    equity_curve: List[EquityPointResponse]
    metrics: PerformanceMetricsResponse
    per_window_metrics: Optional[List[WindowMetricsResponse]] = None
    survivorship_bias_warning: bool


# === Conversion Helpers ===


def request_to_config(request: BacktestRunRequest) -> BacktestConfig:
    """Convert a Pydantic request model to a BacktestConfig dataclass."""
    # Use top-level symbol as fallback for ohlcv_source.symbol
    source_symbol = request.ohlcv_source.symbol or request.symbol
    ohlcv_source = OHLCVSource(
        file_path=request.ohlcv_source.file_path,
        api_url=request.ohlcv_source.api_url,
        symbol=source_symbol,
        timeframe=request.ohlcv_source.timeframe,
    )

    indicators = [
        IndicatorConfig(name=i.name, indicator_type=i.indicator_type, params=i.params)
        for i in request.indicators
    ]

    entry_rules = [
        RuleConfig(
            conditions=[
                RuleCondition(
                    indicator=c.indicator,
                    comparator=c.comparator,
                    value=c.value,
                )
                for c in rule.conditions
            ]
        )
        for rule in request.entry_rules
    ]

    stop_loss = None
    if request.stop_loss:
        stop_loss = StopLossConfig(model=request.stop_loss.model, value=request.stop_loss.value)

    target = None
    if request.target:
        target = TargetConfig(model=request.target.model, value=request.target.value)

    trailing_stop = None
    if request.trailing_stop:
        trailing_stop = TrailingStopConfig(
            model=request.trailing_stop.model, value=request.trailing_stop.value
        )

    slippage = SlippageConfig(model=request.slippage.model, value=request.slippage.value)
    brokerage = BrokerageConfig(model=request.brokerage.model, value=request.brokerage.value)

    walk_forward_config = None
    if request.walk_forward_config:
        walk_forward_config = WalkForwardConfig(
            in_sample_bars=request.walk_forward_config.in_sample_bars,
            out_of_sample_bars=request.walk_forward_config.out_of_sample_bars,
            step_bars=request.walk_forward_config.step_bars,
        )

    return BacktestConfig(
        symbol=request.symbol,
        ohlcv_source=ohlcv_source,
        initial_capital=request.initial_capital,
        indicators=indicators,
        entry_rules=entry_rules,
        stop_loss=stop_loss,
        target=target,
        trailing_stop=trailing_stop,
        max_holding_period=request.max_holding_period,
        slippage=slippage,
        brokerage=brokerage,
        test_mode=request.test_mode,
        split_ratio=request.split_ratio,
        walk_forward_config=walk_forward_config,
        position_size=request.position_size,
    )


def result_to_response(result: BacktestResult) -> BacktestRunResponse:
    """Convert a BacktestResult dataclass to a Pydantic response model."""
    trades = [
        TradeRecordResponse(
            trade_id=t.trade_id,
            direction=t.direction.value,
            entry_bar=t.entry_bar,
            exit_bar=t.exit_bar,
            entry_price=t.entry_price,
            exit_price=t.exit_price,
            quantity=t.quantity,
            gross_pnl=t.gross_pnl,
            net_pnl=t.net_pnl,
            entry_cost=t.entry_cost,
            exit_cost=t.exit_cost,
            exit_reason=t.exit_reason,
            holding_period=t.holding_period,
        )
        for t in result.trades
    ]

    equity_curve = [
        EquityPointResponse(
            bar_index=ep.bar_index,
            equity=ep.equity,
            timestamp=ep.timestamp,
        )
        for ep in result.equity_curve
    ]

    metrics = PerformanceMetricsResponse(
        total_return_pct=result.metrics.total_return_pct,
        cagr=result.metrics.cagr,
        win_rate=result.metrics.win_rate,
        profit_factor=result.metrics.profit_factor,
        expectancy=result.metrics.expectancy,
        average_winner=result.metrics.average_winner,
        average_loser=result.metrics.average_loser,
        max_drawdown_pct=result.metrics.max_drawdown_pct,
        sharpe_ratio=result.metrics.sharpe_ratio,
        total_trades=result.metrics.total_trades,
        average_holding_period=result.metrics.average_holding_period,
    )

    per_window_metrics = None
    if result.per_window_metrics:
        per_window_metrics = [
            WindowMetricsResponse(
                window_index=wm.window_index,
                in_sample_start=wm.in_sample_start,
                in_sample_end=wm.in_sample_end,
                out_of_sample_start=wm.out_of_sample_start,
                out_of_sample_end=wm.out_of_sample_end,
                total_trades=wm.total_trades,
                total_return_pct=wm.total_return_pct,
                win_rate=wm.win_rate,
                profit_factor=wm.profit_factor,
                sharpe_ratio=wm.sharpe_ratio,
            )
            for wm in result.per_window_metrics
        ]

    return BacktestRunResponse(
        backtest_id=result.backtest_id,
        symbol=result.symbol,
        test_mode=result.test_mode.value,
        initial_capital=result.initial_capital,
        final_equity=result.final_equity,
        trades=trades,
        equity_curve=equity_curve,
        metrics=metrics,
        per_window_metrics=per_window_metrics,
        survivorship_bias_warning=result.survivorship_bias_warning,
    )
