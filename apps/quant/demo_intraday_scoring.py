"""
Demo script for IntradayScoringService.

This script demonstrates how to use the IntradayScoringService with sample
intraday trading data to calculate a deterministic score for trade opportunities.

Requirements: 6.6
"""

from services.intraday_scoring_service import (
    IntradayScoringService,
    IntradayScoringWeights,
)
from models.intraday import (
    IntradayTechnicalAnalysis,
    MACDIndicator,
    BollingerBands,
    OpeningRangeResult,
    PreviousDayLevelsResult,
    BreakoutStatus,
    BreachStatus,
    GapType,
)


def print_section_header(title: str):
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def main():
    """Run the demo."""
    print_section_header("Intraday Scoring Service Demo")

    # Create sample technical analysis data
    print("\n1. Creating sample technical analysis data...")
    analysis = IntradayTechnicalAnalysis(
        rsi=62.5,  # Bullish RSI
        macd=MACDIndicator(
            value=2.5,
            signal=1.8,
            histogram=0.7,  # Positive histogram
        ),
        ema_9=2465.0,  # Fast EMA
        ema_21=2460.0,  # Slow EMA
        ema_50=2455.0,
        vwap=2458.0,  # VWAP below current price
        atr=15.5,
        volume=150000,
        relative_volume=1.45,  # Above average volume
        bollinger_bands=BollingerBands(
            upper=2480.0,
            middle=2460.0,
            lower=2440.0,
        ),
        support_levels=[2430.0, 2445.0],
        resistance_levels=[2475.0, 2490.0],
    )
    print(f"  RSI: {analysis.rsi:.1f}")
    print(f"  MACD Histogram: {analysis.macd.histogram:.2f}")
    print(f"  EMA 9: {analysis.ema_9:.2f}")
    print(f"  EMA 21: {analysis.ema_21:.2f}")
    print(f"  VWAP: {analysis.vwap:.2f}")
    print(f"  Relative Volume: {analysis.relative_volume:.2f}x")

    # Create opening range result
    print("\n2. Creating opening range analysis...")
    opening_range = OpeningRangeResult(
        high=2470.0,
        low=2455.0,
        midpoint=2462.5,
        range_size=15.0,
        range_percent=0.61,
        breakout_status=BreakoutStatus.BREAKOUT_ABOVE,
        current_price=2472.0,
        breakout_distance=0.08,
        volume_confirmed=True,
        volume_ratio=1.45,
    )
    print(f"  Opening Range: {opening_range.low:.2f} - {opening_range.high:.2f}")
    print(f"  Breakout Status: {opening_range.breakout_status.value}")
    print(f"  Volume Confirmed: {opening_range.volume_confirmed}")

    # Create previous day levels result
    print("\n3. Creating previous day levels analysis...")
    prev_day_levels = PreviousDayLevelsResult(
        prev_day_high=2468.0,
        prev_day_low=2440.0,
        prev_day_close=2460.0,
        gap_percent=0.41,
        gap_type=GapType.GAP_UP,
        breach_status=BreachStatus.ABOVE_HIGH,
        current_price=2472.0,
        distance_from_high_percent=0.16,
        distance_from_low_percent=1.31,
        breach_significance=0.78,
    )
    print(f"  Previous Day High: {prev_day_levels.prev_day_high:.2f}")
    print(f"  Previous Day Low: {prev_day_levels.prev_day_low:.2f}")
    print(f"  Breach Status: {prev_day_levels.breach_status.value}")
    print(f"  Breach Significance: {prev_day_levels.breach_significance:.2f}")

    # Set trade parameters
    print("\n4. Setting trade parameters...")
    current_price = 2472.0
    entry_price = 2472.0
    stop_loss = 2465.0  # 7 points risk
    target = 2486.0  # 14 points reward (2:1 R:R)
    print(f"  Entry: {entry_price:.2f}")
    print(f"  Stop Loss: {stop_loss:.2f}")
    print(f"  Target: {target:.2f}")
    print(f"  Risk: {entry_price - stop_loss:.2f} points")
    print(f"  Reward: {target - entry_price:.2f} points")
    print(f"  Risk/Reward Ratio: {(target - entry_price) / (entry_price - stop_loss):.2f}:1")

    # Calculate score with default weights
    print_section_header("Scoring Results (Default Weights)")
    result = IntradayScoringService.calculate_score(
        analysis=analysis,
        current_price=current_price,
        opening_range=opening_range,
        prev_day_levels=prev_day_levels,
        entry_price=entry_price,
        stop_loss=stop_loss,
        target=target,
    )

    print(f"\n  TOTAL SCORE: {result.total_score:.1f}/100")
    print("\n  Component Scores:")
    print(f"    • Trend:              {result.components.trend_score:.1f}/100")
    print(f"    • Momentum:           {result.components.momentum_score:.1f}/100")
    print(f"    • Volume:             {result.components.volume_score:.1f}/100")
    print(f"    • VWAP Position:      {result.components.vwap_score:.1f}/100")
    print(f"    • Opening Range:      {result.components.opening_range_score:.1f}/100")
    print(f"    • Prev Day Levels:    {result.components.prev_day_levels_score:.1f}/100")
    print(f"    • Risk/Reward:        {result.components.risk_reward_score:.1f}/100")

    print("\n  Signal Analysis:")
    for i, signal in enumerate(result.signals, 1):
        print(f"    {i}. {signal}")

    # Calculate score with custom weights (emphasize trend and momentum)
    print_section_header("Scoring Results (Custom Weights - Trend/Momentum Focus)")
    custom_weights = IntradayScoringWeights(
        trend_weight=0.30,  # Increased from 25%
        momentum_weight=0.25,  # Increased from 20%
        volume_weight=0.15,  # Same
        vwap_weight=0.10,  # Decreased from 15%
        opening_range_weight=0.10,  # Same
        prev_day_levels_weight=0.05,  # Decreased from 10%
        risk_reward_weight=0.05,  # Same
    )

    result_custom = IntradayScoringService.calculate_score(
        analysis=analysis,
        current_price=current_price,
        opening_range=opening_range,
        prev_day_levels=prev_day_levels,
        entry_price=entry_price,
        stop_loss=stop_loss,
        target=target,
        weights=custom_weights,
    )

    print(f"\n  TOTAL SCORE: {result_custom.total_score:.1f}/100")
    print("\n  Component Scores (same as before):")
    print(f"    • Trend:              {result_custom.components.trend_score:.1f}/100")
    print(f"    • Momentum:           {result_custom.components.momentum_score:.1f}/100")
    print(f"    • Volume:             {result_custom.components.volume_score:.1f}/100")
    print(f"    • VWAP Position:      {result_custom.components.vwap_score:.1f}/100")
    print(f"    • Opening Range:      {result_custom.components.opening_range_score:.1f}/100")
    print(f"    • Prev Day Levels:    {result_custom.components.prev_day_levels_score:.1f}/100")
    print(f"    • Risk/Reward:        {result_custom.components.risk_reward_score:.1f}/100")

    print(f"\n  Score Difference: {result_custom.total_score - result.total_score:+.1f} points")
    print("  (Custom weights emphasize trend and momentum)")

    # Test with a weak setup
    print_section_header("Scoring Results (Weak Setup Example)")
    weak_analysis = IntradayTechnicalAnalysis(
        rsi=35.0,  # Weak RSI
        macd=MACDIndicator(
            value=-1.5,
            signal=-1.0,
            histogram=-0.5,  # Negative histogram
        ),
        ema_9=2460.0,
        ema_21=2465.0,  # Bearish EMA alignment
        ema_50=2470.0,
        vwap=2470.0,  # VWAP above current price
        atr=20.0,
        volume=80000,
        relative_volume=0.65,  # Below average volume
        bollinger_bands=BollingerBands(
            upper=2480.0,
            middle=2460.0,
            lower=2440.0,
        ),
    )

    weak_opening_range = OpeningRangeResult(
        high=2470.0,
        low=2455.0,
        midpoint=2462.5,
        range_size=15.0,
        range_percent=0.61,
        breakout_status=BreakoutStatus.NO_BREAKOUT,
        current_price=2462.0,
        breakout_distance=None,
        volume_confirmed=False,
        volume_ratio=0.65,
    )

    weak_prev_day_levels = PreviousDayLevelsResult(
        prev_day_high=2480.0,
        prev_day_low=2450.0,
        prev_day_close=2475.0,
        gap_percent=-0.53,
        gap_type=GapType.GAP_DOWN,
        breach_status=BreachStatus.WITHIN_RANGE,
        current_price=2462.0,
        distance_from_high_percent=-0.73,
        distance_from_low_percent=0.49,
        breach_significance=0.0,
    )

    weak_result = IntradayScoringService.calculate_score(
        analysis=weak_analysis,
        current_price=2462.0,
        opening_range=weak_opening_range,
        prev_day_levels=weak_prev_day_levels,
        entry_price=2462.0,
        stop_loss=2455.0,
        target=2469.0,  # 1:1 R:R
    )

    print(f"\n  TOTAL SCORE: {weak_result.total_score:.1f}/100")
    print("\n  Component Scores:")
    print(f"    • Trend:              {weak_result.components.trend_score:.1f}/100")
    print(f"    • Momentum:           {weak_result.components.momentum_score:.1f}/100")
    print(f"    • Volume:             {weak_result.components.volume_score:.1f}/100")
    print(f"    • VWAP Position:      {weak_result.components.vwap_score:.1f}/100")
    print(f"    • Opening Range:      {weak_result.components.opening_range_score:.1f}/100")
    print(f"    • Prev Day Levels:    {weak_result.components.prev_day_levels_score:.1f}/100")
    print(f"    • Risk/Reward:        {weak_result.components.risk_reward_score:.1f}/100")

    print("\n  Signal Analysis:")
    for i, signal in enumerate(weak_result.signals, 1):
        print(f"    {i}. {signal}")

    print_section_header("Demo Complete")
    print("\nKey Takeaways:")
    print("  • Strong setup scored: {:.1f}/100 (Good opportunity)".format(result.total_score))
    print("  • Weak setup scored: {:.1f}/100 (Avoid trade)".format(weak_result.total_score))
    print("  • Custom weights can adjust scoring priorities")
    print("  • All scoring is deterministic - same inputs always produce same outputs")
    print("  • NO AI involved - pure quantitative analysis")
    print()


if __name__ == "__main__":
    main()
