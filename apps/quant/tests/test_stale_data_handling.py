"""
Unit tests for stale data handling in intraday recommendation logic.

Tests that the system correctly handles stale data by:
1. Overriding BUY/SELL signals to HOLD when data is stale
2. Adding appropriate staleness message to rationale
3. Logging stale data events

Requirements: 6.5, 6.8
"""

import pytest
from datetime import datetime, timezone, timedelta
from models import OHLCVData
from models.intraday import (
    IntradayAnalysisRequest,
    IntradaySignal,
)


def create_sample_data(
    count: int = 100, base_price: float = 100.0, age_seconds: int = 0
):
    """Create sample OHLCV data for testing."""
    base_time = datetime.now(timezone.utc) - timedelta(seconds=age_seconds)
    data = []
    for i in range(count):
        timestamp = base_time - timedelta(minutes=(count - i) * 5)
        price = base_price + i * 0.1
        data.append(
            OHLCVData(
                timestamp=timestamp,
                open=price,
                high=price + 0.5,
                low=price - 0.5,
                close=price,
                volume=100000,
            )
        )
    return data


@pytest.mark.asyncio
async def test_stale_data_forces_hold_signal():
    """
    Test that stale data (> 5 minutes old) forces HOLD signal.

    This test verifies that even when technical conditions suggest BUY/SELL,
    the system returns HOLD if data is stale.

    Requirements: 6.5, 6.8
    """
    from main import app
    from fastapi.testclient import TestClient

    client = TestClient(app)

    # Create data that is 10 minutes old (stale)
    stale_data = create_sample_data(count=100, base_price=100.0, age_seconds=600)

    request_data = {
        "symbol": "RELIANCE",
        "interval": "5m",
        "data": [
            {
                "timestamp": d.timestamp.isoformat(),
                "open": d.open,
                "high": d.high,
                "low": d.low,
                "close": d.close,
                "volume": d.volume,
            }
            for d in stale_data
        ],
        "include_support_resistance": True,
        "include_opening_range": True,
        "include_prev_day_levels": True,
    }

    response = client.post("/quant/intraday/analyze", json=request_data)

    assert response.status_code == 200
    result = response.json()

    # Verify data is marked as stale
    assert result["data_freshness"]["is_stale"] is True
    assert result["data_freshness"]["age_seconds"] > 300  # > 5 minutes

    # Verify signal is forced to HOLD
    assert result["recommendation"]["signal"] == "HOLD"

    # Verify staleness message in rationale
    rationale = result["recommendation"]["rationale"]
    assert "stale" in rationale.lower()
    assert "waiting for fresh data" in rationale.lower()

    # Verify warnings include stale data warning
    assert result["recommendation"]["is_stale"] is True
    assert len(result["recommendation"]["warnings"]) > 0
    assert any("stale" in w.lower() for w in result["recommendation"]["warnings"])


@pytest.mark.asyncio
async def test_fresh_data_allows_normal_signals():
    """
    Test that fresh data (< 5 minutes old) allows normal BUY/SELL signals.

    Requirements: 6.5, 6.8
    """
    from main import app
    from fastapi.testclient import TestClient

    client = TestClient(app)

    # Create fresh data (only the last candle is 30 seconds old)
    # This ensures data freshness is calculated correctly
    base_time = datetime.now(timezone.utc)
    fresh_data = []
    for i in range(100):
        # Latest candle is only 30 seconds old
        timestamp = base_time - timedelta(seconds=30 + i * 5 * 60)  # 5-min candles
        price = 100.0 + i * 0.1
        fresh_data.append(
            OHLCVData(
                timestamp=timestamp,
                open=price,
                high=price + 0.5,
                low=price - 0.5,
                close=price,
                volume=100000,
            )
        )
    # Reverse so latest candle is at the end
    fresh_data = list(reversed(fresh_data))

    request_data = {
        "symbol": "RELIANCE",
        "interval": "5m",
        "data": [
            {
                "timestamp": d.timestamp.isoformat(),
                "open": d.open,
                "high": d.high,
                "low": d.low,
                "close": d.close,
                "volume": d.volume,
            }
            for d in fresh_data
        ],
        "include_support_resistance": True,
        "include_opening_range": True,
        "include_prev_day_levels": True,
    }

    response = client.post("/quant/intraday/analyze", json=request_data)

    assert response.status_code == 200
    result = response.json()

    # Verify data is marked as fresh
    assert result["data_freshness"]["is_stale"] is False
    assert result["data_freshness"]["age_seconds"] < 300  # < 5 minutes

    # Verify signal can be BUY, SELL, HOLD, or NO_TRADE (not forced)
    signal = result["recommendation"]["signal"]
    assert signal in ["BUY", "SELL", "HOLD", "NO_TRADE"]

    # Verify no staleness message in rationale if signal is BUY/SELL
    rationale = result["recommendation"]["rationale"]
    if signal in ["BUY", "SELL"]:
        assert "stale" not in rationale.lower()

    # Verify is_stale flag is False
    assert result["recommendation"]["is_stale"] is False

    # Verify no stale data warnings
    warnings = result["recommendation"]["warnings"]
    assert not any("stale" in w.lower() for w in warnings)


@pytest.mark.asyncio
async def test_stale_data_rationale_content():
    """
    Test that stale data rationale contains specific required information.

    Requirements: 6.5, 6.8
    """
    from main import app
    from fastapi.testclient import TestClient

    client = TestClient(app)

    # Create data that is 8 minutes old (stale)
    stale_data = create_sample_data(count=100, base_price=100.0, age_seconds=480)

    request_data = {
        "symbol": "RELIANCE",
        "interval": "5m",
        "data": [
            {
                "timestamp": d.timestamp.isoformat(),
                "open": d.open,
                "high": d.high,
                "low": d.low,
                "close": d.close,
                "volume": d.volume,
            }
            for d in stale_data
        ],
        "include_support_resistance": True,
        "include_opening_range": True,
        "include_prev_day_levels": True,
    }

    response = client.post("/quant/intraday/analyze", json=request_data)

    assert response.status_code == 200
    result = response.json()

    rationale = result["recommendation"]["rationale"]

    # Verify required messages per task 60.3
    assert "Data is stale" in rationale
    assert "Waiting for fresh data" in rationale

    # Verify it mentions how old the data is
    assert "seconds ago" in rationale or "Last update" in rationale

    # Verify threshold information is present
    assert "Threshold" in rationale or "threshold" in rationale


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
