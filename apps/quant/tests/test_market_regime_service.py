"""
Unit tests for Market Regime Detection Service.

Tests all four regime classifications (BULL_MARKET, BEAR_MARKET, SIDEWAYS, VOLATILE)
and validates strength calculations and signal generation.

Requirements: 5.2, 16.5
"""

import pytest
from datetime import datetime, timedelta
from models.market_data import OHLCVData, MarketRegimeEnum
from services.market_regime_service import MarketRegimeService


def generate_test_data(
    base_price: float,
    num_candles: int,
    trend: str = "up",
    volatility: str = "low",
    start_date: datetime = None,
) -> list[OHLCVData]:
    """
    Generate realistic test OHLCV data with specified characteristics.

    Fixed version that prevents extreme price movements and maintains
    realistic volatility levels.

    Args:
        base_price: Starting price
        num_candles: Number of candles to generate
        trend: 'up', 'down', or 'sideways'
        volatility: 'low', 'medium', or 'high'
        start_date: Starting date (defaults to 300 days ago)

    Returns:
        List of OHLCVData
    """
    if start_date is None:
        start_date = datetime.now() - timedelta(days=300)

    data = []

    # Set trend parameters (per candle percentage change)
    if trend == "up":
        trend_drift = 0.003  # 0.3% per candle average
    elif trend == "down":
        trend_drift = -0.003  # -0.3% per candle average
    else:  # sideways
        trend_drift = 0.0

    # Set volatility parameters (intraday range as % of price)
    if volatility == "low":
        vol_range = 0.005  # 0.5% intraday range
        daily_noise = 0.003  # 0.3% daily noise
    elif volatility == "medium":
        vol_range = 0.015  # 1.5% intraday range
        daily_noise = 0.010  # 1.0% daily noise
    else:  # high
        vol_range = 0.030  # 3.0% intraday range
        daily_noise = 0.020  # 2.0% daily noise

    # Start with base price
    current_price = base_price

    # For sideways market, use mean reversion to keep price stable
    mean_price = base_price

    for i in range(num_candles):
        # Add some randomness
        import random

        random.seed(42 + i)  # Consistent randomness for testing

        if trend == "sideways":
            # Mean reversion: pull price back to base_price
            drift_from_mean = current_price - mean_price
            mean_revert_force = -drift_from_mean * 0.1  # Pull back 10% of distance
            current_price = current_price + mean_revert_force

            # Small random noise
            daily_change = random.gauss(0, daily_noise)
            current_price = current_price * (1 + daily_change)
        else:
            # Apply trend drift
            current_price = current_price * (1 + trend_drift)

            # Add random daily noise (mean-reverting around trend)
            daily_change = random.gauss(0, daily_noise)
            current_price = current_price * (1 + daily_change)

        # Generate OHLC around current price
        open_price = current_price * (1 + random.uniform(-vol_range / 2, vol_range / 2))
        close = current_price * (1 + random.uniform(-vol_range / 2, vol_range / 2))

        # High and low relative to open and close
        high = max(open_price, close) * (1 + abs(random.uniform(0, vol_range)))
        low = min(open_price, close) * (1 - abs(random.uniform(0, vol_range)))

        # Ensure OHLC relationships
        high = max(high, open_price, close)
        low = min(low, open_price, close)

        # Ensure positive prices
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


class TestMarketRegimeServiceInitialization:
    """Test MarketRegimeService initialization and parameter validation."""

    def test_default_initialization(self):
        """Test service initializes with default parameters."""
        service = MarketRegimeService()
        assert service.rsi_period == 14
        assert service.adx_period == 14
        assert service.atr_period == 14
        assert service.volatility_period == 20

    def test_custom_initialization(self):
        """Test service initializes with custom parameters."""
        service = MarketRegimeService(
            rsi_period=21,
            adx_period=20,
            atr_period=10,
            volatility_period=30,
        )
        assert service.rsi_period == 21
        assert service.adx_period == 20
        assert service.atr_period == 10
        assert service.volatility_period == 30

    def test_invalid_rsi_period(self):
        """Test initialization fails with invalid RSI period."""
        with pytest.raises(ValueError, match="rsi_period must be positive"):
            MarketRegimeService(rsi_period=0)

        with pytest.raises(ValueError, match="rsi_period must be positive"):
            MarketRegimeService(rsi_period=-5)

    def test_invalid_adx_period(self):
        """Test initialization fails with invalid ADX period."""
        with pytest.raises(ValueError, match="adx_period must be positive"):
            MarketRegimeService(adx_period=0)

    def test_invalid_atr_period(self):
        """Test initialization fails with invalid ATR period."""
        with pytest.raises(ValueError, match="atr_period must be positive"):
            MarketRegimeService(atr_period=-1)

    def test_invalid_volatility_period(self):
        """Test initialization fails with invalid volatility period."""
        with pytest.raises(ValueError, match="volatility_period must be positive"):
            MarketRegimeService(volatility_period=0)


