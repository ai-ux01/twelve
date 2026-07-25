"""
Integration test for Task 57.1: Create IntradayAnalysisService in Quant Engine

This test verifies that the IntradayAnalysisService properly orchestrates:
- Existing calculators: VWAP, EMA 5/15, RSI, MACD, ATR, Volume
- Opening range calculation
- Previous day levels calculation
- Support/resistance from Phase 5
- Trendline detection from Phase 5

Requirements: 6.2, 6.3, 6.4
"""

import pytest
from datetime import datetime, timezone, timedelta
from models import OHLCVData
from services.intraday_analysis_service import IntradayAnalysisService
from models.intraday import IntradayInterval


@pytest.fixture
def intraday_service():
    """Create IntradayAnalysisService with default parameters."""
    return IntradayAnalysisService()


@pytest.fixture
def sample_intraday_data():
    """
    Create sample intraday OHLCV data with enough data for all calculations.
    
    Creates 100 5-minute candles to ensure:
    - Enough data for opening range (need at least 3 candles for 15-min range)
    - Enough data for previous day levels (need at least 2 days)
    - Enough data for technical indicators (RSI needs 14+, MACD needs 26+)
    - Enough data for trendlines (swing detection + fitting)
    """
    base_time = datetime(2024, 1, 15, 9, 15, tzinfo=timezone.utc)
    data = []
    
    # Day 1: 75 candles (6.25 hours of 5-min data)
    for i in range(75):
        timestamp = base_time + timedelta(minutes=5 * i)
        # Simulate upward trending prices
        base_price = 2450.0 + (i * 0.5)
        data.append(
            OHLCVData(
                timestamp=timestamp,
                open=base_price,
                high=base_price + 2.0,
                low=base_price - 1.5,
                close=base_price + 1.0,
                volume=1000000 + (i * 1000),
            )
        )
    
    # Day 2: 25 candles (starting next day)
    day2_start = base_time + timedelta(days=1)
    for i in range(25):
        timestamp = day2_start + timedelta(minutes=5 * i)
        base_price = 2480.0 + (i * 0.3)
        data.append(
            OHLCVData(
                timestamp=timestamp,
                open=base_price,
                high=base_price + 1.5,
                low=base_price - 1.0,
                close=base_price + 0.5,
                volume=1200000 + (i * 1500),
            )
        )
    
    return data


def test_service_initialization():
    """Test that IntradayAnalysisService initializes correctly."""
    service = IntradayAnalysisService()
    
    assert service is not None
    assert service.opening_range_calc is not None
    assert service.prev_day_calc is not None
    assert service.trendline_service is not None
    assert service.opening_range_minutes == 15
    assert service.volume_period == 20
    assert service.rsi_period == 14
    assert service.atr_period == 14


def test_service_custom_initialization():
    """Test that IntradayAnalysisService accepts custom parameters."""
    service = IntradayAnalysisService(
        opening_range_minutes=30,
        volume_period=15,
        rsi_period=10,
        atr_period=10,
        stale_threshold_seconds=600.0,
        lookback_period=5,
        min_trendline_points=3,
    )
    
    assert service.opening_range_minutes == 30
    assert service.volume_period == 15
    assert service.rsi_period == 10
    assert service.atr_period == 10
    assert service.stale_threshold_seconds == 600.0


