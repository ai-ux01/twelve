"""
Demo script for volume analysis calculators.

This script demonstrates the usage of volume analysis functions:
- Volume Moving Average (VMA)
- Relative Volume (RVOL)
- Volume Ratio
"""

from calculators.volume_analysis import (
    calculate_volume_ma,
    calculate_volume_ma_series,
    calculate_relative_volume,
    calculate_relative_volume_series,
    calculate_volume_ratio,
    calculate_volume_ratio_series,
)


def demo_volume_moving_average():
    """Demonstrate Volume Moving Average calculation."""
    print("=" * 60)
    print("Volume Moving Average (VMA) Demo")
    print("=" * 60)

    # Example: Normal trading volumes
    volumes = [
        1_000_000,
        1_200_000,
        1_100_000,
        1_300_000,
        1_050_000,
        1_150_000,
        1_250_000,
        1_100_000,
        1_400_000,
        1_200_000,
    ]

    print(f"\nVolume data (last 10 bars): {volumes}")

    # Calculate 5-period VMA
    vma_5 = calculate_volume_ma(volumes, period=5)
    print(f"\n5-period Volume MA: {vma_5:,.0f}")

    # Calculate entire series
    vma_series = calculate_volume_ma_series(volumes, period=5)
    print(f"\nVMA series (5-period):")
    for i, vma in enumerate(vma_series, start=5):
        print(f"  Bar {i}: {vma:,.0f}")

    print()


def demo_relative_volume():
    """Demonstrate Relative Volume calculation."""
    print("=" * 60)
    print("Relative Volume (RVOL) Demo")
    print("=" * 60)

    # Example: 20 bars of normal volume, then sudden spike
    normal_volumes = [1_000_000, 1_100_000, 1_050_000, 1_150_000, 1_000_000] * 4
    current_volume = 2_500_000  # More than 2x average

    print(
        f"\nAverage volume (last 20 bars): ~{sum(normal_volumes) / len(normal_volumes):,.0f}"
    )
    print(f"Current volume: {current_volume:,.0f}")

    # Calculate RVOL
    rvol = calculate_relative_volume(current_volume, normal_volumes, period=20)
    print(f"\nRelative Volume: {rvol:.2f}x")

    if rvol > 2.0:
        print("⚠️  High volume alert! RVOL > 2.0 indicates significant activity")
    elif rvol > 1.5:
        print("📈 Above-average volume (RVOL > 1.5)")
    elif rvol < 0.5:
        print("📉 Below-average volume (RVOL < 0.5)")
    else:
        print("✓  Normal volume range")

    # Calculate RVOL series
    volumes_with_spike = normal_volumes + [2_500_000, 3_000_000, 2_200_000]
    rvol_series = calculate_relative_volume_series(volumes_with_spike, period=20)

    print(f"\nRVOL series (last 3 bars):")
    for i, rvol_val in enumerate(rvol_series[-3:], start=len(rvol_series) - 2):
        indicator = "🚨" if rvol_val > 2.0 else "📈" if rvol_val > 1.5 else "✓"
        print(f"  Bar {i}: {rvol_val:.2f}x {indicator}")

    print()


