"""
Options Greeks calculator using Black-Scholes model.

This module provides functions to calculate option Greeks (Delta, Gamma, Theta, Vega, Rho)
for European-style options (NIFTY/BANKNIFTY) using the Black-Scholes-Merton model.

Enhanced in Phase 8 (Task 66.2) with optimized batch processing for entire options chains
using vectorized numpy operations for performance with 100+ contracts.
"""

import math
from datetime import datetime
from scipy.stats import norm
import numpy as np


def _calculate_time_to_expiry(expiry_date: datetime) -> float:
    """
    Calculate time to expiry in years.

    Args:
        expiry_date: Option expiry datetime

    Returns:
        Time to expiry in years (fraction)
    """
    # Get current time - make it timezone-aware if expiry_date is timezone-aware
    if (
        expiry_date.tzinfo is not None
        and expiry_date.tzinfo.utcoffset(expiry_date) is not None
    ):
        # expiry_date is timezone-aware, use timezone-aware now
        from datetime import timezone

        now = datetime.now(timezone.utc)
    else:
        # expiry_date is timezone-naive, use timezone-naive now
        now = datetime.utcnow()

    if expiry_date <= now:
        # Option has expired or expires today
        return 1.0 / 365.0  # Use minimum of 1 day to avoid division by zero

    time_delta = expiry_date - now
    days_to_expiry = time_delta.total_seconds() / (24 * 3600)
    return days_to_expiry / 365.0


def _calculate_d1(
    spot_price: float,
    strike_price: float,
    time_to_expiry: float,
    volatility: float,
    risk_free_rate: float,
) -> float:
    """
    Calculate d1 parameter for Black-Scholes model.

    d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)

    Args:
        spot_price: Current price of underlying
        strike_price: Strike price of option
        time_to_expiry: Time to expiry in years
        volatility: Implied volatility (annualized)
        risk_free_rate: Risk-free interest rate (annualized)

    Returns:
        d1 value
    """
    numerator = (
        math.log(spot_price / strike_price)
        + (risk_free_rate + 0.5 * volatility**2) * time_to_expiry
    )
    denominator = volatility * math.sqrt(time_to_expiry)
    return numerator / denominator


def _calculate_d2(d1: float, volatility: float, time_to_expiry: float) -> float:
    """
    Calculate d2 parameter for Black-Scholes model.

    d2 = d1 - σ√T

    Args:
        d1: d1 value from _calculate_d1
        volatility: Implied volatility (annualized)
        time_to_expiry: Time to expiry in years

    Returns:
        d2 value
    """
    return d1 - volatility * math.sqrt(time_to_expiry)


def calculate_delta(
    spot_price: float,
    strike_price: float,
    time_to_expiry: float,
    volatility: float,
    risk_free_rate: float,
    option_type: str,
) -> float:
    """
    Calculate Delta: rate of change of option price with respect to underlying price.

    For CALL: Delta = N(d1)
    For PUT: Delta = N(d1) - 1

    Args:
        spot_price: Current price of underlying
        strike_price: Strike price of option
        time_to_expiry: Time to expiry in years
        volatility: Implied volatility
        risk_free_rate: Risk-free interest rate
        option_type: 'CALL' or 'PUT'

    Returns:
        Delta value (0 to 1 for calls, -1 to 0 for puts)
    """
    d1 = _calculate_d1(
        spot_price, strike_price, time_to_expiry, volatility, risk_free_rate
    )

    if option_type == "CALL":
        return norm.cdf(d1)
    else:  # PUT
        return norm.cdf(d1) - 1.0


def calculate_gamma(
    spot_price: float,
    strike_price: float,
    time_to_expiry: float,
    volatility: float,
    risk_free_rate: float,
) -> float:
    """
    Calculate Gamma: rate of change of delta with respect to underlying price.

    Gamma = φ(d1) / (S * σ * √T)
    where φ(d1) is the standard normal probability density function

    Gamma is the same for calls and puts.

    Args:
        spot_price: Current price of underlying
        strike_price: Strike price of option
        time_to_expiry: Time to expiry in years
        volatility: Implied volatility
        risk_free_rate: Risk-free interest rate

    Returns:
        Gamma value (always positive)
    """
    d1 = _calculate_d1(
        spot_price, strike_price, time_to_expiry, volatility, risk_free_rate
    )

    # Standard normal probability density function
    phi_d1 = norm.pdf(d1)

    gamma = phi_d1 / (spot_price * volatility * math.sqrt(time_to_expiry))
    return gamma


