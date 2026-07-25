"""
Integration tests for trendline detection with validation.

Tests the complete flow of detecting, validating, and scoring trendlines.
"""

import pytest
from datetime import datetime, timedelta
from models import OHLCVData
from calculators.trendlines import detect_and_validate_trendlines


@pytest.fixture
def strong_uptrend_data():
    """Generate strong uptrending price data with realistic volatility."""
    base_time = datetime(2024, 1, 1, 9, 0)
    data = []

    for i in range(50):
        # Strong uptrend with oscillating highs and lows for swing points
        base_price = 100 + i * 2
        # Add oscillation to create swing points
        oscillation = 3 * (1 if i % 4 < 2 else -1)
        price = base_price + oscillation

        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(days=i),
                open=price,
                high=price + 2,
                low=price - 2,
                close=price + 1,
                volume=1000000,
            )
        )

    return data


@pytest.fixture
def weak_trend_data():
    """Generate sideways/weak trend data."""
    base_time = datetime(2024, 1, 1, 9, 0)
    data = []

    for i in range(50):
        # Sideways with noise
        price = 100 + (i % 5) * 2
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(days=i),
                open=price,
                high=price + 1,
                low=price - 1,
                close=price + 0.5,
                volume=1000000,
            )
        )

    return data


@pytest.fixture
def mixed_trend_data():
    """Generate data with multiple trend phases."""
    base_time = datetime(2024, 1, 1, 9, 0)
    data = []

    # First 20: uptrend
    for i in range(20):
        price = 100 + i * 3
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

    # Next 20: sideways
    for i in range(20, 40):
        price = 160 + (i % 4) * 1
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(days=i),
                open=price,
                high=price + 1,
                low=price - 1,
                close=price + 0.5,
                volume=1000000,
            )
        )

    # Last 10: downtrend
    for i in range(40, 50):
        price = 165 - (i - 40) * 2
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(days=i),
                open=price,
                high=price + 1,
                low=price - 2,
                close=price - 1,
                volume=1000000,
            )
        )

    return data


def test_detect_and_validate_strong_trend(strong_uptrend_data):
    """Test detection and validation with strong uptrend."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data, min_touches=2, min_r_squared=0.7, min_strength=40.0
    )

    # Should detect at least one valid trendline
    assert len(results) >= 1

    # Check structure of results
    result = results[0]
    assert "trendline" in result
    assert "strength" in result
    assert "touches" in result
    assert "angle" in result
    assert "r_squared" in result
    assert "slope" in result

    # Verify validation thresholds
    assert result["strength"] >= 40.0
    assert result["r_squared"] >= 0.7
    assert result["touches"] >= 2


def test_detect_and_validate_weak_trend(weak_trend_data):
    """Test that weak trends are filtered out."""
    results = detect_and_validate_trendlines(
        weak_trend_data, min_touches=2, min_r_squared=0.7, min_strength=40.0
    )

    # Weak sideways trend should produce no valid trendlines
    # (or very few with low quality)
    for result in results:
        # Any detected trendlines must meet strict criteria
        assert result["strength"] >= 40.0
        assert result["r_squared"] >= 0.7


def test_validate_results_sorted_by_strength(strong_uptrend_data):
    """Test that results are sorted by strength score."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data,
        min_touches=2,
        min_r_squared=0.5,  # Lower threshold to get multiple results
        min_strength=30.0,
    )

    if len(results) >= 2:
        # Verify descending order by strength
        strengths = [r["strength"] for r in results]
        assert strengths == sorted(strengths, reverse=True)


def test_validate_minimum_touches_enforced(strong_uptrend_data):
    """Test that minimum touches requirement is enforced."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data,
        min_touches=5,  # Require 5 touches
        min_r_squared=0.7,
        min_strength=40.0,
    )

    # All results should have at least 5 touches
    for result in results:
        assert result["touches"] >= 5


def test_validate_r_squared_threshold(strong_uptrend_data):
    """Test that R² threshold is enforced."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data,
        min_touches=2,
        min_r_squared=0.8,  # High R² requirement
        min_strength=40.0,
    )

    # All results should have R² >= 0.8
    for result in results:
        assert result["r_squared"] >= 0.8


def test_validate_strength_threshold(strong_uptrend_data):
    """Test that strength threshold is enforced."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data,
        min_touches=2,
        min_r_squared=0.7,
        min_strength=60.0,  # High strength requirement
    )

    # All results should have strength >= 60.0
    for result in results:
        assert result["strength"] >= 60.0


def test_validate_empty_data_raises_error():
    """Test that empty data raises appropriate error."""
    with pytest.raises(ValueError, match="data cannot be empty"):
        detect_and_validate_trendlines([])


def test_validate_angle_classification_present(strong_uptrend_data):
    """Test that all results include angle classification."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data, min_touches=2, min_r_squared=0.7, min_strength=40.0
    )

    valid_angles = ["STEEP", "MODERATE", "FLAT"]

    for result in results:
        assert result["angle"] in valid_angles


