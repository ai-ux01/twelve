"""
Unit tests for support/resistance level detection.

Tests cover:
- Local extrema detection
- Price level clustering
- Strength calculation
- End-to-end support/resistance detection
- Edge cases and error handling
"""

import pytest
import numpy as np
from datetime import datetime, timedelta
from models import OHLCVData, SupportResistanceLevel
from calculators.support_resistance import (
    find_local_extrema,
    cluster_levels,
    calculate_strength,
    detect_support_resistance,
)


class TestFindLocalExtrema:
    """Tests for local extrema detection."""

    def test_simple_extrema(self):
        """Test detection of clear local minima and maxima."""
        # Pattern: low, high, low, high, low
        prices = np.array([100, 110, 95, 115, 90])

        minima, maxima = find_local_extrema(prices, window=3)

        # Should detect minima at indices 0, 2, 4 (lows)
        # Should detect maxima at indices 1, 3 (highs)
        assert len(minima) >= 1, "Should detect at least one minimum"
        assert len(maxima) >= 1, "Should detect at least one maximum"

    def test_flat_prices(self):
        """Test with flat price data (no extrema)."""
        prices = np.array([100, 100, 100, 100, 100])

        minima, maxima = find_local_extrema(prices, window=3)

        # All points are both minima and maxima in flat data
        assert len(minima) > 0
        assert len(maxima) > 0

    def test_insufficient_data(self):
        """Test with insufficient data points."""
        prices = np.array([100, 110])

        minima, maxima = find_local_extrema(prices, window=5)

        # Not enough data points for window size
        assert len(minima) == 0
        assert len(maxima) == 0

    def test_monotonic_increasing(self):
        """Test with monotonically increasing prices."""
        prices = np.array([100, 110, 120, 130, 140, 150])

        minima, maxima = find_local_extrema(prices, window=3)

        # In strictly increasing sequence, no true local extrema
        # (edge points are excluded from detection window)
        assert len(minima) == 0  # No local minima
        assert len(maxima) == 0  # No local maxima (edges excluded)

    def test_monotonic_decreasing(self):
        """Test with monotonically decreasing prices."""
        prices = np.array([150, 140, 130, 120, 110, 100])

        minima, maxima = find_local_extrema(prices, window=3)

        # In strictly decreasing sequence, no true local extrema
        # (edge points are excluded from detection window)
        assert len(minima) == 0  # No local minima (edges excluded)
        assert len(maxima) == 0  # No local maxima


class TestClusterLevels:
    """Tests for price level clustering."""

    def test_identical_prices(self):
        """Test clustering of identical prices."""
        prices = [100.0, 100.0, 100.0]

        clusters = cluster_levels(prices, tolerance_pct=0.02)

        # All identical prices should form one cluster
        assert len(clusters) == 1
        assert clusters[0][0] == 100.0  # Average price
        assert clusters[0][1] == 3  # Touch count

    def test_nearby_prices(self):
        """Test clustering of nearby prices within tolerance."""
        # Prices within 2% of each other should cluster
        prices = [100.0, 101.0, 99.5, 100.5]

        clusters = cluster_levels(prices, tolerance_pct=0.02)

        # Should form one cluster since all within 2%
        assert len(clusters) == 1
        assert clusters[0][1] == 4  # All 4 prices in one cluster

    def test_distinct_levels(self):
        """Test clustering of distinct price levels."""
        # Two distinct groups: ~100 and ~150
        prices = [100.0, 101.0, 150.0, 151.0]

        clusters = cluster_levels(prices, tolerance_pct=0.02)

        # Should form two clusters
        assert len(clusters) == 2
        assert clusters[0][1] == 2  # First cluster has 2 touches
        assert clusters[1][1] == 2  # Second cluster has 2 touches

    def test_empty_input(self):
        """Test with empty price list."""
        clusters = cluster_levels([], tolerance_pct=0.02)

        assert len(clusters) == 0

    def test_single_price(self):
        """Test with single price."""
        clusters = cluster_levels([100.0], tolerance_pct=0.02)

        assert len(clusters) == 1
        assert clusters[0][0] == 100.0
        assert clusters[0][1] == 1

    def test_tight_tolerance(self):
        """Test with very tight tolerance."""
        # Even small differences should create separate clusters
        prices = [100.0, 100.5, 101.0]

        clusters = cluster_levels(prices, tolerance_pct=0.001)  # 0.1%

        # Tight tolerance should create more clusters
        assert len(clusters) >= 2