class TestMarketRegimeDetection:
    """Test market regime detection logic for all four regimes."""

    def test_bull_market_detection(self):
        """Test detection of BULL_MARKET regime."""
        service = MarketRegimeService()

        # Generate strong uptrend data with low volatility
        data = generate_test_data(
            base_price=20000,
            num_candles=250,
            trend="up",
            volatility="low",
        )

        result = service.detect_regime(data)

        # Should detect BULL_MARKET
        assert result.regime == MarketRegimeEnum.BULL_MARKET

        # Should have good strength
        assert result.strength > 0.5

        # Check EMA alignment (bullish)
        assert result.ema_20 > result.ema_50 > result.ema_200

        # Check RSI is in bullish range
        assert result.rsi > 50

        # Check signals mention bullish characteristics
        signal_text = " ".join(result.signals).lower()
        assert "bullish" in signal_text or "ema" in signal_text

        # Volatility should be low
        assert result.volatility < 2.5

    def test_bear_market_detection(self):
        """Test detection of BEAR_MARKET regime."""
        service = MarketRegimeService()

        # Generate strong downtrend data with low volatility
        data = generate_test_data(
            base_price=22000,
            num_candles=250,
            trend="down",
            volatility="low",
        )

        result = service.detect_regime(data)

        # Should detect BEAR_MARKET
        assert result.regime == MarketRegimeEnum.BEAR_MARKET

        # Should have good strength
        assert result.strength > 0.5

        # Check EMA alignment (bearish)
        assert result.ema_20 < result.ema_50 < result.ema_200

        # Check RSI is in bearish range
        assert result.rsi < 50

        # Check signals mention bearish characteristics
        signal_text = " ".join(result.signals).lower()
        assert "bearish" in signal_text or "below" in signal_text

        # Volatility should be low
        assert result.volatility < 2.5

    def test_sideways_market_detection(self):
        """Test detection of SIDEWAYS regime."""
        service = MarketRegimeService()

        # Generate sideways data with low volatility
        data = generate_test_data(
            base_price=21000,
            num_candles=250,
            trend="sideways",
            volatility="low",
        )

        result = service.detect_regime(data)

        # Should detect SIDEWAYS
        assert result.regime == MarketRegimeEnum.SIDEWAYS

        # Should have moderate strength
        assert result.strength > 0.3

        # Check EMAs are relatively clustered
        ema_range = max(result.ema_20, result.ema_50, result.ema_200) - min(
            result.ema_20, result.ema_50, result.ema_200
        )
        current_price = data[-1].close
        ema_range_pct = ema_range / current_price * 100
        assert ema_range_pct < 3.0  # Should be relatively small

        # Check ADX indicates weak trend
        assert result.adx < 30

        # Check signals mention sideways characteristics
        signal_text = " ".join(result.signals).lower()
        assert (
            "weak trend" in signal_text
            or "neutral" in signal_text
            or "clustered" in signal_text
        )

    def test_volatile_market_detection(self):
        """Test detection of VOLATILE regime."""
        service = MarketRegimeService()

        # Generate data with high volatility
        data = generate_test_data(
            base_price=21000,
            num_candles=250,
            trend="sideways",
            volatility="high",
        )

        result = service.detect_regime(data)

        # Should detect VOLATILE
        assert result.regime == MarketRegimeEnum.VOLATILE

        # Should have high strength
        assert result.strength > 0.6

        # Check volatility is high
        assert result.volatility > 2.5 or (result.atr / data[-1].close * 100) > 2.0

        # Check signals mention volatility
        signal_text = " ".join(result.signals).lower()
        assert "volatility" in signal_text or "atr" in signal_text

    def test_volatile_uptrend(self):
        """Test detection of VOLATILE regime even in uptrend if volatility is high."""
        service = MarketRegimeService()

        # Generate uptrend with high volatility
        data = generate_test_data(
            base_price=20000,
            num_candles=250,
            trend="up",
            volatility="high",
        )

        result = service.detect_regime(data)

        # Should detect VOLATILE (overrides bull market due to high volatility)
        assert result.regime == MarketRegimeEnum.VOLATILE

        # Check volatility is high
        assert result.volatility > 2.5 or (result.atr / data[-1].close * 100) > 2.0


