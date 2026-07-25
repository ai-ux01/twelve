"""
Unit tests for swing scoring calculator.

Tests all component scoring functions to ensure deterministic behavior
and correct score calculations (0-100 range).

Requirements: 5.3
"""

import pytest
from calculators.swing_scoring import (
    calculate_trend_score,
    calculate_technical_score,
    calculate_volume_score,
    calculate_relative_strength_score,
    calculate_breakout_score,
    calculate_sector_score,
    calculate_risk_reward_score,
    calculate_total_swing_score,
)
from models import IndicatorResult, MACDValues, BollingerBands


@pytest.fixture
def sample_indicators():
    """Create sample indicator result for testing."""
    return IndicatorResult(
        rsi=55.0,
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
        atr=35.0,
        vwap=2461.0,
        volume_ma=950000.0,
        relative_volume=1.25,
        week_52_high=2650.0,
        week_52_low=2200.0,
        momentum=10.5,
    )


class TestTrendScore:
    """Test trend score calculation."""

    def test_perfect_ema_alignment(self, sample_indicators):
        """Test perfect EMA alignment gives high score."""
        # Price > EMA20 > EMA50 > EMA200, strong ADX
        sample_indicators.adx = 35.0
        score = calculate_trend_score(2465.0, sample_indicators)
        assert (
            70 <= score <= 100
        ), f"Expected high score for perfect alignment, got {score}"

    def test_weak_trend_low_adx(self, sample_indicators):
        """Test weak trend (low ADX) gives lower score."""
        sample_indicators.adx = 15.0
        score_weak = calculate_trend_score(2465.0, sample_indicators)

        sample_indicators.adx = 35.0
        score_strong = calculate_trend_score(2465.0, sample_indicators)

        assert (
            score_weak < score_strong
        ), f"Weak trend should score lower than strong trend"

    def test_price_below_emas(self, sample_indicators):
        """Test price below EMAs gives low score."""
        score = calculate_trend_score(2300.0, sample_indicators)
        assert score < 50, f"Expected low score for price below EMAs, got {score}"

    def test_price_too_far_above_ema(self, sample_indicators):
        """Test price too far above EMA20 is penalized."""
        # Price 10% above EMA20
        very_high_price = sample_indicators.ema_20 * 1.10
        score = calculate_trend_score(very_high_price, sample_indicators)
        assert score < 90, f"Expected penalty for overextended price, got {score}"

    def test_score_in_valid_range(self, sample_indicators):
        """Test score is always in valid range [0, 100]."""
        for price in [2300.0, 2400.0, 2465.0, 2500.0, 2600.0]:
            score = calculate_trend_score(price, sample_indicators)
            assert 0 <= score <= 100, f"Score {score} out of range for price {price}"

    def test_invalid_price_raises_error(self, sample_indicators):
        """Test invalid price raises ValueError."""
        with pytest.raises(ValueError, match="current_price must be positive"):
            calculate_trend_score(-100.0, sample_indicators)

        with pytest.raises(ValueError, match="current_price must be positive"):
            calculate_trend_score(0.0, sample_indicators)


