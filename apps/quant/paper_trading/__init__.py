"""
Paper Trading Module for the Quant Engine.

Provides trade monitoring, evaluation, and performance calculation
for the Paper Trading System.
"""

from .models import PaperTradeData, TradeAction, MonitorCycleResult, ClosedTradeData
from .exceptions import (
    PaperTradingError,
    TradeNotFoundError,
    MarketDataUnavailableError,
    APIConnectionError,
)
from .performance_calculator import PerformanceCalculator, PerformanceMetrics
from .trade_monitor import TradeMonitor

__all__ = [
    "PaperTradeData",
    "TradeAction",
    "MonitorCycleResult",
    "ClosedTradeData",
    "PaperTradingError",
    "TradeNotFoundError",
    "MarketDataUnavailableError",
    "APIConnectionError",
    "PerformanceCalculator",
    "PerformanceMetrics",
    "TradeMonitor",
]
