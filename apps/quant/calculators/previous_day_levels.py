"""
Previous day levels calculator for intraday trading analysis.

This module calculates previous trading day's high, low, and close levels,
detects price gaps, and identifies when current price breaches these levels.
These levels are critical for intraday trading decisions.
"""

from typing import List, Optional
from models import OHLCVData
from models.intraday import (
    PreviousDayLevelsResult,
    BreachStatus,
    GapType,
)


class PreviousDayLevelsCalculator:
    """
    Calculator for previous day levels analysis.

    Identifies the previous trading day from historical data and calculates
    key levels (high, low, close). Detects gaps and breaches of these levels.
    """

    def __init__(self, gap_threshold_percent: float = 0.1):
        """
        Initialize the previous day levels calculator.

        Args:
            gap_threshold_percent: Minimum percentage for gap classification (default: 0.1%)

        Raises:
            ValueError: If gap_threshold_percent is negative
        """
        if gap_threshold_percent < 0:
            raise ValueError("gap_threshold_percent must be non-negative")
        self.gap_threshold_percent = gap_threshold_percent

    def calculate_previous_day_levels(
        self,
        historical_data: List[OHLCVData],
        current_price: Optional[float] = None,
        current_open: Optional[float] = None,
    ) -> PreviousDayLevelsResult:
        """
        Calculate previous day levels and detect breaches.

        Args:
            historical_data: List of OHLCV data (must include at least 2 days)
            current_price: Current price for breach detection (default: last close)
            current_open: Current day's open price for gap calculation (default: last open)

        Returns:
            PreviousDayLevelsResult with levels and breach analysis

        Raises:
            ValueError: If insufficient data or invalid parameters
        """
        if not historical_data:
            raise ValueError("historical_data cannot be empty")

        if len(historical_data) < 2:
            raise ValueError(
                f"Need at least 2 days of data for previous day analysis, got {len(historical_data)}"
            )

        # Previous day is the second-to-last day
        prev_day_data = historical_data[-2]
        
        # Extract previous day levels
        prev_day_high = prev_day_data.high
        prev_day_low = prev_day_data.low
        prev_day_close = prev_day_data.close

        # Get current day's open for gap calculation
        if current_open is None:
            current_open = historical_data[-1].open

        # Calculate gap
        gap_percent = ((current_open - prev_day_close) / prev_day_close) * 100.0
        gap_type = self._classify_gap(gap_percent)

        # Get current price for breach detection
        if current_price is None:
            current_price = historical_data[-1].close

        # Detect breach status
        breach_status = self._detect_breach(current_price, prev_day_high, prev_day_low)

        # Calculate distances
        distance_from_high_percent = (
            (current_price - prev_day_high) / prev_day_high
        ) * 100.0
        distance_from_low_percent = (
            (current_price - prev_day_low) / prev_day_low
        ) * 100.0

        # Calculate breach significance
        breach_significance = self._calculate_breach_significance(
            current_price, prev_day_high, prev_day_low, prev_day_close
        )

        return PreviousDayLevelsResult(
            prev_day_high=prev_day_high,
            prev_day_low=prev_day_low,
            prev_day_close=prev_day_close,
            gap_percent=gap_percent,
            gap_type=gap_type,
            breach_status=breach_status,
            current_price=current_price,
            distance_from_high_percent=distance_from_high_percent,
            distance_from_low_percent=distance_from_low_percent,
            breach_significance=breach_significance,
        )

    def _classify_gap(self, gap_percent: float) -> GapType:
        """
        Classify gap type based on percentage.

        Args:
            gap_percent: Gap as percentage

        Returns:
            GapType enum value
        """
        if gap_percent > self.gap_threshold_percent:
            return GapType.GAP_UP
        elif gap_percent < -self.gap_threshold_percent:
            return GapType.GAP_DOWN
        else:
            return GapType.NO_GAP

    def _detect_breach(
        self, current_price: float, prev_high: float, prev_low: float
    ) -> BreachStatus:
        """
        Detect breach status based on current price.

        Args:
            current_price: Current price
            prev_high: Previous day high
            prev_low: Previous day low

        Returns:
            BreachStatus enum value
        """
        if current_price > prev_high:
            return BreachStatus.ABOVE_HIGH
        elif current_price < prev_low:
            return BreachStatus.BELOW_LOW
        else:
            return BreachStatus.WITHIN_RANGE

    def _calculate_breach_significance(
        self,
        current_price: float,
        prev_high: float,
        prev_low: float,
        prev_close: float,
    ) -> float:
        """
        Calculate breach significance score (0.0-1.0).

        Significance is based on:
        - How far the price has moved beyond the level
        - The size of the previous day's range

        Args:
            current_price: Current price
            prev_high: Previous day high
            prev_low: Previous day low
            prev_close: Previous day close

        Returns:
            Significance score (0.0-1.0)
        """
        prev_range = prev_high - prev_low
        
        if prev_range == 0:
            # Edge case: no range in previous day
            return 0.0

        if current_price > prev_high:
            # Breach above
            breach_distance = current_price - prev_high
            # Normalize to 0-1 scale (1.0 means breach distance = prev_range)
            significance = min(1.0, breach_distance / prev_range)
        elif current_price < prev_low:
            # Breach below
            breach_distance = prev_low - current_price
            # Normalize to 0-1 scale
            significance = min(1.0, breach_distance / prev_range)
        else:
            # Within range - calculate as distance from nearest level
            distance_to_high = prev_high - current_price
            distance_to_low = current_price - prev_low
            
            # If near a level, significance is higher
            min_distance = min(distance_to_high, distance_to_low)
            # Inverse: closer to level = higher significance
            significance = 1.0 - min(1.0, min_distance / (prev_range / 2))

        return float(significance)

    def detect_breach_above_high(
        self,
        historical_data: List[OHLCVData],
        current_price: Optional[float] = None,
    ) -> bool:
        """
        Detect if current price has breached above previous day high.

        Args:
            historical_data: List of OHLCV data
            current_price: Current price (default: last close)

        Returns:
            True if breach above detected, False otherwise
        """
        result = self.calculate_previous_day_levels(historical_data, current_price)
        return result.breach_status == BreachStatus.ABOVE_HIGH

    def detect_breach_below_low(
        self,
        historical_data: List[OHLCVData],
        current_price: Optional[float] = None,
    ) -> bool:
        """
        Detect if current price has breached below previous day low.

        Args:
            historical_data: List of OHLCV data
            current_price: Current price (default: last close)

        Returns:
            True if breach below detected, False otherwise
        """
        result = self.calculate_previous_day_levels(historical_data, current_price)
        return result.breach_status == BreachStatus.BELOW_LOW

    def calculate_distance_from_levels(
        self,
        current_price: float,
        prev_high: float,
        prev_low: float,
    ) -> dict:
        """
        Calculate distance from previous day levels.

        Args:
            current_price: Current price
            prev_high: Previous day high
            prev_low: Previous day low

        Returns:
            Dictionary with distance_from_high_percent and distance_from_low_percent

        Raises:
            ValueError: If prices are invalid
        """
        if current_price <= 0 or prev_high <= 0 or prev_low <= 0:
            raise ValueError("All prices must be positive")

        if prev_high < prev_low:
            raise ValueError(f"prev_high ({prev_high}) must be >= prev_low ({prev_low})")

        distance_from_high_percent = ((current_price - prev_high) / prev_high) * 100.0
        distance_from_low_percent = ((current_price - prev_low) / prev_low) * 100.0

        return {
            "distance_from_high_percent": distance_from_high_percent,
            "distance_from_low_percent": distance_from_low_percent,
        }
