"""
Unit tests for previous day levels calculator.

Tests cover:
- Level calculation from historical data
- Breach detection (above high, below low, within range)
- Gap calculation and classification
- Distance calculation from levels
- Edge cases and error handling
"""

import pytest
from datetime import datetime, timedelta
from models import OHLCVData
from models.intraday import (
    PreviousDayLevelsResult,
    BreachStatus,
    GapType,
)
from calculators.previous_day_levels import PreviousDayLevelsCalculator


class TestPreviousDayLevelsCalculation:
    """Test basic level calculation from historical data."""

    def test_calculate_levels_basic(self):
        """Test that previous day levels are correctly identified."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            # Day 1 (previous day)
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            # Day 2 (current day)
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2485.0,
                high=2510.0,
                low=2475.0,
                close=2505.0,
                volume=1100000
            ),
        ]
        
        result = calc.calculate_previous_day_levels(data)
        
        assert result.prev_day_high == 2500.0
        assert result.prev_day_low == 2440.0
        assert result.prev_day_close == 2480.0

    def test_gap_up_detection(self):
        """Test gap up detection."""
        calc = PreviousDayLevelsCalculator(gap_threshold_percent=0.1)
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2500.0,  # Gap up from 2480
                high=2520.0,
                low=2495.0,
                close=2510.0,
                volume=1100000
            ),
        ]
        
        result = calc.calculate_previous_day_levels(data)
        
        assert result.gap_type == GapType.GAP_UP
        assert result.gap_percent > 0

    def test_gap_down_detection(self):
        """Test gap down detection."""
        calc = PreviousDayLevelsCalculator(gap_threshold_percent=0.1)
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2460.0,  # Gap down from 2480
                high=2475.0,
                low=2455.0,
                close=2470.0,
                volume=1100000
            ),
        ]
        
        result = calc.calculate_previous_day_levels(data)
        
        assert result.gap_type == GapType.GAP_DOWN
        assert result.gap_percent < 0

    def test_no_gap_detection(self):
        """Test no gap detection when opening is near previous close."""
        calc = PreviousDayLevelsCalculator(gap_threshold_percent=0.5)
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2481.0,  # Tiny gap (0.04%)
                high=2510.0,
                low=2475.0,
                close=2505.0,
                volume=1100000
            ),
        ]
        
        result = calc.calculate_previous_day_levels(data)
        
        assert result.gap_type == GapType.NO_GAP


class TestBreachDetection:
    """Test breach detection functionality."""

    def test_breach_above_high(self):
        """Test detection of price breaching above previous day high."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2485.0,
                high=2520.0,
                low=2475.0,
                close=2510.0,
                volume=1100000
            ),
        ]
        
        result = calc.calculate_previous_day_levels(data, current_price=2510.0)
        
        assert result.breach_status == BreachStatus.ABOVE_HIGH
        assert result.current_price > result.prev_day_high

    def test_breach_below_low(self):
        """Test detection of price breaching below previous day low."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2475.0,
                high=2480.0,
                low=2420.0,
                close=2430.0,
                volume=1100000
            ),
        ]
        
        result = calc.calculate_previous_day_levels(data, current_price=2430.0)
        
        assert result.breach_status == BreachStatus.BELOW_LOW
        assert result.current_price < result.prev_day_low

    def test_within_range(self):
        """Test detection when price is within previous day range."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2475.0,
                high=2490.0,
                low=2460.0,
                close=2485.0,
                volume=1100000
            ),
        ]
        
        result = calc.calculate_previous_day_levels(data, current_price=2470.0)
        
        assert result.breach_status == BreachStatus.WITHIN_RANGE
        assert result.prev_day_low <= result.current_price <= result.prev_day_high


