"""
Example demonstration of Options Greeks calculator.

This script shows how to calculate Greeks for NIFTY and BANKNIFTY options.
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from calculators.greeks import calculate_greeks


def main():
    """Demonstrate Greeks calculation for NIFTY and BANKNIFTY options."""

    print("=" * 70)
    print("Options Greeks Calculator - Black-Scholes Model")
    print("=" * 70)
    print()

    # Example 1: NIFTY Weekly ATM Call
    print("Example 1: NIFTY Weekly ATM Call")
    print("-" * 70)
    expiry_weekly = datetime.utcnow() + timedelta(days=7)
    nifty_call = calculate_greeks(
        spot_price=21500.0,
        strike_price=21500.0,  # ATM
        expiry_date=expiry_weekly,
        volatility=0.12,
        risk_free_rate=0.07,
        option_type="CALL",
    )

    print(f"Spot Price:    ₹21,500")
    print(f"Strike Price:  ₹21,500 (ATM)")
    print(f"Days to Expiry: 7")
    print(f"Volatility:    12%")
    print(f"\nGreeks:")
    print(
        f"  Delta: {nifty_call['delta']:.4f}  (Price change per ₹1 move in underlying)"
    )
    print(
        f"  Gamma: {nifty_call['gamma']:.6f}  (Delta change per ₹1 move in underlying)"
    )
    print(f"  Theta: {nifty_call['theta']:.2f}  (Daily time decay in ₹)")
    print(
        f"  Vega:  {nifty_call['vega']:.2f}  (Price change per 1% volatility increase)"
    )
    print(f"  Rho:   {nifty_call['rho']:.2f}  (Price change per 1% rate increase)")
    print()

    # Example 2: BANKNIFTY Monthly OTM Call
    print("Example 2: BANKNIFTY Monthly OTM Call")
    print("-" * 70)
    expiry_monthly = datetime.utcnow() + timedelta(days=30)
    banknifty_call = calculate_greeks(
        spot_price=45000.0,
        strike_price=45500.0,  # OTM
        expiry_date=expiry_monthly,
        volatility=0.18,
        risk_free_rate=0.07,
        option_type="CALL",
    )

    print(f"Spot Price:    ₹45,000")
    print(f"Strike Price:  ₹45,500 (OTM)")
    print(f"Days to Expiry: 30")
    print(f"Volatility:    18%")
    print(f"\nGreeks:")
    print(
        f"  Delta: {banknifty_call['delta']:.4f}  (Price change per ₹1 move in underlying)"
    )
    print(
        f"  Gamma: {banknifty_call['gamma']:.6f}  (Delta change per ₹1 move in underlying)"
    )
    print(f"  Theta: {banknifty_call['theta']:.2f}  (Daily time decay in ₹)")
    print(
        f"  Vega:  {banknifty_call['vega']:.2f}  (Price change per 1% volatility increase)"
    )
    print(f"  Rho:   {banknifty_call['rho']:.2f}  (Price change per 1% rate increase)")
    print()

    # Example 3: NIFTY ITM Put
    print("Example 3: NIFTY Monthly ITM Put")
    print("-" * 70)
    nifty_put = calculate_greeks(
        spot_price=21500.0,
        strike_price=21800.0,  # ITM Put
        expiry_date=expiry_monthly,
        volatility=0.15,
        risk_free_rate=0.07,
        option_type="PUT",
    )

    print(f"Spot Price:    ₹21,500")
    print(f"Strike Price:  ₹21,800 (ITM)")
    print(f"Days to Expiry: 30")
    print(f"Volatility:    15%")
    print(f"\nGreeks:")
    print(
        f"  Delta: {nifty_put['delta']:.4f}  (Price change per ₹1 move in underlying)"
    )
    print(
        f"  Gamma: {nifty_put['gamma']:.6f}  (Delta change per ₹1 move in underlying)"
    )
    print(f"  Theta: {nifty_put['theta']:.2f}  (Daily time decay in ₹)")
    print(
        f"  Vega:  {nifty_put['vega']:.2f}  (Price change per 1% volatility increase)"
    )
    print(f"  Rho:   {nifty_put['rho']:.2f}  (Price change per 1% rate increase)")
    print()

    print("=" * 70)
    print("Key Insights:")
    print("=" * 70)
    print("• Delta: ATM options have ~0.5 delta, ITM closer to 1, OTM closer to 0")
    print("• Gamma: Highest for ATM options, showing maximum delta sensitivity")
    print("• Theta: Always negative for long options, increases near expiry")
    print("• Vega: Highest for ATM options with longer time to expiry")
    print("• Rho: Positive for calls, negative for puts")
    print()


if __name__ == "__main__":
    main()
