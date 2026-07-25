"""
Integration tests for the /trendlines endpoint.

These tests verify that the trendlines endpoint correctly integrates the
support/resistance and trendline detection calculators.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_uptrend_data():
    """Create sample market data with an uptrend."""
    base_timestamp = datetime(2024, 1, 1, 9, 0, 0)
    base_price = 2400.0

    data_points = []
    for i in range(30):
        # Create an uptrend with some noise
        price = base_price + i * 2 + (i % 5) * 3
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

    return {"symbol": "RELIANCE", "timeframe": "1d", "data": data_points}


@pytest.fixture
def sample_sideways_data():
    """Create sample market data with sideways movement."""
    base_timestamp = datetime(2024, 1, 1, 9, 0, 0)
    base_price = 2400.0

    data_points = []
    for i in range(30):
        # Sideways with oscillation
        price = base_price + (10 * (i % 3 - 1))
        data_points.append(
            {
                "timestamp": (base_timestamp + timedelta(days=i)).isoformat() + "Z",
                "open": price,
                "high": price + 8,
                "low": price - 8,
                "close": price + 2,
                "volume": 1000000,
            }
        )

    return {"symbol": "NIFTY", "timeframe": "1d", "data": data_points}


class TestTrendlinesEndpoint:
    """Test suite for /trendlines endpoint."""

    def test_endpoint_with_valid_uptrend_data(self, client, sample_uptrend_data):
        """Test trendlines endpoint with uptrend data returns valid results."""
        response = client.post("/trendlines", json=sample_uptrend_data)

        assert response.status_code == 200
        result = response.json()

        # Verify response structure
        assert "symbol" in result
        assert "timeframe" in result
        assert "support_resistance" in result
        assert "trendlines" in result

        # Verify values
        assert result["symbol"] == "RELIANCE"
        assert result["timeframe"] == "1d"

        # Verify data types
        assert isinstance(result["support_resistance"], list)
        assert isinstance(result["trendlines"], list)

        # With uptrend, we should detect at least one trendline
        assert (
            len(result["trendlines"]) > 0
        ), "Expected to detect trendlines in uptrend data"

        # Verify trendline structure
        for trendline in result["trendlines"]:
            assert "slope" in trendline
            assert "intercept" in trendline
            assert "r_squared" in trendline
            assert "start_point" in trendline
            assert "end_point" in trendline

            # R-squared should be between 0 and 1
            assert 0 <= trendline["r_squared"] <= 1

            # For uptrend, slope should be positive
            assert trendline["slope"] > 0, "Expected positive slope for uptrend"

        # Verify support/resistance structure
        for level in result["support_resistance"]:
            assert "level" in level
            assert "strength" in level
            assert "touches" in level

            # Strength should be between 0 and 1
            assert 0 <= level["strength"] <= 1

            # Touches should be at least 2 (our min_touches parameter)
            assert level["touches"] >= 2

            # Level should be positive
            assert level["level"] > 0

    def test_endpoint_with_sideways_data(self, client, sample_sideways_data):
        """Test trendlines endpoint with sideways market data."""
        response = client.post("/trendlines", json=sample_sideways_data)

        assert response.status_code == 200
        result = response.json()

        assert result["symbol"] == "NIFTY"
        assert result["timeframe"] == "1d"

        # Sideways market might have fewer or no strong trendlines
        # But support/resistance should be detected
        assert isinstance(result["trendlines"], list)
        assert isinstance(result["support_resistance"], list)

    def test_endpoint_with_insufficient_data(self, client):
        """Test endpoint rejects requests with insufficient data points."""
        insufficient_data = {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": "2024-01-01T00:00:00Z",
                    "open": 2400.0,
                    "high": 2410.0,
                    "low": 2390.0,
                    "close": 2405.0,
                    "volume": 1000000,
                }
                for _ in range(5)  # Only 5 data points
            ],
        }

        response = client.post("/trendlines", json=insufficient_data)

        assert response.status_code == 400
        error = response.json()
        assert "detail" in error
        assert "Insufficient data" in error["detail"]
        assert "10 data points" in error["detail"]

    def test_endpoint_with_empty_data(self, client):
        """Test endpoint rejects requests with empty data."""
        empty_data = {"symbol": "RELIANCE", "timeframe": "1d", "data": []}

        response = client.post("/trendlines", json=empty_data)

        # Should fail Pydantic validation
        assert response.status_code == 422

    def test_endpoint_with_invalid_timeframe(self, client, sample_uptrend_data):
        """Test endpoint rejects invalid timeframe."""
        sample_uptrend_data["timeframe"] = "invalid"

        response = client.post("/trendlines", json=sample_uptrend_data)

        # Should fail Pydantic validation
        assert response.status_code == 422

    def test_endpoint_with_missing_symbol(self, client, sample_uptrend_data):
        """Test endpoint rejects missing symbol."""
        del sample_uptrend_data["symbol"]

        response = client.post("/trendlines", json=sample_uptrend_data)

        # Should fail Pydantic validation
        assert response.status_code == 422

    def test_endpoint_response_serialization(self, client, sample_uptrend_data):
        """Test that response is properly serialized JSON."""
        response = client.post("/trendlines", json=sample_uptrend_data)

        assert response.status_code == 200

        # Should be valid JSON
        result = response.json()
        assert isinstance(result, dict)

        # All numeric values should be serializable (not NaN or Inf)
        for trendline in result["trendlines"]:
            assert isinstance(trendline["slope"], (int, float))
            assert isinstance(trendline["intercept"], (int, float))
            assert isinstance(trendline["r_squared"], (int, float))

        for level in result["support_resistance"]:
            assert isinstance(level["level"], (int, float))
            assert isinstance(level["strength"], (int, float))
            assert isinstance(level["touches"], int)

    def test_endpoint_with_exact_minimum_data(self, client):
        """Test endpoint with exactly 10 data points (minimum required)."""
        base_timestamp = datetime(2024, 1, 1, 9, 0, 0)

        minimal_data = {
            "symbol": "TEST",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": (base_timestamp + timedelta(days=i)).isoformat() + "Z",
                    "open": 2400.0 + i,
                    "high": 2410.0 + i,
                    "low": 2390.0 + i,
                    "close": 2405.0 + i,
                    "volume": 1000000,
                }
                for i in range(10)  # Exactly 10 data points
            ],
        }

        response = client.post("/trendlines", json=minimal_data)

        # Should succeed with exactly 10 points
        assert response.status_code == 200
        result = response.json()
        assert result["symbol"] == "TEST"


class TestTrendlinesEndpointIntegration:
    """Integration tests for trendlines endpoint behavior."""

    def test_trendlines_sorted_by_quality(self, client, sample_uptrend_data):
        """Test that trendlines are sorted by R² value (best fit first)."""
        response = client.post("/trendlines", json=sample_uptrend_data)

        assert response.status_code == 200
        result = response.json()

        trendlines = result["trendlines"]

        if len(trendlines) > 1:
            # Verify trendlines are sorted by R² (descending)
            r_squared_values = [t["r_squared"] for t in trendlines]
            assert r_squared_values == sorted(r_squared_values, reverse=True)

    def test_support_resistance_sorted_by_strength(self, client, sample_uptrend_data):
        """Test that support/resistance levels are sorted by strength."""
        response = client.post("/trendlines", json=sample_uptrend_data)

        assert response.status_code == 200
        result = response.json()

        levels = result["support_resistance"]

        if len(levels) > 1:
            # Verify levels are sorted by strength (descending)
            strength_values = [l["strength"] for l in levels]
            assert strength_values == sorted(strength_values, reverse=True)

    def test_endpoint_performance_with_large_dataset(self, client):
        """Test endpoint handles larger datasets efficiently."""
        base_timestamp = datetime(2024, 1, 1, 9, 0, 0)

        # Create 100 data points
        large_data = {
            "symbol": "LARGE",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": (base_timestamp + timedelta(days=i)).isoformat() + "Z",
                    "open": 2400.0 + i * 0.5,
                    "high": 2410.0 + i * 0.5,
                    "low": 2390.0 + i * 0.5,
                    "close": 2405.0 + i * 0.5,
                    "volume": 1000000 + i * 1000,
                }
                for i in range(100)
            ],
        }

        response = client.post("/trendlines", json=large_data)

        assert response.status_code == 200
        result = response.json()

        # Should successfully process large dataset
        assert result["symbol"] == "LARGE"
        assert isinstance(result["trendlines"], list)
        assert isinstance(result["support_resistance"], list)
