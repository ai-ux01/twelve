"""
Integration test for Task 57.2: Intraday Price Action Analysis.

Demonstrates the integration of analyze_price_action with the existing
IntradayAnalysisService.analyze method.

Requirements: 6.2
"""

import pytest
from datetime import datetime, timezone, timedelta
from models import OHLCVData
from models.intraday import IntradayInterval, VWAPPosition, EMACrossover, TrendStrength
from services.intraday_analysis_service import IntradayAnalysisService


def test_price_action_integration_with_analyze():
    """Test that price action analysis integrates with analyze method."""
    # Create service
    service = IntradayAnalysisService()
    
    # Generate realistic intraday data (50 candles, 5-minute interval)
    base_time = datetime(2024, 1, 15, 9, 15, tzinfo=timezone.utc)
    data = []
    
    for i in range(50):
        base_price = 2400 + i * 2  # Uptrend
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=base_price,
                high=base_price + 5,
                low=base_price - 3,
                close=base_price + 2,
                volume=100000 + i * 1000,
            )
        )
    
    # Run full analysis
    (
        technical_analysis,
        data_freshness,
        opening_range,
        prev_day_levels,
        support_levels,
        resistance_levels,
        trendlines,
    ) = service.analyze(
        symbol="RELIANCE",
        interval=IntradayInterval.FIVE_MINUTES,
        data=data,
        include_support_resistance=True,
        include_opening_range=True,
        include_prev_day_levels=False,  # Skip prev day for this test
        include_trendlines=True,
        timeframe_minutes=5,
    )
    
    # Now analyze price action using the technical analysis results
    price_action = service.analyze_price_action(
        data=data,
        technical_analysis=technical_analysis,
        lookback_periods=5,
    )
    
    # Verify price action result structure
    assert price_action.current_price > 0
    assert price_action.vwap > 0
    assert price_action.vwap_position in [VWAPPosition.ABOVE, VWAPPosition.BELOW, VWAPPosition.AT]
    assert isinstance(price_action.vwap_distance_percent, float)
    
    # Verify EMA values match technical analysis
    assert price_action.ema_fast == technical_analysis.ema_9
    assert price_action.ema_slow == technical_analysis.ema_21
    
    # Verify RSI matches
    assert price_action.rsi == technical_analysis.rsi
    
    # Verify trend strength calculation
    assert price_action.trend_strength in list(TrendStrength)
    assert 0 <= price_action.trend_score <= 100
    assert 0 <= price_action.momentum_score <= 100
    
    # Verify signals are generated
    assert len(price_action.signals) > 0
    
    # For uptrend data, we expect bullish signals
    assert price_action.vwap_position == VWAPPosition.ABOVE
    assert price_action.ema_fast > price_action.ema_slow
    assert price_action.trend_strength in [TrendStrength.WEAK_BULLISH, TrendStrength.STRONG_BULLISH]
    
    print(f"\n✅ Price Action Analysis Results:")
    print(f"   Current Price: {price_action.current_price:.2f}")
    print(f"   VWAP: {price_action.vwap:.2f}")
    print(f"   VWAP Position: {price_action.vwap_position.value}")
    print(f"   VWAP Distance: {price_action.vwap_distance_percent:.2f}%")
    print(f"   EMA Fast (9): {price_action.ema_fast:.2f}")
    print(f"   EMA Slow (21): {price_action.ema_slow:.2f}")
    print(f"   EMA Crossover: {price_action.ema_crossover.value}")
    print(f"   EMA Alignment: {price_action.ema_alignment}")
    print(f"   RSI: {price_action.rsi:.2f}")
    print(f"   RSI Divergence: {price_action.rsi_divergence_detected}")
    print(f"   RSI Trend: {price_action.rsi_trend}")
    print(f"   Trend Strength: {price_action.trend_strength.value}")
    print(f"   Trend Score: {price_action.trend_score:.2f}")
    print(f"   Momentum Score: {price_action.momentum_score:.2f}")
    print(f"   Signals: {len(price_action.signals)}")
    for signal in price_action.signals:
        print(f"     - {signal}")


def test_price_action_with_downtrend():
    """Test price action analysis with downtrend data."""
    service = IntradayAnalysisService()
    
    # Generate downtrend data
    base_time = datetime(2024, 1, 15, 9, 15, tzinfo=timezone.utc)
    data = []
    
    for i in range(50):
        base_price = 2500 - i * 2  # Downtrend
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=base_price,
                high=base_price + 3,
                low=base_price - 5,
                close=base_price - 2,
                volume=100000 + i * 1000,
            )
        )
    
    # Run analysis
    (
        technical_analysis,
        data_freshness,
        opening_range,
        prev_day_levels,
        support_levels,
        resistance_levels,
        trendlines,
    ) = service.analyze(
        symbol="RELIANCE",
        interval=IntradayInterval.FIVE_MINUTES,
        data=data,
        timeframe_minutes=5,
    )
    
    # Analyze price action
    price_action = service.analyze_price_action(
        data=data,
        technical_analysis=technical_analysis,
    )
    
    # For downtrend, we expect bearish characteristics
    assert price_action.vwap_position == VWAPPosition.BELOW
    assert price_action.ema_fast < price_action.ema_slow
    assert price_action.trend_strength in [TrendStrength.WEAK_BEARISH, TrendStrength.STRONG_BEARISH]
    
    print(f"\n✅ Downtrend Price Action Results:")
    print(f"   VWAP Position: {price_action.vwap_position.value}")
    print(f"   Trend Strength: {price_action.trend_strength.value}")
    print(f"   Trend Score: {price_action.trend_score:.2f}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
