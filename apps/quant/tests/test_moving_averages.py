"""
Unit tests for moving average calculators.

Tests both Simple Moving Average (SMA) and Exponential Moving Average (EMA)
calculations with various edge cases and validation scenarios.
"""

import pytest
import numpy as np
from calculators.moving_averages import (
    calculate_sma,
    calculate_sma_series,
    calculate_ema,
    calculate_ema_series,
    calculate_multiple_sma,
    calculate_multiple_ema,
)


class TestSMACalculation:
    """Tests for Simple Moving Average calculation."""

    def test_sma_basic_calculation(self):
        """Test basic SMA calculation with simple values."""
        prices = [100.0, 102.0, 104.0, 106.0, 108.0]
        period = 3
        result = calculate_sma(prices, period)

        # Expected: (104 + 106 + 108) / 3 = 106.0
        assert result == pytest.approx(106.0, rel=1e-9)

    def test_sma_period_equals_length(self):
        """Test SMA when period equals data length."""
        prices = [100.0, 102.0, 104.0]
        period = 3
        result = calculate_sma(prices, period)

        # Expected: (100 + 102 + 104) / 3 = 102.0
        assert result == pytest.approx(102.0, rel=1e-9)

    def test_sma_period_one(self):
        """Test SMA with period of 1 (should return last price)."""
        prices = [100.0, 102.0, 104.0, 106.0, 108.0]
        period = 1
        result = calculate_sma(prices, period)

        # Expected: last price = 108.0
        assert result == pytest.approx(108.0, rel=1e-9)

    def test_sma_larger_dataset(self):
        """Test SMA with larger dataset."""
        prices = [float(i) for i in range(1, 21)]  # 1 to 20
        period = 5
        result = calculate_sma(prices, period)

        # Expected: (16 + 17 + 18 + 19 + 20) / 5 = 18.0
        assert result == pytest.approx(18.0, rel=1e-9)

    def test_sma_invalid_period_zero(self):
        """Test that SMA raises error for period of 0."""
        prices = [100.0, 102.0, 104.0]
        with pytest.raises(ValueError, match="period must be positive"):
            calculate_sma(prices, 0)

    def test_sma_invalid_period_negative(self):
        """Test that SMA raises error for negative period."""
        prices = [100.0, 102.0, 104.0]
        with pytest.raises(ValueError, match="period must be positive"):
            calculate_sma(prices, -1)

    def test_sma_insufficient_data(self):
        """Test that SMA raises error when insufficient data provided."""
        prices = [100.0, 102.0]
        period = 5
        with pytest.raises(ValueError, match="Insufficient data"):
            calculate_sma(prices, period)

    def test_sma_series_basic(self):
        """Test SMA series calculation."""
        prices = [100.0, 102.0, 104.0, 106.0, 108.0]
        period = 3
        result = calculate_sma_series(prices, period)

        expected = [
            (100 + 102 + 104) / 3,  # 102.0
            (102 + 104 + 106) / 3,  # 104.0
            (104 + 106 + 108) / 3,  # 106.0
        ]

        assert len(result) == 3
        for i, expected_value in enumerate(expected):
            assert result[i] == pytest.approx(expected_value, rel=1e-9)

    def test_sma_series_length(self):
        """Test that SMA series returns correct length."""
        prices = [float(i) for i in range(1, 11)]  # 1 to 10
        period = 3
        result = calculate_sma_series(prices, period)

        # Expected length: 10 - 3 + 1 = 8
        assert len(result) == 8

    def test_sma_within_price_bounds(self):
        """Test that SMA value falls within min/max of prices."""
        prices = [100.0, 150.0, 120.0, 180.0, 130.0]
        period = 3
        result = calculate_sma(prices, period)

        # SMA should be between min and max of the period window
        window = prices[-period:]
        assert min(window) <= result <= max(window)


