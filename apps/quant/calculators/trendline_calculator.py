"""
Trendline calculator using linear regression on swing points.

This module provides a class-based interface for calculating support and resistance
trendlines using swing points detected by SwingDetector.
"""

import numpy as np
from scipy import stats
from typing import List, Optional
from models import OHLCVData, SwingPoint, SwingType, TrendlineResult
from calculators.swing_detector import SwingDetector


class TrendlineCalculator:
    """
    Calculate support and resistance trendlines from swing points.

    Uses linear regression on swing lows for support trendlines and swing highs
    for resistance trendlines.
    """

    def __init__(self, lookback_period: int = 3):
        """
        Initialize the trendline calculator.

        Args:
            lookback_period: Lookback period for swing detection (passed to SwingDetector)

        Raises:
            ValueError: If lookback_period is less than 1
        """
        if lookback_period < 1:
            raise ValueError("lookback_period must be at least 1")
        self.lookback_period = lookback_period
        self.swing_detector = SwingDetector(lookback_period=lookback_period)

    def calculate_support_trendline(
        self, data: List[OHLCVData], min_points: int = 2
    ) -> Optional[TrendlineResult]:
        """
        Calculate support trendline using linear regression on swing lows.

        Args:
            data: List of OHLCV data points, must be sorted by timestamp
            min_points: Minimum number of swing lows required for trendline

        Returns:
            TrendlineResult with slope, intercept, and R² value, or None if insufficient points

        Raises:
            ValueError: If data is empty or min_points is less than 2
        """
        if not data:
            raise ValueError("data cannot be empty")
        if min_points < 2:
            raise ValueError("min_points must be at least 2")

        # Detect swing points
        swing_points = self.swing_detector.detect_swing_points(data)

        # Filter for swing lows only
        swing_lows = [sp for sp in swing_points if sp.type == SwingType.LOW]

        if len(swing_lows) < min_points:
            return None

        # Perform linear regression on swing lows
        return self._fit_trendline(swing_lows, len(data))

    def calculate_resistance_trendline(
        self, data: List[OHLCVData], min_points: int = 2
    ) -> Optional[TrendlineResult]:
        """
        Calculate resistance trendline using linear regression on swing highs.

        Args:
            data: List of OHLCV data points, must be sorted by timestamp
            min_points: Minimum number of swing highs required for trendline

        Returns:
            TrendlineResult with slope, intercept, and R² value, or None if insufficient points

        Raises:
            ValueError: If data is empty or min_points is less than 2
        """
        if not data:
            raise ValueError("data cannot be empty")
        if min_points < 2:
            raise ValueError("min_points must be at least 2")

        # Detect swing points
        swing_points = self.swing_detector.detect_swing_points(data)

        # Filter for swing highs only
        swing_highs = [sp for sp in swing_points if sp.type == SwingType.HIGH]

        if len(swing_highs) < min_points:
            return None

        # Perform linear regression on swing highs
        return self._fit_trendline(swing_highs, len(data))

    def calculate_both_trendlines(
        self, data: List[OHLCVData], min_points: int = 2
    ) -> tuple[Optional[TrendlineResult], Optional[TrendlineResult]]:
        """
        Calculate both support and resistance trendlines.

        Args:
            data: List of OHLCV data points, must be sorted by timestamp
            min_points: Minimum number of swing points required for each trendline

        Returns:
            Tuple of (support_trendline, resistance_trendline), either may be None

        Raises:
            ValueError: If data is empty or min_points is less than 2
        """
        if not data:
            raise ValueError("data cannot be empty")
        if min_points < 2:
            raise ValueError("min_points must be at least 2")

        support = self.calculate_support_trendline(data, min_points)
        resistance = self.calculate_resistance_trendline(data, min_points)

        return (support, resistance)

    def _fit_trendline(
        self, swing_points: List[SwingPoint], data_length: int
    ) -> TrendlineResult:
        """
        Fit a linear regression trendline to swing points.

        Args:
            swing_points: List of swing points (all same type: HIGH or LOW)
            data_length: Total length of the original data array

        Returns:
            TrendlineResult with slope, intercept, R², start_point, and end_point
        """
        # Extract indices and prices for regression
        x_values = np.array([sp.index for sp in swing_points], dtype=float)
        y_values = np.array([sp.price for sp in swing_points], dtype=float)

        # Perform linear regression
        slope, intercept, r_value, _, _ = stats.linregress(x_values, y_values)
        r_squared = r_value**2

        # Calculate start and end points
        start_x = 0.0
        end_x = float(data_length - 1)
        start_y = slope * start_x + intercept
        end_y = slope * end_x + intercept

        return TrendlineResult(
            slope=slope,
            intercept=intercept,
            r_squared=r_squared,
            start_point=(start_x, start_y),
            end_point=(end_x, end_y),
        )
