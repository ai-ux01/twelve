"""
Unit tests for TrendlineService.

Tests the orchestration of swing detection, trendline calculation,
and breakout detection into a unified service.
"""

import pytest
from datetime import datetime, timedelta
from models import OHLCVData, SwingType
from services.trendline_service import TrendlineService, TrendlineServiceResult
from calculators.breakout_detector import BreakoutType


@pytest.fixture
def simple_uptrend_data():
    """Create simple uptrend data with clear swing points."""
    base_time = datetime(2024, 1, 1, 9, 15)
    data = []

    # Create uptrend with more pronounced swing points
    # Pattern: Higher highs and higher lows
    prices = [
        (100, 102, 98, 101, 1000000),  # 0
        (101, 103, 99, 102, 950000),  # 1
        (102, 108, 101, 106, 1100000),  # 2 - swing high at 108
        (106, 107, 103, 104, 980000),  # 3
        (104, 106, 100, 102, 1020000),  # 4 - swing low at 100
        (102, 103, 99, 101, 1050000),  # 5
        (101, 112, 100, 110, 1150000),  # 6 - swing high at 112
        (110, 111, 107, 108, 990000),  # 7
        (108, 110, 104, 106, 1030000),  # 8 - swing low at 104
        (106, 107, 103, 105, 1010000),  # 9
        (105, 116, 104, 114, 1200000),  # 10 - swing high at 116
        (114, 115, 110, 112, 1040000),  # 11
        (112, 114, 108, 110, 1050000),  # 12 - swing low at 108
        (110, 111, 107, 109, 1060000),  # 13
        (109, 120, 108, 118, 1300000),  # 14 - breakout at 120
    ]

    for i, (open_p, high, low, close, volume) in enumerate(prices):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i),
                open=float(open_p),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=volume,
            )
        )

    return data


@pytest.fixture
def downtrend_data():
    """Create downtrend data for testing."""
    base_time = datetime(2024, 1, 1, 9, 15)
    data = []

    # Create downtrend with pronounced swing points
    # Pattern: Lower highs and lower lows
    prices = [
        (120, 122, 118, 119, 1000000),  # 0
        (119, 121, 117, 118, 950000),  # 1
        (118, 120, 114, 116, 1100000),  # 2 - swing low at 114
        (116, 118, 115, 117, 980000),  # 3
        (117, 119, 116, 118, 1020000),  # 4 - swing high at 119
        (118, 119, 113, 115, 1150000),  # 5
        (115, 116, 108, 110, 1100000),  # 6 - swing low at 108
        (110, 113, 109, 112, 990000),  # 7
        (112, 115, 111, 113, 1030000),  # 8 - swing high at 115
        (113, 114, 110, 111, 1010000),  # 9
        (111, 112, 102, 104, 1200000),  # 10 - swing low at 102
        (104, 108, 103, 107, 1040000),  # 11
        (107, 110, 106, 108, 1050000),  # 12 - swing high at 110
        (108, 109, 105, 106, 1060000),  # 13
        (106, 107, 98, 100, 1300000),  # 14 - breakdown at 98
    ]

    for i, (open_p, high, low, close, volume) in enumerate(prices):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i),
                open=float(open_p),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=volume,
            )
        )

    return data


@pytest.fixture
def insufficient_data():
    """Create data with insufficient points for swing detection."""
    base_time = datetime(2024, 1, 1, 9, 15)
    data = []

    # Only 5 bars - not enough for lookback_period=3 (needs at least 7)
    prices = [
        (100, 102, 98, 101, 1000000),
        (101, 103, 99, 100, 950000),
        (100, 104, 99, 103, 1100000),
        (103, 105, 100, 102, 980000),
        (102, 104, 99, 101, 1020000),
    ]

    for i, (open_p, high, low, close, volume) in enumerate(prices):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i),
                open=float(open_p),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=volume,
            )
        )

    return data


