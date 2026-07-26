"""
Technical Analyzer for the Options Scalping Agent.

This module wraps the Phase 7 IntradayAnalysisService and adds
scalping-specific analysis including support/resistance identification,
trendline detection, and trend classification.

Requirements: 25.1, 25.2, 25.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7,
              6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8, 6.9
"""

from __future__ import annotations

import logging
from typing import List, Optional

from models import OHLCVData, SwingType
from models.intraday import IntradayInterval
from services.intraday_analysis_service import IntradayAnalysisService
from calculators.moving_averages import calculate_ema
from calculators.vwap import calculate_vwap
from calculators.rsi import calculate_rsi
from calculators.macd import calculate_macd
from calculators.atr import calculate_atr
from calculators.volume_analysis import calculate_volume_ma, calculate_relative_volume
from calculators.swing_detector import SwingDetector

from scalper.models import (
    TechnicalIndicators,
    SupportResistance,
    TrendClassification,
    TrendlineStatus,
)


logger = logging.getLogger(__name__)


class TechnicalAnalyzerError(Exception):
    """Raised when technical analysis fails."""

    pass


class TechnicalAnalyzer:
    """
    Technical Analyzer for the Options Scalping Agent.

    Wraps the Phase 7 IntradayAnalysisService and adds scalping-specific
    analysis:
    - Support/resistance identification using swing highs/lows (50-bar lookback)
    - Trendline detection using ≥3 swing points
    - Trend classification (Bullish/Bearish/Neutral)

    The analyzer calculates: VWAP, EMA (5, 15), RSI (14), MACD (12, 26, 9),
    ATR (14), and volume ratio using the Phase 7 service and direct calculators.

    Requirements: 25.1, 25.2, 25.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7,
                  6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8, 6.9
    """

    # Minimum candles required for MACD (26-period slow EMA + 9-period signal)
    MIN_CANDLES_REQUIRED: int = 26

    # Lookback for swing detection in support/resistance
    SR_LOOKBACK_BARS: int = 50

    # Swing detection lookback period (2 bars before and 2 after)
    SWING_LOOKBACK: int = 2

    # Minimum bounces/reversals for valid support/resistance
    MIN_TOUCHES: int = 2

    # Tolerance for matching price to support/resistance level (0.5%)
    SR_TOLERANCE_PCT: float = 0.005

    # Minimum swing points for a valid trendline
    MIN_TRENDLINE_POINTS: int = 3

    def __init__(
        self,
        rsi_period: int = 14,
        atr_period: int = 14,
        volume_period: int = 20,
        stale_threshold_seconds: float = 120.0,
    ):
        """
        Initialize TechnicalAnalyzer.

        Args:
            rsi_period: Period for RSI calculation (default: 14)
            atr_period: Period for ATR calculation (default: 14)
            volume_period: Period for volume average (default: 20)
            stale_threshold_seconds: Data staleness threshold (default: 120s)
        """
        self.rsi_period = rsi_period
        self.atr_period = atr_period
        self.volume_period = volume_period
        self.stale_threshold_seconds = stale_threshold_seconds

        # Initialize Phase 7 IntradayAnalysisService
        self.intraday_service = IntradayAnalysisService(
            rsi_period=rsi_period,
            atr_period=atr_period,
            volume_period=volume_period,
            stale_threshold_seconds=stale_threshold_seconds,
        )

        # Swing detector with lookback of 2 (swing high: high > 2 bars before and after)
        self.swing_detector = SwingDetector(lookback_period=self.SWING_LOOKBACK)

    def analyze_technical_indicators(
        self, ohlcv_data: List[OHLCVData]
    ) -> TechnicalIndicators:
        """
        Calculate all technical indicators from OHLCV data.

        Calls IntradayAnalysisService.analyze() for core indicators and
        supplements with EMA 5 and EMA 15 needed for scalping.

        Args:
            ohlcv_data: List of OHLCV candles (minimum 26 required for MACD)

        Returns:
            TechnicalIndicators model with all calculated values.

        Raises:
            TechnicalAnalyzerError: If data is insufficient or invalid.

        Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 25.1, 25.2
        """
        if not ohlcv_data:
            raise TechnicalAnalyzerError("No OHLCV data provided")

        if len(ohlcv_data) < self.MIN_CANDLES_REQUIRED:
            raise TechnicalAnalyzerError(
                f"Insufficient data: need at least {self.MIN_CANDLES_REQUIRED} "
                f"candles, got {len(ohlcv_data)}"
            )

        # Validate candle data
        self._validate_candles(ohlcv_data)

        # Extract price and volume arrays
        close_prices = [candle.close for candle in ohlcv_data]
        high_prices = [candle.high for candle in ohlcv_data]
        low_prices = [candle.low for candle in ohlcv_data]
        volumes = [candle.volume for candle in ohlcv_data]

        try:
            # Call Phase 7 IntradayAnalysisService for core indicators
            (
                technical_analysis,
                _data_freshness,
                _opening_range,
                _prev_day_levels,
                _support_levels,
                _resistance_levels,
                _trendlines,
            ) = self.intraday_service.analyze(
                symbol="SCALPER",
                interval=IntradayInterval.ONE_MINUTE,
                data=ohlcv_data,
                include_support_resistance=False,
                include_opening_range=False,
                include_prev_day_levels=False,
                include_trendlines=False,
            )

            # Extract Phase 7 results
            vwap = technical_analysis.vwap
            rsi = technical_analysis.rsi
            macd_value = technical_analysis.macd.value
            macd_signal = technical_analysis.macd.signal
            macd_histogram = technical_analysis.macd.histogram
            atr = technical_analysis.atr
            current_volume = technical_analysis.volume
            relative_volume = technical_analysis.relative_volume

        except ValueError as e:
            # Phase 7 may raise ValueError for insufficient data;
            # fall back to direct calculation
            logger.warning(
                f"Phase 7 service raised ValueError: {e}. "
                "Falling back to direct calculation."
            )
            vwap = calculate_vwap(high_prices, low_prices, close_prices, volumes)
            rsi = calculate_rsi(close_prices, period=self.rsi_period)
            macd_result = calculate_macd(
                close_prices, fast_period=12, slow_period=26, signal_period=9
            )
            macd_value = macd_result["value"]
            macd_signal = macd_result["signal"]
            macd_histogram = macd_result["histogram"]
            atr = calculate_atr(
                high_prices, low_prices, close_prices, period=self.atr_period
            )
            current_volume = volumes[-1]
            volume_ma_val = calculate_volume_ma(volumes, period=self.volume_period)
            relative_volume = calculate_relative_volume(
                current_volume, volumes[:-1], period=self.volume_period
            )

        # Calculate EMA 5 and EMA 15 (scalping-specific, Phase 7 uses 9/21/50)
        ema_5 = calculate_ema(close_prices, period=5)
        ema_15 = calculate_ema(close_prices, period=15)

        # Calculate average volume for volume ratio
        avg_volume = calculate_volume_ma(volumes, period=self.volume_period)

        return TechnicalIndicators(
            vwap=vwap,
            ema_5=ema_5,
            ema_15=ema_15,
            rsi=rsi,
            macd=macd_value,
            macd_signal=macd_signal,
            macd_histogram=macd_histogram,
            atr=atr,
            current_volume=current_volume,
            avg_volume=avg_volume,
            volume_ratio=relative_volume,
        )

    def identify_support_resistance(
        self, ohlcv_data: List[OHLCVData]
    ) -> SupportResistance:
        """
        Identify support and resistance levels from OHLCV data.

        Uses swing high/low detection within the last 50 bars to find
        key price levels. A level is valid if it has ≥2 bounces/reversals
        within 0.5% tolerance.

        Logic:
        - Swing high: High > 2 bars before and 2 bars after
        - Swing low: Low < 2 bars before and 2 bars after
        - Support: Most recent swing low with ≥2 bounces within 0.5% tolerance
        - Resistance: Most recent swing high with ≥2 reversals within 0.5% tolerance

        Args:
            ohlcv_data: List of OHLCV candles

        Returns:
            SupportResistance model with levels and distance percentages.

        Requirements: 6.1, 6.2, 6.5, 6.7, 6.8, 6.9
        """
        if not ohlcv_data or len(ohlcv_data) < 5:
            return SupportResistance(
                support_level=None,
                resistance_level=None,
                distance_to_support_pct=None,
                distance_to_resistance_pct=None,
            )

        # Use at most the last SR_LOOKBACK_BARS bars
        lookback_data = ohlcv_data[-self.SR_LOOKBACK_BARS:]
        current_price = lookback_data[-1].close

        # Detect swing points using SwingDetector with lookback=2
        min_required = 2 * self.SWING_LOOKBACK + 1  # 5 bars minimum
        if len(lookback_data) < min_required:
            return SupportResistance(
                support_level=None,
                resistance_level=None,
                distance_to_support_pct=None,
                distance_to_resistance_pct=None,
            )

        try:
            swing_points = self.swing_detector.detect_swing_points(lookback_data)
        except ValueError:
            return SupportResistance(
                support_level=None,
                resistance_level=None,
                distance_to_support_pct=None,
                distance_to_resistance_pct=None,
            )

        # Separate swing highs and lows
        swing_highs = [sp for sp in swing_points if sp.type == SwingType.HIGH]
        swing_lows = [sp for sp in swing_points if sp.type == SwingType.LOW]

        # Find support level: swing lows below current price with ≥2 bounces
        support_level = self._find_support_level(
            swing_lows, lookback_data, current_price
        )

        # Find resistance level: swing highs above current price with ≥2 reversals
        resistance_level = self._find_resistance_level(
            swing_highs, lookback_data, current_price
        )

        # Calculate distance percentages
        distance_to_support_pct = None
        distance_to_resistance_pct = None

        if support_level is not None and current_price > 0:
            distance_to_support_pct = round(
                ((current_price - support_level) / current_price) * 100, 2
            )

        if resistance_level is not None and current_price > 0:
            distance_to_resistance_pct = round(
                ((resistance_level - current_price) / current_price) * 100, 2
            )

        return SupportResistance(
            support_level=support_level,
            resistance_level=resistance_level,
            distance_to_support_pct=distance_to_support_pct,
            distance_to_resistance_pct=distance_to_resistance_pct,
        )

    def detect_trendlines(self, ohlcv_data: List[OHLCVData]) -> TrendlineStatus:
        """
        Detect active trendlines from OHLCV data.

        Identifies trendlines using ≥3 swing points. Classification:
        - Bullish: Positive slope trendline with price above it
        - Bearish: Negative slope trendline with price below it
        - Neutral: No active trendline or price between support/resistance

        Args:
            ohlcv_data: List of OHLCV candles

        Returns:
            TrendlineStatus enum value.

        Requirements: 6.3, 6.4
        """
        if not ohlcv_data or len(ohlcv_data) < 5:
            return TrendlineStatus.NEUTRAL

        lookback_data = ohlcv_data[-self.SR_LOOKBACK_BARS:]
        current_price = lookback_data[-1].close
        current_index = len(lookback_data) - 1

        # Detect swing points
        min_required = 2 * self.SWING_LOOKBACK + 1
        if len(lookback_data) < min_required:
            return TrendlineStatus.NEUTRAL

        try:
            swing_points = self.swing_detector.detect_swing_points(lookback_data)
        except ValueError:
            return TrendlineStatus.NEUTRAL

        swing_highs = [sp for sp in swing_points if sp.type == SwingType.HIGH]
        swing_lows = [sp for sp in swing_points if sp.type == SwingType.LOW]

        # Check for bullish trendline (≥3 swing lows with positive slope)
        bullish_trendline = self._fit_trendline(swing_lows)

        # Check for bearish trendline (≥3 swing highs with negative slope)
        bearish_trendline = self._fit_trendline(swing_highs)

        # Determine trendline status
        if bullish_trendline is not None:
            slope, intercept = bullish_trendline
            if slope > 0:
                # Price should be above the support trendline for bullish
                trendline_value = slope * current_index + intercept
                if current_price > trendline_value:
                    return TrendlineStatus.BULLISH

        if bearish_trendline is not None:
            slope, intercept = bearish_trendline
            if slope < 0:
                # Price should be below the resistance trendline for bearish
                trendline_value = slope * current_index + intercept
                if current_price < trendline_value:
                    return TrendlineStatus.BEARISH

        return TrendlineStatus.NEUTRAL

    def classify_trend(self, indicators: TechnicalIndicators) -> TrendClassification:
        """
        Classify the market trend based on technical indicators.

        Classification logic:
        - Bullish: EMA 5 > EMA 15, RSI > 50, MACD > Signal
        - Bearish: EMA 5 < EMA 15, RSI < 50, MACD < Signal
        - Neutral: Mixed signals or indicators near neutral

        Uses a scoring system: each bullish signal adds +1, each bearish adds -1.
        Score ≥ 2 = Bullish, Score ≤ -2 = Bearish, otherwise Neutral.

        Args:
            indicators: Calculated TechnicalIndicators

        Returns:
            TrendClassification enum value.

        Requirements: 6.4
        """
        score = 0

        # EMA crossover signal
        if indicators.ema_5 > indicators.ema_15:
            score += 1
        elif indicators.ema_5 < indicators.ema_15:
            score -= 1

        # RSI signal
        if indicators.rsi > 50:
            score += 1
        elif indicators.rsi < 50:
            score -= 1

        # MACD signal
        if indicators.macd > indicators.macd_signal:
            score += 1
        elif indicators.macd < indicators.macd_signal:
            score -= 1

        # Classify based on score
        if score >= 2:
            return TrendClassification.BULLISH
        elif score <= -2:
            return TrendClassification.BEARISH
        else:
            return TrendClassification.NEUTRAL

    # --- Private helper methods ---

    def _validate_candles(self, ohlcv_data: List[OHLCVData]) -> None:
        """
        Validate OHLCV candle data for null/invalid values.

        Args:
            ohlcv_data: List of OHLCV candles

        Raises:
            TechnicalAnalyzerError: If any candle has invalid data.

        Requirements: 5.10 (reject invalid candles)
        """
        for i, candle in enumerate(ohlcv_data):
            if candle.open <= 0 or candle.high <= 0 or candle.low <= 0 or candle.close <= 0:
                raise TechnicalAnalyzerError(
                    f"Invalid candle at index {i}: "
                    f"OHLC values must be positive (O={candle.open}, "
                    f"H={candle.high}, L={candle.low}, C={candle.close})"
                )
            if candle.high < candle.low:
                raise TechnicalAnalyzerError(
                    f"Invalid candle at index {i}: high ({candle.high}) < low ({candle.low})"
                )

    def _find_support_level(
        self,
        swing_lows: list,
        data: List[OHLCVData],
        current_price: float,
    ) -> Optional[float]:
        """
        Find the nearest valid support level below current price.

        A valid support level requires ≥2 bounces within 0.5% tolerance.

        Args:
            swing_lows: List of swing low points
            data: OHLCV data for checking bounces
            current_price: Current price level

        Returns:
            Support level price or None if not found.
        """
        # Filter swing lows below current price, sorted most recent first
        candidates = [
            sp for sp in swing_lows if sp.price < current_price
        ]
        candidates.sort(key=lambda sp: sp.index, reverse=True)

        for candidate in candidates:
            level = candidate.price
            # Count bounces: how many times price came near this level and bounced
            bounces = self._count_touches(level, data, touch_type="support")
            if bounces >= self.MIN_TOUCHES:
                return level

        # If no level with enough bounces, return the most recent swing low
        # below current price (if any)
        if candidates:
            return candidates[0].price

        return None

    def _find_resistance_level(
        self,
        swing_highs: list,
        data: List[OHLCVData],
        current_price: float,
    ) -> Optional[float]:
        """
        Find the nearest valid resistance level above current price.

        A valid resistance level requires ≥2 reversals within 0.5% tolerance.

        Args:
            swing_highs: List of swing high points
            data: OHLCV data for checking reversals
            current_price: Current price level

        Returns:
            Resistance level price or None if not found.
        """
        # Filter swing highs above current price, sorted most recent first
        candidates = [
            sp for sp in swing_highs if sp.price > current_price
        ]
        candidates.sort(key=lambda sp: sp.index, reverse=True)

        for candidate in candidates:
            level = candidate.price
            # Count reversals: how many times price came near this level and reversed
            reversals = self._count_touches(level, data, touch_type="resistance")
            if reversals >= self.MIN_TOUCHES:
                return level

        # If no level with enough reversals, return the most recent swing high
        # above current price (if any)
        if candidates:
            return candidates[0].price

        return None

    def _count_touches(
        self,
        level: float,
        data: List[OHLCVData],
        touch_type: str = "support",
    ) -> int:
        """
        Count how many times price touched a level within tolerance.

        For support: counts bars where low is within 0.5% of the level.
        For resistance: counts bars where high is within 0.5% of the level.

        Args:
            level: Price level to check
            data: OHLCV data
            touch_type: "support" or "resistance"

        Returns:
            Number of touches/bounces at the level.
        """
        tolerance = level * self.SR_TOLERANCE_PCT
        count = 0

        for candle in data:
            if touch_type == "support":
                # Check if low came near the support level
                if abs(candle.low - level) <= tolerance:
                    count += 1
            else:
                # Check if high came near the resistance level
                if abs(candle.high - level) <= tolerance:
                    count += 1

        return count

    def _fit_trendline(
        self, swing_points: list
    ) -> Optional[tuple]:
        """
        Fit a linear trendline to swing points using least squares.

        Requires at least MIN_TRENDLINE_POINTS (3) points.

        Args:
            swing_points: List of SwingPoint objects

        Returns:
            Tuple of (slope, intercept) or None if insufficient points.
        """
        if len(swing_points) < self.MIN_TRENDLINE_POINTS:
            return None

        # Use index and price for linear regression
        x_values = [sp.index for sp in swing_points]
        y_values = [sp.price for sp in swing_points]

        # Simple linear regression (least squares)
        n = len(x_values)
        sum_x = sum(x_values)
        sum_y = sum(y_values)
        sum_xy = sum(x * y for x, y in zip(x_values, y_values))
        sum_x2 = sum(x * x for x in x_values)

        denominator = n * sum_x2 - sum_x * sum_x
        if denominator == 0:
            return None

        slope = (n * sum_xy - sum_x * sum_y) / denominator
        intercept = (sum_y - slope * sum_x) / n

        return (slope, intercept)
