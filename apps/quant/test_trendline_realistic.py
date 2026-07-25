"""
Test script with more realistic price data that creates clear swing points.
"""

import json
from datetime import datetime, timedelta
import random


def create_realistic_uptrend_data(num_points=50):
    """Create realistic uptrend data with clear swing points."""
    base_timestamp = datetime(2024, 1, 1, 9, 0, 0)
    base_price = 2300.0

    data_points = []
    price = base_price

    for i in range(num_points):
        # Create an uptrend with realistic volatility
        # Alternate between higher highs and higher lows
        if i % 7 == 0:  # Create a pullback every 7 candles
            price_change = random.uniform(-15, -5)
        else:
            price_change = random.uniform(2, 8)

        price += price_change

        # Add intraday volatility
        high = price + random.uniform(5, 15)
        low = price - random.uniform(3, 10)
        open_price = price + random.uniform(-5, 5)
        close = price + random.uniform(-3, 3)

        # Ensure OHLC relationships
        high = max(high, open_price, close)
        low = min(low, open_price, close)

        data_points.append(
            {
                "timestamp": (base_timestamp + timedelta(days=i)).isoformat() + "Z",
                "open": round(open_price, 2),
                "high": round(high, 2),
                "low": round(low, 2),
                "close": round(close, 2),
                "volume": int(1000000 + random.uniform(-200000, 500000)),
            }
        )

    return data_points


# Create realistic test data
test_request = {
    "symbol": "RELIANCE",
    "timeframe": "1d",
    "data": create_realistic_uptrend_data(50),
}

# Save to file
with open("test_trendline_realistic.json", "w") as f:
    json.dump(test_request, f, indent=2)

print("✅ Realistic test data generated!")
print("\nTest the endpoint with:")
print('curl -X POST "http://localhost:8000/quant/trendline?lookback_period=3" \\')
print('  -H "Content-Type: application/json" \\')
print("  -d @test_trendline_realistic.json | python3 -m json.tool")
