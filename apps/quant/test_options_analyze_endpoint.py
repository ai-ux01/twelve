"""
Test script for POST /quant/options/analyze endpoint.

This script tests the options chain analysis endpoint with sample NIFTY options data.
"""

import requests
import json
from datetime import datetime

# Quant Engine URL
BASE_URL = "http://localhost:8000"


def test_options_analyze():
    """Test the POST /quant/options/analyze endpoint with sample data."""
    
    print("=" * 80)
    print("Testing POST /quant/options/analyze endpoint")
    print("=" * 80)
    
    # Sample options chain data for NIFTY at spot price 21500
    request_data = {
        "symbol": "NIFTY",
        "spot_price": 21500.0,
        "contracts": [
            # ATM and nearby calls
            {
                "strike_price": 21400.0,
                "option_type": "CALL",
                "ltp": 150.5,
                "open_interest": 15000,
                "change_in_oi": 2500,
                "volume": 5000,
            },
            {
                "strike_price": 21500.0,
                "option_type": "CALL",
                "ltp": 95.3,
                "open_interest": 25000,
                "change_in_oi": 3000,
                "volume": 8000,
            },
            {
                "strike_price": 21600.0,
                "option_type": "CALL",
                "ltp": 55.2,
                "open_interest": 18000,
                "change_in_oi": 1500,
                "volume": 4500,
            },
            {
                "strike_price": 21700.0,
                "option_type": "CALL",
                "ltp": 28.4,
                "open_interest": 12000,
                "change_in_oi": -500,
                "volume": 3000,
            },
            # ATM and nearby puts
            {
                "strike_price": 21400.0,
                "option_type": "PUT",
                "ltp": 45.3,
                "open_interest": 12000,
                "change_in_oi": -1000,
                "volume": 3000,
            },
            {
                "strike_price": 21500.0,
                "option_type": "PUT",
                "ltp": 85.7,
                "open_interest": 22000,
                "change_in_oi": 2000,
                "volume": 7000,
            },
            {
                "strike_price": 21600.0,
                "option_type": "PUT",
                "ltp": 140.2,
                "open_interest": 16000,
                "change_in_oi": 1200,
                "volume": 5500,
            },
            {
                "strike_price": 21700.0,
                "option_type": "PUT",
                "ltp": 210.5,
                "open_interest": 10000,
                "change_in_oi": -800,
                "volume": 2500,
            },
            # More OTM strikes for better analysis
            {
                "strike_price": 21300.0,
                "option_type": "CALL",
                "ltp": 220.8,
                "open_interest": 8000,
                "change_in_oi": 1000,
                "volume": 2000,
            },
            {
                "strike_price": 21300.0,
                "option_type": "PUT",
                "ltp": 25.1,
                "open_interest": 14000,
                "change_in_oi": -1500,
                "volume": 3500,
            },
            {
                "strike_price": 21800.0,
                "option_type": "CALL",
                "ltp": 15.2,
                "open_interest": 9000,
                "change_in_oi": 500,
                "volume": 2200,
            },
            {
                "strike_price": 21800.0,
                "option_type": "PUT",
                "ltp": 295.3,
                "open_interest": 7000,
                "change_in_oi": -600,
                "volume": 1800,
            },
        ]
    }
    
    print("\nRequest Data:")
    print(f"Symbol: {request_data['symbol']}")
    print(f"Spot Price: {request_data['spot_price']}")
    print(f"Number of Contracts: {len(request_data['contracts'])}")
    
    # Send request
    print("\nSending request to /quant/options/analyze...")
    try:
        response = requests.post(
            f"{BASE_URL}/quant/options/analyze",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        
        print(f"\nResponse Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print("\n" + "=" * 80)
            print("OPTIONS CHAIN ANALYSIS RESULT")
            print("=" * 80)
            
            # PCR Analysis
            print("\n📊 PCR ANALYSIS:")
            pcr = result["pcr_analysis"]
            print(f"  PCR by OI: {pcr['pcr_by_oi']:.4f}")
            print(f"  PCR by Volume: {pcr['pcr_by_volume']:.4f}")
            print(f"  Sentiment: {pcr['sentiment']}")
            print(f"  Total Call OI: {pcr['total_call_oi']:,}")
            print(f"  Total Put OI: {pcr['total_put_oi']:,}")
            print(f"  Total Call Volume: {pcr['total_call_volume']:,}")
            print(f"  Total Put Volume: {pcr['total_put_volume']:,}")
            
            # ATM Analysis
            print("\n🎯 ATM ANALYSIS:")
            atm = result["atm_analysis"]
            print(f"  Spot Price: {atm['spot_price']}")
            print(f"  ATM Strike: {atm['atm_strike']}")
            print(f"  Strike Interval: {atm['strike_interval']}")
            print(f"  Near ATM Strikes ({len(atm['near_atm_strikes'])} strikes):")
            for strike_info in atm['near_atm_strikes']:
                print(f"    {strike_info['strike']}: Distance={strike_info['distance_from_spot']:.2f}%, "
                      f"Call OI={strike_info['call_oi']:,}, Put OI={strike_info['put_oi']:,}")
            
            # OI Analysis
            print("\n📈 OI ANALYSIS:")
            oi = result["oi_analysis"]
            print(f"  Buildup Type: {oi['buildup_type']}")
            print(f"  Explanation: {oi['explanation']}")
            print(f"  Max Call OI Strike: {oi['max_call_oi_strike']}")
            print(f"  Max Put OI Strike: {oi['max_put_oi_strike']}")
            
            # Support Levels
            print(f"\n  Support Levels ({len(oi['support_levels'])} levels):")
            for level in oi['support_levels']:
                print(f"    {level['strike']}: Strength={level['strength']:.2f}, {level['reason']}")
            
            # Resistance Levels
            print(f"\n  Resistance Levels ({len(oi['resistance_levels'])} levels):")
            for level in oi['resistance_levels']:
                print(f"    {level['strike']}: Strength={level['strength']:.2f}, {level['reason']}")
            
            # OI Changes
            print(f"\n  Significant OI Changes ({len(oi['oi_change_analysis'])} strikes):")
            for change in oi['oi_change_analysis']:
                print(f"    {change['strike']}: Call OI Δ={change['call_oi_change']:+,}, "
                      f"Put OI Δ={change['put_oi_change']:+,}")
                print(f"      → {change['interpretation']}")
            
            print("\n" + "=" * 80)
            print("✅ OPTIONS CHAIN ANALYSIS COMPLETED SUCCESSFULLY")
            print("=" * 80)
            
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to Quant Engine at", BASE_URL)
        print("Make sure the Quant Engine is running on port 8000")
        print("Start it with: python main.py")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")


def test_invalid_symbol():
    """Test with invalid symbol (should be rejected)."""
    
    print("\n" + "=" * 80)
    print("Testing Invalid Symbol (RELIANCE) - Should Reject")
    print("=" * 80)
    
    request_data = {
        "symbol": "RELIANCE",
        "spot_price": 2500.0,
        "contracts": [
            {
                "strike_price": 2500.0,
                "option_type": "CALL",
                "ltp": 50.0,
                "open_interest": 1000,
                "change_in_oi": 100,
                "volume": 500,
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/quant/options/analyze",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        
        print(f"\nResponse Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 400:
            print("\n✅ Correctly rejected invalid symbol")
        else:
            print("\n❌ Should have rejected RELIANCE symbol")
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")


if __name__ == "__main__":
    # Test valid NIFTY options chain
    test_options_analyze()
    
    # Test invalid symbol
    test_invalid_symbol()