class TestTechnicalScore:
    """Test technical score calculation."""

    def test_optimal_rsi_range(self, sample_indicators):
        """Test RSI in optimal range (40-70) gives high score."""
        sample_indicators.rsi = 55.0
        score = calculate_technical_score(sample_indicators)
        assert 60 <= score <= 100, f"Expected high score for optimal RSI, got {score}"

    def test_overbought_rsi(self, sample_indicators):
        """Test overbought RSI (>70) is penalized compared to optimal range."""
        sample_indicators.rsi = 80.0
        score_overbought = calculate_technical_score(sample_indicators)

        sample_indicators.rsi = 55.0  # Optimal range
        score_optimal = calculate_technical_score(sample_indicators)

        assert (
            score_overbought < score_optimal
        ), f"Overbought RSI should score lower than optimal RSI"

    def test_oversold_rsi(self, sample_indicators):
        """Test oversold RSI (<40) gives lower score than optimal range."""
        sample_indicators.rsi = 30.0
        score_oversold = calculate_technical_score(sample_indicators)

        sample_indicators.rsi = 55.0  # Optimal range
        score_optimal = calculate_technical_score(sample_indicators)

        assert (
            score_oversold < score_optimal
        ), f"Oversold RSI should score lower than optimal RSI"
        assert (
            50 <= score_oversold <= 80
        ), f"Oversold RSI score should be moderate, got {score_oversold}"

    def test_positive_macd_histogram(self, sample_indicators):
        """Test positive MACD histogram increases score."""
        sample_indicators.macd.histogram = 5.0
        score_positive = calculate_technical_score(sample_indicators)

        sample_indicators.macd.histogram = -5.0
        score_negative = calculate_technical_score(sample_indicators)

        assert score_positive > score_negative, "Positive MACD should score higher"

    def test_moderate_atr_preferred(self, sample_indicators):
        """Test moderate ATR (20-50) gives best score."""
        sample_indicators.atr = 35.0
        score_moderate = calculate_technical_score(sample_indicators)

        sample_indicators.atr = 5.0
        score_low = calculate_technical_score(sample_indicators)

        sample_indicators.atr = 100.0
        score_high = calculate_technical_score(sample_indicators)

        assert (
            score_moderate > score_low
        ), "Moderate ATR should score higher than low ATR"
        assert (
            score_moderate > score_high
        ), "Moderate ATR should score higher than high ATR"

    def test_score_in_valid_range(self, sample_indicators):
        """Test score is always in valid range [0, 100]."""
        for rsi in [10, 30, 50, 70, 90]:
            sample_indicators.rsi = rsi
            score = calculate_technical_score(sample_indicators)
            assert 0 <= score <= 100, f"Score {score} out of range for RSI {rsi}"


class TestVolumeScore:
    """Test volume score calculation."""

    def test_high_relative_volume(self, sample_indicators):
        """Test high relative volume (>1.5) gives max score."""
        sample_indicators.relative_volume = 2.0
        score = calculate_volume_score(sample_indicators)
        assert score >= 85, f"Expected high score for high volume, got {score}"

    def test_average_relative_volume(self, sample_indicators):
        """Test average relative volume (1.0-1.5) gives good score."""
        sample_indicators.relative_volume = 1.25
        score = calculate_volume_score(sample_indicators)
        assert (
            70 <= score <= 100
        ), f"Expected good score for average volume, got {score}"

    def test_low_relative_volume(self, sample_indicators):
        """Test low relative volume (<1.0) gives lower score than high volume."""
        sample_indicators.relative_volume = 0.7
        score_low = calculate_volume_score(sample_indicators)

        sample_indicators.relative_volume = 1.5
        score_high = calculate_volume_score(sample_indicators)

        assert score_low < score_high, f"Low volume should score lower than high volume"

    def test_positive_momentum_bonus(self, sample_indicators):
        """Test positive momentum increases score."""
        sample_indicators.relative_volume = 1.25
        sample_indicators.momentum = 10.0
        score_positive = calculate_volume_score(sample_indicators)

        sample_indicators.momentum = -10.0
        score_negative = calculate_volume_score(sample_indicators)

        assert score_positive > score_negative, "Positive momentum should score higher"

    def test_score_in_valid_range(self, sample_indicators):
        """Test score is always in valid range [0, 100]."""
        for rel_vol in [0.5, 1.0, 1.5, 2.0, 3.0]:
            sample_indicators.relative_volume = rel_vol
            score = calculate_volume_score(sample_indicators)
            assert (
                0 <= score <= 100
            ), f"Score {score} out of range for rel_vol {rel_vol}"


