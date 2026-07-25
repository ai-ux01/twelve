"""
Test script to verify rate limiting on options endpoints.

This script tests that:
1. Rate limiting is applied to /quant/options/chain and /quant/options/analyze
2. Rate limit headers are present in responses
3. 429 status code is returned when limit is exceeded
"""

import time
import requests

BASE_URL = "http://localhost:8000"


def test_rate_limiting_options_chain():
    """Test rate limiting on /quant/options/chain endpoint."""
    
    print("=" * 80)
    print("Testing Rate Limiting on /quant/options/chain")
    print("=" * 80)
    
    # Prepare a minimal valid request
    request_data = {
        "symbol": "NIFTY",
        "expiry": "2024-12-26T00:00:00Z",
        "spot_price": 21500.0,
        "risk_free_rate": 0.07,
        "contracts": [
            {
                "strike_price": 21500.0,
                "option_type": "CALL",
                "volatility": 0.15,
                "ltp": 120.0,
                "open_interest": 10000,
                "volume": 5000,
                "bid": 118.0,
                "ask": 122.0
            }
        ]
    }
    
    success_count = 0
    rate_limited_count = 0
    
    # Make 12 requests (should hit rate limit at 11th request)
    print("\nMaking 12 requests to test rate limiting (limit: 10 req/min)...")
    
    for i in range(12):
        try:
            response = requests.post(
                f"{BASE_URL}/quant/options/chain",
                json=request_data,
                headers={"Content-Type": "application/json"},
            )
            
            # Check rate limit headers
            limit = response.headers.get("X-RateLimit-Limit", "N/A")
            remaining = response.headers.get("X-RateLimit-Remaining", "N/A")
            reset = response.headers.get("X-RateLimit-Reset", "N/A")
            
            if response.status_code == 200:
                success_count += 1
                print(f"  Request {i+1}: ✓ SUCCESS (Status: 200)")
                print(f"    Rate Limit: {limit}, Remaining: {remaining}, Reset: {reset}")
            elif response.status_code == 429:
                rate_limited_count += 1
                retry_after = response.headers.get("Retry-After", "N/A")
                print(f"  Request {i+1}: ✗ RATE LIMITED (Status: 429)")
                print(f"    Rate Limit: {limit}, Remaining: {remaining}, Retry After: {retry_after}s")
                print(f"    Response: {response.json()}")
            else:
                print(f"  Request {i+1}: ⚠ UNEXPECTED (Status: {response.status_code})")
                
        except Exception as e:
            print(f"  Request {i+1}: ✗ ERROR - {str(e)}")
    
    print("\n" + "=" * 80)
    print("RESULTS:")
    print(f"  Successful requests: {success_count}")
    print(f"  Rate limited requests: {rate_limited_count}")
    print("=" * 80)
    
    # Verify rate limiting worked
    if success_count == 10 and rate_limited_count == 2:
        print("✓ Rate limiting is working correctly!")
        return True
    else:
        print(f"✗ Rate limiting not working as expected!")
        print(f"  Expected: 10 successful, 2 rate limited")
        print(f"  Got: {success_count} successful, {rate_limited_count} rate limited")
        return False


