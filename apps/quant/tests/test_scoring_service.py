"""
Unit tests for ScoringService.

Tests the trend classification logic, scoring algorithm, and signal generation.
"""

import pytest
from models import IndicatorResult, MACDValues, BollingerBands, TrendEnum
from services.scoring_service import ScoringService


@pytest.fixture
def sample_indicators():
    """Create sample indicators for testing."""
    return IndicatorResult(
        rsi=65.0,
        macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
        sma_20=2455.0,
        sma_50=2450.0,
        sma_200=2380.0,
        ema_5=2462.5,
        ema_15=2460.0,
        ema_20=2458.0,
        ema_50=2452.0,
        ema_200=2385.0,
        bollinger_bands=BollingerBands(upper=2500.0, middle=2455.0, lower=2410.0),
        adx=28.5,
        atr=45.3,
        vwap=2461.0,
        volume_ma=950000.0,
        relative_volume=1.25,
        week_52_high=2650.0,
        week_52_low=2200.0,
        momentum=15.2,
    )


class TestTrendClassification:
    """Test cases for trend classification logic."""

    def test_bullish_trend(self, sample_indicators):
        """Test bullish trend classification."""
        # Price above all EMAs, RSI > 50, ADX > 20
        current_price = 2470.0
        trend = ScoringService.classify_trend(current_price, sample_indicators)
        assert trend == TrendEnum.BULLISH

    def test_bearish_trend(self):
        """Test bearish trend classification."""
        # Price below all EMAs, RSI < 50, ADX > 20
        current_price = 2350.0
        indicators = IndicatorResult(
            rsi=35.0,
            macd=MACDValues(value=-8.3, signal=-6.1, histogram=-2.2),
            sma_20=2455.0,
            sma_50=2450.0,
            sma_200=2380.0,
            ema_5=2362.5,
            ema_15=2360.0,
            ema_20=2358.0,
            ema_50=2352.0,
            ema_200=2385.0,
            bollinger_bands=BollingerBands(upper=2400.0, middle=2355.0, lower=2310.0),
            adx=25.0,
            atr=45.3,
            vwap=2361.0,
            volume_ma=950000.0,
            relative_volume=1.35,
            week_52_high=2650.0,
            week_52_low=2200.0,
            momentum=-12.5,
        )
        trend = ScoringService.classify_trend(current_price, indicators)
        assert trend == TrendEnum.BEARISH

    def test_neutral_trend_weak_adx(self, sample_indicators):
        """Test neutral trend due to weak ADX."""
        # Even with good price position, weak ADX makes it neutral
        current_price = 2470.0
        sample_indicators.adx = 15.0  # Weak trend
        trend = ScoringService.classify_trend(current_price, sample_indicators)
        assert trend == TrendEnum.NEUTRAL

    def test_neutral_trend_mixed_signals(self, sample_indicators):
        """Test neutral trend due to mixed signals."""
        # Price above EMAs but RSI < 50 creates mixed signals
        current_price = 2470.0
        sample_indicators.rsi = 45.0
        trend = ScoringService.classify_trend(current_price, sample_indicators)
        assert trend == TrendEnum.NEUTRAL

    def test_neutral_trend_price_between_emas(self, sample_indicators):
        """Test neutral trend when price is between EMAs."""
        # Price between EMAs creates neutral trend
        current_price = 2390.0  # Between ema_200 (2385) and ema_50 (2452)
        trend = ScoringService.classify_trend(current_price, sample_indicators)
        assert trend == TrendEnum.NEUTRAL


