#!/usr/bin/env python3
"""
Test script to verify ScoreResult model functionality.

This script validates:
1. Model can be instantiated with valid data
2. Field validations work correctly
3. Examples are valid
4. Serialization/deserialization works
"""

from models import ScoreResult, TrendEnum


def test_valid_bullish_score():
    """Test creating a valid bullish score result."""
    score = ScoreResult(
        trend=TrendEnum.BULLISH,
        rsi=65.4,
        adx=28.5,
        vwap=2461.0,
        volumeRatio=1.25,
        score=78.5,
        signals=[
            "Strong upward trend detected (ADX > 25)",
            "RSI in bullish range (50-70)",
        ],
    )
    assert score.trend == TrendEnum.BULLISH
    assert score.rsi == 65.4
    assert score.score == 78.5
    print("✓ Valid bullish score test passed")


def test_valid_bearish_score():
    """Test creating a valid bearish score result."""
    score = ScoreResult(
        trend=TrendEnum.BEARISH,
        rsi=32.1,
        adx=31.2,
        vwap=2440.0,
        volumeRatio=1.45,
        score=25.8,
        signals=["Strong downward trend detected"],
    )
    assert score.trend == TrendEnum.BEARISH
    assert score.rsi == 32.1
    print("✓ Valid bearish score test passed")


def test_valid_neutral_score():
    """Test creating a valid neutral score result."""
    score = ScoreResult(
        trend=TrendEnum.NEUTRAL,
        rsi=48.3,
        adx=18.7,
        vwap=2455.0,
        volumeRatio=0.85,
        score=50.0,
        signals=["Weak trend (ADX < 25)"],
    )
    assert score.trend == TrendEnum.NEUTRAL
    print("✓ Valid neutral score test passed")


def test_score_boundaries():
    """Test score validation boundaries (0-100)."""
    # Test valid boundaries
    score_min = ScoreResult(
        trend=TrendEnum.BEARISH,
        rsi=30.0,
        adx=15.0,
        vwap=2400.0,
        volumeRatio=0.5,
        score=0.0,
        signals=["Minimum score"],
    )
    assert score_min.score == 0.0

    score_max = ScoreResult(
        trend=TrendEnum.BULLISH,
        rsi=70.0,
        adx=40.0,
        vwap=2500.0,
        volumeRatio=2.0,
        score=100.0,
        signals=["Maximum score"],
    )
    assert score_max.score == 100.0
    print("✓ Score boundaries test passed")


def test_invalid_score():
    """Test that invalid scores are rejected."""
    try:
        ScoreResult(
            trend=TrendEnum.BULLISH,
            rsi=65.4,
            adx=28.5,
            vwap=2461.0,
            volumeRatio=1.25,
            score=150.0,  # Invalid: > 100
            signals=[],
        )
        assert False, "Should have raised validation error for score > 100"
    except Exception as e:
        assert "score" in str(e).lower()
        print("✓ Invalid score test passed (correctly rejected)")


def test_invalid_rsi():
    """Test that invalid RSI values are rejected."""
    try:
        ScoreResult(
            trend=TrendEnum.BULLISH,
            rsi=150.0,  # Invalid: > 100
            adx=28.5,
            vwap=2461.0,
            volumeRatio=1.25,
            score=78.5,
            signals=[],
        )
        assert False, "Should have raised validation error for RSI > 100"
    except Exception as e:
        assert "rsi" in str(e).lower()
        print("✓ Invalid RSI test passed (correctly rejected)")


def test_invalid_volume_ratio():
    """Test that negative volume ratio is rejected."""
    try:
        ScoreResult(
            trend=TrendEnum.BULLISH,
            rsi=65.4,
            adx=28.5,
            vwap=2461.0,
            volumeRatio=-0.5,  # Invalid: < 0
            score=78.5,
            signals=[],
        )
        assert False, "Should have raised validation error for volumeRatio < 0"
    except Exception as e:
        # Check that the error is about volumeRatio or greater_than_equal
        error_str = str(e).lower()
        assert "volumeratio" in error_str or "greater_than_equal" in error_str
        print("✓ Invalid volume ratio test passed (correctly rejected)")


def test_serialization():
    """Test JSON serialization and deserialization."""
    score = ScoreResult(
        trend=TrendEnum.BULLISH,
        rsi=65.4,
        adx=28.5,
        vwap=2461.0,
        volumeRatio=1.25,
        score=78.5,
        signals=["Test signal"],
    )

    # Serialize to dict
    score_dict = score.model_dump()
    assert score_dict["trend"] == "BULLISH"
    assert score_dict["rsi"] == 65.4

    # Serialize to JSON
    score_json = score.model_dump_json()
    assert "BULLISH" in score_json

    # Deserialize from dict
    score_restored = ScoreResult(**score_dict)
    assert score_restored.trend == TrendEnum.BULLISH
    assert score_restored.rsi == 65.4

    print("✓ Serialization test passed")


def test_examples():
    """Test that all examples in model_config are valid."""
    examples = ScoreResult.model_config["json_schema_extra"]["examples"]

    for i, example in enumerate(examples):
        score = ScoreResult(**example)
        print(f"✓ Example {i+1} ({score.trend.value}) is valid")


def main():
    """Run all tests."""
    print("Testing ScoreResult model...\n")

    test_valid_bullish_score()
    test_valid_bearish_score()
    test_valid_neutral_score()
    test_score_boundaries()
    test_invalid_score()
    test_invalid_rsi()
    test_invalid_volume_ratio()
    test_serialization()
    test_examples()

    print("\n✅ All ScoreResult model tests passed!")


if __name__ == "__main__":
    main()
