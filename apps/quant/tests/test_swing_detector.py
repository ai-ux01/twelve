"""Unit tests for swing point detection calculator."""

import pytest
from datetime import datetime, timedelta
from models import OHLCVData, SwingType
from calculators.swing_detector import SwingDetector


def create_test_data(prices_pattern, base_price=100.0):
    """Helper to create OHLCV data."""
    data = []
    base_time = datetime(2024, 1, 1, 9, 0, 0)
    for i, adjustment in enumerate(prices_pattern):
        price = base_price + adjustment
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=price,
                high=price + 2,
                low=price - 2,
                close=price,
                volume=1000000,
            )
        )
    return data


def test_detect_swing_high_simple():
    """Test detection of a clear swing high."""
    prices = [0, 5, 10, 15, 20, 15, 10, 5, 0]
    data = create_test_data(prices)
    swing_points = detect_swing_points(data, lookback_period=2)
    highs = [p for p in swing_points if p.type == SwingType.HIGH]
    assert len(highs) >= 1
    assert any(p.price == 122.0 for p in highs)


def test_detect_swing_low_simple():
    """Test detection of a clear swing low."""
    prices = [20, 15, 10, 5, 0, 5, 10, 15, 20]
    data = create_test_data(prices)
    swing_points = detect_swing_points(data, lookback_period=2)
    lows = [p for p in swing_points if p.type == SwingType.LOW]
    assert len(lows) >= 1
    assert any(p.price == 98.0 for p in lows)


def test_empty_data_raises_error():
    """Test that empty data raises ValueError."""
    with pytest.raises(ValueError, match="data cannot be empty"):
        detect_swing_points([], lookback_period=5)


def test_detect_uptrend_pattern():
    """Test detection of uptrend."""
    prices = [0, 10, 5, 15, 10, 20, 15, 25, 20, 30, 25]
    data = create_test_data(prices)
    has_uptrend, confidence = detect_higher_highs_and_lows(data, lookback_period=2)
    assert has_uptrend is True
    assert confidence > 0


def test_detect_downtrend_pattern():
    """Test detection of downtrend."""
    prices = [30, 20, 25, 15, 20, 10, 15, 5, 10, 0, 5]
    data = create_test_data(prices)
    has_downtrend, confidence = detect_lower_highs_and_lows(data, lookback_period=2)
    assert has_downtrend is True
    assert confidence > 0


def test_analyze_trend_neutral():
    """Test neutral trend identification."""
    prices = [0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0]
    data = create_test_data(prices)
    trend = analyze_trend_pattern(data, lookback_period=2)
    assert trend == "NEUTRAL"
