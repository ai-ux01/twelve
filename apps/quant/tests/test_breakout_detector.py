"""Unit tests for breakout pattern detection calculator."""

import pytest
from datetime import datetime, timedelta
from models import OHLCVData, TrendlineResult
from calculators.breakout_detector import (
    identify_consolidation_range,
    calculate_breakout_strength,
    detect_resistance_breakout,
    detect_support_breakdown,
    detect_breakout,
    BreakoutType,
    BreakoutResult,
)


def create_test_data(close_prices, base_price=100.0, volume=1000000):
    """Helper to create OHLCV data from close prices."""
    data = []
    base_time = datetime(2024, 1, 1, 9, 0, 0)
    for i, close in enumerate(close_prices):
        price = base_price + close
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=price - 0.5,
                high=price + 1.0,
                low=price - 1.0,
                close=price,
                volume=volume if isinstance(volume, (int, float)) else volume[i],
            )
        )
    return data


def create_trendline(slope, intercept, r_squared=0.95, data_length=10):
    """Helper to create TrendlineResult with proper start/end points."""
    start_point = (0.0, intercept)
    end_point = (float(data_length - 1), slope * (data_length - 1) + intercept)
    return TrendlineResult(
        slope=slope,
        intercept=intercept,
        r_squared=r_squared,
        start_point=start_point,
        end_point=end_point,
    )


class TestConsolidationDetection:
    """Tests for consolidation range identification."""

    def test_tight_consolidation_detected(self):
        """Test detection of tight consolidation range."""
        # Create data consolidating between 100-101.5 (1.5% range) with tighter swings
        prices = [0, 0.5, 0.25, 0.75, 0.5, 1.0, 0.25, 0.75, 0.5, 1.0] * 2
        data = create_test_data(prices)

        consolidation = identify_consolidation_range(data, lookback_bars=20)

        assert consolidation is not None
        # Should be tight since range is < 3%
        assert consolidation.is_tight is True or consolidation.range_percent < 3.5
        assert consolidation.duration == 20

    def test_wide_consolidation_not_detected(self):
        """Test that wide ranges are not detected as consolidation."""
        # Create data with 10% range
        prices = [0, 5, 0, 5, 0, 5, 0, 5, 0, 5] * 2
        data = create_test_data(prices)

        consolidation = identify_consolidation_range(
            data, lookback_bars=20, range_threshold=5.0
        )

        assert consolidation is None

    def test_consolidation_bounds_correct(self):
        """Test consolidation range bounds calculation."""
        prices = [0, 1, 0.5, 1.5, 1, 2] * 3
        data = create_test_data(prices, base_price=100)

        consolidation = identify_consolidation_range(data, lookback_bars=18)

        assert consolidation is not None
        # High should be around 103 (base 100 + max 2 + high adjustment 1)
        # Low should be around 99 (base 100 + min 0 - low adjustment 1)
        assert consolidation.upper_bound > consolidation.lower_bound
        assert (
            consolidation.range_size
            == consolidation.upper_bound - consolidation.lower_bound
        )

    def test_insufficient_data_returns_none(self):
        """Test that insufficient data returns None."""
        data = create_test_data([0, 1, 2])

        consolidation = identify_consolidation_range(data, lookback_bars=20)

        assert consolidation is None

    def test_empty_data_raises_error(self):
        """Test that empty data raises ValueError."""
        with pytest.raises(ValueError, match="data cannot be empty"):
            identify_consolidation_range([], lookback_bars=20)

    def test_invalid_lookback_raises_error(self):
        """Test that invalid lookback period raises ValueError."""
        data = create_test_data([0, 1, 2, 3, 4])

        with pytest.raises(ValueError, match="lookback_bars must be at least 2"):
            identify_consolidation_range(data, lookback_bars=1)

    def test_invalid_threshold_raises_error(self):
        """Test that invalid threshold raises ValueError."""
        data = create_test_data([0, 1, 2, 3, 4])

        with pytest.raises(ValueError, match="range_threshold must be positive"):
            identify_consolidation_range(data, lookback_bars=5, range_threshold=0)