def demo_volume_ratio():
    """Demonstrate Volume Ratio calculation."""
    print("=" * 60)
    print("Volume Ratio Indicator Demo")
    print("=" * 60)

    # Example: Volume increasing over time (bullish)
    volumes_increasing = [1_000_000] * 10 + [1_500_000] * 10 + [2_000_000] * 5

    print(f"\nVolume trend: Increasing over time")
    print(f"Early volume: ~{volumes_increasing[0]:,.0f}")
    print(f"Recent volume: ~{volumes_increasing[-1]:,.0f}")

    # Calculate volume ratio (5-period vs 20-period)
    ratio = calculate_volume_ratio(volumes_increasing, short_period=5, long_period=20)
    print(f"\nVolume Ratio (5-day / 20-day): {ratio:.2f}")

    if ratio > 1.2:
        print("🔥 Strong volume increase - potential breakout signal")
    elif ratio > 1.0:
        print("📈 Volume increasing - bullish signal")
    elif ratio < 0.8:
        print("📉 Volume decreasing - bearish signal")
    else:
        print("➡️  Stable volume trend")

    # Example: Volume decreasing (bearish)
    volumes_decreasing = [2_000_000] * 10 + [1_500_000] * 10 + [1_000_000] * 5
    ratio_bearish = calculate_volume_ratio(
        volumes_decreasing, short_period=5, long_period=20
    )

    print(f"\nVolume trend: Decreasing over time")
    print(f"Volume Ratio (5-day / 20-day): {ratio_bearish:.2f}")
    print("📉 Volume decreasing - bearish signal")

    # Calculate ratio series
    ratio_series = calculate_volume_ratio_series(
        volumes_increasing, short_period=5, long_period=20
    )

    print(f"\nVolume Ratio series (last 5 bars):")
    for i, ratio_val in enumerate(ratio_series[-5:], start=len(ratio_series) - 4):
        trend = "🔥" if ratio_val > 1.2 else "📈" if ratio_val > 1.0 else "➡️"
        print(f"  Bar {i}: {ratio_val:.2f} {trend}")

    print()


def demo_real_world_scenario():
    """Demonstrate real-world trading scenario."""
    print("=" * 60)
    print("Real-World Trading Scenario")
    print("=" * 60)

    # Scenario: Stock breaking out with volume confirmation
    print("\nScenario: Stock attempting breakout at resistance level")
    print("-" * 60)

    # Historical volumes (relatively normal)
    historical_volumes = [
        950_000,
        1_100_000,
        1_050_000,
        1_200_000,
        980_000,
        1_150_000,
        1_080_000,
        1_120_000,
        1_050_000,
        1_180_000,
        1_020_000,
        1_150_000,
        1_090_000,
        1_140_000,
        1_060_000,
        1_170_000,
        1_100_000,
        1_130_000,
        1_080_000,
        1_160_000,
    ]

    # Breakout day with high volume
    breakout_volume = 2_800_000

    # Calculate indicators
    vma = calculate_volume_ma(historical_volumes, period=20)
    rvol = calculate_relative_volume(breakout_volume, historical_volumes, period=20)
    ratio = calculate_volume_ratio(
        historical_volumes + [breakout_volume], short_period=5, long_period=20
    )

    print(f"\n20-day Average Volume: {vma:,.0f}")
    print(f"Breakout Day Volume:   {breakout_volume:,.0f}")
    print(f"\nRelative Volume:       {rvol:.2f}x 🚨")
    print(f"Volume Ratio (5/20):   {ratio:.2f}")

    # Trading decision logic
    print("\n" + "=" * 60)
    print("TRADING SIGNAL ANALYSIS")
    print("=" * 60)

    if rvol > 2.0 and ratio > 1.0:
        print("✅ STRONG BULLISH SIGNAL")
        print("   - Extremely high relative volume (RVOL > 2.0)")
        print("   - Short-term volume trend positive")
        print("   - Volume confirms price breakout")
        print("\n🎯 Trading Action: Consider entering long position")
    elif rvol > 1.5:
        print("⚠️  MODERATE BULLISH SIGNAL")
        print("   - Above-average volume")
        print("   - Watch for price confirmation")
    else:
        print("⛔ WEAK SIGNAL")
        print("   - Insufficient volume for breakout confirmation")
        print("   - Wait for stronger volume")

    print()


def main():
    """Run all demos."""
    print("\n" + "=" * 60)
    print("VOLUME ANALYSIS CALCULATORS DEMONSTRATION")
    print("=" * 60)
    print()

    demo_volume_moving_average()
    demo_relative_volume()
    demo_volume_ratio()
    demo_real_world_scenario()

    print("=" * 60)
    print("Demo completed successfully!")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()
