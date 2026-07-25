"""Unit tests for price action analysis."""

import pytest
from calculators.price_action import (
    PriceActionAnalyzer,
    analyze_price_action,
    TrendPattern,
    CandlestickPattern,
    PriceActionResult,
)


class TestPriceActionAnalyzer:
    """Test suite for PriceActionAnalyzer."""

    def test_init_valid_parameters(self):
        """Test initialization with valid parameters."""
        analyzer = PriceActionAnalyzer(lookback_period=3, momentum_period=10)
        assert analyzer.lookback_period == 3
        assert analyzer.momentum_period == 10

    def test_init_invalid_lookback(self):
        """Test initialization with invalid lookback period."""
        with pytest.raises(ValueError, match="lookback_period must be at least 1"):
            PriceActionAnalyzer(lookback_period=0)

    def test_init_invalid_momentum_period(self):
        """Test initialization with invalid momentum period."""
        with pytest.raises(ValueError, match="momentum_period must be at least 1"):
            PriceActionAnalyzer(lookback_period=3, momentum_period=0)

    def test_analyze_empty_data(self):
        """Test analysis with empty data."""
        analyzer = PriceActionAnalyzer()

        with pytest.raises(ValueError, match="Price data cannot be empty"):
            analyzer.analyze([], [], [], [])

    def test_analyze_mismatched_lengths(self):
        """Test analysis with mismatched data lengths."""
        analyzer = PriceActionAnalyzer()

        highs = [100, 105]
        lows = [95, 100]
        opens = [98]  # Mismatched
        closes = [103, 102]

        with pytest.raises(
            ValueError, match="All price lists must have the same length"
        ):
            analyzer.analyze(highs, lows, opens, closes)

    def test_analyze_insufficient_data(self):
        """Test analysis with insufficient data."""
        analyzer = PriceActionAnalyzer(lookback_period=3, momentum_period=10)

        # Need at least max(3*2+1, 10+1) = 11 candles
        highs = [100, 105, 103]
        lows = [98, 102, 100]
        opens = [99, 103, 102]
        closes = [104, 102, 101]

        with pytest.raises(ValueError, match="Insufficient data"):
            analyzer.analyze(highs, lows, opens, closes)

    def test_analyze_uptrend_pattern(self):
        """Test detection of uptrend pattern (higher highs and higher lows)."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Create clear uptrend with distinct peaks and valleys
        # Swing highs at indices: 1, 4, 7, 10, 13 (values: 103, 107, 111, 115, 119)
        # Swing lows at indices: 2, 5, 8, 11 (values: 97, 100, 104, 108)
        highs = [
            100,
            103,
            101,
            99,
            107,
            105,
            103,
            111,
            109,
            107,
            115,
            113,
            111,
            119,
            117,
        ]
        lows = [98, 101, 97, 95, 104, 100, 98, 108, 104, 102, 112, 108, 106, 116, 112]
        opens = [99, 102, 99, 96, 106, 102, 100, 110, 106, 104, 114, 110, 108, 118, 114]
        closes = [
            102,
            101,
            98,
            106,
            104,
            101,
            110,
            108,
            105,
            114,
            112,
            109,
            118,
            116,
            113,
        ]

        result = analyzer.analyze(highs, lows, opens, closes)

        assert result.trend_pattern == TrendPattern.UPTREND
        assert result.higher_highs is True
        assert result.higher_lows is True
        assert result.trend_confidence > 60.0

    def test_analyze_downtrend_pattern(self):
        """Test detection of downtrend pattern (lower highs and lower lows)."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Create clear downtrend - inverted from uptrend pattern
        # Swing highs at indices: 3, 6, 9, 12 (values: 125, 122, 118, 114) - declining
        # Swing lows at indices: 4, 7, 10 (values: 113, 109, 105) - declining
        highs = [
            122,
            119,
            123,
            125,
            116,
            120,
            122,
            112,
            116,
            118,
            108,
            112,
            114,
            104,
            108,
        ]
        lows = [
            120,
            117,
            119,
            121,
            113,
            115,
            117,
            109,
            111,
            113,
            105,
            107,
            109,
            101,
            103,
        ]
        opens = [
            121,
            118,
            121,
            124,
            114,
            118,
            120,
            110,
            114,
            116,
            106,
            110,
            112,
            102,
            106,
        ]
        closes = [
            118,
            119,
            122,
            114,
            116,
            119,
            110,
            112,
            115,
            106,
            108,
            111,
            102,
            104,
            107,
        ]

        result = analyzer.analyze(highs, lows, opens, closes)

        assert result.trend_pattern == TrendPattern.DOWNTREND
        assert result.lower_highs is True
        assert result.lower_lows is True
        assert result.trend_confidence > 60.0

    def test_analyze_sideways_pattern(self):
        """Test detection of sideways pattern (no clear trend)."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Create sideways: prices oscillate without clear direction
        highs = [102, 101, 103, 102, 101, 103, 102, 101, 103, 102, 101, 103]
        lows = [98, 99, 97, 98, 99, 97, 98, 99, 97, 98, 99, 97]
        opens = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
        closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]

        result = analyzer.analyze(highs, lows, opens, closes)

        assert result.trend_pattern == TrendPattern.SIDEWAYS

    def test_analyze_momentum_positive(self):
        """Test momentum calculation for rising prices."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Prices rising from 100 to 110 over period
        closes = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122]
        highs = [c + 2 for c in closes]
        lows = [c - 2 for c in closes]
        opens = closes[:]

        result = analyzer.analyze(highs, lows, opens, closes)

        # Momentum over 5 periods: (122 - 116) / 116 * 100 ≈ 5.17%
        assert result.momentum > 0
        assert result.momentum_period == 5

    def test_analyze_momentum_negative(self):
        """Test momentum calculation for falling prices."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Prices falling from 120 to 100
        closes = [120, 118, 116, 114, 112, 110, 108, 106, 104, 102, 100, 98]
        highs = [c + 2 for c in closes]
        lows = [c - 2 for c in closes]
        opens = closes[:]

        result = analyzer.analyze(highs, lows, opens, closes)

        # Momentum should be negative
        assert result.momentum < 0

    def test_detect_bullish_engulfing(self):
        """Test detection of bullish engulfing pattern."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Setup: previous bearish candle, current bullish engulfing
        # Need 12 candles minimum
        highs = [100] * 10 + [100, 103]  # Last 2 candles
        lows = [98] * 10 + [96, 95]
        opens = [99] * 10 + [100, 96]  # Prev: open 100, close 97 (bearish)
        closes = [99] * 10 + [97, 102]  # Curr: open 96, close 102 (bullish, engulfs)

        result = analyzer.analyze(highs, lows, opens, closes)

        assert CandlestickPattern.BULLISH_ENGULFING in result.candlestick_patterns

    def test_detect_bearish_engulfing(self):
        """Test detection of bearish engulfing pattern."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Setup: previous bullish candle, current bearish engulfing
        highs = [100] * 10 + [102, 104]
        lows = [98] * 10 + [99, 96]
        opens = [99] * 10 + [99, 103]  # Prev: open low, Curr: open high
        closes = [99] * 10 + [102, 97]  # Prev: close high, Curr: close low (engulfs)

        result = analyzer.analyze(highs, lows, opens, closes)

        assert CandlestickPattern.BEARISH_ENGULFING in result.candlestick_patterns

    def test_detect_hammer(self):
        """Test detection of hammer pattern."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Hammer: small body at top, long lower shadow
        highs = [100] * 11 + [101]
        lows = [98] * 11 + [90]  # Long lower shadow
        opens = [99] * 11 + [100]
        closes = [99] * 11 + [99]  # Small body at top

        result = analyzer.analyze(highs, lows, opens, closes)

        assert CandlestickPattern.HAMMER in result.candlestick_patterns

    def test_detect_inverted_hammer(self):
        """Test detection of inverted hammer pattern."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Inverted hammer: small body at bottom, long upper shadow
        highs = [100] * 11 + [110]  # Long upper shadow
        lows = [98] * 11 + [99]
        opens = [99] * 11 + [100]
        closes = [99] * 11 + [101]  # Small body at bottom

        result = analyzer.analyze(highs, lows, opens, closes)

        assert CandlestickPattern.INVERTED_HAMMER in result.candlestick_patterns

    def test_detect_doji(self):
        """Test detection of doji pattern."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Doji: open and close are very close
        highs = [100] * 11 + [102]
        lows = [98] * 11 + [98]
        opens = [99] * 11 + [100.00]
        closes = [99] * 11 + [100.01]  # Very close to open

        result = analyzer.analyze(highs, lows, opens, closes)

        assert CandlestickPattern.DOJI in result.candlestick_patterns

    def test_result_model_validation(self):
        """Test that PriceActionResult model validates correctly."""
        result = PriceActionResult(
            trend_pattern=TrendPattern.UPTREND,
            higher_highs=True,
            higher_lows=True,
            lower_highs=False,
            lower_lows=False,
            trend_confidence=85.5,
            candlestick_patterns=[CandlestickPattern.HAMMER],
            momentum=12.5,
            momentum_period=10,
        )

        assert result.trend_pattern == TrendPattern.UPTREND
        assert result.trend_confidence == 85.5
        assert result.momentum == 12.5

    def test_result_model_confidence_bounds(self):
        """Test that confidence is bounded between 0 and 100."""
        # Valid confidence
        result = PriceActionResult(
            trend_pattern=TrendPattern.UPTREND,
            higher_highs=True,
            higher_lows=True,
            lower_highs=False,
            lower_lows=False,
            trend_confidence=50.0,
            candlestick_patterns=[],
            momentum=0.0,
            momentum_period=10,
        )
        assert 0 <= result.trend_confidence <= 100

        # Invalid confidence (too high)
        with pytest.raises(ValueError):
            PriceActionResult(
                trend_pattern=TrendPattern.UPTREND,
                higher_highs=True,
                higher_lows=True,
                lower_highs=False,
                lower_lows=False,
                trend_confidence=150.0,  # Invalid
                candlestick_patterns=[],
                momentum=0.0,
                momentum_period=10,
            )

        # Invalid confidence (negative)
        with pytest.raises(ValueError):
            PriceActionResult(
                trend_pattern=TrendPattern.UPTREND,
                higher_highs=True,
                higher_lows=True,
                lower_highs=False,
                lower_lows=False,
                trend_confidence=-10.0,  # Invalid
                candlestick_patterns=[],
                momentum=0.0,
                momentum_period=10,
            )


