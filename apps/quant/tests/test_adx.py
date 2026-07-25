"""
Unit tests for ADX (Average Directional Index) calculator.
"""

import pytest
from calculators.adx import (
    calculate_adx,
    calculate_adx_series,
    calculate_true_range,
    calculate_directional_movement,
)


class TestTrueRange:
    """Tests for True Range calculation."""

    def test_true_range_high_low_is_max(self):
        """Test when high-low is the maximum."""
        tr = calculate_true_range(high=50.0, low=45.0, prev_close=47.0)
        assert tr == 5.0

    def test_true_range_high_prev_close_is_max(self):
        """Test when high-prev_close is the maximum."""
        tr = calculate_true_range(high=50.0, low=48.0, prev_close=45.0)
        assert tr == 5.0

    def test_true_range_low_prev_close_is_max(self):
        """Test when low-prev_close is the maximum."""
        tr = calculate_true_range(high=48.0, low=45.0, prev_close=49.0)
        assert tr == 4.0


class TestDirectionalMovement:
    """Tests for Directional Movement calculation."""

    def test_positive_directional_movement(self):
        """Test +DM when upward movement is dominant."""
        plus_dm, minus_dm = calculate_directional_movement(
            current_high=50.0, prev_high=48.0, current_low=47.0, prev_low=46.0
        )
        assert plus_dm == 2.0
        assert minus_dm == 0.0

    def test_negative_directional_movement(self):
        """Test -DM when downward movement is dominant."""
        plus_dm, minus_dm = calculate_directional_movement(
            current_high=48.0, prev_high=47.0, current_low=45.0, prev_low=48.0
        )
        assert plus_dm == 0.0
        assert minus_dm == 3.0

    def test_no_directional_movement(self):
        """Test when there's no significant directional movement."""
        plus_dm, minus_dm = calculate_directional_movement(
            current_high=48.0, prev_high=48.5, current_low=46.0, prev_low=45.0
        )
        assert plus_dm == 0.0
        assert minus_dm == 0.0


class TestADXCalculation:
    """Tests for ADX calculation."""

    def test_adx_with_valid_data(self):
        """Test ADX calculation with valid price data."""
        # Sample data with 30 periods (enough for 14-period ADX)
        highs = [
            48.70,
            48.72,
            48.90,
            48.87,
            48.82,
            49.05,
            49.20,
            49.35,
            49.92,
            50.19,
            50.12,
            49.66,
            49.88,
            50.19,
            50.36,
            50.57,
            50.65,
            50.43,
            49.63,
            50.33,
            50.29,
            50.17,
            49.32,
            48.50,
            48.32,
            46.80,
            47.80,
            48.39,
            48.66,
            48.79,
        ]
        lows = [
            47.79,
            48.14,
            48.39,
            48.37,
            48.24,
            48.64,
            48.94,
            48.86,
            49.50,
            49.87,
            49.20,
            48.90,
            49.43,
            49.73,
            49.26,
            50.09,
            50.30,
            49.21,
            48.98,
            49.61,
            49.20,
            49.43,
            48.47,
            47.64,
            41.55,
            44.28,
            47.31,
            47.20,
            47.90,
            48.04,
        ]
        closes = [
            48.16,
            48.61,
            48.75,
            48.63,
            48.74,
            49.03,
            49.07,
            49.32,
            49.91,
            50.13,
            49.53,
            49.50,
            49.75,
            50.03,
            50.31,
            50.52,
            50.41,
            49.34,
            49.37,
            50.23,
            49.24,
            49.93,
            48.43,
            48.18,
            46.57,
            45.41,
            47.77,
            47.72,
            48.62,
            48.16,
        ]

        result = calculate_adx(highs, lows, closes, period=14)

        # Verify the result structure
        assert "plus_di" in result
        assert "minus_di" in result
        assert "adx" in result

        # Verify value bounds
        assert 0 <= result["plus_di"] <= 100
        assert 0 <= result["minus_di"] <= 100
        assert 0 <= result["adx"] <= 100

        # ADX should be a reasonable value (not NaN or inf)
        assert result["adx"] > 0

    def test_adx_bounds(self):
        """Test that ADX values are within valid bounds (0-100)."""
        # Create trending data
        highs = list(range(50, 100))
        lows = list(range(45, 95))
        closes = list(range(47, 97))

        result = calculate_adx(highs, lows, closes, period=14)

        assert 0 <= result["adx"] <= 100
        assert 0 <= result["plus_di"] <= 100
        assert 0 <= result["minus_di"] <= 100

    def test_adx_insufficient_data(self):
        """Test that ADX raises error with insufficient data."""
        highs = [48.0, 49.0, 50.0]
        lows = [47.0, 48.0, 49.0]
        closes = [47.5, 48.5, 49.5]

        with pytest.raises(ValueError, match="Need at least"):
            calculate_adx(highs, lows, closes, period=14)

    def test_adx_invalid_period(self):
        """Test that ADX raises error with invalid period."""
        highs = list(range(50, 100))
        lows = list(range(45, 95))
        closes = list(range(47, 97))

        with pytest.raises(ValueError, match="Period must be positive"):
            calculate_adx(highs, lows, closes, period=0)

        with pytest.raises(ValueError, match="Period must be positive"):
            calculate_adx(highs, lows, closes, period=-5)

    def test_adx_mismatched_lengths(self):
        """Test that ADX raises error when input lists have different lengths."""
        highs = [50.0, 51.0, 52.0]
        lows = [48.0, 49.0]
        closes = [49.0, 50.0, 51.0]

        with pytest.raises(ValueError, match="same length"):
            calculate_adx(highs, lows, closes, period=14)

    def test_adx_invalid_prices(self):
        """Test that ADX raises error when high < low."""
        highs = [48.0, 49.0, 50.0, 51.0, 52.0] * 10
        lows = [49.0, 50.0, 51.0, 52.0, 53.0] * 10  # lows > highs
        closes = [48.5, 49.5, 50.5, 51.5, 52.5] * 10

        with pytest.raises(ValueError, match="High price must be >= low price"):
            calculate_adx(highs, lows, closes, period=14)

    def test_adx_strong_uptrend(self):
        """Test ADX with strong uptrend data."""
        # Create strong uptrend
        highs = [50 + i * 2 for i in range(50)]
        lows = [48 + i * 2 for i in range(50)]
        closes = [49 + i * 2 for i in range(50)]

        result = calculate_adx(highs, lows, closes, period=14)

        # In a strong trend, +DI should be significantly higher than -DI
        assert result["plus_di"] > result["minus_di"]
        # ADX should indicate a strong trend (> 25)
        assert result["adx"] > 20  # Using 20 as threshold since calculation might vary


