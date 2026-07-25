"""
Unit tests for IntradayScoringService.

Tests individual component scoring functions and weighted total calculation.

Requirements: 6.6
"""

import pytest
from services.intraday_scoring_service import (
    IntradayScoringService,
    IntradayScoreComponents,
    IntradayScoreResult,
)
from models.intraday import (
    IntradayTechnicalAnalysis,
    MACDIndicator,
    BollingerBands,
    OpeningRangeResult,
    PreviousDayLevelsResult,
    BreakoutStatus,
    BreachStatus,
    GapType,
)


class TestIntradayScoringWeights:
    """Test IntradayScoringWeights model and validation."""

    def test_default_weights_sum_to_one(self):
        """Test that default weights sum to 1.0."""
        weights = IntradayScoringWeights()
        assert weights.validate_weights()

        total = (
            weights.trend_weight
            + weights.momentum_weight
            + weights.volume_weight
            + weights.vwap_weight
            + weights.opening_range_weight
            + weights.prev_day_levels_weight
            + weights.risk_reward_weight
        )
        assert abs(total - 1.0) < 0.01

    def test_default_weight_values(self):
        """Test default weight values match specification."""
        weights = IntradayScoringWeights()
        assert weights.trend_weight == 0.25
        assert weights.momentum_weight == 0.20
        assert weights.volume_weight == 0.15
        assert weights.vwap_weight == 0.15
        assert weights.opening_range_weight == 0.10
        assert weights.prev_day_levels_weight == 0.10
        assert weights.risk_reward_weight == 0.05

    def test_custom_weights(self):
        """Test custom weights configuration."""
        weights = IntradayScoringWeights(
            trend_weight=0.30,
            momentum_weight=0.25,
            volume_weight=0.15,
            vwap_weight=0.10,
            opening_range_weight=0.10,
            prev_day_levels_weight=0.05,
            risk_reward_weight=0.05,
        )
        assert weights.validate_weights()


class TestTrendScore:
    """Test trend score calculation."""

    def test_strong_bullish_trend(self):
        """Test EMA9 > EMA21 and price > EMA9 = high score."""
        score = IntradayScoringService.calculate_trend_score(
            current_price=100.0,
            ema_9=98.0,
            ema_21=95.0,
        )
        assert score >= 85.0  # Strong bullish

    def test_strong_bearish_trend(self):
        """Test EMA9 < EMA21 and price < EMA9 = low score."""
        score = IntradayScoringService.calculate_trend_score(
            current_price=100.0,
            ema_9=102.0,
            ema_21=105.0,
        )
        assert score <= 15.0  # Strong bearish

    def test_neutral_trend(self):
        """Test price between EMAs = neutral score."""
        score = IntradayScoringService.calculate_trend_score(
            current_price=100.0,
            ema_9=99.0,
            ema_21=101.0,
        )
        assert 30.0 <= score <= 70.0  # Neutral range (bearish EMA alignment, price between)


class TestMomentumScore:
    """Test momentum score calculation."""

    def test_strong_bullish_momentum(self):
        """Test RSI 50-70 + positive MACD = high score."""
        score = IntradayScoringService.calculate_momentum_score(
            rsi=60.0,
            macd_histogram=2.0,
        )
        assert score >= 85.0  # Strong bullish momentum (RSI 60 = 100, MACD 2.0 = 70, weighted avg ~88)

    def test_weak_momentum(self):
        """Test RSI < 50 + negative MACD = low score."""
        score = IntradayScoringService.calculate_momentum_score(
            rsi=35.0,
            macd_histogram=-2.0,
        )
        assert score <= 30.0  # Weak momentum

    def test_neutral_momentum(self):
        """Test RSI around 50 = neutral score."""
        score = IntradayScoringService.calculate_momentum_score(
            rsi=50.0,
            macd_histogram=0.0,
        )
        assert 75.0 <= score <= 85.0  # RSI at 50 is building momentum (score 50-100), MACD at 0 is neutral (50)