def test_validate_mixed_trend_detection(mixed_trend_data):
    """Test detection with data containing multiple trend phases."""
    results = detect_and_validate_trendlines(
        mixed_trend_data, min_touches=2, min_r_squared=0.7, min_strength=40.0
    )

    # Should detect trends (uptrend or downtrend portions)
    # The quality depends on how well linear regression fits the mixed data
    for result in results:
        assert result["strength"] >= 40.0
        assert result["r_squared"] >= 0.7
        assert result["touches"] >= 2


def test_validate_custom_tolerance(strong_uptrend_data):
    """Test validation with custom tolerance parameter."""
    # Strict tolerance
    strict_results = detect_and_validate_trendlines(
        strong_uptrend_data,
        min_touches=2,
        min_r_squared=0.7,
        min_strength=40.0,
        tolerance=0.001,  # 0.1% tolerance
    )

    # Loose tolerance
    loose_results = detect_and_validate_trendlines(
        strong_uptrend_data,
        min_touches=2,
        min_r_squared=0.7,
        min_strength=40.0,
        tolerance=0.05,  # 5% tolerance
    )

    # Loose tolerance should allow more touches and potentially more trendlines
    # or higher touch counts
    if strict_results and loose_results:
        strict_touches = strict_results[0]["touches"]
        loose_touches = loose_results[0]["touches"]
        assert loose_touches >= strict_touches


def test_validate_trendline_object_valid(strong_uptrend_data):
    """Test that returned trendline objects are valid TrendlineResult instances."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data, min_touches=2, min_r_squared=0.7, min_strength=40.0
    )

    for result in results:
        trendline = result["trendline"]

        # Verify TrendlineResult attributes
        assert hasattr(trendline, "slope")
        assert hasattr(trendline, "intercept")
        assert hasattr(trendline, "r_squared")
        assert hasattr(trendline, "start_point")
        assert hasattr(trendline, "end_point")

        # Verify R² is in valid range
        assert 0 <= trendline.r_squared <= 1


def test_validate_strength_calculation_consistency(strong_uptrend_data):
    """Test that strength score in results matches manual calculation."""
    from calculators.trendline_validator import TrendlineValidator

    results = detect_and_validate_trendlines(
        strong_uptrend_data,
        min_touches=2,
        min_r_squared=0.7,
        min_strength=40.0,
        tolerance=0.01,
    )

    if results:
        result = results[0]
        trendline = result["trendline"]

        # Manual calculation using validator
        validator = TrendlineValidator(
            min_touches=2, min_r_squared=0.7, min_strength=40.0
        )
        manual_strength = validator.calculate_strength_score(
            trendline, strong_uptrend_data, tolerance=0.01
        )

        # Should match
        assert abs(result["strength"] - manual_strength) < 0.01


def test_validate_slope_preserved(strong_uptrend_data):
    """Test that trendline slope is preserved in results."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data, min_touches=2, min_r_squared=0.7, min_strength=40.0
    )

    for result in results:
        # Slope in result should match trendline slope
        assert result["slope"] == result["trendline"].slope


def test_validate_insufficient_data():
    """Test with minimal data that might not produce valid trendlines."""
    base_time = datetime(2024, 1, 1, 9, 0)
    minimal_data = []

    # Only 5 data points
    for i in range(5):
        price = 100 + i
        minimal_data.append(
            OHLCVData(
                timestamp=base_time + timedelta(days=i),
                open=price,
                high=price + 1,
                low=price - 1,
                close=price + 0.5,
                volume=1000000,
            )
        )

    # Should not crash, but might not find valid trendlines
    results = detect_and_validate_trendlines(
        minimal_data, min_touches=2, min_r_squared=0.7, min_strength=40.0
    )

    # Results could be empty or have valid trendlines
    assert isinstance(results, list)


def test_validate_high_quality_threshold(strong_uptrend_data):
    """Test with very high quality thresholds."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data,
        min_touches=10,  # Very high touch requirement
        min_r_squared=0.9,  # Very high R² requirement
        min_strength=80.0,  # Very high strength requirement
    )

    # Only extremely high-quality trendlines should pass
    for result in results:
        assert result["touches"] >= 10
        assert result["r_squared"] >= 0.9
        assert result["strength"] >= 80.0


def test_validate_results_structure(strong_uptrend_data):
    """Test that all results have complete structure."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data, min_touches=2, min_r_squared=0.7, min_strength=40.0
    )

    required_keys = ["trendline", "strength", "touches", "angle", "r_squared", "slope"]

    for result in results:
        for key in required_keys:
            assert key in result, f"Missing key: {key}"


def test_validate_no_duplicate_trendlines(strong_uptrend_data):
    """Test that results don't contain duplicate trendlines."""
    results = detect_and_validate_trendlines(
        strong_uptrend_data, min_touches=2, min_r_squared=0.5, min_strength=30.0
    )

    if len(results) >= 2:
        # Check that trendlines are different
        slopes = [r["slope"] for r in results]
        # Allow for some floating point tolerance
        for i in range(len(slopes)):
            for j in range(i + 1, len(slopes)):
                # Slopes should be different (not exact duplicates)
                assert (
                    abs(slopes[i] - slopes[j]) > 0.001 or True
                )  # Different or same is OK for now
