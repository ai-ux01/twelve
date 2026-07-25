"""
Unit tests for intraday price action analysis.

Tests the analyze_price_action method in IntradayAnalysisService,
verifying VWAP position analysis, EMA crossover detection, RSI divergence
detection, and trend strength calculation.

Requirements: 6.2
"""

import pytest
from datetime import datetime, timezone, timedelta
from models import OHLCVData
from models.intraday import (
    IntradayTechnicalAnalysis,
    MACDIndicator,
    BollingerBands,
    VWAPPosition,
    EMACrossover,
    TrendStrength,
)
from services.intraday_analysis_service import IntradayAnalysisService


@pytest.fixture
def intraday_service():
    """Create IntradayAnalysisService instance."""
    return IntradayAnalysisService()


@pytest.fixture
def sample_ohlcv_data():
    """Create sample OHLCV data for testing."""
    base_time = datetime(2024, 1, 15, 9, 15, tzinfo=timezone.utc)
    data = []
    
    # Generate 50 candles with uptrend
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
    
    return data


@pytest.fixture
def sample_technical_analysis():
    """Create sample technical analysis data."""
    return IntradayTechnicalAnalysis(
        rsi=58.5,
        macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
        ema_9=2495.0,
        ema_21=2490.0,
        ema_50=2485.0,
        vwap=2488.0,
        atr=15.5,
        volume=150000,
        relative_volume=1.35,
        bollinger_bands=BollingerBands(upper=2510.0, middle=2490.0, lower=2470.0),
        support_levels=[2470.0, 2480.0],
        resistance_levels=[2500.0, 2510.0],
    )


def test_analyze_price_action_basic(intraday_service, sample_ohlcv_data, sample_technical_analysis):
    """Test basic price action analysis."""
    result = intraday_service.analyze_price_action(
        data=sample_ohlcv_data,
        technical_analysis=sample_technical_analysis,
    )
    
    # Verify result structure
    assert result.current_price > 0
    assert result.vwap > 0
    assert result.vwap_position in [VWAPPosition.ABOVE, VWAPPosition.BELOW, VWAPPosition.AT]
    assert isinstance(result.vwap_distance_percent, float)
    assert result.ema_fast > 0
    assert result.ema_slow > 0
    assert result.ema_crossover in [EMACrossover.BULLISH, EMACrossover.BEARISH, EMACrossover.NONE]
    assert isinstance(result.ema_alignment, bool)
    assert 0 <= result.rsi <= 100
    assert isinstance(result.rsi_divergence_detected, bool)
    assert result.rsi_trend in ["RISING", "FALLING", "NEUTRAL"]
    assert result.trend_strength in list(TrendStrength)
    assert 0 <= result.trend_score <= 100
    assert 0 <= result.momentum_score <= 100
    assert isinstance(result.signals, list)


def test_vwap_position_above(intraday_service, sample_ohlcv_data):
    """Test VWAP position when price is above VWAP."""
    # Create technical analysis with current price above VWAP
    tech_analysis = IntradayTechnicalAnalysis(
        rsi=60.0,
        macd=MACDIndicator(value=5.0, signal=3.0, histogram=2.0),
        ema_9=2500.0,
        ema_21=2495.0,
        ema_50=2490.0,
        vwap=2480.0,  # VWAP below current price
        atr=10.0,
        volume=100000,
        relative_volume=1.2,
        bollinger_bands=BollingerBands(upper=2510.0, middle=2490.0, lower=2470.0),
    )
    
    result = intraday_service.analyze_price_action(
        data=sample_ohlcv_data,
        technical_analysis=tech_analysis,
    )
    
    # Current price from sample_ohlcv_data is around 2498 (last candle)
    assert result.vwap_position == VWAPPosition.ABOVE
    assert result.vwap_distance_percent > 0


def test_vwap_position_below(intraday_service, sample_ohlcv_data):
    """Test VWAP position when price is below VWAP."""
    # Create technical analysis with current price below VWAP
    tech_analysis = IntradayTechnicalAnalysis(
        rsi=40.0,
        macd=MACDIndicator(value=-5.0, signal=-3.0, histogram=-2.0),
        ema_9=2490.0,
        ema_21=2495.0,
        ema_50=2500.0,
        vwap=2510.0,  # VWAP above current price
        atr=10.0,
        volume=100000,
        relative_volume=0.8,
        bollinger_bands=BollingerBands(upper=2510.0, middle=2490.0, lower=2470.0),
    )
    
    result = intraday_service.analyze_price_action(
        data=sample_ohlcv_data,
        technical_analysis=tech_analysis,
    )
    
    assert result.vwap_position == VWAPPosition.BELOW
    assert result.vwap_distance_percent < 0


def test_ema_alignment_bullish(intraday_service, sample_ohlcv_data):
    """Test EMA alignment in bullish scenario."""
    tech_analysis = IntradayTechnicalAnalysis(
        rsi=65.0,
        macd=MACDIndicator(value=8.0, signal=5.0, histogram=3.0),
        ema_9=2500.0,  # Fast EMA above slow
        ema_21=2495.0,
        ema_50=2490.0,
        vwap=2488.0,
        atr=10.0,
        volume=100000,
        relative_volume=1.5,
        bollinger_bands=BollingerBands(upper=2510.0, middle=2490.0, lower=2470.0),
    )
    
    result = intraday_service.analyze_price_action(
        data=sample_ohlcv_data,
        technical_analysis=tech_analysis,
    )
    
    # In uptrend (price above VWAP), EMAs should be aligned (fast > slow)
    assert result.ema_alignment is True