class TestVolumeScore:
    """Test volume score calculation."""

    def test_high_volume(self):
        """Test relative_volume > 1.5 = 100."""
        score = IntradayScoringService.calculate_volume_score(relative_volume=2.0)
        assert score == 100.0

    def test_low_volume(self):
        """Test relative_volume < 0.5 = 0."""
        score = IntradayScoringService.calculate_volume_score(relative_volume=0.3)
        assert score == 0.0

    def test_average_volume(self):
        """Test relative_volume = 1.0 = 50."""
        score = IntradayScoringService.calculate_volume_score(relative_volume=1.0)
        assert score == 50.0

    def test_linear_interpolation(self):
        """Test linear interpolation between 0.5 and 1.5."""
        score_75 = IntradayScoringService.calculate_volume_score(relative_volume=0.75)
        score_125 = IntradayScoringService.calculate_volume_score(relative_volume=1.25)
        assert score_75 == 25.0
        assert score_125 == 75.0


class TestVWAPScore:
    """Test VWAP score calculation."""

    def test_price_above_vwap(self):
        """Test price > VWAP = 100."""
        score = IntradayScoringService.calculate_vwap_score(
            current_price=100.0,
            vwap=98.0,
        )
        assert score >= 85.0  # Bullish

    def test_price_below_vwap(self):
        """Test price < VWAP = 0."""
        score = IntradayScoringService.calculate_vwap_score(
            current_price=100.0,
            vwap=102.0,
        )
        assert score <= 15.0  # Bearish

    def test_price_at_vwap(self):
        """Test price = VWAP = 50."""
        score = IntradayScoringService.calculate_vwap_score(
            current_price=100.0,
            vwap=100.0,
        )
        assert score == 50.0  # Neutral


class TestOpeningRangeScore:
    """Test opening range score calculation."""

    def test_breakout_above_with_volume(self):
        """Test BREAKOUT_ABOVE with volume = 100."""
        opening_range = OpeningRangeResult(
            high=100.0,
            low=95.0,
            midpoint=97.5,
            range_size=5.0,
            range_percent=5.13,
            breakout_status=BreakoutStatus.BREAKOUT_ABOVE,
            current_price=102.0,
            breakout_distance=2.0,
            volume_confirmed=True,
            volume_ratio=1.5,
        )
        score = IntradayScoringService.calculate_opening_range_score(opening_range)
        assert score == 100.0

    def test_breakout_above_without_volume(self):
        """Test BREAKOUT_ABOVE without volume = 70."""
        opening_range = OpeningRangeResult(
            high=100.0,
            low=95.0,
            midpoint=97.5,
            range_size=5.0,
            range_percent=5.13,
            breakout_status=BreakoutStatus.BREAKOUT_ABOVE,
            current_price=102.0,
            breakout_distance=2.0,
            volume_confirmed=False,
            volume_ratio=0.8,
        )
        score = IntradayScoringService.calculate_opening_range_score(opening_range)
        assert score == 70.0

    def test_no_breakout(self):
        """Test NO_BREAKOUT = 50."""
        opening_range = OpeningRangeResult(
            high=100.0,
            low=95.0,
            midpoint=97.5,
            range_size=5.0,
            range_percent=5.13,
            breakout_status=BreakoutStatus.NO_BREAKOUT,
            current_price=97.0,
            breakout_distance=None,
            volume_confirmed=False,
            volume_ratio=1.0,
        )
        score = IntradayScoringService.calculate_opening_range_score(opening_range)
        assert score == 50.0

    def test_breakdown_below_with_volume(self):
        """Test BREAKDOWN_BELOW with volume = 0."""
        opening_range = OpeningRangeResult(
            high=100.0,
            low=95.0,
            midpoint=97.5,
            range_size=5.0,
            range_percent=5.13,
            breakout_status=BreakoutStatus.BREAKDOWN_BELOW,
            current_price=92.0,
            breakout_distance=-3.16,
            volume_confirmed=True,
            volume_ratio=1.5,
        )
        score = IntradayScoringService.calculate_opening_range_score(opening_range)
        assert score == 0.0


