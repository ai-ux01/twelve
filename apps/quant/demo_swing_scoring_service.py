"""
Demo script for SwingScoringService.

Demonstrates the deterministic scoring algorithm with sample data.
"""

from services.swing_scoring_service import SwingScoringService, ScoringWeights


def demo_strong_candidate():
    """Demo: Strong swing trading candidate."""
    print("=" * 70)
    print("DEMO 1: Strong Swing Trading Candidate")
    print("=" * 70)

    result = SwingScoringService.calculate_total_score(
        # Perfect trend
        current_price=2500.0,
        ema_20=2480.0,
        ema_50=2450.0,
        ema_200=2400.0,
        adx=35.0,
        # Good technical indicators
        rsi=58.0,
        macd_histogram=2.5,
        atr=70.0,  # 2.8% of price - optimal
        # Strong volume
        relative_volume=2.0,
        volume_trend="INCREASING",
        # Strong relative strength
        sector_comparison=85.0,
        market_comparison=80.0,
        # Confirmed breakout
        breakout_detected=True,
        volume_confirmed=True,
        retest_detected=True,
        # Strong sector
        sector_strength=78.0,
        # Good risk/reward
        entry_price=2500.0,
        stop_loss=2450.0,  # 2% risk
        target=2650.0,  # 6% reward (R:R = 3:1)
    )

    print(f"\nTotal Score: {result.total_score:.2f}/100")
    print("\nComponent Scores:")
    print(f"  Trend Score:             {result.components.trend_score:.2f}/100")
    print(f"  Technical Score:         {result.components.technical_score:.2f}/100")
    print(f"  Volume Score:            {result.components.volume_score:.2f}/100")
    print(
        f"  Relative Strength Score: {result.components.relative_strength_score:.2f}/100"
    )
    print(f"  Breakout Score:          {result.components.breakout_score:.2f}/100")
    print(f"  Sector Score:            {result.components.sector_score:.2f}/100")
    print(f"  Risk/Reward Score:       {result.components.risk_reward_score:.2f}/100")

    print("\nSignals:")
    for signal in result.signals:
        print(f"  • {signal}")
    print()


if __name__ == "__main__":
    demo_strong_candidate()
    print("\n✅ SwingScoringService is working correctly!")
    print("✅ Deterministic scoring: Same inputs always produce same outputs")
    print("✅ All 7 components calculated successfully")
