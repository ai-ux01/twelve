"""
Unit tests for trendline validator module.

Tests validation logic including:
- Minimum touch point validation
- Strength score calculation
- Angle classification
- Weak trendline filtering
"""

import pytest
from datetime import datetime, timedelta
from models import OHLCVData, TrendlineResult
from calculators.trendline_validator import (
    TrendlineValidator,
    TrendlineAngleClassification,
)


@pytest.fixture
def sample_uptrend_data():
    """Generate uptrending price data for testing."""
    base_time = datetime(2024, 1, 1, 9, 0)
    data = []

    for i in range(30):
        price = 100 + i * 2  # Linear uptrend
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(days=i),
                open=price,
                high=price + 2,
                low=price - 1,
                close=price + 1,
                volume=1000000,
            )
        )

    return data


@pytest.fixture
def perfect_trendline():
    """Create a perfect trendline that fits uptrend data."""
    return TrendlineResult(
        slope=2.0,
        intercept=100.0,
        r_squared=0.95,
        start_point=(0, 100.0),
        end_point=(29, 158.0),
    )


@pytest.fixture
def weak_trendline():
    """Create a weak trendline with low R²."""
    return TrendlineResult(
        slope=0.5,
        intercept=100.0,
        r_squared=0.4,
        start_point=(0, 100.0),
        end_point=(29, 114.5),
    )


def test_validator_initialization():
    """Test TrendlineValidator initialization with default parameters."""
    validator = TrendlineValidator()

    assert validator.min_touches == 2
    assert validator.min_r_squared == 0.7
    assert validator.min_strength == 40.0
    assert validator.steep_angle_threshold == 3.0
    assert validator.flat_angle_threshold == 0.5


def test_validator_initialization_custom():
    """Test TrendlineValidator initialization with custom parameters."""
    validator = TrendlineValidator(
        min_touches=3,
        min_r_squared=0.8,
        min_strength=50.0,
        steep_angle_threshold=5.0,
        flat_angle_threshold=1.0,
    )

    assert validator.min_touches == 3
    assert validator.min_r_squared == 0.8
    assert validator.min_strength == 50.0
    assert validator.steep_angle_threshold == 5.0
    assert validator.flat_angle_threshold == 1.0


def test_validator_invalid_min_touches():
    """Test that validator rejects invalid min_touches."""
    with pytest.raises(ValueError, match="min_touches must be at least 2"):
        TrendlineValidator(min_touches=1)


def test_validator_invalid_r_squared():
    """Test that validator rejects invalid min_r_squared."""
    with pytest.raises(ValueError, match="min_r_squared must be between 0 and 1"):
        TrendlineValidator(min_r_squared=1.5)

    with pytest.raises(ValueError, match="min_r_squared must be between 0 and 1"):
        TrendlineValidator(min_r_squared=-0.1)


def test_validator_invalid_strength():
    """Test that validator rejects invalid min_strength."""
    with pytest.raises(ValueError, match="min_strength must be between 0 and 100"):
        TrendlineValidator(min_strength=150)

    with pytest.raises(ValueError, match="min_strength must be between 0 and 100"):
        TrendlineValidator(min_strength=-10)


def test_validator_invalid_angle_thresholds():
    """Test that validator rejects invalid angle thresholds."""
    with pytest.raises(
        ValueError, match="steep_angle_threshold must be > flat_angle_threshold"
    ):
        TrendlineValidator(steep_angle_threshold=1.0, flat_angle_threshold=2.0)


def test_count_touches(sample_uptrend_data, perfect_trendline):
    """Test counting touches on a trendline."""
    validator = TrendlineValidator()
    touches = validator._count_touches(
        perfect_trendline, sample_uptrend_data, tolerance=0.05
    )

    # With perfect fit and reasonable tolerance, should have many touches
    assert touches >= 10


def test_validate_minimum_touches(sample_uptrend_data, perfect_trendline):
    """Test validation of minimum touch points."""
    validator = TrendlineValidator(min_touches=2)

    # Perfect trendline should have enough touches
    assert validator.validate_minimum_touches(
        perfect_trendline, sample_uptrend_data, tolerance=0.05
    )


def test_validate_minimum_touches_fails(sample_uptrend_data):
    """Test validation fails when trendline has insufficient touches."""
    # Create a trendline that doesn't match the data
    bad_trendline = TrendlineResult(
        slope=-5.0,
        intercept=200.0,
        r_squared=0.9,
        start_point=(0, 200.0),
        end_point=(29, 55.0),
    )

    validator = TrendlineValidator(min_touches=2)

    # Bad trendline should fail validation
    assert not validator.validate_minimum_touches(
        bad_trendline, sample_uptrend_data, tolerance=0.01
    )


def test_calculate_strength_score_high_quality(sample_uptrend_data, perfect_trendline):
    """Test strength score calculation for high-quality trendline."""
    validator = TrendlineValidator()
    strength = validator.calculate_strength_score(
        perfect_trendline, sample_uptrend_data, tolerance=0.05
    )

    # Perfect trendline should have high strength (R²=0.95 contributes 66.5, touches contribute remainder)
    assert strength >= 70
    assert strength <= 100


