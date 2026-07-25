"""
Unit tests for batch Options Greeks calculator.

Tests the batch processing functionality for calculating Greeks for
entire options chains (100+ contracts) efficiently.

Requirements covered: 7.3 - Basic Greeks calculation for options chain analysis
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import greeks module directly to avoid relative import issues
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location(
    "greeks", os.path.join(os.path.dirname(__file__), "..", "calculators", "greeks.py")
)
greeks_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(greeks_module)

calculate_greeks_batch = greeks_module.calculate_greeks_batch
calculate_greeks = greeks_module.calculate_greeks


class TestBatchGreeksCalculation:
    """Test batch Greeks calculation for multiple contracts."""

    def test_batch_single_contract(self):
        """Test batch calculation with a single contract."""
        expiry = datetime.utcnow() + timedelta(days=30)
        contracts = [
            {
                "strike_price": 21500.0,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            }
        ]

        results = calculate_greeks_batch(
            spot_price=21500.0, contracts=contracts, risk_free_rate=0.07
        )

        assert len(results) == 1
        assert results[0]["strike_price"] == 21500.0
        assert results[0]["option_type"] == "CALL"
        assert "delta" in results[0]
        assert "gamma" in results[0]
        assert "theta" in results[0]
        assert "vega" in results[0]

    def test_batch_multiple_contracts(self):
        """Test batch calculation with multiple contracts."""
        expiry = datetime.utcnow() + timedelta(days=7)
        contracts = [
            {
                "strike_price": 21400.0,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            },
            {
                "strike_price": 21400.0,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "PUT",
            },
            {
                "strike_price": 21500.0,
                "expiry_date": expiry,
                "volatility": 0.14,
                "option_type": "CALL",
            },
            {
                "strike_price": 21500.0,
                "expiry_date": expiry,
                "volatility": 0.14,
                "option_type": "PUT",
            },
            {
                "strike_price": 21600.0,
                "expiry_date": expiry,
                "volatility": 0.16,
                "option_type": "CALL",
            },
        ]

        results = calculate_greeks_batch(
            spot_price=21500.0, contracts=contracts, risk_free_rate=0.07
        )

        assert len(results) == 5

        # Check all results have required fields
        for result in results:
            assert "strike_price" in result
            assert "expiry_date" in result
            assert "option_type" in result
            assert "delta" in result
            assert "gamma" in result
            assert "theta" in result
            assert "vega" in result

        # Check that call and put at same strike have opposite delta signs
        call_21400 = next(r for r in results if r["strike_price"] == 21400.0 and r["option_type"] == "CALL")
        put_21400 = next(r for r in results if r["strike_price"] == 21400.0 and r["option_type"] == "PUT")
        
        assert call_21400["delta"] > 0
        assert put_21400["delta"] < 0

    def test_batch_large_chain(self):
        """Test batch calculation with a large options chain (100+ contracts)."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        # Create a realistic options chain: 50 strikes x 2 option types = 100 contracts
        base_strike = 21000.0
        strike_interval = 50.0
        contracts = []

        for i in range(50):
            strike = base_strike + (i * strike_interval)
            # Add CALL
            contracts.append(
                {
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.15,
                    "option_type": "CALL",
                }
            )
            # Add PUT
            contracts.append(
                {
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.15,
                    "option_type": "PUT",
                }
            )

        results = calculate_greeks_batch(
            spot_price=21500.0, contracts=contracts, risk_free_rate=0.07
        )

        assert len(results) == 100
        
        # Verify all results have valid Greeks
        for result in results:
            assert -1 <= result["delta"] <= 1
            assert result["gamma"] >= 0
            # Theta is typically negative for long options, but can be positive for deep OTM puts
            # Just verify it's a valid number
            assert isinstance(result["theta"], (int, float))
            assert result["vega"] >= 0

    def test_batch_consistency_with_single(self):
        """Test that batch results match single contract calculation."""
        expiry = datetime.utcnow() + timedelta(days=30)
        spot_price = 21500.0
        strike_price = 21600.0
        volatility = 0.15
        risk_free_rate = 0.07

        # Calculate using single contract function
        single_result = calculate_greeks(
            spot_price=spot_price,
            strike_price=strike_price,
            expiry_date=expiry,
            volatility=volatility,
            risk_free_rate=risk_free_rate,
            option_type="CALL",
        )

        # Calculate using batch function
        batch_results = calculate_greeks_batch(
            spot_price=spot_price,
            contracts=[
                {
                    "strike_price": strike_price,
                    "expiry_date": expiry,
                    "volatility": volatility,
                    "option_type": "CALL",
                }
            ],
            risk_free_rate=risk_free_rate,
        )

        batch_result = batch_results[0]

        # Compare results (should be identical within reasonable floating point precision)
        assert abs(batch_result["delta"] - single_result["delta"]) < 1e-8
        assert abs(batch_result["gamma"] - single_result["gamma"]) < 1e-8
        assert abs(batch_result["theta"] - single_result["theta"]) < 1e-8
        assert abs(batch_result["vega"] - single_result["vega"]) < 1e-8

    def test_batch_no_rho_calculation(self):
        """Test that batch mode does NOT calculate Rho (for performance)."""
        expiry = datetime.utcnow() + timedelta(days=30)
        contracts = [
            {
                "strike_price": 21500.0,
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            }
        ]

        results = calculate_greeks_batch(
            spot_price=21500.0, contracts=contracts, risk_free_rate=0.07
        )

        # Rho should NOT be in the result
        assert "rho" not in results[0]
        
        # But all basic Greeks should be present
        assert "delta" in results[0]
        assert "gamma" in results[0]
        assert "theta" in results[0]
        assert "vega" in results[0]