class TestScoreCalculation:
    """Test cases for score calculation logic."""

    def test_score_bounds(self, sample_indicators):
        """Test that score is always between 0 and 100."""
        for price in [2000.0, 2400.0, 2500.0, 2800.0]:
            for trend in [TrendEnum.BULLISH, TrendEnum.BEARISH, TrendEnum.NEUTRAL]:
                score = ScoringService.calculate_score(price, sample_indicators, trend)
                assert (
                    0.0 <= score <= 100.0
                ), f"Score {score} out of bounds for price {price}, trend {trend}"

    def test_bullish_score_higher_with_strong_indicators(self, sample_indicators):
        """Test that bullish score is higher with strong bullish indicators."""
        current_price = 2470.0

        # Calculate score with current (strong) indicators
        strong_score = ScoringService.calculate_score(
            current_price, sample_indicators, TrendEnum.BULLISH
        )

        # Weaken indicators
        weak_indicators = sample_indicators.model_copy()
        weak_indicators.rsi = 52.0  # Barely bullish
        weak_indicators.adx = 22.0  # Weak trend
        weak_indicators.relative_volume = 0.8  # Below average

        weak_score = ScoringService.calculate_score(
            current_price, weak_indicators, TrendEnum.BULLISH
        )

        assert strong_score > weak_score

    def test_bearish_score_calculation(self):
        """Test bearish score calculation."""
        current_price = 2350.0
        indicators = IndicatorResult(
            rsi=30.0,
            macd=MACDValues(value=-8.3, signal=-6.1, histogram=-2.2),
            sma_20=2455.0,
            sma_50=2450.0,
            sma_200=2380.0,
            ema_5=2362.5,
            ema_15=2360.0,
            ema_20=2358.0,
            ema_50=2352.0,
            ema_200=2385.0,
            bollinger_bands=BollingerBands(upper=2400.0, middle=2355.0, lower=2310.0),
            adx=30.0,
            atr=45.3,
            vwap=2365.0,
            volume_ma=950000.0,
            relative_volume=1.45,
            week_52_high=2650.0,
            week_52_low=2200.0,
            momentum=-15.2,
        )

        score = ScoringService.calculate_score(
            current_price, indicators, TrendEnum.BEARISH
        )
        # Bearish with strong indicators should give a reasonable score
        assert 0.0 <= score <= 100.0

    def test_neutral_score_is_valid(self, sample_indicators):
        """Test that neutral trend produces valid score."""
        current_price = 2461.0  # Equal to VWAP for truly neutral
        sample_indicators.rsi = 50.0  # Neutral RSI
        sample_indicators.adx = 18.0  # Weak trend
        sample_indicators.relative_volume = 1.0  # Average volume

        score = ScoringService.calculate_score(
            current_price, sample_indicators, TrendEnum.NEUTRAL
        )

        # Score should be valid (0-100) for neutral conditions
        # Note: Neutral doesn't necessarily mean score is exactly 50
        # The weighted formula considers all components
        assert 0.0 <= score <= 100.0


class TestSignalGeneration:
    """Test cases for signal generation logic."""

    def test_signals_not_empty(self, sample_indicators):
        """Test that signals list is not empty."""
        current_price = 2470.0
        signals = ScoringService.generate_signals(
            current_price, sample_indicators, TrendEnum.BULLISH
        )
        assert len(signals) > 0

    def test_bullish_signals(self, sample_indicators):
        """Test bullish signal generation."""
        current_price = 2470.0
        signals = ScoringService.generate_signals(
            current_price, sample_indicators, TrendEnum.BULLISH
        )

        # Check for trend strength signal
        trend_signals = [s for s in signals if "trend" in s.lower()]
        assert len(trend_signals) > 0

        # Check for RSI signal
        rsi_signals = [s for s in signals if "RSI" in s]
        assert len(rsi_signals) > 0

        # Check for volume signal
        volume_signals = [s for s in signals if "volume" in s.lower()]
        assert len(volume_signals) > 0

    def test_bearish_signals(self):
        """Test bearish signal generation."""
        current_price = 2350.0
        indicators = IndicatorResult(
            rsi=25.0,
            macd=MACDValues(value=-8.3, signal=-6.1, histogram=-2.2),
            sma_20=2455.0,
            sma_50=2450.0,
            sma_200=2380.0,
            ema_5=2362.5,
            ema_15=2360.0,
            ema_20=2358.0,
            ema_50=2352.0,
            ema_200=2385.0,
            bollinger_bands=BollingerBands(upper=2400.0, middle=2355.0, lower=2310.0),
            adx=28.0,
            atr=45.3,
            vwap=2365.0,
            volume_ma=950000.0,
            relative_volume=1.55,
            week_52_high=2650.0,
            week_52_low=2200.0,
            momentum=-18.2,
        )

        signals = ScoringService.generate_signals(
            current_price, indicators, TrendEnum.BEARISH
        )

        # Check for oversold RSI signal
        rsi_signals = [s for s in signals if "oversold" in s.lower()]
        assert len(rsi_signals) > 0

        # Check for downward trend signal
        trend_signals = [s for s in signals if "downward" in s.lower()]
        assert len(trend_signals) > 0

    def test_signal_formatting(self, sample_indicators):
        """Test that signals are properly formatted strings."""
        current_price = 2470.0
        signals = ScoringService.generate_signals(
            current_price, sample_indicators, TrendEnum.BULLISH
        )

        for signal in signals:
            assert isinstance(signal, str)
            assert len(signal) > 0


