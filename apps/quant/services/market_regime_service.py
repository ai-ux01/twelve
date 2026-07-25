"""
Market Regime Detection Service.

This service analyzes market indices (NIFTY 50) to determine overall market conditions.
It classifies the market into four regimes: BULL_MARKET, BEAR_MARKET, SIDEWAYS, VOLATILE.

The classification is based on:
- EMA alignment (20, 50, 200)
- Trend strength (ADX)
- Momentum (RSI)
- Volatility (ATR and price volatility)

Requirements: 5.2
"""

from typing import List
from models.market_data import (
    OHLCVData,
    MarketRegimeResult,
    MarketRegimeEnum,
)
from calculators.moving_averages import calculate_ema
from calculators.rsi import calculate_rsi
from calculators.adx import calculate_adx
from calculators.atr import calculate_atr
import numpy as np


class MarketRegimeService:
    """
    Service for detecting market regime from OHLCV data.

    Analyzes market indices (typically NIFTY 50) to classify overall market conditions.
    The classification helps determine whether swing trading strategies should be
    bullish, bearish, neutral, or avoided entirely.

    Regime Classifications:
    - BULL_MARKET: Strong uptrend with EMA alignment, strong ADX, bullish RSI
    - BEAR_MARKET: Strong downtrend with inverted EMA alignment, strong ADX, bearish RSI
    - SIDEWAYS: Weak trend, clustered EMAs, neutral RSI, low volatility
    - VOLATILE: High volatility regardless of trend, large ATR, choppy price action

    The strength score (0.0-1.0) indicates how clearly defined the regime is.
    """

    def __init__(
        self,
        rsi_period: int = 14,
        adx_period: int = 14,
        atr_period: int = 14,
        volatility_period: int = 20,
    ):
        """
        Initialize the market regime service.

        Args:
            rsi_period: RSI calculation period (default: 14)
            adx_period: ADX calculation period (default: 14)
            atr_period: ATR calculation period (default: 14)
            volatility_period: Period for volatility calculation (default: 20)

        Raises:
            ValueError: If parameters are invalid
        """
        if rsi_period <= 0:
            raise ValueError("rsi_period must be positive")
        if adx_period <= 0:
            raise ValueError("adx_period must be positive")
        if atr_period <= 0:
            raise ValueError("atr_period must be positive")
        if volatility_period <= 0:
            raise ValueError("volatility_period must be positive")

        self.rsi_period = rsi_period
        self.adx_period = adx_period
        self.atr_period = atr_period
        self.volatility_period = volatility_period

    def detect_regime(self, data: List[OHLCVData]) -> MarketRegimeResult:
        """
        Detect market regime from OHLCV data.

        Analyzes the data to classify the market regime and calculate strength.
        Typically used with NIFTY 50 data to determine overall market conditions.

        Args:
            data: List of OHLCV data points (must be sorted by timestamp)
                 Requires at least 200 data points for reliable analysis

        Returns:
            MarketRegimeResult: Detected regime, strength, and supporting metrics

        Raises:
            ValueError: If data is empty or insufficient
        """
        if not data:
            raise ValueError("data cannot be empty")

        # Minimum data requirement: 200 points for 200 EMA
        min_required = max(
            200,  # For 200 EMA
            self.rsi_period + 1,
            2 * self.adx_period + 1,
            self.atr_period + 1,
            self.volatility_period + 1,
        )

        if len(data) < min_required:
            raise ValueError(
                f"Insufficient data: need at least {min_required} data points, "
                f"got {len(data)}"
            )

        # Extract price arrays
        closes = [d.close for d in data]
        highs = [d.high for d in data]
        lows = [d.low for d in data]

        # Calculate technical indicators
        ema_20 = calculate_ema(closes, 20)
        ema_50 = calculate_ema(closes, 50)
        ema_200 = calculate_ema(closes, 200)
        rsi = calculate_rsi(closes, self.rsi_period)
        adx_result = calculate_adx(highs, lows, closes, self.adx_period)
        adx = adx_result["adx"]
        atr = calculate_atr(highs, lows, closes, self.atr_period)

        # Calculate volatility (standard deviation of returns)
        volatility = self._calculate_volatility(closes)

        # Get current price
        current_price = closes[-1]

        # Classify regime
        regime, strength, signals = self._classify_regime(
            current_price=current_price,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            rsi=rsi,
            adx=adx,
            atr=atr,
            volatility=volatility,
        )

        return MarketRegimeResult(
            regime=regime,
            strength=strength,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            rsi=rsi,
            adx=adx,
            atr=atr,
            volatility=volatility,
            signals=signals,
        )

    def _calculate_volatility(self, closes: List[float]) -> float:
        """
        Calculate recent volatility as percentage of price.

        Uses standard deviation of returns over volatility_period.

        Args:
            closes: List of closing prices

        Returns:
            Volatility percentage (e.g., 1.5 means 1.5% volatility)
        """
        if len(closes) < self.volatility_period + 1:
            # Use what we have
            period = len(closes) - 1
        else:
            period = self.volatility_period

        # Get recent prices
        recent_closes = closes[-period - 1 :]

        # Calculate returns
        returns = []
        for i in range(1, len(recent_closes)):
            ret = (recent_closes[i] - recent_closes[i - 1]) / recent_closes[i - 1] * 100
            returns.append(ret)

        # Calculate standard deviation
        volatility = float(np.std(returns))

        return volatility

    def _classify_regime(
        self,
        current_price: float,
        ema_20: float,
        ema_50: float,
        ema_200: float,
        rsi: float,
        adx: float,
        atr: float,
        volatility: float,
    ) -> tuple[MarketRegimeEnum, float, List[str]]:
        """
        Classify market regime based on technical indicators.

        Classification logic:
        1. Check for VOLATILE regime first (high volatility overrides other signals)
        2. Check for BULL_MARKET (EMA alignment + strong trend + bullish RSI)
        3. Check for BEAR_MARKET (inverted EMA + strong trend + bearish RSI)
        4. Default to SIDEWAYS (weak trend + neutral RSI)

        Args:
            current_price: Current price
            ema_20: 20-period EMA
            ema_50: 50-period EMA
            ema_200: 200-period EMA
            rsi: RSI value
            adx: ADX value
            atr: ATR value
            volatility: Recent volatility percentage

        Returns:
            Tuple of (regime, strength, signals)
        """
        signals = []

        # Calculate EMA alignment metrics
        ema_range_pct = (
            (max(ema_20, ema_50, ema_200) - min(ema_20, ema_50, ema_200))
            / current_price
            * 100
        )
        bullish_ema_alignment = current_price > ema_20 > ema_50 > ema_200
        bearish_ema_alignment = current_price < ema_20 < ema_50 < ema_200
        emas_clustered = ema_range_pct < 2.0  # EMAs within 2% range

        # Calculate relative volatility (ATR as % of price)
        atr_pct = atr / current_price * 100

        # 1. Check for VOLATILE regime (highest priority)
        # Volatile if: high volatility (>2.5%) OR high ATR relative to price (>2%)
        if volatility > 2.5 or atr_pct > 2.0:
            strength = min(
                1.0, (volatility / 3.0 + atr_pct / 2.5) / 2
            )  # Normalize to 0-1

            signals.append(f"High volatility ({volatility:.2f}%)")
            signals.append(f"Large ATR relative to price ({atr_pct:.2f}%)")

            if not (bullish_ema_alignment or bearish_ema_alignment):
                signals.append("Choppy price action (mixed EMA signals)")

            # Check for whipsaw price action
            if adx < 25:
                signals.append("Weak trend (ADX < 25) with high volatility")

            return MarketRegimeEnum.VOLATILE, strength, signals

        # 2. Check for BULL_MARKET
        # Bull market if: bullish EMA alignment + strong trend (ADX > 25) + bullish RSI (> 50)
        bull_score = 0.0

        if bullish_ema_alignment:
            bull_score += 0.35
            signals.append("Price above all EMAs (bullish alignment)")
        elif current_price > ema_20 > ema_50:
            bull_score += 0.20
            signals.append("Price above EMA 20 and 50")
        elif current_price > ema_20:
            bull_score += 0.10
            signals.append("Price above EMA 20")

        if adx > 25:
            bull_score += 0.30
            signals.append(f"Strong trend (ADX {adx:.1f} > 25)")
        elif adx > 20:
            bull_score += 0.15
            signals.append(f"Moderate trend (ADX {adx:.1f} > 20)")

        if rsi > 50 and rsi < 70:
            bull_score += 0.25
            signals.append(f"RSI in bullish range ({rsi:.1f})")
        elif rsi >= 70:
            bull_score += 0.15
            signals.append(f"RSI overbought ({rsi:.1f}), but still bullish")

        if volatility < 2.0:
            bull_score += 0.10
            signals.append(f"Low volatility ({volatility:.2f}%)")

        # If bull score is strong enough, classify as BULL_MARKET
        if bull_score >= 0.5:
            strength = min(1.0, bull_score)
            return MarketRegimeEnum.BULL_MARKET, strength, signals

        # 3. Check for BEAR_MARKET
        # Bear market if: bearish EMA alignment + strong trend (ADX > 25) + bearish RSI (< 50)
        signals = []  # Reset signals for bear check
        bear_score = 0.0

        if bearish_ema_alignment:
            bear_score += 0.35
            signals.append("Price below all EMAs (bearish alignment)")
        elif current_price < ema_20 < ema_50:
            bear_score += 0.20
            signals.append("Price below EMA 20 and 50")
        elif current_price < ema_20:
            bear_score += 0.10
            signals.append("Price below EMA 20")

        if adx > 25:
            bear_score += 0.30
            signals.append(f"Strong trend (ADX {adx:.1f} > 25)")
        elif adx > 20:
            bear_score += 0.15
            signals.append(f"Moderate trend (ADX {adx:.1f} > 20)")

        if rsi < 50 and rsi > 30:
            bear_score += 0.25
            signals.append(f"RSI in bearish range ({rsi:.1f})")
        elif rsi <= 30:
            bear_score += 0.15
            signals.append(f"RSI oversold ({rsi:.1f}), but still bearish")

        if volatility < 2.0:
            bear_score += 0.10
            signals.append(f"Low volatility ({volatility:.2f}%)")

        # If bear score is strong enough, classify as BEAR_MARKET
        if bear_score >= 0.5:
            strength = min(1.0, bear_score)
            return MarketRegimeEnum.BEAR_MARKET, strength, signals

        # 4. Default to SIDEWAYS
        # Sideways if: weak trend (ADX < 25) + neutral RSI (40-60) + clustered EMAs
        signals = []  # Reset signals for sideways check
        sideways_score = 0.0

        if emas_clustered:
            sideways_score += 0.35
            signals.append(f"EMAs clustered together ({ema_range_pct:.2f}% range)")

        if adx < 25:
            sideways_score += 0.30
            signals.append(f"Weak trend (ADX {adx:.1f} < 25)")

        if 40 <= rsi <= 60:
            sideways_score += 0.25
            signals.append(f"RSI near neutral ({rsi:.1f})")

        if volatility < 1.5:
            sideways_score += 0.10
            signals.append(f"Low volatility ({volatility:.2f}%)")

        strength = min(
            1.0, max(0.3, sideways_score)
        )  # Minimum strength 0.3 for sideways

        return MarketRegimeEnum.SIDEWAYS, strength, signals