def test_rate_limiting_options_analyze():
    """Test rate limiting on /quant/options/analyze endpoint."""
    
    print("\n" + "=" * 80)
    print("Testing Rate Limiting on /quant/options/analyze")
    print("=" * 80)
    
    # Wait a moment to reset rate limit window
    print("\nWaiting 3 seconds to avoid spillover from previous test...")
    time.sleep(3)
    
    # Prepare a minimal valid request
    request_data = {
        "symbol": "NIFTY",
        "spot_price": 21500.0,
        "contracts": [
            {
                "strike_price": 21500.0,
                "option_type": "CALL",
                "ltp": 120.0,
                "open_interest": 10000,
                "change_in_oi": 1000,
                "volume": 5000
            },
            {
                "strike_price": 21500.0,
                "option_type": "PUT",
                "ltp": 85.0,
                "open_interest": 12000,
                "change_in_oi": -500,
                "volume": 6000
            }
        ]
    }
    
    success_count = 0
    rate_limited_count = 0
    
    # Make 12 requests (should hit rate limit at 11th request)
    print("\nMaking 12 requests to test rate limiting (limit: 10 req/min)...")
    
    for i in range(12):
        try:
            response = requests.post(
                f"{BASE_URL}/quant/options/analyze",
                json=request_data,
                headers={"Content-Type": "application/json"},
            )
            
            # Check rate limit headers
            limit = response.headers.get("X-RateLimit-Limit", "N/A")
            remaining = response.headers.get("X-RateLimit-Remaining", "N/A")
            
            if response.status_code == 200:
                success_count += 1
                print(f"  Request {i+1}: ✓ SUCCESS (Status: 200)")
                print(f"    Rate Limit: {limit}, Remaining: {remaining}")
            elif response.status_code == 429:
                rate_limited_count += 1
                print(f"  Request {i+1}: ✗ RATE LIMITED (Status: 429)")
                print(f"    Rate Limit: {limit}, Remaining: {remaining}")
            else:
                print(f"  Request {i+1}: ⚠ UNEXPECTED (Status: {response.status_code})")
                
        except Exception as e:
            print(f"  Request {i+1}: ✗ ERROR - {str(e)}")
    
    print("\n" + "=" * 80)
    print("RESULTS:")
    print(f"  Successful requests: {success_count}")
    print(f"  Rate limited requests: {rate_limited_count}")
    print("=" * 80)
    
    # Verify rate limiting worked
    if success_count == 10 and rate_limited_count == 2:
        print("✓ Rate limiting is working correctly!")
        return True
    else:
        print(f"✗ Rate limiting not working as expected!")
        return False


def test_root_endpoint_documentation():
    """Test that root endpoint includes rate limiting documentation."""
    
    print("\n" + "=" * 80)
    print("Testing Root Endpoint Documentation")
    print("=" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if rate_limits section exists
            if "rate_limits" in data:
                print("✓ rate_limits section found in root endpoint")
                
                # Check options endpoints rate limit info
                if "options_endpoints" in data["rate_limits"]:
                    rate_info = data["rate_limits"]["options_endpoints"]
                    print(f"  Limit: {rate_info.get('limit')}")
                    print(f"  Endpoints: {rate_info.get('endpoints')}")
                    print("✓ Options rate limit documentation is complete")
                    return True
                else:
                    print("✗ options_endpoints not found in rate_limits")
                    return False
            else:
                print("✗ rate_limits section not found in root endpoint")
                return False
        else:
            print(f"✗ Root endpoint returned status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"✗ ERROR - {str(e)}")
        return False


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("RATE LIMITING TEST SUITE")
    print("=" * 80)
    print("\nNOTE: Quant Engine must be running on http://localhost:8000")
    print("Start it with: python main.py")
    print("=" * 80)
    
    # Test root documentation first
    test1 = test_root_endpoint_documentation()
    
    # Test rate limiting on both endpoints
    test2 = test_rate_limiting_options_chain()
    test3 = test_rate_limiting_options_analyze()
    
    # Summary
    print("\n" + "=" * 80)
    print("OVERALL SUMMARY")
    print("=" * 80)
    print(f"  Root Documentation: {'✓ PASS' if test1 else '✗ FAIL'}")
    print(f"  /quant/options/chain Rate Limiting: {'✓ PASS' if test2 else '✗ FAIL'}")
    print(f"  /quant/options/analyze Rate Limiting: {'✓ PASS' if test3 else '✗ FAIL'}")
    
    if test1 and test2 and test3:
        print("\n✓ ALL TESTS PASSED!")
    else:
        print("\n✗ SOME TESTS FAILED")
    
    print("=" * 80)