class TestRelativeStrengthScore:
    """Test relative strength score calculation."""

    def test_outperforming_sector_and_market(self):
        """Test outperforming both sector and market gives high score."""
        score = calculate_relative_strength_score(
            stock_performance=10.0,
            sector_performance=5.0,
            market_performance=3.0,
        )
        assert score >= 85, f"Expected high score for outperformance, got {score}"

    def test_underperforming_sector_and_market(self):
        """Test underperforming both sector and market gives low score."""
        score = calculate_relative_strength_score(
            stock_performance=2.0,
            sector_performance=8.0,
            market_performance=7.0,
        )
        assert score < 40, f"Expected low score for underperformance, got {score}"

    def test_matching_sector_performance(self):
        """Test matching sector performance gives mid-range score."""
        score = calculate_relative_strength_score(
            stock_performance=5.0,
            sector_performance=5.0,
            market_performance=5.0,
        )
        assert (
            60 <= score <= 80
        ), f"Expected mid-range score for matching performance, got {score}"

    def test_sector_weighted_more_than_market(self):
        """Test sector comparison has more weight (60%) than market (40%)."""
        # Strong sector outperformance, weak market outperformance
        score_sector_strong = calculate_relative_strength_score(
            stock_performance=10.0,
            sector_performance=5.0,  # +5% vs sector
            market_performance=9.5,  # +0.5% vs market
        )

        # Weak sector outperformance, strong market outperformance
        score_market_strong = calculate_relative_strength_score(
            stock_performance=10.0,
            sector_performance=9.5,  # +0.5% vs sector
            market_performance=5.0,  # +5% vs market
        )

        assert (
            score_sector_strong > score_market_strong
        ), "Sector should have more weight"

    def test_score_in_valid_range(self):
        """Test score is always in valid range [0, 100]."""
        for stock_perf in [-10, 0, 5, 10, 20]:
            score = calculate_relative_strength_score(
                stock_performance=stock_perf,
                sector_performance=5.0,
                market_performance=5.0,
            )
            assert 0 <= score <= 100, f"Score {score} out of range"


class TestBreakoutScore:
    """Test breakout score calculation."""

    def test_breakout_with_volume_and_retest(self):
        """Test breakout with volume confirmation and retest gives max score."""
        score = calculate_breakout_score(
            breakout_detected=True,
            volume_confirmed=True,
            retest_detected=True,
        )
        assert score == 100.0, f"Expected 100 for perfect breakout, got {score}"

    def test_breakout_with_volume_no_retest(self):
        """Test breakout with volume but no retest gives 100."""
        score = calculate_breakout_score(
            breakout_detected=True,
            volume_confirmed=True,
            retest_detected=False,
        )
        assert (
            score == 100.0
        ), f"Expected 100 for volume-confirmed breakout, got {score}"

    def test_breakout_without_volume(self):
        """Test breakout without volume gives 60."""
        score = calculate_breakout_score(
            breakout_detected=True,
            volume_confirmed=False,
            retest_detected=False,
        )
        assert score == 60.0, f"Expected 60 for non-volume breakout, got {score}"

    def test_breakout_without_volume_with_retest(self):
        """Test breakout without volume but with retest gives 80."""
        score = calculate_breakout_score(
            breakout_detected=True,
            volume_confirmed=False,
            retest_detected=True,
        )
        assert score == 80.0, f"Expected 80 for retest without volume, got {score}"

    def test_no_breakout(self):
        """Test no breakout gives 0."""
        score = calculate_breakout_score(
            breakout_detected=False,
            volume_confirmed=True,
            retest_detected=True,
        )
        assert score == 0.0, f"Expected 0 for no breakout, got {score}"

    def test_breakout_strength_modifier(self):
        """Test breakout strength modifies score."""
        score_strong = calculate_breakout_score(
            breakout_detected=True,
            volume_confirmed=True,
            retest_detected=False,
            breakout_strength=1.0,
        )

        score_weak = calculate_breakout_score(
            breakout_detected=True,
            volume_confirmed=True,
            retest_detected=False,
            breakout_strength=0.5,
        )

        assert score_strong > score_weak, "Stronger breakout should score higher"

    def test_score_in_valid_range(self):
        """Test score is always in valid range [0, 100]."""
        for breakout in [True, False]:
            for volume in [True, False]:
                for retest in [True, False]:
                    score = calculate_breakout_score(breakout, volume, retest)
                    assert 0 <= score <= 100, f"Score {score} out of range"


class TestSectorScore:
    """Test sector score calculation."""

    def test_direct_mapping(self):
        """Test sector score directly maps input."""
        assert calculate_sector_score(0.0) == 0.0
        assert calculate_sector_score(50.0) == 50.0
        assert calculate_sector_score(100.0) == 100.0

    def test_invalid_range_raises_error(self):
        """Test invalid sector strength raises ValueError."""
        with pytest.raises(
            ValueError, match="sector_strength must be between 0 and 100"
        ):
            calculate_sector_score(-10.0)

        with pytest.raises(
            ValueError, match="sector_strength must be between 0 and 100"
        ):
            calculate_sector_score(110.0)


