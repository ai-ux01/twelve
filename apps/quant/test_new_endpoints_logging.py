"""
Test that new /quant/* endpoints have proper CORS and logging.

This test verifies:
1. GET /quant/indicators - accessible from frontend
2. POST /quant/analyze - accessible from frontend
3. POST /quant/score - accessible from frontend
4. All requests are logged with timing information
"""

from fastapi.testclient import TestClient
from main import app
import json
import logging

# Configure logging to see middleware output
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

client = TestClient(app)

# Sample market data for testing
SAMPLE_MARKET_DATA = {"symbol": "RELIANCE", "timeframe": "1d", "data": []}

# Generate 200 candles for testing (minimum required)
from datetime import datetime, timedelta

base_date = datetime(2024, 1, 1)
for i in range(200):
    SAMPLE_MARKET_DATA["data"].append(
        {
            "timestamp": (base_date + timedelta(days=i)).isoformat() + "Z",
            "open": 2450.0 + i * 0.5,
            "high": 2470.0 + i * 0.5,
            "low": 2445.0 + i * 0.5,
            "close": 2465.0 + i * 0.5,
            "volume": 1000000 + i * 1000,
        }
    )


def test_quant_indicators_endpoint():
    """Test GET /quant/indicators is accessible from frontend"""
    print("\n1. Testing GET /quant/indicators...")

    response = client.get(
        "/quant/indicators", headers={"Origin": "http://localhost:3000"}
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    # Check CORS headers
    assert "access-control-allow-origin" in response.headers
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"

    # Check logging header
    assert "x-process-time" in response.headers

    # Check response structure
    data = response.json()
    assert "indicators" in data
    assert len(data["indicators"]) > 0

    print(f"   ✓ Endpoint accessible from frontend")
    print(f"   ✓ CORS headers present")
    print(f"   ✓ Logging header present: {response.headers['x-process-time']}")
    print(f"   ✓ Returns {len(data['indicators'])} indicators")


def test_quant_analyze_endpoint():
    """Test POST /quant/analyze is accessible from frontend"""
    print("\n2. Testing POST /quant/analyze...")

    response = client.post(
        "/quant/analyze",
        json=SAMPLE_MARKET_DATA,
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    # Check CORS headers
    assert "access-control-allow-origin" in response.headers
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"

    # Check logging header
    assert "x-process-time" in response.headers

    # Check response structure
    data = response.json()
    assert "symbol" in data
    assert "indicators" in data
    assert data["symbol"] == "RELIANCE"

    print(f"   ✓ Endpoint accessible from frontend")
    print(f"   ✓ CORS headers present")
    print(f"   ✓ Logging header present: {response.headers['x-process-time']}")
    print(f"   ✓ Returns analysis for {data['symbol']}")


def test_quant_score_endpoint():
    """Test POST /quant/score is accessible from frontend"""
    print("\n3. Testing POST /quant/score...")

    response = client.post(
        "/quant/score",
        json=SAMPLE_MARKET_DATA,
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    # Check CORS headers
    assert "access-control-allow-origin" in response.headers
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"

    # Check logging header
    assert "x-process-time" in response.headers

    # Check response structure
    data = response.json()
    assert "trend" in data
    assert "score" in data
    assert "signals" in data

    print(f"   ✓ Endpoint accessible from frontend")
    print(f"   ✓ CORS headers present")
    print(f"   ✓ Logging header present: {response.headers['x-process-time']}")
    print(f"   ✓ Returns score: {data['score']}, trend: {data['trend']}")


def test_backend_can_access_endpoints():
    """Test that backend (localhost:4000) can also access endpoints"""
    print("\n4. Testing backend access to new endpoints...")

    # Test /quant/indicators from backend
    response = client.get(
        "/quant/indicators", headers={"Origin": "http://localhost:4000"}
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4000"

    # Test /quant/analyze from backend
    response = client.post(
        "/quant/analyze",
        json=SAMPLE_MARKET_DATA,
        headers={"Origin": "http://localhost:4000"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4000"

    print(f"   ✓ Backend can access GET /quant/indicators")
    print(f"   ✓ Backend can access POST /quant/analyze")
    print(f"   ✓ CORS headers correctly set for backend origin")


def test_old_endpoints_still_work():
    """Test backward compatibility - old endpoints still work"""
    print("\n5. Testing backward compatibility with old endpoints...")

    # Test old /analyze endpoint
    response = client.post(
        "/analyze", json=SAMPLE_MARKET_DATA, headers={"Origin": "http://localhost:4000"}
    )
    assert response.status_code == 200

    # Test old /indicators endpoint
    response = client.post(
        "/indicators",
        json=SAMPLE_MARKET_DATA,
        headers={"Origin": "http://localhost:4000"},
    )
    assert response.status_code == 200

    print(f"   ✓ POST /analyze still works (deprecated)")
    print(f"   ✓ POST /indicators still works (deprecated)")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("Testing New Endpoints CORS and Logging Configuration")
    print("=" * 70)

    try:
        test_quant_indicators_endpoint()
        test_quant_analyze_endpoint()
        test_quant_score_endpoint()
        test_backend_can_access_endpoints()
        test_old_endpoints_still_work()

        print("\n" + "=" * 70)
        print("✓ All endpoint tests passed!")
        print("=" * 70)
        print("\nSummary:")
        print("  ✓ New /quant/* endpoints accessible from frontend (localhost:3000)")
        print("  ✓ New /quant/* endpoints accessible from backend (localhost:4000)")
        print("  ✓ CORS headers properly configured")
        print("  ✓ Request logging middleware active")
        print("  ✓ X-Process-Time header added to all responses")
        print("  ✓ Backward compatibility maintained")
        print()

    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback

        traceback.print_exc()
        exit(1)
