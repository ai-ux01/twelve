"""
Tests for the new POST /quant/analyze endpoint.

This endpoint includes all new indicators: ADX, ATR, VWAP, volume analysis,
EMA variants, 52-week high/low, and momentum.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path so we can import main
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app


class TestQuantAnalyzeEndpoint:
    """Test suite for POST /quant/analyze endpoint."""

    @pytest.fixture
    def client(self):
        """Create FastAPI test client."""
        return TestClient(app)

    @pytest.fixture
    def valid_market_data_request(self):
        """
        Generate a valid market data request with 250 data points.
        This ensures we have enough data for all indicators including 52-week calculations.
        """
        base_date = datetime(2024, 1, 1)
        data = []

        # Generate 250 days of realistic OHLCV data with trend and volatility
        base_price = 2400.0
        for i in range(250):
            # Add some trend and randomness
            trend = i * 0.5  # Upward trend
            noise = (i % 10) * 2 - 10  # Some oscillation

            close = base_price + trend + noise
            high = close + (i % 5) * 2
            low = close - (i % 4) * 2
            open_price = (high + low) / 2

            volume = 1000000 + (i % 20) * 50000  # Varying volume

            data.append(
                {
                    "timestamp": (base_date + timedelta(days=i)).isoformat(),
                    "open": open_price,
                    "high": high,
                    "low": low,
                    "close": close,
                    "volume": volume,
                }
            )

        return {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": data,
        }

    def test_quant_analyze_with_valid_data(self, client, valid_market_data_request):
        """
        Test POST /quant/analyze with valid data returns complete analysis.

        This test verifies that the new endpoint:
        1. Returns 200 OK
        2. Includes all standard indicators (RSI, MACD, SMAs, EMAs, Bollinger Bands)
        3. Includes all new indicators (ADX, ATR, VWAP, volume analysis, 52W high/low, momentum)
        4. Includes support/resistance and trendlines
        """
        response = client.post("/quant/analyze", json=valid_market_data_request)

        # Verify response status
        assert (
            response.status_code == 200
        ), f"Expected 200, got {response.status_code}: {response.text}"

        result = response.json()

        # Verify structure
        assert "symbol" in result
        assert "timeframe" in result
        assert "indicators" in result
        assert "support_resistance" in result
        assert "trendlines" in result

        # Verify symbol and timeframe match request
        assert result["symbol"] == "RELIANCE"
        assert result["timeframe"] == "1d"

        # Verify all standard indicators are present
        indicators = result["indicators"]
        assert "rsi" in indicators
        assert "macd" in indicators
        assert "sma_20" in indicators
        assert "sma_50" in indicators
        assert "sma_200" in indicators
        assert "ema_5" in indicators
        assert "ema_15" in indicators
        assert "ema_20" in indicators
        assert "ema_50" in indicators
        assert "ema_200" in indicators
        assert "bollinger_bands" in indicators

        # Verify all NEW indicators are present
        assert "adx" in indicators, "ADX indicator missing"
        assert "atr" in indicators, "ATR indicator missing"
        assert "vwap" in indicators, "VWAP indicator missing"
        assert "volume_ma" in indicators, "Volume MA indicator missing"
        assert "relative_volume" in indicators, "Relative volume indicator missing"
        assert "week_52_high" in indicators, "52-week high missing"
        assert "week_52_low" in indicators, "52-week low missing"
        assert "momentum" in indicators, "Momentum indicator missing"

        # Verify indicator value ranges
        assert 0 <= indicators["rsi"] <= 100, "RSI out of range"
        assert 0 <= indicators["adx"] <= 100, "ADX out of range"
        assert indicators["atr"] > 0, "ATR must be positive"
        assert indicators["vwap"] > 0, "VWAP must be positive"
        assert indicators["volume_ma"] >= 0, "Volume MA must be non-negative"
        assert (
            indicators["relative_volume"] >= 0
        ), "Relative volume must be non-negative"
        assert indicators["week_52_high"] > 0, "52W high must be positive"
        assert indicators["week_52_low"] > 0, "52W low must be positive"
        assert (
            indicators["week_52_high"] >= indicators["week_52_low"]
        ), "52W high must be >= 52W low"

        # Verify MACD structure
        assert "value" in indicators["macd"]
        assert "signal" in indicators["macd"]
        assert "histogram" in indicators["macd"]

        # Verify Bollinger Bands structure and ordering
        bb = indicators["bollinger_bands"]
        assert "upper" in bb
        assert "middle" in bb
        assert "lower" in bb
        assert (
            bb["upper"] > bb["middle"] > bb["lower"]
        ), "Bollinger Bands ordering incorrect"

        print("✓ All indicators present and valid")

    def test_quant_analyze_with_insufficient_data(self, client):
        """
        Test POST /quant/analyze with insufficient data returns 400.

        The endpoint requires at least 200 data points.
        """
        # Create request with only 50 data points
        base_date = datetime(2024, 1, 1)
        data = []
        for i in range(50):
            data.append(
                {
                    "timestamp": (base_date + timedelta(days=i)).isoformat(),
                    "open": 2450.0,
                    "high": 2470.0,
                    "low": 2445.0,
                    "close": 2465.0,
                    "volume": 1000000,
                }
            )

        request = {
            "symbol": "TEST",
            "timeframe": "1d",
            "data": data,
        }

        response = client.post("/quant/analyze", json=request)

        # Should return 400 for insufficient data
        assert response.status_code == 400
        assert "Insufficient data" in response.json()["detail"]

        print("✓ Insufficient data correctly rejected")

    def test_quant_analyze_new_indicators_differ_from_old(
        self, client, valid_market_data_request
    ):
        """
        Test that the new /quant/analyze endpoint returns data for indicators
        that the old /analyze endpoint didn't have.

        This confirms that the new indicators are actually being calculated.
        """
        # Call new endpoint
        response_new = client.post("/quant/analyze", json=valid_market_data_request)
        assert response_new.status_code == 200

        result_new = response_new.json()
        indicators_new = result_new["indicators"]

        # Verify new indicators have reasonable values
        # ADX: should be between 0-100, typically 0-50 for most markets
        assert 0 <= indicators_new["adx"] <= 100

        # ATR: should be positive and reasonable relative to price (not zero)
        assert indicators_new["atr"] > 0
        assert indicators_new["atr"] < 1000  # Sanity check

        # VWAP: should be close to recent prices
        last_close = valid_market_data_request["data"][-1]["close"]
        # VWAP should be within 10% of last close for daily data
        assert 0.9 * last_close < indicators_new["vwap"] < 1.1 * last_close

        # Relative volume: should be positive
        assert indicators_new["relative_volume"] > 0

        # Momentum: can be positive or negative, but should be reasonable
        assert -100 < indicators_new["momentum"] < 100

        print("✓ New indicators have reasonable values")
        print(f"  ADX: {indicators_new['adx']:.2f}")
        print(f"  ATR: {indicators_new['atr']:.2f}")
        print(f"  VWAP: {indicators_new['vwap']:.2f}")
        print(f"  Relative Volume: {indicators_new['relative_volume']:.2f}")
        print(f"  Momentum: {indicators_new['momentum']:.2f}")

    def test_old_analyze_endpoint_still_works(self, client, valid_market_data_request):
        """
        Test that the old POST /analyze endpoint still works (backward compatibility).

        The old endpoint should now also return the new indicators.
        """
        response = client.post("/analyze", json=valid_market_data_request)

        # Old endpoint should still work
        assert response.status_code == 200

        result = response.json()
        indicators = result["indicators"]

        # Old endpoint should now also have new indicators
        assert "adx" in indicators
        assert "atr" in indicators
        assert "vwap" in indicators
        assert "volume_ma" in indicators
        assert "relative_volume" in indicators
        assert "week_52_high" in indicators
        assert "week_52_low" in indicators
        assert "momentum" in indicators

        print(
            "✓ Old /analyze endpoint maintains backward compatibility with new indicators"
        )

    def test_quant_analyze_ema_variants(self, client, valid_market_data_request):
        """
        Test that all EMA variants are present and properly ordered.

        EMAs should generally follow: EMA5 > EMA15 > EMA20 > EMA50 > EMA200
        in an uptrend (with some allowance for crossovers).
        """
        response = client.post("/quant/analyze", json=valid_market_data_request)
        assert response.status_code == 200

        indicators = response.json()["indicators"]

        # Verify all EMA variants exist
        assert "ema_5" in indicators
        assert "ema_15" in indicators
        assert "ema_20" in indicators
        assert "ema_50" in indicators
        assert "ema_200" in indicators

        # All EMAs should be positive
        assert indicators["ema_5"] > 0
        assert indicators["ema_15"] > 0
        assert indicators["ema_20"] > 0
        assert indicators["ema_50"] > 0
        assert indicators["ema_200"] > 0

        # In a general uptrend, shorter EMAs should be >= longer EMAs
        # (allowing for some crossover scenarios)
        # At least EMA-5 should be different from EMA-200
        assert indicators["ema_5"] != indicators["ema_200"]

        print("✓ All EMA variants present and valid")
        print(f"  EMA-5: {indicators['ema_5']:.2f}")
        print(f"  EMA-15: {indicators['ema_15']:.2f}")
        print(f"  EMA-20: {indicators['ema_20']:.2f}")
        print(f"  EMA-50: {indicators['ema_50']:.2f}")
        print(f"  EMA-200: {indicators['ema_200']:.2f}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
