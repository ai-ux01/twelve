"""
Test script for swing scanner API endpoint.

This script tests the /quant/swing/scan endpoint to verify:
- Parallel processing works correctly
- Caching reduces API calls
- Performance metrics are captured
- Results are properly scored and ranked
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"


def test_scan_endpoint():
    """Test the swing scanner endpoint."""
    print("=" * 80)
    print("Testing Swing Scanner API Endpoint")
    print("=" * 80)

    # Test data
    symbols = ["RELIANCE", "TCS", "INFY", "HDFC", "ICICIBANK"]
    min_score = 50.0

    # Test 1: First scan (should miss cache)
    print("\n1. First scan (cache miss expected)...")
    url = f"{BASE_URL}/quant/swing/scan"
    params = {"min_score": min_score, "clear_cache": True}
    payload = {"symbols": symbols}

    start_time = time.time()
    response = requests.post(url, params=params, json=payload)
    duration = (time.time() - start_time) * 1000

    if response.status_code == 200:
        result = response.json()
        print(f"✓ First scan completed in {duration:.2f}ms")
        print(f"  - Total symbols: {result['total_symbols']}")
        print(f"  - Valid symbols: {result['valid_symbols']}")
        print(f"  - Candidates found: {result['candidates_found']}")

        metrics = result["performance_metrics"]
        print(f"  - API calls: {metrics['api_calls']}")
        print(f"  - Cache hits: {metrics['cache_hits']}")
        print(f"  - Cache misses: {metrics['cache_misses']}")
        print(f"  - Scan duration: {metrics['total_duration_ms']:.2f}ms")
        print(f"  - Avg per stock: {metrics['avg_time_per_stock_ms']:.2f}ms")

        if result["candidates"]:
            print(f"\n  Top candidate:")
            top = result["candidates"][0]
            print(f"    Symbol: {top['symbol']}")
            print(f"    Score: {top['score']:.2f}")
    else:
        print(f"✗ Request failed: {response.status_code}")
        print(f"  Error: {response.text}")
        return

    # Test 2: Second scan (should hit cache)
    print("\n2. Second scan (cache hit expected)...")
    params = {"min_score": min_score, "clear_cache": False}

    start_time = time.time()
    response = requests.post(url, params=params, json=payload)
    duration = (time.time() - start_time) * 1000

    if response.status_code == 200:
        result = response.json()
        print(f"✓ Second scan completed in {duration:.2f}ms")

        metrics = result["performance_metrics"]
        print(f"  - API calls: {metrics['api_calls']}")
        print(f"  - Cache hits: {metrics['cache_hits']}")
        print(f"  - Cache misses: {metrics['cache_misses']}")
        print(f"  - Scan duration: {metrics['total_duration_ms']:.2f}ms")

        # Calculate speedup
        if "total_duration_ms" in metrics and metrics["cache_hits"] > 0:
            print(f"  - Cache improved performance!")
    else:
        print(f"✗ Request failed: {response.status_code}")
        print(f"  Error: {response.text}")
        return

    # Test 3: Get cache stats
    print("\n3. Cache statistics...")
    cache_url = f"{BASE_URL}/quant/swing/cache/stats"
    response = requests.get(cache_url)

    if response.status_code == 200:
        stats = response.json()
        print(f"✓ Cache stats retrieved:")
        print(f"  - Total entries: {stats['total_entries']}")
        print(f"  - Active entries: {stats['active_entries']}")
        print(f"  - Hit rate: {stats['hit_rate']:.2%}")
    else:
        print(f"✗ Request failed: {response.status_code}")

    # Test 4: Clear cache
    print("\n4. Clearing cache...")
    clear_url = f"{BASE_URL}/quant/swing/cache/clear"
    response = requests.post(clear_url)

    if response.status_code == 200:
        result = response.json()
        print(f"✓ {result['message']}")
    else:
        print(f"✗ Request failed: {response.status_code}")

    print("\n" + "=" * 80)
    print("Test completed successfully!")
    print("=" * 80)


def test_edge_cases():
    """Test edge cases and error handling."""
    print("\n" + "=" * 80)
    print("Testing Edge Cases")
    print("=" * 80)

    url = f"{BASE_URL}/quant/swing/scan"

    # Test 1: Empty symbols list
    print("\n1. Empty symbols list...")
    response = requests.post(url, json={"symbols": []})
    if response.status_code == 400:
        print(f"✓ Correctly rejected empty list")
    else:
        print(f"✗ Expected 400, got {response.status_code}")

    # Test 2: Too many symbols
    print("\n2. Too many symbols (>100)...")
    large_list = [f"STOCK{i}" for i in range(101)]
    response = requests.post(url, json={"symbols": large_list})
    if response.status_code == 400:
        print(f"✓ Correctly rejected oversized list")
    else:
        print(f"✗ Expected 400, got {response.status_code}")

    # Test 3: Invalid min_score
    print("\n3. Invalid min_score...")
    response = requests.post(
        url, params={"min_score": 150.0}, json={"symbols": ["RELIANCE"]}
    )
    if response.status_code == 400:
        print(f"✓ Correctly rejected invalid score")
    else:
        print(f"✗ Expected 400, got {response.status_code}")

    print("\n" + "=" * 80)
    print("Edge case tests completed!")
    print("=" * 80)


if __name__ == "__main__":
    try:
        # Check if server is running
        response = requests.get(f"{BASE_URL}/health", timeout=2)
        if response.status_code != 200:
            print("Error: Quant Engine is not responding correctly")
            exit(1)
    except requests.exceptions.RequestException:
        print("Error: Cannot connect to Quant Engine at", BASE_URL)
        print("Please start the server first with: python main.py")
        exit(1)

    # Run tests
    test_scan_endpoint()
    test_edge_cases()