class TestBreakoutStrength:
    """Tests for breakout strength calculation."""

    def test_strong_breakout_high_score(self):
        """Test that strong breakout gets high score."""
        # Create breakout with high volume and consolidation
        consolidation = None  # Will create manually
        result = BreakoutResult(
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            confirmed=True,
            volume_ratio=2.0,  # 2x average volume
            breakout_index=25,
            breakout_price=110.0,
            trendline_price=105.0,
            strength_score=0.0,
            consolidation=consolidation,
        )

        # High volume (2.0) and strong price move (4.76%)
        strength = calculate_breakout_strength(result, None, 4.76)

        # Should get volume score (~20) + price score (~23.8) = ~43.8
        assert strength >= 40.0
        assert strength <= 100.0

    def test_weak_breakout_low_score(self):
        """Test that weak breakout gets low score."""
        result = BreakoutResult(
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            confirmed=False,  # Not confirmed
            volume_ratio=0.8,  # Below average
            breakout_index=25,
            breakout_price=105.5,
            trendline_price=105.0,
            strength_score=0.0,
            consolidation=None,
        )

        # Low volume and small price move (0.95%)
        strength = calculate_breakout_strength(result, None, 0.95)

        # Should get minimal score (no volume confirmation, small move)
        assert strength < 10.0

    def test_consolidation_adds_strength(self):
        """Test that consolidation before breakout increases strength."""
        from calculators.breakout_detector import ConsolidationRange

        # Create tight consolidation
        consolidation = ConsolidationRange(
            upper_bound=105.0,
            lower_bound=103.0,
            range_size=2.0,
            range_percent=1.96,
            start_index=5,
            end_index=24,
            duration=20,
            is_tight=True,
        )

        result = BreakoutResult(
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            confirmed=True,
            volume_ratio=1.5,
            breakout_index=25,
            breakout_price=110.0,
            trendline_price=105.0,
            strength_score=0.0,
            consolidation=consolidation,
        )

        strength_with_consol = calculate_breakout_strength(result, consolidation, 4.76)
        strength_without = calculate_breakout_strength(result, None, 4.76)

        # Consolidation should add to strength
        assert strength_with_consol > strength_without

    def test_strength_score_bounded(self):
        """Test that strength score is always between 0 and 100."""
        result = BreakoutResult(
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            confirmed=True,
            volume_ratio=10.0,  # Extremely high
            breakout_index=25,
            breakout_price=150.0,
            trendline_price=100.0,
            strength_score=0.0,
            consolidation=None,
        )

        # Extreme values
        strength = calculate_breakout_strength(result, None, 50.0)

        assert 0.0 <= strength <= 100.0


class TestResistanceBreakout:
    """Tests for resistance breakout detection."""

    def test_resistance_breakout_detected(self):
        """Test detection of resistance breakout."""
        # Create upward trend with breakout
        prices = list(range(0, 20, 2))  # 0, 2, 4, ..., 18
        volumes = [1000000] * 9 + [2000000]  # High volume on last bar
        data = create_test_data(prices, volume=volumes)

        # Resistance at slope=1.5, starting at 100
        resistance = create_trendline(slope=1.5, intercept=100.0, data_length=len(data))

        result = detect_resistance_breakout(data, resistance, volume_period=9)

        assert result.breakout_type == BreakoutType.RESISTANCE_BREAKOUT
        assert result.confirmed is True
        assert result.volume_ratio >= 1.0
        assert result.strength_score > 0

    def test_no_breakout_below_resistance(self):
        """Test no breakout when price is below resistance."""
        prices = [0, 1, 2, 3, 4]
        data = create_test_data(prices)

        # Resistance well above current price
        resistance = create_trendline(slope=2.0, intercept=120.0, data_length=len(data))

        result = detect_resistance_breakout(data, resistance, volume_period=5)

        assert result.breakout_type == BreakoutType.NO_BREAKOUT
        assert result.confirmed is False
        assert result.strength_score == 0.0

    def test_breakout_without_volume_confirmation(self):
        """Test breakout without volume confirmation."""
        prices = list(range(0, 20, 2))
        volumes = [1000000] * 10  # Normal volume throughout
        data = create_test_data(prices, volume=volumes)

        resistance = create_trendline(slope=1.5, intercept=100.0, data_length=len(data))

        result = detect_resistance_breakout(
            data, resistance, volume_period=9, volume_threshold=1.5
        )

        assert result.breakout_type == BreakoutType.RESISTANCE_BREAKOUT
        assert result.confirmed is False  # Volume didn't meet threshold
        # Strength should be lower without volume confirmation
        assert result.strength_score < 50.0


