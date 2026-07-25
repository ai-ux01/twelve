"""
Unit tests for Bollinger Bands calculator.

Tests cover:
- Basic calculation correctness
- Edge cases (minimal data, zero volatility)
- Input validation
- Bollinger Bands properties (upper > middle > lower)
"""

import pytest
import math
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import directly from bollinger module file
from calculators.bollinger import (  # noqa: E402
    calculate_bollinger_bands,
    calculate_bollinger_bands_series,
)


class TestCalculateBollingerBands:
    """Tests for single-point Bollinger Bands calculation."""

    def test_basic_calculation(self):
        """Test basic Bollinger Bands calculation with known values."""
        # Simple test case: 20 values from 100 to 119
        prices = list(range(100, 120))
        upper, middle, lower = calculate_bollinger_bands(prices, period=20, num_std=2.0)

        # Expected middle band (SMA): mean of 100-119 = 109.5
        assert abs(middle - 109.5) < 0.01

        # Standard deviation of 100-119
        # Std dev = sqrt(sum((x - mean)^2) / N) for population
        expected_std = math.sqrt(sum((x - 109.5) ** 2 for x in range(100, 120)) / 20)
        expected_upper = 109.5 + 2 * expected_std
        expected_lower = 109.5 - 2 * expected_std

        assert abs(upper - expected_upper) < 0.01
        assert abs(lower - expected_lower) < 0.01

    def test_bollinger_bands_ordering(self):
        """Test that upper > middle > lower always holds."""
        prices = [
            100,
            102,
            101,
            103,
            105,
            104,
            106,
            108,
            107,
            109,
            110,
            112,
            111,
            113,
            115,
            114,
            116,
            118,
            117,
            119,
            120,
        ]
        upper, middle, lower = calculate_bollinger_bands(prices, period=20)

        assert upper > middle, f"Upper band {upper} should be > middle band {middle}"
        assert middle > lower, f"Middle band {middle} should be > lower band {lower}"

    def test_zero_volatility(self):
        """Test Bollinger Bands with zero volatility (all prices equal)."""
        prices = [100.0] * 20
        upper, middle, lower = calculate_bollinger_bands(prices, period=20)

        # When std dev is 0, all bands should be equal to the price
        assert abs(upper - 100.0) < 0.01
        assert abs(middle - 100.0) < 0.01
        assert abs(lower - 100.0) < 0.01

    def test_custom_period(self):
        """Test Bollinger Bands with custom period."""
        prices = list(range(100, 115))  # 15 values
        upper, middle, lower = calculate_bollinger_bands(prices, period=10, num_std=2.0)

        # Should use only the last 10 values (105-114)
        expected_middle = sum(range(105, 115)) / 10
        assert abs(middle - expected_middle) < 0.01

    def test_custom_num_std(self):
        """Test Bollinger Bands with custom number of standard deviations."""
        prices = list(range(100, 120))
        upper_2std, middle_2std, lower_2std = calculate_bollinger_bands(
            prices, period=20, num_std=2.0
        )
        upper_1std, middle_1std, lower_1std = calculate_bollinger_bands(
            prices, period=20, num_std=1.0
        )

        # Middle band should be the same
        assert abs(middle_2std - middle_1std) < 0.01

        # 2-std bands should be wider than 1-std bands
        bandwidth_2std = upper_2std - lower_2std
        bandwidth_1std = upper_1std - lower_1std
        assert bandwidth_2std > bandwidth_1std

    def test_insufficient_data(self):
        """Test that ValueError is raised when insufficient data is provided."""
        prices = [100, 101, 102]  # Only 3 prices
        with pytest.raises(ValueError, match="Insufficient data"):
            calculate_bollinger_bands(prices, period=20)

    def test_invalid_period(self):
        """Test that ValueError is raised for invalid period."""
        prices = list(range(100, 120))
        with pytest.raises(ValueError, match="Period must be at least 2"):
            calculate_bollinger_bands(prices, period=1)

    def test_negative_num_std(self):
        """Test that ValueError is raised for negative num_std."""
        prices = list(range(100, 120))
        with pytest.raises(ValueError, match="must be non-negative"):
            calculate_bollinger_bands(prices, period=20, num_std=-1.0)

    def test_exact_period_data(self):
        """Test with exactly the required number of data points."""
        prices = list(range(100, 120))  # Exactly 20 prices
        upper, middle, lower = calculate_bollinger_bands(prices, period=20)

        # Should calculate successfully
        assert upper > middle > lower

    def test_realistic_price_data(self):
        """Test with realistic price movements."""
        # Simulate realistic stock price data
        prices = [
            2450.0,
            2455.5,
            2460.0,
            2458.5,
            2462.0,
            2465.0,
            2463.5,
            2468.0,
            2470.5,
            2475.0,
            2472.5,
            2478.0,
            2480.5,
            2485.0,
            2482.5,
            2488.0,
            2490.5,
            2495.0,
            2492.5,
            2498.0,
            2500.5,
        ]
        upper, middle, lower = calculate_bollinger_bands(prices, period=20)

        # Basic sanity checks
        assert upper > middle > lower
        assert upper > 2500  # Should be above the highest price
        assert lower < 2450  # Should be below the lowest price
        assert 2450 < middle < 2500  # Middle should be in the price range


