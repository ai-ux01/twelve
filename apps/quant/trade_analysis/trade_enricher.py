"""
Trade Analysis Engine Trade Enricher.

Enriches TradeRecords with technical indicators and market context
from historical OHLCV data.

Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from .exceptions import EnrichmentError
from .models import MarketRegime, TradeDirection, TradeRecord

logger = logging.getLogger(__name__)


@dataclass
class OHLCVBar:
    """A single OHLCV price bar."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class TradeEnricher:
    """
    Enriches TradeRecords with technical indicators and market context.

    Computes MFE, MAE, RSI, ADX, relative volume, market regime,
    and risk/reward ratio for each trade.

    Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9
    """

    async def enrich(self, trade: TradeRecord, ohlcv_data: Optional[List[OHLCVBar]] = None) -> TradeRecord:
        """
        Enrich a trade record with technical indicators.

        If ohlcv_data is None or empty, the trade is returned with null
        enrichment fields (graceful degradation).

        Args:
            trade: The TradeRecord to enrich.
            ohlcv_data: Historical OHLCV data covering the holding period.

        Returns:
            The enriched TradeRecord (mutated in place and returned).
        """
        # Holding period is always computable
        trade.holding_period_days = (trade.exit_date - trade.entry_date).days

        if not ohlcv_data or len(ohlcv_data) == 0:
            logger.debug(f"No OHLCV data for trade {trade.id}, skipping enrichment")
            return trade

        try:
            # MFE and MAE
            trade.mfe = self.calculate_mfe(ohlcv_data, trade.entry_price, trade.direction)
            trade.mae = self.calculate_mae(ohlcv_data, trade.entry_price, trade.direction)

            # RSI at entry
            close_prices = [bar.close for bar in ohlcv_data]
            if len(close_prices) >= 14:
                trade.rsi_at_entry = self.calculate_rsi(close_prices, period=14)

            # ADX at entry
            highs = [bar.high for bar in ohlcv_data]
            lows = [bar.low for bar in ohlcv_data]
            closes = [bar.close for bar in ohlcv_data]
            if len(ohlcv_data) >= 14:
                trade.adx_at_entry = self.calculate_adx(highs, lows, closes, period=14)

            # Relative volume
            volumes = [bar.volume for bar in ohlcv_data]
            if len(volumes) >= 21:
                trade.volume_ratio = self.calculate_relative_volume(volumes)

            # Market regime classification
            if trade.adx_at_entry is not None and len(ohlcv_data) >= 14:
                atr = self.calculate_atr(highs, lows, closes, period=14)
                avg_price = sum(closes[-14:]) / 14
                trade.market_regime = self.classify_market_regime(
                    trade.adx_at_entry, atr, avg_price
                )

            # Risk/reward ratio
            if trade.stop_loss is not None:
                trade.risk_reward_ratio = self.calculate_risk_reward_ratio(
                    trade.entry_price, trade.exit_price, trade.stop_loss, trade.direction
                )

        except Exception as e:
            logger.warning(f"Enrichment partially failed for trade {trade.id}: {e}")
            # Graceful degradation: leave whatever fields we computed

        return trade

    def calculate_mfe(
        self, ohlcv: List[OHLCVBar], entry_price: float, direction: TradeDirection
    ) -> float:
        """
        Maximum Favorable Excursion.

        LONG: max(highs) - entry_price
        SHORT: entry_price - min(lows)
        """
        if not ohlcv:
            return 0.0

        if direction == TradeDirection.LONG:
            max_high = max(bar.high for bar in ohlcv)
            return max_high - entry_price
        else:
            min_low = min(bar.low for bar in ohlcv)
            return entry_price - min_low

    def calculate_mae(
        self, ohlcv: List[OHLCVBar], entry_price: float, direction: TradeDirection
    ) -> float:
        """
        Maximum Adverse Excursion.

        LONG: entry_price - min(lows)
        SHORT: max(highs) - entry_price
        """
        if not ohlcv:
            return 0.0

        if direction == TradeDirection.LONG:
            min_low = min(bar.low for bar in ohlcv)
            return entry_price - min_low
        else:
            max_high = max(bar.high for bar in ohlcv)
            return max_high - entry_price

    def calculate_rsi(self, close_prices: List[float], period: int = 14) -> float:
        """
        Calculate RSI (Relative Strength Index).

        Uses the standard Wilder's smoothing method.
        Returns RSI value (0-100).
        """
        if len(close_prices) < period + 1:
            return 50.0  # Default neutral

        # Calculate price changes
        deltas = [close_prices[i] - close_prices[i - 1] for i in range(1, len(close_prices))]

        # Initial averages
        gains = [d if d > 0 else 0.0 for d in deltas[:period]]
        losses = [-d if d < 0 else 0.0 for d in deltas[:period]]

        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period

        # Wilder's smoothing for remaining periods
        for i in range(period, len(deltas)):
            delta = deltas[i]
            gain = delta if delta > 0 else 0.0
            loss = -delta if delta < 0 else 0.0

            avg_gain = (avg_gain * (period - 1) + gain) / period
            avg_loss = (avg_loss * (period - 1) + loss) / period

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return rsi

    def calculate_adx(
        self,
        highs: List[float],
        lows: List[float],
        closes: List[float],
        period: int = 14,
    ) -> float:
        """
        Calculate ADX (Average Directional Index).

        Returns ADX value indicating trend strength.
        """
        n = len(closes)
        if n < period + 1:
            return 20.0  # Default neutral

        # Calculate True Range, +DM, -DM
        tr_list = []
        plus_dm_list = []
        minus_dm_list = []

        for i in range(1, n):
            high_diff = highs[i] - highs[i - 1]
            low_diff = lows[i - 1] - lows[i]

            plus_dm = high_diff if high_diff > low_diff and high_diff > 0 else 0.0
            minus_dm = low_diff if low_diff > high_diff and low_diff > 0 else 0.0

            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1]),
            )

            tr_list.append(tr)
            plus_dm_list.append(plus_dm)
            minus_dm_list.append(minus_dm)

        if len(tr_list) < period:
            return 20.0

        # Wilder's smoothing
        atr = sum(tr_list[:period]) / period
        plus_dm_smooth = sum(plus_dm_list[:period]) / period
        minus_dm_smooth = sum(minus_dm_list[:period]) / period

        dx_values = []

        for i in range(period, len(tr_list)):
            atr = (atr * (period - 1) + tr_list[i]) / period
            plus_dm_smooth = (plus_dm_smooth * (period - 1) + plus_dm_list[i]) / period
            minus_dm_smooth = (minus_dm_smooth * (period - 1) + minus_dm_list[i]) / period

            if atr == 0:
                continue

            plus_di = (plus_dm_smooth / atr) * 100
            minus_di = (minus_dm_smooth / atr) * 100

            di_sum = plus_di + minus_di
            if di_sum == 0:
                continue

            dx = abs(plus_di - minus_di) / di_sum * 100
            dx_values.append(dx)

        if not dx_values:
            # Use initial period values
            if atr == 0:
                return 20.0
            plus_di = (plus_dm_smooth / atr) * 100
            minus_di = (minus_dm_smooth / atr) * 100
            di_sum = plus_di + minus_di
            if di_sum == 0:
                return 20.0
            return abs(plus_di - minus_di) / di_sum * 100

        # ADX is the smoothed average of DX
        adx = sum(dx_values[-period:]) / min(len(dx_values), period)
        return adx

    def calculate_atr(
        self,
        highs: List[float],
        lows: List[float],
        closes: List[float],
        period: int = 14,
    ) -> float:
        """Calculate Average True Range."""
        n = len(closes)
        if n < 2:
            return 0.0

        tr_list = []
        for i in range(1, n):
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1]),
            )
            tr_list.append(tr)

        if len(tr_list) < period:
            return sum(tr_list) / len(tr_list) if tr_list else 0.0

        # Wilder's smoothing
        atr = sum(tr_list[:period]) / period
        for i in range(period, len(tr_list)):
            atr = (atr * (period - 1) + tr_list[i]) / period

        return atr

    def calculate_relative_volume(self, volumes: List[float]) -> float:
        """
        Calculate relative volume.

        volume_ratio = current day volume / mean(previous 20 days volume)
        """
        if len(volumes) < 21:
            return 1.0

        current_volume = volumes[-1]
        prev_20 = volumes[-21:-1]
        avg_volume = sum(prev_20) / len(prev_20)

        if avg_volume == 0:
            return 1.0

        return current_volume / avg_volume

    def classify_market_regime(
        self, adx: float, atr: float, avg_price: float
    ) -> MarketRegime:
        """
        Classify market regime based on ADX and ATR/price ratio.

        - ATR/price > 0.025 → volatile
        - ADX > 25 → trending
        - ADX < 20 → ranging
        - else → trending (default for 20 <= ADX <= 25)
        """
        if avg_price > 0 and (atr / avg_price) > 0.025:
            return MarketRegime.VOLATILE

        if adx > 25:
            return MarketRegime.TRENDING

        if adx < 20:
            return MarketRegime.RANGING

        return MarketRegime.TRENDING

    def calculate_risk_reward_ratio(
        self,
        entry_price: float,
        exit_price: float,
        stop_loss: float,
        direction: TradeDirection,
    ) -> Optional[float]:
        """
        Calculate risk/reward ratio.

        LONG: (exit_price - entry_price) / (entry_price - stop_loss)
        SHORT: (entry_price - exit_price) / (stop_loss - entry_price)

        Returns None if risk is zero (stop_loss equals entry_price).
        """
        if direction == TradeDirection.LONG:
            risk = entry_price - stop_loss
            if risk <= 0:
                return None
            reward = exit_price - entry_price
            return reward / risk
        else:
            risk = stop_loss - entry_price
            if risk <= 0:
                return None
            reward = entry_price - exit_price
            return reward / risk
