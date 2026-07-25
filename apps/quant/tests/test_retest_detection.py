"""
Unit tests for breakout retest detection (Task 44.4).

Tests verify:
- Resistance breakout retest detection (broken resistance as support)
- Support breakdown retest detection (broken support as resistance)
- Confidence scoring based on proximity and price action
- Distance calculation from breakout level
"""

import pytest
from datetime import datetime, timedelta
from models import OHLCVData
from calculators.breakout_detector import (
    detect_retest,
    BreakoutType,
    RetestType,
    RetestResult,
)


def create_ohlcv_bar(
    timestamp: datetime,
    open_price: float,
    high: float,
    low: float,
    close: float,
    volume: int = 1000000,
) -> OHLCVData:
    """Helper to create OHLCV data bar."""
    return OHLCVData(
        timestamp=timestamp,
        open=open_price,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


class TestResistanceToSupportRetest:
    """Test broken resistance acting as new support."""

    def test_successful_retest_with_bounce(self):
        """Test detection of successful retest with bullish bounce."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = []

        # Build up to resistance at 110
        for i in range(20):
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    105.0 + i * 0.2,
                    106.0 + i * 0.2,
                    104.0 + i * 0.2,
                    105.5 + i * 0.2,
                )
            )

        # Breakout above 110
        for i in range(20, 25):
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    110.0 + (i - 20) * 0.5,
                    112.0 + (i - 20) * 0.5,
                    109.5 + (i - 20) * 0.5,
                    111.5 + (i - 20) * 0.5,
                )
            )

        # Pullback and retest at 110 with bounce
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=25 * 5),
                112.0,
                112.0,
                109.8,  # Low touches near 110
                111.5,  # Close higher (bullish bounce)
            )
        )

        result = detect_retest(
            data=data,
            breakout_level=110.0,
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            lookback_bars=10,
            tolerance=0.02,
        )

        assert result.retest_type == RetestType.RESISTANCE_TO_SUPPORT
        assert result.detected is True
        assert result.confidence > 0.7  # High confidence
        assert result.distance_percent < 1.0  # Very close to level
        assert result.retest_index is not None
        assert result.retest_price is not None
        assert result.level == 110.0

    def test_no_retest_price_too_far(self):
        """Test no retest when price doesn't come close to breakout level."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = []

        # Breakout and keep moving up without pullback
        for i in range(30):
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    110.0 + i * 0.5,
                    112.0 + i * 0.5,
                    109.0 + i * 0.5,
                    111.0 + i * 0.5,
                )
            )

        result = detect_retest(
            data=data,
            breakout_level=110.0,
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            lookback_bars=10,
            tolerance=0.02,
        )

        assert result.retest_type == RetestType.NO_RETEST
        assert result.detected is False
        assert result.confidence == 0.0
        assert result.distance_percent > 2.0  # Far from level

    def test_weak_retest_low_confidence(self):
        """Test weak retest with low bounce strength."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = []

        # Setup and breakout
        for i in range(25):
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    110.0 + i * 0.3,
                    112.0 + i * 0.3,
                    109.0 + i * 0.3,
                    111.0 + i * 0.3,
                )
            )

        # Weak retest - touches level but closes near low (weak bounce)
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=25 * 5),
                115.0,
                115.0,
                109.9,  # Low at level
                110.2,  # Close near low (weak bounce)
            )
        )

        result = detect_retest(
            data=data,
            breakout_level=110.0,
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            lookback_bars=10,
            tolerance=0.02,
        )

        assert result.retest_type == RetestType.RESISTANCE_TO_SUPPORT
        assert result.detected is True
        assert result.confidence < 0.6  # Lower confidence due to weak bounce


class TestSupportToResistanceRetest:
    """Test broken support acting as new resistance."""

    def test_successful_retest_with_rejection(self):
        """Test detection of successful retest with bearish rejection."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = []

        # Build down to support at 100
        for i in range(20):
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    105.0 - i * 0.2,
                    106.0 - i * 0.2,
                    104.0 - i * 0.2,
                    104.5 - i * 0.2,
                )
            )

        # Breakdown below 100
        for i in range(20, 25):
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    100.0 - (i - 20) * 0.5,
                    100.5 - (i - 20) * 0.5,
                    98.0 - (i - 20) * 0.5,
                    98.5 - (i - 20) * 0.5,
                )
            )

        # Rally back and retest at 100 with rejection
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=25 * 5),
                97.0,
                100.2,  # High touches near 100
                96.5,
                97.5,  # Close lower (bearish rejection)
            )
        )

        result = detect_retest(
            data=data,
            breakout_level=100.0,
            breakout_type=BreakoutType.SUPPORT_BREAKDOWN,
            lookback_bars=10,
            tolerance=0.02,
        )

        assert result.retest_type == RetestType.SUPPORT_TO_RESISTANCE
        assert result.detected is True
        assert result.confidence > 0.7  # High confidence
        assert result.distance_percent < 1.0  # Very close to level
        assert result.retest_index is not None
        assert result.retest_price is not None
        assert result.level == 100.0

    def test_no_retest_price_stays_below(self):
        """Test no retest when price stays well below breakdown level."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = []

        # Breakdown and keep moving down without rally
        for i in range(30):
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    100.0 - i * 0.5,
                    101.0 - i * 0.5,
                    98.0 - i * 0.5,
                    99.0 - i * 0.5,
                )
            )

        result = detect_retest(
            data=data,
            breakout_level=100.0,
            breakout_type=BreakoutType.SUPPORT_BREAKDOWN,
            lookback_bars=10,
            tolerance=0.02,
        )

        assert result.retest_type == RetestType.NO_RETEST
        assert result.detected is False
        assert result.confidence == 0.0
        assert result.distance_percent > 2.0  # Far from level


class TestRetestParameterValidation:
    """Test parameter validation for retest detection."""

    def test_empty_data_raises_error(self):
        """Test that empty data raises ValueError."""
        with pytest.raises(ValueError, match="data cannot be empty"):
            detect_retest(
                data=[],
                breakout_level=100.0,
                breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            )

    def test_invalid_breakout_level_raises_error(self):
        """Test that invalid breakout level raises ValueError."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = [create_ohlcv_bar(start_time, 100, 101, 99, 100)]

        with pytest.raises(ValueError, match="breakout_level must be positive"):
            detect_retest(
                data=data,
                breakout_level=-10.0,
                breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            )

    def test_invalid_lookback_raises_error(self):
        """Test that invalid lookback_bars raises ValueError."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = [create_ohlcv_bar(start_time, 100, 101, 99, 100)]

        with pytest.raises(ValueError, match="lookback_bars must be at least 1"):
            detect_retest(
                data=data,
                breakout_level=100.0,
                breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
                lookback_bars=0,
            )

    def test_invalid_tolerance_raises_error(self):
        """Test that invalid tolerance raises ValueError."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = [create_ohlcv_bar(start_time, 100, 101, 99, 100)]

        with pytest.raises(ValueError, match="tolerance must be positive"):
            detect_retest(
                data=data,
                breakout_level=100.0,
                breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
                tolerance=-0.02,
            )

    def test_no_breakout_type_returns_no_retest(self):
        """Test that NO_BREAKOUT type returns NO_RETEST."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = [create_ohlcv_bar(start_time, 100, 101, 99, 100)]

        result = detect_retest(
            data=data,
            breakout_level=100.0,
            breakout_type=BreakoutType.NO_BREAKOUT,
        )

        assert result.retest_type == RetestType.NO_RETEST
        assert result.detected is False
        assert result.confidence == 0.0


class TestRetestConfidenceScoring:
    """Test confidence scoring calculation."""

    def test_confidence_increases_with_proximity(self):
        """Test that closer retests have higher confidence."""
        start_time = datetime(2024, 1, 1, 9, 15)

        # Create two scenarios with different proximity to level
        def create_retest_data(distance_from_level: float):
            data = []
            for i in range(25):
                data.append(
                    create_ohlcv_bar(
                        start_time + timedelta(minutes=i * 5),
                        110.0 + i * 0.3,
                        112.0 + i * 0.3,
                        109.0 + i * 0.3,
                        111.0 + i * 0.3,
                    )
                )
            # Retest bar
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=25 * 5),
                    115.0,
                    115.0,
                    110.0 - distance_from_level,
                    113.0,
                )
            )
            return data

        # Close retest
        close_result = detect_retest(
            data=create_retest_data(0.0),
            breakout_level=110.0,
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            lookback_bars=10,
            tolerance=0.02,
        )

        # Far retest
        far_result = detect_retest(
            data=create_retest_data(1.0),
            breakout_level=110.0,
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            lookback_bars=10,
            tolerance=0.02,
        )

        assert close_result.detected is True
        assert far_result.detected is True
        assert close_result.confidence > far_result.confidence

    def test_confidence_increases_with_bounce_strength(self):
        """Test that stronger bounces have higher confidence."""
        start_time = datetime(2024, 1, 1, 9, 15)

        # Create data with setup
        data_base = []
        for i in range(25):
            data_base.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    110.0 + i * 0.3,
                    112.0 + i * 0.3,
                    109.0 + i * 0.3,
                    111.0 + i * 0.3,
                )
            )

        # Strong bounce (close near high)
        data_strong = data_base + [
            create_ohlcv_bar(
                start_time + timedelta(minutes=25 * 5),
                115.0,
                115.0,
                109.9,  # Low at level
                114.5,  # Close near high (strong bounce)
            )
        ]

        # Weak bounce (close near low)
        data_weak = data_base + [
            create_ohlcv_bar(
                start_time + timedelta(minutes=25 * 5),
                115.0,
                115.0,
                109.9,  # Low at level
                110.5,  # Close near low (weak bounce)
            )
        ]

        strong_result = detect_retest(
            data=data_strong,
            breakout_level=110.0,
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            lookback_bars=10,
            tolerance=0.02,
        )

        weak_result = detect_retest(
            data=data_weak,
            breakout_level=110.0,
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            lookback_bars=10,
            tolerance=0.02,
        )

        assert strong_result.detected is True
        assert weak_result.detected is True
        assert strong_result.confidence > weak_result.confidence


class TestRetestDistanceCalculation:
    """Test distance calculation from breakout level."""

    def test_distance_calculation_accuracy(self):
        """Test that distance is calculated accurately."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = []

        # Create data where retest low is 1% below breakout level
        for i in range(25):
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    110.0 + i * 0.3,
                    112.0 + i * 0.3,
                    109.0 + i * 0.3,
                    111.0 + i * 0.3,
                )
            )

        # Retest with low at 108.9 (1% below 110)
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=25 * 5),
                115.0,
                115.0,
                108.9,  # 1% below 110
                113.0,
            )
        )

        result = detect_retest(
            data=data,
            breakout_level=110.0,
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            lookback_bars=10,
            tolerance=0.02,
        )

        assert result.detected is True
        # Distance should be approximately 1%
        assert 0.9 <= result.distance_percent <= 1.1

    def test_distance_returned_when_no_retest(self):
        """Test that distance is returned even when no retest detected."""
        start_time = datetime(2024, 1, 1, 9, 15)
        data = []

        # Price stays far above breakout level
        for i in range(30):
            data.append(
                create_ohlcv_bar(
                    start_time + timedelta(minutes=i * 5),
                    120.0 + i * 0.3,
                    122.0 + i * 0.3,
                    119.0 + i * 0.3,
                    121.0 + i * 0.3,
                )
            )

        result = detect_retest(
            data=data,
            breakout_level=110.0,
            breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
            lookback_bars=10,
            tolerance=0.02,
        )

        assert result.detected is False
        assert result.distance_percent > 0  # Should report distance
