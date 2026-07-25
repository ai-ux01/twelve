"""
Unit tests for GET /quant/indicators endpoint.

Tests verify that the indicators metadata endpoint returns complete and accurate
information about all available technical indicators.

**Validates: Requirements 3.1**
"""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_get_indicators_returns_200():
    """Test that GET /quant/indicators returns 200 OK."""
    response = client.get("/quant/indicators")
    assert response.status_code == 200


def test_get_indicators_returns_json():
    """Test that GET /quant/indicators returns valid JSON."""
    response = client.get("/quant/indicators")
    assert response.headers["content-type"] == "application/json"
    data = response.json()
    assert isinstance(data, dict)


def test_get_indicators_has_indicators_key():
    """Test that response contains 'indicators' key."""
    response = client.get("/quant/indicators")
    data = response.json()
    assert "indicators" in data
    assert isinstance(data["indicators"], list)


def test_get_indicators_returns_all_indicators():
    """Test that all expected indicators are returned."""
    response = client.get("/quant/indicators")
    data = response.json()

    indicator_names = {ind["name"] for ind in data["indicators"]}
    expected_names = {"RSI", "MACD", "SMA", "EMA", "Bollinger Bands"}

    assert expected_names.issubset(
        indicator_names
    ), f"Missing indicators: {expected_names - indicator_names}"


def test_get_indicators_each_has_required_fields():
    """Test that each indicator has name, description, and parameters."""
    response = client.get("/quant/indicators")
    data = response.json()

    for indicator in data["indicators"]:
        assert "name" in indicator, f"Indicator missing 'name': {indicator}"
        assert (
            "description" in indicator
        ), f"Indicator missing 'description': {indicator}"
        assert "parameters" in indicator, f"Indicator missing 'parameters': {indicator}"

        assert isinstance(indicator["name"], str)
        assert isinstance(indicator["description"], str)
        assert isinstance(indicator["parameters"], dict)
        assert len(indicator["name"]) > 0
        assert len(indicator["description"]) > 0


def test_get_indicators_rsi_metadata():
    """Test RSI indicator metadata is correct."""
    response = client.get("/quant/indicators")
    data = response.json()

    rsi = next(ind for ind in data["indicators"] if ind["name"] == "RSI")

    assert "period" in rsi["parameters"]
    assert rsi["parameters"]["period"]["type"] == "integer"
    assert rsi["parameters"]["period"]["default"] == 14
    assert "description" in rsi["parameters"]["period"]
    assert "output_range" in rsi
    assert rsi["output_range"] == "0 to 100"


def test_get_indicators_macd_metadata():
    """Test MACD indicator metadata is correct."""
    response = client.get("/quant/indicators")
    data = response.json()

    macd = next(ind for ind in data["indicators"] if ind["name"] == "MACD")

    assert "fast_period" in macd["parameters"]
    assert "slow_period" in macd["parameters"]
    assert "signal_period" in macd["parameters"]
    assert macd["parameters"]["fast_period"]["default"] == 12
    assert macd["parameters"]["slow_period"]["default"] == 26
    assert macd["parameters"]["signal_period"]["default"] == 9
    assert "output_fields" in macd
    assert set(macd["output_fields"]) == {"value", "signal", "histogram"}


def test_get_indicators_sma_metadata():
    """Test SMA indicator metadata is correct."""
    response = client.get("/quant/indicators")
    data = response.json()

    sma = next(ind for ind in data["indicators"] if ind["name"] == "SMA")

    assert "period" in sma["parameters"]
    assert sma["parameters"]["period"]["default"] == 20
    assert "common_periods" in sma
    assert set(sma["common_periods"]) == {20, 50, 200}


def test_get_indicators_ema_metadata():
    """Test EMA indicator metadata is correct."""
    response = client.get("/quant/indicators")
    data = response.json()

    ema = next(ind for ind in data["indicators"] if ind["name"] == "EMA")

    assert "period" in ema["parameters"]
    assert ema["parameters"]["period"]["default"] == 20
    assert "common_periods" in ema
    assert set(ema["common_periods"]) == {5, 15, 20, 50, 200}


def test_get_indicators_bollinger_bands_metadata():
    """Test Bollinger Bands indicator metadata is correct."""
    response = client.get("/quant/indicators")
    data = response.json()

    bb = next(ind for ind in data["indicators"] if ind["name"] == "Bollinger Bands")

    assert "period" in bb["parameters"]
    assert "num_std" in bb["parameters"]
    assert bb["parameters"]["period"]["default"] == 20
    assert bb["parameters"]["num_std"]["default"] == 2.0
    assert bb["parameters"]["num_std"]["type"] == "float"
    assert "output_fields" in bb
    assert set(bb["output_fields"]) == {"upper", "middle", "lower"}


def test_post_indicators_still_functional():
    """Test that POST /indicators still works (deprecated but functional)."""
    # Create minimal valid request with 200 data points
    from datetime import datetime, timedelta

    test_data = []
    base_price = 2450.0
    start_date = datetime(2023, 1, 1)

    for i in range(200):
        current_date = start_date + timedelta(days=i)
        test_data.append(
            {
                "timestamp": current_date.strftime("%Y-%m-%dT00:00:00Z"),
                "open": base_price + i * 0.5,
                "high": base_price + i * 0.5 + 5,
                "low": base_price + i * 0.5 - 5,
                "close": base_price + i * 0.5 + 2,
                "volume": 1000000,
            }
        )

    request_body = {"symbol": "RELIANCE", "timeframe": "1d", "data": test_data}

    response = client.post("/indicators", json=request_body)
    assert response.status_code == 200, f"POST /indicators failed: {response.text}"

    data = response.json()
    assert "rsi" in data
    assert "macd" in data
    assert "sma_20" in data


def test_post_indicators_is_marked_deprecated():
    """Test that POST /indicators endpoint is marked as deprecated in OpenAPI schema."""
    response = client.get("/openapi.json")
    assert response.status_code == 200

    openapi_schema = response.json()
    post_indicators = openapi_schema["paths"]["/indicators"]["post"]

    assert (
        post_indicators.get("deprecated") is True
    ), "POST /indicators should be marked as deprecated in OpenAPI schema"


def test_indicators_descriptions_are_informative():
    """Test that indicator descriptions contain useful information."""
    response = client.get("/quant/indicators")
    data = response.json()

    for indicator in data["indicators"]:
        description = indicator["description"]
        # Description should be at least 50 characters
        assert (
            len(description) >= 50
        ), f"Indicator {indicator['name']} has too short description: {description}"

        # Description should contain technical information
        assert any(
            keyword in description.lower()
            for keyword in [
                "momentum",
                "trend",
                "volatility",
                "average",
                "oscillator",
                "moving",
            ]
        ), f"Indicator {indicator['name']} description lacks technical context"