class TestCalculateStrength:
    """Tests for strength score calculation."""

    def test_max_touches_max_volume(self):
        """Test strength with maximum touches and volume."""
        strength = calculate_strength(
            touches=10,
            volume_at_level=2000.0,
            avg_volume=1000.0,
            max_touches=10,
        )

        # Should be high strength (close to 1.0)
        assert 0.8 <= strength <= 1.0

    def test_min_touches_low_volume(self):
        """Test strength with minimum touches and low volume."""
        strength = calculate_strength(
            touches=1, volume_at_level=500.0, avg_volume=1000.0, max_touches=10
        )

        # Should be low strength
        assert 0.0 <= strength <= 0.5

    def test_strength_bounds(self):
        """Test that strength is always between 0 and 1."""
        # Test various combinations
        test_cases = [
            (1, 100, 1000, 10),
            (10, 5000, 1000, 10),
            (5, 1000, 1000, 10),
            (3, 2000, 500, 5),
        ]

        for touches, vol_at_level, avg_vol, max_touches in test_cases:
            strength = calculate_strength(touches, vol_at_level, avg_vol, max_touches)
            assert 0.0 <= strength <= 1.0, f"Strength out of bounds for {test_cases}"

    def test_higher_touches_increases_strength(self):
        """Test that more touches lead to higher strength."""
        strength_low = calculate_strength(
            touches=2, volume_at_level=1000.0, avg_volume=1000.0, max_touches=10
        )

        strength_high = calculate_strength(
            touches=8, volume_at_level=1000.0, avg_volume=1000.0, max_touches=10
        )

        assert strength_high > strength_low

    def test_higher_volume_increases_strength(self):
        """Test that higher volume leads to higher strength."""
        strength_low = calculate_strength(
            touches=5, volume_at_level=500.0, avg_volume=1000.0, max_touches=10
        )

        strength_high = calculate_strength(
            touches=5, volume_at_level=2000.0, avg_volume=1000.0, max_touches=10
        )

        assert strength_high > strength_low


