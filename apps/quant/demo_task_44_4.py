#!/usr/bin/env python3
"""
Demonstration of Task 44.4: Breakout Retest Detection

This script demonstrates:
1. Detecting broken resistance acting as new support
2. Detecting broken support acting as new resistance
3. Confidence scoring based on proximity and price action
4. Distance calculation from breakout level
"""

from datetime import datetime, timedelta
from models import OHLCVData
from calculators.breakout_detector import (
    detect_retest,
    BreakoutType,
    RetestType,
)


def print_header(title: str):
    """Print formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def create_ohlcv_bar(timestamp, open_price, high, low, close, volume=1500000):
    """Helper to create OHLCV data bar."""
    return OHLCVData(
        timestamp=timestamp,
        open=open_price,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


def demo_resistance_to_support_retest():
    """Demonstrate resistance breakout followed by retest as support."""
    print_header("SCENARIO 1: Broken Resistance Acting as New Support")

    start_time = datetime(2024, 1, 1, 9, 15)
    data = []

    print("📊 Price Action Timeline:")
    print("-" * 70)
    print("Phase 1 (Bars 0-19): Consolidation below resistance at ₹2460")

    # Phase 1: Consolidation below resistance
    for i in range(20):
        price = 2450.0 + (i % 5) * 2
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=i * 5),
                price,
                price + 3,
                price - 3,
                price + 1,
                1200000,
            )
        )

    print("Phase 2 (Bars 20-24): BREAKOUT above ₹2460 with strong volume")

    # Phase 2: Breakout above resistance
    for i in range(20, 25):
        price = 2460.0 + (i - 20) * 3
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=i * 5),
                price,
                price + 4,
                price - 1,
                price + 3,
                2000000,
            )
        )

    print("Phase 3 (Bars 25-29): Pullback toward ₹2460")

    # Phase 3: Pullback
    for i in range(25, 30):
        price = 2472.0 - (i - 25) * 2.5
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=i * 5),
                price,
                price + 2,
                price - 2,
                price - 1,
                1000000,
            )
        )

    print("Phase 4 (Bar 30): RETEST at ₹2460 with bullish bounce\n")

    # Phase 4: Retest with bullish bounce
    data.append(
        create_ohlcv_bar(
            start_time + timedelta(minutes=30 * 5),
            2462.0,
            2468.0,
            2459.0,
            2466.0,
            1300000,  # Bounce from 2459
        )
    )

    # Detect retest
    result = detect_retest(
        data=data,
        breakout_level=2460.0,
        breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
        lookback_bars=10,
        tolerance=0.02,
    )

    print("🔍 RETEST ANALYSIS:")
    print(f"   Retest Type: {result.retest_type.value}")
    print(f"   Detected: {'✅ YES' if result.detected else '❌ NO'}")
    print(
        f"   Confidence: {result.confidence:.2f} {'🟢 HIGH' if result.confidence > 0.7 else '🟡 MODERATE' if result.confidence > 0.5 else '🔴 LOW'}"
    )
    print(f"   Distance from Level: {result.distance_percent:.2f}%")

    if result.retest_index is not None:
        print(f"   Retest Bar Index: {result.retest_index}")
        print(f"   Retest Price: ₹{result.retest_price:.2f}")

    print(f"   Breakout Level: ₹{result.level:.2f}")

    print("\n💡 INTERPRETATION:")
    if result.retest_type == RetestType.RESISTANCE_TO_SUPPORT:
        print("   ✓ Broken resistance (₹2460) is now acting as support")
        print("   ✓ Price successfully retested and bounced higher")
        if result.confidence > 0.7:
            print("   ✓ High confidence - strong support level confirmed")
            print("   📈 BULLISH SIGNAL: Good entry opportunity near ₹2460")
        elif result.confidence > 0.5:
            print("   ⚠ Moderate confidence - watch for follow-through")
        else:
            print("   ⚠ Low confidence - wait for stronger confirmation")


def demo_support_to_resistance_retest():
    """Demonstrate support breakdown followed by retest as resistance."""
    print_header("SCENARIO 2: Broken Support Acting as New Resistance")

    start_time = datetime(2024, 1, 15, 9, 15)
    data = []

    print("📊 Price Action Timeline:")
    print("-" * 70)
    print("Phase 1 (Bars 0-19): Trading above support at ₹2400")

    # Phase 1: Trading above support
    for i in range(20):
        price = 2410.0 - (i % 5) * 2
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=i * 5),
                price,
                price + 3,
                price - 3,
                price - 1,
                1200000,
            )
        )

    print("Phase 2 (Bars 20-24): BREAKDOWN below ₹2400 with volume")

    # Phase 2: Breakdown below support
    for i in range(20, 25):
        price = 2400.0 - (i - 20) * 3
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=i * 5),
                price,
                price + 1,
                price - 4,
                price - 3,
                1800000,
            )
        )

    print("Phase 3 (Bars 25-29): Rally back toward ₹2400")

    # Phase 3: Rally
    for i in range(25, 30):
        price = 2388.0 + (i - 25) * 2
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=i * 5),
                price,
                price + 2,
                price - 1,
                price + 1,
                900000,
            )
        )

    print("Phase 4 (Bar 30): RETEST at ₹2400 with bearish rejection\n")

    # Phase 4: Retest with bearish rejection
    data.append(
        create_ohlcv_bar(
            start_time + timedelta(minutes=30 * 5),
            2396.0,
            2401.0,
            2394.0,
            2395.0,
            1100000,  # Rejected at 2401
        )
    )

    # Detect retest
    result = detect_retest(
        data=data,
        breakout_level=2400.0,
        breakout_type=BreakoutType.SUPPORT_BREAKDOWN,
        lookback_bars=10,
        tolerance=0.02,
    )

    print("🔍 RETEST ANALYSIS:")
    print(f"   Retest Type: {result.retest_type.value}")
    print(f"   Detected: {'✅ YES' if result.detected else '❌ NO'}")
    print(
        f"   Confidence: {result.confidence:.2f} {'🟢 HIGH' if result.confidence > 0.7 else '🟡 MODERATE' if result.confidence > 0.5 else '🔴 LOW'}"
    )
    print(f"   Distance from Level: {result.distance_percent:.2f}%")

    if result.retest_index is not None:
        print(f"   Retest Bar Index: {result.retest_index}")
        print(f"   Retest Price: ₹{result.retest_price:.2f}")

    print(f"   Breakdown Level: ₹{result.level:.2f}")

    print("\n💡 INTERPRETATION:")
    if result.retest_type == RetestType.SUPPORT_TO_RESISTANCE:
        print("   ✓ Broken support (₹2400) is now acting as resistance")
        print("   ✓ Price rallied back but got rejected at the level")
        if result.confidence > 0.7:
            print("   ✓ High confidence - strong resistance level confirmed")
            print("   📉 BEARISH SIGNAL: Consider shorting near ₹2400")
        elif result.confidence > 0.5:
            print("   ⚠ Moderate confidence - watch for follow-through")
        else:
            print("   ⚠ Low confidence - wait for stronger confirmation")


def demo_no_retest_scenario():
    """Demonstrate scenario where no retest occurs."""
    print_header("SCENARIO 3: No Retest - Price Stays Far from Level")

    start_time = datetime(2024, 2, 1, 9, 15)
    data = []

    print("📊 Price Action Timeline:")
    print("-" * 70)
    print("Bars 0-29: Strong uptrend, price stays above ₹2460\n")

    # Strong uptrend without pullback
    for i in range(30):
        price = 2460.0 + i * 2
        data.append(
            create_ohlcv_bar(
                start_time + timedelta(minutes=i * 5),
                price,
                price + 3,
                price - 1,
                price + 2,
                1500000,
            )
        )

    # Detect retest
    result = detect_retest(
        data=data,
        breakout_level=2460.0,
        breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
        lookback_bars=10,
        tolerance=0.02,
    )

    print("🔍 RETEST ANALYSIS:")
    print(f"   Retest Type: {result.retest_type.value}")
    print(f"   Detected: {'✅ YES' if result.detected else '❌ NO'}")
    print(f"   Confidence: {result.confidence:.2f}")
    print(f"   Distance from Level: {result.distance_percent:.2f}%")
    print(f"   Current Price: ₹{data[-1].close:.2f}")
    print(f"   Breakout Level: ₹{result.level:.2f}")

    print("\n💡 INTERPRETATION:")
    print("   ✓ No retest detected - price moving strongly higher")
    print(f"   ✓ Price is {result.distance_percent:.1f}% above breakout level")
    print("   ⚠ Wait for pullback to ₹2460 for better entry opportunity")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  Task 44.4: Breakout Retest Detection Demo")
    print("  Requirements 5.2: Swing Trading Technical Analysis")
    print("=" * 70)

    try:
        demo_resistance_to_support_retest()
        demo_support_to_resistance_retest()
        demo_no_retest_scenario()

        print("\n" + "=" * 70)
        print("  ✅ All Scenarios Demonstrated Successfully")
        print("=" * 70)
        print("\n📋 KEY FEATURES IMPLEMENTED:")
        print("   ✓ Detect broken resistance acting as new support")
        print("   ✓ Detect broken support acting as new resistance")
        print("   ✓ Calculate confidence score (0-1) based on:")
        print("     - Proximity to breakout level (50% weight)")
        print("     - Bounce/rejection strength (50% weight)")
        print("   ✓ Calculate distance from breakout level (%)")
        print("   ✓ Return retest status and detailed results")
        print("\n")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