class TestScoreMarket:
    """Test cases for complete market scoring."""

    def test_score_market_returns_complete_result(self, sample_indicators):
        """Test that score_market returns a complete ScoreResult."""
        current_price = 2470.0
        result = ScoringService.score_market(current_price, sample_indicators)

        # Check all fields are present
        assert result.trend in [TrendEnum.BULLISH, TrendEnum.BEARISH, TrendEnum.NEUTRAL]
        assert 0.0 <= result.rsi <= 100.0
        assert 0.0 <= result.adx <= 100.0
        assert result.vwap > 0
        assert result.volumeRatio >= 0
        assert 0.0 <= result.score <= 100.0
        assert len(result.signals) > 0

    def test_score_market_bullish_scenario(self, sample_indicators):
        """Test complete bullish market scoring."""
        current_price = 2470.0
        result = ScoringService.score_market(current_price, sample_indicators)

        assert result.trend == TrendEnum.BULLISH
        assert result.score > 50.0  # Bullish should have higher score
        assert result.rsi == sample_indicators.rsi
        assert result.adx == sample_indicators.adx
        assert result.vwap == sample_indicators.vwap
        assert result.volumeRatio == sample_indicators.relative_volume

    def test_score_market_bearish_scenario(self):
        """Test complete bearish market scoring."""
        current_price = 2350.0
        indicators = IndicatorResult(
            rsi=32.0,
            macd=MACDValues(value=-8.3, signal=-6.1, histogram=-2.2),
            sma_20=2455.0,
            sma_50=2450.0,
            sma_200=2380.0,
            ema_5=2362.5,
            ema_15=2360.0,
            ema_20=2358.0,
            ema_50=2352.0,
            ema_200=2385.0,
            bollinger_bands=BollingerBands(upper=2400.0, middle=2355.0, lower=2310.0),
            adx=31.0,
            atr=45.3,
            vwap=2365.0,
            volume_ma=950000.0,
            relative_volume=1.45,
            week_52_high=2650.0,
            week_52_low=2200.0,
            momentum=-15.5,
        )

        result = ScoringService.score_market(current_price, indicators)

        assert result.trend == TrendEnum.BEARISH
        assert len(result.signals) > 0

    def test_score_market_neutral_scenario(self, sample_indicators):
        """Test complete neutral market scoring."""
        current_price = 2390.0
        sample_indicators.rsi = 50.0
        sample_indicators.adx = 18.0

        result = ScoringService.score_market(current_price, sample_indicators)

        assert result.trend == TrendEnum.NEUTRAL
        assert 0.0 <= result.score <= 100.0
        assert len(result.signals) > 0

    def test_score_market_determinism(self, sample_indicators):
        """Test that same inputs produce same outputs (determinism)."""
        current_price = 2470.0

        result1 = ScoringService.score_market(current_price, sample_indicators)
        result2 = ScoringService.score_market(current_price, sample_indicators)

        assert result1.trend == result2.trend
        assert result1.score == result2.score
        assert result1.rsi == result2.rsi
        assert result1.adx == result2.adx
        assert result1.vwap == result2.vwap
        assert result1.volumeRatio == result2.volumeRatio
        assert result1.signals == result2.signals