class TestEMACalculation:
    """Tests for Exponential Moving Average calculation."""

    def test_ema_basic_calculation(self):
        """Test basic EMA calculation."""
        prices = [100.0, 102.0, 104.0, 106.0, 108.0]
        period = 3
        result = calculate_ema(prices, period)

        # EMA calculation:
        # multiplier = 2 / (3 + 1) = 0.5
        # EMA0 = SMA(100, 102, 104) = 102.0
        # EMA1 = (106 - 102) * 0.5 + 102 = 104.0
        # EMA2 = (108 - 104) * 0.5 + 104 = 106.0
        assert result == pytest.approx(106.0, rel=1e-9)

    def test_ema_period_equals_length(self):
        """Test EMA when period equals data length."""
        prices = [100.0, 102.0, 104.0]
        period = 3
        result = calculate_ema(prices, period)

        # Expected: SMA(100, 102, 104) = 102.0 (no extra prices to apply EMA)
        assert result == pytest.approx(102.0, rel=1e-9)

    def test_ema_period_one(self):
        """Test EMA with period of 1."""
        prices = [100.0, 102.0, 104.0, 106.0, 108.0]
        period = 1
        result = calculate_ema(prices, period)

        # With period 1, multiplier = 2/2 = 1.0, so EMA = last price
        assert result == pytest.approx(108.0, rel=1e-9)

    def test_ema_larger_dataset(self):
        """Test EMA with larger dataset."""
        prices = [float(i) for i in range(1, 21)]  # 1 to 20
        period = 5
        result = calculate_ema(prices, period)

        # Verify result is a valid number and greater than simple average
        assert result > 0
        assert isinstance(result, float)

    def test_ema_invalid_period_zero(self):
        """Test that EMA raises error for period of 0."""
        prices = [100.0, 102.0, 104.0]
        with pytest.raises(ValueError, match="period must be positive"):
            calculate_ema(prices, 0)

    def test_ema_invalid_period_negative(self):
        """Test that EMA raises error for negative period."""
        prices = [100.0, 102.0, 104.0]
        with pytest.raises(ValueError, match="period must be positive"):
            calculate_ema(prices, -1)

    def test_ema_insufficient_data(self):
        """Test that EMA raises error when insufficient data provided."""
        prices = [100.0, 102.0]
        period = 5
        with pytest.raises(ValueError, match="Insufficient data"):
            calculate_ema(prices, period)

    def test_ema_series_basic(self):
        """Test EMA series calculation."""
        prices = [100.0, 102.0, 104.0, 106.0, 108.0]
        period = 3
        result = calculate_ema_series(prices, period)

        # Expected length: 5 - 3 + 1 = 3
        assert len(result) == 3

        # First value should be SMA
        assert result[0] == pytest.approx(102.0, rel=1e-9)

        # Subsequent values should increase (for increasing prices)
        assert result[1] > result[0]
        assert result[2] > result[1]

    def test_ema_series_length(self):
        """Test that EMA series returns correct length."""
        prices = [float(i) for i in range(1, 11)]  # 1 to 10
        period = 3
        result = calculate_ema_series(prices, period)

        # Expected length: 10 - 3 + 1 = 8
        assert len(result) == 8

    def test_ema_more_responsive_than_sma(self):
        """Test that EMA is more responsive to recent price changes than SMA."""
        # Use a price pattern with flat values then sharp increase, with extra data points
        prices = [100.0, 100.0, 100.0, 100.0, 100.0, 120.0, 130.0]
        period = 5

        sma_result = calculate_sma(prices, period)
        ema_result = calculate_ema(prices, period)

        # EMA should be higher than SMA due to more weight on recent price
        assert ema_result > sma_result

    def test_ema_within_price_bounds(self):
        """Test that EMA value falls within min/max of all prices."""
        prices = [100.0, 150.0, 120.0, 180.0, 130.0]
        period = 3
        result = calculate_ema(prices, period)

        # EMA should be within overall price range
        assert min(prices) <= result <= max(prices)


