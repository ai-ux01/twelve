"""
Demo script for swing scoring component functions.

This script demonstrates all 7 component scoring functions and shows
how they combine to produce a total swing score.

Requirements: 5.3
"""

from calculators.swing_scoring import (
    calculate_trend_score,
    calculate_technical_score,
    calculate_volume_score,
    calculate_relative_strength_score,
    calculate_breakout_score,
    calculate_sector_score,
    calculate_risk_reward_score,
    calculate_total_swing_score,
)
from models import IndicatorResult, MACDValues, BollingerBands


def create_sample_indicators():
    """Create sample indicator data for RELIANCE."""
    return IndicatorResult(
        rsi=58.5,
        macd=MACDValues(value=15.2, signal=12.8, histogram=2.4),
        sma_20=2455.0,
        sma_50=2450.0,
        sma_200=2380.0,
        ema_5=2468.0,
        ema_15=2465.0,
        ema_20=2460.0,
        ema_50=2455.0,
        ema_200=2390.0,
        bollinger_bands=BollingerBands(upper=2520.0, middle=2465.0, lower=2410.0),
        adx=32.4,
        atr=38.5,
        vwap=2463.0,
        volume_ma=1200000.0,
        relative_volume=1.42,
        week_52_high=2680.0,
        week_52_low=2180.0,
        momentum=12.8,
    )


def main():
    """Run demo."""
    print()
    print("*" * 70)
    print("SWING TRADING COMPONENT SCORING DEMO")
    print("Stock: RELIANCE | Timeframe: Daily | Date: 2024-01-15")
    print("*" * 70)
    print()

    # Calculate all component scores
    indicators = create_sample_indicators()
    current_price = 2470.0

    print("Component Scores:")
    print("=" * 70)

    trend_score = calculate_trend_score(current_price, indicators)
    print(f"1. Trend Score:             {trend_score:6.2f}/100")

    technical_score = calculate_technical_score(indicators)
    print(f"2. Technical Score:         {technical_score:6.2f}/100")

    volume_score = calculate_volume_score(indicators)
    print(f"3. Volume Score:            {volume_score:6.2f}/100")

    relative_strength_score = calculate_relative_strength_score(8.5, 5.2, 4.1)
    print(f"4. Relative Strength Score: {relative_strength_score:6.2f}/100")

    breakout_score = calculate_breakout_score(True, True, True, 0.85)
    print(f"5. Breakout Score:          {breakout_score:6.2f}/100")

    sector_score = calculate_sector_score(72.5)
    print(f"6. Sector Score:            {sector_score:6.2f}/100")

    risk_reward_score = calculate_risk_reward_score(2470.0, 2420.0, 2570.0)
    print(f"7. Risk/Reward Score:       {risk_reward_score:6.2f}/100")

    print()
    print("Weighted Contributions:")
    print("=" * 70)
    print(
        f"  1. Trend:             {trend_score:6.2f} × 20% = {trend_score * 0.20:6.2f}"
    )
    print(
        f"  2. Technical:         {technical_score:6.2f} × 20% = {technical_score * 0.20:6.2f}"
    )
    print(
        f"  3. Volume:            {volume_score:6.2f} × 15% = {volume_score * 0.15:6.2f}"
    )
    print(
        f"  4. Relative Strength: {relative_strength_score:6.2f} × 15% = {relative_strength_score * 0.15:6.2f}"
    )
    print(
        f"  5. Breakout:          {breakout_score:6.2f} × 10% = {breakout_score * 0.10:6.2f}"
    )
    print(
        f"  6. Sector:            {sector_score:6.2f} × 10% = {sector_score * 0.10:6.2f}"
    )
    print(
        f"  7. Risk/Reward:       {risk_reward_score:6.2f} × 10% = {risk_reward_score * 0.10:6.2f}"
    )
    print()

    total_score = calculate_total_swing_score(
        trend_score,
        technical_score,
        volume_score,
        relative_strength_score,
        breakout_score,
        sector_score,
        risk_reward_score,
    )

    print("=" * 70)
    print(f"✓ TOTAL SWING SCORE: {total_score:.2f}/100")
    print("=" * 70)
    print()

    # Interpretation
    if total_score >= 75:
        rating = "EXCELLENT"
        recommendation = "Strong BUY candidate"
    elif total_score >= 65:
        rating = "GOOD"
        recommendation = "BUY candidate"
    elif total_score >= 55:
        rating = "MODERATE"
        recommendation = "Consider with caution"
    else:
        rating = "WEAK"
        recommendation = "NO TRADE"

    print(f"Rating: {rating}")
    print(f"Recommendation: {recommendation}")
    print()


if __name__ == "__main__":
    main()
