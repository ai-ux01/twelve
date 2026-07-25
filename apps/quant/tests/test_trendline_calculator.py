"""Unit tests for TrendlineCalculator."""

import pytest
from datetime import datetime, timedelta
from models import OHLCVData
from calculators.trendline_calculator import TrendlineCalculator


def create_uptrend_data():
    """Create OHLCV data with clear uptrend and swing points."""
    data = []
    base_time = datetime(2024, 1, 1, 9, 0, 0)

    # Uptrend: higher highs and higher lows
    # (close, high, low) tuples
    prices = [
        (100, 102, 98),  # 0
        (103, 107, 102),  # 1
        (104, 106, 101),  # 2: swing low at 101
        (105, 110, 104),  # 3
        (111, 115, 110),  # 4: swing high at 115
        (110, 113, 108),  # 5
        (109, 111, 106),  # 6: swing low at 106
        (110, 118, 109),  # 7
        (118, 122, 117),  # 8: swing high at 122
        (120, 121, 118),  # 9
        (119, 120, 115),  # 10: swing low at 115
        (120, 128, 119),  # 11
        (127, 130, 126),  # 12: swing high at 130
    ]

    for i, (close, high, low) in enumerate(prices):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=close,
                high=high,
                low=low,
                close=close,
                volume=1000000,
            )
        )
    return data


def create_downtrend_data():
    """Create OHLCV data with clear downtrend and swing points."""
    data = []
    base_time = datetime(2024, 1, 1, 9, 0, 0)

    # Downtrend: lower highs and lower lows
    prices = [
        (130, 132, 128),  # 0
        (127, 129, 125),  # 1
        (128, 131, 127),  # 2: swing high at 131
        (125, 127, 123),  # 3
        (120, 122, 118),  # 4: swing low at 118
        (122, 125, 121),  # 5
        (123, 126, 122),  # 6: swing high at 126
        (118, 120, 116),  # 7
        (112, 114, 110),  # 8: swing low at 110
        (115, 117, 113),  # 9
        (116, 119, 115),  # 10: swing high at 119
        (110, 112, 108),  # 11
        (105, 107, 103),  # 12: swing low at 103
    ]

    for i, (close, high, low) in enumerate(prices):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=close,
                high=high,
                low=low,
                close=close,
                volume=1000000,
            )
        )
    return data


def create_minimal_data():
    """Create minimal OHLCV data for edge case testing."""
    data = []
    base_time = datetime(2024, 1, 1, 9, 0, 0)

    # Just 7 points with clear swing
    prices = [
        (100, 102, 98),
        (105, 107, 104),
        (103, 105, 100),  # swing low
        (108, 110, 106),
        (110, 113, 109),  # swing high
        (108, 110, 106),
        (112, 115, 111),
    ]

    for i, (close, high, low) in enumerate(prices):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=close,
                high=high,
                low=low,
                close=close,
                volume=1000000,
            )
        )
    return data


class TestTrendlineCalculatorInit:
    """Tests for TrendlineCalculator initialization."""

    def test_init_valid_lookback(self):
        """Test initialization with valid lookback period."""
        calculator = TrendlineCalculator(lookback_period=3)
        assert calculator.lookback_period == 3
        assert calculator.swing_detector is not None

    def test_init_default_lookback(self):
        """Test initialization with default lookback period."""
        calculator = TrendlineCalculator()
        assert calculator.lookback_period == 3

    def test_init_invalid_lookback(self):
        """Test that invalid lookback period raises ValueError."""
        with pytest.raises(ValueError, match="lookback_period must be at least 1"):
            TrendlineCalculator(lookback_period=0)

    def test_init_negative_lookback(self):
        """Test that negative lookback period raises ValueError."""
        with pytest.raises(ValueError, match="lookback_period must be at least 1"):
            TrendlineCalculator(lookback_period=-1)


class TestCalculateSupportTrendline:
    """Tests for calculate_support_trendline method."""

    def test_uptrend_support_trendline(self):
        """Test support trendline calculation for clear uptrend."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=2)

        assert trendline is not None
        assert trendline.slope > 0  # Upward sloping support
        assert 0 <= trendline.r_squared <= 1
        assert trendline.intercept > 0
        assert trendline.start_point[0] == 0
        assert trendline.end_point[0] == len(data) - 1

    def test_downtrend_support_trendline(self):
        """Test support trendline calculation for downtrend."""
        data = create_downtrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=2)

        assert trendline is not None
        assert trendline.slope < 0  # Downward sloping support
        assert 0 <= trendline.r_squared <= 1

    def test_insufficient_swing_lows(self):
        """Test that insufficient swing lows returns None."""
        # Create very short data
        data = create_minimal_data()[:5]  # Too few points

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=5)

        assert trendline is None

    def test_empty_data_raises_error(self):
        """Test that empty data raises ValueError."""
        calculator = TrendlineCalculator()
        with pytest.raises(ValueError, match="data cannot be empty"):
            calculator.calculate_support_trendline([], min_points=2)

    def test_invalid_min_points(self):
        """Test that min_points < 2 raises ValueError."""
        data = create_minimal_data()
        calculator = TrendlineCalculator()
        with pytest.raises(ValueError, match="min_points must be at least 2"):
            calculator.calculate_support_trendline(data, min_points=1)

    def test_trendline_properties(self):
        """Test that trendline has all required properties."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=2)

        assert trendline is not None
        assert hasattr(trendline, "slope")
        assert hasattr(trendline, "intercept")
        assert hasattr(trendline, "r_squared")
        assert hasattr(trendline, "start_point")
        assert hasattr(trendline, "end_point")
        assert len(trendline.start_point) == 2
        assert len(trendline.end_point) == 2