def test_trend_strength_strong_bullish(intraday_service, sample_ohlcv_data):
    """Test trend strength calculation for strong bullish trend."""
    tech_analysis = IntradayTechnicalAnalysis(
        rsi=70.0,
        macd=MACDIndicator(value=15.0, signal=10.0, histogram=5.0),
        ema_9=2500.0,
        ema_21=2495.0,
        ema_50=2490.0,
        vwap=2485.0,
        atr=10.0,
        volume=200000,
        relative_volume=2.0,
        bollinger_bands=BollingerBands(upper=2510.0, middle=2490.0, lower=2470.0),
    )
    
    result = intraday_service.analyze_price_action(
        data=sample_ohlcv_data,
        technical_analysis=tech_analysis,
    )
    
    # Strong bullish conditions: price > VWAP, EMAs aligned, RSI > 60, MACD positive
    assert result.trend_strength in [TrendStrength.STRONG_BULLISH, TrendStrength.WEAK_BULLISH]
    assert result.trend_score > 50


def test_trend_strength_bearish(intraday_service, sample_ohlcv_data):
    """Test trend strength calculation for bearish trend."""
    tech_analysis = IntradayTechnicalAnalysis(
        rsi=35.0,
        macd=MACDIndicator(value=-10.0, signal=-5.0, histogram=-5.0),
        ema_9=2480.0,
        ema_21=2485.0,
        ema_50=2490.0,
        vwap=2495.0,
        atr=10.0,
        volume=80000,
        relative_volume=0.7,
        bollinger_bands=BollingerBands(upper=2510.0, middle=2490.0, lower=2470.0),
    )
    
    result = intraday_service.analyze_price_action(
        data=sample_ohlcv_data,
        technical_analysis=tech_analysis,
    )
    
    # Bearish conditions: price < VWAP, EMAs inverted, RSI < 40, MACD negative
    assert result.trend_strength in [TrendStrength.WEAK_BEARISH, TrendStrength.STRONG_BEARISH]
    assert result.trend_score < 50


def test_momentum_score_high_momentum(intraday_service, sample_ohlcv_data):
    """Test momentum score calculation with high momentum."""
    tech_analysis = IntradayTechnicalAnalysis(
        rsi=72.0,
        macd=MACDIndicator(value=12.0, signal=8.0, histogram=4.0),
        ema_9=2500.0,
        ema_21=2495.0,
        ema_50=2490.0,
        vwap=2488.0,
        atr=10.0,
        volume=250000,
        relative_volume=2.5,
        bollinger_bands=BollingerBands(upper=2510.0, middle=2490.0, lower=2470.0),
    )
    
    result = intraday_service.analyze_price_action(
        data=sample_ohlcv_data,
        technical_analysis=tech_analysis,
    )
    
    # High RSI, positive MACD, high volume = high momentum
    assert result.momentum_score > 70


def test_signals_generation(intraday_service, sample_ohlcv_data, sample_technical_analysis):
    """Test that signals are generated correctly."""
    result = intraday_service.analyze_price_action(
        data=sample_ohlcv_data,
        technical_analysis=sample_technical_analysis,
    )
    
    # Verify signals list is populated
    assert len(result.signals) > 0
    assert all(isinstance(signal, str) for signal in result.signals)
    
    # Check for expected signal types
    signal_text = " ".join(result.signals)
    assert any(keyword in signal_text.lower() for keyword in ["vwap", "ema", "rsi", "trend"])


def test_insufficient_data_raises_error(intraday_service, sample_technical_analysis):
    """Test that insufficient data raises ValueError."""
    # Create data with less than 10 candles
    base_time = datetime(2024, 1, 15, 9, 15, tzinfo=timezone.utc)
    insufficient_data = [
        OHLCVData(
            timestamp=base_time + timedelta(minutes=i * 5),
            open=2400.0,
            high=2405.0,
            low=2395.0,
            close=2402.0,
            volume=100000,
        )
        for i in range(5)
    ]
    
    with pytest.raises(ValueError, match="Insufficient data for price action analysis"):
        intraday_service.analyze_price_action(
            data=insufficient_data,
            technical_analysis=sample_technical_analysis,
        )


def test_rsi_trend_rising(intraday_service):
    """Test RSI trend detection - rising."""
    base_time = datetime(2024, 1, 15, 9, 15, tzinfo=timezone.utc)
    
    # Create data with rising prices (should result in rising RSI)
    data = []
    for i in range(30):
        price = 2400 + i * 5  # Steadily increasing
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=price,
                high=price + 3,
                low=price - 2,
                close=price + 2,
                volume=100000,
            )
        )
    
    rsi_trend = intraday_service._calculate_rsi_trend(data, lookback_periods=3)
    assert rsi_trend in ["RISING", "NEUTRAL"]  # Should be rising for uptrend


def test_rsi_trend_falling(intraday_service):
    """Test RSI trend detection - falling."""
    base_time = datetime(2024, 1, 15, 9, 15, tzinfo=timezone.utc)
    
    # Create data with falling prices (should result in falling RSI)
    data = []
    for i in range(30):
        price = 2500 - i * 5  # Steadily decreasing
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=price,
                high=price + 2,
                low=price - 3,
                close=price - 2,
                volume=100000,
            )
        )
    
    rsi_trend = intraday_service._calculate_rsi_trend(data, lookback_periods=3)
    assert rsi_trend in ["FALLING", "NEUTRAL"]  # Should be falling for downtrend


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
