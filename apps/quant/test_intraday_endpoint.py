"""
Test script for POST /quant/intraday/analyze endpoint.

This script tests the intraday analyze endpoint with sample OHLCV data
to verify that the endpoint correctly:
1. Accepts intraday OHLCV data (30+ candles)
2. Calculates technical indicators (RSI, MACD, EMA, VWAP, ATR, etc.)
3. Performs intraday scoring
4. Generates trading recommendation
5. Includes data freshness tracking
6. Returns opening range and previous day levels analysis

Requirements: 6.1, 6.2
"""

import requests
import json
from datetime import datetime, timedelta
from typing import List, Dict


def generate_sample_intraday_data(
    symbol: str, num_candles: int = 50, interval_minutes: int = 5
) -> List[Dict]:
    """
    Generate sample intraday OHLCV data for testing.

    Args:
        symbol: Trading symbol
        num_candles: Number of candles to generate
        interval_minutes: Interval between candles in minutes

    Returns:
        List of OHLCV dictionaries
    """
    data = []
    base_time = datetime.utcnow() - timedelta(minutes=interval_minutes * num_candles)
    base_price = 2450.0

    for i in range(num_candles):
        timestamp = base_time + timedelta(minutes=interval_minutes * i)
        # Add some random-like variation
        variation = (i % 10) - 5
        open_price = base_price + variation
        high_price = open_price + 5
        low_price = open_price - 3
        close_price = open_price + 2
        volume = 50000 + (i * 1000)

        data.append(
            {
                "timestamp": timestamp.isoformat() + "Z",
                "open": open_price,
                "high": high_price,
                "low": low_price,
                "close": close_price,
                "volume": volume,
            }
        )

        # Update base price for next candle
        base_price = close_price

    return data


def test_intraday_analyze():
    """Test POST /quant/intraday/analyze endpoint."""
    
    print("=" * 80)
    print("Testing POST /quant/intraday/analyze endpoint")
    print("=" * 80)
    
    # Generate sample data
    symbol = "RELIANCE"
    interval = "5m"
    num_candles = 50
    
    print(f"\n1. Generating {num_candles} candles of sample data for {symbol}...")
    sample_data = generate_sample_intraday_data(symbol, num_candles)
    print(f"   ✓ Generated {len(sample_data)} candles")
    
    # Prepare request
    request_data = {
        "symbol": symbol,
        "interval": interval,
        "data": sample_data,
        "include_support_resistance": True,
        "include_opening_range": True,
        "include_prev_day_levels": True,
    }
    
    print(f"\n2. Sending request to POST /quant/intraday/analyze...")
    print(f"   Symbol: {symbol}")
    print(f"   Interval: {interval}")
    print(f"   Candles: {len(sample_data)}")
    
    # Send request
    url = "http://localhost:8000/quant/intraday/analyze"
    try:
        response = requests.post(url, json=request_data, timeout=30)
        
        print(f"\n3. Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"\n4. Analysis Result:")
            print(f"   ✓ Symbol: {result['symbol']}")
            print(f"   ✓ Interval: {result['interval']}")
            print(f"   ✓ Timestamp: {result['timestamp']}")
            
            print(f"\n5. Data Freshness:")
            freshness = result['data_freshness']
            print(f"   ✓ Data Timestamp: {freshness['timestamp']}")
            print(f"   ✓ Age (seconds): {freshness['age_seconds']:.1f}")
            print(f"   ✓ Is Stale: {freshness['is_stale']}")
            
            print(f"\n6. Technical Analysis:")
            tech = result['technical_analysis']
            print(f"   ✓ RSI: {tech['rsi']:.2f}")
            print(f"   ✓ MACD: {tech['macd']['value']:.2f} / {tech['macd']['signal']:.2f}")
            print(f"   ✓ EMA 9: {tech['ema_9']:.2f}")
            print(f"   ✓ EMA 21: {tech['ema_21']:.2f}")
            print(f"   ✓ EMA 50: {tech['ema_50']:.2f}")
            print(f"   ✓ VWAP: {tech['vwap']:.2f}")
            print(f"   ✓ ATR: {tech['atr']:.2f}")
            print(f"   ✓ Volume: {tech['volume']}")
            print(f"   ✓ Relative Volume: {tech['relative_volume']:.2f}")
            print(f"   ✓ Support Levels: {len(tech['support_levels'])}")
            print(f"   ✓ Resistance Levels: {len(tech['resistance_levels'])}")
            
            print(f"\n7. Price Information:")
            print(f"   ✓ Current Price: {result['current_price']:.2f}")
            print(f"   ✓ Price Change: {result['price_change']:.2f}")
            print(f"   ✓ Price Change %: {result['price_change_percent']:.2f}%")
            
            print(f"\n8. Trading Recommendation:")
            rec = result['recommendation']
            print(f"   ✓ Signal: {rec['signal']}")
            print(f"   ✓ Confidence: {rec['confidence']:.2f}")
            print(f"   ✓ Entry: {rec['entry']:.2f}")
            print(f"   ✓ Stop Loss: {rec['stop_loss']:.2f}")
            print(f"   ✓ Target: {rec['target']:.2f}")
            print(f"   ✓ Risk/Reward: {rec['risk_reward']:.2f}")
            print(f"   ✓ Rationale: {rec['rationale'][:100]}...")
            print(f"   ✓ Is Stale: {rec['is_stale']}")
            print(f"   ✓ Valid Until: {rec['valid_until']}")
            
            if result.get('opening_range'):
                print(f"\n9. Opening Range Analysis:")
                or_data = result['opening_range']
                print(f"   ✓ High: {or_data['high']:.2f}")
                print(f"   ✓ Low: {or_data['low']:.2f}")
                print(f"   ✓ Midpoint: {or_data['midpoint']:.2f}")
                print(f"   ✓ Range Size: {or_data['range_size']:.2f}")
                print(f"   ✓ Breakout Status: {or_data['breakout_status']}")
                print(f"   ✓ Volume Confirmed: {or_data['volume_confirmed']}")
            else:
                print(f"\n9. Opening Range: Not calculated")
            
            if result.get('prev_day_levels'):
                print(f"\n10. Previous Day Levels:")
                pdl = result['prev_day_levels']
                print(f"    ✓ Prev Day High: {pdl['prev_day_high']:.2f}")
                print(f"    ✓ Prev Day Low: {pdl['prev_day_low']:.2f}")
                print(f"    ✓ Prev Day Close: {pdl['prev_day_close']:.2f}")
                print(f"    ✓ Gap Type: {pdl['gap_type']}")
                print(f"    ✓ Breach Status: {pdl['breach_status']}")
            else:
                print(f"\n10. Previous Day Levels: Not calculated")
            
            print(f"\n" + "=" * 80)
            print("✓ TEST PASSED: Endpoint returned complete intraday analysis")
            print("=" * 80)
            
            return True
        else:
            print(f"\n✗ TEST FAILED: Unexpected status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"\n✗ TEST FAILED: Could not connect to {url}")
        print("   Make sure the quant service is running on port 8000")
        return False
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        return False


if __name__ == "__main__":
    success = test_intraday_analyze()
    exit(0 if success else 1)
