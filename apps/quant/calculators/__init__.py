"""
Calculators module for quantitative analysis.

This module contains various financial calculation functions including
technical indicators and options pricing models.
"""

from .adx import calculate_adx, calculate_adx_series
from .atr import calculate_atr, calculate_atr_series, calculate_true_range
from .greeks import calculate_greeks
from .trendlines import (
    detect_trendlines,
    calculate_trendline_touches,
)
from .macd import calculate_macd, calculate_macd_series, calculate_ema
from .rsi import calculate_rsi, calculate_rsi_series
from .support_resistance import (
    detect_support_resistance,
    find_local_extrema,
    cluster_levels,
    calculate_strength,
)
from .bollinger import calculate_bollinger_bands, calculate_bollinger_bands_series
from .price_range import (
    calculate_52_week_high_low,
    calculate_distance_from_extremes,
    calculate_momentum,
    calculate_momentum_series,
    calculate_price_range_analysis,
)
from .volume_analysis import (
    calculate_volume_ma,
    calculate_volume_ma_series,
    calculate_relative_volume,
    calculate_relative_volume_series,
    calculate_volume_ratio,
    calculate_volume_ratio_series,
)
from .vwap import (
    calculate_vwap,
    calculate_vwap_series,
    calculate_vwap_with_bands,
)
from .swing_detector import SwingDetector
from .trendline_calculator import TrendlineCalculator
from .breakout_detector import (
    detect_resistance_breakout,
    detect_support_breakdown,
    detect_breakout,
    BreakoutType,
    BreakoutResult,
)

__all__ = [
    "calculate_adx",
    "calculate_adx_series",
    "calculate_atr",
    "calculate_atr_series",
    "calculate_true_range",
    "calculate_bollinger_bands",
    "calculate_bollinger_bands_series",
    "calculate_greeks",
    "detect_trendlines",
    "calculate_trendline_touches",
    "calculate_macd",
    "calculate_macd_series",
    "calculate_ema",
    "calculate_rsi",
    "calculate_rsi_series",
    "detect_support_resistance",
    "find_local_extrema",
    "cluster_levels",
    "calculate_strength",
    "calculate_52_week_high_low",
    "calculate_distance_from_extremes",
    "calculate_momentum",
    "calculate_momentum_series",
    "calculate_price_range_analysis",
    "calculate_volume_ma",
    "calculate_volume_ma_series",
    "calculate_relative_volume",
    "calculate_relative_volume_series",
    "calculate_volume_ratio",
    "calculate_volume_ratio_series",
    "calculate_vwap",
    "calculate_vwap_series",
    "calculate_vwap_with_bands",
    "SwingDetector",
    "TrendlineCalculator",
    "detect_resistance_breakout",
    "detect_support_breakdown",
    "detect_breakout",
    "BreakoutType",
    "BreakoutResult",
]
