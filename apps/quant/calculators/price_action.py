"""
Price action analysis calculator.

This module provides comprehensive price action analysis including:
- Trend pattern detection (higher highs/lows, lower highs/lows)
- Candlestick pattern recognition (engulfing, hammer, doji)
- Momentum indicators (rate of change)

These analyses help identify price behavior and potential trading opportunities.
"""

from typing import List, Dict, Optional
from models import TrendPattern, CandlestickPattern, PriceActionResult


class PriceActionAnalyzer:
    """Price action analysis calculator."""

    def __init__(self, lookback_period: int = 3, momentum_period: int = 10):
        """
        Initialize price action analyzer.

        Args:
            lookback_period: Number of candles to look back for swing points
            momentum_period: Period for momentum calculation
        """
        if lookback_period < 1:
            raise ValueError("lookback_period must be at least 1")
        if momentum_period < 1:
            raise ValueError("momentum_period must be at least 1")

        self.lookback_period = lookback_period
        self.momentum_period = momentum_period

    def analyze(
        self,
        highs: List[float],
        lows: List[float],
        opens: List[float],
        closes: List[float],
        volumes: Optional[List[float]] = None,
    ) -> PriceActionResult:
        """
        Perform comprehensive price action analysis.

        Args:
            highs: List of high prices
            lows: List of low prices
            opens: List of open prices
            closes: List of close prices
            volumes: Optional list of volumes

        Returns:
            PriceActionResult with all analysis components

        Raises:
            ValueError: If data is invalid or insufficient
        """
        # Validate inputs
        if not highs or not lows or not opens or not closes:
            raise ValueError("Price data cannot be empty")

        if not (len(highs) == len(lows) == len(opens) == len(closes)):
            raise ValueError("All price lists must have the same length")

        min_required = max(self.lookback_period * 2 + 1, self.momentum_period + 1)
        if len(highs) < min_required:
            raise ValueError(
                f"Insufficient data: need at least {min_required} candles, got {len(highs)}"
            )

        # Analyze trend patterns
        trend_result = self._analyze_trend_pattern(highs, lows)

        # Detect candlestick patterns (last few candles)
        candlestick_patterns = self._detect_candlestick_patterns(
            highs[-5:], lows[-5:], opens[-5:], closes[-5:]
        )

        # Calculate momentum
        momentum = self._calculate_momentum(closes)

        return PriceActionResult(
            trend_pattern=trend_result["trend_pattern"],
            higher_highs=trend_result["higher_highs"],
            higher_lows=trend_result["higher_lows"],
            lower_highs=trend_result["lower_highs"],
            lower_lows=trend_result["lower_lows"],
            trend_confidence=trend_result["confidence"],
            candlestick_patterns=candlestick_patterns,
            momentum=momentum,
            momentum_period=self.momentum_period,
        )

    def _analyze_trend_pattern(self, highs: List[float], lows: List[float]) -> Dict:
        """
        Analyze price trend patterns (higher/lower highs and lows).

        Returns:
            Dict with trend analysis results
        """
        # Find swing points
        swing_highs = self._find_swing_highs(highs)
        swing_lows = self._find_swing_lows(lows)

        # Insufficient swing points
        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return {
                "trend_pattern": TrendPattern.UNKNOWN,
                "higher_highs": False,
                "higher_lows": False,
                "lower_highs": False,
                "lower_lows": False,
                "confidence": 0.0,
            }

        # Analyze higher/lower highs
        higher_highs_count = sum(
            1
            for i in range(1, len(swing_highs))
            if swing_highs[i]["price"] > swing_highs[i - 1]["price"]
        )
        lower_highs_count = sum(
            1
            for i in range(1, len(swing_highs))
            if swing_highs[i]["price"] < swing_highs[i - 1]["price"]
        )

        # Analyze higher/lower lows
        higher_lows_count = sum(
            1
            for i in range(1, len(swing_lows))
            if swing_lows[i]["price"] > swing_lows[i - 1]["price"]
        )
        lower_lows_count = sum(
            1
            for i in range(1, len(swing_lows))
            if swing_lows[i]["price"] < swing_lows[i - 1]["price"]
        )

        total_high_comparisons = len(swing_highs) - 1
        total_low_comparisons = len(swing_lows) - 1

        # Calculate ratios
        higher_highs_ratio = (
            higher_highs_count / total_high_comparisons
            if total_high_comparisons > 0
            else 0
        )
        higher_lows_ratio = (
            higher_lows_count / total_low_comparisons
            if total_low_comparisons > 0
            else 0
        )
        lower_highs_ratio = (
            lower_highs_count / total_high_comparisons
            if total_high_comparisons > 0
            else 0
        )
        lower_lows_ratio = (
            lower_lows_count / total_low_comparisons if total_low_comparisons > 0 else 0
        )

        # Determine trend pattern and confidence
        threshold = 0.6  # 60% of swings must follow the pattern

        is_higher_highs = higher_highs_ratio >= threshold
        is_higher_lows = higher_lows_ratio >= threshold
        is_lower_highs = lower_highs_ratio >= threshold
        is_lower_lows = lower_lows_ratio >= threshold

        # Classify trend
        if is_higher_highs and is_higher_lows:
            trend_pattern = TrendPattern.UPTREND
            confidence = (higher_highs_ratio * 50) + (higher_lows_ratio * 50)
        elif is_lower_highs and is_lower_lows:
            trend_pattern = TrendPattern.DOWNTREND
            confidence = (lower_highs_ratio * 50) + (lower_lows_ratio * 50)
        else:
            trend_pattern = TrendPattern.SIDEWAYS
            # Lower confidence for sideways
            confidence = 50.0 - abs((higher_highs_ratio - lower_highs_ratio) * 25)

        return {
            "trend_pattern": trend_pattern,
            "higher_highs": is_higher_highs,
            "higher_lows": is_higher_lows,
            "lower_highs": is_lower_highs,
            "lower_lows": is_lower_lows,
            "confidence": max(0.0, min(100.0, confidence)),
        }

    def _find_swing_highs(self, highs: List[float]) -> List[Dict]:
        """Find swing high points in price data."""
        swing_highs = []

        for i in range(self.lookback_period, len(highs) - self.lookback_period):
            current_high = highs[i]

            # Check if current is higher than all neighbors
            is_swing_high = all(
                current_high > highs[j]
                for j in range(i - self.lookback_period, i + self.lookback_period + 1)
                if j != i
            )

            if is_swing_high:
                swing_highs.append({"index": i, "price": current_high})

        return swing_highs

    def _find_swing_lows(self, lows: List[float]) -> List[Dict]:
        """Find swing low points in price data."""
        swing_lows = []

        for i in range(self.lookback_period, len(lows) - self.lookback_period):
            current_low = lows[i]

            # Check if current is lower than all neighbors
            is_swing_low = all(
                current_low < lows[j]
                for j in range(i - self.lookback_period, i + self.lookback_period + 1)
                if j != i
            )

            if is_swing_low:
                swing_lows.append({"index": i, "price": current_low})

        return swing_lows

    def _detect_candlestick_patterns(
        self,
        highs: List[float],
        lows: List[float],
        opens: List[float],
        closes: List[float],
    ) -> List[CandlestickPattern]:
        """
        Detect candlestick patterns in recent price data.

        Detects: engulfing (bullish/bearish), hammer, inverted hammer, doji.
        """
        patterns = []

        if len(highs) < 2:
            return patterns

        # Check last 2 candles for engulfing patterns
        if len(highs) >= 2:
            engulfing = self._detect_engulfing(
                highs[-2:], lows[-2:], opens[-2:], closes[-2:]
            )
            if engulfing != CandlestickPattern.NONE:
                patterns.append(engulfing)

        # Check last candle for single-candle patterns
        hammer = self._detect_hammer(highs[-1], lows[-1], opens[-1], closes[-1])
        if hammer != CandlestickPattern.NONE:
            patterns.append(hammer)

        doji = self._detect_doji(opens[-1], closes[-1])
        if doji:
            patterns.append(CandlestickPattern.DOJI)

        return patterns if patterns else [CandlestickPattern.NONE]

    def _detect_engulfing(
        self,
        highs: List[float],
        lows: List[float],
        opens: List[float],
        closes: List[float],
    ) -> CandlestickPattern:
        """Detect engulfing patterns (requires 2 candles)."""
        if len(highs) < 2:
            return CandlestickPattern.NONE

        # Previous candle
        prev_open, prev_close = opens[0], closes[0]
        prev_body = abs(prev_close - prev_open)
        prev_bullish = prev_close > prev_open

        # Current candle
        curr_open, curr_close = opens[1], closes[1]
        curr_body = abs(curr_close - curr_open)
        curr_bullish = curr_close > curr_open

        # Bullish engulfing: previous bearish, current bullish and engulfs
        if not prev_bullish and curr_bullish:
            if (
                curr_open < prev_close
                and curr_close > prev_open
                and curr_body > prev_body
            ):
                return CandlestickPattern.BULLISH_ENGULFING

        # Bearish engulfing: previous bullish, current bearish and engulfs
        if prev_bullish and not curr_bullish:
            if (
                curr_open > prev_close
                and curr_close < prev_open
                and curr_body > prev_body
            ):
                return CandlestickPattern.BEARISH_ENGULFING

        return CandlestickPattern.NONE

    def _detect_hammer(
        self, high: float, low: float, open_price: float, close: float
    ) -> CandlestickPattern:
        """
        Detect hammer and inverted hammer patterns.

        Hammer: Small body at top, long lower shadow
        Inverted Hammer: Small body at bottom, long upper shadow
        """
        body = abs(close - open_price)
        total_range = high - low

        if total_range == 0:
            return CandlestickPattern.NONE

        # Body should be small relative to range
        body_ratio = body / total_range
        if body_ratio > 0.3:  # Body too large
            return CandlestickPattern.NONE

        # Hammer: long lower shadow
        body_top = max(open_price, close)
        lower_shadow = body_top - low
        upper_shadow = high - body_top

        lower_shadow_ratio = lower_shadow / total_range
        upper_shadow_ratio = upper_shadow / total_range

        # Hammer: lower shadow at least 2x upper shadow
        if lower_shadow_ratio >= 0.6 and lower_shadow >= 2 * upper_shadow:
            return CandlestickPattern.HAMMER

        # Inverted hammer: upper shadow at least 2x lower shadow
        if upper_shadow_ratio >= 0.6 and upper_shadow >= 2 * lower_shadow:
            return CandlestickPattern.INVERTED_HAMMER

        return CandlestickPattern.NONE

    def _detect_doji(self, open_price: float, close: float) -> bool:
        """
        Detect doji pattern (open and close are very close).

        A doji indicates indecision in the market.
        """
        body = abs(close - open_price)
        average_price = (open_price + close) / 2

        # Body should be very small relative to price
        # Using 0.1% threshold
        threshold = average_price * 0.001

        return body <= threshold

    def _calculate_momentum(self, closes: List[float]) -> float:
        """
        Calculate momentum (rate of change) over the momentum period.

        Momentum = ((Current - Past) / Past) * 100
        """
        if len(closes) < self.momentum_period + 1:
            raise ValueError(
                f"Need at least {self.momentum_period + 1} closes for momentum"
            )

        current_price = closes[-1]
        past_price = closes[-(self.momentum_period + 1)]

        if past_price == 0:
            raise ValueError("Past price cannot be zero for momentum calculation")

        momentum = ((current_price - past_price) / past_price) * 100.0

        return float(momentum)


