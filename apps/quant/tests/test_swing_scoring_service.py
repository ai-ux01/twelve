"""
Unit tests for SwingScoringService.

Tests the deterministic scoring algorithm with various scenarios.
Validates that same inputs always produce same outputs.

Requirements: 5.3
"""

import pytest
from services.swing_scoring_service import (
    SwingScoringService,
    ScoringWeights,
    ComponentScores,
    SwingScoreResult,
)


class TestScoringWeights:
    """Test ScoringWeights model and validation."""

    def test_default_weights_sum_to_one(self):
        """Test that default weights sum to 1.0."""
        weights = ScoringWeights()
        assert weights.validate_weights() is True

        total = (
            weights.trend_weight
            + weights.technical_weight
            + weights.volume_weight
            + weights.relative_strength_weight
            + weights.breakout_weight
            + weights.sector_weight
            + weights.risk_reward_weight
        )
        assert abs(total - 1.0) < 0.01

    def test_custom_weights_validation(self):
        """Test custom weights validation."""
        # Valid custom weights
        weights = ScoringWeights(
            trend_weight=0.25,
            technical_weight=0.25,
            volume_weight=0.15,
            relative_strength_weight=0.15,
            breakout_weight=0.10,
            sector_weight=0.05,
            risk_reward_weight=0.05,
        )
        assert weights.validate_weights() is True

        # Invalid weights (don't sum to 1.0)
        invalid_weights = ScoringWeights(
            trend_weight=0.60,
            technical_weight=0.50,
            volume_weight=0.0,
            relative_strength_weight=0.0,
            breakout_weight=0.0,
            sector_weight=0.0,
            risk_reward_weight=0.0,
        )
        assert invalid_weights.validate_weights() is False


class TestTrendScore:
    """Test trend score calculation."""

    def test_perfect_uptrend(self):
        """Test perfect uptrend: price > EMA20 > EMA50 > EMA200, strong ADX."""
        score = SwingScoringService.calculate_trend_score(
            current_price=2500.0,
            ema_20=2480.0,
            ema_50=2450.0,
            ema_200=2400.0,
            adx=35.0,
        )

        # Should be high score (EMA alignment + strong ADX)
        assert score >= 90.0
        assert score <= 100.0

    def test_weak_trend(self):
        """Test weak trend with low ADX."""
        score = SwingScoringService.calculate_trend_score(
            current_price=2500.0,
            ema_20=2480.0,
            ema_50=2450.0,
            ema_200=2400.0,
            adx=15.0,
        )

        # Should be high EMA alignment score but reduced by weak ADX
        # EMA alignment (100) * 0.5 + ADX (60) * 0.3 + price position (100) * 0.2 = 88
        assert score >= 80.0
        assert score < 95.0

    def test_no_trend(self):
        """Test no trend: price below all EMAs, weak ADX."""
        score = SwingScoringService.calculate_trend_score(
            current_price=2300.0,
            ema_20=2400.0,
            ema_50=2450.0,
            ema_200=2480.0,
            adx=10.0,
        )

        # Should be low score
        assert score >= 0.0
        assert score < 40.0


class TestTechnicalScore:
    """Test technical score calculation."""

    def test_optimal_indicators(self):
        """Test optimal technical indicators: RSI 40-70, positive MACD, moderate ATR."""
        score = SwingScoringService.calculate_technical_score(
            rsi=55.0,
            macd_histogram=2.0,
            atr=60.0,
            current_price=2000.0,  # ATR is 3% of price - optimal
        )

        # Should be high score
        assert score >= 80.0
        assert score <= 100.0

    def test_extreme_rsi(self):
        """Test extreme RSI values (overbought/oversold)."""
        # Overbought
        score_ob = SwingScoringService.calculate_technical_score(
            rsi=85.0,
            macd_histogram=2.0,
            atr=60.0,
            current_price=2000.0,
        )

        # Oversold
        score_os = SwingScoringService.calculate_technical_score(
            rsi=15.0,
            macd_histogram=2.0,
            atr=60.0,
            current_price=2000.0,
        )

        # Both should be moderate scores (penalized for extremes)
        assert score_ob < 80.0
        assert score_os < 80.0


class TestVolumeScore:
    """Test volume score calculation."""

    def test_high_volume_increasing(self):
        """Test high relative volume with increasing trend."""
        score = SwingScoringService.calculate_volume_score(
            relative_volume=2.0,
            volume_trend="INCREASING",
        )

        # Should be excellent score
        assert score >= 95.0
        assert score <= 100.0

    def test_low_volume_decreasing(self):
        """Test low relative volume with decreasing trend."""
        score = SwingScoringService.calculate_volume_score(
            relative_volume=0.5,
            volume_trend="DECREASING",
        )

        # Should be low score
        assert score >= 0.0
        assert score < 50.0


