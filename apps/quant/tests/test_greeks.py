"""
Unit tests for Options Greeks calculator.

Tests the Black-Scholes Greeks calculations for CALL and PUT options
on NIFTY/BANKNIFTY indices.
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

calculate_greeks = greeks_module.calculate_greeks
calculate_delta = greeks_module.calculate_delta
calculate_gamma = greeks_module.calculate_gamma
calculate_theta = greeks_module.calculate_theta
calculate_vega = greeks_module.calculate_vega
calculate_rho = greeks_module.calculate_rho
_calculate_time_to_expiry = greeks_module._calculate_time_to_expiry
_calculate_d1 = greeks_module._calculate_d1
_calculate_d2 = greeks_module._calculate_d2


class TestTimeToExpiry:
    """Test time to expiry calculation."""

    def test_future_expiry(self):
        """Test time to expiry for future date."""
        expiry = datetime.utcnow() + timedelta(days=30)
        time_to_expiry = _calculate_time_to_expiry(expiry)

        # Should be approximately 30/365 years
        assert 0.08 < time_to_expiry < 0.09  # ~30 days

    def test_past_expiry(self):
        """Test time to expiry for past date (expired option)."""
        expiry = datetime.utcnow() - timedelta(days=5)
        time_to_expiry = _calculate_time_to_expiry(expiry)

        # Should return minimum of 1 day
        assert time_to_expiry == 1.0 / 365.0

    def test_today_expiry(self):
        """Test time to expiry for today (edge case)."""
        expiry = datetime.utcnow()
        time_to_expiry = _calculate_time_to_expiry(expiry)

        # Should return minimum of 1 day
        assert time_to_expiry == 1.0 / 365.0

    def test_one_year_expiry(self):
        """Test time to expiry for one year ahead."""
        expiry = datetime.utcnow() + timedelta(days=365)
        time_to_expiry = _calculate_time_to_expiry(expiry)

        # Should be approximately 1 year
        assert 0.99 < time_to_expiry < 1.01


class TestBlackScholesParameters:
    """Test d1 and d2 parameter calculations."""

    def test_d1_calculation(self):
        """Test d1 parameter calculation."""
        d1 = _calculate_d1(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        # d1 should be a finite number
        assert isinstance(d1, float)
        assert not (d1 != d1)  # Not NaN
        assert abs(d1) < 10  # Reasonable range

    def test_d2_calculation(self):
        """Test d2 parameter calculation."""
        d1 = 0.5
        d2 = _calculate_d2(d1=d1, volatility=0.15, time_to_expiry=30.0 / 365.0)

        # d2 = d1 - σ√T
        expected_d2 = d1 - 0.15 * (30.0 / 365.0) ** 0.5
        assert abs(d2 - expected_d2) < 1e-10

    def test_d1_atm_option(self):
        """Test d1 for at-the-money option (spot = strike)."""
        d1 = _calculate_d1(
            spot_price=21500.0,
            strike_price=21500.0,  # ATM
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        # For ATM, d1 should be positive (due to risk-free rate component)
        assert d1 > 0


class TestDelta:
    """Test Delta calculation for CALL and PUT options."""

    def test_call_delta_range(self):
        """Test that CALL delta is between 0 and 1."""
        delta = calculate_delta(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        assert 0 <= delta <= 1

    def test_put_delta_range(self):
        """Test that PUT delta is between -1 and 0."""
        delta = calculate_delta(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="PUT",
        )

        assert -1 <= delta <= 0

    def test_call_delta_deep_itm(self):
        """Test that deep ITM CALL has delta close to 1."""
        delta = calculate_delta(
            spot_price=22000.0,  # Deep ITM
            strike_price=21000.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Deep ITM call should have high delta (>0.85)
        assert delta > 0.85

    def test_call_delta_deep_otm(self):
        """Test that deep OTM CALL has delta close to 0."""
        delta = calculate_delta(
            spot_price=21000.0,  # Deep OTM
            strike_price=22000.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Deep OTM call should have low delta (<0.20)
        assert delta < 0.20

    def test_atm_call_delta(self):
        """Test that ATM CALL has delta around 0.5."""
        delta = calculate_delta(
            spot_price=21500.0,
            strike_price=21500.0,  # ATM
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # ATM call delta should be around 0.5 (0.48-0.57 range due to risk-free rate and time)
        assert 0.48 < delta < 0.57


class TestGamma:
    """Test Gamma calculation."""

    def test_gamma_positive(self):
        """Test that Gamma is always positive."""
        gamma = calculate_gamma(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        assert gamma > 0

    def test_gamma_atm_highest(self):
        """Test that Gamma is highest for ATM options."""
        gamma_atm = calculate_gamma(
            spot_price=21500.0,
            strike_price=21500.0,  # ATM
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        gamma_otm = calculate_gamma(
            spot_price=21500.0,
            strike_price=22000.0,  # OTM
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        # ATM gamma should be higher than OTM gamma
        assert gamma_atm > gamma_otm

    def test_gamma_same_for_call_and_put(self):
        """Test that Gamma is the same for CALL and PUT at same strike."""
        # Gamma doesn't depend on option type
        gamma_call = calculate_gamma(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        gamma_put = calculate_gamma(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        assert abs(gamma_call - gamma_put) < 1e-10


class TestTheta:
    """Test Theta calculation for CALL and PUT options."""

    def test_call_theta_negative(self):
        """Test that CALL theta is typically negative (time decay)."""
        theta = calculate_theta(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Long options lose value over time
        assert theta < 0

    def test_put_theta_negative(self):
        """Test that PUT theta is typically negative (time decay)."""
        theta = calculate_theta(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="PUT",
        )

        # Long options lose value over time
        assert theta < 0

    def test_theta_increases_near_expiry(self):
        """Test that theta magnitude increases as expiry approaches."""
        theta_30d = calculate_theta(
            spot_price=21500.0,
            strike_price=21500.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        theta_5d = calculate_theta(
            spot_price=21500.0,
            strike_price=21500.0,
            time_to_expiry=5.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Theta magnitude should be larger closer to expiry
        assert abs(theta_5d) > abs(theta_30d)


class TestVega:
    """Test Vega calculation."""

    def test_vega_positive(self):
        """Test that Vega is always positive."""
        vega = calculate_vega(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        assert vega > 0

    def test_vega_atm_highest(self):
        """Test that Vega is highest for ATM options."""
        vega_atm = calculate_vega(
            spot_price=21500.0,
            strike_price=21500.0,  # ATM
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        vega_otm = calculate_vega(
            spot_price=21500.0,
            strike_price=22000.0,  # OTM
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        # ATM vega should be higher than OTM vega
        assert vega_atm > vega_otm

    def test_vega_same_for_call_and_put(self):
        """Test that Vega is the same for CALL and PUT at same strike."""
        # Vega doesn't depend on option type
        vega_call = calculate_vega(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        vega_put = calculate_vega(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
        )

        assert abs(vega_call - vega_put) < 1e-10


class TestRho:
    """Test Rho calculation for CALL and PUT options."""

    def test_call_rho_positive(self):
        """Test that CALL rho is positive."""
        rho = calculate_rho(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Call options benefit from higher interest rates
        assert rho > 0

    def test_put_rho_negative(self):
        """Test that PUT rho is negative."""
        rho = calculate_rho(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="PUT",
        )

        # Put options lose value with higher interest rates
        assert rho < 0

    def test_rho_call_put_relationship(self):
        """Test the relationship between CALL and PUT rho."""
        rho_call = calculate_rho(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        rho_put = calculate_rho(
            spot_price=21500.0,
            strike_price=21600.0,
            time_to_expiry=30.0 / 365.0,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="PUT",
        )

        # Rho for call should be positive, for put should be negative
        assert rho_call > 0
        assert rho_put < 0


class TestCalculateGreeksIntegration:
    """Test the main calculate_greeks function."""

    def test_calculate_greeks_call(self):
        """Test calculating all Greeks for a CALL option."""
        expiry = datetime.utcnow() + timedelta(days=30)
        greeks = calculate_greeks(
            spot_price=21500.0,
            strike_price=21600.0,
            expiry_date=expiry,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Check all Greeks are present
        assert "delta" in greeks
        assert "gamma" in greeks
        assert "theta" in greeks
        assert "vega" in greeks
        assert "rho" in greeks

        # Check CALL Greek properties
        assert 0 <= greeks["delta"] <= 1
        assert greeks["gamma"] > 0
        assert greeks["theta"] < 0
        assert greeks["vega"] > 0
        assert greeks["rho"] > 0

    def test_calculate_greeks_put(self):
        """Test calculating all Greeks for a PUT option."""
        expiry = datetime.utcnow() + timedelta(days=30)
        greeks = calculate_greeks(
            spot_price=21500.0,
            strike_price=21600.0,
            expiry_date=expiry,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="PUT",
        )

        # Check all Greeks are present
        assert "delta" in greeks
        assert "gamma" in greeks
        assert "theta" in greeks
        assert "vega" in greeks
        assert "rho" in greeks

        # Check PUT Greek properties
        assert -1 <= greeks["delta"] <= 0
        assert greeks["gamma"] > 0
        assert greeks["theta"] < 0
        assert greeks["vega"] > 0
        assert greeks["rho"] < 0

    def test_calculate_greeks_nifty(self):
        """Test Greeks calculation for NIFTY options."""
        expiry = datetime.utcnow() + timedelta(days=7)  # Weekly expiry
        greeks = calculate_greeks(
            spot_price=21500.0,
            strike_price=21500.0,  # ATM
            expiry_date=expiry,
            volatility=0.12,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # ATM weekly option characteristics
        assert 0.45 < greeks["delta"] < 0.55  # Around 0.5 for ATM
        assert greeks["gamma"] > 0
        assert greeks["theta"] < 0
        assert greeks["vega"] > 0
        assert greeks["rho"] > 0

    def test_calculate_greeks_banknifty(self):
        """Test Greeks calculation for BANKNIFTY options."""
        expiry = datetime.utcnow() + timedelta(days=14)  # Bi-weekly
        greeks = calculate_greeks(
            spot_price=45000.0,
            strike_price=45500.0,  # OTM CALL
            expiry_date=expiry,
            volatility=0.18,  # Higher volatility for BANKNIFTY
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # OTM call characteristics
        assert greeks["delta"] < 0.5  # Less than 0.5 for OTM
        assert greeks["gamma"] > 0
        assert greeks["theta"] < 0
        assert greeks["vega"] > 0
        assert greeks["rho"] > 0

    def test_calculate_greeks_different_volatilities(self):
        """Test Greeks with different volatility levels."""
        expiry = datetime.utcnow() + timedelta(days=30)

        greeks_low_vol = calculate_greeks(
            spot_price=21500.0,
            strike_price=21500.0,
            expiry_date=expiry,
            volatility=0.10,  # Low volatility
            risk_free_rate=0.07,
            option_type="CALL",
        )

        greeks_high_vol = calculate_greeks(
            spot_price=21500.0,
            strike_price=21500.0,
            expiry_date=expiry,
            volatility=0.25,  # High volatility
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Higher volatility should result in higher vega
        assert greeks_high_vol["vega"] > greeks_low_vol["vega"]

    def test_calculate_greeks_expired_option(self):
        """Test Greeks calculation for expired option."""
        expiry = datetime.utcnow() - timedelta(days=5)  # Expired
        greeks = calculate_greeks(
            spot_price=21500.0,
            strike_price=21600.0,
            expiry_date=expiry,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Expired options still return valid Greeks (using minimum 1 day)
        assert "delta" in greeks
        assert "gamma" in greeks
        assert "theta" in greeks
        assert "vega" in greeks
        assert "rho" in greeks


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_very_low_volatility(self):
        """Test with very low volatility."""
        expiry = datetime.utcnow() + timedelta(days=30)
        greeks = calculate_greeks(
            spot_price=21500.0,
            strike_price=21600.0,
            expiry_date=expiry,
            volatility=0.01,  # 1% volatility
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Should still return valid Greeks
        assert all(key in greeks for key in ["delta", "gamma", "theta", "vega", "rho"])

    def test_very_high_volatility(self):
        """Test with very high volatility."""
        expiry = datetime.utcnow() + timedelta(days=30)
        greeks = calculate_greeks(
            spot_price=21500.0,
            strike_price=21600.0,
            expiry_date=expiry,
            volatility=1.0,  # 100% volatility
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Should still return valid Greeks
        assert all(key in greeks for key in ["delta", "gamma", "theta", "vega", "rho"])

    def test_zero_risk_free_rate(self):
        """Test with zero risk-free rate."""
        expiry = datetime.utcnow() + timedelta(days=30)
        greeks = calculate_greeks(
            spot_price=21500.0,
            strike_price=21600.0,
            expiry_date=expiry,
            volatility=0.15,
            risk_free_rate=0.0,  # Zero rate
            option_type="CALL",
        )

        # Should still return valid Greeks
        assert all(key in greeks for key in ["delta", "gamma", "theta", "vega", "rho"])

    def test_deep_itm_call(self):
        """Test deep in-the-money CALL option."""
        expiry = datetime.utcnow() + timedelta(days=30)
        greeks = calculate_greeks(
            spot_price=25000.0,
            strike_price=20000.0,  # Deep ITM
            expiry_date=expiry,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="CALL",
        )

        # Deep ITM call should have delta close to 1
        assert greeks["delta"] > 0.95

    def test_deep_otm_put(self):
        """Test deep out-of-the-money PUT option."""
        expiry = datetime.utcnow() + timedelta(days=30)
        greeks = calculate_greeks(
            spot_price=25000.0,
            strike_price=20000.0,  # Deep OTM for PUT
            expiry_date=expiry,
            volatility=0.15,
            risk_free_rate=0.07,
            option_type="PUT",
        )

        # Deep OTM put should have delta close to 0
        assert abs(greeks["delta"]) < 0.05
