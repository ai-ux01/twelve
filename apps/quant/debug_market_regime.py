"""Debug market regime detection."""

from datetime import datetime, timedelta
from models.market_data import OHLCVData
from services.market_regime_service import MarketRegimeService
import random


def generate_test_data(
    base_price: float,
    num_candles: int,
    trend: str = "up",
    volatility: str = "low",
    start_date: datetime = None,
) -> list[OHLCVData]:
    """Generate test OHLCV data with specified characteristics."""
    if start_date is None:
        start_date = datetime.now() - timedelta(days=300)

    data = []
    current_price = base_price

    # Set trend and volatility parameters
    if trend == "up":
        trend_increment = base_price * 0.005  # 0.5% per candle
    elif trend == "down":
        trend_increment = -base_price * 0.005  # -0.5% per candle
    else:  # sideways
        trend_increment = 0

    if volatility == "low":
        vol_range = 0.005  # 0.5% intraday range
    elif volatility == "medium":
        vol_range = 0.015  # 1.5% intraday range
    else:  # high
        vol_range = 0.035  # 3.5% intraday range

    for i in range(num_candles):
        # Add some randomness
        random.seed(42 + i)  # Consistent randomness for testing

        # Calculate OHLC with trend and volatility
        noise = random.uniform(-1, 1) * current_price * vol_range * 0.3
        open_price = current_price + noise

        high = open_price + abs(random.uniform(0, 1)) * current_price * vol_range
        low = open_price - abs(random.uniform(0, 1)) * current_price * vol_range
        close = open_price + random.uniform(-1, 1) * current_price * vol_range

        # Ensure OHLC relationships
        high = max(high, open_price, close)
        low = min(low, open_price, close)

        # Ensure positive prices
        if low <= 0:
            adjustment = abs(low) + base_price * 0.01
            low += adjustment
            high += adjustment
            open_price += adjustment
            close += adjustment

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

        # Update current price with trend
        current_price = close + trend_increment

    return data


# Test bear market
print("=" * 60)
print("TEST: BEAR MARKET")
print("=" * 60)
service = MarketRegimeService()
data = generate_test_data(
    base_price=22000,
    num_candles=250,
    trend="down",
    volatility="low",
)
result = service.detect_regime(data)
print(f"Regime: {result.regime}")
print(f"Strength: {result.strength:.3f}")
print(f"Volatility: {result.volatility:.3f}%")
print(f"ATR: {result.atr:.2f}")
print(f"ATR %: {result.atr / data[-1].close * 100:.3f}%")
print(f"Current price: {data[-1].close:.2f}")
print(f"EMA 20: {result.ema_20:.2f}")
print(f"EMA 50: {result.ema_50:.2f}")
print(f"EMA 200: {result.ema_200:.2f}")
print(f"RSI: {result.rsi:.2f}")
print(f"ADX: {result.adx:.2f}")
print(f"Signals: {result.signals}")

print("\n" + "=" * 60)
print("TEST: SIDEWAYS MARKET")
print("=" * 60)
data = generate_test_data(
    base_price=21000,
    num_candles=250,
    trend="sideways",
    volatility="low",
)
result = service.detect_regime(data)
print(f"Regime: {result.regime}")
print(f"Strength: {result.strength:.3f}")
print(f"Volatility: {result.volatility:.3f}%")
print(f"ATR: {result.atr:.2f}")
print(f"ATR %: {result.atr / data[-1].close * 100:.3f}%")
print(f"Current price: {data[-1].close:.2f}")
print(f"EMA 20: {result.ema_20:.2f}")
print(f"EMA 50: {result.ema_50:.2f}")
print(f"EMA 200: {result.ema_200:.2f}")
print(f"RSI: {result.rsi:.2f}")
print(f"ADX: {result.adx:.2f}")
print(f"Signals: {result.signals}")
