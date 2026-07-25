"""
HTTP test for /quant/score endpoint.
This test makes actual HTTP requests to the running server.
"""

import requests
import json
from datetime import datetime, timedelta


def generate_sample_data(num_points: int = 250) -> list[dict]:
    """Generate sample OHLCV data."""
    data = []
    base_price = 2450.0
    base_date = datetime(2024, 1, 1)

    for i in range(num_points):
        trend = i * 0.8  # Upward trend
        noise = (i % 10) * 2 - 10
        close = base_price + trend + noise

        high = close + 5
        low = close - 5
        open_price = close + ((i % 3) - 1) * 2
        volume = 1000000 + (i * 2000)

        data.append(
            {
                "timestamp": (base_date + timedelta(days=i)).isoformat() + "Z",
                "open": open_price,
                "high": high,
                "low": low,
                "close": close,
                "volume": volume,
            }
        )

    return data


def test_score_endpoint():
    """Test the /quant/score endpoint via HTTP."""
    url = "http://localhost:8000/quant/score"

    print("Generating sample data...")
    sample_data = generate_sample_data(250)

    payload = {"symbol": "RELIANCE", "timeframe": "1d", "data": sample_data}

    print(f"Sending POST request to {url}...")
    print(f"Request contains {len(sample_data)} data points")

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()

        result = response.json()

        print("\n=== HTTP Response ===")
        print(f"Status Code: {response.status_code}")
        print(f"\n=== Scoring Result ===")
        print(json.dumps(result, indent=2))

        # Validate response structure
        required_fields = [
            "trend",
            "rsi",
            "adx",
            "vwap",
            "volumeRatio",
            "score",
            "signals",
        ]
        for field in required_fields:
            if field not in result:
                print(f"❌ Missing required field: {field}")
                return False

        # Validate data types and ranges
        if not 0 <= result["score"] <= 100:
            print(f"❌ Score out of range: {result['score']}")
            return False

        if not 0 <= result["rsi"] <= 100:
            print(f"❌ RSI out of range: {result['rsi']}")
            return False

        if not 0 <= result["adx"] <= 100:
            print(f"❌ ADX out of range: {result['adx']}")
            return False

        if result["trend"] not in ["BULLISH", "BEARISH", "NEUTRAL"]:
            print(f"❌ Invalid trend: {result['trend']}")
            return False

        if not isinstance(result["signals"], list):
            print(f"❌ Signals is not a list")
            return False

        print("\n✅ All validations passed!")
        print(f"\nSummary:")
        print(f"  Trend: {result['trend']}")
        print(f"  Score: {result['score']:.2f}/100")
        print(f"  RSI: {result['rsi']:.2f}")
        print(f"  ADX: {result['adx']:.2f}")
        print(f"  Signals: {len(result['signals'])} generated")

        return True

    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server at http://localhost:8000")
        print("Make sure the Quant Engine server is running:")
        print("  python main.py")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Testing POST /quant/score HTTP endpoint")
    print("=" * 60)

    success = test_score_endpoint()

    if success:
        print("\n" + "=" * 60)
        print("HTTP TEST PASSED!")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("HTTP TEST FAILED!")
        print("=" * 60)
        exit(1)
