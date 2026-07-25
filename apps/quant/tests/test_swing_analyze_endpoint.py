"""
Unit tests for POST /quant/swing/analyze endpoint.

Tests comprehensive technical analysis for swing trading.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from main import app

client = TestClient(app)


def generate_test_ohlcv_data(num_candles: int = 250):
    """
    Generate test OHLCV data for testing.

    Args:
        num_candles: Number of candles to generate

    Returns:
        List of OHLCV dictionaries
    """
    data = []
    base_price = 2400.0
    base_volume = 1000000

    # Start from num_candles days ago
    start_date = datetime.now() - timedelta(days=num_candles)

    for i in range(num_candles):
        # Create uptrend with some noise
        trend = i * 0.5
        noise = (i % 10 - 5) * 2

        close = base_price + trend + noise
        open_price = close - 5
        high = close + 10
        low = open_price - 5

        # Increasing volume with noise
        volume = int(base_volume * (1 + i * 0.001) * (0.8 + (i % 5) * 0.1))

        # Create timestamp
        timestamp = (start_date + timedelta(days=i)).isoformat() + "Z"

        data.append(
            {
                "timestamp": timestamp,
                "open": round(open_price, 2),
                "high": round(high, 2),
                "low": round(low, 2),
                "close": round(close, 2),
                "volume": volume,
            }
        )

    return data


class TestSwingAnalyzeEndpoint:
    """Test suite for /quant/swing/analyze endpoint."""

    def test_analyze_with_valid_data(self):
        """Test swing analysis with valid 250-candle data."""
        # Arrange
        request_data = {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": generate_test_ohlcv_data(250),
        }

        # Act
        response = client.post("/quant/swing/analyze", json=request_data)

        # Assert
        assert response.status_code == 200
        result = response.json()

        # Verify structure
        assert result["symbol"] == "RELIANCE"
        assert result["timeframe"] == "1d"
        assert "indicators" in result
        assert "volume_analysis" in result
        assert "price_range_analysis" in result
        assert "support_resistance" in result
        assert "trendline_analysis" in result

        # Verify indicators
        indicators = result["indicators"]
        assert "rsi" in indicators
        assert "adx" in indicators
        assert "atr" in indicators
        assert "macd" in indicators
        assert "ema_20" in indicators
        assert "ema_50" in indicators
        assert "ema_200" in indicators
        assert "vwap" in indicators
        assert "bollinger_bands" in indicators

        # Verify RSI is in valid range
        assert 0 <= indicators["rsi"] <= 100

        # Verify ADX is in valid range
        assert 0 <= indicators["adx"] <= 100

        # Verify MACD structure
        assert "value" in indicators["macd"]
        assert "signal" in indicators["macd"]
        assert "histogram" in indicators["macd"]

        # Verify Bollinger Bands structure and ordering
        bb = indicators["bollinger_bands"]
        assert "upper" in bb
        assert "middle" in bb
        assert "lower" in bb
        assert bb["upper"] >= bb["middle"] >= bb["lower"]

        # Verify volume analysis
        volume = result["volume_analysis"]
        assert "volume_ma" in volume
        assert "relative_volume" in volume
        assert "volume_trend" in volume
        assert volume["relative_volume"] >= 0
        assert volume["volume_trend"] in [
            "INCREASING",
            "DECREASING",
            "STABLE",
            "UNKNOWN",
        ]

        # Verify price range analysis
        price_range = result["price_range_analysis"]
        assert "high_52w" in price_range
        assert "low_52w" in price_range
        assert "current_price" in price_range
        assert "distance_from_high_pct" in price_range
        assert "distance_from_low_pct" in price_range
        assert "momentum" in price_range
        assert price_range["high_52w"] >= price_range["low_52w"]

        # Verify support/resistance
        sr_levels = result["support_resistance"]
        assert isinstance(sr_levels, list)
        for level in sr_levels:
            assert "level" in level
            assert "strength" in level
            assert "touches" in level
            assert 0 <= level["strength"] <= 1.0
            assert level["touches"] >= 1

        # Verify trendline analysis
        trendline = result["trendline_analysis"]
        assert trendline is not None
        if "error" not in trendline:
            assert "support_trendline" in trendline
            assert "resistance_trendline" in trendline
            assert "breakout" in trendline
            assert "swing_points" in trendline

    def test_analyze_with_minimum_data(self):
        """Test swing analysis with exactly 200 candles (minimum)."""
        # Arrange
        request_data = {
            "symbol": "TCS",
            "timeframe": "1d",
            "data": generate_test_ohlcv_data(200),
        }

        # Act
        response = client.post("/quant/swing/analyze", json=request_data)

        # Assert
        assert response.status_code == 200
        result = response.json()
        assert result["symbol"] == "TCS"

    def test_analyze_with_insufficient_data(self):
        """Test swing analysis with insufficient data (< 200 candles)."""
        # Arrange
        request_data = {
            "symbol": "HDFC",
            "timeframe": "1d",
            "data": generate_test_ohlcv_data(100),  # Only 100 candles
        }

        # Act
        response = client.post("/quant/swing/analyze", json=request_data)

        # Assert
        assert response.status_code == 400
        error = response.json()
        assert "detail" in error
        assert "200 candles" in error["detail"].lower()

    def test_analyze_with_199_candles(self):
        """Test swing analysis with 199 candles (just below minimum)."""
        # Arrange
        request_data = {
            "symbol": "INFY",
            "timeframe": "1d",
            "data": generate_test_ohlcv_data(199),
        }

        # Act
        response = client.post("/quant/swing/analyze", json=request_data)

        # Assert
        assert response.status_code == 400
        error = response.json()
        assert "detail" in error
        assert "199" in error["detail"]

    def test_analyze_with_empty_data(self):
        """Test swing analysis with empty data array."""
        # Arrange
        request_data = {"symbol": "ITC", "timeframe": "1d", "data": []}

        # Act
        response = client.post("/quant/swing/analyze", json=request_data)

        # Assert
        # Empty data returns 422 (validation error) or 400 depending on validation layer
        assert response.status_code in [400, 422]

    def test_analyze_with_invalid_symbol(self):
        """Test swing analysis with invalid request (missing symbol)."""
        # Arrange
        request_data = {"timeframe": "1d", "data": generate_test_ohlcv_data(250)}

        # Act
        response = client.post("/quant/swing/analyze", json=request_data)

        # Assert
        assert response.status_code == 422  # Validation error

    def test_analyze_with_invalid_candle_data(self):
        """Test swing analysis with invalid candle data (missing required fields)."""
        # Arrange
        request_data = {
            "symbol": "WIPRO",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": "2024-01-01T00:00:00Z",
                    "close": 500.0,
                    # Missing open, high, low, volume
                }
            ]
            * 200,
        }

        # Act
        response = client.post("/quant/swing/analyze", json=request_data)

        # Assert
        assert response.status_code == 422  # Validation error

    def test_analyze_response_time(self):
        """Test that swing analysis completes in reasonable time."""
        # Arrange
        request_data = {
            "symbol": "SBIN",
            "timeframe": "1d",
            "data": generate_test_ohlcv_data(250),
        }

        # Act
        import time

        start = time.time()
        response = client.post("/quant/swing/analyze", json=request_data)
        duration = time.time() - start

        # Assert
        assert response.status_code == 200
        # Should complete in less than 5 seconds
        assert duration < 5.0, f"Analysis took {duration:.2f}s, expected < 5s"

    def test_analyze_with_large_dataset(self):
        """Test swing analysis with large dataset (500 candles)."""
        # Arrange
        request_data = {
            "symbol": "TATAMOTORS",
            "timeframe": "1d",
            "data": generate_test_ohlcv_data(500),
        }

        # Act
        response = client.post("/quant/swing/analyze", json=request_data)

        # Assert
        assert response.status_code == 200
        result = response.json()
        assert result["symbol"] == "TATAMOTORS"
        # More data should produce more swing points
        trendline = result["trendline_analysis"]
        if "swing_points" in trendline:
            assert len(trendline["swing_points"]) > 0

    def test_analyze_indicators_validity(self):
        """Test that all indicators are valid numbers."""
        # Arrange
        request_data = {
            "symbol": "MARUTI",
            "timeframe": "1d",
            "data": generate_test_ohlcv_data(250),
        }

        # Act
        response = client.post("/quant/swing/analyze", json=request_data)

        # Assert
        assert response.status_code == 200
        result = response.json()
        indicators = result["indicators"]

        # Check all indicator values are numbers (not NaN or None)
        assert isinstance(indicators["rsi"], (int, float))
        assert isinstance(indicators["adx"], (int, float))
        assert isinstance(indicators["atr"], (int, float))
        assert isinstance(indicators["vwap"], (int, float))
        assert isinstance(indicators["ema_20"], (int, float))
        assert isinstance(indicators["ema_50"], (int, float))
        assert isinstance(indicators["ema_200"], (int, float))

        # Check MACD values
        assert isinstance(indicators["macd"]["value"], (int, float))
        assert isinstance(indicators["macd"]["signal"], (int, float))
        assert isinstance(indicators["macd"]["histogram"], (int, float))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
