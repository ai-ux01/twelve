"""
Unit tests for RSI calculator.

Tests the RSI calculation logic with known values and edge cases.
"""

import pytest
import numpy as np
from calculators.rsi import calculate_rsi, calculate_rsi_series


class TestRSICalculation:
    """Test suite for RSI calculation functions."""

    def test_rsi_with_known_values(self):
        """Test RSI calculation with a known example."""
        # Example from Wilder's original RSI calculation
        # These prices should produce an RSI around 70.46 for the 14-period RSI
        prices = [
            44.00,
            44.34,
            44.09,
            43.61,
            44.33,
            44.83,
            45.10,
            45.42,
            45.84,
            46.08,
            45.89,
            46.03,
            45.61,
            46.28,
            46.28,
        ]

        rsi = calculate_rsi(prices, period=14)

        # RSI should be between 0 and 100
        assert 0 <= rsi <= 100

        # For this particular dataset with mostly gains, RSI should be high (>50)
        assert rsi > 50

        # More specifically, this should produce an RSI around 70 (overbought territory)
        assert 65 <= rsi <= 75

    def test_rsi_bounds(self):
        """Test that RSI is always between 0 and 100."""
        # Test with various price patterns
        test_cases = [
            # Uptrend: consistently rising prices
            list(range(100, 120)),
            # Downtrend: consistently falling prices
            list(range(120, 100, -1)),
            # Volatile: random walk
            [
                100,
                105,
                102,
                108,
                103,
                110,
                106,
                112,
                108,
                115,
                110,
                118,
                114,
                120,
                116,
            ],
            # Flat with noise
            [100 + np.random.uniform(-2, 2) for _ in range(20)],
        ]

        for prices in test_cases:
            rsi = calculate_rsi(prices, period=14)
            assert (
                0 <= rsi <= 100
            ), f"RSI {rsi} out of bounds [0, 100] for prices {prices}"

    def test_rsi_all_gains_returns_100(self):
        """Test that RSI returns 100 when there are only gains."""
        # Consistently rising prices with no losses
        prices = [100 + i * 5 for i in range(20)]

        rsi = calculate_rsi(prices, period=14)

        # With only gains, RSI should be 100 or very close to it
        assert rsi >= 99.0

    def test_rsi_all_losses_returns_0(self):
        """Test that RSI returns 0 when there are only losses."""
        # Consistently falling prices with no gains
        prices = [200 - i * 5 for i in range(20)]

        rsi = calculate_rsi(prices, period=14)

        # With only losses, RSI should be 0 or very close to it
        assert rsi <= 1.0

    def test_rsi_alternating_gains_losses(self):
        """Test RSI with alternating gains and losses."""
        # Prices that alternate between up and down
        prices = [100]
        for i in range(1, 20):
            if i % 2 == 0:
                prices.append(prices[-1] + 2)
            else:
                prices.append(prices[-1] - 1)

        rsi = calculate_rsi(prices, period=14)

        # With mixed gains and losses, RSI should be somewhere in the middle
        assert 30 <= rsi <= 70

    def test_rsi_with_different_periods(self):
        """Test RSI calculation with different period values."""
        prices = [100 + i + np.random.uniform(-2, 2) for i in range(50)]

        # Test common RSI periods
        periods = [7, 9, 14, 21, 25]

        for period in periods:
            rsi = calculate_rsi(prices, period=period)
            assert 0 <= rsi <= 100, f"RSI {rsi} out of bounds for period {period}"

    def test_rsi_insufficient_data_raises_error(self):
        """Test that RSI raises ValueError when there's insufficient data."""
        # Need at least period + 1 prices
        prices = [100, 101, 102, 103]  # Only 4 prices

        with pytest.raises(ValueError, match="Need at least 15 prices"):
            calculate_rsi(prices, period=14)

    def test_rsi_invalid_period_raises_error(self):
        """Test that RSI raises ValueError for invalid period."""
        prices = list(range(100, 120))

        with pytest.raises(ValueError, match="Period must be positive"):
            calculate_rsi(prices, period=0)

        with pytest.raises(ValueError, match="Period must be positive"):
            calculate_rsi(prices, period=-5)

    def test_rsi_series_length(self):
        """Test that RSI series returns correct length."""
        prices = list(range(100, 130))
        rsi_series = calculate_rsi_series(prices, period=14)

        # Should return same length as input
        assert len(rsi_series) == len(prices)

    def test_rsi_series_latest_value_matches_single_calculation(self):
        """Test that the last value of RSI series matches single RSI calculation."""
        prices = [100 + i + np.random.uniform(-2, 2) for i in range(30)]

        rsi_single = calculate_rsi(prices, period=14)
        rsi_series = calculate_rsi_series(prices, period=14)

        # Last value of series should be close to single calculation
        # Note: There may be small differences due to different EMA smoothing implementations
        # (Wilder's vs pandas EWM), but they should be within 1 RSI point
        assert abs(rsi_series[-1] - rsi_single) < 1.0

    def test_rsi_with_flat_prices(self):
        """Test RSI when prices are completely flat."""
        prices = [100.0] * 20

        # When prices don't change, there are no gains or losses
        # RSI should be undefined, but we handle it as 100 (no losses)
        rsi = calculate_rsi(prices, period=14)

        # Should still return a valid value
        assert 0 <= rsi <= 100

    def test_rsi_stability_with_minimal_changes(self):
        """Test RSI with very small price changes."""
        # Prices with tiny fluctuations
        prices = [100 + i * 0.01 + np.random.uniform(-0.005, 0.005) for i in range(20)]

        rsi = calculate_rsi(prices, period=14)

        # Should still produce valid RSI
        assert 0 <= rsi <= 100

    def test_rsi_with_large_price_movements(self):
        """Test RSI with large price swings."""
        prices = [100, 150, 80, 160, 70, 170, 60, 180, 50, 190, 40, 200, 30, 210, 20]

        rsi = calculate_rsi(prices, period=7)

        # Even with large movements, RSI should be bounded
        assert 0 <= rsi <= 100


class TestRSIEdgeCases:
    """Test edge cases and boundary conditions for RSI."""

    def test_rsi_minimum_data_points(self):
        """Test RSI with exactly the minimum number of required data points."""
        # Minimum is period + 1 data points
        period = 14
        prices = list(range(100, 100 + period + 1))

        rsi = calculate_rsi(prices, period=period)

        assert 0 <= rsi <= 100

    def test_rsi_with_zeros_in_middle(self):
        """Test RSI behavior when some price changes are zero."""
        prices = [
            100,
            105,
            105,
            110,
            110,
            115,
            115,
            120,
            120,
            125,
            125,
            130,
            130,
            135,
            135,
        ]

        rsi = calculate_rsi(prices, period=7)

        # Should handle zero changes gracefully
        assert 0 <= rsi <= 100

    def test_rsi_negative_prices_raises_appropriate_behavior(self):
        """Test RSI with negative prices (edge case - shouldn't occur in real trading)."""
        # While negative prices don't make sense for stocks, RSI calculation should still work
        # mathematically as it's based on price changes, not absolute prices
        prices = [-50 + i for i in range(20)]

        rsi = calculate_rsi(prices, period=14)

        # Should still return valid RSI as it's based on deltas
        assert 0 <= rsi <= 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
