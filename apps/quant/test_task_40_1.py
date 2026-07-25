"""
Test script for Task 40.1: Verify trendline route integration with Quant Engine.

This script tests:
1. POST /quant/trendline route exists
2. POST /quant/analyze endpoint accepts include_trendline parameter
3. AnalysisResult model includes optional trendline field
"""

import json
import requests
from datetime import datetime, timedelta

# Base URL for Quant Engine
BASE_URL = "http://localhost:8000"


def generate_test_data(num_candles=250):
    """Generate synthetic market data for testing."""
    data = []
    base_price = 2450.0
    timestamp = datetime.now() - timedelta(days=num_candles)

    for i in range(num_candles):
        # Simulate an uptrend with some noise
        trend = i * 0.5
        noise = (i % 10 - 5) * 2

        open_price = base_price + trend + noise
        high_price = open_price + abs(noise) + 10
        low_price = open_price - abs(noise) - 5
        close_price = open_price + (noise / 2)

        data.append(
            {
                "timestamp": (timestamp + timedelta(days=i)).isoformat() + "Z",
                "open": round(open_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "close": round(close_price, 2),
                "volume": 1000000 + (i * 1000),
            }
        )

    return data


def test_health():
    """Test health endpoint."""
    print("Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200, f"Health check failed: {response.status_code}"
    print("✓ Health endpoint working")


def test_trendline_route():
    """Test POST /quant/trendline route."""
    print("\nTesting POST /quant/trendline route...")

    request_data = {
        "symbol": "RELIANCE",
        "timeframe": "1d",
        "data": generate_test_data(250),
    }

    response = requests.post(
        f"{BASE_URL}/quant/trendline", json=request_data, params={"lookback_period": 3}
    )

    assert (
        response.status_code == 200
    ), f"Trendline endpoint failed: {response.status_code} - {response.text}"

    result = response.json()

    # Validate response structure
    assert "swing_points" in result, "Response missing swing_points"
    assert "support_trendline" in result, "Response missing support_trendline"
    assert "resistance_trendline" in result, "Response missing resistance_trendline"
    assert "breakout" in result, "Response missing breakout"

    print(f"✓ POST /quant/trendline working")
    print(f"  - Found {len(result['swing_points'])} swing points")
    print(f"  - Support trendline: {'Yes' if result['support_trendline'] else 'No'}")
    print(
        f"  - Resistance trendline: {'Yes' if result['resistance_trendline'] else 'No'}"
    )
    print(f"  - Breakout type: {result['breakout']['breakout_type']}")


def test_analyze_without_trendline():
    """Test POST /quant/analyze without trendline analysis."""
    print("\nTesting POST /quant/analyze (without trendline)...")

    request_data = {
        "symbol": "RELIANCE",
        "timeframe": "1d",
        "data": generate_test_data(250),
    }

    response = requests.post(f"{BASE_URL}/quant/analyze", json=request_data)

    assert (
        response.status_code == 200
    ), f"Analyze endpoint failed: {response.status_code} - {response.text}"

    result = response.json()

    # Validate response structure
    assert "symbol" in result, "Response missing symbol"
    assert "indicators" in result, "Response missing indicators"
    assert "support_resistance" in result, "Response missing support_resistance"
    assert "trendlines" in result, "Response missing trendlines"
    assert "trendline" in result, "Response missing trendline field"

    # Without include_trendline=true, trendline should be None
    assert (
        result["trendline"] is None
    ), "Expected trendline to be None when not requested"

    print(f"✓ POST /quant/analyze working (without trendline)")
    print(f"  - Symbol: {result['symbol']}")
    print(f"  - RSI: {result['indicators']['rsi']:.2f}")
    print(f"  - Trendline field: None (as expected)")


def test_analyze_with_trendline():
    """Test POST /quant/analyze with trendline analysis."""
    print("\nTesting POST /quant/analyze (with trendline)...")

    request_data = {
        "symbol": "RELIANCE",
        "timeframe": "1d",
        "data": generate_test_data(250),
    }

    response = requests.post(
        f"{BASE_URL}/quant/analyze",
        json=request_data,
        params={"include_trendline": True},
    )

    assert (
        response.status_code == 200
    ), f"Analyze endpoint failed: {response.status_code} - {response.text}"

    result = response.json()

    # Validate response structure
    assert "symbol" in result, "Response missing symbol"
    assert "indicators" in result, "Response missing indicators"
    assert "trendline" in result, "Response missing trendline field"

    # With include_trendline=true, trendline should contain analysis results
    assert (
        result["trendline"] is not None
    ), "Expected trendline to contain analysis when requested"
    assert (
        "swing_points" in result["trendline"]
    ), "Trendline analysis missing swing_points"
    assert (
        "support_trendline" in result["trendline"]
    ), "Trendline analysis missing support_trendline"
    assert (
        "resistance_trendline" in result["trendline"]
    ), "Trendline analysis missing resistance_trendline"
    assert "breakout" in result["trendline"], "Trendline analysis missing breakout"

    print(f"✓ POST /quant/analyze working (with trendline)")
    print(f"  - Symbol: {result['symbol']}")
    print(f"  - RSI: {result['indicators']['rsi']:.2f}")
    print(f"  - Trendline field: Present")
    print(f"  - Swing points: {len(result['trendline']['swing_points'])}")
    print(f"  - Breakout type: {result['trendline']['breakout']['breakout_type']}")


def main():
    """Run all tests."""
    print("=" * 60)
    print("Task 40.1 Verification: Trendline Route Integration")
    print("=" * 60)

    try:
        test_health()
        test_trendline_route()
        test_analyze_without_trendline()
        test_analyze_with_trendline()

        print("\n" + "=" * 60)
        print("✓ ALL TESTS PASSED")
        print("=" * 60)
        print("\nTask 40.1 completed successfully!")
        print("- POST /quant/trendline route exists and works")
        print("- POST /quant/analyze accepts include_trendline parameter")
        print("- AnalysisResult model includes optional trendline field")

    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        return 1
    except requests.exceptions.ConnectionError:
        print("\n✗ ERROR: Cannot connect to Quant Engine at http://localhost:8000")
        print("Please start the Quant Engine first with: python main.py")
        return 1
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}")
        import traceback

        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