def calculate_theta(
    spot_price: float,
    strike_price: float,
    time_to_expiry: float,
    volatility: float,
    risk_free_rate: float,
    option_type: str,
) -> float:
    """
    Calculate Theta: rate of change of option price with respect to time (per day).

    For CALL:
    Theta = -[S*φ(d1)*σ / (2√T)] - r*K*e^(-rT)*N(d2)

    For PUT:
    Theta = -[S*φ(d1)*σ / (2√T)] + r*K*e^(-rT)*N(-d2)

    Result is annualized, then divided by 365 to get daily theta.

    Args:
        spot_price: Current price of underlying
        strike_price: Strike price of option
        time_to_expiry: Time to expiry in years
        volatility: Implied volatility
        risk_free_rate: Risk-free interest rate
        option_type: 'CALL' or 'PUT'

    Returns:
        Theta value per day (typically negative for long options)
    """
    d1 = _calculate_d1(
        spot_price, strike_price, time_to_expiry, volatility, risk_free_rate
    )
    d2 = _calculate_d2(d1, volatility, time_to_expiry)

    phi_d1 = norm.pdf(d1)
    sqrt_t = math.sqrt(time_to_expiry)

    # First term (common for both call and put)
    first_term = -(spot_price * phi_d1 * volatility) / (2 * sqrt_t)

    # Second term (different for call and put)
    discount_factor = math.exp(-risk_free_rate * time_to_expiry)

    if option_type == "CALL":
        second_term = -risk_free_rate * strike_price * discount_factor * norm.cdf(d2)
        theta_annual = first_term + second_term
    else:  # PUT
        second_term = risk_free_rate * strike_price * discount_factor * norm.cdf(-d2)
        theta_annual = first_term + second_term

    # Convert to daily theta
    return theta_annual / 365.0


def calculate_vega(
    spot_price: float,
    strike_price: float,
    time_to_expiry: float,
    volatility: float,
    risk_free_rate: float,
) -> float:
    """
    Calculate Vega: rate of change of option price with respect to volatility.

    Vega = S * φ(d1) * √T

    Vega is the same for calls and puts.
    Result is per 1% change in volatility (divide by 100 from standard formula).

    Args:
        spot_price: Current price of underlying
        strike_price: Strike price of option
        time_to_expiry: Time to expiry in years
        volatility: Implied volatility
        risk_free_rate: Risk-free interest rate

    Returns:
        Vega value per 1% volatility change (always positive)
    """
    d1 = _calculate_d1(
        spot_price, strike_price, time_to_expiry, volatility, risk_free_rate
    )

    phi_d1 = norm.pdf(d1)
    sqrt_t = math.sqrt(time_to_expiry)

    # Vega per 1% change in volatility
    vega = spot_price * phi_d1 * sqrt_t / 100.0
    return vega


def calculate_rho(
    spot_price: float,
    strike_price: float,
    time_to_expiry: float,
    volatility: float,
    risk_free_rate: float,
    option_type: str,
) -> float:
    """
    Calculate Rho: rate of change of option price with respect to interest rate.

    For CALL:
    Rho = K * T * e^(-rT) * N(d2)

    For PUT:
    Rho = -K * T * e^(-rT) * N(-d2)

    Result is per 1% change in interest rate (divide by 100 from standard formula).

    Args:
        spot_price: Current price of underlying
        strike_price: Strike price of option
        time_to_expiry: Time to expiry in years
        volatility: Implied volatility
        risk_free_rate: Risk-free interest rate
        option_type: 'CALL' or 'PUT'

    Returns:
        Rho value per 1% rate change (positive for calls, negative for puts)
    """
    d1 = _calculate_d1(
        spot_price, strike_price, time_to_expiry, volatility, risk_free_rate
    )
    d2 = _calculate_d2(d1, volatility, time_to_expiry)

    discount_factor = math.exp(-risk_free_rate * time_to_expiry)

    if option_type == "CALL":
        rho = strike_price * time_to_expiry * discount_factor * norm.cdf(d2) / 100.0
    else:  # PUT
        rho = -strike_price * time_to_expiry * discount_factor * norm.cdf(-d2) / 100.0

    return rho