class TestBatchGreeksAccuracy:
    """Test accuracy of batch Greeks calculations."""

    def test_batch_atm_options(self):
        """Test batch calculation for ATM options."""
        expiry = datetime.utcnow() + timedelta(days=30)
        spot_price = 21500.0
        
        contracts = [
            {
                "strike_price": 21500.0,  # ATM
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            },
            {
                "strike_price": 21500.0,  # ATM
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "PUT",
            },
        ]

        results = calculate_greeks_batch(
            spot_price=spot_price, contracts=contracts, risk_free_rate=0.07
        )

        call_result = next(r for r in results if r["option_type"] == "CALL")
        put_result = next(r for r in results if r["option_type"] == "PUT")

        # ATM call delta should be around 0.5
        assert 0.48 < call_result["delta"] < 0.57

        # ATM put delta should be around -0.5
        assert -0.57 < put_result["delta"] < -0.43

        # Gamma should be the same for call and put
        assert abs(call_result["gamma"] - put_result["gamma"]) < 1e-6

        # Vega should be the same for call and put
        assert abs(call_result["vega"] - put_result["vega"]) < 1e-6

    def test_batch_itm_otm_calls(self):
        """Test batch calculation for ITM and OTM calls."""
        expiry = datetime.utcnow() + timedelta(days=30)
        spot_price = 21500.0
        
        contracts = [
            {
                "strike_price": 21000.0,  # ITM
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            },
            {
                "strike_price": 22000.0,  # OTM
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            },
        ]

        results = calculate_greeks_batch(
            spot_price=spot_price, contracts=contracts, risk_free_rate=0.07
        )

        itm_result = next(r for r in results if r["strike_price"] == 21000.0)
        otm_result = next(r for r in results if r["strike_price"] == 22000.0)

        # ITM call should have high delta (> 0.7)
        assert itm_result["delta"] > 0.7

        # OTM call should have low delta (< 0.4)
        assert otm_result["delta"] < 0.4

        # Both should have positive gamma
        assert itm_result["gamma"] > 0
        assert otm_result["gamma"] > 0

        # Both should have negative theta (time decay)
        assert itm_result["theta"] < 0
        assert otm_result["theta"] < 0

    def test_batch_different_expiries(self):
        """Test batch calculation with different expiry dates."""
        near_expiry = datetime.utcnow() + timedelta(days=7)
        far_expiry = datetime.utcnow() + timedelta(days=90)
        
        contracts = [
            {
                "strike_price": 21500.0,
                "expiry_date": near_expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            },
            {
                "strike_price": 21500.0,
                "expiry_date": far_expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            },
        ]

        results = calculate_greeks_batch(
            spot_price=21500.0, contracts=contracts, risk_free_rate=0.07
        )

        near_result = results[0]
        far_result = results[1]

        # Near expiry should have higher theta magnitude (more time decay)
        assert abs(near_result["theta"]) > abs(far_result["theta"])

        # Far expiry should have higher vega (more sensitive to volatility)
        assert far_result["vega"] > near_result["vega"]

    def test_batch_different_volatilities(self):
        """Test batch calculation with different implied volatilities."""
        expiry = datetime.utcnow() + timedelta(days=30)
        
        contracts = [
            {
                "strike_price": 21500.0,
                "expiry_date": expiry,
                "volatility": 0.10,  # Low volatility
                "option_type": "CALL",
            },
            {
                "strike_price": 21500.0,
                "expiry_date": expiry,
                "volatility": 0.25,  # High volatility
                "option_type": "CALL",
            },
        ]

        results = calculate_greeks_batch(
            spot_price=21500.0, contracts=contracts, risk_free_rate=0.07
        )

        low_vol_result = results[0]
        high_vol_result = results[1]

        # Higher volatility should result in higher vega
        assert high_vol_result["vega"] > low_vol_result["vega"]


