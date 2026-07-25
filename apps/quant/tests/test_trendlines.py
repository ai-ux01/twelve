"""
Unit tests for trendline detection calculator.

Tests the trendline detection algorithm including linear regression,
swing point detection, and edge cases.
"""

import pytest
from datetime import datetime, timedelta
from models.market_data import OHLCVData, TrendlineResult
from calculators.trendlines import (
    detect_trendlines,
    calculate_trendline_touches,
    _find_swing_points,
)


def create_ohlcv_data(
    prices: list[float], base_date: datetime = None
) -> list[OHLCVData]:
    """
    Helper function to create OHLCV data from a list of prices.

    Creates simple candlesticks where open=close=price, and high/low vary slightly.
    """
    if base_date is None:
        base_date = datetime(2024, 1, 1)

    data = []
    for i, price in enumerate(prices):
        data.append(
            OHLCVData(
                timestamp=base_date + timedelta(days=i),
                open=price,
                high=price * 1.01,  # High is 1% above
                low=price * 0.99,  # Low is 1% below
                close=price,
                volume=1000000,
            )
        )
    return data


def test_detect_trendlines_uptrend():
    """Test detection of uptrend trendline."""
    # Create uptrending price data
    prices = [100, 102, 101, 105, 107, 106, 110, 112, 111, 115]
    data = create_ohlcv_data(prices)

    trendlines = detect_trendlines(data, min_touches=3, min_r_squared=0.5)

    # Should detect at least one trendline (uptrend)
    assert len(trendlines) > 0

    # First trendline should have positive slope (uptrend)
    uptrend = trendlines[0]
    assert uptrend.slope > 0
    assert 0 <= uptrend.r_squared <= 1
    assert isinstance(uptrend.intercept, float)


def test_detect_trendlines_downtrend():
    """Test detection of downtrend trendline."""
    # Create downtrending price data
    prices = [115, 112, 113, 110, 107, 108, 105, 102, 103, 100]
    data = create_ohlcv_data(prices)

    trendlines = detect_trendlines(data, min_touches=3, min_r_squared=0.5)

    # Should detect at least one trendline (downtrend)
    assert len(trendlines) > 0

    # Should find a downtrend (negative slope)
    downtrend = next((t for t in trendlines if t.slope < 0), None)
    assert downtrend is not None
    assert 0 <= downtrend.r_squared <= 1


def test_detect_trendlines_sideways():
    """Test detection with sideways/flat price movement."""
    # Create sideways price data
    prices = [100, 101, 100, 99, 100, 101, 100, 99, 100, 101]
    data = create_ohlcv_data(prices)

    trendlines = detect_trendlines(data, min_touches=3, min_r_squared=0.5)

    # May or may not detect trendlines in sideways market
    # If detected, slope should be close to 0
    if trendlines:
        for trendline in trendlines:
            assert abs(trendline.slope) < 2  # Should be relatively flat


def test_detect_trendlines_insufficient_data():
    """Test error handling with insufficient data points."""
    # Only 2 data points, less than min_touches=3
    prices = [100, 102]
    data = create_ohlcv_data(prices)

    with pytest.raises(ValueError, match="Insufficient data points"):
        detect_trendlines(data, min_touches=3)


def test_detect_trendlines_empty_data():
    """Test error handling with empty data."""
    with pytest.raises(ValueError, match="data cannot be empty"):
        detect_trendlines([])


def test_trendline_result_properties():
    """Test that trendline results have valid properties."""
    prices = [100, 105, 103, 108, 110, 109, 113, 115, 114, 118]
    data = create_ohlcv_data(prices)

    trendlines = detect_trendlines(data, min_touches=2, min_r_squared=0.3)

    assert len(trendlines) > 0

    for trendline in trendlines:
        # Check all required fields exist
        assert isinstance(trendline.slope, float)
        assert isinstance(trendline.intercept, float)
        assert isinstance(trendline.r_squared, float)
        assert isinstance(trendline.start_point, tuple)
        assert isinstance(trendline.end_point, tuple)

        # Check R² is in valid range
        assert 0 <= trendline.r_squared <= 1

        # Check points are tuples of length 2
        assert len(trendline.start_point) == 2
        assert len(trendline.end_point) == 2


def test_find_swing_points_lows():
    """Test finding swing low points."""
    prices = [100, 98, 102, 97, 105, 96, 110]
    data = create_ohlcv_data(prices)

    swing_lows = _find_swing_points(data, use_lows=True, window=1)

    # Should find local minima
    assert len(swing_lows) > 0

    # Each swing point should be a tuple of (index, price)
    for idx, price in swing_lows:
        assert isinstance(idx, int)
        assert isinstance(price, float)
        assert 0 <= idx < len(data)