class TestRiskRewardScore:
    """Test risk/reward score calculation."""

    def test_high_risk_reward_ratio(self):
        """Test high R:R ratio (>3) gives 100."""
        score = calculate_risk_reward_score(
            current_price=100.0,
            stop_loss=98.0,  # 2% risk
            target=106.0,  # 6% reward, R:R = 3
        )
        assert score >= 90, f"Expected high score for R:R=3, got {score}"

    def test_moderate_risk_reward_ratio(self):
        """Test moderate R:R ratio (2-3) gives 80-100."""
        score = calculate_risk_reward_score(
            current_price=100.0,
            stop_loss=98.0,  # 2% risk
            target=104.0,  # 4% reward, R:R = 2
        )
        assert 80 <= score <= 100, f"Expected 80-100 for R:R=2, got {score}"

    def test_low_risk_reward_ratio(self):
        """Test low R:R ratio (1.5-2) gives 60-80."""
        score = calculate_risk_reward_score(
            current_price=100.0,
            stop_loss=98.0,  # 2% risk
            target=103.0,  # 3% reward, R:R = 1.5
        )
        assert 60 <= score <= 80, f"Expected 60-80 for R:R=1.5, got {score}"

    def test_ideal_stop_distance_bonus(self):
        """Test ideal stop distance (1-2.5%) gets bonus compared to very wide stops."""
        # 2% stop (ideal)
        score_ideal = calculate_risk_reward_score(
            current_price=100.0,
            stop_loss=98.0,
            target=106.0,
        )

        # 10% stop (very wide, same R:R ratio of 3.0)
        score_wide = calculate_risk_reward_score(
            current_price=100.0,
            stop_loss=90.0,
            target=130.0,  # Same R:R ratio
        )

        # Both should score high (R:R=3), but ideal stop should have bonus
        assert (
            score_ideal >= 100
        ), f"Ideal stop with R:R=3 should score 100, got {score_ideal}"
        assert (
            score_wide >= 90
        ), f"Wide stop with R:R=3 should still score high, got {score_wide}"

    def test_invalid_prices_raise_error(self):
        """Test invalid prices raise ValueError."""
        with pytest.raises(ValueError, match="All prices must be positive"):
            calculate_risk_reward_score(0.0, 98.0, 106.0)

        with pytest.raises(ValueError, match="Stop loss must be below current price"):
            calculate_risk_reward_score(100.0, 102.0, 106.0)

        with pytest.raises(ValueError, match="Target must be above current price"):
            calculate_risk_reward_score(100.0, 98.0, 99.0)

    def test_score_in_valid_range(self):
        """Test score is always in valid range [0, 100]."""
        for rr_ratio in [1.0, 1.5, 2.0, 2.5, 3.0, 4.0]:
            target = 100.0 + (2.0 * rr_ratio)  # 2% risk
            score = calculate_risk_reward_score(100.0, 98.0, target)
            assert 0 <= score <= 100, f"Score {score} out of range for R:R={rr_ratio}"


