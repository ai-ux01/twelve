"""
Demonstration of Market Regime Detection Service.

Shows how the service classifies different market conditions.
"""

from datetime import datetime, timedelta
from services.market_regime_service import MarketRegimeService
from models import OHLCVData, MarketRegimeEnum
import random


def generate_demo_data(regime_type: str) -> list[OHLCVData]:
    """Generate demo data for different market regimes."""
    base_price = 21000.0
    num_candles = 250
    start_date = datetime.now() - timedelta(days=250)
    data = []
    current_price = base_price
    mean_price = base_price

    for i in range(num_candles):
        random.seed(42 + i)

        if regime_type == "bull":
            # Strong uptrend
            current_price = current_price * 1.003
            daily_noise = 0.003
            vol_range = 0.005
        elif regime_type == "bear":
            # Strong downtrend
            current_price = current_price * 0.997
            daily_noise = 0.003
            vol_range = 0.005
        elif regime_type == "sideways":
            # Mean-reverting sideways
            drift_from_mean = current_price - mean_price
            mean_revert_force = -drift_from_mean * 0.1
            current_price = current_price + mean_revert_force
            daily_noise = 0.003
            vol_range = 0.005
        else:  # volatile
            # High volatility with random walk
            daily_noise = 0.025
            vol_range = 0.035

        # Add daily noise
        daily_change = random.gauss(0, daily_noise)
        current_price = current_price * (1 + daily_change)

        # Generate OHLC
        open_price = current_price * (1 + random.uniform(-vol_range / 2, vol_range / 2))
        close = current_price * (1 + random.uniform(-vol_range / 2, vol_range / 2))
        high = max(open_price, close) * (1 + abs(random.uniform(0, vol_range)))
        low = min(open_price, close) * (1 - abs(random.uniform(0, vol_range)))

        high = max(high, open_price, close)
        low = min(low, open_price, close)

        if low <= 0:
            low = base_price * 0.01
            high = base_price * 1.5
            open_price = base_price
            close = base_price
            current_price = base_price

        volume = int(1000000 + random.uniform(-200000, 200000))

        data.append(
            OHLCVData(
                timestamp=start_date + timedelta(days=i),
                open=round(open_price, 2),
                high=round(high, 2),
                low=round(low, 2),
                close=round(close, 2),
                volume=volume,
            )
        )

    return data


def print_regime_analysis(regime_type: str, service: MarketRegimeService):
    """Print analysis for a given regime type."""
    print("=" * 70)
    print(f"Market Regime Analysis: {regime_type.upper()}")
    print("=" * 70)

    data = generate_demo_data(regime_type)
    result = service.detect_regime(data)

    # Calculate price change
    closes = [d.close for d in data]
    price_change = ((closes[-1] - closes[0]) / closes[0]) * 100

    print(f"\nPrice Data:")
    print(f"  First Close: ₹{closes[0]:,.2f}")
    print(f"  Last Close:  ₹{closes[-1]:,.2f}")
    print(f"  Change:      {price_change:+.2f}%")

    print(f"\nDetected Regime: {result.regime.value}")
    print(f"Regime Strength: {result.strength:.2f} / 1.00")

    print(f"\nTechnical Indicators:")
    print(f"  EMA 20:      ₹{result.ema_20:,.2f}")
    print(f"  EMA 50:      ₹{result.ema_50:,.2f}")
    print(f"  EMA 200:     ₹{result.ema_200:,.2f}")
    print(f"  RSI:         {result.rsi:.1f}")
    print(f"  ADX:         {result.adx:.1f}")
    print(f"  ATR:         ₹{result.atr:.2f}")
    print(f"  Volatility:  {result.volatility:.2f}%")

    print(f"\nClassification Signals:")
    for i, signal in enumerate(result.signals, 1):
        print(f"  {i}. {signal}")

    # Interpretation
    print(f"\nTrading Implications:")
    if result.regime == MarketRegimeEnum.BULL_MARKET:
        if result.strength > 0.7:
            print("  ✅ Strong bull market - favor long positions")
            print("  ✅ Good environment for swing trading longs")
        else:
            print("  ⚠️  Moderate bull market - cautious long bias")
    elif result.regime == MarketRegimeEnum.BEAR_MARKET:
        if result.strength > 0.7:
            print("  ❌ Strong bear market - avoid longs or short")
            print("  ❌ Not favorable for swing trading longs")
        else:
            print("  ⚠️  Moderate bear market - cautious short bias")
    elif result.regime == MarketRegimeEnum.SIDEWAYS:
        print("  ↔️  Sideways market - use range-trading strategies")
        print("  ↔️  Look for breakout setups rather than trend following")
    else:  # VOLATILE
        print("  ⚠️  High volatility - reduce position sizes")
        print("  ⚠️  Wait for volatility to decrease before trading")

    print()


def main():
    """Run demonstration of all market regimes."""
    print("\n" + "=" * 70)
    print("MARKET REGIME DETECTION SERVICE DEMONSTRATION")
    print("=" * 70)
    print("\nThis demo shows how the service classifies different market conditions")
    print("using NIFTY 50-like data with various characteristics.\n")

    service = MarketRegimeService()

    # Demonstrate each regime type
    print_regime_analysis("bull", service)
    print_regime_analysis("bear", service)
    print_regime_analysis("sideways", service)
    print_regime_analysis("volatile", service)

    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print("\nThe MarketRegimeService successfully classifies markets into:")
    print("  1. BULL_MARKET   - Strong uptrend with EMA alignment")
    print("  2. BEAR_MARKET   - Strong downtrend with inverted EMAs")
    print("  3. SIDEWAYS      - Weak trend with clustered EMAs")
    print("  4. VOLATILE      - High volatility regardless of trend")
    print("\nEach classification includes:")
    print("  • Strength score (0.0 - 1.0)")
    print("  • Supporting technical indicators")
    print("  • Human-readable signals")
    print("\nThis helps swing trading strategies adjust to market conditions.")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