def test_calculate_strength_score_weak_trendline(sample_uptrend_data, weak_trendline):
    """Test strength score calculation for weak trendline."""
    validator = TrendlineValidator()
    strength = validator.calculate_strength_score(
        weak_trendline, sample_uptrend_data, tolerance=0.05
    )

    # Weak trendline (R²=0.4) should have low strength
    assert strength < 50


def test_calculate_strength_score_bounds(sample_uptrend_data, perfect_trendline):
    """Test that strength score is always in valid range [0, 100]."""
    validator = TrendlineValidator()
    strength = validator.calculate_strength_score(
        perfect_trendline, sample_uptrend_data
    )

    assert 0 <= strength <= 100


def test_detect_angle_steep(sample_uptrend_data):
    """Test detection of steep trendline angle."""
    # Create a steep trendline (large slope relative to price)
    steep_trendline = TrendlineResult(
        slope=5.0,  # 5 points per period on ~100-point price
        intercept=100.0,
        r_squared=0.9,
        start_point=(0, 100.0),
        end_point=(29, 245.0),
    )

    validator = TrendlineValidator()
    angle = validator.detect_angle_classification(steep_trendline, sample_uptrend_data)

    assert angle == TrendlineAngleClassification.STEEP


def test_detect_angle_flat(sample_uptrend_data):
    """Test detection of flat trendline angle."""
    # Create a flat trendline (small slope)
    flat_trendline = TrendlineResult(
        slope=0.1,  # Very small slope
        intercept=100.0,
        r_squared=0.8,
        start_point=(0, 100.0),
        end_point=(29, 102.9),
    )

    validator = TrendlineValidator()
    angle = validator.detect_angle_classification(flat_trendline, sample_uptrend_data)

    assert angle == TrendlineAngleClassification.FLAT


def test_detect_angle_moderate(sample_uptrend_data, perfect_trendline):
    """Test detection of moderate trendline angle."""
    validator = TrendlineValidator()
    angle = validator.detect_angle_classification(
        perfect_trendline, sample_uptrend_data
    )

    # Slope of 2.0 on ~100-point price should be moderate
    assert angle == TrendlineAngleClassification.MODERATE


def test_detect_angle_empty_data():
    """Test angle detection with empty data raises error."""
    validator = TrendlineValidator()
    trendline = TrendlineResult(
        slope=2.0,
        intercept=100.0,
        r_squared=0.9,
        start_point=(0, 100.0),
        end_point=(29, 158.0),
    )

    with pytest.raises(ValueError, match="data cannot be empty"):
        validator.detect_angle_classification(trendline, [])


def test_filter_weak_trendlines_by_r_squared(sample_uptrend_data):
    """Test filtering out trendlines with low R²."""
    trendlines = [
        TrendlineResult(
            slope=2.0,
            intercept=100.0,
            r_squared=0.95,
            start_point=(0, 100.0),
            end_point=(29, 158.0),
        ),
        TrendlineResult(
            slope=1.5,
            intercept=100.0,
            r_squared=0.4,
            start_point=(0, 100.0),
            end_point=(29, 143.5),
        ),
        TrendlineResult(
            slope=2.5,
            intercept=100.0,
            r_squared=0.85,
            start_point=(0, 100.0),
            end_point=(29, 172.5),
        ),
    ]

    validator = TrendlineValidator(min_r_squared=0.7)
    strong = validator.filter_weak_trendlines(
        trendlines, sample_uptrend_data, tolerance=0.05
    )

    # Only trendlines with R² >= 0.7 should remain
    assert len(strong) <= 2
    for trendline in strong:
        assert trendline.r_squared >= 0.7


def test_filter_weak_trendlines_by_strength(sample_uptrend_data):
    """Test filtering out trendlines with low strength score."""
    trendlines = [
        TrendlineResult(
            slope=2.0,
            intercept=100.0,
            r_squared=0.95,
            start_point=(0, 100.0),
            end_point=(29, 158.0),
        ),
        TrendlineResult(
            slope=0.5,
            intercept=100.0,
            r_squared=0.72,
            start_point=(0, 100.0),
            end_point=(29, 114.5),
        ),
    ]

    validator = TrendlineValidator(min_strength=60.0)
    strong = validator.filter_weak_trendlines(
        trendlines, sample_uptrend_data, tolerance=0.05
    )

    # Only trendlines with strength >= 60 should remain
    assert len(strong) >= 1
    for trendline in strong:
        strength = validator.calculate_strength_score(
            trendline, sample_uptrend_data, tolerance=0.05
        )
        assert strength >= 60.0


def test_filter_weak_trendlines_empty_list(sample_uptrend_data):
    """Test filtering empty list returns empty list."""
    validator = TrendlineValidator()
    strong = validator.filter_weak_trendlines([], sample_uptrend_data)

    assert strong == []


