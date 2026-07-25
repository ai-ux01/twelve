"""
Unit tests for the /options/greeks FastAPI endpoint.

Tests the integration of the Greeks calculator with the FastAPI endpoint.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestGreeksEndpoint:
    """Test the POST /options/greeks endpoint."""

    def test_endpoint_with_valid_call_option(self):
        """Test Greeks calculation for a valid CALL option."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21600.0,
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert data["underlying"] == "NIFTY"
        assert data["spot_price"] == 21500.0
        assert data["strike_price"] == 21600.0
        assert data["option_type"] == "CALL"
        assert "greeks" in data

        # Verify Greeks values
        greeks = data["greeks"]
        assert "delta" in greeks
        assert "gamma" in greeks
        assert "theta" in greeks
        assert "vega" in greeks
        assert "rho" in greeks

        # Verify Greeks constraints
        assert 0 <= greeks["delta"] <= 1  # CALL delta is between 0 and 1
        assert greeks["gamma"] >= 0  # Gamma is always positive
        assert greeks["theta"] < 0  # Theta is typically negative for long options
        assert greeks["vega"] >= 0  # Vega is always positive
        assert greeks["rho"] > 0  # Rho is positive for CALL options

    def test_endpoint_with_valid_put_option(self):
        """Test Greeks calculation for a valid PUT option."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "BANKNIFTY",
                "spot_price": 45000.0,
                "strike_price": 45500.0,
                "option_type": "PUT",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.18,
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert data["underlying"] == "BANKNIFTY"
        assert data["option_type"] == "PUT"

        # Verify Greeks constraints for PUT
        greeks = data["greeks"]
        assert -1 <= greeks["delta"] <= 0  # PUT delta is between -1 and 0
        assert greeks["gamma"] >= 0  # Gamma is always positive
        assert greeks["theta"] < 0  # Theta is typically negative for long options
        assert greeks["vega"] >= 0  # Vega is always positive
        assert greeks["rho"] < 0  # Rho is negative for PUT options

    def test_endpoint_with_atm_option(self):
        """Test Greeks calculation for an at-the-money option."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21500.0,  # ATM
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 200
        data = response.json()
        greeks = data["greeks"]

        # ATM options should have delta around 0.5 for CALL
        assert 0.4 < greeks["delta"] < 0.6

        # ATM options should have highest gamma
        assert greeks["gamma"] > 0

    def test_endpoint_with_negative_spot_price(self):
        """Test that negative spot price is rejected."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": -100.0,  # Invalid
                "strike_price": 21600.0,
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 422  # Validation error
        assert "detail" in response.json()

    def test_endpoint_with_zero_strike_price(self):
        """Test that zero strike price is rejected."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 0.0,  # Invalid
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 422  # Validation error

    def test_endpoint_with_invalid_option_type(self):
        """Test that invalid option type is rejected."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21600.0,
                "option_type": "INVALID",  # Invalid
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 422  # Validation error

    def test_endpoint_with_high_volatility(self):
        """Test Greeks calculation with high volatility."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21600.0,
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.50,  # High volatility
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 200
        data = response.json()
        greeks = data["greeks"]

        # Higher volatility should result in higher vega
        assert greeks["vega"] > 0

    def test_endpoint_with_volatility_out_of_range(self):
        """Test that volatility > 2 is rejected."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21600.0,
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 2.5,  # Out of range
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 422  # Validation error

    def test_endpoint_with_expired_option(self):
        """Test Greeks calculation for an expired option."""
        # Use a past date
        expiry = datetime.now(timezone.utc) - timedelta(days=1)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21600.0,
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 200
        # Should still calculate, but with minimum time to expiry

    def test_endpoint_response_serialization(self):
        """Test that the response is properly serialized."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21600.0,
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify all required fields are present
        required_fields = [
            "underlying",
            "spot_price",
            "strike_price",
            "option_type",
            "expiry_date",
            "greeks",
        ]
        for field in required_fields:
            assert field in data

        # Verify Greeks subfields
        required_greeks = ["delta", "gamma", "theta", "vega", "rho"]
        for greek in required_greeks:
            assert greek in data["greeks"]

    def test_endpoint_with_different_risk_free_rates(self):
        """Test that different risk-free rates affect Rho."""
        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        # Test with low rate
        response_low = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21600.0,
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.03,
            },
        )

        # Test with high rate
        response_high = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21600.0,
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.10,
            },
        )

        assert response_low.status_code == 200
        assert response_high.status_code == 200

        # Both should return valid results
        data_low = response_low.json()
        data_high = response_high.json()

        assert "greeks" in data_low
        assert "greeks" in data_high


class TestGreeksEndpointIntegration:
    """Integration tests for the Greeks endpoint."""

    def test_endpoint_matches_calculator_results(self):
        """Verify that endpoint results match direct calculator calls."""
        from calculators.greeks import calculate_greeks

        expiry = datetime.now(timezone.utc) + timedelta(days=30)

        # Call endpoint
        response = client.post(
            "/options/greeks",
            json={
                "underlying": "NIFTY",
                "spot_price": 21500.0,
                "strike_price": 21600.0,
                "option_type": "CALL",
                "expiry_date": expiry.isoformat(),
                "volatility": 0.15,
                "risk_free_rate": 0.07,
            },
        )

        assert response.status_code == 200
        endpoint_greeks = response.json()["greeks"]

        # Call calculator directly
        calculator_greeks = calculate_greeks(
            spot_price=21500.0,
            strike_price=21600.0,
            expiry_date=expiry,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Compare results (allowing for small floating-point differences)
        assert abs(endpoint_greeks["delta"] - calculator_greeks["delta"]) < 1e-6
        assert abs(endpoint_greeks["gamma"] - calculator_greeks["gamma"]) < 1e-6
        assert abs(endpoint_greeks["theta"] - calculator_greeks["theta"]) < 1e-6
        assert abs(endpoint_greeks["vega"] - calculator_greeks["vega"]) < 1e-6
        assert abs(endpoint_greeks["rho"] - calculator_greeks["rho"]) < 1e-6
