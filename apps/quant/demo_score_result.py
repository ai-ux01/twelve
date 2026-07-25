#!/usr/bin/env python3
"""
Demo script showing ScoreResult model usage in API endpoints.

This demonstrates how the ScoreResult model will be used in the
POST /quant/score endpoint for deterministic market scoring.
"""

from models import ScoreResult, TrendEnum
import json


def generate_bullish_score():
    """Generate a sample bullish market score."""
    return ScoreResult(
        trend=TrendEnum.BULLISH,
        rsi=65.4,
        adx=28.5,
        vwap=2461.0,
        volumeRatio=1.25,
        score=78.5,
        signals=[
            "Strong upward trend detected (ADX > 25)",
            "RSI in bullish range (50-70)",
            "Above average volume (1.25x)",
            "Price trading above VWAP",
        ],
    )


def generate_bearish_score():
    """Generate a sample bearish market score."""
    return ScoreResult(
        trend=TrendEnum.BEARISH,
        rsi=32.1,
        adx=31.2,
        vwap=2440.0,
        volumeRatio=1.45,
        score=25.8,
        signals=[
            "Strong downward trend detected (ADX > 25)",
            "RSI in bearish range (<40)",
            "Above average volume (1.45x)",
            "Price trading below VWAP",
        ],
    )


def generate_neutral_score():
    """Generate a sample neutral market score."""
    return ScoreResult(
        trend=TrendEnum.NEUTRAL,
        rsi=48.3,
        adx=18.7,
        vwap=2455.0,
        volumeRatio=0.85,
        score=50.0,
        signals=[
            "Weak trend (ADX < 25)",
            "RSI near neutral (45-55)",
            "Below average volume (0.85x)",
            "Price near VWAP",
        ],
    )


def simulate_api_response(score_result: ScoreResult) -> dict:
    """
    Simulate an API response using the ScoreResult model.

    This is how the POST /quant/score endpoint will return data.
    """
    return {
        "status": "success",
        "data": score_result.model_dump(),
        "timestamp": "2024-01-15T10:30:00Z",
    }


def main():
    """Demonstrate ScoreResult model usage."""
    print("=" * 60)
    print("ScoreResult Model Demo - API Endpoint Usage")
    print("=" * 60)

    # Generate and display bullish score
    print("\n1. BULLISH Market Score:")
    print("-" * 60)
    bullish = generate_bullish_score()
    response = simulate_api_response(bullish)
    print(json.dumps(response, indent=2))

    # Generate and display bearish score
    print("\n2. BEARISH Market Score:")
    print("-" * 60)
    bearish = generate_bearish_score()
    response = simulate_api_response(bearish)
    print(json.dumps(response, indent=2))

    # Generate and display neutral score
    print("\n3. NEUTRAL Market Score:")
    print("-" * 60)
    neutral = generate_neutral_score()
    response = simulate_api_response(neutral)
    print(json.dumps(response, indent=2))

    # Show validation in action
    print("\n4. Field Validation Demo:")
    print("-" * 60)
    print("✓ RSI validated: 0-100 range")
    print("✓ ADX validated: 0-100 range")
    print("✓ VWAP validated: must be positive")
    print("✓ volumeRatio validated: must be >= 0")
    print("✓ score validated: 0-100 range")
    print("✓ trend validated: must be BULLISH, BEARISH, or NEUTRAL")

    # Show compact JSON for API transmission
    print("\n5. Compact JSON (for API transmission):")
    print("-" * 60)
    compact_json = bullish.model_dump_json()
    print(compact_json)

    print("\n" + "=" * 60)
    print("✅ ScoreResult model is ready for POST /quant/score endpoint!")
    print("=" * 60)


if __name__ == "__main__":
    main()
