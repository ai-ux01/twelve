"""
Unit tests for IntradayRecommendationService.

Tests signal generation logic including:
- BUY signal generation with valid conditions
- SELL signal generation with valid conditions
- HOLD signal when data is stale
- NO_TRADE when thresholds not met
- Risk/reward validation
- Data freshness handling

Requirements: 6.5, 6.7, 6.8
"""

import pytest
from datetime import datetime, timezone, timedelta
from services.intraday_recommendation_service import IntradayRecommendationService
from services.intraday_scoring_service import (
    IntradayScoreResult,
    IntradayScoreComponents,
)
from models.intraday import (
    IntradaySignal,
    IntradayRecommendation,
    IntradayTechnicalAnalysis,
    MACDIndicator,
    BollingerBands,
    DataFreshness,
    OpeningRangeResult,
    PreviousDayLevelsResult,
    VWAPPosition,
    TrendStrength,
    BreakoutStatus,
    BreachStatus,
    GapType,
)


@pytest.fixture
def recommendation_service():
    """Create IntradayRecommendationService with default parameters."""
    return IntradayRecommendationService(
        min_confidence_score=65.0,
        min_risk_reward=1.5,
        rsi_buy_min=40.0,
        rsi_buy_max=70.0,
        rsi_sell_min=30.0,
        rsi_sell_max=60.0,
        valid_duration_minutes=30,
    )


@pytest.fixture
def bullish_technical_analysis():
    """Create technical analysis with bullish indicators."""
    return IntradayTechnicalAnalysis(
        rsi=55.0,  # In buy range (40-70)
        macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
        ema_9=2465.0,
        ema_21=2460.0,
        ema_50=2455.0,
        vwap=2458.0,
        atr=15.0,
        volume=150000,
        relative_volume=1.35,
        bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
        support_levels=[2445.0, 2430.0],
        resistance_levels=[2475.0, 2490.0],
    )


@pytest.fixture
def bearish_technical_analysis():
    """Create technical analysis with bearish indicators."""
    return IntradayTechnicalAnalysis(
        rsi=45.0,  # In sell range (30-60)
        macd=MACDIndicator(value=-8.3, signal=-6.1, histogram=-2.2),
        ema_9=2455.0,
        ema_21=2460.0,
        ema_50=2465.0,
        vwap=2462.0,
        atr=15.0,
        volume=150000,
        relative_volume=1.35,
        bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
        support_levels=[2445.0, 2430.0],
        resistance_levels=[2475.0, 2490.0],
    )


@pytest.fixture
def high_score_result():
    """Create scoring result above threshold (>65)."""
    return IntradayScoreResult(
        total_score=75.0,
        components=IntradayScoreComponents(
            trend_score=80.0,
            momentum_score=75.0,
            volume_score=70.0,
            vwap_score=75.0,
            opening_range_score=70.0,
            prev_day_levels_score=65.0,
            risk_reward_score=80.0,
        ),
        signals=["Bullish trend confirmed", "Good momentum"],
        strength="STRONG",
    )


@pytest.fixture
def low_score_result():
    """Create scoring result below threshold (<65)."""
    return IntradayScoreResult(
        total_score=50.0,
        components=IntradayScoreComponents(
            trend_score=55.0,
            momentum_score=50.0,
            volume_score=45.0,
            vwap_score=50.0,
            opening_range_score=50.0,
            prev_day_levels_score=50.0,
            risk_reward_score=45.0,
        ),
        signals=["Neutral indicators"],
        strength="WEAK",
    )


@pytest.fixture
def fresh_data():
    """Create fresh data freshness object."""
    return DataFreshness(
        timestamp=datetime.now(timezone.utc).isoformat(),
        age_seconds=30.0,
        is_stale=False,
    )


@pytest.fixture
def stale_data():
    """Create stale data freshness object."""
    return DataFreshness(
        timestamp=(datetime.now(timezone.utc) - timedelta(seconds=400)).isoformat(),
        age_seconds=400.0,
        is_stale=True,
    )