class TestDetectSupportResistance:
    """Tests for end-to-end support/resistance detection."""

    def create_test_data(self, prices: list, volumes: list = None) -> list[OHLCVData]:
        """Helper to create test OHLCV data."""
        if volumes is None:
            volumes = [1000000] * len(prices)

        data = []
        base_time = datetime(2024, 1, 1)

        for i, (price, volume) in enumerate(zip(prices, volumes)):
            # Create realistic OHLC from a single price point
            data.append(
                OHLCVData(
                    timestamp=base_time + timedelta(days=i),
                    open=price * 0.99,
                    high=price * 1.01,
                    low=price * 0.99,
                    close=price,
                    volume=volume,
                )
            )

        return data

    def test_basic_support_detection(self):
        """Test detection of a clear support level."""
        # Price pattern with support around 100
        prices = [110, 105, 100, 105, 110, 105, 100, 105, 110]

        data = self.create_test_data(prices)
        levels = detect_support_resistance(data, window=3, min_touches=2)

        # Should detect at least one level
        assert len(levels) > 0

        # Levels should be sorted by strength
        if len(levels) > 1:
            assert levels[0].strength >= levels[1].strength

    def test_basic_resistance_detection(self):
        """Test detection of a clear resistance level."""
        # Price pattern with resistance around 150
        prices = [140, 145, 150, 145, 140, 145, 150, 145, 140]

        data = self.create_test_data(prices)
        levels = detect_support_resistance(data, window=3, min_touches=2)

        # Should detect at least one level
        assert len(levels) > 0

    def test_multiple_levels(self):
        """Test detection of multiple support/resistance levels."""
        # Pattern with support at ~100 and resistance at ~150
        prices = [100, 120, 150, 130, 100, 125, 150, 120, 100]

        data = self.create_test_data(prices)
        levels = detect_support_resistance(data, window=3, min_touches=2)

        # Should detect multiple levels
        assert len(levels) >= 1

    def test_min_touches_filter(self):
        """Test that min_touches parameter filters results."""
        prices = [100, 110, 120, 110, 100, 105, 115, 105, 100]

        data = self.create_test_data(prices)

        # With min_touches=3, should be more restrictive
        levels_strict = detect_support_resistance(data, window=3, min_touches=3)

        # With min_touches=2, should detect more levels
        levels_loose = detect_support_resistance(data, window=3, min_touches=2)

        assert len(levels_loose) >= len(levels_strict)

    def test_insufficient_data(self):
        """Test with insufficient data points."""
        prices = [100, 110]

        data = self.create_test_data(prices)
        levels = detect_support_resistance(data, window=5)

        # Should return empty list with insufficient data
        assert len(levels) == 0

    def test_strength_ordering(self):
        """Test that results are sorted by strength."""
        # Create data with clear support at 100 (many touches)
        prices = [100, 110, 100, 110, 100, 110, 100, 110, 120, 110, 120]

        data = self.create_test_data(prices)
        levels = detect_support_resistance(data, window=3, min_touches=2)

        # Verify sorted by strength (descending)
        for i in range(len(levels) - 1):
            assert levels[i].strength >= levels[i + 1].strength

    def test_result_format(self):
        """Test that results have correct format."""
        prices = [100, 110, 100, 110, 100, 110, 100]

        data = self.create_test_data(prices)
        levels = detect_support_resistance(data, window=3, min_touches=2)

        # Check each level has required fields
        for level in levels:
            assert isinstance(level, SupportResistanceLevel)
            assert level.level > 0
            assert 0.0 <= level.strength <= 1.0
            assert level.touches >= 2  # Based on min_touches

    def test_high_volume_increases_strength(self):
        """Test that levels with higher volume have higher strength."""
        prices = [100] * 10
        volumes_low = [1000] * 10
        volumes_high = [10000] * 10

        data_low = self.create_test_data(prices, volumes_low)
        data_high = self.create_test_data(prices, volumes_high)

        levels_low = detect_support_resistance(data_low, window=3, min_touches=2)
        levels_high = detect_support_resistance(data_high, window=3, min_touches=2)

        # Higher volume should result in higher strength
        if len(levels_low) > 0 and len(levels_high) > 0:
            assert levels_high[0].strength >= levels_low[0].strength

    def test_tolerance_parameter(self):
        """Test that tolerance parameter affects clustering."""
        # Prices with small variations
        prices = [100, 100.5, 101, 100.3, 100.7]

        data = self.create_test_data(prices)

        # Tight tolerance - more granular levels
        levels_tight = detect_support_resistance(
            data, window=2, tolerance_pct=0.001, min_touches=1
        )

        # Loose tolerance - fewer, broader levels
        levels_loose = detect_support_resistance(
            data, window=2, tolerance_pct=0.05, min_touches=1
        )

        # Loose tolerance should result in fewer clusters
        assert len(levels_loose) <= len(levels_tight) or len(levels_loose) == len(
            levels_tight
        )

    def test_realistic_stock_pattern(self):
        """Test with realistic stock price pattern."""
        # Simulated stock prices with support and resistance
        prices = [
            2400,
            2420,
            2450,
            2430,
            2400,  # Support at 2400
            2420,
            2460,
            2480,
            2500,  # Resistance at 2500
            2480,
            2460,
            2420,
            2400,  # Support at 2400 again
            2430,
            2470,
            2500,  # Resistance at 2500 again
            2490,
            2460,
        ]

        data = self.create_test_data(prices)
        levels = detect_support_resistance(data, window=3, min_touches=2)

        # Should detect both support and resistance
        assert len(levels) >= 1

        # All levels should have positive prices
        for level in levels:
            assert level.level > 0

        # All levels should have strength > 0
        for level in levels:
            assert level.strength > 0
