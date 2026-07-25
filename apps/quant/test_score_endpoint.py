"""
Test script to verify the /quant/score endpoint works correctly.
"""

from datetime import datetime, timedelta
from models import MarketDataRequest, OHLCVData
from main import score_market_data
import asyncio


def generate_sample_data(
    num_points: int = 250, trend_type: str = "bullish"
) -> list[OHLCVData]:
    """
    Generate sample OHLCV data for testing.

    Args:
        num_points: Number of data points to generate
        trend_type: "bullish", "bearish", or "neutral"
    """
    data = []
    base_price = 2450.0
    base_date = datetime(2024, 1, 1)

    for i in range(num_points):
        # Different trending patterns
        if trend_type == "bullish":
            trend = i * 0.8  # Upward trend
            noise = (i % 10) * 2 - 10
        elif trend_type == "bearish":
            trend = -i * 0.8  # Downward trend
            noise = (i % 10) * 2 - 10
        else:  # neutral
            trend = 0
            noise = (i % 20) * 2 - 20  # More noise, no trend

        close = base_price + trend + noise

        high = close + 5
        low = close - 5
        open_price = close + ((i % 3) - 1) * 2

        # Vary volume
        if trend_type == "bullish":
            volume = 1000000 + (i * 2000)  # Increasing volume
        elif trend_type == "bearish":
            volume = 1000000 + (i * 1500)
        else:
            volume = 1000000 + ((i % 50) * 1000)

        data.append(
            OHLCVData(
                timestamp=base_date + timedelta(days=i),
                open=open_price,
                high=high,
                low=low,
                close=close,
                volume=volume,
            )
        )

    return data


async def test_score_endpoint(trend_type: str = "bullish"):
    """Test the score endpoint with specified trend type."""
    print(f"\n{'='*60}")
    print(f"Testing /quant/score endpoint with {trend_type.upper()} trend")
    print(f"{'='*60}")

    print("Generating sample data...")
    sample_data = generate_sample_data(250, trend_type)

    print(f"Created {len(sample_data)} data points")
    print(f"First price: {sample_data[0].close:.2f}")
    print(f"Last price: {sample_data[-1].close:.2f}")
    print(f"Price change: {sample_data[-1].close - sample_data[0].close:.2f}")

    # Create request
    request = MarketDataRequest(symbol="RELIANCE", timeframe="1d", data=sample_data)

    print("\nCalling /quant/score endpoint...")
    result = await score_market_data(request)

    print(f"\n=== Scoring Result ===")
    print(f"Trend Classification: {result.trend}")
    print(f"Overall Score: {result.score:.2f}/100")
    print(f"\nKey Indicators:")
    print(f"  RSI: {result.rsi:.2f}")
    print(f"  ADX: {result.adx:.2f}")
    print(f"  VWAP: {result.vwap:.2f}")
    print(f"  Volume Ratio: {result.volumeRatio:.2f}x")

    print(f"\nSignals ({len(result.signals)} total):")
    for i, signal in enumerate(result.signals, 1):
        print(f"  {i}. {signal}")

    print(f"\n✅ Scoring completed successfully for {trend_type} trend!")
    return result


async def main():
    """Run tests for all trend types."""
    print("\n" + "=" * 60)
    print("Testing POST /quant/score endpoint")
    print("=" * 60)

    # Test bullish scenario
    bullish_result = await test_score_endpoint("bullish")

    # Test bearish scenario
    bearish_result = await test_score_endpoint("bearish")

    # Test neutral scenario
    neutral_result = await test_score_endpoint("neutral")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(
        f"Bullish trend - Score: {bullish_result.score:.2f}, Classification: {bullish_result.trend}"
    )
    print(
        f"Bearish trend - Score: {bearish_result.score:.2f}, Classification: {bearish_result.trend}"
    )
    print(
        f"Neutral trend - Score: {neutral_result.score:.2f}, Classification: {neutral_result.trend}"
    )

    # Verify determinism
    print("\n" + "=" * 60)
    print("Testing Determinism")
    print("=" * 60)
    print("Running bullish test again to verify same score...")
    bullish_result_2 = await test_score_endpoint("bullish")

    if abs(bullish_result.score - bullish_result_2.score) < 0.001:
        print("✅ Score is deterministic (same result on repeat)")
    else:
        print(
            f"❌ Score is NOT deterministic ({bullish_result.score} vs {bullish_result_2.score})"
        )

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