class TestRelativeStrengthScore:
    """Test relative strength score calculation."""

    def test_strong_relative_strength(self):
        """Test strong outperformance vs sector and market."""
        score = SwingScoringService.calculate_relative_strength_score(
            sector_comparison=90.0,
            market_comparison=85.0,
        )

        # Should be high score
        assert score >= 80.0
        assert score <= 100.0

    def test_weak_relative_strength(self):
        """Test underperformance vs sector and market."""
        score = SwingScoringService.calculate_relative_strength_score(
            sector_comparison=30.0,
            market_comparison=25.0,
        )

        # Should be low score
        assert score >= 0.0
        assert score < 40.0


class TestBreakoutScore:
    """Test breakout score calculation."""

    def test_confirmed_breakout_with_retest(self):
        """Test confirmed breakout with volume and retest."""
        score = SwingScoringService.calculate_breakout_score(
            breakout_detected=True,
            volume_confirmed=True,
            retest_detected=True,
        )

        # Should be maximum score (100 + 20 bonus, capped at 100)
        assert score == 100.0

    def test_breakout_without_volume(self):
        """Test breakout without volume confirmation."""
        score = SwingScoringService.calculate_breakout_score(
            breakout_detected=True,
            volume_confirmed=False,
            retest_detected=False,
        )

        # Should be moderate score
        assert score == 60.0

    def test_no_breakout(self):
        """Test no breakout detected."""
        score = SwingScoringService.calculate_breakout_score(
            breakout_detected=False,
            volume_confirmed=False,
            retest_detected=False,
        )

        # Should be zero
        assert score == 0.0


class TestSectorScore:
    """Test sector score calculation."""

    def test_sector_score_mapping(self):
        """Test direct mapping of sector strength."""
        # High sector strength
        score1 = SwingScoringService.calculate_sector_score(80.0)
        assert score1 == 80.0

        # Low sector strength
        score2 = SwingScoringService.calculate_sector_score(30.0)
        assert score2 == 30.0


class TestRiskRewardScore:
    """Test risk/reward score calculation."""

    def test_excellent_risk_reward(self):
        """Test excellent risk/reward ratio (> 3:1)."""
        score = SwingScoringService.calculate_risk_reward_score(
            entry_price=2000.0,
            stop_loss=1950.0,  # Risk: 50
            target=2150.0,  # Reward: 150 (R:R = 3:1)
        )

        # Should be high score
        assert score >= 95.0
        assert score <= 100.0

    def test_poor_risk_reward(self):
        """Test poor risk/reward ratio (< 1.5:1)."""
        score = SwingScoringService.calculate_risk_reward_score(
            entry_price=2000.0,
            stop_loss=1950.0,  # Risk: 50
            target=2050.0,  # Reward: 50 (R:R = 1:1)
        )

        # Should be low score
        assert score >= 0.0
        assert score < 60.0