def calculate_greeks(
    spot_price: float,
    strike_price: float,
    expiry_date: datetime,
    volatility: float,
    risk_free_rate: float,
    option_type: str,
) -> dict:
    """
    Calculate all Greeks for an option using Black-Scholes model.

    This is the main function for calculating option Greeks. It computes:
    - Delta: sensitivity to underlying price
    - Gamma: sensitivity of delta to underlying price
    - Theta: time decay (per day)
    - Vega: sensitivity to volatility (per 1%)
    - Rho: sensitivity to interest rate (per 1%)

    Args:
        spot_price: Current price of underlying asset
        strike_price: Strike price of the option
        expiry_date: Option expiry datetime
        volatility: Implied volatility (as decimal, e.g., 0.15 for 15%)
        risk_free_rate: Risk-free interest rate (as decimal, e.g., 0.07 for 7%)
        option_type: 'CALL' or 'PUT'

    Returns:
        Dictionary containing all Greeks:
        {
            'delta': float,
            'gamma': float,
            'theta': float,
            'vega': float,
            'rho': float
        }

    Example:
        >>> from datetime import datetime, timedelta
        >>> expiry = datetime.utcnow() + timedelta(days=30)
        >>> greeks = calculate_greeks(
        ...     spot_price=21500.0,
        ...     strike_price=21600.0,
        ...     expiry_date=expiry,
        ...     volatility=0.15,
        ...     risk_free_rate=0.07,
        ...     option_type='CALL'
        ... )
        >>> print(f"Delta: {greeks['delta']:.4f}")
    """
    # Calculate time to expiry
    time_to_expiry = _calculate_time_to_expiry(expiry_date)

    # Calculate all Greeks
    delta = calculate_delta(
        spot_price,
        strike_price,
        time_to_expiry,
        volatility,
        risk_free_rate,
        option_type,
    )

    gamma = calculate_gamma(
        spot_price, strike_price, time_to_expiry, volatility, risk_free_rate
    )

    theta = calculate_theta(
        spot_price,
        strike_price,
        time_to_expiry,
        volatility,
        risk_free_rate,
        option_type,
    )

    vega = calculate_vega(
        spot_price, strike_price, time_to_expiry, volatility, risk_free_rate
    )

    rho = calculate_rho(
        spot_price,
        strike_price,
        time_to_expiry,
        volatility,
        risk_free_rate,
        option_type,
    )

    return {
        "delta": delta,
        "gamma": gamma,
        "theta": theta,
        "vega": vega,
        "rho": rho,
    }


