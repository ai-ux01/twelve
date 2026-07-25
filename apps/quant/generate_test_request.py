"""Generate a test request JSON file with sufficient data."""

import json
from datetime import datetime, timedelta


def generate_test_request(num_points=250):
    """Generate sample OHLCV data for testing."""
    data = []
    base_price = 2450.0
    base_date = datetime(2024, 1, 1)

    for i in range(num_points):
        # Simple trending price simulation
        trend = i * 0.5  # Slight upward trend
        noise = (i % 10) * 2 - 10  # Some variation
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

    request = {"symbol": "RELIANCE", "timeframe": "1d", "data": data}

    with open("test_request.json", "w") as f:
        json.dump(request, f, indent=2)

    print(f"Generated test request with {len(data)} data points")
    print(f"Saved to test_request.json")


if __name__ == "__main__":
    generate_test_request(250)