def analyze_price_action(
    highs: List[float],
    lows: List[float],
    opens: List[float],
    closes: List[float],
    volumes: Optional[List[float]] = None,
    lookback_period: int = 3,
    momentum_period: int = 10,
) -> PriceActionResult:
    """
    Convenience function for price action analysis.

    Args:
        highs: List of high prices
        lows: List of low prices
        opens: List of open prices
        closes: List of close prices
        volumes: Optional list of volumes
        lookback_period: Swing point lookback period (default 3)
        momentum_period: Momentum calculation period (default 10)

    Returns:
        PriceActionResult with comprehensive analysis

    Example:
        >>> highs = [100, 105, 103, 108, 106, 110, 109]
        >>> lows = [98, 102, 100, 105, 103, 107, 106]
        >>> opens = [99, 103, 102, 106, 104, 108, 107]
        >>> closes = [104, 102, 107, 105, 109, 108, 110]
        >>> result = analyze_price_action(highs, lows, opens, closes)
        >>> print(f"Trend: {result.trend_pattern}, Confidence: {result.trend_confidence:.1f}%")
    """
    analyzer = PriceActionAnalyzer(
        lookback_period=lookback_period, momentum_period=momentum_period
    )

    return analyzer.analyze(highs, lows, opens, closes, volumes)