class TestPrevDayLevelsScore:
    """Test previous day levels score calculation."""

    def test_above_high(self):
        """Test ABOVE_HIGH = 100 (scaled by significance)."""
        prev_day_levels = PreviousDayLevelsResult(
            prev_day_high=100.0,
            prev_day_low=95.0,
            prev_day_close=98.0,
            gap_percent=1.0,
            gap_type=GapType.GAP_UP,
            breach_status=BreachStatus.ABOVE_HIGH,
            current_price=102.0,
            distance_from_high_percent=2.0,
            distance_from_low_percent=7.37,
            breach_significance=0.85,
        )
        score = IntradayScoringService.calculate_prev_day_levels_score(prev_day_levels)
        assert score == 85.0  # 100 * 0.85

    def test_below_low(self):
        """Test BELOW_LOW = 0 (scaled by significance)."""
        prev_day_levels = PreviousDayLevelsResult(
            prev_day_high=100.0,
            prev_day_low=95.0,
            prev_day_close=98.0,
            gap_percent=-1.0,
            gap_type=GapType.GAP_DOWN,
            breach_status=BreachStatus.BELOW_LOW,
            current_price=93.0,
            distance_from_high_percent=-7.0,
            distance_from_low_percent=-2.11,
            breach_significance=0.75,
        )
        score = IntradayScoringService.calculate_prev_day_levels_score(prev_day_levels)
        assert score == 25.0  # 100 * (1 - 0.75)

    def test_within_range(self):
        """Test WITHIN_RANGE = 50."""
        prev_day_levels = PreviousDayLevelsResult(
            prev_day_high=100.0,
            prev_day_low=95.0,
            prev_day_close=98.0,
            gap_percent=0.0,
            gap_type=GapType.NO_GAP,
            breach_status=BreachStatus.WITHIN_RANGE,
            current_price=97.0,
            distance_from_high_percent=-3.0,
            distance_from_low_percent=2.11,
            breach_significance=0.0,
        )
        score = IntradayScoringService.calculate_prev_day_levels_score(prev_day_levels)
        assert score == 50.0


class TestRiskRewardScore:
    """Test risk/reward score calculation."""

    def test_excellent_risk_reward(self):
        """Test R:R > 2.0 = 100."""
        score = IntradayScoringService.calculate_risk_reward_score(
            entry_price=100.0,
            stop_loss=98.0,
            target=105.0,
        )
        assert score == 100.0  # R:R = 2.5

    def test_poor_risk_reward(self):
        """Test R:R < 1.0 = 0."""
        score = IntradayScoringService.calculate_risk_reward_score(
            entry_price=100.0,
            stop_loss=98.0,
            target=101.5,
        )
        assert score == 0.0  # R:R = 0.75

    def test_minimum_acceptable_risk_reward(self):
        """Test R:R = 1.5 between thresholds."""
        score = IntradayScoringService.calculate_risk_reward_score(
            entry_price=100.0,
            stop_loss=98.0,
            target=103.0,
        )
        assert score == 50.0  # R:R = 1.5, midpoint between 1.0 and 2.0

    def test_zero_risk_returns_zero(self):
        """Test that zero risk returns 0 score."""
        score = IntradayScoringService.calculate_risk_reward_score(
            entry_price=100.0,
            stop_loss=100.0,
            target=105.0,
        )
        assert score == 0.0


