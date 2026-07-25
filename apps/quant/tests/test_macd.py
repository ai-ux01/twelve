"""
Unit tests for MACD calculator.

Tests the MACD (Moving Average Convergence Divergence) calculator function
with various scenarios including valid inputs, edge cases, and error conditions.
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
import pandas as pd  # noqa: E402
from calculators.macd import (  # noqa: E402
    calculate_macd,
    calculate_macd_series,
    calculate_ema,
)


class TestCalculateEMA:
    """Tests for the EMA calculation helper function."""

    def test_ema_basic_calculation(self):
        """Test basic EMA calculation with simple data."""
        prices = pd.Series([10, 11, 12, 13, 14, 15])
        ema = calculate_ema(prices, 3)

        # EMA should be a series of the same length
        assert len(ema) == len(prices)

        # EMA should follow the trend (increasing in this case)
        assert ema.iloc[-1] > ema.iloc[0]

    def test_ema_with_single_value(self):
        """Test EMA with a single price point."""
        prices = pd.Series([100])
        ema = calculate_ema(prices, 1)

        # With one value, EMA should equal that value
        assert ema.iloc[0] == 100


class TestCalculateMACD:
    """Tests for the main MACD calculation function."""

    def test_macd_with_sufficient_data(self):
        """Test MACD calculation with sufficient data points."""
        # Generate 50 data points with upward trend
        prices = [100 + i * 0.5 for i in range(50)]

        result = calculate_macd(prices)

        # Result should contain all three components
        assert "value" in result
        assert "signal" in result
        assert "histogram" in result

        # All values should be floats
        assert isinstance(result["value"], float)
        assert isinstance(result["signal"], float)
        assert isinstance(result["histogram"], float)

        # Histogram should equal MACD - signal
        assert abs(result["histogram"] - (result["value"] - result["signal"])) < 1e-10

    def test_macd_with_uptrend(self):
        """Test MACD behavior in an uptrend."""
        # Strong uptrend
        prices = [100 + i * 2 for i in range(50)]

        result = calculate_macd(prices)

        # In a strong uptrend, MACD should be positive
        assert result["value"] > 0

    def test_macd_with_downtrend(self):
        """Test MACD behavior in a downtrend."""
        # Strong downtrend
        prices = [200 - i * 2 for i in range(50)]

        result = calculate_macd(prices)

        # In a strong downtrend, MACD should be negative
        assert result["value"] < 0

    def test_macd_with_sideways_market(self):
        """Test MACD in a sideways (range-bound) market."""
        # Oscillating prices around 100
        prices = [100 + (i % 2) * 0.5 for i in range(50)]

        result = calculate_macd(prices)

        # MACD should be close to zero in sideways market
        assert abs(result["value"]) < 1.0

    def test_macd_with_custom_periods(self):
        """Test MACD with custom period parameters."""
        prices = [100 + i * 0.5 for i in range(60)]

        # Use custom periods
        result = calculate_macd(prices, fast_period=8, slow_period=21, signal_period=5)

        assert "value" in result
        assert "signal" in result
        assert "histogram" in result

    def test_macd_insufficient_data(self):
        """Test MACD with insufficient data points."""
        # Only 30 points, but need at least 26 + 9 = 35
        prices = [100 + i for i in range(30)]

        with pytest.raises(ValueError, match="Insufficient data"):
            calculate_macd(prices)

    def test_macd_with_exact_minimum_data(self):
        """Test MACD with exactly the minimum required data points."""
        # Exactly 35 points (26 + 9)
        prices = [100 + i * 0.3 for i in range(35)]

        result = calculate_macd(prices)

        # Should succeed with minimum data
        assert "value" in result
        assert "signal" in result
        assert "histogram" in result

    def test_macd_with_negative_prices(self):
        """Test MACD rejects negative prices."""
        prices = [100 + i for i in range(40)] + [-5]

        with pytest.raises(ValueError, match="All prices must be positive"):
            calculate_macd(prices)

    def test_macd_with_zero_price(self):
        """Test MACD rejects zero prices."""
        prices = [100 + i for i in range(40)] + [0]

        with pytest.raises(ValueError, match="All prices must be positive"):
            calculate_macd(prices)

    def test_macd_with_invalid_periods(self):
        """Test MACD rejects invalid period parameters."""
        prices = [100 + i for i in range(50)]

        # Fast period >= slow period
        with pytest.raises(
            ValueError, match="Fast period must be less than slow period"
        ):
            calculate_macd(prices, fast_period=26, slow_period=12)

        # Zero period
        with pytest.raises(ValueError, match="All periods must be positive"):
            calculate_macd(prices, fast_period=0, slow_period=26)

        # Negative period
        with pytest.raises(ValueError, match="All periods must be positive"):
            calculate_macd(prices, fast_period=12, slow_period=-26)

    def test_macd_real_world_data(self):
        """Test MACD with realistic stock price data."""
        # Simulating realistic price movements
        prices = [
            2450.0,
            2455.5,
            2460.0,
            2458.5,
            2465.0,
            2470.5,
            2468.0,
            2475.0,
            2480.5,
            2478.0,
            2485.0,
            2490.5,
            2488.0,
            2495.0,
            2500.5,
            2498.0,
            2505.0,
            2510.5,
            2508.0,
            2515.0,
            2520.5,
            2518.0,
            2525.0,
            2530.5,
            2528.0,
            2535.0,
            2540.5,
            2538.0,
            2545.0,
            2550.5,
            2548.0,
            2555.0,
            2560.5,
            2558.0,
            2565.0,
            2570.5,
            2568.0,
            2575.0,
            2580.5,
            2578.0,
        ]

        result = calculate_macd(prices)

        # MACD should reflect the uptrend
        assert result["value"] > 0
        # Values should be reasonable relative to price scale
        assert abs(result["value"]) < 100
        assert abs(result["signal"]) < 100

    def test_macd_histogram_sign_consistency(self):
        """Test that histogram correctly indicates MACD position relative to signal."""
        prices = [100 + i * 0.5 for i in range(50)]

        result = calculate_macd(prices)

        # If MACD > signal, histogram should be positive
        if result["value"] > result["signal"]:
            assert result["histogram"] > 0
        # If MACD < signal, histogram should be negative
        elif result["value"] < result["signal"]:
            assert result["histogram"] < 0
        # If equal, histogram should be ~0
        else:
            assert abs(result["histogram"]) < 1e-10


class TestCalculateMACDSeries:
    """Tests for the MACD series calculation function."""

    def test_macd_series_returns_lists(self):
        """Test that MACD series returns lists of values."""
        prices = [100 + i * 0.5 for i in range(50)]

        result = calculate_macd_series(prices)

        assert isinstance(result["value"], list)
        assert isinstance(result["signal"], list)
        assert isinstance(result["histogram"], list)

    def test_macd_series_length_matches_input(self):
        """Test that returned series have same length as input."""
        prices = [100 + i * 0.5 for i in range(50)]

        result = calculate_macd_series(prices)

        assert len(result["value"]) == len(prices)
        assert len(result["signal"]) == len(prices)
        assert len(result["histogram"]) == len(prices)

    def test_macd_series_last_value_matches_single_calculation(self):
        """Test that last value in series matches single MACD calculation."""
        prices = [100 + i * 0.5 for i in range(50)]

        series_result = calculate_macd_series(prices)
        single_result = calculate_macd(prices)

        # Last values should match
        assert abs(series_result["value"][-1] - single_result["value"]) < 1e-10
        assert abs(series_result["signal"][-1] - single_result["signal"]) < 1e-10
        assert abs(series_result["histogram"][-1] - single_result["histogram"]) < 1e-10

    def test_macd_series_with_insufficient_data(self):
        """Test MACD series with insufficient data points."""
        prices = [100 + i for i in range(30)]

        with pytest.raises(ValueError, match="Insufficient data"):
            calculate_macd_series(prices)

    def test_macd_series_histogram_calculation(self):
        """Test that histogram is correctly calculated throughout the series."""
        prices = [100 + i * 0.5 for i in range(50)]

        result = calculate_macd_series(prices)

        # Check histogram = MACD - signal for all points
        for i in range(len(prices)):
            expected_histogram = result["value"][i] - result["signal"][i]
            assert abs(result["histogram"][i] - expected_histogram) < 1e-10


class TestMACDIntegration:
    """Integration tests for MACD calculator with model integration."""

    def test_macd_values_format_for_model(self):
        """Test that MACD output format matches MACDValues model requirements."""
        from models.market_data import MACDValues

        prices = [100 + i * 0.5 for i in range(50)]
        result = calculate_macd(prices)

        # Should be able to create MACDValues model from result
        macd_values = MACDValues(**result)

        assert macd_values.value == result["value"]
        assert macd_values.signal == result["signal"]
        assert macd_values.histogram == result["histogram"]

    def test_macd_with_various_market_conditions(self):
        """Test MACD across different market conditions."""
        test_cases = [
            {
                "name": "strong_bull",
                "prices": [100 + i * 3 for i in range(50)],
                "expected_sign": 1,  # positive MACD
            },
            {
                "name": "strong_bear",
                "prices": [200 - i * 3 for i in range(50)],
                "expected_sign": -1,  # negative MACD
            },
            {
                "name": "volatile_sideways",
                "prices": [100 + (10 if i % 2 else -10) for i in range(50)],
                "expected_range": (-50, 50),  # MACD in reasonable range
            },
        ]

        for case in test_cases:
            result = calculate_macd(case["prices"])

            if "expected_sign" in case:
                if case["expected_sign"] == 1:
                    assert result["value"] > 0, f"Failed for {case['name']}"
                else:
                    assert result["value"] < 0, f"Failed for {case['name']}"

            if "expected_range" in case:
                min_val, max_val = case["expected_range"]
                assert (
                    min_val <= result["value"] <= max_val
                ), f"Failed for {case['name']}"