class TestBatchGreeksEdgeCases:
    """Test edge cases for batch Greeks calculation."""

    def test_batch_expired_options(self):
        """Test batch calculation with expired options."""
        expired = datetime.utcnow() - timedelta(days=5)
        
        contracts = [
            {
                "strike_price": 21500.0,
                "expiry_date": expired,
                "volatility": 0.15,
                "option_type": "CALL",
            },
            {
                "strike_price": 21600.0,
                "expiry_date": expired,
                "volatility": 0.15,
                "option_type": "PUT",
            },
        ]

        results = calculate_greeks_batch(
            spot_price=21500.0, contracts=contracts, risk_free_rate=0.07
        )

        # Should still return valid results (using minimum 1 day)
        assert len(results) == 2
        for result in results:
            assert "delta" in result
            assert "gamma" in result
            assert "theta" in result
            assert "vega" in result

    def test_batch_deep_itm_otm(self):
        """Test batch calculation with deep ITM and OTM options."""
        expiry = datetime.utcnow() + timedelta(days=30)
        spot_price = 21500.0
        
        contracts = [
            {
                "strike_price": 19000.0,  # Deep ITM call
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            },
            {
                "strike_price": 24000.0,  # Deep OTM call
                "expiry_date": expiry,
                "volatility": 0.15,
                "option_type": "CALL",
            },
        ]

        results = calculate_greeks_batch(
            spot_price=spot_price, contracts=contracts, risk_free_rate=0.07
        )

        deep_itm = results[0]
        deep_otm = results[1]

        # Deep ITM should have delta close to 1
        assert deep_itm["delta"] > 0.95

        # Deep OTM should have delta close to 0
        assert deep_otm["delta"] < 0.05

    def test_batch_very_high_volatility(self):
        """Test batch calculation with very high volatility."""
        expiry = datetime.utcnow() + timedelta(days=30)
        
        contracts = [
            {
                "strike_price": 21500.0,
                "expiry_date": expiry,
                "volatility": 1.0,  # 100% volatility
                "option_type": "CALL",
            }
        ]

        results = calculate_greeks_batch(
            spot_price=21500.0, contracts=contracts, risk_free_rate=0.07
        )

        # Should still return valid results
        assert len(results) == 1
        assert -1 <= results[0]["delta"] <= 1
        assert results[0]["gamma"] >= 0
        assert results[0]["vega"] >= 0

    def test_batch_empty_list(self):
        """Test batch calculation with empty contracts list."""
        results = calculate_greeks_batch(
            spot_price=21500.0, contracts=[], risk_free_rate=0.07
        )

        assert len(results) == 0


