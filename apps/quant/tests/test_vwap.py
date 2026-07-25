"""
Unit tests for VWAP (Volume Weighted Average Price) calculator.
"""

import pytest
from calculators.vwap import (
    calculate_vwap,
    calculate_vwap_series,
    calculate_vwap_with_bands,
)


class TestCalculateVWAP:
    """Test cases for calculate_vwap function."""

    def test_basic_vwap_calculation(self):
        """Test basic VWAP calculation with simple values."""
        highs = [100.0, 102.0, 104.0]
        lows = [98.0, 100.0, 102.0]
        closes = [99.0, 101.0, 103.0]
        volumes = [1000.0, 1500.0, 2000.0]

        vwap = calculate_vwap(highs, lows, closes, volumes)

        # Manual calculation:
        # Typical prices: [99, 101, 103]
        # VWAP = (99*1000 + 101*1500 + 103*2000) / (1000 + 1500 + 2000)
        # VWAP = (99000 + 151500 + 206000) / 4500 = 456500 / 4500 = 101.444...
        expected = 456500.0 / 4500.0
        assert abs(vwap - expected) < 0.01

    def test_vwap_within_price_range(self):
        """Test that VWAP stays within the price range."""
        highs = [100.0, 110.0, 120.0, 115.0]
        lows = [95.0, 105.0, 115.0, 110.0]
        closes = [98.0, 108.0, 118.0, 113.0]
        volumes = [1000.0, 1500.0, 2000.0, 1800.0]

        vwap = calculate_vwap(highs, lows, closes, volumes)

        # VWAP should be within the range of all prices
        min_price = min(min(lows), min(closes))
        max_price = max(max(highs), max(closes))

        assert min_price <= vwap <= max_price

    def test_vwap_equal_volumes(self):
        """Test VWAP with equal volumes (should be close to simple average)."""
        highs = [100.0, 102.0, 104.0]
        lows = [98.0, 100.0, 102.0]
        closes = [99.0, 101.0, 103.0]
        volumes = [1000.0, 1000.0, 1000.0]  # Equal volumes

        vwap = calculate_vwap(highs, lows, closes, volumes)

        # With equal volumes, VWAP should equal the average of typical prices
        typical_prices = [(h + l + c) / 3 for h, l, c in zip(highs, lows, closes)]
        expected = sum(typical_prices) / len(typical_prices)

        assert abs(vwap - expected) < 0.01

    def test_vwap_single_data_point(self):
        """Test VWAP with a single data point."""
        highs = [100.0]
        lows = [98.0]
        closes = [99.0]
        volumes = [1000.0]

        vwap = calculate_vwap(highs, lows, closes, volumes)

        # VWAP should equal the typical price
        expected = (100.0 + 98.0 + 99.0) / 3.0
        assert abs(vwap - expected) < 0.01

    def test_vwap_high_volume_weight(self):
        """Test that high volume periods have more weight in VWAP."""
        # Period 1: low volume, high price
        # Period 2: high volume, low price
        highs = [110.0, 100.0]
        lows = [108.0, 98.0]
        closes = [109.0, 99.0]
        volumes = [100.0, 10000.0]  # Second period has 100x volume

        vwap = calculate_vwap(highs, lows, closes, volumes)

        # VWAP should be much closer to the high-volume low-price period
        typical_price_high_vol = (100.0 + 98.0 + 99.0) / 3.0  # ~99
        typical_price_low_vol = (110.0 + 108.0 + 109.0) / 3.0  # ~109

        # VWAP should be closer to 99 than to 109
        assert abs(vwap - typical_price_high_vol) < abs(vwap - typical_price_low_vol)

    def test_vwap_with_session_reset(self):
        """Test VWAP with session reset."""
        highs = [100.0, 102.0, 104.0, 106.0]
        lows = [98.0, 100.0, 102.0, 104.0]
        closes = [99.0, 101.0, 103.0, 105.0]
        volumes = [1000.0, 1500.0, 2000.0, 1800.0]
        session_starts = [True, False, True, False]  # Reset at index 0 and 2

        vwap = calculate_vwap(highs, lows, closes, volumes, session_starts)

        # Should only calculate from last session start (index 2)
        typical_3 = (104.0 + 102.0 + 103.0) / 3.0
        typical_4 = (106.0 + 104.0 + 105.0) / 3.0
        expected = (typical_3 * 2000.0 + typical_4 * 1800.0) / (2000.0 + 1800.0)

        assert abs(vwap - expected) < 0.01

    def test_vwap_zero_volume(self):
        """Test VWAP with zero total volume."""
        highs = [100.0, 102.0]
        lows = [98.0, 100.0]
        closes = [99.0, 101.0]
        volumes = [0.0, 0.0]

        vwap = calculate_vwap(highs, lows, closes, volumes)

        # With zero volume, should return last typical price
        expected = (102.0 + 100.0 + 101.0) / 3.0
        assert abs(vwap - expected) < 0.01

    def test_vwap_invalid_inputs(self):
        """Test VWAP with invalid inputs."""
        # Mismatched lengths
        with pytest.raises(ValueError, match="same length"):
            calculate_vwap([100.0], [98.0], [99.0], [1000.0, 1500.0])

        # Empty lists
        with pytest.raises(ValueError, match="cannot be empty"):
            calculate_vwap([], [], [], [])

        # High < Low
        with pytest.raises(ValueError, match="greater than or equal"):
            calculate_vwap([98.0], [100.0], [99.0], [1000.0])

        # Negative volume
        with pytest.raises(ValueError, match="non-negative"):
            calculate_vwap([100.0], [98.0], [99.0], [-1000.0])

        # Mismatched session_starts length
        with pytest.raises(ValueError, match="session_starts length"):
            calculate_vwap([100.0], [98.0], [99.0], [1000.0], [True, False])