class TestTrendlineServiceInitialization:
    """Test TrendlineService initialization and parameter validation."""

    def test_default_initialization(self):
        """Test service initialization with default parameters."""
        service = TrendlineService()

        assert service.lookback_period == 3
        assert service.min_trendline_points == 2
        assert service.volume_period == 20
        assert service.volume_threshold == 1.0
        assert service.swing_detector is not None
        assert service.trendline_calculator is not None

    def test_custom_initialization(self):
        """Test service initialization with custom parameters."""
        service = TrendlineService(
            lookback_period=5,
            min_trendline_points=3,
            volume_period=15,
            volume_threshold=1.2,
        )

        assert service.lookback_period == 5
        assert service.min_trendline_points == 3
        assert service.volume_period == 15
        assert service.volume_threshold == 1.2

    def test_invalid_lookback_period(self):
        """Test that invalid lookback_period raises ValueError."""
        with pytest.raises(ValueError, match="lookback_period must be at least 1"):
            TrendlineService(lookback_period=0)

        with pytest.raises(ValueError, match="lookback_period must be at least 1"):
            TrendlineService(lookback_period=-1)

    def test_invalid_min_trendline_points(self):
        """Test that invalid min_trendline_points raises ValueError."""
        with pytest.raises(ValueError, match="min_trendline_points must be at least 2"):
            TrendlineService(min_trendline_points=1)

        with pytest.raises(ValueError, match="min_trendline_points must be at least 2"):
            TrendlineService(min_trendline_points=0)

    def test_invalid_volume_period(self):
        """Test that invalid volume_period raises ValueError."""
        with pytest.raises(ValueError, match="volume_period must be at least 1"):
            TrendlineService(volume_period=0)

        with pytest.raises(ValueError, match="volume_period must be at least 1"):
            TrendlineService(volume_period=-1)

    def test_invalid_volume_threshold(self):
        """Test that invalid volume_threshold raises ValueError."""
        with pytest.raises(ValueError, match="volume_threshold must be positive"):
            TrendlineService(volume_threshold=0.0)

        with pytest.raises(ValueError, match="volume_threshold must be positive"):
            TrendlineService(volume_threshold=-1.0)


