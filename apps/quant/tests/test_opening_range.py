"""Unit tests for opening range calculator."""

import pytest
from datetime import datetime, timedelta
from models import OHLCVData
from models.intraday import BreakoutStatus, OpeningRangeResult
from calculators.opening_range import OpeningRangeCalculator


def create_test_candles(num_candles: int, base_price: float = 100.0) -> list[OHLCVData]:
    """Helper to create test OHLCV candles."""
    candles = []
    base_time = datetime(2024, 1, 15, 9, 15)  # Market open
    
    for i in range(num_candles):
        candles.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=5 * i),
                open=base_price + i,
                high=base_price + i + 1,
                low=base_price + i - 1,
                close=base_price + i + 0.5,
                volume=1000000,
            )
        )
    
    return candles


class TestOpeningRangeCalculator:
    """Test suite for OpeningRangeCalculator."""

    def test_initialization_default(self):
        """Test calculator initialization with default period."""
        calc = OpeningRangeCalculator()
        assert calc.period_minutes == 15

    def test_initialization_custom_period(self):
        """Test calculator initialization with custom period."""
        calc = OpeningRangeCalculator(period_minutes=30)
        assert calc.period_minutes == 30

    def test_initialization_invalid_period(self):
        """Test that invalid period raises ValueError."""
        with pytest.raises(ValueError, match="period_minutes must be at least 1"):
            OpeningRangeCalculator(period_minutes=0)

    def test_calculate_opening_range_basic(self):
        """Test basic opening range calculation."""
        # Create test data: 3 candles for 15-minute opening range (5-min candles)
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=100.0,
                high=105.0,
                low=98.0,
                close=102.0,
                volume=1000000,
            ),
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 20),
                open=102.0,
                high=107.0,
                low=101.0,
                close=106.0,
                volume=1200000,
            ),
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 25),
                open=106.0,
                high=108.0,
                low=104.0,
                close=107.0,
                volume=1100000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=15)
        result = calc.calculate_opening_range(candles, timeframe_minutes=5)
        
        # Opening range should be the high/low of first 3 candles
        assert result.high == 108.0  # max of all highs
        assert result.low == 98.0    # min of all lows
        assert result.midpoint == 103.0
        assert result.range_size == 10.0
        assert result.range_percent == pytest.approx((10.0 / 103.0) * 100, rel=0.01)

    def test_no_breakout_within_range(self):
        """Test that no breakout is detected when price is within range."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=100.0,
                high=110.0,
                low=90.0,
                close=100.0,
                volume=1000000,
            ),
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 20),
                open=100.0,
                high=105.0,
                low=95.0,
                close=102.0,  # Within range
                volume=1000000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=5)
        result = calc.calculate_opening_range(candles, timeframe_minutes=5)
        
        assert result.breakout_status == BreakoutStatus.NO_BREAKOUT
        assert result.breakout_distance is None

    def test_breakout_above(self):
        """Test breakout above opening range."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=100.0,
                high=105.0,
                low=95.0,
                close=102.0,
                volume=1000000,
            ),
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 20),
                open=102.0,
                high=115.0,
                low=100.0,
                close=110.0,  # Above opening range high
                volume=1500000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=5)
        result = calc.calculate_opening_range(candles, timeframe_minutes=5)
        
        assert result.breakout_status == BreakoutStatus.BREAKOUT_ABOVE
        assert result.breakout_distance is not None
        assert result.breakout_distance > 0
        expected_distance = ((110.0 - 105.0) / 105.0) * 100
        assert result.breakout_distance == pytest.approx(expected_distance, rel=0.01)

    def test_breakdown_below(self):
        """Test breakdown below opening range."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=100.0,
                high=105.0,
                low=95.0,
                close=100.0,
                volume=1000000,
            ),
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 20),
                open=95.0,
                high=98.0,
                low=85.0,
                close=90.0,  # Below opening range low
                volume=1500000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=5)
        result = calc.calculate_opening_range(candles, timeframe_minutes=5)
        
        assert result.breakout_status == BreakoutStatus.BREAKDOWN_BELOW
        assert result.breakout_distance is not None
        assert result.breakout_distance > 0
        expected_distance = ((95.0 - 90.0) / 95.0) * 100
        assert result.breakout_distance == pytest.approx(expected_distance, rel=0.01)

    def test_volume_confirmation(self):
        """Test volume confirmation for breakouts."""
        candles = []
        base_time = datetime(2024, 1, 15, 9, 15)
        
        # Create 25 candles with normal volume
        for i in range(25):
            candles.append(
                OHLCVData(
                    timestamp=base_time + timedelta(minutes=5 * i),
                    open=100.0 + i * 0.5,
                    high=102.0 + i * 0.5,
                    low=98.0 + i * 0.5,
                    close=100.5 + i * 0.5,
                    volume=1000000,
                )
            )
        
        # Last candle breaks out with high volume
        candles[-1] = OHLCVData(
            timestamp=base_time + timedelta(minutes=5 * 24),
            open=112.0,
            high=120.0,
            low=112.0,
            close=118.0,
            volume=2000000,  # 2x average volume
        )
        
        calc = OpeningRangeCalculator(period_minutes=15)
        result = calc.calculate_opening_range(
            candles, 
            timeframe_minutes=5,
            volume_period=20,
            volume_threshold=1.5
        )
        
        assert result.breakout_status == BreakoutStatus.BREAKOUT_ABOVE
        assert result.volume_confirmed is True
        assert result.volume_ratio == pytest.approx(2.0, rel=0.1)  # Allow 10% tolerance

    def test_no_volume_confirmation(self):
        """Test lack of volume confirmation."""
        candles = []
        base_time = datetime(2024, 1, 15, 9, 15)
        
        # Create 25 candles
        for i in range(25):
            candles.append(
                OHLCVData(
                    timestamp=base_time + timedelta(minutes=5 * i),
                    open=100.0 + i * 0.5,
                    high=102.0 + i * 0.5,
                    low=98.0 + i * 0.5,
                    close=100.5 + i * 0.5,
                    volume=1000000,
                )
            )
        
        # Last candle breaks out with low volume
        candles[-1] = OHLCVData(
            timestamp=base_time + timedelta(minutes=5 * 24),
            open=112.0,
            high=120.0,
            low=112.0,
            close=118.0,
            volume=800000,  # Below average
        )
        
        calc = OpeningRangeCalculator(period_minutes=15)
        result = calc.calculate_opening_range(
            candles, 
            timeframe_minutes=5,
            volume_period=20,
            volume_threshold=1.0
        )
        
        assert result.breakout_status == BreakoutStatus.BREAKOUT_ABOVE
        assert result.volume_confirmed is False
        assert result.volume_ratio < 1.0

    def test_custom_current_price(self):
        """Test using custom current price for breakout detection."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=100.0,
                high=105.0,
                low=95.0,
                close=100.0,
                volume=1000000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=5)
        
        # Test with custom price above range
        result = calc.calculate_opening_range(
            candles, 
            timeframe_minutes=5,
            current_price=110.0
        )
        assert result.breakout_status == BreakoutStatus.BREAKOUT_ABOVE
        assert result.current_price == 110.0

    def test_gap_up_opening(self):
        """Test handling of gap up opening."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=120.0,  # Gap up from previous day
                high=125.0,
                low=118.0,
                close=122.0,
                volume=2000000,
            ),
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 20),
                open=122.0,
                high=128.0,
                low=121.0,
                close=126.0,
                volume=1800000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=5)
        result = calc.calculate_opening_range(candles, timeframe_minutes=5)
        
        # Should still calculate opening range correctly
        assert result.high == 125.0
        assert result.low == 118.0
        assert result.breakout_status == BreakoutStatus.BREAKOUT_ABOVE

    def test_gap_down_opening(self):
        """Test handling of gap down opening."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=80.0,  # Gap down
                high=82.0,
                low=78.0,
                close=79.0,
                volume=2500000,
            ),
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 20),
                open=79.0,
                high=80.0,
                low=75.0,
                close=76.0,
                volume=2300000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=5)
        result = calc.calculate_opening_range(candles, timeframe_minutes=5)
        
        assert result.high == 82.0
        assert result.low == 78.0  # Only first candle is in opening range
        assert result.breakout_status == BreakoutStatus.BREAKDOWN_BELOW

    def test_flat_opening(self):
        """Test handling of flat opening (very small range)."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=100.0,
                high=100.5,
                low=99.5,
                close=100.0,
                volume=500000,
            ),
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 20),
                open=100.0,
                high=100.3,
                low=99.7,
                close=100.1,
                volume=500000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=5)
        result = calc.calculate_opening_range(candles, timeframe_minutes=5)
        
        assert result.high == 100.5
        assert result.low == 99.5
        assert result.range_size == 1.0
        assert result.breakout_status == BreakoutStatus.NO_BREAKOUT

    def test_insufficient_data(self):
        """Test that insufficient data raises ValueError."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=100.0,
                high=105.0,
                low=95.0,
                close=100.0,
                volume=1000000,
            ),
        ]
        
        # Need 3 candles for 15-minute range with 5-minute candles
        calc = OpeningRangeCalculator(period_minutes=15)
        with pytest.raises(ValueError, match="Insufficient data"):
            calc.calculate_opening_range(candles, timeframe_minutes=5)

    def test_empty_data(self):
        """Test that empty data raises ValueError."""
        calc = OpeningRangeCalculator()
        with pytest.raises(ValueError, match="data cannot be empty"):
            calc.calculate_opening_range([], timeframe_minutes=5)

    def test_invalid_timeframe(self):
        """Test that invalid timeframe raises ValueError."""
        candles = create_test_candles(5)
        calc = OpeningRangeCalculator()
        with pytest.raises(ValueError, match="timeframe_minutes must be at least 1"):
            calc.calculate_opening_range(candles, timeframe_minutes=0)

    def test_detect_breakout_above_helper(self):
        """Test detect_breakout_above helper method."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=100.0,
                high=105.0,
                low=95.0,
                close=110.0,
                volume=1000000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=5)
        assert calc.detect_breakout_above(candles, timeframe_minutes=5) is True

    def test_detect_breakdown_below_helper(self):
        """Test detect_breakdown_below helper method."""
        candles = [
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15),
                open=100.0,
                high=105.0,
                low=95.0,
                close=90.0,
                volume=1000000,
            ),
        ]
        
        calc = OpeningRangeCalculator(period_minutes=5)
        assert calc.detect_breakdown_below(candles, timeframe_minutes=5) is True

    def test_calculate_breakout_distance_percent(self):
        """Test breakout distance calculation."""
        calc = OpeningRangeCalculator()
        
        # Breakout above
        distance = calc.calculate_breakout_distance_percent(110.0, 105.0, 95.0)
        expected = ((110.0 - 105.0) / 105.0) * 100
        assert distance == pytest.approx(expected, rel=0.01)
        
        # Breakdown below
        distance = calc.calculate_breakout_distance_percent(90.0, 105.0, 95.0)
        expected = -((95.0 - 90.0) / 95.0) * 100
        assert distance == pytest.approx(expected, rel=0.01)
        
        # Within range
        distance = calc.calculate_breakout_distance_percent(100.0, 105.0, 95.0)
        assert distance == 0.0

    def test_breakout_distance_invalid_prices(self):
        """Test that invalid prices raise ValueError."""
        calc = OpeningRangeCalculator()
        
        with pytest.raises(ValueError, match="All prices must be positive"):
            calc.calculate_breakout_distance_percent(0.0, 105.0, 95.0)
        
        with pytest.raises(ValueError, match="opening_high must be >= opening_low"):
            calc.calculate_breakout_distance_percent(100.0, 90.0, 95.0)

    def test_different_period_lengths(self):
        """Test with different opening range periods."""
        candles = create_test_candles(10)
        
        # 5-minute opening range
        calc_5 = OpeningRangeCalculator(period_minutes=5)
        result_5 = calc_5.calculate_opening_range(candles, timeframe_minutes=5)
        
        # 15-minute opening range
        calc_15 = OpeningRangeCalculator(period_minutes=15)
        result_15 = calc_15.calculate_opening_range(candles, timeframe_minutes=5)
        
        # 15-minute range should be wider (includes more candles)
        assert result_15.range_size >= result_5.range_size