def test_validate_and_score_trendline_valid(sample_uptrend_data, perfect_trendline):
    """Test comprehensive validation of a valid trendline."""
    validator = TrendlineValidator(min_r_squared=0.7, min_strength=40.0, min_touches=2)
    metrics = validator.validate_and_score_trendline(
        perfect_trendline, sample_uptrend_data, tolerance=0.05
    )

    assert metrics is not None
    assert metrics["is_valid"] is True
    assert metrics["strength"] >= 40.0
    assert metrics["touches"] >= 2
    assert metrics["angle"] in [
        TrendlineAngleClassification.STEEP,
        TrendlineAngleClassification.MODERATE,
        TrendlineAngleClassification.FLAT,
    ]
    assert metrics["r_squared"] == perfect_trendline.r_squared
    assert metrics["slope"] == perfect_trendline.slope


def test_validate_and_score_trendline_invalid(sample_uptrend_data, weak_trendline):
    """Test comprehensive validation of an invalid trendline."""
    validator = TrendlineValidator(min_r_squared=0.7, min_strength=40.0, min_touches=2)
    metrics = validator.validate_and_score_trendline(
        weak_trendline, sample_uptrend_data, tolerance=0.05
    )

    assert metrics is not None
    # Weak trendline with R²=0.4 should fail validation (min_r_squared=0.7)
    assert metrics["is_valid"] is False


def test_validate_and_score_includes_all_metrics(
    sample_uptrend_data, perfect_trendline
):
    """Test that validation returns all required metrics."""
    validator = TrendlineValidator()
    metrics = validator.validate_and_score_trendline(
        perfect_trendline, sample_uptrend_data
    )

    # Check all required keys are present
    required_keys = ["is_valid", "strength", "touches", "angle", "r_squared", "slope"]
    for key in required_keys:
        assert key in metrics


def test_strength_score_components(sample_uptrend_data):
    """Test that strength score correctly combines R² and touch count."""
    # Create trendline with high R² but potentially fewer touches
    high_r_trendline = TrendlineResult(
        slope=2.0,
        intercept=100.0,
        r_squared=1.0,  # Perfect R²
        start_point=(0, 100.0),
        end_point=(29, 158.0),
    )

    validator = TrendlineValidator()
    strength = validator.calculate_strength_score(
        high_r_trendline, sample_uptrend_data, tolerance=0.05
    )

    # R² component should contribute 70 points (1.0 * 70)
    # Touch component should contribute up to 30 points
    assert strength >= 70  # At minimum, R² contribution
    assert strength <= 100  # Maximum possible


def test_touch_tolerance_sensitivity(sample_uptrend_data, perfect_trendline):
    """Test that touch count is sensitive to tolerance parameter."""
    validator = TrendlineValidator()

    # Tight tolerance should give fewer touches
    strict_touches = validator._count_touches(
        perfect_trendline, sample_uptrend_data, tolerance=0.001
    )

    # Loose tolerance should give more touches
    loose_touches = validator._count_touches(
        perfect_trendline, sample_uptrend_data, tolerance=0.1
    )

    assert loose_touches >= strict_touches


def test_negative_slope_trendline(sample_uptrend_data):
    """Test validation works with negative slope (downtrend)."""
    downtrend = TrendlineResult(
        slope=-1.0,
        intercept=150.0,
        r_squared=0.85,
        start_point=(0, 150.0),
        end_point=(29, 121.0),
    )

    validator = TrendlineValidator()
    metrics = validator.validate_and_score_trendline(
        downtrend, sample_uptrend_data, tolerance=0.05
    )

    # Should get metrics even with negative slope
    assert metrics is not None
    assert "strength" in metrics
    assert "angle" in metrics


def test_multiple_trendlines_sorted_by_strength(sample_uptrend_data):
    """Test that filtering preserves order by strength."""
    trendlines = [
        TrendlineResult(
            slope=2.0,
            intercept=100.0,
            r_squared=0.75,
            start_point=(0, 100.0),
            end_point=(29, 158.0),
        ),
        TrendlineResult(
            slope=2.1,
            intercept=100.0,
            r_squared=0.95,
            start_point=(0, 100.0),
            end_point=(29, 160.9),
        ),
        TrendlineResult(
            slope=1.9,
            intercept=100.0,
            r_squared=0.82,
            start_point=(0, 100.0),
            end_point=(29, 155.1),
        ),
    ]

    validator = TrendlineValidator(min_r_squared=0.7, min_strength=40.0)
    strong = validator.filter_weak_trendlines(
        trendlines, sample_uptrend_data, tolerance=0.05
    )

    # All should pass and be valid
    assert len(strong) >= 1

    # Calculate strengths to verify ordering
    strengths = [
        validator.calculate_strength_score(t, sample_uptrend_data, tolerance=0.05)
        for t in strong
    ]

    # Should be sorted by strength (highest first)
    assert strengths == sorted(strengths, reverse=True)
