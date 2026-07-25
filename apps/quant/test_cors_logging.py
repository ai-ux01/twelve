"""
Test script to verify CORS and logging middleware configuration.

This script tests:
1. CORS headers are present for frontend and backend origins
2. Request logging middleware works correctly
3. New /quant/* endpoints are accessible
"""

from fastapi.testclient import TestClient
from main import app
import logging

# Set up logging to capture middleware logs
logging.basicConfig(level=logging.INFO)

client = TestClient(app)


def test_cors_frontend_origin():
    """Test CORS allows frontend origin (localhost:3000)"""
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    print("✓ CORS allows frontend origin (localhost:3000)")


def test_cors_backend_origin():
    """Test CORS allows backend origin (localhost:4000)"""
    response = client.get("/health", headers={"Origin": "http://localhost:4000"})

    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
    assert response.headers["access-control-allow-origin"] == "http://localhost:4000"
    print("✓ CORS allows backend origin (localhost:4000)")


def test_cors_credentials():
    """Test CORS allows credentials"""
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})

    assert "access-control-allow-credentials" in response.headers
    assert response.headers["access-control-allow-credentials"] == "true"
    print("✓ CORS allows credentials")


def test_logging_middleware_adds_header():
    """Test logging middleware adds X-Process-Time header"""
    response = client.get("/health")

    assert "x-process-time" in response.headers
    # Verify header format (should be like "0.50ms")
    process_time = response.headers["x-process-time"]
    assert process_time.endswith("ms")
    print(f"✓ Logging middleware adds X-Process-Time header: {process_time}")


def test_new_quant_indicators_endpoint():
    """Test new /quant/indicators endpoint is accessible"""
    response = client.get(
        "/quant/indicators", headers={"Origin": "http://localhost:3000"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "indicators" in data
    assert isinstance(data["indicators"], list)
    assert len(data["indicators"]) > 0

    # Verify CORS headers
    assert "access-control-allow-origin" in response.headers
    print(
        f"✓ GET /quant/indicators accessible and returns {len(data['indicators'])} indicators"
    )


def test_cors_preflight_request():
    """Test CORS preflight (OPTIONS) request"""
    response = client.options(
        "/quant/indicators",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
    assert "access-control-allow-methods" in response.headers
    print("✓ CORS preflight (OPTIONS) request works")


def test_cors_rejects_unknown_origin():
    """Test CORS rejects requests from unknown origins"""
    response = client.get("/health", headers={"Origin": "http://malicious-site.com"})

    # FastAPI CORS middleware returns 200 but without CORS headers for unknown origins
    assert response.status_code == 200
    # The origin should not be in allowed origins
    if "access-control-allow-origin" in response.headers:
        # If header exists, it should NOT be the malicious origin
        assert (
            response.headers["access-control-allow-origin"]
            != "http://malicious-site.com"
        )
    print("✓ CORS properly handles unknown origins")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Testing CORS and Logging Middleware Configuration")
    print("=" * 60 + "\n")

    try:
        test_cors_frontend_origin()
        test_cors_backend_origin()
        test_cors_credentials()
        test_logging_middleware_adds_header()
        test_new_quant_indicators_endpoint()
        test_cors_preflight_request()
        test_cors_rejects_unknown_origin()

        print("\n" + "=" * 60)
        print("✓ All tests passed!")
        print("=" * 60 + "\n")

    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        exit(1)