class TestCalculateBollingerBandsSeries:
    """Tests for time-series Bollinger Bands calculation."""

    def test_series_calculation(self):
        """Test that series calculation produces correct length output."""
        prices = list(range(100, 130))  # 30 prices
        upper, middle, lower = calculate_bollinger_bands_series(prices, period=20)

        assert len(upper) == len(prices)
        assert len(middle) == len(prices)
        assert len(lower) == len(prices)

    def test_series_nan_values(self):
        """Test that insufficient data points are marked as NaN."""
        prices = list(range(100, 130))  # 30 prices
        upper, middle, lower = calculate_bollinger_bands_series(prices, period=20)

        # First 19 values should be NaN
        for i in range(19):
            assert math.isnan(upper[i]), f"upper[{i}] should be NaN"
            assert math.isnan(middle[i]), f"middle[{i}] should be NaN"
            assert math.isnan(lower[i]), f"lower[{i}] should be NaN"

        # Values from index 19 onwards should be valid numbers
        for i in range(19, len(prices)):
            assert not math.isnan(upper[i]), f"upper[{i}] should not be NaN"
            assert not math.isnan(middle[i]), f"middle[{i}] should not be NaN"
            assert not math.isnan(lower[i]), f"lower[{i}] should not be NaN"

    def test_series_last_value_matches_single(self):
        """Test that the last value in series matches single-point calculation."""
        prices = list(range(100, 130))  # 30 prices
        upper_series, middle_series, lower_series = calculate_bollinger_bands_series(
            prices, period=20
        )
        upper_single, middle_single, lower_single = calculate_bollinger_bands(
            prices, period=20
        )

        # Last values should match
        assert abs(upper_series[-1] - upper_single) < 0.01
        assert abs(middle_series[-1] - middle_single) < 0.01
        assert abs(lower_series[-1] - lower_single) < 0.01

    def test_series_ordering_throughout(self):
        """Test that upper > middle > lower holds for all valid points."""
        prices = list(range(100, 130))  # 30 prices
        upper, middle, lower = calculate_bollinger_bands_series(prices, period=20)

        # Check ordering for all valid points
        for i in range(19, len(prices)):
            assert upper[i] > middle[i], f"At index {i}: upper should be > middle"
            assert middle[i] > lower[i], f"At index {i}: middle should be > lower"

    def test_series_with_custom_period(self):
        """Test series calculation with custom period."""
        prices = list(range(100, 120))  # 20 prices
        upper, middle, lower = calculate_bollinger_bands_series(prices, period=5)

        # First 4 values should be NaN
        for i in range(4):
            assert math.isnan(upper[i])

        # Values from index 4 onwards should be valid
        for i in range(4, len(prices)):
            assert not math.isnan(upper[i])
            assert upper[i] > middle[i] > lower[i]

    def test_series_invalid_period(self):
        """Test that ValueError is raised for invalid period in series calculation."""
        prices = list(range(100, 120))
        with pytest.raises(ValueError, match="Period must be at least 2"):
            calculate_bollinger_bands_series(prices, period=1)

    def test_series_negative_num_std(self):
        """Test that ValueError is raised for negative num_std in series calculation."""
        prices = list(range(100, 120))
        with pytest.raises(ValueError, match="must be non-negative"):
            calculate_bollinger_bands_series(prices, period=20, num_std=-1.0)
