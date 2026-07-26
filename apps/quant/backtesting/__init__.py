"""
Backtesting Engine Module.

Simulates trading strategies against historical OHLCV data using pure Python + numpy.
No pandas dependency. Integrates with existing calculator modules and exposes
FastAPI endpoints for strategy backtesting.

Components:
- DataLoader: OHLCV data loading from JSON/API
- IndicatorEngine: Indicator computation orchestrator
- RuleEvaluator: Entry/exit rule evaluation
- PositionManager: Position tracking with stop/target/trailing
- CostModel: Slippage and brokerage simulation
- MetricsCalculator: Performance metrics computation
- BiasGuard: Look-ahead bias prevention
- WalkForwardRunner: Walk-forward analysis
- BacktestEngine: Core execution loop
"""

from .models import (
    BacktestConfig,
    OHLCVSource,
    IndicatorConfig,
    RuleCondition,
    RuleConfig,
    StopLossConfig,
    TargetConfig,
    TrailingStopConfig,
    SlippageConfig,
    BrokerageConfig,
    WalkForwardConfig,
    TestMode,
    TradeRecord,
    EquityPoint,
    WindowMetrics,
    PerformanceMetrics,
    BacktestResult,
    BacktestRunRequest,
    BacktestRunResponse,
)
from .engine import BacktestEngine
from .router import router

__all__ = [
    "BacktestConfig",
    "OHLCVSource",
    "IndicatorConfig",
    "RuleCondition",
    "RuleConfig",
    "StopLossConfig",
    "TargetConfig",
    "TrailingStopConfig",
    "SlippageConfig",
    "BrokerageConfig",
    "WalkForwardConfig",
    "TestMode",
    "TradeRecord",
    "EquityPoint",
    "WindowMetrics",
    "PerformanceMetrics",
    "BacktestResult",
    "BacktestRunRequest",
    "BacktestRunResponse",
    "BacktestEngine",
    "router",
]