class TestBreachSignificance:
    """Test breach significance calculation."""

    def test_strong_breach_above_high_significance(self):
        """Test that strong breach above has high significance."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,  # Range: 60 points
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2485.0,
                high=2560.0,
                low=2475.0,
                close=2555.0,
                volume=1100000
            ),
        ]
        
        # Breach by 55 points above 2500, which is close to the prev range of 60
        result = calc.calculate_previous_day_levels(data, current_price=2555.0)
        
        assert result.breach_status == BreachStatus.ABOVE_HIGH
        assert result.breach_significance > 0.5  # Significant breach

    def test_weak_breach_above_high_significance(self):
        """Test that weak breach above has low significance."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,  # Range: 60 points
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2485.0,
                high=2505.0,
                low=2475.0,
                close=2502.0,
                volume=1100000
            ),
        ]
        
        # Breach by only 2 points above 2500
        result = calc.calculate_previous_day_levels(data, current_price=2502.0)
        
        assert result.breach_status == BreachStatus.ABOVE_HIGH
        assert result.breach_significance < 0.1  # Weak breach

    def test_within_range_near_high_significance(self):
        """Test significance when price is near previous high but not breaching."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2485.0,
                high=2498.0,
                low=2475.0,
                close=2495.0,
                volume=1100000
            ),
        ]
        
        # Very close to high (2495 vs 2500), should have significance
        result = calc.calculate_previous_day_levels(data, current_price=2495.0)
        
        assert result.breach_status == BreachStatus.WITHIN_RANGE
        assert result.breach_significance > 0.5  # Near the level


class TestDistanceCalculation:
    """Test distance calculation from levels."""

    def test_distance_from_high_percent(self):
        """Test distance from high percentage calculation."""
        calc = PreviousDayLevelsCalculator()
        
        distances = calc.calculate_distance_from_levels(
            current_price=2510.0,
            prev_high=2500.0,
            prev_low=2440.0
        )
        
        expected_distance_from_high = ((2510.0 - 2500.0) / 2500.0) * 100
        assert abs(distances["distance_from_high_percent"] - expected_distance_from_high) < 0.01

    def test_distance_from_low_percent(self):
        """Test distance from low percentage calculation."""
        calc = PreviousDayLevelsCalculator()
        
        distances = calc.calculate_distance_from_levels(
            current_price=2510.0,
            prev_high=2500.0,
            prev_low=2440.0
        )
        
        expected_distance_from_low = ((2510.0 - 2440.0) / 2440.0) * 100
        assert abs(distances["distance_from_low_percent"] - expected_distance_from_low) < 0.01

    def test_distance_negative_when_below(self):
        """Test that distance from high is negative when price is below."""
        calc = PreviousDayLevelsCalculator()
        
        distances = calc.calculate_distance_from_levels(
            current_price=2450.0,
            prev_high=2500.0,
            prev_low=2440.0
        )
        
        assert distances["distance_from_high_percent"] < 0


class TestHelperMethods:
    """Test helper methods."""

    def test_detect_breach_above_high_helper(self):
        """Test helper method for detecting breach above high."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2485.0,
                high=2520.0,
                low=2475.0,
                close=2510.0,
                volume=1100000
            ),
        ]
        
        is_breach_above = calc.detect_breach_above_high(data)
        assert is_breach_above is True

    def test_detect_breach_below_low_helper(self):
        """Test helper method for detecting breach below low."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2475.0,
                high=2480.0,
                low=2420.0,
                close=2430.0,
                volume=1100000
            ),
        ]
        
        is_breach_below = calc.detect_breach_below_low(data)
        assert is_breach_below is True


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_data_raises_error(self):
        """Test that empty data raises ValueError."""
        calc = PreviousDayLevelsCalculator()
        
        with pytest.raises(ValueError, match="cannot be empty"):
            calc.calculate_previous_day_levels([])

    def test_insufficient_data_raises_error(self):
        """Test that insufficient data (less than 2 days) raises ValueError."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
        ]
        
        with pytest.raises(ValueError, match="at least 2 days"):
            calc.calculate_previous_day_levels(data)

    def test_negative_gap_threshold_raises_error(self):
        """Test that negative gap threshold raises ValueError."""
        with pytest.raises(ValueError, match="gap_threshold_percent must be non-negative"):
            PreviousDayLevelsCalculator(gap_threshold_percent=-0.1)

    def test_invalid_prices_in_distance_calculation(self):
        """Test that invalid prices raise ValueError in distance calculation."""
        calc = PreviousDayLevelsCalculator()
        
        with pytest.raises(ValueError, match="All prices must be positive"):
            calc.calculate_distance_from_levels(
                current_price=-100.0,
                prev_high=2500.0,
                prev_low=2440.0
            )

    def test_prev_high_less_than_low_raises_error(self):
        """Test that prev_high < prev_low raises ValueError."""
        calc = PreviousDayLevelsCalculator()
        
        with pytest.raises(ValueError, match="prev_high.*must be >= prev_low"):
            calc.calculate_distance_from_levels(
                current_price=2450.0,
                prev_high=2440.0,  # Less than low
                prev_low=2500.0
            )

    def test_zero_range_significance(self):
        """Test significance calculation when previous day has zero range."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            # Previous day with zero range (unusual but possible)
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2450.0,
                low=2450.0,
                close=2450.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2460.0,
                high=2465.0,
                low=2455.0,
                close=2460.0,
                volume=1100000
            ),
        ]
        
        # Should not crash, significance should be 0
        result = calc.calculate_previous_day_levels(data)
        assert result.breach_significance == 0.0


class TestResultModelValidation:
    """Test that result models have correct structure."""

    def test_result_has_all_required_fields(self):
        """Test that PreviousDayLevelsResult has all required fields."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2485.0,
                high=2510.0,
                low=2475.0,
                close=2505.0,
                volume=1100000
            ),
        ]
        
        result = calc.calculate_previous_day_levels(data)
        
        # Check all required fields exist
        assert hasattr(result, "prev_day_high")
        assert hasattr(result, "prev_day_low")
        assert hasattr(result, "prev_day_close")
        assert hasattr(result, "gap_percent")
        assert hasattr(result, "gap_type")
        assert hasattr(result, "breach_status")
        assert hasattr(result, "current_price")
        assert hasattr(result, "distance_from_high_percent")
        assert hasattr(result, "distance_from_low_percent")
        assert hasattr(result, "breach_significance")

    def test_result_values_are_valid_types(self):
        """Test that result values have correct types."""
        calc = PreviousDayLevelsCalculator()
        
        base_time = datetime(2024, 1, 15, 9, 15)
        data = [
            OHLCVData(
                timestamp=base_time,
                open=2450.0,
                high=2500.0,
                low=2440.0,
                close=2480.0,
                volume=1000000
            ),
            OHLCVData(
                timestamp=base_time + timedelta(days=1),
                open=2485.0,
                high=2510.0,
                low=2475.0,
                close=2505.0,
                volume=1100000
            ),
        ]
        
        result = calc.calculate_previous_day_levels(data)
        
        assert isinstance(result.prev_day_high, float)
        assert isinstance(result.prev_day_low, float)
        assert isinstance(result.prev_day_close, float)
        assert isinstance(result.gap_percent, float)
        assert isinstance(result.gap_type, GapType)
        assert isinstance(result.breach_status, BreachStatus)
        assert isinstance(result.current_price, float)
        assert isinstance(result.distance_from_high_percent, float)
        assert isinstance(result.distance_from_low_percent, float)
        assert isinstance(result.breach_significance, float)