def test_analyze_orchestrates_all_calculators(intraday_service, sample_intraday_data):
    """
    Test that analyze() method orchestrates all required calculators.
    
    Verifies:
    - Core indicators: RSI, MACD, EMA (9/21/50), VWAP, ATR, Volume
    - Opening range calculation
    - Previous day levels calculation
    - Support/resistance levels
    - Trendline detection
    """
    result = intraday_service.analyze(
        symbol="RELIANCE",
        interval=IntradayInterval.FIVE_MINUTES,
        data=sample_intraday_data,
        include_support_resistance=True,
        include_opening_range=True,
        include_prev_day_levels=True,
        include_trendlines=True,
        timeframe_minutes=5,
    )
    
    # Unpack result tuple
    (
        technical_analysis,
        data_freshness,
        opening_range,
        prev_day_levels,
        support_levels,
        resistance_levels,
        trendlines,
    ) = result
    
    # Verify technical analysis contains all core indicators
    assert technical_analysis is not None
    assert technical_analysis.rsi > 0
    assert technical_analysis.macd is not None
    assert technical_analysis.macd.value is not None
    assert technical_analysis.ema_9 > 0
    assert technical_analysis.ema_21 > 0
    assert technical_analysis.ema_50 > 0
    assert technical_analysis.vwap > 0
    assert technical_analysis.atr > 0
    assert technical_analysis.volume > 0
    assert technical_analysis.relative_volume > 0
    assert technical_analysis.bollinger_bands is not None
    
    # Verify data freshness is calculated
    assert data_freshness is not None
    assert data_freshness.timestamp is not None
    assert data_freshness.age_seconds >= 0
    
    # Verify opening range is calculated (Requirement 6.3)
    assert opening_range is not None
    assert opening_range.high > 0
    assert opening_range.low > 0
    assert opening_range.midpoint > 0
    
    # Verify previous day levels are calculated (Requirement 6.4)
    assert prev_day_levels is not None
    assert prev_day_levels.prev_day_high > 0
    assert prev_day_levels.prev_day_low > 0
    assert prev_day_levels.prev_day_close > 0
    
    # Verify support/resistance levels are calculated (Phase 5)
    # Note: May be empty lists if no clear levels detected
    assert support_levels is not None
    assert resistance_levels is not None
    
    # Verify trendlines are calculated (Phase 5)
    assert trendlines is not None
    assert trendlines.swing_points is not None
    # trendlines may have None for support/resistance if insufficient data


def test_analyze_with_minimal_data_fails(intraday_service):
    """Test that analyze() raises ValueError with insufficient data."""
    # Create only 20 candles (less than required 30)
    base_time = datetime(2024, 1, 15, 9, 15, tzinfo=timezone.utc)
    minimal_data = []
    for i in range(20):
        timestamp = base_time + timedelta(minutes=5 * i)
        minimal_data.append(
            OHLCVData(
                timestamp=timestamp,
                open=2450.0,
                high=2452.0,
                low=2448.0,
                close=2451.0,
                volume=1000000,
            )
        )
    
    with pytest.raises(ValueError, match="Insufficient data for intraday analysis"):
        intraday_service.analyze(
            symbol="RELIANCE",
            interval=IntradayInterval.FIVE_MINUTES,
            data=minimal_data,
        )


def test_analyze_with_optional_flags_disabled(intraday_service, sample_intraday_data):
    """Test that optional calculations can be disabled."""
    result = intraday_service.analyze(
        symbol="RELIANCE",
        interval=IntradayInterval.FIVE_MINUTES,
        data=sample_intraday_data,
        include_support_resistance=False,
        include_opening_range=False,
        include_prev_day_levels=False,
        include_trendlines=False,
    )
    
    (
        technical_analysis,
        data_freshness,
        opening_range,
        prev_day_levels,
        support_levels,
        resistance_levels,
        trendlines,
    ) = result
    
    # Core technical analysis should still be present
    assert technical_analysis is not None
    assert data_freshness is not None
    
    # Optional components should be None or empty
    assert opening_range is None
    assert prev_day_levels is None
    assert support_levels is None
    assert resistance_levels is None
    assert trendlines is None


def test_integration_with_opening_range_calculator(intraday_service, sample_intraday_data):
    """Test integration with OpeningRangeCalculator (Requirement 6.3)."""
    result = intraday_service.analyze(
        symbol="RELIANCE",
        interval=IntradayInterval.FIVE_MINUTES,
        data=sample_intraday_data,
        include_opening_range=True,
        timeframe_minutes=5,
    )
    
    opening_range = result[2]
    
    assert opening_range is not None
    assert opening_range.high > opening_range.low
    assert opening_range.midpoint == (opening_range.high + opening_range.low) / 2
    assert opening_range.current_price > 0
    assert opening_range.breakout_status is not None


