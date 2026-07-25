"""
Demo script for VWAP (Volume Weighted Average Price) calculator.

This script demonstrates how to use the VWAP calculator with sample intraday data.
"""

from calculators.vwap import (
    calculate_vwap,
    calculate_vwap_series,
    calculate_vwap_with_bands,
)


def main():
    print("=" * 70)
    print("VWAP Calculator Demo")
    print("=" * 70)

    # Sample intraday data (simulating a trading session)
    print("\nSample intraday data:")
    highs = [100.5, 101.2, 102.1, 101.8, 103.0, 102.5, 104.0, 103.8, 105.0, 104.5]
    lows = [99.8, 100.5, 101.0, 100.8, 101.5, 101.8, 102.5, 103.0, 103.5, 103.8]
    closes = [100.2, 100.9, 101.5, 101.2, 102.3, 102.0, 103.2, 103.5, 104.3, 104.0]
    volumes = [
        10000,
        15000,
        12000,
        18000,
        20000,
        16000,
        22000,
        19000,
        25000,
        21000,
    ]

    print(f"Number of periods: {len(closes)}")
    print(f"Price range: {min(lows):.2f} - {max(highs):.2f}")
    print(f"Total volume: {sum(volumes):,}")

    # Calculate current VWAP
    print("\n" + "=" * 70)
    print("1. Current VWAP Calculation")
    print("=" * 70)
    vwap = calculate_vwap(highs, lows, closes, volumes)
    print(f"Current VWAP: ${vwap:.2f}")
    print(f"Current Price: ${closes[-1]:.2f}")

    if closes[-1] > vwap:
        print(f"Price is ${closes[-1] - vwap:.2f} ABOVE VWAP (bullish signal)")
    else:
        print(f"Price is ${vwap - closes[-1]:.2f} BELOW VWAP (bearish signal)")

    # Calculate VWAP series
    print("\n" + "=" * 70)
    print("2. VWAP Series (entire session)")
    print("=" * 70)
    vwap_series = calculate_vwap_series(highs, lows, closes, volumes)

    print("Period | Close  | VWAP   | Position")
    print("-------|--------|--------|----------")
    for i, (close, vwap_val) in enumerate(zip(closes, vwap_series), 1):
        position = "Above" if close > vwap_val else "Below"
        print(f"   {i:2d}  | {close:6.2f} | {vwap_val:6.2f} | {position}")

    # Calculate VWAP with bands
    print("\n" + "=" * 70)
    print("3. VWAP with Bands (1 standard deviation)")
    print("=" * 70)
    vwap, upper_band, lower_band = calculate_vwap_with_bands(
        highs, lows, closes, volumes, num_std_dev=1.0
    )

    print(f"Upper Band: ${upper_band:.2f}")
    print(f"VWAP:       ${vwap:.2f}")
    print(f"Lower Band: ${lower_band:.2f}")
    print(f"Band Width: ${upper_band - lower_band:.2f}")

    current_price = closes[-1]
    if current_price > upper_band:
        print(
            f"\nCurrent price (${current_price:.2f}) is above upper band "
            f"(potentially overbought)"
        )
    elif current_price < lower_band:
        print(
            f"\nCurrent price (${current_price:.2f}) is below lower band "
            f"(potentially oversold)"
        )
    else:
        print(
            f"\nCurrent price (${current_price:.2f}) is within bands " f"(normal range)"
        )

    # Demo with session resets
    print("\n" + "=" * 70)
    print("4. VWAP with Session Reset")
    print("=" * 70)

    # Extended data with a session reset in the middle
    extended_highs = highs + [105.5, 106.0, 107.0, 106.5]
    extended_lows = lows + [104.8, 105.0, 105.5, 105.8]
    extended_closes = closes + [105.2, 105.7, 106.3, 106.0]
    extended_volumes = volumes + [18000, 20000, 23000, 19000]

    # Mark position 10 as a new session start (e.g., market reopening)
    session_starts = [True] + [False] * 9 + [True] + [False] * 3

    print("Session 1: Periods 1-10")
    print("Session 2: Periods 11-14 (NEW SESSION)")

    vwap_with_reset = calculate_vwap(
        extended_highs, extended_lows, extended_closes, extended_volumes, session_starts
    )
    print(f"\nCurrent VWAP (after reset): ${vwap_with_reset:.2f}")
    print(
        "Note: VWAP was reset at the start of session 2, "
        "so it only considers data from period 11 onwards"
    )

    # Calculate VWAP without reset for comparison
    vwap_no_reset = calculate_vwap(
        extended_highs, extended_lows, extended_closes, extended_volumes
    )
    print(f"VWAP without reset: ${vwap_no_reset:.2f}")
    print(
        f"Difference: ${abs(vwap_with_reset - vwap_no_reset):.2f} "
        f"(shows impact of session reset)"
    )

    print("\n" + "=" * 70)
    print("Demo completed!")
    print("=" * 70)


if __name__ == "__main__":
    main()