def test_find_swing_points_highs():
    """Test finding swing high points."""
    prices = [100, 105, 98, 110, 95, 115, 90]
    data = create_ohlcv_data(prices)

    swing_highs = _find_swing_points(data, use_lows=False, window=1)

    # Should find local maxima
    assert len(swing_highs) > 0

    # Each swing point should be a tuple of (index, price)
    for idx, price in swing_highs:
        assert isinstance(idx, int)
        assert isinstance(price, float)
        assert 0 <= idx < len(data)


def test_calculate_trendline_touches():
    """Test calculation of trendline touches."""
    # Create uptrending data
    prices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118]
    data = create_ohlcv_data(prices)

    # Create a simple uptrend trendline
    trendline = TrendlineResult(
        slope=2.0,
        intercept=100.0,
        r_squared=0.95,
        start_point=(0, 100.0),
        end_point=(9, 118.0),
    )

    touches = calculate_trendline_touches(data, trendline, tolerance=0.02)

    # Should detect multiple touches
    assert touches > 0
    assert isinstance(touches, int)


def test_trendline_sorted_by_r_squared():
    """Test that trendlines are sorted by R² value (best fit first)."""
    # Create clear uptrending data
    prices = [100, 103, 106, 109, 112, 115, 118, 121, 124, 127]
    data = create_ohlcv_data(prices)

    trendlines = detect_trendlines(data, min_touches=2, min_r_squared=0.3)

    # If multiple trendlines, they should be sorted by R² descending
    if len(trendlines) > 1:
        for i in range(len(trendlines) - 1):
            assert trendlines[i].r_squared >= trendlines[i + 1].r_squared


def test_min_r_squared_filter():
    """Test that min_r_squared filters out poor fits."""
    # Create noisy data
    prices = [100, 95, 110, 90, 115, 85, 120, 80, 125, 75]
    data = create_ohlcv_data(prices)

    # With high min_r_squared, should get fewer or no trendlines
    strict_trendlines = detect_trendlines(data, min_touches=2, min_r_squared=0.9)

    # With low min_r_squared, should get more trendlines
    lenient_trendlines = detect_trendlines(data, min_touches=2, min_r_squared=0.1)

    # Lenient should have >= trendlines than strict
    assert len(lenient_trendlines) >= len(strict_trendlines)

    # All strict trendlines should have R² >= 0.9
    for trendline in strict_trendlines:
        assert trendline.r_squared >= 0.9


def test_trendline_with_realistic_data():
    """Test trendline detection with realistic price movements."""
    # Simulate realistic uptrend with some volatility
    prices = [
        2450.0,
        2455.0,
        2448.0,  # Small pullback
        2460.0,
        2465.0,
        2458.0,  # Small pullback
        2470.0,
        2475.0,
        2468.0,  # Small pullback
        2480.0,
        2485.0,
    ]
    data = create_ohlcv_data(prices)

    trendlines = detect_trendlines(data, min_touches=3, min_r_squared=0.5)

    # Should detect uptrend
    assert len(trendlines) > 0
    uptrend = next((t for t in trendlines if t.slope > 0), None)
    assert uptrend is not None

    # Uptrend should have reasonable R²
    assert uptrend.r_squared > 0.5

    # Slope should be positive and reasonable
    assert 0 < uptrend.slope < 10


def test_start_and_end_points_consistency():
    """Test that start and end points are consistent with slope and intercept."""
    prices = [100, 105, 110, 115, 120, 125, 130]
    data = create_ohlcv_data(prices)

    trendlines = detect_trendlines(data, min_touches=2, min_r_squared=0.3)

    for trendline in trendlines:
        start_x, start_y = trendline.start_point
        end_x, end_y = trendline.end_point

        # Verify start point
        expected_start_y = trendline.slope * start_x + trendline.intercept
        assert abs(start_y - expected_start_y) < 0.001

        # Verify end point
        expected_end_y = trendline.slope * end_x + trendline.intercept
        assert abs(end_y - expected_end_y) < 0.001


def test_multiple_swing_window_sizes():
    """Test that different window sizes affect swing point detection."""
    prices = [100, 102, 98, 105, 97, 108, 96, 110]
    data = create_ohlcv_data(prices)

    # Smaller window should find more swing points
    swings_small = _find_swing_points(data, use_lows=True, window=1)
    swings_large = _find_swing_points(data, use_lows=True, window=2)

    # Smaller window typically finds more or equal swing points
    assert len(swings_small) >= len(swings_large)
