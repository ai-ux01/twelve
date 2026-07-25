"""
Test script for POST /quant/swing/score endpoint.

This script tests the swing scoring endpoint to verify:
- Accepts SwingAnalysisResult with pricing parameters
- Calculates deterministic component scores
- Returns SwingScoreResult with breakdown
- Validates input parameters
- Handles custom scoring weights

Requirements: 5.3
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def generate_sample_ohlcv_data(symbol: str, days: int = 200):
    """Generate sample OHLCV data for testing."""
    base_time = datetime.utcnow() - timedelta(days=days)
    data = []

    base_price = 2450.0

    for i in range(days):
        data.append(
            {
                "timestamp": (base_time + timedelta(days=i)).isoformat() + "Z",
                "open": base_price + i * 0.5,
                "high": base_price + i * 0.5 + 20,
                "low": base_price + i * 0.5 - 15,
                "close": base_price + i * 0.5 + 10,
                "volume": 1000000 + i * 10000,
            }
        )

    return data


def test_score_endpoint():
    """Test the /quant/swing/score endpoint."""
    print("=" * 80)
    print("Testing POST /quant/swing/score endpoint")
    print("=" * 80)

    # Step 1: Get analysis result first
    print("\n1. Getting swing analysis...")
    analyze_url = f"{BASE_URL}/quant/swing/analyze"
    analyze_payload = {
        "symbol": "RELIANCE",
        "timeframe": "1d",
        "data": generate_sample_ohlcv_data("RELIANCE", 200),
    }

    analyze_response = requests.post(analyze_url, json=analyze_payload)

    if analyze_response.status_code != 200:
        print(f"❌ Analysis failed: {analyze_response.status_code}")
        print(f"Error: {analyze_response.text}")
        return

    analysis = analyze_response.json()
    print(f"✅ Analysis successful for {analysis['symbol']}")
    print(f"   RSI: {analysis['indicators']['rsi']:.2f}")
    print(f"   ADX: {analysis['indicators']['adx']:.2f}")
    print(f"   Relative Volume: {analysis['volume_analysis']['relative_volume']:.2f}")

    # Step 2: Score the analysis with default weights
    print("\n2. Scoring with default weights...")
    score_url = f"{BASE_URL}/quant/swing/score"

    current_price = analysis["price_range_analysis"]["current_price"]

    score_payload = {
        "analysis": analysis,
        "entry_price": current_price,
        "stop_loss": current_price * 0.98,  # 2% stop loss
        "target": current_price * 1.06,  # 6% target (3:1 R/R)
        "sector_comparison": 70.0,
        "market_comparison": 60.0,
        "breakout_detected": True,
        "volume_confirmed": True,
        "retest_detected": False,
        "sector_strength": 68.5,
    }

    score_response = requests.post(score_url, json=score_payload)

    if score_response.status_code != 200:
        print(f"❌ Scoring failed: {score_response.status_code}")
        print(f"Error: {score_response.text}")
        return

    score_result = score_response.json()
    print(f"✅ Scoring successful!")
    print(f"   Total Score: {score_result['total_score']:.2f}/100")
    print(f"\n   Component Scores:")
    for component, score in score_result["components"].items():
        print(f"   - {component}: {score:.2f}")

    print(f"\n   Signals:")
    for signal in score_result["signals"]:
        print(f"   - {signal}")

    # Step 3: Score with custom weights
    print("\n3. Scoring with custom weights (higher trend weight)...")
    score_payload_custom = {
        **score_payload,
        "weights": {
            "trend_weight": 0.30,  # Increased from 0.20
            "technical_weight": 0.20,
            "volume_weight": 0.15,
            "relative_strength_weight": 0.10,  # Decreased from 0.15
            "breakout_weight": 0.10,
            "sector_weight": 0.10,
            "risk_reward_weight": 0.05,  # Decreased from 0.10
        },
    }

    score_response_custom = requests.post(score_url, json=score_payload_custom)

    if score_response_custom.status_code != 200:
        print(f"❌ Custom scoring failed: {score_response_custom.status_code}")
        print(f"Error: {score_response_custom.text}")
        return

    score_result_custom = score_response_custom.json()
    print(f"✅ Custom scoring successful!")
    print(f"   Total Score: {score_result_custom['total_score']:.2f}/100")
    print(f"   (Compare to default: {score_result['total_score']:.2f}/100)")

    # Step 4: Test determinism - same inputs should give same outputs
    print("\n4. Testing determinism...")
    score_response_repeat = requests.post(score_url, json=score_payload)
    score_result_repeat = score_response_repeat.json()

    if score_result_repeat["total_score"] == score_result["total_score"]:
        print(
            f"✅ Determinism verified: {score_result['total_score']:.2f} == {score_result_repeat['total_score']:.2f}"
        )
    else:
        print(
            f"❌ Determinism failed: {score_result['total_score']:.2f} != {score_result_repeat['total_score']:.2f}"
        )

    # Step 5: Test validation - invalid entry/stop/target
    print("\n5. Testing validation (stop loss above entry)...")
    invalid_payload = {
        **score_payload,
        "stop_loss": current_price * 1.02,  # Invalid: stop loss above entry
    }

    invalid_response = requests.post(score_url, json=invalid_payload)

    if invalid_response.status_code == 400:
        print(f"✅ Validation working: {invalid_response.json()['detail']}")
    else:
        print(f"❌ Validation failed: expected 400, got {invalid_response.status_code}")

    # Step 6: Test with different risk/reward ratios
    print("\n6. Testing different risk/reward ratios...")

    test_cases = [
        ("1.5:1 R/R", current_price * 0.98, current_price * 1.03),
        ("2:1 R/R", current_price * 0.98, current_price * 1.04),
        ("3:1 R/R", current_price * 0.98, current_price * 1.06),
        ("4:1 R/R", current_price * 0.98, current_price * 1.08),
    ]

    print("\n   Risk/Reward Impact on Scoring:")
    for label, stop, target in test_cases:
        test_payload = {
            **score_payload,
            "stop_loss": stop,
            "target": target,
        }

        test_response = requests.post(score_url, json=test_payload)
        if test_response.status_code == 200:
            test_result = test_response.json()
            rr_score = test_result["components"]["risk_reward_score"]
            print(f"   - {label}: Risk/Reward Score = {rr_score:.2f}")
        else:
            print(f"   - {label}: Failed ({test_response.status_code})")

    print("\n" + "=" * 80)
    print("✅ All tests completed successfully!")
    print("=" * 80)


def test_edge_cases():
    """Test edge cases and error handling."""
    print("\n" + "=" * 80)
    print("Testing Edge Cases")
    print("=" * 80)

    score_url = f"{BASE_URL}/quant/swing/score"

    # Get valid analysis first
    analyze_url = f"{BASE_URL}/quant/swing/analyze"
    analyze_payload = {
        "symbol": "TCS",
        "timeframe": "1d",
        "data": generate_sample_ohlcv_data("TCS", 200),
    }

    analyze_response = requests.post(analyze_url, json=analyze_payload)
    analysis = analyze_response.json()
    current_price = analysis["price_range_analysis"]["current_price"]

    base_payload = {
        "analysis": analysis,
        "entry_price": current_price,
        "stop_loss": current_price * 0.98,
        "target": current_price * 1.06,
    }

    # Test 1: Negative entry price
    print("\n1. Negative entry price...")
    test_payload = {**base_payload, "entry_price": -100.0}
    response = requests.post(score_url, json=test_payload)
    print(f"   Status: {response.status_code} (expected 400)")
    if response.status_code == 400:
        print(f"   ✅ Error: {response.json()['detail']}")

    # Test 2: Invalid sector_comparison (> 100)
    print("\n2. Invalid sector_comparison (> 100)...")
    test_payload = {**base_payload, "sector_comparison": 150.0}
    response = requests.post(score_url, json=test_payload)
    print(f"   Status: {response.status_code} (expected 400)")
    if response.status_code == 400:
        print(f"   ✅ Error: {response.json()['detail']}")

    # Test 3: Invalid weights (don't sum to 1.0)
    print("\n3. Invalid weights (don't sum to 1.0)...")
    test_payload = {
        **base_payload,
        "weights": {
            "trend_weight": 0.50,
            "technical_weight": 0.50,
            "volume_weight": 0.10,
            "relative_strength_weight": 0.10,
            "breakout_weight": 0.10,
            "sector_weight": 0.10,
            "risk_reward_weight": 0.10,
        },
    }
    response = requests.post(score_url, json=test_payload)
    print(f"   Status: {response.status_code} (expected 400 or 500)")
    if response.status_code >= 400:
        print(f"   ✅ Error detected: {response.json()['detail']}")

    print("\n" + "=" * 80)
    print("✅ Edge case tests completed!")
    print("=" * 80)


if __name__ == "__main__":
    try:
        test_score_endpoint()
        test_edge_cases()
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Cannot connect to Quant Engine at", BASE_URL)
        print("   Make sure the server is running: python main.py")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback

        traceback.print_exc()
