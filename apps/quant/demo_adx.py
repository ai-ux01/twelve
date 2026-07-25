"""
Demo script for ADX (Average Directional Index) calculator.

This script demonstrates how to use the ADX calculator with sample market data.
"""

from calculators.adx import calculate_adx, calculate_adx_series


def main():
    """Run ADX calculation demos."""
    print("=" * 60)
    print("ADX (Average Directional Index) Calculator Demo")
    print("=" * 60)

    # Sample market data (30 periods)
    # This is sample data representing high, low, close prices
    highs = [
        48.70,
        48.72,
        48.90,
        48.87,
        48.82,
        49.05,
        49.20,
        49.35,
        49.92,
        50.19,
        50.12,
        49.66,
        49.88,
        50.19,
        50.36,
        50.57,
        50.65,
        50.43,
        49.63,
        50.33,
        50.29,
        50.17,
        49.32,
        48.50,
        48.32,
        46.80,
        47.80,
        48.39,
        48.66,
        48.79,
    ]
    lows = [
        47.79,
        48.14,
        48.39,
        48.37,
        48.24,
        48.64,
        48.94,
        48.86,
        49.50,
        49.87,
        49.20,
        48.90,
        49.43,
        49.73,
        49.26,
        50.09,
        50.30,
        49.21,
        48.98,
        49.61,
        49.20,
        49.43,
        48.47,
        47.64,
        41.55,
        44.28,
        47.31,
        47.20,
        47.90,
        48.04,
    ]
    closes = [
        48.16,
        48.61,
        48.75,
        48.63,
        48.74,
        49.03,
        49.07,
        49.32,
        49.91,
        50.13,
        49.53,
        49.50,
        49.75,
        50.03,
        50.31,
        50.52,
        50.41,
        49.34,
        49.37,
        50.23,
        49.24,
        49.93,
        48.43,
        48.18,
        46.57,
        45.41,
        47.77,
        47.72,
        48.62,
        48.16,
    ]

    print("\nDemo 1: Single ADX Calculation")
    print("-" * 60)
    print("Calculating ADX for the most recent period...")

    # Calculate ADX for standard 14-period
    result = calculate_adx(highs, lows, closes, period=14)

    print(f"\nResults (14-period ADX):")
    print(f"  +DI (Positive Directional Indicator): {result['plus_di']:.2f}")
    print(f"  -DI (Negative Directional Indicator): {result['minus_di']:.2f}")
    print(f"  ADX (Average Directional Index):      {result['adx']:.2f}")

    # Interpret the results
    print("\nInterpretation:")
    if result["adx"] > 50:
        print("  Trend Strength: Very Strong Trend")
    elif result["adx"] > 25:
        print("  Trend Strength: Strong Trend")
    else:
        print("  Trend Strength: Weak or No Trend (Ranging)")

    if result["plus_di"] > result["minus_di"]:
        print("  Trend Direction: Bullish (upward)")
    elif result["minus_di"] > result["plus_di"]:
        print("  Trend Direction: Bearish (downward)")
    else:
        print("  Trend Direction: Neutral")

    print("\n" + "=" * 60)
    print("Demo 2: ADX Series Calculation")
    print("-" * 60)
    print("Calculating ADX series for charting...")

    # Calculate ADX series
    series = calculate_adx_series(highs, lows, closes, period=14)

    print(f"\nGenerated {len(series['adx'])} ADX values")
    print("\nLast 5 values:")
    print(
        f"  Period {len(series['adx'])-4}: +DI={series['plus_di'][-5]:.2f}, "
        f"-DI={series['minus_di'][-5]:.2f}, ADX={series['adx'][-5]:.2f}"
    )
    print(
        f"  Period {len(series['adx'])-3}: +DI={series['plus_di'][-4]:.2f}, "
        f"-DI={series['minus_di'][-4]:.2f}, ADX={series['adx'][-4]:.2f}"
    )
    print(
        f"  Period {len(series['adx'])-2}: +DI={series['plus_di'][-3]:.2f}, "
        f"-DI={series['minus_di'][-3]:.2f}, ADX={series['adx'][-3]:.2f}"
    )
    print(
        f"  Period {len(series['adx'])-1}: +DI={series['plus_di'][-2]:.2f}, "
        f"-DI={series['minus_di'][-2]:.2f}, ADX={series['adx'][-2]:.2f}"
    )
    print(
        f"  Period {len(series['adx'])}: +DI={series['plus_di'][-1]:.2f}, "
        f"-DI={series['minus_di'][-1]:.2f}, ADX={series['adx'][-1]:.2f}"
    )

    print("\n" + "=" * 60)
    print("Demo 3: Strong Uptrend Example")
    print("-" * 60)

    # Create a strong uptrend dataset
    uptrend_highs = [50 + i * 2 for i in range(50)]
    uptrend_lows = [48 + i * 2 for i in range(50)]
    uptrend_closes = [49 + i * 2 for i in range(50)]

    uptrend_result = calculate_adx(
        uptrend_highs, uptrend_lows, uptrend_closes, period=14
    )

    print(f"\nResults for strong uptrend:")
    print(f"  +DI: {uptrend_result['plus_di']:.2f}")
    print(f"  -DI: {uptrend_result['minus_di']:.2f}")
    print(f"  ADX: {uptrend_result['adx']:.2f}")
    print(f"\nNote: In a strong uptrend, +DI should be significantly higher than -DI")
    print(f"      and ADX should be > 25 (current: {uptrend_result['adx']:.2f})")

    print("\n" + "=" * 60)
    print("\nADX Interpretation Guide:")
    print("-" * 60)
    print("ADX Value | Trend Strength")
    print("----------|------------------")
    print("  0-25    | Weak or No Trend (ranging market)")
    print(" 25-50    | Strong Trend")
    print(" 50-75    | Very Strong Trend")
    print(" 75-100   | Extremely Strong Trend")
    print("\nDirectional Indicators:")
    print("  +DI > -DI : Bullish (upward) trend")
    print("  -DI > +DI : Bearish (downward) trend")
    print("=" * 60)


if __name__ == "__main__":
    main()