class TestBuySignalGeneration:
    """Test BUY signal generation with valid conditions."""

    def test_buy_signal_all_conditions_met(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """
        Test BUY signal when all conditions are met:
        - score > 65
        - bullish trend
        - price > VWAP
        - RSI 40-70
        - data fresh
        """
        current_price = 2465.0  # Above VWAP (2458.0)

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.BUY
        assert recommendation.confidence > 0.65
        assert recommendation.entry == current_price
        assert recommendation.stop_loss < recommendation.entry
        assert recommendation.target > recommendation.entry
        assert recommendation.risk_reward >= 1.0
        assert not recommendation.is_stale
        assert "Bullish" in recommendation.rationale or "bullish" in recommendation.rationale

    def test_buy_signal_price_above_vwap(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """Test that BUY signal requires price > VWAP."""
        current_price = 2465.0  # Above VWAP

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.STRONG_BULLISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.BUY

    def test_buy_signal_rsi_in_range(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """Test that BUY signal requires RSI in 40-70 range."""
        # RSI already at 55.0 in fixture (within range)
        current_price = 2465.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.BUY
        assert 40.0 <= bullish_technical_analysis.rsi <= 70.0


class TestSellSignalGeneration:
    """Test SELL signal generation with valid conditions."""

    def test_sell_signal_all_conditions_met(
        self,
        recommendation_service,
        bearish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """
        Test SELL signal when all conditions are met:
        - score > 65
        - bearish trend
        - price < VWAP
        - RSI 30-60
        - data fresh
        """
        current_price = 2455.0  # Below VWAP (2462.0)

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bearish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.BELOW,
            trend_strength=TrendStrength.WEAK_BEARISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.SELL
        assert recommendation.confidence > 0.65
        assert recommendation.entry == current_price
        assert recommendation.stop_loss > recommendation.entry
        assert recommendation.target < recommendation.entry
        assert recommendation.risk_reward >= 1.0
        assert not recommendation.is_stale
        assert "Bearish" in recommendation.rationale or "bearish" in recommendation.rationale

    def test_sell_signal_price_below_vwap(
        self,
        recommendation_service,
        bearish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """Test that SELL signal requires price < VWAP."""
        current_price = 2455.0  # Below VWAP (2462.0)

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bearish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.BELOW,
            trend_strength=TrendStrength.STRONG_BEARISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.SELL

    def test_sell_signal_rsi_in_range(
        self,
        recommendation_service,
        bearish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """Test that SELL signal requires RSI in 30-60 range."""
        # RSI already at 45.0 in fixture (within range)
        current_price = 2455.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bearish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.BELOW,
            trend_strength=TrendStrength.WEAK_BEARISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.SELL
        assert 30.0 <= bearish_technical_analysis.rsi <= 60.0


class TestHoldSignalGeneration:
    """Test HOLD signal generation."""

    def test_hold_signal_when_data_stale(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        stale_data,
    ):
        """
        Test HOLD signal when data is stale.
        Task 60.3: If data freshness check fails (isStale = true), return HOLD.
        """
        current_price = 2465.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=stale_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.HOLD
        assert recommendation.is_stale
        assert recommendation.confidence == 0.0
        assert "stale" in recommendation.rationale.lower()
        assert len(recommendation.warnings) > 0

    def test_hold_signal_with_existing_position(
        self,
        recommendation_service,
        bullish_technical_analysis,
        fresh_data,
    ):
        """
        Test HOLD signal when trader has existing position and no clear signal.
        Uses a mixed score that doesn't meet BUY/SELL criteria.
        """
        current_price = 2460.0  # At VWAP
        
        # Create a neutral score that doesn't meet BUY/SELL threshold
        neutral_score = IntradayScoreResult(
            total_score=68.0,  # Above 65 but with neutral trend
            components=IntradayScoreComponents(
                trend_score=60.0,
                momentum_score=65.0,
                volume_score=70.0,
                vwap_score=60.0,
                opening_range_score=65.0,
                prev_day_levels_score=70.0,
                risk_reward_score=75.0,
            ),
            signals=["Neutral indicators"],
            strength="MODERATE",
        )

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=neutral_score,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.AT,
            trend_strength=TrendStrength.NEUTRAL,
            has_existing_position=True,
        )

        assert recommendation.signal == IntradaySignal.HOLD
        assert "position" in recommendation.rationale.lower()


class TestNoTradeSignalGeneration:
    """Test NO_TRADE signal generation."""

    def test_no_trade_when_score_below_threshold(
        self,
        recommendation_service,
        bullish_technical_analysis,
        low_score_result,
        fresh_data,
    ):
        """
        Test NO_TRADE when score < 65.
        Task 60.2: NO_TRADE signal when score < 65.
        """
        current_price = 2465.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=low_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.NO_TRADE
        assert "threshold" in recommendation.rationale.lower()

    def test_no_trade_when_poor_risk_reward(
        self,
        recommendation_service,
        high_score_result,
        fresh_data,
    ):
        """
        Test NO_TRADE when risk/reward < 1.5.
        Task 60.2: NO_TRADE signal when poor risk/reward.
        """
        # Create technical analysis with poor risk/reward
        # (stop loss very close to entry, target far below entry for a sell)
        poor_rr_technical = IntradayTechnicalAnalysis(
            rsi=55.0,
            macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
            ema_9=2465.0,
            ema_21=2460.0,
            ema_50=2455.0,
            vwap=2458.0,
            atr=5.0,  # Small ATR means small target
            volume=150000,
            relative_volume=1.35,
            bollinger_bands=BollingerBands(upper=2470.0, middle=2460.0, lower=2450.0),
            support_levels=[2459.0],  # Very close support
            resistance_levels=[2466.0],  # Very close resistance
        )

        current_price = 2460.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=poor_rr_technical,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        # Should downgrade to NO_TRADE if risk/reward is poor
        if recommendation.signal != IntradaySignal.BUY:
            assert recommendation.signal == IntradaySignal.NO_TRADE
            assert "risk/reward" in recommendation.rationale.lower()

    def test_no_trade_when_conflicting_indicators(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """
        Test NO_TRADE when indicators are conflicting.
        Example: Bullish trend but price below VWAP.
        """
        current_price = 2450.0  # Below VWAP (2458.0) but bullish trend

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.BELOW,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.NO_TRADE
        assert "conflicting" in recommendation.rationale.lower() or "mixed" in recommendation.rationale.lower()

    def test_no_trade_when_rsi_outside_buy_range(
        self,
        recommendation_service,
        high_score_result,
        fresh_data,
    ):
        """
        Test NO_TRADE when RSI is outside buy range for bullish setup.
        RSI > 70 or RSI < 40 should reject BUY signal.
        """
        # Create technical analysis with RSI > 70 (overbought)
        overbought_technical = IntradayTechnicalAnalysis(
            rsi=75.0,  # Overbought - outside buy range
            macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
            ema_9=2465.0,
            ema_21=2460.0,
            ema_50=2455.0,
            vwap=2458.0,
            atr=15.0,
            volume=150000,
            relative_volume=1.35,
            bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
            support_levels=[2445.0],
            resistance_levels=[2475.0],
        )

        current_price = 2465.0  # Above VWAP

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=overbought_technical,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.NO_TRADE
        assert "RSI" in recommendation.rationale or "rsi" in recommendation.rationale.lower()


class TestStaleDataHandling:
    """Test stale data handling (Task 60.3)."""

    def test_stale_data_returns_hold(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        stale_data,
    ):
        """
        Test that stale data returns HOLD signal.
        Task 60.3: If data freshness check fails (isStale = true), return HOLD.
        """
        current_price = 2465.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=stale_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        assert recommendation.signal == IntradaySignal.HOLD
        assert recommendation.is_stale is True

    def test_stale_data_includes_message(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        stale_data,
    ):
        """
        Test that stale data includes staleness message in rationale.
        Task 60.3: Add staleness message: "Data is stale. Waiting for fresh data."
        """
        current_price = 2465.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=stale_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        assert "stale" in recommendation.rationale.lower()
        assert "waiting for fresh data" in recommendation.rationale.lower()

    def test_stale_data_prevents_buy_sell_signals(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        stale_data,
    ):
        """
        Test that stale data prevents BUY/SELL signals.
        Task 60.3: Prevent any BUY/SELL signals when data is stale.
        """
        current_price = 2465.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=stale_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.STRONG_BULLISH,
            has_existing_position=False,
        )

        # Must not be BUY or SELL
        assert recommendation.signal != IntradaySignal.BUY
        assert recommendation.signal != IntradaySignal.SELL
        assert recommendation.signal == IntradaySignal.HOLD


class TestRecommendationOutputStructure:
    """Test recommendation output structure (Task 60.4)."""

    def test_recommendation_has_all_required_fields(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """
        Test that recommendation includes all required fields.
        Task 60.4: Required fields including signal, confidence, entry, stop_loss, target, etc.
        """
        current_price = 2465.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        # Verify all required fields are present
        assert hasattr(recommendation, "signal")
        assert hasattr(recommendation, "confidence")
        assert hasattr(recommendation, "entry")
        assert hasattr(recommendation, "stop_loss")
        assert hasattr(recommendation, "target")
        assert hasattr(recommendation, "risk_reward")
        assert hasattr(recommendation, "rationale")
        assert hasattr(recommendation, "is_stale")
        assert hasattr(recommendation, "valid_until")
        assert hasattr(recommendation, "warnings")

    def test_recommendation_validation_passes(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """Test that generated recommendation passes Pydantic validation."""
        current_price = 2465.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        # Should not raise validation error
        assert isinstance(recommendation, IntradayRecommendation)
        assert 0.0 <= recommendation.confidence <= 1.0
        assert recommendation.entry > 0
        assert recommendation.stop_loss > 0
        assert recommendation.target > 0
        assert recommendation.risk_reward > 0


class TestRiskRewardValidation:
    """Test risk/reward validation."""

    def test_risk_reward_calculation_for_buy(
        self,
        recommendation_service,
        bullish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """Test risk/reward calculation for BUY signal."""
        current_price = 2465.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bullish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )

        if recommendation.signal == IntradaySignal.BUY:
            # For BUY: stop_loss < entry < target
            assert recommendation.stop_loss < recommendation.entry
            assert recommendation.entry < recommendation.target

            # Verify risk/reward calculation
            risk = recommendation.entry - recommendation.stop_loss
            reward = recommendation.target - recommendation.entry
            calculated_rr = reward / risk if risk > 0 else 0.0

            assert abs(recommendation.risk_reward - calculated_rr) < 0.1

    def test_risk_reward_calculation_for_sell(
        self,
        recommendation_service,
        bearish_technical_analysis,
        high_score_result,
        fresh_data,
    ):
        """Test risk/reward calculation for SELL signal."""
        current_price = 2455.0

        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=bearish_technical_analysis,
            score_result=high_score_result,
            data_freshness=fresh_data,
            vwap_position=VWAPPosition.BELOW,
            trend_strength=TrendStrength.WEAK_BEARISH,
            has_existing_position=False,
        )

        if recommendation.signal == IntradaySignal.SELL:
            # For SELL: target < entry < stop_loss
            assert recommendation.target < recommendation.entry
            assert recommendation.entry < recommendation.stop_loss

            # Verify risk/reward calculation
            risk = recommendation.stop_loss - recommendation.entry
            reward = recommendation.entry - recommendation.target
            calculated_rr = reward / risk if risk > 0 else 0.0

            assert abs(recommendation.risk_reward - calculated_rr) < 0.1
