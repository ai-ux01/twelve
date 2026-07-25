"""
Integration test for batch Greeks endpoint.

Tests the POST /options/greeks/batch endpoint to verify it works correctly
with realistic options chain data.
"""

import requests
from datetime import datetime, timedelta
import json

# Quant Engine URL
BASE_URL = "http://localhost:8000"

def test_batch_greeks_endpoint():
    """Test batch Greeks calculation endpoint with realistic options chain."""
    
    # Prepare request data
    expiry = (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z"
    
    request_data = {
        "underlying": "NIFTY",
        "spot_price": 21500.0,
        "contracts": [
            {
                "strike_price": 21400.0,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL"
            },
            {
                "strike_price": 21400.0,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "PUT"
            },
            {
                "strike_price": 21500.0,
                "expiry_date": expiry,
                "volatility": 0.14,
                "option_type": "CALL"
            },
            {
                "strike_price": 21500.0,
                "expiry_date": expiry,
                "volatility": 0.14,
                "option_type": "PUT"
            },
            {
                "strike_price": 21600.0,
                "expiry_date": expiry,
                "volatility": 0.16,
                "option_type": "CALL"
            },
            {
                "strike_price": 21600.0,
                "expiry_date": expiry,
                "volatility": 0.16,
                "option_type": "PUT"
            }
        ],
        "risk_free_rate": 0.07
    }
    
    print("Testing POST /options/greeks/batch endpoint...")
    print(f"Request: {json.dumps(request_data, indent=2)}")
    
    try:
        # Make request to batch Greeks endpoint
        response = requests.post(
            f"{BASE_URL}/options/greeks/batch",
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\nResponse Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nResponse:")
            print(f"  Underlying: {result['underlying']}")
            print(f"  Spot Price: {result['spot_price']}")
            print(f"  Total Contracts: {result['total_contracts']}")
            print(f"\nContracts Greeks:")
            
            for i, contract in enumerate(result['contracts'], 1):
                print(f"\n  Contract {i}:")
                print(f"    Strike: {contract['strike_price']}")
                print(f"    Type: {contract['option_type']}")
                print(f"    Delta: {contract['delta']:.4f}")
                print(f"    Gamma: {contract['gamma']:.6f}")
                print(f"    Theta: {contract['theta']:.4f}")
                print(f"    Vega: {contract['vega']:.4f}")
            
            print("\n✓ Batch Greeks endpoint test PASSED")
            return True
        else:
            print(f"✗ Request failed with status {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("\n✗ Could not connect to Quant Engine.")
        print("Please start the Quant Engine with: python main.py")
        return False
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        return False

def test_batch_greeks_large_chain():
    """Test batch Greeks calculation with a large options chain (100+ contracts)."""
    
    print("\n" + "="*60)
    print("Testing large options chain (100+ contracts)...")
    print("="*60)
    
    # Prepare request data with 100+ contracts
    expiry = (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z"
    base_strike = 21000.0
    strike_interval = 50.0
    
    contracts = []
    for i in range(50):
        strike = base_strike + (i * strike_interval)
        # Add CALL
        contracts.append({
            "strike_price": strike,
            "expiry_date": expiry,
            "volatility": 0.15,
            "option_type": "CALL"
        })
        # Add PUT
        contracts.append({
            "strike_price": strike,
            "expiry_date": expiry,
            "volatility": 0.15,
            "option_type": "PUT"
        })
    
    request_data = {
        "underlying": "NIFTY",
        "spot_price": 21500.0,
        "contracts": contracts,
        "risk_free_rate": 0.07
    }
    
    print(f"Sending request with {len(contracts)} contracts...")
    
    try:
        import time
        start_time = time.time()
        
        response = requests.post(
            f"{BASE_URL}/options/greeks/batch",
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        
        elapsed_time = time.time() - start_time
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Processing Time: {elapsed_time*1000:.2f} ms")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nResults:")
            print(f"  Total Contracts Processed: {result['total_contracts']}")
            print(f"  Performance: {result['total_contracts'] / elapsed_time:.2f} contracts/second")
            
            # Verify a few sample results
            print(f"\nSample Results:")
            for i in [0, 49, 99]:
                contract = result['contracts'][i]
                print(f"  Contract {i+1}: Strike={contract['strike_price']}, "
                      f"Type={contract['option_type']}, Delta={contract['delta']:.4f}")
            
            print("\n✓ Large chain test PASSED")
            return True
        else:
            print(f"✗ Request failed with status {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("\n✗ Could not connect to Quant Engine.")
        print("Please start the Quant Engine with: python main.py")
        return False
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    print("Batch Greeks Endpoint Integration Test")
    print("="*60)
    
    # Test basic batch Greeks
    test1_passed = test_batch_greeks_endpoint()
    
    # Test large chain
    test2_passed = test_batch_greeks_large_chain()
    
    print("\n" + "="*60)
    if test1_passed and test2_passed:
        print("✓ All tests PASSED")
    else:
        print("✗ Some tests FAILED")
    print("="*60)
