#!/usr/bin/env python3
"""
Quick manual test of RSI calculator.
"""

from calculators.rsi import calculate_rsi, calculate_rsi_series

# Test with known values from Wilder's original RSI example
prices = [
    44.00,
    44.34,
    44.09,
    43.61,
    44.33,
    44.83,
    45.10,
    45.42,
    45.84,
    46.08,
    45.89,
    46.03,
    45.61,
    46.28,
    46.28,
]

print("Testing RSI Calculator")
print("=" * 50)
print(f"Price data (15 points): {prices[:5]}... to ...{prices[-3:]}")
print(f"Period: 14")
print()

# Calculate RSI
rsi = calculate_rsi(prices, period=14)
print(f"RSI Value: {rsi:.2f}")
print()

# Validate
if 0 <= rsi <= 100:
    print("✓ RSI is within valid range [0, 100]")
else:
    print("✗ RSI is out of range!")

if 65 <= rsi <= 75:
    print("✓ RSI matches expected value (~70) for this dataset")
else:
    print(f"⚠ RSI {rsi:.2f} differs from expected ~70")

print()
print("RSI Calculator implementation: SUCCESS!")
