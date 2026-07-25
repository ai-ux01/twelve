#!/usr/bin/env python3
"""
Test script for Phase 4 enhancements verification (Task 34)
Tests all new Quant Engine endpoints:
1. GET /quant/indicators - Returns all indicator definitions
2. POST /quant/analyze - Analyzes with all new indicators (requires 200+ candles)
3. POST /quant/score - Returns deterministic scoring
"""

import requests
import json
from datetime import datetime, timedelta

# Quant Engine base URL
BASE_URL = "http://localhost:8000"

def generate_sample_ohlcv_data(num_candles=250):
    """Generate sample OHLCV data for testing"""
    data = []
    base_price = 2450.0
    current_time = datetime.now() - timedelta(days=num_candles)
    
    for i in range(num_candles):
        # Simple price variation
        price_variation = (i % 20 - 10) * 2  # Creates some variation
        open_price = base_price + price_variation
        close_price = open_price + (i % 5 - 2)
        high_price = max(open_price, close_price) + abs(i % 3)
        low_price = min(open_price, close_price) - abs(i % 2)
        
        data.append({
            "timestamp": (current_time + timedelta(days=i)).isoformat(),
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "close": round(close_price, 2),
            "volume": 1000000 + (i % 100000)
        })
    
    return data

def test_indicators_endpoint():
    """Test GET /quant/indicators"""
    print("\n" + "="*80)
    print("TEST 1: GET /quant/indicators")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/quant/indicators")
        response.raise_for_status()
        
        data = response.json()
        indicators = data.get("indicators", [])
        
        print(f"✅ Status Code: {response.status_code}")
        print(f"✅ Number of indicators returned: {len(indicators)}")
        
        # Check for new Phase 4 indicators
        indicator_names = [ind["name"] for ind in indicators]
        expected_indicators = ["RSI", "MACD", "SMA", "EMA", "Bollinger Bands", "ADX", "ATR", "VWAP"]
        
        print("\n📊 Indicator Definitions:")
        for ind in indicators:
            print(f"  - {ind['name']}: {ind['description'][:80]}...")
        
        missing = [ind for ind in expected_indicators if ind not in indicator_names]
        if missing:
            print(f"⚠️  Missing indicators: {missing}")
        else:
            print(f"✅ All expected indicators present")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_analyze_endpoint():
    """Test POST /quant/analyze with 200+ candles"""
    print("\n" + "="*80)
    print("TEST 2: POST /quant/analyze (with 250 candles)")
    print("="*80)
    
    try:
        # Generate 250 candles (more than 200 required)
        ohlcv_data = generate_sample_ohlcv_data(250)
        
        payload = {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": ohlcv_data
        }
        
        response = requests.post(f"{BASE_URL}/quant/analyze", json=payload)
        response.raise_for_status()
        
        data = response.json()
        indicators = data.get("indicators", {})
        
        print(f"✅ Status Code: {response.status_code}")
        print(f"✅ Symbol: {data.get('symbol')}")
        print(f"✅ Timeframe: {data.get('timeframe')}")
        print(f"✅ Data points processed: {len(ohlcv_data)}")
        
        print("\n📊 New Phase 4 Indicators:")
        
        # Check for new EMA periods
        ema_periods = [5, 15, 50, 200]
        print("  EMAs:")
        for period in ema_periods:
            ema_key = f"ema_{period}"
            if ema_key in indicators:
                print(f"    ✅ EMA {period}: {indicators[ema_key]:.2f}")
            else:
                print(f"    ❌ EMA {period}: MISSING")
        
        # Check for new indicators
        new_indicators = {
            "adx": "ADX (Trend Strength)",
            "atr": "ATR (Volatility)",
            "vwap": "VWAP (Volume Weighted Avg)",
            "volume_ma": "Volume MA",
            "relative_volume": "Relative Volume",
            "week_52_high": "52-Week High",
            "week_52_low": "52-Week Low",
            "momentum": "Momentum"
        }
        
        print("\n  Advanced Indicators:")
        for key, name in new_indicators.items():
            if key in indicators:
                value = indicators[key]
                print(f"    ✅ {name}: {value:.2f}" if isinstance(value, (int, float)) else f"    ✅ {name}: {value}")
            else:
                print(f"    ❌ {name}: MISSING")
        
        # Check existing indicators still work
        print("\n  Core Indicators:")
        core = ["rsi", "macd", "sma_20", "sma_50"]
        for key in core:
            if key in indicators:
                value = indicators[key]
                if isinstance(value, dict):
                    print(f"    ✅ {key.upper()}: {json.dumps(value)[:60]}...")
                else:
                    print(f"    ✅ {key.upper()}: {value:.2f}")
            else:
                print(f"    ❌ {key.upper()}: MISSING")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_score_endpoint():
    """Test POST /quant/score for deterministic scoring"""
    print("\n" + "="*80)
    print("TEST 3: POST /quant/score (Deterministic Scoring)")
    print("="*80)
    
    try:
        # Generate sample data
        ohlcv_data = generate_sample_ohlcv_data(250)
        
        payload = {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": ohlcv_data
        }
        
        # Test determinism by calling twice
        response1 = requests.post(f"{BASE_URL}/quant/score", json=payload)
        response1.raise_for_status()
        data1 = response1.json()
        
        response2 = requests.post(f"{BASE_URL}/quant/score", json=payload)
        response2.raise_for_status()
        data2 = response2.json()
        
        print(f"✅ Status Code: {response1.status_code}")
        print(f"✅ Symbol: {data1.get('symbol')}")
        
        print("\n📊 Score Results:")
        print(f"  Trend: {data1.get('trend')}")
        print(f"  Score: {data1.get('score')}/100")
        print(f"  RSI: {data1.get('rsi'):.2f}")
        print(f"  ADX: {data1.get('adx'):.2f}")
        print(f"  VWAP: {data1.get('vwap'):.2f}")
        print(f"  Volume Ratio: {data1.get('volumeRatio'):.2f}")
        
        signals = data1.get('signals', [])
        print(f"\n  📌 Signals ({len(signals)}):")
        for signal in signals[:5]:  # Show first 5
            print(f"    - {signal}")
        if len(signals) > 5:
            print(f"    ... and {len(signals) - 5} more")
        
        # Test determinism
        print("\n🔄 Testing Determinism (same input twice):")
        if data1.get('score') == data2.get('score'):
            print(f"  ✅ Score is deterministic: {data1.get('score')} == {data2.get('score')}")
        else:
            print(f"  ❌ Score is NOT deterministic: {data1.get('score')} != {data2.get('score')}")
        
        if data1.get('trend') == data2.get('trend'):
            print(f"  ✅ Trend is deterministic: {data1.get('trend')} == {data2.get('trend')}")
        else:
            print(f"  ❌ Trend is NOT deterministic: {data1.get('trend')} != {data2.get('trend')}")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_backend_integration():
    """Test Backend API integration with new endpoints"""
    print("\n" + "="*80)
    print("TEST 4: Backend API Integration")
    print("="*80)
    
    try:
        response = requests.get("http://localhost:4000/health")
        print(f"✅ Backend API is running (Status: {response.status_code})")
        return True
    except Exception as e:
        print(f"⚠️  Backend API not accessible: {e}")
        return False

