"""
Demo script for ScoringService.

This script demonstrates the scoring service functionality with
different market scenarios: bullish, bearish, and neutral.
"""

from models import IndicatorResult, MACDValues, BollingerBands
from services.scoring_service import ScoringService


def print_score_result(scenario_name: str, current_price: float, result):
    """Print formatted score result."""
    print(f"\n{'=' * 80}")
    print(f"SCENARIO: {scenario_name}")
    print(f"{'=' * 80}")
    print(f"Current Price: ${current_price:.2f}")
    print(f"\nTrend: {result.trend.value}")
    print(f"Score: {result.score:.2f}/100")
    print("\nKey Indicators:")
    print(f"  RSI: {result.rsi:.1f}")
    print(f"  ADX: {result.adx:.1f}")
    print(f"  VWAP: ${result.vwap:.2f}")
    print(f"  Volume Ratio: {result.volumeRatio:.2f}x")
    print("\nSignals:")
    for i, signal in enumerate(result.signals, 1):
        print(f"  {i}. {signal}")
    print(f"{'=' * 80}")


def demo_bullish_scenario():
    """Demonstrate bullish market scoring."""
    # Strong bullish indicators
    indicators = IndicatorResult(
        rsi=68.5,
        macd=MACDValues(value=15.3, signal=12.1, histogram=3.2),
        sma_20=2455.0,
        sma_50=2450.0,
        sma_200=2380.0,
        ema_5=2472.5,
        ema_15=2470.0,
        ema_20=2468.0,
        ema_50=2462.0,
        ema_200=2395.0,
        bollinger_bands=BollingerBands(upper=2510.0, middle=2465.0, lower=2420.0),
        adx=32.5,
        atr=48.3,
        vwap=2466.0,
        volume_ma=1000000.0,
        relative_volume=1.55,
        week_52_high=2650.0,
        week_52_low=2200.0,
        momentum=18.7,
    )

    current_price = 2475.0
    result = ScoringService.score_market(current_price, indicators)
    print_score_result("Strong Bullish Market", current_price, result)


def demo_bearish_scenario():
    """Demonstrate bearish market scoring."""
    # Strong bearish indicators
    indicators = IndicatorResult(
        rsi=28.3,
        macd=MACDValues(value=-12.5, signal=-9.8, histogram=-2.7),
        sma_20=2455.0,
        sma_50=2450.0,
        sma_200=2380.0,
        ema_5=2342.5,
        ema_15=2345.0,
        ema_20=2348.0,
        ema_50=2352.0,
        ema_200=2375.0,
        bollinger_bands=BollingerBands(upper=2390.0, middle=2345.0, lower=2300.0),
        adx=35.2,
        atr=52.8,
        vwap=2355.0,
        volume_ma=1000000.0,
        relative_volume=1.72,
        week_52_high=2650.0,
        week_52_low=2200.0,
        momentum=-21.4,
    )

    current_price = 2340.0
    result = ScoringService.score_market(current_price, indicators)
    print_score_result("Strong Bearish Market", current_price, result)


def demo_neutral_scenario():
    """Demonstrate neutral market scoring."""
    # Neutral/sideways indicators
    indicators = IndicatorResult(
        rsi=48.5,
        macd=MACDValues(value=2.1, signal=1.8, histogram=0.3),
        sma_20=2455.0,
        sma_50=2450.0,
        sma_200=2380.0,
        ema_5=2458.0,
        ema_15=2457.0,
        ema_20=2456.0,
        ema_50=2452.0,
        ema_200=2385.0,
        bollinger_bands=BollingerBands(upper=2480.0, middle=2455.0, lower=2430.0),
        adx=16.8,
        atr=38.5,
        vwap=2454.0,
        volume_ma=1000000.0,
        relative_volume=0.92,
        week_52_high=2650.0,
        week_52_low=2200.0,
        momentum=2.3,
    )

    current_price = 2453.0
    result = ScoringService.score_market(current_price, indicators)
    print_score_result("Neutral/Sideways Market", current_price, result)


def demo_overbought_scenario():
    """Demonstrate overbought market scoring."""
    # Overbought indicators
    indicators = IndicatorResult(
        rsi=78.2,
        macd=MACDValues(value=18.5, signal=15.2, histogram=3.3),
        sma_20=2455.0,
        sma_50=2450.0,
        sma_200=2380.0,
        ema_5=2492.5,
        ema_15=2488.0,
        ema_20=2485.0,
        ema_50=2475.0,
        ema_200=2420.0,
        bollinger_bands=BollingerBands(upper=2520.0, middle=2480.0, lower=2440.0),
        adx=28.5,
        atr=55.3,
        vwap=2482.0,
        volume_ma=1000000.0,
        relative_volume=1.85,
        week_52_high=2650.0,
        week_52_low=2200.0,
        momentum=25.8,
    )

    current_price = 2495.0
    result = ScoringService.score_market(current_price, indicators)
    print_score_result("Overbought Market", current_price, result)


def demo_oversold_scenario():
    """Demonstrate oversold market scoring."""
    # Oversold indicators
    indicators = IndicatorResult(
        rsi=22.5,
        macd=MACDValues(value=-15.8, signal=-12.3, histogram=-3.5),
        sma_20=2455.0,
        sma_50=2450.0,
        sma_200=2380.0,
        ema_5=2322.5,
        ema_15=2325.0,
        ema_20=2328.0,
        ema_50=2335.0,
        ema_200=2365.0,
        bollinger_bands=BollingerBands(upper=2370.0, middle=2325.0, lower=2280.0),
        adx=30.8,
        atr=58.7,
        vwap=2335.0,
        volume_ma=1000000.0,
        relative_volume=1.95,
        week_52_high=2650.0,
        week_52_low=2200.0,
        momentum=-28.3,
    )

    current_price = 2320.0
    result = ScoringService.score_market(current_price, indicators)
    print_score_result("Oversold Market", current_price, result)


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("SCORING SERVICE DEMONSTRATION")
    print("=" * 80)
    print(
        "\nThis demo shows how the scoring service analyzes different market conditions"
    )
    print("and generates deterministic scores with human-readable signals.")

    demo_bullish_scenario()
    demo_bearish_scenario()
    demo_neutral_scenario()
    demo_overbought_scenario()
    demo_oversold_scenario()

    print("\n" + "=" * 80)
    print("DEMONSTRATION COMPLETE")
    print("=" * 80)
    print("\nKey takeaways:")
    print("1. Trend classification is based on price vs EMAs, RSI, and ADX")
    print("2. Score (0-100) combines RSI, ADX, VWAP position, and volume")
    print("3. Signals provide human-readable explanations")
    print("4. Same inputs always produce same outputs (deterministic)")
    print()
