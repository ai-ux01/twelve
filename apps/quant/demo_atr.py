"""
Demo script for ATR (Average True Range) calculator.

This script demonstrates how to use the ATR calculator with sample data.
"""

from calculators.atr import calculate_atr, calculate_atr_series


def main():
    """Demonstrate ATR calculation with sample data."""
    print("=" * 70)
    print("ATR (Average True Range) Calculator Demo")
    print("=" * 70)
    print()

    # Sample data: 15 trading periods with high, low, close prices
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
    ]

    print("Sample Price Data (15 periods):")
    print("-" * 70)
    print(f"{'Period':<8} {'High':<10} {'Low':<10} {'Close':<10}")
    print("-" * 70)
    for i in range(len(highs)):
        print(f"{i+1:<8} {highs[i]:<10.2f} {lows[i]:<10.2f} {closes[i]:<10.2f}")
    print()

    # Calculate ATR-14 (standard 14-period ATR)
    atr_14 = calculate_atr(highs, lows, closes, period=14)
    print(f"ATR-14 (14-period Average True Range): {atr_14:.4f}")
    print()

    # Interpretation
    print("Interpretation:")
    print("-" * 70)
    print(f"The ATR value of {atr_14:.4f} represents the average price movement")
    print("over the last 14 periods. This is an absolute measure of volatility.")
    print()

    avg_price = sum(closes) / len(closes)
    atr_percentage = (atr_14 / avg_price) * 100
    print(f"Average price: {avg_price:.2f}")
    print(f"ATR as % of price: {atr_percentage:.2f}%")
    print()

    # Volatility assessment
    if atr_percentage < 1:
        volatility = "LOW"
    elif atr_percentage < 2:
        volatility = "MODERATE"
    else:
        volatility = "HIGH"

    print(f"Volatility Assessment: {volatility}")
    print()

    # Calculate ATR with different periods
    print("ATR with Different Periods:")
    print("-" * 70)
    periods = [7, 10, 14, 20]

    # Add more data for longer periods
    extended_highs = highs + [50.5, 50.8, 51.0, 51.2, 51.5, 51.8]
    extended_lows = lows + [49.8, 50.0, 50.2, 50.5, 50.8, 51.0]
    extended_closes = closes + [50.2, 50.5, 50.8, 51.0, 51.3, 51.6]

    for period in periods:
        if len(extended_highs) >= period + 1:
            atr = calculate_atr(
                extended_highs, extended_lows, extended_closes, period=period
            )
            print(f"ATR-{period:2d}: {atr:.4f}")
    print()

    # Calculate ATR series
    print("ATR Series (showing last 5 values):")
    print("-" * 70)
    atr_series = calculate_atr_series(highs, lows, closes, period=14)
    for i in range(len(atr_series) - 5, len(atr_series)):
        if i >= 0:
            import math

            atr_val = atr_series[i]
            if math.isnan(atr_val):
                print(f"Period {i+1:2d}: NaN (insufficient data)")
            else:
                print(f"Period {i+1:2d}: {atr_val:.4f}")
    print()

    print("=" * 70)
    print("Usage in Trading:")
    print("-" * 70)
    print("• ATR is used to measure market volatility")
    print("• Higher ATR values indicate higher volatility")
    print("• Lower ATR values indicate lower volatility")
    print("• Traders use ATR to:")
    print("  - Set stop-loss levels (e.g., 2 × ATR)")
    print("  - Determine position sizes (lower position size in high ATR)")
    print("  - Identify breakout opportunities (ATR expansion)")
    print("  - Adjust trading strategies based on market conditions")
    print("=" * 70)


if __name__ == "__main__":
    main()