class TestCalculateVWAPSeries:
    """Test cases for calculate_vwap_series function."""

    def test_vwap_series_basic(self):
        """Test basic VWAP series calculation."""
        highs = [100.0, 102.0, 104.0]
        lows = [98.0, 100.0, 102.0]
        closes = [99.0, 101.0, 103.0]
        volumes = [1000.0, 1500.0, 2000.0]

        vwap_series = calculate_vwap_series(highs, lows, closes, volumes)

        assert len(vwap_series) == 3

        # Last value should match single VWAP calculation
        vwap_single = calculate_vwap(highs, lows, closes, volumes)
        assert abs(vwap_series[-1] - vwap_single) < 0.01

    def test_vwap_series_increasing(self):
        """Test that VWAP series is monotonically increasing with increasing prices."""
        highs = [100.0, 105.0, 110.0, 115.0]
        lows = [98.0, 103.0, 108.0, 113.0]
        closes = [99.0, 104.0, 109.0, 114.0]
        volumes = [1000.0, 1000.0, 1000.0, 1000.0]  # Equal volumes

        vwap_series = calculate_vwap_series(highs, lows, closes, volumes)

        # With equal volumes and increasing prices, VWAP should generally increase
        for i in range(len(vwap_series) - 1):
            assert vwap_series[i] <= vwap_series[i + 1]

    def test_vwap_series_with_session_resets(self):
        """Test VWAP series with session resets."""
        highs = [100.0, 102.0, 110.0, 112.0]
        lows = [98.0, 100.0, 108.0, 110.0]
        closes = [99.0, 101.0, 109.0, 111.0]
        volumes = [1000.0, 1500.0, 2000.0, 1800.0]
        session_starts = [True, False, True, False]  # Reset at index 0 and 2

        vwap_series = calculate_vwap_series(
            highs, lows, closes, volumes, session_starts
        )

        # After reset at index 2, VWAP should jump (reset to new session)
        # vwap_series[2] should be based only on index 2
        typical_2 = (110.0 + 108.0 + 109.0) / 3.0
        assert abs(vwap_series[2] - typical_2) < 0.01

    def test_vwap_series_all_within_range(self):
        """Test that all VWAP series values are within price range."""
        highs = [100.0, 110.0, 105.0, 115.0]
        lows = [95.0, 105.0, 100.0, 110.0]
        closes = [98.0, 108.0, 103.0, 113.0]
        volumes = [1000.0, 1500.0, 2000.0, 1800.0]

        vwap_series = calculate_vwap_series(highs, lows, closes, volumes)

        min_price = min(min(lows), min(closes))
        max_price = max(max(highs), max(closes))

        for vwap in vwap_series:
            assert min_price <= vwap <= max_price


