"""
Demonstration of retest detection functionality (Task 37.2).

This script shows practical examples of:
1. Resistance breakout followed by retest as support
2. Support breakdown followed by retest as resistance
"""

from datetime import datetime, timedelta
from models import OHLCVData, TrendlineResult
from calculators.breakout_detector import BreakoutDetector, BreakoutType, RetestType


def print_header(title: str):
    """Print formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def create_breakout_scenario():
    """Create realistic breakout and retest scenario."""
    print_header("SCENARIO 1: Resistance Breakout with Successful Retest")

    # Simulate price action
    data = []
    start_time = datetime(2024, 1, 1, 9, 15)

    print("📊 Price Action Timeline:")
    print("-" * 70)

    # Phase 1: Consolidation below resistance (100-105 range)
    print("Phase 1 (Bars 0-19): Consolidation below resistance at $110")
    for i in range(20):
        price = 103.0 + (i % 5) * 0.5  # Oscillating
        data.append(
            OHLCVData(
                timestamp=start_time + timedelta(minutes=i * 5),
                open=price,
                high=price + 0.8,
                low=price - 0.8,
                close=price + 0.3,
                volume=1000000,
            )
        )

    # Phase 2: Breakout above resistance with volume
    print("Phase 2 (Bars 20-24): BREAKOUT above $110 with strong volume")
    for i in range(20, 25):
        price = 110.0 + (i - 20) * 0.8
        data.append(
            OHLCVData(
                timestamp=start_time + timedelta(minutes=i * 5),
                open=price,
                high=price + 1.2,
                low=price - 0.3,
                close=price + 0.9,
                volume=2500000,  # Strong volume
            )
        )

    # Phase 3: Pullback toward broken resistance
    print("Phase 3 (Bars 25-29): Pullback toward $110")
    for i in range(25, 30):
        price = 114.0 - (i - 25) * 0.8
        data.append(
            OHLCVData(
                timestamp=start_time + timedelta(minutes=i * 5),
                open=price,
                high=price + 0.5,
                low=price - 0.7,
                close=price - 0.2,
                volume=1200000,
            )
        )

    # Phase 4: Retest and bounce
    print("Phase 4 (Bars 30-34): RETEST at $110 with bullish bounce")
    for i in range(30, 35):
        if i == 30:
            # Retest bar - touches $110 and bounces
            data.append(
                OHLCVData(
                    timestamp=start_time + timedelta(minutes=i * 5),
                    open=110.5,
                    high=111.0,
                    low=109.8,  # Tests the level
                    close=110.8,  # Strong close
                    volume=1800000,
                )
            )
        else:
            # Continuation upward
            price = 111.0 + (i - 30) * 0.6
            data.append(
                OHLCVData(
                    timestamp=start_time + timedelta(minutes=i * 5),
                    open=price,
                    high=price + 0.8,
                    low=price - 0.4,
                    close=price + 0.5,
                    volume=1500000,
                )
            )

    print("-" * 70)

    # Define resistance line
    resistance_line = TrendlineResult(
        slope=0.0,  # Horizontal resistance
        intercept=110.0,
        r_squared=0.90,
        start_point=(0, 110.0),
        end_point=(34, 110.0),
    )

    # Initialize detector
    detector = BreakoutDetector(volume_threshold=1.5, retest_tolerance=0.02)

    # Detect breakout (check at bar 24, after breakout)
    breakout_data = data[:25]
    breakout_result = detector.detect_resistance_breakout(
        breakout_data, resistance_line
    )

    print("\n🔍 BREAKOUT ANALYSIS (Bar 24):")
    print(f"   Breakout Type: {breakout_result.breakout_type.value}")
    print(f"   Breakout Price: ${breakout_result.breakout_price:.2f}")
    print(f"   Volume Ratio: {breakout_result.volume_ratio:.2f}x")
    print(f"   Confirmed: {'✅ YES' if breakout_result.confirmed else '❌ NO'}")

    # Detect retest (check full data)
    retest_result = detector.detect_retest(
        data,
        breakout_level=110.0,
        breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
        lookback_bars=10,
    )

    print("\n🔍 RETEST ANALYSIS (Bars 25-34):")
    print(f"   Retest Type: {retest_result.retest_type.value}")
    print(
        f"   Confidence: {retest_result.confidence:.2f} {'🟢 STRONG' if retest_result.confidence > 0.7 else '🟡 MODERATE'}"
    )
    print(f"   Distance from Level: {retest_result.distance_percent:.2f}%")
    if retest_result.retest_index:
        print(f"   Retest Bar: {retest_result.retest_index}")
        print(f"   Retest Price: ${retest_result.retest_price:.2f}")

    print("\n💡 INTERPRETATION:")
    if retest_result.retest_type == RetestType.RESISTANCE_TO_SUPPORT:
        print("   ✓ Broken resistance is now acting as support")
        print("   ✓ Price successfully retested and bounced")
        if retest_result.confidence > 0.7:
            print("   ✓ High confidence - strong support level confirmed")
            print("   📈 BULLISH SIGNAL: Good entry opportunity near $110")


def create_breakdown_scenario():
    """Create realistic breakdown and retest scenario."""
    print_header("SCENARIO 2: Support Breakdown with Failed Retest")

    data = []
    start_time = datetime(2024, 1, 15, 9, 15)

    print("📊 Price Action Timeline:")
    print("-" * 70)

    # Phase 1: Consolidation above support
    print("Phase 1 (Bars 0-19): Consolidation above support at $95")
    for i in range(20):
        price = 98.0 - (i % 5) * 0.3
        data.append(
            OHLCVData(
                timestamp=start_time + timedelta(minutes=i * 5),
                open=price,
                high=price + 0.6,
                low=price - 0.6,
                close=price - 0.2,
                volume=1000000,
            )
        )

    # Phase 2: Breakdown below support
    print("Phase 2 (Bars 20-24): BREAKDOWN below $95 with volume")
    for i in range(20, 25):
        price = 95.0 - (i - 20) * 0.6
        data.append(
            OHLCVData(
                timestamp=start_time + timedelta(minutes=i * 5),
                open=price,
                high=price + 0.3,
                low=price - 0.9,
                close=price - 0.7,
                volume=2200000,
            )
        )

    # Phase 3: Bounce back toward broken support
    print("Phase 3 (Bars 25-29): Rally back toward $95")
    for i in range(25, 30):
        price = 92.0 + (i - 25) * 0.6
        data.append(
            OHLCVData(
                timestamp=start_time + timedelta(minutes=i * 5),
                open=price,
                high=price + 0.8,
                low=price - 0.4,
                close=price + 0.4,
                volume=1300000,
            )
        )

    # Phase 4: Retest and rejection
    print("Phase 4 (Bars 30-34): RETEST at $95 with bearish rejection")
    for i in range(30, 35):
        if i == 30:
            # Retest bar - approaches $95 and gets rejected
            data.append(
                OHLCVData(
                    timestamp=start_time + timedelta(minutes=i * 5),
                    open=95.0,
                    high=95.3,  # Tests the level
                    low=94.2,
                    close=94.4,  # Rejected down
                    volume=1700000,
                )
            )
        else:
            # Continuation downward
            price = 94.0 - (i - 30) * 0.5
            data.append(
                OHLCVData(
                    timestamp=start_time + timedelta(minutes=i * 5),
                    open=price,
                    high=price + 0.4,
                    low=price - 0.6,
                    close=price - 0.4,
                    volume=1400000,
                )
            )

    print("-" * 70)

    # Define support line
    support_line = TrendlineResult(
        slope=0.0,  # Horizontal support
        intercept=95.0,
        r_squared=0.88,
        start_point=(0, 95.0),
        end_point=(34, 95.0),
    )

    # Initialize detector
    detector = BreakoutDetector(volume_threshold=1.5, retest_tolerance=0.02)

    # Detect breakdown
    breakdown_data = data[:25]
    breakdown_result = detector.detect_support_breakdown(breakdown_data, support_line)

    print("\n🔍 BREAKDOWN ANALYSIS (Bar 24):")
    print(f"   Breakdown Type: {breakdown_result.breakout_type.value}")
    print(f"   Breakdown Price: ${breakdown_result.breakout_price:.2f}")
    print(f"   Volume Ratio: {breakdown_result.volume_ratio:.2f}x")
    print(f"   Confirmed: {'✅ YES' if breakdown_result.confirmed else '❌ NO'}")

    # Detect retest
    retest_result = detector.detect_retest(
        data,
        breakout_level=95.0,
        breakout_type=BreakoutType.SUPPORT_BREAKDOWN,
        lookback_bars=10,
    )

    print("\n🔍 RETEST ANALYSIS (Bars 25-34):")
    print(f"   Retest Type: {retest_result.retest_type.value}")
    print(
        f"   Confidence: {retest_result.confidence:.2f} {'🟢 STRONG' if retest_result.confidence > 0.7 else '🟡 MODERATE'}"
    )
    print(f"   Distance from Level: {retest_result.distance_percent:.2f}%")
    if retest_result.retest_index:
        print(f"   Retest Bar: {retest_result.retest_index}")
        print(f"   Retest Price: ${retest_result.retest_price:.2f}")

    print("\n💡 INTERPRETATION:")
    if retest_result.retest_type == RetestType.SUPPORT_TO_RESISTANCE:
        print("   ✓ Broken support is now acting as resistance")
        print("   ✓ Price rallied back but was rejected at $95")
        if retest_result.confidence > 0.7:
            print("   ✓ High confidence - strong resistance level confirmed")
            print("   📉 BEARISH SIGNAL: Failed retest confirms downtrend")


def main():
    """Run demonstration."""
    print("\n")
    print("╔════════════════════════════════════════════════════════════════════╗")
    print("║         RETEST DETECTION DEMONSTRATION (Task 37.2)                ║")
    print("╚════════════════════════════════════════════════════════════════════╝")

    create_breakout_scenario()
    create_breakdown_scenario()

    print("\n" + "=" * 70)
    print("  KEY CONCEPTS")
    print("=" * 70)
    print(
        """
1. RESISTANCE TO SUPPORT RETEST:
   - After breaking above resistance, price pulls back
   - Old resistance now acts as new support
   - Successful retest = bullish confirmation
   - Look for: price touching level and bouncing up

2. SUPPORT TO RESISTANCE RETEST:
   - After breaking below support, price rallies back
   - Old support now acts as new resistance
   - Failed retest = bearish confirmation
   - Look for: price approaching level and getting rejected down

3. CONFIDENCE SCORING:
   - Based on proximity to breakout level (0-2% tolerance)
   - Based on strength of bounce/rejection
   - Score > 0.7 = high confidence, strong signal
   - Score 0.4-0.7 = moderate confidence
   - Score < 0.4 = weak signal

4. VOLUME CONFIRMATION:
   - Breakouts with volume > 1.5x average are more reliable
   - Retests don't require high volume (may be lower)
   - High volume on initial break is key
"""
    )
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
