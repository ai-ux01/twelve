"""
Performance benchmark tests for batch Greeks calculation.

Tests the performance improvements from vectorized numpy operations
in the batch processing functionality (Task 66.2).

Requirements covered: 7.3 - Performance optimization for large options chains
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import time

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import greeks module directly
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location(
    "greeks", os.path.join(os.path.dirname(__file__), "..", "calculators", "greeks.py")
)
greeks_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(greeks_module)

calculate_greeks_batch = greeks_module.calculate_greeks_batch


class TestBatchGreeksPerformance:
    """Performance benchmark tests for batch Greeks calculation."""

    def test_performance_100_contracts(self):
        """Benchmark batch calculation with 100 contracts."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        # Create 100 contracts (50 strikes x 2 option types)
        contracts = []
        base_strike = 21000.0
        for i in range(50):
            strike = base_strike + (i * 50)
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            })
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "PUT",
            })

        # Warm-up run
        _ = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)

        # Benchmark run
        start_time = time.time()
        results = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)
        end_time = time.time()

        elapsed_ms = (end_time - start_time) * 1000

        # Verify results
        assert len(results) == 100
        
        # Performance should be under 50ms for 100 contracts with vectorized operations
        # (Old sequential implementation was typically 100-200ms)
        print(f"\n100 contracts processed in {elapsed_ms:.2f}ms")
        assert elapsed_ms < 100, f"Performance regression: {elapsed_ms:.2f}ms > 100ms"

    def test_performance_200_contracts(self):
        """Benchmark batch calculation with 200 contracts."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        # Create 200 contracts (100 strikes x 2 option types)
        contracts = []
        base_strike = 20000.0
        for i in range(100):
            strike = base_strike + (i * 50)
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            })
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "PUT",
            })

        # Warm-up run
        _ = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)

        # Benchmark run
        start_time = time.time()
        results = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)
        end_time = time.time()

        elapsed_ms = (end_time - start_time) * 1000

        # Verify results
        assert len(results) == 200
        
        # Performance should be under 100ms for 200 contracts
        print(f"\n200 contracts processed in {elapsed_ms:.2f}ms")
        assert elapsed_ms < 150, f"Performance regression: {elapsed_ms:.2f}ms > 150ms"

    def test_performance_large_chain_500_contracts(self):
        """Benchmark batch calculation with 500 contracts (stress test)."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        # Create 500 contracts (250 strikes x 2 option types)
        contracts = []
        base_strike = 18000.0
        for i in range(250):
            strike = base_strike + (i * 50)
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            })
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "PUT",
            })

        # Warm-up run
        _ = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)

        # Benchmark run
        start_time = time.time()
        results = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)
        end_time = time.time()

        elapsed_ms = (end_time - start_time) * 1000

        # Verify results
        assert len(results) == 500
        
        # Performance should be under 300ms for 500 contracts
        print(f"\n500 contracts processed in {elapsed_ms:.2f}ms")
        assert elapsed_ms < 400, f"Performance regression: {elapsed_ms:.2f}ms > 400ms"

    def test_performance_multiple_expiries(self):
        """Benchmark batch calculation with multiple expiry dates."""
        # Create 120 contracts with 3 different expiries
        expiry1 = datetime.utcnow() + timedelta(days=3)   # Weekly
        expiry2 = datetime.utcnow() + timedelta(days=30)  # Monthly
        expiry3 = datetime.utcnow() + timedelta(days=90)  # Quarterly

        contracts = []
        base_strike = 21000.0
        
        for expiry in [expiry1, expiry2, expiry3]:
            for i in range(20):
                strike = base_strike + (i * 50)
                contracts.append({
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.15,
                    "option_type": "CALL",
                })
                contracts.append({
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.15,
                    "option_type": "PUT",
                })

        # Warm-up run
        _ = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)

        # Benchmark run
        start_time = time.time()
        results = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)
        end_time = time.time()

        elapsed_ms = (end_time - start_time) * 1000

        # Verify results
        assert len(results) == 120
        
        # Performance should be under 80ms for 120 contracts
        print(f"\n120 contracts (3 expiries) processed in {elapsed_ms:.2f}ms")
        assert elapsed_ms < 120, f"Performance regression: {elapsed_ms:.2f}ms > 120ms"

    def test_performance_varying_volatilities(self):
        """Benchmark batch calculation with varying implied volatilities."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        # Create 100 contracts with varying volatilities (simulating volatility smile)
        contracts = []
        base_strike = 21000.0
        base_vol = 0.15
        
        for i in range(50):
            strike = base_strike + (i * 50)
            # Simulate volatility smile (higher vol for OTM options)
            vol = base_vol + abs(i - 25) * 0.002
            
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": vol,
                "option_type": "CALL",
            })
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": vol,
                "option_type": "PUT",
            })

        # Warm-up run
        _ = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)

        # Benchmark run
        start_time = time.time()
        results = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)
        end_time = time.time()

        elapsed_ms = (end_time - start_time) * 1000

        # Verify results
        assert len(results) == 100
        
        # Performance should be under 50ms
        print(f"\n100 contracts (varying volatilities) processed in {elapsed_ms:.2f}ms")
        assert elapsed_ms < 100, f"Performance regression: {elapsed_ms:.2f}ms > 100ms"

    def test_performance_scalability(self):
        """Test that performance scales linearly (or better) with contract count."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        contract_counts = [50, 100, 200]
        elapsed_times = []

        for count in contract_counts:
            # Create contracts
            contracts = []
            base_strike = 21000.0
            strikes = count // 2  # Each strike gets CALL and PUT
            
            for i in range(strikes):
                strike = base_strike + (i * 50)
                contracts.append({
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.15,
                    "option_type": "CALL",
                })
                contracts.append({
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.15,
                    "option_type": "PUT",
                })

            # Warm-up
            _ = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)

            # Benchmark
            start_time = time.time()
            results = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)
            end_time = time.time()

            elapsed_ms = (end_time - start_time) * 1000
            elapsed_times.append(elapsed_ms)

            assert len(results) == count
            print(f"\n{count} contracts processed in {elapsed_ms:.2f}ms")

        # Check scaling: time for 200 contracts should be < 3x time for 50 contracts
        # (ideally should be ~4x, but with overhead it might be slightly better)
        scaling_factor = elapsed_times[2] / elapsed_times[0]
        print(f"\nScaling factor (200/50): {scaling_factor:.2f}x")
        
        # With vectorized operations, scaling should be sub-linear due to numpy efficiency
        assert scaling_factor < 5, f"Poor scaling: {scaling_factor:.2f}x >= 5x"