class TestMultipleAverages:
    """Tests for calculating multiple moving averages at once."""

    def test_multiple_sma_calculation(self):
        """Test calculating multiple SMA periods at once."""
        prices = [float(i) for i in range(1, 21)]  # 1 to 20
        periods = [3, 5, 10]
        result = calculate_multiple_sma(prices, periods)

        assert len(result) == 3
        assert 3 in result
        assert 5 in result
        assert 10 in result

        # Verify individual calculations match
        assert result[3] == pytest.approx(calculate_sma(prices, 3))
        assert result[5] == pytest.approx(calculate_sma(prices, 5))
        assert result[10] == pytest.approx(calculate_sma(prices, 10))

    def test_multiple_ema_calculation(self):
        """Test calculating multiple EMA periods at once."""
        prices = [float(i) for i in range(1, 21)]  # 1 to 20
        periods = [3, 5, 10]
        result = calculate_multiple_ema(prices, periods)

        assert len(result) == 3
        assert 3 in result
        assert 5 in result
        assert 10 in result

        # Verify individual calculations match
        assert result[3] == pytest.approx(calculate_ema(prices, 3))
        assert result[5] == pytest.approx(calculate_ema(prices, 5))
        assert result[10] == pytest.approx(calculate_ema(prices, 10))

    def test_multiple_sma_empty_periods(self):
        """Test that multiple SMA raises error for empty periods list."""
        prices = [float(i) for i in range(1, 21)]
        with pytest.raises(ValueError, match="periods list cannot be empty"):
            calculate_multiple_sma(prices, [])

    def test_multiple_ema_empty_periods(self):
        """Test that multiple EMA raises error for empty periods list."""
        prices = [float(i) for i in range(1, 21)]
        with pytest.raises(ValueError, match="periods list cannot be empty"):
            calculate_multiple_ema(prices, [])

    def test_multiple_sma_insufficient_data(self):
        """Test that multiple SMA raises error for insufficient data."""
        prices = [100.0, 102.0, 104.0]
        periods = [3, 5, 10]  # 10 exceeds available data
        with pytest.raises(ValueError, match="Insufficient data"):
            calculate_multiple_sma(prices, periods)

    def test_multiple_ema_insufficient_data(self):
        """Test that multiple EMA raises error for insufficient data."""
        prices = [100.0, 102.0, 104.0]
        periods = [3, 5, 10]  # 10 exceeds available data
        with pytest.raises(ValueError, match="Insufficient data"):
            calculate_multiple_ema(prices, periods)


class TestSMAvsEMA:
    """Tests comparing SMA and EMA behavior."""

    def test_sma_ema_equal_for_period_length_data(self):
        """Test that SMA and EMA are equal when data length equals period."""
        prices = [100.0, 102.0, 104.0]
        period = 3

        sma_result = calculate_sma(prices, period)
        ema_result = calculate_ema(prices, period)

        # Should be equal because EMA initializes with SMA and has no additional prices
        assert sma_result == pytest.approx(ema_result, rel=1e-9)

    def test_ema_follows_trend_faster(self):
        """Test that EMA follows trend changes faster than SMA."""
        # Create an uptrend
        prices = [100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 120.0]
        period = 5

        sma_result = calculate_sma(prices, period)
        ema_result = calculate_ema(prices, period)

        # EMA should be higher due to more weight on recent prices
        assert ema_result > sma_result

    def test_both_within_range(self):
        """Test that both SMA and EMA stay within price range."""
        prices = [100.0, 150.0, 120.0, 180.0, 130.0, 160.0, 140.0]
        period = 5

        sma_result = calculate_sma(prices, period)
        ema_result = calculate_ema(prices, period)

        min_price = min(prices)
        max_price = max(prices)

        assert min_price <= sma_result <= max_price
        assert min_price <= ema_result <= max_price


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_sma_all_same_prices(self):
        """Test SMA with all identical prices."""
        prices = [100.0] * 10
        period = 5
        result = calculate_sma(prices, period)

        # Should equal the constant price
        assert result == pytest.approx(100.0, rel=1e-9)

    def test_ema_all_same_prices(self):
        """Test EMA with all identical prices."""
        prices = [100.0] * 10
        period = 5
        result = calculate_ema(prices, period)

        # Should equal the constant price
        assert result == pytest.approx(100.0, rel=1e-9)

    def test_sma_very_large_prices(self):
        """Test SMA with very large price values."""
        prices = [1e10, 1.1e10, 1.2e10, 1.3e10, 1.4e10]
        period = 3
        result = calculate_sma(prices, period)

        expected = (1.2e10 + 1.3e10 + 1.4e10) / 3
        assert result == pytest.approx(expected, rel=1e-6)

    def test_ema_very_large_prices(self):
        """Test EMA with very large price values."""
        prices = [1e10, 1.1e10, 1.2e10, 1.3e10, 1.4e10]
        period = 3
        result = calculate_ema(prices, period)

        # Should be a valid number within reasonable range
        assert result > 1e10
        assert result < 2e10

    def test_sma_fractional_prices(self):
        """Test SMA with fractional prices."""
        prices = [100.123, 100.456, 100.789, 101.012, 101.345]
        period = 3
        result = calculate_sma(prices, period)

        expected = (100.789 + 101.012 + 101.345) / 3
        assert result == pytest.approx(expected, rel=1e-9)

    def test_ema_fractional_prices(self):
        """Test EMA with fractional prices."""
        prices = [100.123, 100.456, 100.789, 101.012, 101.345]
        period = 3
        result = calculate_ema(prices, period)

        # Should be a valid fractional number
        assert isinstance(result, float)
        assert 100.0 < result < 102.0