class TestTotalSwingScore:
    """Test total swing score calculation."""

    def test_default_weights(self):
        """Test default weights sum to 1.0 and produce valid score."""
        score = calculate_total_swing_score(
            trend_score=80.0,
            technical_score=75.0,
            volume_score=70.0,
            relative_strength_score=65.0,
            breakout_score=90.0,
            sector_score=60.0,
            risk_reward_score=85.0,
        )
        assert 0 <= score <= 100, f"Total score {score} out of range"
        assert 70 <= score <= 80, f"Expected score around 75, got {score}"

    def test_custom_weights(self):
        """Test custom weights work correctly."""
        score = calculate_total_swing_score(
            trend_score=100.0,
            technical_score=0.0,
            volume_score=0.0,
            relative_strength_score=0.0,
            breakout_score=0.0,
            sector_score=0.0,
            risk_reward_score=0.0,
            trend_weight=1.0,
            technical_weight=0.0,
            volume_weight=0.0,
            relative_strength_weight=0.0,
            breakout_weight=0.0,
            sector_weight=0.0,
            risk_reward_weight=0.0,
        )
        assert score == 100.0, "Should equal trend_score when trend_weight=1.0"

    def test_invalid_weights_raise_error(self):
        """Test weights that don't sum to 1.0 raise ValueError."""
        with pytest.raises(ValueError, match="Weights must sum to 1.0"):
            calculate_total_swing_score(
                trend_score=80.0,
                technical_score=75.0,
                volume_score=70.0,
                relative_strength_score=65.0,
                breakout_score=90.0,
                sector_score=60.0,
                risk_reward_score=85.0,
                trend_weight=0.5,  # Only 0.5 total weight
                technical_weight=0.0,
                volume_weight=0.0,
                relative_strength_weight=0.0,
                breakout_weight=0.0,
                sector_weight=0.0,
                risk_reward_weight=0.0,
            )

    def test_invalid_score_raises_error(self):
        """Test scores outside [0, 100] raise ValueError."""
        with pytest.raises(ValueError, match="All scores must be between 0 and 100"):
            calculate_total_swing_score(
                trend_score=150.0,  # Invalid
                technical_score=75.0,
                volume_score=70.0,
                relative_strength_score=65.0,
                breakout_score=90.0,
                sector_score=60.0,
                risk_reward_score=85.0,
            )

    def test_deterministic_calculation(self):
        """Test same inputs always produce same output."""
        score1 = calculate_total_swing_score(
            trend_score=80.0,
            technical_score=75.0,
            volume_score=70.0,
            relative_strength_score=65.0,
            breakout_score=90.0,
            sector_score=60.0,
            risk_reward_score=85.0,
        )

        score2 = calculate_total_swing_score(
            trend_score=80.0,
            technical_score=75.0,
            volume_score=70.0,
            relative_strength_score=65.0,
            breakout_score=90.0,
            sector_score=60.0,
            risk_reward_score=85.0,
        )

        assert score1 == score2, "Same inputs should produce same output"

    def test_score_in_valid_range(self):
        """Test total score is always in valid range [0, 100]."""
        import random

        random.seed(42)

        for _ in range(10):
            scores = [random.uniform(0, 100) for _ in range(7)]
            total = calculate_total_swing_score(*scores)
            assert 0 <= total <= 100, f"Total score {total} out of range"


class TestDeterministicBehavior:
    """Test that all scoring functions are deterministic."""

    def test_trend_score_deterministic(self, sample_indicators):
        """Test trend score is deterministic."""
        score1 = calculate_trend_score(2465.0, sample_indicators)
        score2 = calculate_trend_score(2465.0, sample_indicators)
        assert score1 == score2, "Trend score should be deterministic"

    def test_technical_score_deterministic(self, sample_indicators):
        """Test technical score is deterministic."""
        score1 = calculate_technical_score(sample_indicators)
        score2 = calculate_technical_score(sample_indicators)
        assert score1 == score2, "Technical score should be deterministic"

    def test_volume_score_deterministic(self, sample_indicators):
        """Test volume score is deterministic."""
        score1 = calculate_volume_score(sample_indicators)
        score2 = calculate_volume_score(sample_indicators)
        assert score1 == score2, "Volume score should be deterministic"

    def test_relative_strength_score_deterministic(self):
        """Test relative strength score is deterministic."""
        score1 = calculate_relative_strength_score(10.0, 5.0, 3.0)
        score2 = calculate_relative_strength_score(10.0, 5.0, 3.0)
        assert score1 == score2, "Relative strength score should be deterministic"

    def test_breakout_score_deterministic(self):
        """Test breakout score is deterministic."""
        score1 = calculate_breakout_score(True, True, True)
        score2 = calculate_breakout_score(True, True, True)
        assert score1 == score2, "Breakout score should be deterministic"

    def test_sector_score_deterministic(self):
        """Test sector score is deterministic."""
        score1 = calculate_sector_score(75.0)
        score2 = calculate_sector_score(75.0)
        assert score1 == score2, "Sector score should be deterministic"

    def test_risk_reward_score_deterministic(self):
        """Test risk/reward score is deterministic."""
        score1 = calculate_risk_reward_score(100.0, 98.0, 106.0)
        score2 = calculate_risk_reward_score(100.0, 98.0, 106.0)
        assert score1 == score2, "Risk/reward score should be deterministic"