class TestConvenienceFunction:
    """Test suite for convenience function."""

    def test_analyze_price_action_uptrend(self):
        """Test convenience function with uptrend data."""
        highs = [
            100,
            103,
            101,
            99,
            107,
            105,
            103,
            111,
            109,
            107,
            115,
            113,
            111,
            119,
            117,
        ]
        lows = [98, 101, 97, 95, 104, 100, 98, 108, 104, 102, 112, 108, 106, 116, 112]
        opens = [99, 102, 99, 96, 106, 102, 100, 110, 106, 104, 114, 110, 108, 118, 114]
        closes = [
            102,
            101,
            98,
            106,
            104,
            101,
            110,
            108,
            105,
            114,
            112,
            109,
            116,
            118,
            120,
        ]  # Rising closes

        result = analyze_price_action(
            highs, lows, opens, closes, lookback_period=2, momentum_period=5
        )

        assert isinstance(result, PriceActionResult)
        assert result.trend_pattern == TrendPattern.UPTREND
        assert result.momentum > 0

    def test_analyze_price_action_custom_periods(self):
        """Test convenience function with custom periods."""
        # Need enough data for lookback=5, momentum=15
        size = 30
        highs = [100 + i for i in range(size)]
        lows = [98 + i for i in range(size)]
        opens = [99 + i for i in range(size)]
        closes = [100 + i for i in range(size)]

        result = analyze_price_action(
            highs, lows, opens, closes, lookback_period=5, momentum_period=15
        )

        assert isinstance(result, PriceActionResult)
        assert result.momentum_period == 15


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_identical_prices(self):
        """Test with all prices the same (no movement)."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # All prices identical
        size = 15
        price = 100.0
        highs = [price] * size
        lows = [price] * size
        opens = [price] * size
        closes = [price] * size

        result = analyzer.analyze(highs, lows, opens, closes)

        # Should detect UNKNOWN or SIDEWAYS, momentum should be 0
        assert result.trend_pattern in [TrendPattern.UNKNOWN, TrendPattern.SIDEWAYS]
        assert result.momentum == 0.0

    def test_minimal_data_for_analysis(self):
        """Test with minimum required data."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Minimum: max(2*2+1, 5+1) = 6 candles
        # But we need more for swing point detection, use 11
        size = 11
        highs = [100 + i for i in range(size)]
        lows = [98 + i for i in range(size)]
        opens = [99 + i for i in range(size)]
        closes = [100 + i for i in range(size)]

        result = analyzer.analyze(highs, lows, opens, closes)

        assert isinstance(result, PriceActionResult)
        assert result.momentum_period == 5

    def test_volatile_sideways_market(self):
        """Test with volatile but sideways market."""
        analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

        # Volatile oscillations around same level
        highs = [105, 104, 106, 105, 104, 106, 105, 104, 106, 105, 104, 106]
        lows = [95, 96, 94, 95, 96, 94, 95, 96, 94, 95, 96, 94]
        opens = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
        closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]

        result = analyzer.analyze(highs, lows, opens, closes)

        # Should detect sideways or unknown
        assert result.trend_pattern in [TrendPattern.SIDEWAYS, TrendPattern.UNKNOWN]
        # Momentum should be close to 0
        assert abs(result.momentum) < 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