def calculate_greeks_batch(
    spot_price: float,
    contracts: list,
    risk_free_rate: float = 0.07,
) -> list:
    """
    Calculate Greeks for multiple option contracts simultaneously (batch processing).

    This function is optimized for calculating Greeks for entire options chains
    (100+ contracts) efficiently using vectorized numpy operations. It processes 
    all contracts in a single pass, calculating only the basic Greeks: 
    Delta, Gamma, Theta, Vega.

    Enhanced in Phase 8 (Task 66.2) with vectorized calculations for better
    performance on large options chains (100+ contracts).

    Note: Rho is NOT calculated in batch mode as it's less relevant for
    NIFTY/BANKNIFTY options scalping. If needed, use calculate_greeks() for
    individual contracts.

    Args:
        spot_price: Current price of underlying asset
        contracts: List of contract dictionaries, each containing:
            - strike_price: float
            - expiry_date: datetime
            - volatility: float (implied volatility as decimal)
            - option_type: str ('CALL' or 'PUT')
        risk_free_rate: Risk-free interest rate (as decimal, default: 0.07)

    Returns:
        List of dictionaries, each containing:
        {
            'strike_price': float,
            'expiry_date': datetime,
            'option_type': str,
            'delta': float,
            'gamma': float,
            'theta': float,
            'vega': float
        }

    Example:
        >>> from datetime import datetime, timedelta
        >>> expiry = datetime.utcnow() + timedelta(days=7)
        >>> contracts = [
        ...     {
        ...         'strike_price': 21500.0,
        ...         'expiry_date': expiry,
        ...         'volatility': 0.15,
        ...         'option_type': 'CALL'
        ...     },
        ...     {
        ...         'strike_price': 21500.0,
        ...         'expiry_date': expiry,
        ...         'volatility': 0.15,
        ...         'option_type': 'PUT'
        ...     },
        ...     {
        ...         'strike_price': 21600.0,
        ...         'expiry_date': expiry,
        ...         'volatility': 0.16,
        ...         'option_type': 'CALL'
        ...     }
        ... ]
        >>> results = calculate_greeks_batch(
        ...     spot_price=21500.0,
        ...     contracts=contracts
        ... )
        >>> print(f"Calculated Greeks for {len(results)} contracts")
    """
    # Handle empty contracts list
    if not contracts:
        return []

    # Extract all contract parameters into numpy arrays for vectorized operations
    n_contracts = len(contracts)
    strike_prices = np.array([c["strike_price"] for c in contracts])
    volatilities = np.array([c["volatility"] for c in contracts])
    option_types = [c["option_type"] for c in contracts]  # Keep as list for string comparison
    expiry_dates = [c["expiry_date"] for c in contracts]  # Keep as list for datetime

    # Calculate time to expiry for all contracts (vectorized where possible)
    times_to_expiry = np.array([_calculate_time_to_expiry(exp) for exp in expiry_dates])

    # Vectorized Black-Scholes calculations
    # Calculate d1 for all contracts simultaneously
    # d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
    log_spot_strike = np.log(spot_price / strike_prices)
    variance_time = (risk_free_rate + 0.5 * volatilities**2) * times_to_expiry
    vol_sqrt_time = volatilities * np.sqrt(times_to_expiry)
    
    d1_values = (log_spot_strike + variance_time) / vol_sqrt_time
    
    # Calculate d2 for all contracts
    # d2 = d1 - σ√T
    d2_values = d1_values - vol_sqrt_time

    # Calculate standard normal CDF and PDF for all d1/d2 values
    N_d1 = norm.cdf(d1_values)
    N_d2 = norm.cdf(d2_values)
    N_neg_d1 = norm.cdf(-d1_values)
    N_neg_d2 = norm.cdf(-d2_values)
    phi_d1 = norm.pdf(d1_values)

    # Calculate Delta (vectorized for CALL, then adjust for PUT)
    deltas = np.where(
        np.array([ot == "CALL" for ot in option_types]),
        N_d1,  # CALL: N(d1)
        N_d1 - 1.0  # PUT: N(d1) - 1
    )

    # Calculate Gamma (same for CALL and PUT)
    # Gamma = φ(d1) / (S * σ * √T)
    gammas = phi_d1 / (spot_price * vol_sqrt_time)

    # Calculate Theta (different for CALL and PUT)
    # First term (common for both)
    sqrt_t = np.sqrt(times_to_expiry)
    first_term = -(spot_price * phi_d1 * volatilities) / (2 * sqrt_t)
    
    # Second term (different for CALL and PUT)
    discount_factor = np.exp(-risk_free_rate * times_to_expiry)
    
    thetas_call = first_term - risk_free_rate * strike_prices * discount_factor * N_d2
    thetas_put = first_term + risk_free_rate * strike_prices * discount_factor * N_neg_d2
    
    # Select appropriate theta based on option type
    thetas = np.where(
        np.array([ot == "CALL" for ot in option_types]),
        thetas_call,
        thetas_put
    )
    # Convert to daily theta
    thetas = thetas / 365.0

    # Calculate Vega (same for CALL and PUT)
    # Vega = S * φ(d1) * √T / 100
    vegas = spot_price * phi_d1 * sqrt_t / 100.0

    # Build results list
    results = []
    for i in range(n_contracts):
        results.append({
            "strike_price": float(strike_prices[i]),
            "expiry_date": expiry_dates[i],
            "option_type": option_types[i],
            "delta": float(deltas[i]),
            "gamma": float(gammas[i]),
            "theta": float(thetas[i]),
            "vega": float(vegas[i]),
        })

    return results
