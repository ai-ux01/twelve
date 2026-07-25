"""
Integration tests for the /analyze endpoint.
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from main import app
from models import OHLCVData, MarketDataRequest


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


def generate_sample_data(num_points: int = 250) -> list[dict]:
    """Generate sample OHLCV data for testing."""
    data = []
    base_price = 2450.0
    base_date = datetime(2024, 1, 1)

    for i in range(num_points):
        # Simple trending price simulation
        trend = i * 0.5
        noise = (i % 10) * 2 - 10
        close = base_price + trend + noise

        high = close + 5
        low = close - 5
        open_price = close + ((i % 3) - 1) * 2

        data.append(
            {
                "timestamp": (base_date + timedelta(days=i)).isoformat() + "Z",
                "open": round(open_price, 2),
                "high": round(high, 2),
                "low": round(low, 2),
                "close": round(close, 2),
                "volume": 1000000 + (i * 1000),
            }
        )

    return data


class TestAnalyzeEndpoint:
    """Tests for the POST /analyze endpoint."""

    def test_analyze_with_valid_data(self, client):
        """Test the /analyze endpoint with valid data."""
        request_data = {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": generate_sample_data(250),
        }

        response = client.post("/analyze", json=request_data)

        assert response.status_code == 200
        result = response.json()

        # Check response structure
        assert result["symbol"] == "RELIANCE"
        assert result["timeframe"] == "1d"
        assert "indicators" in result
        assert "support_resistance" in result
        assert "trendlines" in result

        # Check indicators
        indicators = result["indicators"]
        assert "rsi" in indicators
        assert 0 <= indicators["rsi"] <= 100

        assert "macd" in indicators
        assert "value" in indicators["macd"]
        assert "signal" in indicators["macd"]
        assert "histogram" in indicators["macd"]

        assert "sma_20" in indicators
        assert "sma_50" in indicators
        assert "sma_200" in indicators
        assert "ema_20" in indicators

        assert "bollinger_bands" in indicators
        assert "upper" in indicators["bollinger_bands"]
        assert "middle" in indicators["bollinger_bands"]
        assert "lower" in indicators["bollinger_bands"]

        # Validate Bollinger Bands ordering
        assert (
            indicators["bollinger_bands"]["upper"]
            > indicators["bollinger_bands"]["middle"]
        )
        assert (
            indicators["bollinger_bands"]["middle"]
            > indicators["bollinger_bands"]["lower"]
        )

    def test_analyze_with_insufficient_data(self, client):
        """Test the /analyze endpoint with insufficient data."""
        request_data = {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": generate_sample_data(50),  # Less than 200 required
        }

        response = client.post("/analyze", json=request_data)

        assert response.status_code == 400
        assert "Insufficient data" in response.json()["detail"]

    def test_analyze_with_invalid_symbol(self, client):
        """Test the /analyze endpoint with invalid symbol."""
        request_data = {
            "symbol": "",  # Empty symbol
            "timeframe": "1d",
            "data": generate_sample_data(250),
        }

        response = client.post("/analyze", json=request_data)

        assert response.status_code == 422  # Validation error

    def test_analyze_with_invalid_timeframe(self, client):
        """Test the /analyze endpoint with invalid timeframe."""
        request_data = {
            "symbol": "RELIANCE",
            "timeframe": "invalid",  # Invalid timeframe
            "data": generate_sample_data(250),
        }

        response = client.post("/analyze", json=request_data)

        assert response.status_code == 422  # Validation error

    def test_health_endpoint(self, client):
        """Test the /health endpoint."""
        response = client.get("/health")

        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "ok"
        assert result["service"] == "Quant Engine"

    def test_root_endpoint(self, client):
        """Test the root endpoint."""
        response = client.get("/")

        assert response.status_code == 200
        result = response.json()
        assert result["service"] == "ProfitTerminal Quant Engine"
        assert result["status"] == "running"