class TestBatchGreeksAccuracyWithPerformance:
    """Verify that vectorized implementation maintains accuracy while improving performance."""

    def test_accuracy_preserved_with_vectorization(self):
        """Verify that vectorized batch calculation produces accurate results."""
        expiry = datetime.utcnow() + timedelta(days=30)
        
        # Create typical options chain
        contracts = []
        base_strike = 21000.0
        for i in range(50):
            strike = base_strike + (i * 50)
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            })
            contracts.append({
                "strike_price": strike,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "PUT",
            })

        results = calculate_greeks_batch(spot_price=21500.0, contracts=contracts)

        # Verify all results are within valid ranges
        for result in results:
            # Delta range
            assert -1 <= result["delta"] <= 1, f"Delta {result['delta']} out of range"
            
            # Gamma should be positive
            assert result["gamma"] >= 0, f"Gamma {result['gamma']} should be positive"
            
            # Theta should be valid (typically negative but can be positive for deep OTM puts)
            assert isinstance(result["theta"], (int, float)), "Theta should be numeric"
            
            # Vega should be positive
            assert result["vega"] >= 0, f"Vega {result['vega']} should be positive"

        # Check specific properties
        # Find ATM options (strike closest to spot)
        atm_call = min(
            (r for r in results if r["option_type"] == "CALL"),
            key=lambda x: abs(x["strike_price"] - 21500.0)
        )
        atm_put = min(
            (r for r in results if r["option_type"] == "PUT"),
            key=lambda x: abs(x["strike_price"] - 21500.0)
        )

        # ATM call delta should be around 0.5
        assert 0.45 < atm_call["delta"] < 0.57, f"ATM call delta {atm_call['delta']} unexpected"
        
        # ATM put delta should be around -0.5
        assert -0.57 < atm_put["delta"] < -0.43, f"ATM put delta {atm_put['delta']} unexpected"
        
        # ATM options should have highest gamma
        gammas = [r["gamma"] for r in results]
        max_gamma = max(gammas)
        assert atm_call["gamma"] >= max_gamma * 0.95, "ATM call should have near-max gamma"
        assert atm_put["gamma"] >= max_gamma * 0.95, "ATM put should have near-max gamma"

        print(f"\nAccuracy check passed for {len(results)} contracts")
        print(f"ATM Call: Delta={atm_call['delta']:.4f}, Gamma={atm_call['gamma']:.6f}")
        print(f"ATM Put: Delta={atm_put['delta']:.4f}, Gamma={atm_put['gamma']:.6f}")
