"""
Opening range calculator for intraday trading analysis.

This module calculates the opening range (first N-minute candle) and detects
breakouts above or below the opening range with volume confirmation.
"""

from typing import List, Optional
from models import OHLCVData
from models.intraday import OpeningRangeResult, BreakoutStatus
from calculators.volume_analysis import calculate_volume_ma


class OpeningRangeCalculator:
    """
    Calculator for opening range analysis.

    The opening range is defined as the high and low of the first N minutes
    of trading (typically 15 minutes). Traders watch for breakouts above or
    below this range as potential trading signals.
    """

    def __init__(self, period_minutes: int = 15):
        """
        Initialize the opening range calculator.

        Args:
            period_minutes: Number of minutes for opening range (default: 15)

        Raises:
            ValueError: If period_minutes is less than 1
        """
        if period_minutes < 1:
            raise ValueError("period_minutes must be at least 1")
        self.period_minutes = period_minutes

    def calculate_opening_range(
        self,
        data: List[OHLCVData],
        timeframe_minutes: int = 5,
        current_price: Optional[float] = None,
        volume_period: int = 20,
        volume_threshold: float = 1.0,
    ) -> OpeningRangeResult:
        """
        Calculate opening range and detect breakouts.

        Args:
            data: List of OHLCV data points (must be sorted by timestamp)
            timeframe_minutes: Timeframe of each candle in minutes (default: 5)
            current_price: Current price for breakout detection (default: last close)
            volume_period: Period for volume average calculation (default: 20)
            volume_threshold: Minimum volume ratio for confirmation (default: 1.0)

        Returns:
            OpeningRangeResult with range data and breakout status

        Raises:
            ValueError: If data is insufficient or parameters are invalid
        """
        if not data:
            raise ValueError("data cannot be empty")

        if timeframe_minutes < 1:
            raise ValueError("timeframe_minutes must be at least 1")

        if volume_period < 1:
            raise ValueError("volume_period must be at least 1")

        if volume_threshold <= 0:
            raise ValueError("volume_threshold must be positive")

        # Calculate how many candles make up the opening range
        num_candles = max(1, self.period_minutes // timeframe_minutes)

        if len(data) < num_candles:
            raise ValueError(
                f"Insufficient data: need at least {num_candles} candles "
                f"for {self.period_minutes}-minute opening range, got {len(data)}"
            )

        # Get the opening range candles (first N candles)
        opening_candles = data[:num_candles]

        # Calculate opening range high and low
        opening_high = max(candle.high for candle in opening_candles)
        opening_low = min(candle.low for candle in opening_candles)

        # Calculate range metrics
        range_size = opening_high - opening_low
        midpoint = (opening_high + opening_low) / 2
        range_percent = (range_size / midpoint) * 100 if midpoint > 0 else 0.0

        # Use current price or last close for breakout detection
        if current_price is None:
            current_price = data[-1].close

        # Detect breakout status
        breakout_status = self._detect_breakout(
            current_price, opening_high, opening_low
        )

        # Calculate breakout distance if breakout detected
        breakout_distance = None
        if breakout_status == BreakoutStatus.BREAKOUT_ABOVE:
            breakout_distance = ((current_price - opening_high) / opening_high) * 100
        elif breakout_status == BreakoutStatus.BREAKDOWN_BELOW:
            breakout_distance = ((opening_low - current_price) / opening_low) * 100

        # Calculate volume confirmation
        volume_confirmed = False
        volume_ratio = 0.0

        if len(data) >= volume_period:
            volumes = [bar.volume for bar in data]
            avg_volume = calculate_volume_ma(volumes, volume_period)
            current_volume = data[-1].volume
            volume_ratio = current_volume / avg_volume if avg_volume > 0 else 0.0
            volume_confirmed = volume_ratio >= volume_threshold
        else:
            # Not enough data for volume analysis
            volume_ratio = 0.0
            volume_confirmed = False

        return OpeningRangeResult(
            high=opening_high,
            low=opening_low,
            midpoint=midpoint,
            range_size=range_size,
            range_percent=range_percent,
            breakout_status=breakout_status,
            current_price=current_price,
            breakout_distance=breakout_distance,
            volume_confirmed=volume_confirmed,
            volume_ratio=volume_ratio,
        )

    def _detect_breakout(
        self, current_price: float, opening_high: float, opening_low: float
    ) -> BreakoutStatus:
        """
        Detect breakout status based on current price.

        Args:
            current_price: Current price
            opening_high: Opening range high
            opening_low: Opening range low

        Returns:
            BreakoutStatus enum value
        """
        if current_price > opening_high:
            return BreakoutStatus.BREAKOUT_ABOVE
        elif current_price < opening_low:
            return BreakoutStatus.BREAKDOWN_BELOW
        else:
            return BreakoutStatus.NO_BREAKOUT

    def detect_breakout_above(
        self,
        data: List[OHLCVData],
        timeframe_minutes: int = 5,
        volume_period: int = 20,
        volume_threshold: float = 1.0,
    ) -> bool:
        """
        Detect if current price has broken above opening range.

        Args:
            data: List of OHLCV data points
            timeframe_minutes: Timeframe of each candle in minutes
            volume_period: Period for volume average calculation
            volume_threshold: Minimum volume ratio for confirmation

        Returns:
            True if breakout above detected, False otherwise
        """
        result = self.calculate_opening_range(
            data, timeframe_minutes, None, volume_period, volume_threshold
        )
        return result.breakout_status == BreakoutStatus.BREAKOUT_ABOVE

    def detect_breakdown_below(
        self,
        data: List[OHLCVData],
        timeframe_minutes: int = 5,
        volume_period: int = 20,
        volume_threshold: float = 1.0,
    ) -> bool:
        """
        Detect if current price has broken below opening range.

        Args:
            data: List of OHLCV data points
            timeframe_minutes: Timeframe of each candle in minutes
            volume_period: Period for volume average calculation
            volume_threshold: Minimum volume ratio for confirmation

        Returns:
            True if breakdown below detected, False otherwise
        """
        result = self.calculate_opening_range(
            data, timeframe_minutes, None, volume_period, volume_threshold
        )
        return result.breakout_status == BreakoutStatus.BREAKDOWN_BELOW

    def calculate_breakout_distance_percent(
        self,
        current_price: float,
        opening_high: float,
        opening_low: float,
    ) -> float:
        """
        Calculate breakout distance as percentage.

        Args:
            current_price: Current price
            opening_high: Opening range high
            opening_low: Opening range low

        Returns:
            Breakout distance as percentage (positive for above, negative for below)

        Raises:
            ValueError: If prices are invalid
        """
        if current_price <= 0 or opening_high <= 0 or opening_low <= 0:
            raise ValueError("All prices must be positive")

        if opening_high < opening_low:
            raise ValueError("opening_high must be >= opening_low")

        if current_price > opening_high:
            # Breakout above
            return ((current_price - opening_high) / opening_high) * 100
        elif current_price < opening_low:
            # Breakdown below (negative value)
            return -((opening_low - current_price) / opening_low) * 100
        else:
            # Within range
            return 0.0