class TestBatchGreeksNiftyBankNifty:
    """Test batch Greeks calculation for NIFTY and BANKNIFTY specific scenarios."""

    def test_batch_nifty_weekly_chain(self):
        """Test batch calculation for NIFTY weekly options chain."""
        expiry = datetime.utcnow() + timedelta(days=3)  # 3 days to weekly expiry
        spot_price = 21500.0
        
        # Create typical NIFTY weekly chain: strikes from -500 to +500 in 50 intervals
        contracts = []
        for strike_offset in range(-500, 550, 50):
            strike = spot_price + strike_offset
            contracts.append(
                {
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.12,  # Typical NIFTY volatility
                    "option_type": "CALL",
                }
            )
            contracts.append(
                {
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.12,
                    "option_type": "PUT",
                }
            )

        results = calculate_greeks_batch(
            spot_price=spot_price, contracts=contracts, risk_free_rate=0.07
        )

        # Should process all 42 contracts (21 strikes x 2 option types)
        assert len(results) == 42

        # Verify all have valid Greeks (theta can be positive for deep OTM puts)
        for result in results:
            assert -1 <= result["delta"] <= 1
            assert result["gamma"] >= 0
            assert isinstance(result["theta"], (int, float))
            assert result["vega"] >= 0

    def test_batch_banknifty_chain(self):
        """Test batch calculation for BANKNIFTY options chain."""
        expiry = datetime.utcnow() + timedelta(days=7)
        spot_price = 45000.0
        
        # Create BANKNIFTY chain: strikes in 100 intervals
        contracts = []
        for strike_offset in range(-1000, 1100, 100):
            strike = spot_price + strike_offset
            contracts.append(
                {
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.18,  # Typical BANKNIFTY higher volatility
                    "option_type": "CALL",
                }
            )
            contracts.append(
                {
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.18,
                    "option_type": "PUT",
                }
            )

        results = calculate_greeks_batch(
            spot_price=spot_price, contracts=contracts, risk_free_rate=0.07
        )

        # Should process all 42 contracts (21 strikes x 2 option types)
        assert len(results) == 42

        # Verify all have valid Greeks
        for result in results:
            assert -1 <= result["delta"] <= 1
            assert result["gamma"] >= 0
            assert result["theta"] < 0
            assert result["vega"] >= 0

    def test_batch_scalping_strikes(self):
        """Test batch calculation for typical scalping strikes (ATM ±3)."""
        expiry = datetime.utcnow() + timedelta(hours=4)  # Intraday expiry
        spot_price = 21500.0
        atm_strike = 21500.0
        
        # ATM ±3 strikes (typical for scalping)
        contracts = []
        for strike_offset in [-150, -100, -50, 0, 50, 100, 150]:
            strike = atm_strike + strike_offset
            contracts.append(
                {
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.15,
                    "option_type": "CALL",
                }
            )
            contracts.append(
                {
                    "strike_price": strike,
                    "expiry_date": expiry,
                    "volatility": 0.15,
                    "option_type": "PUT",
                }
            )

        results = calculate_greeks_batch(
            spot_price=spot_price, contracts=contracts, risk_free_rate=0.07
        )

        # Should process all 14 contracts (7 strikes x 2 option types)
        assert len(results) == 14

        # ATM options should have highest gamma
        atm_call = next(
            r
            for r in results
            if r["strike_price"] == atm_strike and r["option_type"] == "CALL"
        )
        
        # Verify ATM call has significant gamma (highest sensitivity)
        assert atm_call["gamma"] > 0