class TestCompleteScoring:
    """Test complete scoring calculation with all components."""

    def test_calculate_score_with_all_components(self):
        """Test complete scoring calculation."""
        # Create sample technical analysis
        analysis = IntradayTechnicalAnalysis(
            rsi=60.0,
            macd=MACDIndicator(value=2.0, signal=1.5, histogram=0.5),
            ema_9=98.0,
            ema_21=95.0,
            ema_50=93.0,
            vwap=97.0,
            atr=2.0,
            volume=150000,
            relative_volume=1.5,
            bollinger_bands=BollingerBands(
                upper=105.0,
                middle=100.0,
                lower=95.0,
            ),
        )

        opening_range = OpeningRangeResult(
            high=100.0,
            low=95.0,
            midpoint=97.5,
            range_size=5.0,
            range_percent=5.13,
            breakout_status=BreakoutStatus.BREAKOUT_ABOVE,
            current_price=102.0,
            breakout_distance=2.0,
            volume_confirmed=True,
            volume_ratio=1.5,
        )

        prev_day_levels = PreviousDayLevelsResult(
            prev_day_high=100.0,
            prev_day_low=95.0,
            prev_day_close=98.0,
            gap_percent=1.0,
            gap_type=GapType.GAP_UP,
            breach_status=BreachStatus.ABOVE_HIGH,
            current_price=102.0,
            distance_from_high_percent=2.0,
            distance_from_low_percent=7.37,
            breach_significance=0.85,
        )

        result = IntradayScoringService.calculate_score(
            analysis=analysis,
            current_price=100.0,
            opening_range=opening_range,
            prev_day_levels=prev_day_levels,
            entry_price=100.0,
            stop_loss=98.0,
            target=104.0,
        )

        # Verify result structure
        assert isinstance(result, IntradayScoreResult)
        assert 0.0 <= result.total_score <= 100.0
        assert isinstance(result.components, IntradayComponentScores)
        assert len(result.signals) > 0

        # Verify all component scores are in valid range
        assert 0.0 <= result.components.trend_score <= 100.0
        assert 0.0 <= result.components.momentum_score <= 100.0
        assert 0.0 <= result.components.volume_score <= 100.0
        assert 0.0 <= result.components.vwap_score <= 100.0
        assert 0.0 <= result.components.opening_range_score <= 100.0
        assert 0.0 <= result.components.prev_day_levels_score <= 100.0
        assert 0.0 <= result.components.risk_reward_score <= 100.0

    def test_calculate_score_with_custom_weights(self):
        """Test scoring with custom weights."""
        analysis = IntradayTechnicalAnalysis(
            rsi=60.0,
            macd=MACDIndicator(value=2.0, signal=1.5, histogram=0.5),
            ema_9=98.0,
            ema_21=95.0,
            ema_50=93.0,
            vwap=97.0,
            atr=2.0,
            volume=150000,
            relative_volume=1.5,
            bollinger_bands=BollingerBands(
                upper=105.0,
                middle=100.0,
                lower=95.0,
            ),
        )

        opening_range = OpeningRangeResult(
            high=100.0,
            low=95.0,
            midpoint=97.5,
            range_size=5.0,
            range_percent=5.13,
            breakout_status=BreakoutStatus.NO_BREAKOUT,
            current_price=97.0,
            breakout_distance=None,
            volume_confirmed=False,
            volume_ratio=1.0,
        )

        prev_day_levels = PreviousDayLevelsResult(
            prev_day_high=100.0,
            prev_day_low=95.0,
            prev_day_close=98.0,
            gap_percent=0.0,
            gap_type=GapType.NO_GAP,
            breach_status=BreachStatus.WITHIN_RANGE,
            current_price=97.0,
            distance_from_high_percent=-3.0,
            distance_from_low_percent=2.11,
            breach_significance=0.0,
        )

        custom_weights = IntradayScoringWeights(
            trend_weight=0.30,
            momentum_weight=0.25,
            volume_weight=0.15,
            vwap_weight=0.10,
            opening_range_weight=0.10,
            prev_day_levels_weight=0.05,
            risk_reward_weight=0.05,
        )

        result = IntradayScoringService.calculate_score(
            analysis=analysis,
            current_price=100.0,
            opening_range=opening_range,
            prev_day_levels=prev_day_levels,
            entry_price=100.0,
            stop_loss=98.0,
            target=104.0,
            weights=custom_weights,
        )

        assert isinstance(result, IntradayScoreResult)
        assert 0.0 <= result.total_score <= 100.0

    def test_signals_generation(self):
        """Test that signals are generated correctly."""
        analysis = IntradayTechnicalAnalysis(
            rsi=75.0,  # High RSI
            macd=MACDIndicator(value=2.0, signal=1.5, histogram=0.5),
            ema_9=98.0,
            ema_21=95.0,
            ema_50=93.0,
            vwap=97.0,
            atr=2.0,
            volume=150000,
            relative_volume=2.0,  # High volume
            bollinger_bands=BollingerBands(
                upper=105.0,
                middle=100.0,
                lower=95.0,
            ),
        )

        opening_range = OpeningRangeResult(
            high=100.0,
            low=95.0,
            midpoint=97.5,
            range_size=5.0,
            range_percent=5.13,
            breakout_status=BreakoutStatus.BREAKOUT_ABOVE,
            current_price=102.0,
            breakout_distance=2.0,
            volume_confirmed=True,
            volume_ratio=2.0,
        )

        prev_day_levels = PreviousDayLevelsResult(
            prev_day_high=100.0,
            prev_day_low=95.0,
            prev_day_close=98.0,
            gap_percent=2.0,
            gap_type=GapType.GAP_UP,
            breach_status=BreachStatus.ABOVE_HIGH,
            current_price=103.0,
            distance_from_high_percent=3.0,
            distance_from_low_percent=8.42,
            breach_significance=0.9,
        )

        result = IntradayScoringService.calculate_score(
            analysis=analysis,
            current_price=100.0,
            opening_range=opening_range,
            prev_day_levels=prev_day_levels,
            entry_price=100.0,
            stop_loss=97.0,
            target=106.0,
        )

        # Verify signals contain expected text
        signals_text = " ".join(result.signals)
        assert "Score:" in signals_text
        assert len(result.signals) >= 8  # One for each component + overall

    def test_invalid_weights_raise_error(self):
        """Test that invalid weights raise an error."""
        analysis = IntradayTechnicalAnalysis(
            rsi=60.0,
            macd=MACDIndicator(value=2.0, signal=1.5, histogram=0.5),
            ema_9=98.0,
            ema_21=95.0,
            ema_50=93.0,
            vwap=97.0,
            atr=2.0,
            volume=150000,
            relative_volume=1.5,
            bollinger_bands=BollingerBands(
                upper=105.0,
                middle=100.0,
                lower=95.0,
            ),
        )

        opening_range = OpeningRangeResult(
            high=100.0,
            low=95.0,
            midpoint=97.5,
            range_size=5.0,
            range_percent=5.13,
            breakout_status=BreakoutStatus.NO_BREAKOUT,
            current_price=97.0,
            breakout_distance=None,
            volume_confirmed=False,
            volume_ratio=1.0,
        )

        prev_day_levels = PreviousDayLevelsResult(
            prev_day_high=100.0,
            prev_day_low=95.0,
            prev_day_close=98.0,
            gap_percent=0.0,
            gap_type=GapType.NO_GAP,
            breach_status=BreachStatus.WITHIN_RANGE,
            current_price=97.0,
            distance_from_high_percent=-3.0,
            distance_from_low_percent=2.11,
            breach_significance=0.0,
        )

        # Weights that don't sum to 1.0
        invalid_weights = IntradayScoringWeights(
            trend_weight=0.50,
            momentum_weight=0.50,
            volume_weight=0.00,
            vwap_weight=0.00,
            opening_range_weight=0.00,
            prev_day_levels_weight=0.00,
            risk_reward_weight=0.00,
        )

        # Since weights sum to 1.0, this should NOT raise an error
        # Let's test with actually invalid weights that don't sum to 1.0
        invalid_weights = IntradayScoringWeights(
            trend_weight=0.60,
            momentum_weight=0.60,
            volume_weight=0.00,
            vwap_weight=0.00,
            opening_range_weight=0.00,
            prev_day_levels_weight=0.00,
            risk_reward_weight=0.00,
        )

        with pytest.raises(ValueError, match="Weights must sum to approximately 1.0"):
            IntradayScoringService.calculate_score(
                analysis=analysis,
                current_price=100.0,
                opening_range=opening_range,
                prev_day_levels=prev_day_levels,
                entry_price=100.0,
                stop_loss=98.0,
                target=104.0,
                weights=invalid_weights,
            )
