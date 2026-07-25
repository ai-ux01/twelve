"""
Demo script to test the /trendlines endpoint manually.

This script demonstrates how to use the trendlines endpoint with sample data.
"""

import requests
from datetime import datetime, timedelta
import json


def create_sample_data(num_points=30, trend="up"):
    """Create sample OHLCV data for testing."""
    base_timestamp = datetime(2024, 1, 1, 9, 0, 0)
    base_price = 2400.0

    data_points = []
    for i in range(num_points):
        if trend == "up":
            price = base_price + i * 2 + (i % 5) * 3
        elif trend == "down":
            price = base_price - i * 2 + (i % 5) * 3
        else:  # sideways
            price = base_price + (10 * (i % 3 - 1))

        data_points.append(
            {
                "timestamp": (base_timestamp + timedelta(days=i)).isoformat() + "Z",
                "open": price,
                "high": price + 10,
                "low": price - 5,
                "close": price + 5,
                "volume": 1000000 + i * 10000,
            }
        )

    return data_points


def test_trendlines_endpoint(url="http://localhost:8000/trendlines"):
    """Test the trendlines endpoint with sample data."""
    print("=" * 70)
    print("Testing /trendlines endpoint")
    print("=" * 70)

    # Test with uptrend data
    print("\n1. Testing with UPTREND data (30 points)...")
    uptrend_data = {
        "symbol": "RELIANCE",
        "timeframe": "1d",
        "data": create_sample_data(30, "up"),
    }

    try:
        response = requests.post(url, json=uptrend_data, timeout=5)

        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Success!")
            print(f"   Symbol: {result['symbol']}")
            print(f"   Timeframe: {result['timeframe']}")
            print(f"   Trendlines detected: {len(result['trendlines'])}")
            print(f"   Support/Resistance levels: {len(result['support_resistance'])}")

            if result["trendlines"]:
                print("\n   Trendline details:")
                for i, trendline in enumerate(result["trendlines"], 1):
                    print(
                        f"      {i}. Slope: {trendline['slope']:.4f}, R²: {trendline['r_squared']:.4f}"
                    )

            if result["support_resistance"]:
                print("\n   Support/Resistance levels:")
                for i, level in enumerate(result["support_resistance"][:3], 1):
                    print(
                        f"      {i}. Level: {level['level']:.2f}, Strength: {level['strength']:.2f}, Touches: {level['touches']}"
                    )
        else:
            print(f"   ❌ Error: {response.status_code}")
            print(f"   {response.text}")
    except requests.exceptions.ConnectionError:
        print(
            "   ⚠️  Could not connect to server. Make sure the Quant Engine is running:"
        )
        print("      python main.py")
        return
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return

    # Test with downtrend data
    print("\n2. Testing with DOWNTREND data (30 points)...")
    downtrend_data = {
        "symbol": "NIFTY",
        "timeframe": "1d",
        "data": create_sample_data(30, "down"),
    }

    response = requests.post(url, json=downtrend_data, timeout=5)
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Success!")
        print(f"   Trendlines detected: {len(result['trendlines'])}")
        print(f"   Support/Resistance levels: {len(result['support_resistance'])}")

        if result["trendlines"]:
            for i, trendline in enumerate(result["trendlines"], 1):
                print(
                    f"      {i}. Slope: {trendline['slope']:.4f}, R²: {trendline['r_squared']:.4f}"
                )

    # Test with insufficient data
    print("\n3. Testing with INSUFFICIENT data (5 points)...")
    insufficient_data = {
        "symbol": "TEST",
        "timeframe": "1d",
        "data": create_sample_data(5, "up"),
    }

    response = requests.post(url, json=insufficient_data, timeout=5)
    if response.status_code == 400:
        print(f"   ✅ Correctly rejected insufficient data")
        print(f"   Error: {response.json()['detail']}")
    else:
        print(f"   ❌ Unexpected response: {response.status_code}")

    print("\n" + "=" * 70)
    print("All tests completed!")
    print("=" * 70)


if __name__ == "__main__":
    test_trendlines_endpoint()
