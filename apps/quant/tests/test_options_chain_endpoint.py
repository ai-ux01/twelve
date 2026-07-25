"""
Unit tests for POST /quant/options/chain endpoint - Task 68.1

Tests:
- Symbol validation (NIFTY/BANKNIFTY only)
- Greeks calculation for all contracts
- Liquidity filtering
- Response structure

Requirements: 7.1, 7.3
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from main import app
from models.market_data import OptionType


client = TestClient(app)


class TestOptionsChainEndpoint:
    """Test POST /quant/options/chain endpoint."""
    
    def test_valid_nifty_chain(self):
        """Test processing valid NIFTY options chain."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        request_data = {
            "symbol": "NIFTY",
            "expiry": expiry.isoformat() + "Z",
            "spot_price": 21500.0,
            "risk_free_rate": 0.07,
            "contracts": [
                {
                    "strike_price": 21400.0,
                    "option_type": "CALL",
                    "volatility": 0.15,
                    "ltp": 120.0,
                    "open_interest": 10000,
                    "volume": 5000,
                    "bid": 118.0,
                    "ask": 122.0
                },
                {
                    "strike_price": 21400.0,
                    "option_type": "PUT",
                    "volatility": 0.15,
                    "ltp": 85.0,
                    "open_interest": 12000,
                    "volume": 6000,
                    "bid": 83.0,
                    "ask": 87.0
                }
            ]
        }
        
        response = client.post("/quant/options/chain", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["symbol"] == "NIFTY"
        assert data["spot_price"] == 21500.0
        assert data["total_contracts"] == 2
        assert "contracts" in data
        assert len(data["contracts"]) == 2
        
        # Verify Greeks are calculated
        for contract in data["contracts"]:
            assert "greeks" in contract
            assert "delta" in contract["greeks"]
            assert "gamma" in contract["greeks"]
            assert "theta" in contract["greeks"]
            assert "vega" in contract["greeks"]
            assert "liquidity_warnings" in contract
            assert "is_liquid" in contract
    
    def test_valid_banknifty_chain(self):
        """Test processing valid BANKNIFTY options chain."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        request_data = {
            "symbol": "BANKNIFTY",
            "expiry": expiry.isoformat() + "Z",
            "spot_price": 45000.0,
            "risk_free_rate": 0.07,
            "contracts": [
                {
                    "strike_price": 44900.0,
                    "option_type": "CALL",
                    "volatility": 0.16,
                    "ltp": 200.0,
                    "open_interest": 8000,
                    "volume": 4000,
                    "bid": 198.0,
                    "ask": 202.0
                }
            ]
        }
        
        response = client.post("/quant/options/chain", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["symbol"] == "BANKNIFTY"
        assert data["spot_price"] == 45000.0
        assert data["total_contracts"] == 1
    
    def test_invalid_symbol_rejection(self):
        """Test that invalid symbols (non-NIFTY/BANKNIFTY) are rejected."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        request_data = {
            "symbol": "RELIANCE",  # Invalid: not NIFTY or BANKNIFTY
            "expiry": expiry.isoformat() + "Z",
            "spot_price": 2500.0,
            "risk_free_rate": 0.07,
            "contracts": [
                {
                    "strike_price": 2500.0,
                    "option_type": "CALL",
                    "volatility": 0.15,
                    "ltp": 100.0,
                    "open_interest": 5000,
                    "volume": 2000,
                    "bid": 98.0,
                    "ask": 102.0
                }
            ]
        }
        
        response = client.post("/quant/options/chain", json=request_data)
        
        assert response.status_code == 400
        assert "Invalid symbol" in response.json()["detail"]
        assert "NIFTY and BANKNIFTY" in response.json()["detail"]
    
    def test_empty_contracts_rejection(self):
        """Test that empty contracts list is rejected."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        request_data = {
            "symbol": "NIFTY",
            "expiry": expiry.isoformat() + "Z",
            "spot_price": 21500.0,
            "risk_free_rate": 0.07,
            "contracts": []  # Empty list
        }
        
        response = client.post("/quant/options/chain", json=request_data)
        
        # Pydantic validation returns 422 for min_length constraint
        assert response.status_code == 422
        assert "contracts" in response.json()["detail"][0]["loc"]
    
    def test_liquidity_filtering_liquid_contracts(self):
        """Test liquidity filtering for liquid contracts."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        request_data = {
            "symbol": "NIFTY",
            "expiry": expiry.isoformat() + "Z",
            "spot_price": 21500.0,
            "risk_free_rate": 0.07,
            "contracts": [
                {
                    "strike_price": 21500.0,
                    "option_type": "CALL",
                    "volatility": 0.15,
                    "ltp": 100.0,
                    "open_interest": 15000,  # High OI
                    "volume": 8000,  # High volume
                    "bid": 99.0,
                    "ask": 101.0  # Narrow spread (2%)
                }
            ]
        }
        
        response = client.post("/quant/options/chain", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["liquid_contracts"] == 1
        assert data["illiquid_contracts"] == 0
        assert data["contracts"][0]["is_liquid"] is True
        assert "NONE" in data["contracts"][0]["liquidity_warnings"]
    
    def test_liquidity_filtering_illiquid_contracts(self):
        """Test liquidity filtering for illiquid contracts."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        request_data = {
            "symbol": "NIFTY",
            "expiry": expiry.isoformat() + "Z",
            "spot_price": 21500.0,
            "risk_free_rate": 0.07,
            "contracts": [
                {
                    "strike_price": 22000.0,  # Far OTM
                    "option_type": "CALL",
                    "volatility": 0.20,
                    "ltp": 10.0,
                    "open_interest": 200,  # Very low OI
                    "volume": 50,  # Very low volume
                    "bid": 8.0,
                    "ask": 12.0  # Wide spread (50%)
                }
            ]
        }
        
        response = client.post("/quant/options/chain", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["liquid_contracts"] == 0
        assert data["illiquid_contracts"] == 1
        assert data["contracts"][0]["is_liquid"] is False
        
        # Should have multiple warnings
        warnings = data["contracts"][0]["liquidity_warnings"]
        assert len(warnings) >= 2  # At least 2 warnings for illiquid
        assert "ILLIQUID" in warnings
    
    def test_greeks_calculation_accuracy(self):
        """Test that Greeks are calculated accurately."""
        expiry = datetime.utcnow() + timedelta(days=30)
        
        request_data = {
            "symbol": "NIFTY",
            "expiry": expiry.isoformat() + "Z",
            "spot_price": 21500.0,
            "risk_free_rate": 0.07,
            "contracts": [
                {
                    "strike_price": 21500.0,  # ATM
                    "option_type": "CALL",
                    "volatility": 0.15,
                    "ltp": 100.0,
                    "open_interest": 10000,
                    "volume": 5000,
                    "bid": 98.0,
                    "ask": 102.0
                }
            ]
        }
        
        response = client.post("/quant/options/chain", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        greeks = data["contracts"][0]["greeks"]
        
        # ATM call delta should be around 0.5
        assert 0.4 <= greeks["delta"] <= 0.6
        
        # Gamma should be positive
        assert greeks["gamma"] > 0
        
        # Theta should be negative (time decay)
        assert greeks["theta"] < 0
        
        # Vega should be positive
        assert greeks["vega"] > 0
    
    def test_multiple_contracts_batch_processing(self):
        """Test batch processing of multiple contracts."""
        expiry = datetime.utcnow() + timedelta(days=7)
        
        # Create a realistic options chain with multiple strikes
        contracts = []
        for strike in [21300, 21400, 21500, 21600, 21700]:
            contracts.extend([
                {
                    "strike_price": float(strike),
                    "option_type": "CALL",
                    "volatility": 0.15,
                    "ltp": 100.0,
                    "open_interest": 10000,
                    "volume": 5000,
                    "bid": 98.0,
                    "ask": 102.0
                },
                {
                    "strike_price": float(strike),
                    "option_type": "PUT",
                    "volatility": 0.15,
                    "ltp": 90.0,
                    "open_interest": 10000,
                    "volume": 5000,
                    "bid": 88.0,
                    "ask": 92.0
                }
            ])
        
        request_data = {
            "symbol": "NIFTY",
            "expiry": expiry.isoformat() + "Z",
            "spot_price": 21500.0,
            "risk_free_rate": 0.07,
            "contracts": contracts
        }
        
        response = client.post("/quant/options/chain", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should process all 10 contracts (5 strikes × 2 types)
        assert data["total_contracts"] == 10
        assert len(data["contracts"]) == 10
        
        # All contracts should have Greeks
        for contract in data["contracts"]:
            assert "greeks" in contract
            assert all(k in contract["greeks"] for k in ["delta", "gamma", "theta", "vega"])