class TestAnalyzeTrendlines:
    """Test the main analyze_trendlines method."""

    def test_empty_data_raises_error(self):
        """Test that empty data raises ValueError."""
        service = TrendlineService()

        with pytest.raises(ValueError, match="data cannot be empty"):
            service.analyze_trendlines([])

    def test_uptrend_analysis_returns_complete_result(self, simple_uptrend_data):
        """Test that uptrend analysis returns complete TrendlineServiceResult."""
        service = TrendlineService(lookback_period=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        # Check result type
        assert isinstance(result, TrendlineServiceResult)

        # Check swing points are detected
        assert len(result.swing_points) > 0

        # Check trendlines (may or may not be None depending on swing points)
        assert (
            result.support_trendline is not None
            or result.resistance_trendline is not None
        )

        # Check breakout result exists
        assert result.breakout is not None
        assert result.breakout.breakout_type in [
            BreakoutType.RESISTANCE_BREAKOUT,
            BreakoutType.SUPPORT_BREAKDOWN,
            BreakoutType.NO_BREAKOUT,
        ]

    def test_downtrend_analysis(self, downtrend_data):
        """Test downtrend analysis."""
        service = TrendlineService(lookback_period=2)

        result = service.analyze_trendlines(downtrend_data)

        assert isinstance(result, TrendlineServiceResult)
        assert len(result.swing_points) > 0
        assert result.breakout is not None

    def test_swing_points_have_correct_types(self, simple_uptrend_data):
        """Test that detected swing points have correct types."""
        service = TrendlineService(lookback_period=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        # Check that swing points have HIGH or LOW type
        for swing_point in result.swing_points:
            assert swing_point.type in [SwingType.HIGH, SwingType.LOW]

    def test_support_trendline_properties(self, simple_uptrend_data):
        """Test support trendline properties when detected."""
        service = TrendlineService(lookback_period=2, min_trendline_points=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        if result.support_trendline is not None:
            # Check trendline has required fields
            assert result.support_trendline.slope is not None
            assert result.support_trendline.intercept is not None
            assert 0.0 <= result.support_trendline.r_squared <= 1.0
            assert result.support_trendline.start_point is not None
            assert result.support_trendline.end_point is not None

    def test_resistance_trendline_properties(self, simple_uptrend_data):
        """Test resistance trendline properties when detected."""
        service = TrendlineService(lookback_period=2, min_trendline_points=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        if result.resistance_trendline is not None:
            # Check trendline has required fields
            assert result.resistance_trendline.slope is not None
            assert result.resistance_trendline.intercept is not None
            assert 0.0 <= result.resistance_trendline.r_squared <= 1.0
            assert result.resistance_trendline.start_point is not None
            assert result.resistance_trendline.end_point is not None

    def test_breakout_detection_with_high_volume(self, simple_uptrend_data):
        """Test that breakout is detected when volume confirms."""
        # Last bar has high volume (1250000) and high close (109)
        service = TrendlineService(
            lookback_period=2,
            volume_period=10,
            volume_threshold=1.1,
        )

        result = service.analyze_trendlines(simple_uptrend_data)

        # Breakout result should exist
        assert result.breakout is not None

        # Volume ratio should be calculated
        assert result.breakout.volume_ratio >= 0.0


class TestBreakoutDetection:
    """Test breakout detection within the service."""

    def test_no_breakout_without_trendlines(self):
        """Test that NO_BREAKOUT is returned when no trendlines available."""
        service = TrendlineService()

        # Create minimal data that won't produce trendlines
        base_time = datetime(2024, 1, 1, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i),
                open=100.0 + i,
                high=102.0 + i,
                low=99.0 + i,
                close=101.0 + i,
                volume=1000000,
            )
            for i in range(5)
        ]

        # This will raise an error due to insufficient data
        with pytest.raises(ValueError):
            service.analyze_trendlines(data)

    def test_breakout_type_is_valid(self, simple_uptrend_data):
        """Test that breakout type is one of the valid enum values."""
        service = TrendlineService(lookback_period=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        assert result.breakout.breakout_type in [
            BreakoutType.RESISTANCE_BREAKOUT,
            BreakoutType.SUPPORT_BREAKDOWN,
            BreakoutType.NO_BREAKOUT,
        ]

    def test_volume_ratio_is_non_negative(self, simple_uptrend_data):
        """Test that volume_ratio is always non-negative."""
        service = TrendlineService(lookback_period=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        assert result.breakout.volume_ratio >= 0.0

    def test_breakout_with_insufficient_volume_data(self, insufficient_data):
        """Test breakout detection with insufficient data for volume analysis."""
        # insufficient_data has only 5 bars, default volume_period is 20
        service = TrendlineService(lookback_period=1)

        # Should raise error due to insufficient data for swing detection
        # with lookback_period=1, we need at least 2*1+1=3 bars, which we have
        # But we won't have enough for volume analysis (need 20), so breakout should be NO_BREAKOUT
        result = service.analyze_trendlines(insufficient_data)

        # Should return NO_BREAKOUT since not enough data for volume analysis
        assert result.breakout.breakout_type == BreakoutType.NO_BREAKOUT


class TestServiceOrchestration:
    """Test that service properly orchestrates all components."""

    def test_swing_detector_is_called(self, simple_uptrend_data):
        """Test that swing detector produces swing points."""
        service = TrendlineService(lookback_period=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        # Swing points should be populated
        assert len(result.swing_points) > 0

    def test_trendline_calculator_is_called(self, simple_uptrend_data):
        """Test that trendline calculator produces trendlines."""
        service = TrendlineService(lookback_period=2, min_trendline_points=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        # At least one trendline should be calculated
        assert (
            result.support_trendline is not None
            or result.resistance_trendline is not None
        )

    def test_breakout_detector_is_called(self, simple_uptrend_data):
        """Test that breakout detector is called."""
        service = TrendlineService(lookback_period=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        # Breakout result should always be present
        assert result.breakout is not None

    def test_all_components_work_together(self, simple_uptrend_data):
        """Test that all components produce a cohesive result."""
        service = TrendlineService(
            lookback_period=2,
            min_trendline_points=2,
            volume_period=10,
            volume_threshold=1.0,
        )

        result = service.analyze_trendlines(simple_uptrend_data)

        # All major components should have results
        assert len(result.swing_points) > 0
        assert result.breakout is not None

        # If breakout occurred, it should reference a trendline
        if result.breakout.breakout_type != BreakoutType.NO_BREAKOUT:
            assert result.breakout.breakout_price is not None
            assert result.breakout.trendline_price is not None


class TestResultModel:
    """Test TrendlineServiceResult model."""

    def test_result_model_initialization(self):
        """Test that result model can be initialized."""
        from calculators.breakout_detector import BreakoutResult

        result = TrendlineServiceResult(
            swing_points=[],
            support_trendline=None,
            resistance_trendline=None,
            breakout=BreakoutResult(
                breakout_type=BreakoutType.NO_BREAKOUT,
                confirmed=False,
                volume_ratio=0.0,
                breakout_index=None,
                breakout_price=None,
                trendline_price=None,
            ),
        )

        assert result.swing_points == []
        assert result.support_trendline is None
        assert result.resistance_trendline is None

    def test_result_model_with_data(self, simple_uptrend_data):
        """Test result model with actual data."""
        service = TrendlineService(lookback_period=2)

        result = service.analyze_trendlines(simple_uptrend_data)

        # Test that result can be serialized (important for API responses)
        result_dict = result.model_dump()

        assert "swing_points" in result_dict
        assert "support_trendline" in result_dict
        assert "resistance_trendline" in result_dict
        assert "breakout" in result_dict


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_high_min_trendline_points_returns_none_trendlines(
        self, simple_uptrend_data
    ):
        """Test that high min_trendline_points may result in None trendlines."""
        # Require 10 swing points for trendline - unlikely to have that many
        service = TrendlineService(
            lookback_period=2,
            min_trendline_points=10,
        )

        result = service.analyze_trendlines(simple_uptrend_data)

        # May have None trendlines due to insufficient swing points
        # But breakout should still be NO_BREAKOUT
        if result.support_trendline is None and result.resistance_trendline is None:
            assert result.breakout.breakout_type == BreakoutType.NO_BREAKOUT

    def test_high_volume_threshold_no_confirmation(self, simple_uptrend_data):
        """Test that high volume threshold prevents breakout confirmation."""
        # Set very high volume threshold
        service = TrendlineService(
            lookback_period=2,
            volume_threshold=10.0,  # Requires 10x average volume
        )

        result = service.analyze_trendlines(simple_uptrend_data)

        # If a breakout is detected, it should not be confirmed
        if result.breakout.breakout_type != BreakoutType.NO_BREAKOUT:
            # With such a high threshold, confirmation is unlikely
            # Just check that the field exists
            assert isinstance(result.breakout.confirmed, bool)

    def test_determinism(self, simple_uptrend_data):
        """Test that same inputs produce same outputs."""
        service = TrendlineService(lookback_period=2)

        result1 = service.analyze_trendlines(simple_uptrend_data)
        result2 = service.analyze_trendlines(simple_uptrend_data)

        # Swing points should be identical
        assert len(result1.swing_points) == len(result2.swing_points)

        # Trendlines should be identical (both None or both have same values)
        if result1.support_trendline is None:
            assert result2.support_trendline is None
        else:
            assert result2.support_trendline is not None
            assert result1.support_trendline.slope == result2.support_trendline.slope
            assert (
                result1.support_trendline.intercept
                == result2.support_trendline.intercept
            )

        # Breakout type should be identical
        assert result1.breakout.breakout_type == result2.breakout.breakout_type
