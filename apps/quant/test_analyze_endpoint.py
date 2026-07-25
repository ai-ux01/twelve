"""
Test script to verify the /analyze endpoint works correctly.
"""

from datetime import datetime, timedelta
from models import MarketDataRequest, OHLCVData
from main import analyze_market_data
import asyncio


def generate_sample_data(num_points: int = 250) -> list[OHLCVData]:
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
            OHLCVData(
                timestamp=base_date + timedelta(days=i),
                open=open_price,
                high=high,
                low=low,
                close=close,
                volume=1000000 + (i * 1000),
            )
        )

    return data


async def test_analyze():
    """Test the analyze endpoint."""
    print("Generating sample data...")
    sample_data = generate_sample_data(250)

    print(f"Created {len(sample_data)} data points")
    print(f"First price: {sample_data[0].close:.2f}")
    print(f"Last price: {sample_data[-1].close:.2f}")

    # Create request
    request = MarketDataRequest(symbol="RELIANCE", timeframe="1d", data=sample_data)

    print("\nCalling analyze endpoint...")
    result = await analyze_market_data(request)

    print(f"\n=== Analysis Result for {result.symbol} ({result.timeframe}) ===")
    print(f"\nIndicators:")
    print(f"  RSI: {result.indicators.rsi:.2f}")
    print(f"  MACD: {result.indicators.macd.value:.2f}")
    print(f"  MACD Signal: {result.indicators.macd.signal:.2f}")
    print(f"  MACD Histogram: {result.indicators.macd.histogram:.2f}")
    print(f"  SMA 20: {result.indicators.sma_20:.2f}")
    print(f"  SMA 50: {result.indicators.sma_50:.2f}")
    print(f"  SMA 200: {result.indicators.sma_200:.2f}")
    print(f"  EMA 20: {result.indicators.ema_20:.2f}")
    print(f"  Bollinger Upper: {result.indicators.bollinger_bands.upper:.2f}")
    print(f"  Bollinger Middle: {result.indicators.bollinger_bands.middle:.2f}")
    print(f"  Bollinger Lower: {result.indicators.bollinger_bands.lower:.2f}")

    print(f"\nSupport/Resistance Levels: {len(result.support_resistance)} found")
    for i, level in enumerate(result.support_resistance[:5]):  # Show top 5
        print(
            f"  Level {i+1}: {level.level:.2f} (strength: {level.strength:.2f}, touches: {level.touches})"
        )

    print(f"\nTrendlines: {len(result.trendlines)} found")
    for i, trendline in enumerate(result.trendlines):
        print(
            f"  Trendline {i+1}: slope={trendline.slope:.4f}, R²={trendline.r_squared:.4f}"
        )

    print("\n✅ Analysis completed successfully!")


if __name__ == "__main__":
    asyncio.run(test_analyze())
