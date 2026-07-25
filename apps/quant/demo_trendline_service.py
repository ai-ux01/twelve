"""
Demo script for TrendlineService.

This script demonstrates the usage of TrendlineService for comprehensive
trendline analysis including swing detection, trendline calculation, and
breakout detection.
"""

from datetime import datetime, timedelta
from models import OHLCVData
from services.trendline_service import TrendlineService


def create_uptrend_data():
    """Create sample uptrend data for demonstration."""
    base_time = datetime(2024, 1, 1, 9, 15)

    # Uptrend with clear higher highs and higher lows
    prices = [
        (100, 102, 98, 101, 1000000),
        (101, 103, 99, 102, 950000),
        (102, 108, 101, 106, 1100000),  # Swing high at 108
        (106, 107, 103, 104, 980000),
        (104, 106, 100, 102, 1020000),  # Swing low at 100
        (102, 103, 99, 101, 1050000),
        (101, 112, 100, 110, 1150000),  # Swing high at 112
        (110, 111, 107, 108, 990000),
        (108, 110, 104, 106, 1030000),  # Swing low at 104
        (106, 107, 103, 105, 1010000),
        (105, 116, 104, 114, 1200000),  # Swing high at 116
        (114, 115, 110, 112, 1040000),
        (112, 114, 108, 110, 1050000),  # Swing low at 108
        (110, 111, 107, 109, 1060000),
        (109, 120, 108, 118, 1300000),  # Potential resistance breakout
    ]

    data = []
    for i, (open_p, high, low, close, volume) in enumerate(prices):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i),
                open=float(open_p),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=volume,
            )
        )

    return data


def create_downtrend_data():
    """Create sample downtrend data for demonstration."""
    base_time = datetime(2024, 1, 1, 9, 15)

    # Downtrend with clear lower highs and lower lows
    prices = [
        (120, 122, 118, 119, 1000000),
        (119, 121, 117, 118, 950000),
        (118, 120, 114, 116, 1100000),  # Swing low at 114
        (116, 118, 115, 117, 980000),
        (117, 119, 116, 118, 1020000),  # Swing high at 119
        (118, 119, 113, 115, 1150000),
        (115, 116, 108, 110, 1100000),  # Swing low at 108
        (110, 113, 109, 112, 990000),
        (112, 115, 111, 113, 1030000),  # Swing high at 115
        (113, 114, 110, 111, 1010000),
        (111, 112, 102, 104, 1200000),  # Swing low at 102
        (104, 108, 103, 107, 1040000),
        (107, 110, 106, 108, 1050000),  # Swing high at 110
        (108, 109, 105, 106, 1060000),
        (106, 107, 96, 98, 1300000),  # Potential support breakdown
    ]

    data = []
    for i, (open_p, high, low, close, volume) in enumerate(prices):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(minutes=i),
                open=float(open_p),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=volume,
            )
        )

    return data


def print_analysis_result(result, title):
    """Print formatted analysis result."""
    print(f"\n{'='*60}")
    print(f"{title:^60}")
    print(f"{'='*60}\n")

    # Swing Points
    print(f"Swing Points Detected: {len(result.swing_points)}")
    if result.swing_points:
        print("\nFirst 5 Swing Points:")
        for sp in result.swing_points[:5]:
            print(f"  - {sp.type:5s} | Index: {sp.index:2d} | Price: {sp.price:7.2f}")

    # Support Trendline
    print("\n" + "-" * 60)
    print("Support Trendline:")
    if result.support_trendline:
        print(f"  Slope:     {result.support_trendline.slope:+.4f}")
        print(f"  Intercept: {result.support_trendline.intercept:.2f}")
        print(f"  R²:        {result.support_trendline.r_squared:.4f}")
        print(
            f"  Start:     ({result.support_trendline.start_point[0]:.0f}, {result.support_trendline.start_point[1]:.2f})"
        )
        print(
            f"  End:       ({result.support_trendline.end_point[0]:.0f}, {result.support_trendline.end_point[1]:.2f})"
        )
    else:
        print("  None (insufficient swing lows)")

    # Resistance Trendline
    print("\n" + "-" * 60)
    print("Resistance Trendline:")
    if result.resistance_trendline:
        print(f"  Slope:     {result.resistance_trendline.slope:+.4f}")
        print(f"  Intercept: {result.resistance_trendline.intercept:.2f}")
        print(f"  R²:        {result.resistance_trendline.r_squared:.4f}")
        print(
            f"  Start:     ({result.resistance_trendline.start_point[0]:.0f}, {result.resistance_trendline.start_point[1]:.2f})"
        )
        print(
            f"  End:       ({result.resistance_trendline.end_point[0]:.0f}, {result.resistance_trendline.end_point[1]:.2f})"
        )
    else:
        print("  None (insufficient swing highs)")

    # Breakout Detection
    print("\n" + "-" * 60)
    print("Breakout Detection:")
    print(f"  Type:          {result.breakout.breakout_type}")
    print(f"  Confirmed:     {result.breakout.confirmed}")
    print(f"  Volume Ratio:  {result.breakout.volume_ratio:.2f}x")
    if result.breakout.breakout_index is not None:
        print(f"  Index:         {result.breakout.breakout_index}")
        print(f"  Price:         {result.breakout.breakout_price:.2f}")
        print(f"  Trendline:     {result.breakout.trendline_price:.2f}")

    print("\n" + "=" * 60)


def main():
    """Run trendline service demo."""
    print("\n" + "=" * 60)
    print("TrendlineService Demo".center(60))
    print("=" * 60)

    # Create service with default parameters
    print("\nInitializing TrendlineService...")
    print("  - Lookback Period: 2")
    print("  - Min Trendline Points: 2")
    print("  - Volume Period: 20")
    print("  - Volume Threshold: 1.0")

    service = TrendlineService(
        lookback_period=2,
        min_trendline_points=2,
        volume_period=10,  # Lower for demo data
        volume_threshold=1.0,
    )

    # Analyze uptrend
    print("\n\n" + "=" * 60)
    print("UPTREND ANALYSIS".center(60))
    print("=" * 60)

    uptrend_data = create_uptrend_data()
    print(f"\nAnalyzing {len(uptrend_data)} bars of uptrend data...")
    uptrend_result = service.analyze_trendlines(uptrend_data)
    print_analysis_result(uptrend_result, "Uptrend Analysis Results")

    # Analyze downtrend
    print("\n\n" + "=" * 60)
    print("DOWNTREND ANALYSIS".center(60))
    print("=" * 60)

    downtrend_data = create_downtrend_data()
    print(f"\nAnalyzing {len(downtrend_data)} bars of downtrend data...")
    downtrend_result = service.analyze_trendlines(downtrend_data)
    print_analysis_result(downtrend_result, "Downtrend Analysis Results")

    print("\n" + "=" * 60)
    print("Demo Complete".center(60))
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
