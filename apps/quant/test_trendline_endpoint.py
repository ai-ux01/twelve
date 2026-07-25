"""
Test script for the new POST /quant/trendline endpoint.
"""

import json
from datetime import datetime, timedelta


def create_sample_data(num_points=30, trend="up"):
    """Create sample OHLCV data for testing."""
    base_timestamp = datetime(2024, 1, 1, 9, 0, 0)
    base_price = 2400.0

    data_points = []
    for i in range(num_points):
        if trend == "up":
            price = base_price + i * 2 + (i % 5) * 3
        elif trend == "down":
            price = base_price - i * 2 + (i % 5) * 3
        else:  # sideways
            price = base_price + (10 * (i % 3 - 1))

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

    return data_points


# Test with uptrend data
uptrend_request = {
    "symbol": "RELIANCE",
    "timeframe": "1d",
    "data": create_sample_data(30, "up"),
}

# Save to file for curl testing
with open("test_trendline_request.json", "w") as f:
    json.dump(uptrend_request, f, indent=2)

print("✅ Test data generated successfully!")
print("\nYou can test the endpoint with:")
print('curl -X POST "http://localhost:8000/quant/trendline?lookback_period=3" \\')
print('  -H "Content-Type: application/json" \\')
print("  -d @test_trendline_request.json")