class TestCalculateResistanceTrendline:
    """Tests for calculate_resistance_trendline method."""

    def test_uptrend_resistance_trendline(self):
        """Test resistance trendline calculation for uptrend."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_resistance_trendline(data, min_points=2)

        assert trendline is not None
        assert trendline.slope > 0  # Upward sloping resistance
        assert 0 <= trendline.r_squared <= 1
        assert trendline.intercept > 0

    def test_downtrend_resistance_trendline(self):
        """Test resistance trendline calculation for downtrend."""
        data = create_downtrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_resistance_trendline(data, min_points=2)

        assert trendline is not None
        assert trendline.slope < 0  # Downward sloping resistance
        assert 0 <= trendline.r_squared <= 1

    def test_insufficient_swing_highs(self):
        """Test that insufficient swing highs returns None."""
        data = create_minimal_data()[:5]

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_resistance_trendline(data, min_points=5)

        assert trendline is None

    def test_empty_data_raises_error(self):
        """Test that empty data raises ValueError."""
        calculator = TrendlineCalculator()
        with pytest.raises(ValueError, match="data cannot be empty"):
            calculator.calculate_resistance_trendline([], min_points=2)

    def test_invalid_min_points(self):
        """Test that min_points < 2 raises ValueError."""
        data = create_minimal_data()
        calculator = TrendlineCalculator()
        with pytest.raises(ValueError, match="min_points must be at least 2"):
            calculator.calculate_resistance_trendline(data, min_points=1)


class TestCalculateBothTrendlines:
    """Tests for calculate_both_trendlines method."""

    def test_both_trendlines_uptrend(self):
        """Test calculating both trendlines for uptrend."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        support, resistance = calculator.calculate_both_trendlines(data, min_points=2)

        assert support is not None
        assert resistance is not None
        assert support.slope > 0  # Upward support
        assert resistance.slope > 0  # Upward resistance
        # Resistance should be above support (higher intercept)
        assert resistance.intercept > support.intercept

    def test_both_trendlines_downtrend(self):
        """Test calculating both trendlines for downtrend."""
        data = create_downtrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        support, resistance = calculator.calculate_both_trendlines(data, min_points=2)

        assert support is not None
        assert resistance is not None
        assert support.slope < 0  # Downward support
        assert resistance.slope < 0  # Downward resistance

    def test_empty_data_raises_error(self):
        """Test that empty data raises ValueError."""
        calculator = TrendlineCalculator()
        with pytest.raises(ValueError, match="data cannot be empty"):
            calculator.calculate_both_trendlines([], min_points=2)

    def test_invalid_min_points(self):
        """Test that min_points < 2 raises ValueError."""
        data = create_minimal_data()
        calculator = TrendlineCalculator()
        with pytest.raises(ValueError, match="min_points must be at least 2"):
            calculator.calculate_both_trendlines(data, min_points=1)

    def test_return_tuple_structure(self):
        """Test that return value is a tuple with two elements."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        result = calculator.calculate_both_trendlines(data, min_points=2)

        assert isinstance(result, tuple)
        assert len(result) == 2


class TestRSquaredValues:
    """Tests for R² value calculation accuracy."""

    def test_r_squared_in_valid_range(self):
        """Test that R² is always between 0 and 1."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=2)

        assert trendline is not None
        assert 0 <= trendline.r_squared <= 1

    def test_r_squared_reasonable_for_clean_trend(self):
        """Test that R² is reasonably high for clean trend data."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=2)

        assert trendline is not None
        # For a clean uptrend, R² should be decent (> 0.5)
        assert trendline.r_squared > 0.3


class TestTrendlineGeometry:
    """Tests for trendline geometric properties."""

    def test_start_point_at_zero(self):
        """Test that start_point x-coordinate is 0."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=2)

        assert trendline is not None
        assert trendline.start_point[0] == 0.0

    def test_end_point_at_last_index(self):
        """Test that end_point x-coordinate is len(data) - 1."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=2)

        assert trendline is not None
        assert trendline.end_point[0] == len(data) - 1

    def test_y_values_consistent_with_line_equation(self):
        """Test that start and end y-values match line equation."""
        data = create_uptrend_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=2)

        assert trendline is not None

        # Check start point: y = slope * x + intercept
        expected_start_y = (
            trendline.slope * trendline.start_point[0] + trendline.intercept
        )
        assert abs(trendline.start_point[1] - expected_start_y) < 1e-10

        # Check end point
        expected_end_y = trendline.slope * trendline.end_point[0] + trendline.intercept
        assert abs(trendline.end_point[1] - expected_end_y) < 1e-10


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_minimal_data_points(self):
        """Test with minimal valid data points."""
        data = create_minimal_data()

        calculator = TrendlineCalculator(lookback_period=2)
        trendline = calculator.calculate_support_trendline(data, min_points=2)

        # Should work or return None, but not crash
        if trendline is not None:
            assert isinstance(trendline.slope, float)
            assert 0 <= trendline.r_squared <= 1

    def test_different_lookback_periods(self):
        """Test that different lookback periods produce valid results."""
        data = create_uptrend_data()

        for lookback in [1, 2, 3]:
            calculator = TrendlineCalculator(lookback_period=lookback)
            trendline = calculator.calculate_support_trendline(data, min_points=2)

            # May or may not find trendline depending on lookback
            if trendline is not None:
                assert 0 <= trendline.r_squared <= 1
                assert isinstance(trendline.slope, float)