class TestCalculateVWAPWithBands:
    """Test cases for calculate_vwap_with_bands function."""

    def test_vwap_with_bands_basic(self):
        """Test basic VWAP with bands calculation."""
        highs = [100.0, 102.0, 104.0, 106.0]
        lows = [98.0, 100.0, 102.0, 104.0]
        closes = [99.0, 101.0, 103.0, 105.0]
        volumes = [1000.0, 1500.0, 2000.0, 1800.0]

        vwap, upper, lower = calculate_vwap_with_bands(highs, lows, closes, volumes)

        # Basic validations
        assert lower < vwap < upper
        assert upper > vwap
        assert lower < vwap

    def test_vwap_with_bands_ordering(self):
        """Test that bands maintain proper ordering: lower < vwap < upper."""
        highs = [100.0, 110.0, 105.0, 115.0, 108.0]
        lows = [95.0, 105.0, 100.0, 110.0, 103.0]
        closes = [98.0, 108.0, 103.0, 113.0, 106.0]
        volumes = [1000.0, 1500.0, 2000.0, 1800.0, 1700.0]

        vwap, upper, lower = calculate_vwap_with_bands(highs, lows, closes, volumes)

        assert lower < vwap < upper

    def test_vwap_with_bands_std_dev_multiplier(self):
        """Test VWAP bands with different standard deviation multipliers."""
        highs = [100.0, 102.0, 104.0, 106.0]
        lows = [98.0, 100.0, 102.0, 104.0]
        closes = [99.0, 101.0, 103.0, 105.0]
        volumes = [1000.0, 1500.0, 2000.0, 1800.0]

        vwap1, upper1, lower1 = calculate_vwap_with_bands(
            highs, lows, closes, volumes, num_std_dev=1.0
        )
        vwap2, upper2, lower2 = calculate_vwap_with_bands(
            highs, lows, closes, volumes, num_std_dev=2.0
        )

        # VWAP should be the same
        assert abs(vwap1 - vwap2) < 0.01

        # Bands should be wider with higher std_dev multiplier
        width1 = upper1 - lower1
        width2 = upper2 - lower2
        assert width2 > width1
        assert abs(width2 - 2 * width1) < 0.1  # Should be approximately double

    def test_vwap_with_bands_zero_variance(self):
        """Test VWAP bands with zero variance (all same price)."""
        highs = [100.0, 100.0, 100.0]
        lows = [100.0, 100.0, 100.0]
        closes = [100.0, 100.0, 100.0]
        volumes = [1000.0, 1500.0, 2000.0]

        vwap, upper, lower = calculate_vwap_with_bands(highs, lows, closes, volumes)

        # With no variance, all should be equal
        assert abs(vwap - 100.0) < 0.01
        assert abs(upper - 100.0) < 0.01
        assert abs(lower - 100.0) < 0.01

    def test_vwap_with_bands_session_reset(self):
        """Test VWAP bands with session reset."""
        highs = [100.0, 102.0, 110.0, 112.0]
        lows = [98.0, 100.0, 108.0, 110.0]
        closes = [99.0, 101.0, 109.0, 111.0]
        volumes = [1000.0, 1500.0, 2000.0, 1800.0]
        session_starts = [True, False, True, False]

        vwap, upper, lower = calculate_vwap_with_bands(
            highs, lows, closes, volumes, session_starts=session_starts
        )

        # Should only use data from last session (indices 2 and 3)
        assert lower < vwap < upper


class TestVWAPEdgeCases:
    """Test edge cases and boundary conditions for VWAP calculations."""

    def test_vwap_with_very_small_volumes(self):
        """Test VWAP with very small volume values."""
        highs = [100.0, 102.0, 104.0]
        lows = [98.0, 100.0, 102.0]
        closes = [99.0, 101.0, 103.0]
        volumes = [0.001, 0.001, 0.001]

        vwap = calculate_vwap(highs, lows, closes, volumes)

        # Should still calculate correctly even with small volumes
        typical_prices = [(h + l + c) / 3 for h, l, c in zip(highs, lows, closes)]
        expected = sum(typical_prices) / len(typical_prices)
        assert abs(vwap - expected) < 0.01

    def test_vwap_with_large_price_differences(self):
        """Test VWAP with large price differences."""
        highs = [100.0, 500.0, 200.0]
        lows = [50.0, 450.0, 150.0]
        closes = [75.0, 475.0, 175.0]
        volumes = [1000.0, 100.0, 500.0]  # Middle has low volume

        vwap = calculate_vwap(highs, lows, closes, volumes)

        # VWAP should be influenced less by the high-price, low-volume period
        typical_high_price = (500.0 + 450.0 + 475.0) / 3.0
        assert abs(vwap - typical_high_price) > 100  # Should be far from high price

    def test_vwap_numerical_stability(self):
        """Test VWAP calculation for numerical stability with many data points."""
        n = 1000
        highs = [100.0 + i * 0.1 for i in range(n)]
        lows = [99.0 + i * 0.1 for i in range(n)]
        closes = [99.5 + i * 0.1 for i in range(n)]
        volumes = [1000.0 + i * 10 for i in range(n)]

        vwap = calculate_vwap(highs, lows, closes, volumes)

        # VWAP should be a reasonable value within the price range
        min_price = min(lows)
        max_price = max(highs)
        assert min_price <= vwap <= max_price