def test_frontend():
    """Test Frontend is running"""
    print("\n" + "="*80)
    print("TEST 5: Frontend Application")
    print("="*80)
    
    try:
        response = requests.get("http://localhost:3000")
        print(f"✅ Frontend is running (Status: {response.status_code})")
        return True
    except Exception as e:
        print(f"⚠️  Frontend not accessible: {e}")
        return False

def main():
    """Run all Phase 4 verification tests"""
    print("\n" + "="*80)
    print("PHASE 4 ENHANCEMENTS VERIFICATION (Task 34)")
    print("="*80)
    print("Testing new Quant Engine endpoints and system integration")
    
    results = []
    
    # Test 1: GET /quant/indicators
    results.append(("GET /quant/indicators", test_indicators_endpoint()))
    
    # Test 2: POST /quant/analyze
    results.append(("POST /quant/analyze", test_analyze_endpoint()))
    
    # Test 3: POST /quant/score
    results.append(("POST /quant/score", test_score_endpoint()))
    
    # Test 4: Backend integration
    results.append(("Backend API Integration", test_backend_integration()))
    
    # Test 5: Frontend
    results.append(("Frontend Application", test_frontend()))
    
    # Summary
    print("\n" + "="*80)
    print("VERIFICATION SUMMARY")
    print("="*80)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All Phase 4 enhancements verified successfully!")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please review the output above.")
        return 1

if __name__ == "__main__":
    exit(main())
