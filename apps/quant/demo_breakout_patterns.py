"""
Demo script for breakout pattern detection with consolidation and strength scoring.

This demonstrates:
1. Consolidation range identification
2. Resistance breakout detection with volume confirmation
3. Breakout strength calculation
"""

from datetime import datetime, timedelta
from models import OHLCVData, TrendlineResult
from calculators.breakout_detector import (
    identify_consolidation_range,
    detect_resistance_breakout,
    BreakoutType,
)


def create_sample_data():
    """Create sample OHLCV data with consolidation followed by breakout."""
    base_time = datetime(2024, 1, 1, 9, 0, 0)
    data = []

    # Phase 1: Consolidation (20 bars between 100-102)
    consolidation_closes = [100.5, 101.0, 100.8, 101.5, 101.2, 100.7, 101.3] * 3
    for i, close in enumerate(consolidation_closes):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i * 5),
                open=close - 0.2,
                high=close + 0.5,
                low=close - 0.4,
                close=close,
                volume=1000000,
            )
        )

    # Phase 2: Breakout (3 bars with increasing volume)
    breakout_closes = [103.5, 105.0, 107.5]
    breakout_volumes = [1800000, 2200000, 2500000]
    for i, (close, volume) in enumerate(zip(breakout_closes, breakout_volumes)):
        idx = len(data)
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=idx * 5),
                open=close - 0.4,
                high=close + 1.0,
                low=close - 0.5,
                close=close,
                volume=volume,
            )
        )

    return data


def main():
    """Run the demo."""
    print("=" * 70)
    print("Breakout Pattern Detection Demo")
    print("=" * 70)

    # Create sample data
    data = create_sample_data()
    print(f"\nCreated {len(data)} bars of OHLCV data")
    print(f"  - Consolidation phase: bars 0-20")
    print(f"  - Breakout phase: bars 21-23")

    # Detect consolidation
    print("\n" + "=" * 70)
    print("1. Consolidation Range Detection")
    print("=" * 70)

    consolidation = identify_consolidation_range(data[:-3], lookback_bars=20)
    if consolidation:
        print(f"\n✓ Consolidation detected:")
        print(f"  Upper bound: ${consolidation.upper_bound:.2f}")
        print(f"  Lower bound: ${consolidation.lower_bound:.2f}")
        print(f"  Range size: ${consolidation.range_size:.2f}")
        print(f"  Range %: {consolidation.range_percent:.2f}%")
        print(f"  Duration: {consolidation.duration} bars")
        print(f"  Is tight: {consolidation.is_tight}")
    else:
        print("\n✗ No consolidation detected")

    # Create resistance trendline
    print("\n" + "=" * 70)
    print("2. Resistance Breakout Detection")
    print("=" * 70)

    # Resistance at horizontal line around 102
    resistance = TrendlineResult(
        slope=0.0,
        intercept=102.0,
        r_squared=0.95,
        start_point=(0.0, 102.0),
        end_point=(float(len(data) - 1), 102.0),
    )

    result = detect_resistance_breakout(
        data,
        resistance,
        volume_period=20,
        volume_threshold=1.2,
        lookback_bars=20,
    )

    print(f"\nBreakout Type: {result.breakout_type.value}")
    print(f"Confirmed by volume: {result.confirmed}")

    if result.breakout_type != BreakoutType.NO_BREAKOUT:
        print(f"\n✓ Breakout detected:")
        print(f"  Breakout price: ${result.breakout_price:.2f}")
        print(f"  Trendline price: ${result.trendline_price:.2f}")
        print(f"  Volume ratio: {result.volume_ratio:.2f}x")
        print(f"  Strength score: {result.strength_score:.1f}/100")

        if result.consolidation:
            print(f"\n  Prior consolidation:")
            print(
                f"    Range: ${result.consolidation.lower_bound:.2f} - ${result.consolidation.upper_bound:.2f}"
            )
            print(f"    Tight: {result.consolidation.is_tight}")
    else:
        print("\n✗ No breakout detected")

    # Strength breakdown
    print("\n" + "=" * 70)
    print("3. Strength Score Components")
    print("=" * 70)

    print(f"\nVolume confirmation: {'Yes' if result.confirmed else 'No'}")
    print(f"  - Volume ratio: {result.volume_ratio:.2f}x average")
    print(f"  - Contribution: ~{min(30, (result.volume_ratio - 1.0) * 20):.1f} points")

    if result.breakout_price and result.trendline_price:
        price_move = (
            (result.breakout_price - result.trendline_price) / result.trendline_price
        ) * 100
        print(f"\nPrice move: {price_move:.2f}%")
        print(f"  - Contribution: ~{min(25, price_move * 5):.1f} points")

    if result.consolidation:
        print(f"\nConsolidation detected:")
        print(f"  - Tightness: {result.consolidation.range_percent:.2f}%")
        print(f"  - Duration: {result.consolidation.duration} bars")
        print(f"  - Contribution: ~{45 * 0.5:.1f} points (estimated)")

    print(f"\n{'=' * 70}")
    print(f"Total Strength Score: {result.strength_score:.1f}/100")
    print(f"{'=' * 70}")

    # Interpretation
    print("\nInterpretation:")
    if result.strength_score >= 70:
        print("  🔥 STRONG breakout - High probability of continuation")
    elif result.strength_score >= 50:
        print("  ✓ MODERATE breakout - Good setup with confirmation")
    elif result.strength_score >= 30:
        print("  ⚠️  WEAK breakout - Requires caution")
    else:
        print("  ✗ VERY WEAK breakout - Not recommended")


if __name__ == "__main__":
    main()
