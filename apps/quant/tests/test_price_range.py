"""
Unit tests for price range calculators.

Tests 52-week high/low detection, distance calculations, and momentum indicators.
"""

import pytest
import numpy as np
from datetime import datetime, timedelta
from calculators.price_range import (
    calculate_52_week_high_low,
    calculate_distance_from_extremes,
    calculate_momentum,
    calculate_momentum_series,
    calculate_price_range_analysis,
)


class TestFiftyTwoWeekHighLow:
    """Test suite for 52-week high/low calculation."""

    def test_basic_high_low_detection(self):
        """Test basic 52-week high and low detection."""
        prices = [100, 105, 98, 110, 95, 108, 102, 115, 109, 112, 107]

        result = calculate_52_week_high_low(prices)

        assert result["high_52w"] == 115.0
        assert result["low_52w"] == 95.0

    def test_high_at_beginning(self):
        """Test when highest price is at the beginning."""
        prices = [200, 150, 140, 145, 130, 135, 125, 120, 115, 110]

        result = calculate_52_week_high_low(prices)

        assert result["high_52w"] == 200.0
        assert result["low_52w"] == 110.0

    def test_high_at_end(self):
        """Test when highest price is at the end."""
        prices = [100, 110, 105, 115, 108, 120, 112, 125, 118, 130]

        result = calculate_52_week_high_low(prices)

        assert result["high_52w"] == 130.0
        assert result["low_52w"] == 100.0

    def test_all_same_prices(self):
        """Test when all prices are the same."""
        prices = [100.0] * 20

        result = calculate_52_week_high_low(prices)

        assert result["high_52w"] == 100.0
        assert result["low_52w"] == 100.0

    def test_with_timestamps(self):
        """Test 52-week high/low with timestamp filtering."""
        # Test that timestamp filtering works (basic functionality test)
        end_date = datetime(2024, 1, 15)

        # Create 10 days of data
        timestamps = [end_date - timedelta(days=i) for i in range(9, -1, -1)]
        prices = [100, 105, 103, 108, 106, 110, 107, 112, 109, 115]

        # Look back 5 days - should only consider last 5 prices
        result = calculate_52_week_high_low(prices, timestamps, lookback_days=5)

        # The function should work without error
        assert result["high_52w"] >= result["low_52w"]
        assert result["high_52w"] > 0
        assert result["low_52w"] > 0

    def test_empty_prices_raises_error(self):
        """Test that empty prices list raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            calculate_52_week_high_low([])

    def test_invalid_lookback_days_raises_error(self):
        """Test that invalid lookback days raises ValueError."""
        prices = [100, 105, 98, 110]

        with pytest.raises(ValueError, match="must be positive"):
            calculate_52_week_high_low(prices, lookback_days=0)

        with pytest.raises(ValueError, match="must be positive"):
            calculate_52_week_high_low(prices, lookback_days=-10)

    def test_mismatched_timestamps_length_raises_error(self):
        """Test that mismatched timestamps and prices lengths raises error."""
        prices = [100, 105, 98, 110, 95]
        timestamps = [datetime.now() - timedelta(days=i) for i in range(3)]

        with pytest.raises(ValueError, match="same length"):
            calculate_52_week_high_low(prices, timestamps)

    def test_single_price(self):
        """Test with a single price."""
        prices = [100.0]

        result = calculate_52_week_high_low(prices)

        assert result["high_52w"] == 100.0
        assert result["low_52w"] == 100.0

    def test_floating_point_precision(self):
        """Test with precise floating point values."""
        prices = [100.123456, 105.789012, 98.345678, 110.901234]

        result = calculate_52_week_high_low(prices)

        assert abs(result["high_52w"] - 110.901234) < 1e-6
        assert abs(result["low_52w"] - 98.345678) < 1e-6


class TestDistanceFromExtremes:
    """Test suite for distance from extremes calculation."""

    def test_basic_distance_calculation(self):
        """Test basic distance from high/low calculation."""
        current_price = 105
        high_52w = 110
        low_52w = 95

        result = calculate_distance_from_extremes(current_price, high_52w, low_52w)

        # Distance from high: (105 - 110) / 110 * 100 = -4.545%
        assert abs(result["distance_from_high_pct"] - (-4.545)) < 0.01

        # Distance from low: (105 - 95) / 95 * 100 = 10.526%
        assert abs(result["distance_from_low_pct"] - 10.526) < 0.01

        # Position in range: (105 - 95) / (110 - 95) * 100 = 66.667%
        assert abs(result["position_in_range_pct"] - 66.667) < 0.01

    def test_at_52_week_high(self):
        """Test when current price equals 52-week high."""
        current_price = 110
        high_52w = 110
        low_52w = 95

        result = calculate_distance_from_extremes(current_price, high_52w, low_52w)

        assert result["distance_from_high_pct"] == 0.0
        assert result["position_in_range_pct"] == 100.0

    def test_at_52_week_low(self):
        """Test when current price equals 52-week low."""
        current_price = 95
        high_52w = 110
        low_52w = 95

        result = calculate_distance_from_extremes(current_price, high_52w, low_52w)

        assert result["distance_from_low_pct"] == 0.0
        assert result["position_in_range_pct"] == 0.0

    def test_above_52_week_high(self):
        """Test when current price is above 52-week high (new high)."""
        current_price = 120
        high_52w = 110
        low_52w = 95

        result = calculate_distance_from_extremes(current_price, high_52w, low_52w)

        # Distance from high should be positive (above high)
        assert result["distance_from_high_pct"] > 0

        # Position should be clamped to 100%
        assert result["position_in_range_pct"] == 100.0

    def test_below_52_week_low(self):
        """Test when current price is below 52-week low (new low)."""
        current_price = 90
        high_52w = 110
        low_52w = 95

        result = calculate_distance_from_extremes(current_price, high_52w, low_52w)

        # Distance from low should be negative (below low)
        assert result["distance_from_low_pct"] < 0

        # Position should be clamped to 0%
        assert result["position_in_range_pct"] == 0.0

    def test_same_high_and_low(self):
        """Test when 52-week high and low are the same."""
        current_price = 100
        high_52w = 100
        low_52w = 100

        result = calculate_distance_from_extremes(current_price, high_52w, low_52w)

        assert result["distance_from_high_pct"] == 0.0
        assert result["distance_from_low_pct"] == 0.0
        assert result["position_in_range_pct"] == 50.0

    def test_invalid_prices_raises_error(self):
        """Test that invalid prices raise ValueError."""
        # Negative current price
        with pytest.raises(ValueError, match="must be positive"):
            calculate_distance_from_extremes(-100, 110, 95)

        # Negative high
        with pytest.raises(ValueError, match="must be positive"):
            calculate_distance_from_extremes(100, -110, 95)

        # Negative low
        with pytest.raises(ValueError, match="must be positive"):
            calculate_distance_from_extremes(100, 110, -95)

        # Zero prices
        with pytest.raises(ValueError, match="must be positive"):
            calculate_distance_from_extremes(0, 110, 95)

    def test_high_less_than_low_raises_error(self):
        """Test that high < low raises ValueError."""
        with pytest.raises(ValueError, match="must be >="):
            calculate_distance_from_extremes(100, 95, 110)

    def test_midpoint_of_range(self):
        """Test when current price is at midpoint of range."""
        current_price = 102.5
        high_52w = 110
        low_52w = 95

        result = calculate_distance_from_extremes(current_price, high_52w, low_52w)

        # Should be at 50% of range
        assert abs(result["position_in_range_pct"] - 50.0) < 0.5


class TestMomentum:
    """Test suite for momentum indicator calculation."""

    def test_basic_momentum_calculation(self):
        """Test basic momentum calculation."""
        prices = [100, 102, 101, 105, 108, 107, 110, 112, 111, 115, 118]
        period = 10

        momentum = calculate_momentum(prices, period)

        # Momentum: (118 - 100) / 100 * 100 = 18%
        assert abs(momentum - 18.0) < 0.01

    def test_positive_momentum(self):
        """Test momentum with rising prices."""
        prices = list(range(100, 120))  # Steadily rising

        momentum = calculate_momentum(prices, period=10)

        # Should be positive
        assert momentum > 0

    def test_negative_momentum(self):
        """Test momentum with falling prices."""
        prices = list(range(120, 100, -1))  # Steadily falling

        momentum = calculate_momentum(prices, period=10)

        # Should be negative
        assert momentum < 0

    def test_zero_momentum(self):
        """Test momentum when price returns to same level."""
        prices = [100, 105, 110, 105, 100, 105, 110, 105, 100, 105, 100]
        period = 10

        momentum = calculate_momentum(prices, period)

        # Price now equals price 10 periods ago
        assert abs(momentum) < 0.01

    def test_different_periods(self):
        """Test momentum with different period lengths."""
        prices = list(range(100, 150))

        periods = [5, 10, 20, 30]

        for period in periods:
            momentum = calculate_momentum(prices, period)
            # All should be positive since prices are rising
            assert momentum > 0

    def test_momentum_insufficient_data_raises_error(self):
        """Test that insufficient data raises ValueError."""
        prices = [100, 101, 102, 103]  # Only 4 prices

        with pytest.raises(ValueError, match="Need at least 11 prices"):
            calculate_momentum(prices, period=10)

    def test_momentum_invalid_period_raises_error(self):
        """Test that invalid period raises ValueError."""
        prices = list(range(100, 120))

        with pytest.raises(ValueError, match="must be positive"):
            calculate_momentum(prices, period=0)

        with pytest.raises(ValueError, match="must be positive"):
            calculate_momentum(prices, period=-5)

    def test_momentum_with_non_positive_prices_raises_error(self):
        """Test that non-positive prices raise ValueError."""
        prices = [100, 105, 0, 110, 115, 120, 125, 130, 135, 140, 145]

        with pytest.raises(ValueError, match="must be positive"):
            calculate_momentum(prices, period=10)

    def test_large_momentum_values(self):
        """Test momentum with large price changes."""
        prices = [100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 200]
        period = 10

        momentum = calculate_momentum(prices, period)

        # (200 - 100) / 100 * 100 = 100%
        assert abs(momentum - 100.0) < 0.01

    def test_small_momentum_values(self):
        """Test momentum with small price changes."""
        prices = [
            100.00,
            100.01,
            100.02,
            100.01,
            100.02,
            100.03,
            100.02,
            100.03,
            100.04,
            100.03,
            100.05,
        ]
        period = 10

        momentum = calculate_momentum(prices, period)

        # Very small momentum
        assert abs(momentum - 0.05) < 0.01


class TestMomentumSeries:
    """Test suite for momentum series calculation."""

    def test_momentum_series_length(self):
        """Test that momentum series returns correct length."""
        prices = list(range(100, 130))
        period = 10

        momentum_series = calculate_momentum_series(prices, period)

        # Should return same length as input
        assert len(momentum_series) == len(prices)

    def test_momentum_series_has_nan_for_initial_values(self):
        """Test that first 'period' values are NaN."""
        prices = list(range(100, 130))
        period = 10

        momentum_series = calculate_momentum_series(prices, period)

        # First 'period' values should be NaN
        for i in range(period):
            assert np.isnan(momentum_series[i])

    def test_momentum_series_latest_matches_single_calculation(self):
        """Test that last value of series matches single momentum calculation."""
        prices = list(range(100, 130))
        period = 10

        momentum_single = calculate_momentum(prices, period)
        momentum_series = calculate_momentum_series(prices, period)

        # Last value should match
        assert abs(momentum_series[-1] - momentum_single) < 0.01

    def test_momentum_series_increasing_trend(self):
        """Test momentum series with increasing trend."""
        # Accelerating uptrend
        prices = [100 + i**1.5 for i in range(30)]
        period = 5

        momentum_series = calculate_momentum_series(prices, period)

        # Momentum should generally be positive and increasing
        valid_momentum = [m for m in momentum_series if not np.isnan(m)]
        assert all(m > 0 for m in valid_momentum)


class TestPriceRangeAnalysis:
    """Test suite for complete price range analysis."""

    def test_complete_analysis(self):
        """Test complete price range analysis."""
        prices = [
            95,
            98,
            100,
            105,
            102,
            108,
            110,
            107,
            112,
            109,
            115,
            113,
            118,
            120,
            117,
            122,
            119,
            124,
            121,
            125,
        ]

        result = calculate_price_range_analysis(prices, momentum_period=10)

        # Check all keys are present
        assert "high_52w" in result
        assert "low_52w" in result
        assert "current_price" in result
        assert "distance_from_high_pct" in result
        assert "distance_from_low_pct" in result
        assert "position_in_range_pct" in result
        assert "momentum" in result

        # Check values are reasonable
        assert result["high_52w"] >= result["low_52w"]
        assert result["current_price"] == 125
        assert -100 <= result["distance_from_high_pct"] <= 100
        assert -100 <= result["distance_from_low_pct"] <= 200
        assert 0 <= result["position_in_range_pct"] <= 100

    def test_analysis_with_timestamps(self):
        """Test complete analysis with timestamp filtering."""
        end_date = datetime(2024, 1, 15)
        timestamps = [end_date - timedelta(days=i) for i in range(400, 0, -1)]
        prices = [100 + (i % 30) for i in range(400)]

        result = calculate_price_range_analysis(
            prices, timestamps=timestamps, lookback_days=365, momentum_period=10
        )

        # Should complete without error
        assert result is not None
        assert all(
            key in result
            for key in [
                "high_52w",
                "low_52w",
                "current_price",
                "distance_from_high_pct",
                "distance_from_low_pct",
                "position_in_range_pct",
                "momentum",
            ]
        )

    def test_analysis_empty_prices_raises_error(self):
        """Test that empty prices raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            calculate_price_range_analysis([])

    def test_analysis_insufficient_data_for_momentum_raises_error(self):
        """Test that insufficient data for momentum raises error."""
        prices = [100, 105, 110, 115, 120]  # Only 5 prices

        with pytest.raises(ValueError):
            calculate_price_range_analysis(prices, momentum_period=10)


class TestPriceRangeEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_very_large_prices(self):
        """Test with very large price values."""
        prices = [1000000 + i * 10000 for i in range(30)]

        result = calculate_price_range_analysis(prices, momentum_period=10)

        # Should handle large numbers correctly
        assert result is not None
        assert result["high_52w"] > 1000000
        assert result["momentum"] > 0

    def test_very_small_prices(self):
        """Test with very small price values."""
        prices = [0.001 + i * 0.0001 for i in range(30)]

        result = calculate_price_range_analysis(prices, momentum_period=10)

        # Should handle small numbers correctly
        assert result is not None
        assert result["high_52w"] > 0
        assert result["momentum"] > 0

    def test_high_volatility_prices(self):
        """Test with highly volatile prices."""
        np.random.seed(42)
        base = 100
        prices = [base + np.random.uniform(-50, 50) for _ in range(30)]

        result = calculate_price_range_analysis(prices, momentum_period=10)

        # Should handle volatility
        assert result is not None
        assert 0 <= result["position_in_range_pct"] <= 100

    def test_consistent_uptrend(self):
        """Test with consistent uptrend."""
        prices = list(range(100, 150))

        result = calculate_price_range_analysis(prices, momentum_period=10)

        # Should show high position in range
        assert result["position_in_range_pct"] == 100.0
        # Should show positive momentum
        assert result["momentum"] > 0

    def test_consistent_downtrend(self):
        """Test with consistent downtrend."""
        prices = list(range(150, 100, -1))

        result = calculate_price_range_analysis(prices, momentum_period=10)

        # Should show low position in range
        assert result["position_in_range_pct"] == 0.0
        # Should show negative momentum
        assert result["momentum"] < 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