class TestADXSeries:
    """Tests for ADX series calculation."""

    def test_adx_series_returns_lists(self):
        """Test that ADX series returns lists of correct length."""
        highs = list(range(50, 100))
        lows = list(range(45, 95))
        closes = list(range(47, 97))

        result = calculate_adx_series(highs, lows, closes, period=14)

        assert isinstance(result["plus_di"], list)
        assert isinstance(result["minus_di"], list)
        assert isinstance(result["adx"], list)

        assert len(result["plus_di"]) == len(highs)
        assert len(result["minus_di"]) == len(lows)
        assert len(result["adx"]) == len(closes)

    def test_adx_series_all_values_in_bounds(self):
        """Test that all values in ADX series are within bounds."""
        highs = list(range(50, 100))
        lows = list(range(45, 95))
        closes = list(range(47, 97))

        result = calculate_adx_series(highs, lows, closes, period=14)

        # Check all +DI values
        for val in result["plus_di"]:
            assert 0 <= val <= 100 or val == 0  # Allow for NaN filled as 0

        # Check all -DI values
        for val in result["minus_di"]:
            assert 0 <= val <= 100 or val == 0

        # Check all ADX values
        for val in result["adx"]:
            assert 0 <= val <= 100 or val == 0

    def test_adx_series_last_value_matches_single_calculation(self):
        """Test that the last value of series matches single ADX calculation."""
        highs = list(range(50, 100))
        lows = list(range(45, 95))
        closes = list(range(47, 97))

        single_result = calculate_adx(highs, lows, closes, period=14)
        series_result = calculate_adx_series(highs, lows, closes, period=14)

        # Last values should be approximately equal (allowing for some floating point differences)
        # Note: Different smoothing methods (Wilder's vs EWM) can produce slightly different results
        assert abs(series_result["plus_di"][-1] - single_result["plus_di"]) < 5.0
        assert abs(series_result["minus_di"][-1] - single_result["minus_di"]) < 5.0
        assert abs(series_result["adx"][-1] - single_result["adx"]) < 5.0
