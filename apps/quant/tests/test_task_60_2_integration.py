"""
Integration test for Task 60.2: Signal Generation Logic.

This test demonstrates the complete workflow of generating intraday
trading signals using IntradayRecommendationService.

Task 60.2 Requirements:
- BUY signal: score > 65, bullish trend, price > VWAP, RSI 40-70, data fresh
- SELL signal: score > 65, bearish trend, price < VWAP, RSI 30-60, data fresh
- HOLD signal: existing position, no clear directional signal, data fresh
- NO_TRADE signal: score < 65 OR poor risk/reward OR data stale OR conflicting indicators

Requirements: 6.7
"""

import pytest
from datetime import datetime, timezone
from services.intraday_recommendation_service import IntradayRecommendationService
from services.intraday_scoring_service import (
    IntradayScoringService,
)
from models.intraday import (
    IntradaySignal,
    IntradayTechnicalAnalysis,
    MACDIndicator,
    BollingerBands,
    DataFreshness,
    VWAPPosition,
    TrendStrength,
)


class TestTask60_2SignalGeneration:
    """Integration test for Task 60.2 signal generation logic."""

    def test_buy_signal_workflow(self):
        """
        Test complete BUY signal generation workflow.
        
        Scenario:
        - Stock price trending above VWAP
        - RSI at 55 (in buy range 40-70)
        - Bullish EMA alignment
        - High confidence score (75)
        - Fresh data
        
        Expected: BUY signal with good risk/reward
        """
        # Setup services
        scoring_service = IntradayScoringService()
        recommendation_service = IntradayRecommendationService()
        
        # Market conditions: Bullish setup
        current_price = 2465.0
        technical_analysis = IntradayTechnicalAnalysis(
            rsi=55.0,  # In buy range
            macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
            ema_9=2465.0,
            ema_21=2460.0,
            ema_50=2455.0,
            vwap=2458.0,  # Price above VWAP
            atr=15.0,
            volume=150000,
            relative_volume=1.35,
            bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
            support_levels=[2445.0, 2430.0],
            resistance_levels=[2520.0, 2540.0],  # Far enough for good R/R
        )
        
        # Calculate score
        score_result = scoring_service.calculate_score(
            current_price=current_price,
            technical_analysis=technical_analysis,
            opening_range=None,
            prev_day_levels=None,
            stop_loss=2445.0,
            target=2520.0,
        )
        
        # Fresh data
        data_freshness = DataFreshness(
            timestamp=datetime.now(timezone.utc).isoformat(),
            age_seconds=30.0,
            is_stale=False,
        )
        
        # Generate recommendation
        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=technical_analysis,
            score_result=score_result,
            data_freshness=data_freshness,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )
        
        # Verify BUY signal conditions (Task 60.2)
        assert recommendation.signal == IntradaySignal.BUY
        assert recommendation.confidence > 0.65
        assert recommendation.entry == current_price
        assert recommendation.stop_loss < recommendation.entry
        assert recommendation.target > recommendation.entry
        assert recommendation.risk_reward >= 1.5  # Minimum intraday R/R
        assert not recommendation.is_stale
        print(f"\n✓ BUY Signal Generated:")
        print(f"  Entry: {recommendation.entry}")
        print(f"  Stop Loss: {recommendation.stop_loss}")
        print(f"  Target: {recommendation.target}")
        print(f"  Risk/Reward: {recommendation.risk_reward:.2f}:1")
        print(f"  Confidence: {recommendation.confidence:.2%}")

    def test_sell_signal_workflow(self):
        """
        Test complete SELL signal generation workflow.
        
        Scenario:
        - Stock price trending below VWAP
        - RSI at 45 (in sell range 30-60)
        - Bearish EMA alignment
        - High confidence score (75)
        - Fresh data
        
        Expected: SELL signal with good risk/reward
        """
        # Setup services
        scoring_service = IntradayScoringService()
        recommendation_service = IntradayRecommendationService()
        
        # Market conditions: Bearish setup
        current_price = 2455.0
        technical_analysis = IntradayTechnicalAnalysis(
            rsi=45.0,  # In sell range
            macd=MACDIndicator(value=-8.3, signal=-6.1, histogram=-2.2),
            ema_9=2455.0,
            ema_21=2460.0,
            ema_50=2465.0,
            vwap=2462.0,  # Price below VWAP
            atr=15.0,
            volume=150000,
            relative_volume=1.35,
            bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
            support_levels=[2400.0, 2380.0],  # Far enough for good R/R
            resistance_levels=[2475.0, 2490.0],
        )
        
        # Calculate score
        score_result = scoring_service.calculate_score(
            current_price=current_price,
            technical_analysis=technical_analysis,
            opening_range=None,
            prev_day_levels=None,
            stop_loss=2475.0,
            target=2400.0,
        )
        
        # Fresh data
        data_freshness = DataFreshness(
            timestamp=datetime.now(timezone.utc).isoformat(),
            age_seconds=30.0,
            is_stale=False,
        )
        
        # Generate recommendation
        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=technical_analysis,
            score_result=score_result,
            data_freshness=data_freshness,
            vwap_position=VWAPPosition.BELOW,
            trend_strength=TrendStrength.WEAK_BEARISH,
            has_existing_position=False,
        )
        
        # Verify SELL signal conditions (Task 60.2)
        assert recommendation.signal == IntradaySignal.SELL
        assert recommendation.confidence > 0.65
        assert recommendation.entry == current_price
        assert recommendation.stop_loss > recommendation.entry
        assert recommendation.target < recommendation.entry
        assert recommendation.risk_reward >= 1.5
        assert not recommendation.is_stale
        print(f"\n✓ SELL Signal Generated:")
        print(f"  Entry: {recommendation.entry}")
        print(f"  Stop Loss: {recommendation.stop_loss}")
        print(f"  Target: {recommendation.target}")
        print(f"  Risk/Reward: {recommendation.risk_reward:.2f}:1")
        print(f"  Confidence: {recommendation.confidence:.2%}")

    def test_no_trade_workflow(self):
        """
        Test NO_TRADE signal when score below threshold.
        
        Scenario:
        - Low confidence score (50 < 65)
        - Neutral indicators
        - Fresh data
        
        Expected: NO_TRADE signal
        """
        # Setup services
        scoring_service = IntradayScoringService()
        recommendation_service = IntradayRecommendationService()
        
        # Market conditions: Neutral/weak setup
        current_price = 2460.0
        technical_analysis = IntradayTechnicalAnalysis(
            rsi=50.0,  # Neutral
            macd=MACDIndicator(value=1.0, signal=0.8, histogram=0.2),
            ema_9=2460.0,
            ema_21=2459.0,
            ema_50=2461.0,
            vwap=2460.0,
            atr=10.0,
            volume=100000,
            relative_volume=0.9,  # Below average
            bollinger_bands=BollingerBands(upper=2475.0, middle=2460.0, lower=2445.0),
            support_levels=[2445.0],
            resistance_levels=[2475.0],
        )
        
        # Calculate score
        score_result = scoring_service.calculate_score(
            current_price=current_price,
            technical_analysis=technical_analysis,
            opening_range=None,
            prev_day_levels=None,
            stop_loss=2445.0,
            target=2475.0,
        )
        
        # Fresh data
        data_freshness = DataFreshness(
            timestamp=datetime.now(timezone.utc).isoformat(),
            age_seconds=30.0,
            is_stale=False,
        )
        
        # Generate recommendation
        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=technical_analysis,
            score_result=score_result,
            data_freshness=data_freshness,
            vwap_position=VWAPPosition.AT,
            trend_strength=TrendStrength.NEUTRAL,
            has_existing_position=False,
        )
        
        # Verify NO_TRADE signal (Task 60.2)
        assert recommendation.signal == IntradaySignal.NO_TRADE
        assert "threshold" in recommendation.rationale.lower() or score_result.total_score < 65.0
        print(f"\n✓ NO_TRADE Signal Generated:")
        print(f"  Reason: {recommendation.rationale[:100]}...")
        print(f"  Score: {score_result.total_score}")

    def test_hold_signal_stale_data_workflow(self):
        """
        Test HOLD signal when data is stale (Task 60.3).
        
        Scenario:
        - Data age > 300 seconds (stale)
        - Otherwise good setup
        
        Expected: HOLD signal with stale data message
        """
        # Setup services
        scoring_service = IntradayScoringService()
        recommendation_service = IntradayRecommendationService()
        
        # Market conditions: Good setup but stale data
        current_price = 2465.0
        technical_analysis = IntradayTechnicalAnalysis(
            rsi=55.0,
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
            resistance_levels=[2520.0],
        )
        
        # Calculate score
        score_result = scoring_service.calculate_score(
            current_price=current_price,
            technical_analysis=technical_analysis,
            opening_range=None,
            prev_day_levels=None,
            stop_loss=2445.0,
            target=2520.0,
        )
        
        # Stale data (400 seconds old)
        data_freshness = DataFreshness(
            timestamp="2024-01-15T10:00:00Z",
            age_seconds=400.0,
            is_stale=True,
        )
        
        # Generate recommendation
        recommendation = recommendation_service.generate_recommendation(
            current_price=current_price,
            technical_analysis=technical_analysis,
            score_result=score_result,
            data_freshness=data_freshness,
            vwap_position=VWAPPosition.ABOVE,
            trend_strength=TrendStrength.WEAK_BULLISH,
            has_existing_position=False,
        )
        
        # Verify HOLD signal with stale data (Task 60.3)
        assert recommendation.signal == IntradaySignal.HOLD
        assert recommendation.is_stale
        assert "stale" in recommendation.rationale.lower()
        assert "waiting for fresh data" in recommendation.rationale.lower()
        assert recommendation.confidence == 0.0
        print(f"\n✓ HOLD Signal Generated (Stale Data):")
        print(f"  Reason: {recommendation.rationale}")
        print(f"  Data Age: {data_freshness.age_seconds}s")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