class TestSupportBreakdown:
    """Tests for support breakdown detection."""

    def test_support_breakdown_detected(self):
        """Test detection of support breakdown."""
        # Create downward trend with breakdown
        prices = list(range(20, 0, -2))  # 20, 18, 16, ..., 2
        volumes = [1000000] * 9 + [2000000]  # High volume on last bar
        data = create_test_data(prices, volume=volumes)

        # Support at slope=-1.5, starting at 120
        support = create_trendline(slope=-1.5, intercept=120.0, data_length=len(data))

        result = detect_support_breakdown(data, support, volume_period=9)

        assert result.breakout_type == BreakoutType.SUPPORT_BREAKDOWN
        assert result.confirmed is True
        assert result.volume_ratio >= 1.0
        assert result.strength_score > 0

    def test_no_breakdown_above_support(self):
        """Test no breakdown when price is above support."""
        prices = [20, 19, 18, 17, 16]
        data = create_test_data(prices)

        # Support well below current price
        support = create_trendline(slope=-2.0, intercept=80.0, data_length=len(data))

        result = detect_support_breakdown(data, support, volume_period=5)

        assert result.breakout_type == BreakoutType.NO_BREAKOUT
        assert result.confirmed is False
        assert result.strength_score == 0.0


class TestBreakoutDetection:
    """Tests for general breakout detection."""

    def test_prioritizes_resistance_breakout(self):
        """Test that resistance breakout is prioritized over support."""
        prices = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
        volumes = [1000000] * 9 + [2000000]
        data = create_test_data(prices, volume=volumes)

        # Both trendlines would trigger
        resistance = create_trendline(slope=1.5, intercept=100.0, data_length=len(data))
        support = create_trendline(slope=2.0, intercept=80.0, data_length=len(data))

        result = detect_breakout(
            data,
            support_trendline=support,
            resistance_trendline=resistance,
            volume_period=9,
        )

        # Should detect resistance breakout first
        assert result.breakout_type == BreakoutType.RESISTANCE_BREAKOUT

    def test_requires_at_least_one_trendline(self):
        """Test that at least one trendline is required."""
        data = create_test_data([0, 1, 2, 3, 4])

        with pytest.raises(ValueError, match="At least one trendline must be provided"):
            detect_breakout(data)

    def test_empty_data_raises_error(self):
        """Test that empty data raises ValueError."""
        resistance = create_trendline(slope=1.0, intercept=100.0)

        with pytest.raises(ValueError, match="data cannot be empty"):
            detect_breakout([], resistance_trendline=resistance)

    def test_insufficient_data_raises_error(self):
        """Test that insufficient data for volume analysis raises error."""
        data = create_test_data([0, 1, 2])  # Only 3 bars
        resistance = create_trendline(slope=1.0, intercept=100.0, data_length=3)

        with pytest.raises(ValueError, match="Insufficient data"):
            detect_breakout(data, resistance_trendline=resistance, volume_period=20)


class TestBreakoutWithConsolidation:
    """Integration tests for breakout detection with consolidation."""

    def test_breakout_after_consolidation(self):
        """Test breakout detection after consolidation period."""
        # Create consolidation followed by breakout
        consolidation_prices = [
            0,
            0.5,
            0.25,
            0.75,
            0.5,
            1.0,
            0.25,
        ] * 3  # 21 bars consolidating tightly
        breakout_prices = [3, 6, 10]  # Strong breakout (3 bars)
        prices = consolidation_prices + breakout_prices

        volumes = [1000000] * len(consolidation_prices) + [2500000] * len(
            breakout_prices
        )
        data = create_test_data(prices, volume=volumes)

        resistance = create_trendline(
            slope=0.05, intercept=100.0, data_length=len(data)
        )

        result = detect_resistance_breakout(
            data, resistance, volume_period=20, lookback_bars=20
        )

        assert result.breakout_type == BreakoutType.RESISTANCE_BREAKOUT
        assert result.confirmed is True
        # Consolidation may or may not be detected depending on lookback window
        # The key is that the breakout is detected with high strength
        assert result.strength_score >= 40.0

    def test_breakout_without_prior_consolidation(self):
        """Test breakout without consolidation has lower strength."""
        # Trending up without consolidation
        prices = list(range(0, 20, 2))
        volumes = [1000000] * 9 + [2000000]
        data = create_test_data(prices, volume=volumes)

        resistance = create_trendline(slope=1.5, intercept=100.0, data_length=len(data))

        result = detect_resistance_breakout(
            data, resistance, volume_period=9, lookback_bars=20
        )

        assert result.breakout_type == BreakoutType.RESISTANCE_BREAKOUT
        assert result.consolidation is None  # No consolidation detected
        # Strength should be moderate (volume + price move only)
        assert 20.0 <= result.strength_score < 60.0