class TestTotalScore:
    """Test complete scoring calculation."""

    def test_strong_swing_candidate(self):
        """Test strong swing candidate with all favorable factors."""
        result = SwingScoringService.calculate_total_score(
            # Trend inputs
            current_price=2500.0,
            ema_20=2480.0,
            ema_50=2450.0,
            ema_200=2400.0,
            adx=35.0,
            # Technical inputs
            rsi=55.0,
            macd_histogram=2.0,
            atr=60.0,
            # Volume inputs
            relative_volume=1.8,
            volume_trend="INCREASING",
            # Relative strength inputs
            sector_comparison=85.0,
            market_comparison=80.0,
            # Breakout inputs
            breakout_detected=True,
            volume_confirmed=True,
            retest_detected=True,
            # Sector input
            sector_strength=75.0,
            # Risk/reward inputs
            entry_price=2500.0,
            stop_loss=2450.0,
            target=2650.0,
        )

        # Validate result structure
        assert isinstance(result, SwingScoreResult)
        assert isinstance(result.components, ComponentScores)
        assert isinstance(result.signals, list)

        # Validate total score
        assert result.total_score >= 70.0
        assert result.total_score <= 100.0

        # Validate all component scores are in range
        assert 0.0 <= result.components.trend_score <= 100.0
        assert 0.0 <= result.components.technical_score <= 100.0
        assert 0.0 <= result.components.volume_score <= 100.0
        assert 0.0 <= result.components.relative_strength_score <= 100.0
        assert 0.0 <= result.components.breakout_score <= 100.0
        assert 0.0 <= result.components.sector_score <= 100.0
        assert 0.0 <= result.components.risk_reward_score <= 100.0

        # Validate signals are generated
        assert len(result.signals) > 0

    def test_weak_swing_candidate(self):
        """Test weak swing candidate with unfavorable factors."""
        result = SwingScoringService.calculate_total_score(
            # Trend inputs (weak)
            current_price=2300.0,
            ema_20=2400.0,
            ema_50=2450.0,
            ema_200=2480.0,
            adx=12.0,
            # Technical inputs (poor)
            rsi=25.0,
            macd_histogram=-3.0,
            atr=150.0,
            # Volume inputs (low)
            relative_volume=0.4,
            volume_trend="DECREASING",
            # Relative strength inputs (weak)
            sector_comparison=30.0,
            market_comparison=25.0,
            # Breakout inputs (none)
            breakout_detected=False,
            volume_confirmed=False,
            retest_detected=False,
            # Sector input (weak)
            sector_strength=35.0,
            # Risk/reward inputs (poor)
            entry_price=2300.0,
            stop_loss=2250.0,
            target=2350.0,
        )

        # Should be low total score
        assert result.total_score >= 0.0
        assert result.total_score < 50.0

        # Validate signals indicate weakness
        assert any("Weak" in signal or "weak" in signal for signal in result.signals)

    def test_deterministic_scoring(self):
        """Test that same inputs always produce same outputs."""
        inputs = {
            "current_price": 2500.0,
            "ema_20": 2480.0,
            "ema_50": 2450.0,
            "ema_200": 2400.0,
            "adx": 30.0,
            "rsi": 60.0,
            "macd_histogram": 1.5,
            "atr": 50.0,
            "relative_volume": 1.3,
            "volume_trend": "STABLE",
            "sector_comparison": 70.0,
            "market_comparison": 65.0,
            "breakout_detected": True,
            "volume_confirmed": True,
            "retest_detected": False,
            "sector_strength": 68.0,
            "entry_price": 2500.0,
            "stop_loss": 2460.0,
            "target": 2600.0,
        }

        # Calculate score multiple times
        result1 = SwingScoringService.calculate_total_score(**inputs)
        result2 = SwingScoringService.calculate_total_score(**inputs)
        result3 = SwingScoringService.calculate_total_score(**inputs)

        # All results should be identical
        assert result1.total_score == result2.total_score == result3.total_score
        assert result1.components.trend_score == result2.components.trend_score
        assert result1.components.technical_score == result2.components.technical_score
        assert result1.components.volume_score == result2.components.volume_score

    def test_custom_weights(self):
        """Test scoring with custom weights."""
        inputs = {
            "current_price": 2500.0,
            "ema_20": 2480.0,
            "ema_50": 2450.0,
            "ema_200": 2400.0,
            "adx": 30.0,
            "rsi": 60.0,
            "macd_histogram": 1.5,
            "atr": 50.0,
            "relative_volume": 1.3,
            "volume_trend": "STABLE",
            "sector_comparison": 70.0,
            "market_comparison": 65.0,
            "breakout_detected": True,
            "volume_confirmed": True,
            "retest_detected": False,
            "sector_strength": 68.0,
            "entry_price": 2500.0,
            "stop_loss": 2460.0,
            "target": 2600.0,
        }

        # Custom weights emphasizing trend
        custom_weights = ScoringWeights(
            trend_weight=0.40,
            technical_weight=0.20,
            volume_weight=0.10,
            relative_strength_weight=0.10,
            breakout_weight=0.10,
            sector_weight=0.05,
            risk_reward_weight=0.05,
        )

        result_custom = SwingScoringService.calculate_total_score(
            **inputs, weights=custom_weights
        )
        result_default = SwingScoringService.calculate_total_score(**inputs)

        # Scores should differ due to different weights
        assert result_custom.total_score != result_default.total_score

        # Component scores should be the same (weights only affect total)
        assert (
            result_custom.components.trend_score
            == result_default.components.trend_score
        )

    def test_invalid_weights_raises_error(self):
        """Test that invalid weights raise an error."""
        invalid_weights = ScoringWeights(
            trend_weight=0.60,
            technical_weight=0.50,
            volume_weight=0.0,
            relative_strength_weight=0.0,
            breakout_weight=0.0,
            sector_weight=0.0,
            risk_reward_weight=0.0,
        )

        with pytest.raises(ValueError, match="Weights must sum"):
            SwingScoringService.calculate_total_score(
                current_price=2500.0,
                ema_20=2480.0,
                ema_50=2450.0,
                ema_200=2400.0,
                adx=30.0,
                rsi=60.0,
                macd_histogram=1.5,
                atr=50.0,
                relative_volume=1.3,
                volume_trend="STABLE",
                sector_comparison=70.0,
                market_comparison=65.0,
                breakout_detected=True,
                volume_confirmed=True,
                retest_detected=False,
                sector_strength=68.0,
                entry_price=2500.0,
                stop_loss=2460.0,
                target=2600.0,
                weights=invalid_weights,
            )