class TestMarketRegimeServiceValidation:
    """Test input validation and error handling."""

    def test_empty_data(self):
        """Test detection fails with empty data."""
        service = MarketRegimeService()

        with pytest.raises(ValueError, match="data cannot be empty"):
            service.detect_regime([])

    def test_insufficient_data(self):
        """Test detection fails with insufficient data."""
        service = MarketRegimeService()

        # Generate only 50 candles (need at least 200)
        data = generate_test_data(
            base_price=21000,
            num_candles=50,
            trend="up",
            volatility="low",
        )

        with pytest.raises(ValueError, match="Insufficient data"):
            service.detect_regime(data)

    def test_minimum_required_data(self):
        """Test detection works with minimum required data (200 candles)."""
        service = MarketRegimeService()

        # Generate exactly 200 candles
        data = generate_test_data(
            base_price=21000,
            num_candles=200,
            trend="up",
            volatility="low",
        )

        # Should not raise error
        result = service.detect_regime(data)
        assert result is not None
        assert isinstance(result.regime, MarketRegimeEnum)


class TestMarketRegimeStrength:
    """Test regime strength calculation."""

    def test_strong_bull_market_high_strength(self):
        """Test strong bull market has high strength score."""
        service = MarketRegimeService()

        # Generate very strong uptrend
        data = generate_test_data(
            base_price=19000,
            num_candles=250,
            trend="up",
            volatility="low",
        )

        result = service.detect_regime(data)

        if result.regime == MarketRegimeEnum.BULL_MARKET:
            # Strong alignment should give high strength
            assert result.strength > 0.7

    def test_strength_bounds(self):
        """Test strength is always between 0 and 1."""
        service = MarketRegimeService()

        # Test with various market conditions
        test_cases = [
            ("up", "low"),
            ("down", "low"),
            ("sideways", "low"),
            ("sideways", "high"),
        ]

        for trend, volatility in test_cases:
            data = generate_test_data(
                base_price=21000,
                num_candles=250,
                trend=trend,
                volatility=volatility,
            )

            result = service.detect_regime(data)

            # Strength must be in valid range
            assert 0.0 <= result.strength <= 1.0, (
                f"Strength {result.strength} out of bounds for "
                f"trend={trend}, volatility={volatility}"
            )


class TestMarketRegimeSignals:
    """Test signal generation for regime detection."""

    def test_signals_not_empty(self):
        """Test that signals are always provided."""
        service = MarketRegimeService()

        data = generate_test_data(
            base_price=21000,
            num_candles=250,
            trend="up",
            volatility="low",
        )

        result = service.detect_regime(data)

        # Should have at least one signal
        assert len(result.signals) > 0

    def test_bull_market_signals(self):
        """Test bull market has relevant signals."""
        service = MarketRegimeService()

        data = generate_test_data(
            base_price=20000,
            num_candles=250,
            trend="up",
            volatility="low",
        )

        result = service.detect_regime(data)

        if result.regime == MarketRegimeEnum.BULL_MARKET:
            signal_text = " ".join(result.signals).lower()

            # Should mention EMA alignment or trend strength
            assert (
                "ema" in signal_text or "trend" in signal_text or "rsi" in signal_text
            )

    def test_volatile_market_signals(self):
        """Test volatile market mentions volatility in signals."""
        service = MarketRegimeService()

        data = generate_test_data(
            base_price=21000,
            num_candles=250,
            trend="sideways",
            volatility="high",
        )

        result = service.detect_regime(data)

        if result.regime == MarketRegimeEnum.VOLATILE:
            signal_text = " ".join(result.signals).lower()

            # Should mention volatility or ATR
            assert "volatility" in signal_text or "atr" in signal_text


class TestMarketRegimeResultModel:
    """Test MarketRegimeResult model structure and validation."""

    def test_result_structure(self):
        """Test result contains all required fields."""
        service = MarketRegimeService()

        data = generate_test_data(
            base_price=21000,
            num_candles=250,
            trend="up",
            volatility="low",
        )

        result = service.detect_regime(data)

        # Check all required fields are present
        assert hasattr(result, "regime")
        assert hasattr(result, "strength")
        assert hasattr(result, "ema_20")
        assert hasattr(result, "ema_50")
        assert hasattr(result, "ema_200")
        assert hasattr(result, "rsi")
        assert hasattr(result, "adx")
        assert hasattr(result, "atr")
        assert hasattr(result, "volatility")
        assert hasattr(result, "signals")

    def test_result_values_valid(self):
        """Test all result values are in valid ranges."""
        service = MarketRegimeService()

        data = generate_test_data(
            base_price=21000,
            num_candles=250,
            trend="up",
            volatility="low",
        )

        result = service.detect_regime(data)

        # Check value ranges
        assert isinstance(result.regime, MarketRegimeEnum)
        assert 0.0 <= result.strength <= 1.0
        assert result.ema_20 > 0
        assert result.ema_50 > 0
        assert result.ema_200 > 0
        assert 0 <= result.rsi <= 100
        assert 0 <= result.adx <= 100
        assert result.atr > 0
        assert result.volatility >= 0
        assert isinstance(result.signals, list)
        assert len(result.signals) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