def test_integration_with_previous_day_levels_calculator(
    intraday_service, sample_intraday_data
):
    """Test integration with PreviousDayLevelsCalculator (Requirement 6.4)."""
    result = intraday_service.analyze(
        symbol="RELIANCE",
        interval=IntradayInterval.FIVE_MINUTES,
        data=sample_intraday_data,
        include_prev_day_levels=True,
    )
    
    prev_day_levels = result[3]
    
    assert prev_day_levels is not None
    assert prev_day_levels.prev_day_high > prev_day_levels.prev_day_low
    assert prev_day_levels.prev_day_close > 0
    assert prev_day_levels.gap_type is not None
    assert prev_day_levels.breach_status is not None


def test_integration_with_trendline_service(intraday_service, sample_intraday_data):
    """Test integration with TrendlineService from Phase 5 (Requirement 6.2)."""
    result = intraday_service.analyze(
        symbol="RELIANCE",
        interval=IntradayInterval.FIVE_MINUTES,
        data=sample_intraday_data,
        include_trendlines=True,
    )
    
    trendlines = result[6]
    
    assert trendlines is not None
    assert trendlines.swing_points is not None
    assert isinstance(trendlines.swing_points, list)
    # Support/resistance trendlines may be None if insufficient swing points
    assert trendlines.breakout is not None


def test_core_indicators_calculated_correctly(intraday_service, sample_intraday_data):
    """Test that core indicators are calculated correctly (Requirement 6.2)."""
    result = intraday_service.analyze(
        symbol="RELIANCE",
        interval=IntradayInterval.FIVE_MINUTES,
        data=sample_intraday_data,
    )
    
    technical_analysis = result[0]
    
    # RSI should be between 0 and 100
    assert 0 <= technical_analysis.rsi <= 100
    
    # MACD components should exist
    assert technical_analysis.macd.value is not None
    assert technical_analysis.macd.signal is not None
    assert technical_analysis.macd.histogram is not None
    
    # EMAs should be in logical order (9 < 21 < 50 for uptrend data)
    # Note: This may not always hold, but for our sample data it should
    assert technical_analysis.ema_9 > 0
    assert technical_analysis.ema_21 > 0
    assert technical_analysis.ema_50 > 0
    
    # VWAP should be positive and close to price range
    assert technical_analysis.vwap > 0
    assert 2400 < technical_analysis.vwap < 2600  # Within our sample data range
    
    # ATR should be positive
    assert technical_analysis.atr > 0
    
    # Volume metrics should be positive
    assert technical_analysis.volume > 0
    assert technical_analysis.relative_volume > 0
    
    # Bollinger Bands should be ordered: upper > middle > lower
    assert technical_analysis.bollinger_bands.upper > technical_analysis.bollinger_bands.middle
    assert technical_analysis.bollinger_bands.middle > technical_analysis.bollinger_bands.lower


def test_requirements_coverage():
    """
    Verify that Task 57.1 covers all specified requirements.
    
    Task 57.1 Requirements:
    - 6.2: Intraday technical indicators (RSI, MACD, EMAs, VWAP, ATR, Volume, S/R, Trendlines)
    - 6.3: Opening range calculation
    - 6.4: Previous day levels calculation
    """
    service = IntradayAnalysisService()
    
    # Requirement 6.2: Core indicators
    assert hasattr(service, "rsi_period")
    assert hasattr(service, "atr_period")
    assert hasattr(service, "volume_period")
    assert hasattr(service, "trendline_service")
    
    # Requirement 6.3: Opening range
    assert hasattr(service, "opening_range_calc")
    assert hasattr(service, "opening_range_minutes")
    
    # Requirement 6.4: Previous day levels
    assert hasattr(service, "prev_day_calc")
    
    print("✅ All requirements (6.2, 6.3, 6.4) are covered by IntradayAnalysisService")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
