"""
Test script for POST /quant/swing/analyze endpoint.

This script tests the swing analyze endpoint with sample OHLCV data
to verify comprehensive technical analysis for swing trading.
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def generate_sample_ohlcv_data(symbol: str = "RELIANCE", num_candles: int = 250):
    """
    Generate sample OHLCV data for testing.

    Creates realistic price data with:
    - Upward trend
    - Some volatility
    - Increasing volume

    Args:
        symbol: Trading symbol
        num_candles: Number of candles to generate (default: 250)

    Returns:
        Dictionary with symbol, timeframe, and OHLCV data
    """
    data = []
    base_price = 2400.0
    base_volume = 1000000

    # Start from 250 days ago
    start_date = datetime.now() - timedelta(days=num_candles)

    for i in range(num_candles):
        # Create uptrend with some noise
        trend = i * 0.5  # Upward trend
        noise = (i % 10 - 5) * 2  # Random-ish noise

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

    return {"symbol": symbol, "timeframe": "1d", "data": data}


def test_swing_analyze():
    """Test POST /quant/swing/analyze endpoint."""

    print("=" * 80)
    print("Testing POST /quant/swing/analyze endpoint")
    print("=" * 80)

    # Generate sample data
    print("\n1. Generating sample OHLCV data (250 candles)...")
    request_data = generate_sample_ohlcv_data("RELIANCE", 250)
    print(f"   Symbol: {request_data['symbol']}")
    print(f"   Timeframe: {request_data['timeframe']}")
    print(f"   Candles: {len(request_data['data'])}")
    print(f"   First candle: {request_data['data'][0]['timestamp']}")
    print(f"   Last candle: {request_data['data'][-1]['timestamp']}")
    print(
        f"   Price range: {request_data['data'][0]['close']:.2f} -> {request_data['data'][-1]['close']:.2f}"
    )

    # Make request
    print("\n2. Sending request to /quant/swing/analyze...")
    url = f"{BASE_URL}/quant/swing/analyze"

    try:
        response = requests.post(url, json=request_data, timeout=30)

        print(f"   Status code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()

            print("\n3. Analysis result received:")
            print(f"   Symbol: {result['symbol']}")
            print(f"   Timeframe: {result['timeframe']}")

            # Display indicators
            print("\n   Technical Indicators:")
            indicators = result["indicators"]
            print(f"   - RSI: {indicators['rsi']:.2f}")
            print(f"   - ADX: {indicators['adx']:.2f}")
            print(f"   - ATR: {indicators['atr']:.2f}")
            print(
                f"   - MACD: {indicators['macd']['value']:.2f} (signal: {indicators['macd']['signal']:.2f})"
            )
            print(f"   - EMA 20: {indicators['ema_20']:.2f}")
            print(f"   - EMA 50: {indicators['ema_50']:.2f}")
            print(f"   - EMA 200: {indicators['ema_200']:.2f}")
            print(f"   - VWAP: {indicators['vwap']:.2f}")
            print(
                f"   - Bollinger Bands: Upper={indicators['bollinger_bands']['upper']:.2f}, "
                f"Middle={indicators['bollinger_bands']['middle']:.2f}, "
                f"Lower={indicators['bollinger_bands']['lower']:.2f}"
            )

            # Display volume analysis
            print("\n   Volume Analysis:")
            volume = result["volume_analysis"]
            print(f"   - Volume MA: {volume['volume_ma']:.0f}")
            print(f"   - Relative Volume: {volume['relative_volume']:.2f}")
            print(f"   - Volume Trend: {volume['volume_trend']}")

            # Display price range analysis
            print("\n   Price Range Analysis:")
            price_range = result["price_range_analysis"]
            print(f"   - 52W High: {price_range['high_52w']:.2f}")
            print(f"   - 52W Low: {price_range['low_52w']:.2f}")
            print(f"   - Current: {price_range['current_price']:.2f}")
            print(
                f"   - Distance from High: {price_range['distance_from_high_pct']:.2f}%"
            )
            print(
                f"   - Distance from Low: {price_range['distance_from_low_pct']:.2f}%"
            )
            print(f"   - Momentum: {price_range['momentum']:.2f}")

            # Display support/resistance
            print("\n   Support/Resistance Levels:")
            sr_levels = result["support_resistance"]
            if sr_levels:
                for i, level in enumerate(sr_levels[:5], 1):  # Show top 5
                    print(
                        f"   {i}. Level: {level['level']:.2f}, "
                        f"Strength: {level['strength']:.2f}, "
                        f"Touches: {level['touches']}"
                    )
            else:
                print("   No support/resistance levels detected")

            # Display trendline analysis
            print("\n   Trendline Analysis:")
            trendline = result.get("trendline_analysis")
            if trendline:
                if "error" in trendline:
                    print(f"   Error: {trendline['error']}")
                else:
                    # Support trendline
                    support = trendline.get("support_trendline")
                    if support:
                        print(
                            f"   - Support Trendline: slope={support['slope']:.4f}, "
                            f"R²={support['r_squared']:.3f}"
                        )
                    else:
                        print("   - Support Trendline: Not detected")

                    # Resistance trendline
                    resistance = trendline.get("resistance_trendline")
                    if resistance:
                        print(
                            f"   - Resistance Trendline: slope={resistance['slope']:.4f}, "
                            f"R²={resistance['r_squared']:.3f}"
                        )
                    else:
                        print("   - Resistance Trendline: Not detected")

                    # Breakout
                    breakout = trendline.get("breakout", {})
                    print(
                        f"   - Breakout Type: {breakout.get('breakout_type', 'NONE')}"
                    )
                    print(f"   - Confirmed: {breakout.get('confirmed', False)}")
                    if breakout.get("volume_ratio"):
                        print(f"   - Volume Ratio: {breakout['volume_ratio']:.2f}")

                    # Swing points
                    swing_points = trendline.get("swing_points", [])
                    print(f"   - Swing Points: {len(swing_points)} detected")
            else:
                print("   Trendline analysis not included")

            print("\n✓ Swing analyze endpoint test PASSED")
            return True

        else:
            print(f"\n✗ Request failed with status {response.status_code}")
            print(f"   Error: {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print("\n✗ Connection failed. Is the quant engine running on port 8000?")
        print("   Start it with: cd apps/quant && python main.py")
        return False
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_insufficient_data():
    """Test endpoint with insufficient data (< 200 candles)."""

    print("\n" + "=" * 80)
    print("Testing with insufficient data (should fail)")
    print("=" * 80)

    # Generate only 100 candles
    print("\n1. Generating insufficient data (100 candles)...")
    request_data = generate_sample_ohlcv_data("RELIANCE", 100)
    print(f"   Candles: {len(request_data['data'])}")

    # Make request
    print("\n2. Sending request (expecting 400 error)...")
    url = f"{BASE_URL}/quant/swing/analyze"

    try:
        response = requests.post(url, json=request_data, timeout=30)

        print(f"   Status code: {response.status_code}")

        if response.status_code == 400:
            error = response.json()
            print(f"   Error message: {error.get('detail', 'Unknown error')}")
            print("\n✓ Insufficient data validation PASSED")
            return True
        else:
            print(f"\n✗ Expected 400 error, got {response.status_code}")
            return False

    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        return False


if __name__ == "__main__":
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "Swing Analyze Endpoint Test" + " " * 31 + "║")
    print("╚" + "=" * 78 + "╝")

    # Run tests
    test1_passed = test_swing_analyze()
    test2_passed = test_insufficient_data()

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Test 1 (Valid analysis): {'PASSED' if test1_passed else 'FAILED'}")
    print(f"Test 2 (Insufficient data): {'PASSED' if test2_passed else 'FAILED'}")

    if test1_passed and test2_passed:
        print("\n✓ All tests PASSED")
    else:
        print("\n✗ Some tests FAILED")
    print("=" * 80)
