"""
Backtesting Engine Indicator Engine.

Computes technical indicators (RSI, ADX, EMA, MACD, ATR, VWAP) using
existing calculator functions from apps/quant/calculators/.
Stores results as numpy arrays and provides point-in-time access
with no look-ahead via get_value().
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

import numpy as np

from .data_loader import OHLCVData
from .models import IndicatorConfig

logger = logging.getLogger(__name__)


class IndicatorEngine:
    """
    Indicator computation orchestrator.

    Pre-computes all indicator series on initialization and provides
    point-in-time access via get_value(indicator_name, bar_index).
    Returns NaN for warmup bars to enforce no look-ahead.
    """

    def __init__(self):
        """Initialize IndicatorEngine."""
        self._indicators: Dict[str, np.ndarray] = {}
        self._warmup_periods: Dict[str, int] = {}
        self._bar_count: int = 0

    @property
    def indicator_names(self) -> List[str]:
        """List of computed indicator names."""
        return list(self._indicators.keys())

    def compute_all(self, ohlcv: OHLCVData, configs: List[IndicatorConfig]) -> None:
        """
        Compute all configured indicators.

        Pre-computes full indicator series and stores as numpy arrays.

        Args:
            ohlcv: OHLCV data arrays.
            configs: List of indicator configurations.
        """
        self._bar_count = ohlcv.bar_count
        closes = ohlcv.closes.tolist()
        highs = ohlcv.highs.tolist()
        lows = ohlcv.lows.tolist()
        volumes = ohlcv.volumes.tolist()

        for config in configs:
            try:
                self._compute_indicator(config, closes, highs, lows, volumes)
            except Exception as e:
                logger.warning(
                    f"Failed to compute indicator {config.name}: {e}. "
                    f"Using NaN array."
                )
                self._indicators[config.name] = np.full(self._bar_count, np.nan)
                self._warmup_periods[config.name] = self._bar_count

    def get_value(self, indicator_name: str, bar_index: int) -> float:
        """
        Get indicator value at a specific bar index.

        Returns NaN if bar_index is within the warmup period.
        Enforces no look-ahead by only allowing access to current or past bars.

        Args:
            indicator_name: Name of the indicator.
            bar_index: Bar index to retrieve value for.

        Returns:
            Indicator value or NaN if in warmup period.
        """
        if indicator_name not in self._indicators:
            return float("nan")

        if bar_index < 0 or bar_index >= self._bar_count:
            return float("nan")

        warmup = self._warmup_periods.get(indicator_name, 0)
        if bar_index < warmup:
            return float("nan")

        value = self._indicators[indicator_name][bar_index]
        return float(value)

    def get_warmup_period(self, indicator_name: str) -> int:
        """Get the warmup period for an indicator."""
        return self._warmup_periods.get(indicator_name, 0)

    def get_max_warmup(self) -> int:
        """Get the maximum warmup period across all indicators."""
        if not self._warmup_periods:
            return 0
        return max(self._warmup_periods.values())

    def evaluate_trendline(
        self, indicator_name: str, bar_index: int
    ) -> Optional[Dict[str, float]]:
        """
        Evaluate trendline at a bar index.

        Returns distance from trendline and crossover signal.

        Args:
            indicator_name: Name of the indicator to compare.
            bar_index: Current bar index.

        Returns:
            Dict with 'distance' and 'crossed_above'/'crossed_below' or None.
        """
        if bar_index < 1:
            return None

        current_val = self.get_value(indicator_name, bar_index)
        prev_val = self.get_value(indicator_name, bar_index - 1)

        if math.isnan(current_val) or math.isnan(prev_val):
            return None

        # Simple trendline as the indicator value itself
        # Distance is the change from previous bar
        distance = current_val - prev_val
        crossed_above = prev_val <= 0 and current_val > 0
        crossed_below = prev_val >= 0 and current_val < 0

        return {
            "distance": distance,
            "crossed_above": 1.0 if crossed_above else 0.0,
            "crossed_below": 1.0 if crossed_below else 0.0,
        }

    def _compute_indicator(
        self,
        config: IndicatorConfig,
        closes: List[float],
        highs: List[float],
        lows: List[float],
        volumes: List[float],
    ) -> None:
        """Compute a single indicator based on its type."""
        indicator_type = config.indicator_type.upper()
        params = config.params
        n = len(closes)

        if indicator_type == "RSI":
            period = params.get("period", 14)
            series = self._compute_rsi_series(closes, period)
            self._indicators[config.name] = np.array(series)
            self._warmup_periods[config.name] = period

        elif indicator_type == "EMA":
            period = params.get("period", 20)
            series = self._compute_ema_series(closes, period)
            self._indicators[config.name] = np.array(series)
            self._warmup_periods[config.name] = period - 1

        elif indicator_type == "MACD":
            fast = params.get("fast_period", 12)
            slow = params.get("slow_period", 26)
            signal = params.get("signal_period", 9)
            series = self._compute_macd_series(closes, fast, slow, signal)
            self._indicators[config.name] = np.array(series["macd"])
            self._warmup_periods[config.name] = slow + signal - 1
            # Also store signal and histogram
            self._indicators[config.name + "_signal"] = np.array(series["signal"])
            self._warmup_periods[config.name + "_signal"] = slow + signal - 1
            self._indicators[config.name + "_histogram"] = np.array(series["histogram"])
            self._warmup_periods[config.name + "_histogram"] = slow + signal - 1

        elif indicator_type == "ATR":
            period = params.get("period", 14)
            series = self._compute_atr_series(highs, lows, closes, period)
            self._indicators[config.name] = np.array(series)
            self._warmup_periods[config.name] = period

        elif indicator_type == "ADX":
            period = params.get("period", 14)
            series = self._compute_adx_series(highs, lows, closes, period)
            self._indicators[config.name] = np.array(series)
            self._warmup_periods[config.name] = 2 * period

        elif indicator_type == "VWAP":
            series = self._compute_vwap_series(highs, lows, closes, volumes)
            self._indicators[config.name] = np.array(series)
            self._warmup_periods[config.name] = 0

        else:
            logger.warning(f"Unknown indicator type: {indicator_type}")
            self._indicators[config.name] = np.full(n, np.nan)
            self._warmup_periods[config.name] = n

    # === Simplified indicator implementations (no pandas) ===

    def _compute_rsi_series(self, closes: List[float], period: int) -> List[float]:
        """Compute RSI series using Wilder's smoothing. No pandas."""
        n = len(closes)
        result = [float("nan")] * n

        if n < period + 1:
            return result

        # Price changes
        deltas = [closes[i] - closes[i - 1] for i in range(1, n)]

        # Initial averages
        gains = [d if d > 0 else 0.0 for d in deltas[:period]]
        losses = [-d if d < 0 else 0.0 for d in deltas[:period]]

        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period

        # First RSI value
        if avg_loss == 0:
            result[period] = 100.0
        else:
            rs = avg_gain / avg_loss
            result[period] = 100.0 - (100.0 / (1.0 + rs))

        # Subsequent values using Wilder's smoothing
        for i in range(period, len(deltas)):
            delta = deltas[i]
            gain = delta if delta > 0 else 0.0
            loss = -delta if delta < 0 else 0.0

            avg_gain = (avg_gain * (period - 1) + gain) / period
            avg_loss = (avg_loss * (period - 1) + loss) / period

            if avg_loss == 0:
                result[i + 1] = 100.0
            else:
                rs = avg_gain / avg_loss
                result[i + 1] = 100.0 - (100.0 / (1.0 + rs))

        return result

    def _compute_ema_series(self, closes: List[float], period: int) -> List[float]:
        """Compute EMA series. No pandas."""
        n = len(closes)
        result = [float("nan")] * n

        if n < period:
            return result

        multiplier = 2.0 / (period + 1)

        # Seed with SMA
        ema = sum(closes[:period]) / period
        result[period - 1] = ema

        for i in range(period, n):
            ema = (closes[i] - ema) * multiplier + ema
            result[i] = ema

        return result

    def _compute_macd_series(
        self, closes: List[float], fast: int, slow: int, signal_period: int
    ) -> Dict[str, List[float]]:
        """Compute MACD, signal, histogram series. No pandas."""
        n = len(closes)
        macd_line = [float("nan")] * n
        signal_line = [float("nan")] * n
        histogram = [float("nan")] * n

        if n < slow:
            return {"macd": macd_line, "signal": signal_line, "histogram": histogram}

        # Compute fast and slow EMA
        fast_ema = self._compute_ema_series(closes, fast)
        slow_ema = self._compute_ema_series(closes, slow)

        # MACD = fast EMA - slow EMA
        macd_values = []
        for i in range(n):
            if not math.isnan(fast_ema[i]) and not math.isnan(slow_ema[i]):
                macd_line[i] = fast_ema[i] - slow_ema[i]
                macd_values.append(macd_line[i])
            else:
                macd_values.append(float("nan"))

        # Signal line = EMA of MACD line
        # Find first valid MACD index
        valid_macd = [(i, v) for i, v in enumerate(macd_line) if not math.isnan(v)]
        if len(valid_macd) >= signal_period:
            first_valid_idx = valid_macd[0][0]
            macd_subset = [v for _, v in valid_macd]

            signal_multiplier = 2.0 / (signal_period + 1)
            sig_ema = sum(macd_subset[:signal_period]) / signal_period

            signal_values = [float("nan")] * signal_period
            signal_values[-1] = sig_ema

            for j in range(signal_period, len(macd_subset)):
                sig_ema = (macd_subset[j] - sig_ema) * signal_multiplier + sig_ema
                signal_values.append(sig_ema)

            # Map back to original indices
            for j, sig_val in enumerate(signal_values):
                if not math.isnan(sig_val):
                    orig_idx = valid_macd[j][0]
                    signal_line[orig_idx] = sig_val
                    histogram[orig_idx] = macd_line[orig_idx] - sig_val

        return {"macd": macd_line, "signal": signal_line, "histogram": histogram}

    def _compute_atr_series(
        self, highs: List[float], lows: List[float], closes: List[float], period: int
    ) -> List[float]:
        """Compute ATR series using Wilder's smoothing. No pandas."""
        n = len(closes)
        result = [float("nan")] * n

        if n < period + 1:
            return result

        # True Range
        tr_list = []
        for i in range(1, n):
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1]),
            )
            tr_list.append(tr)

        if len(tr_list) < period:
            return result

        # Initial ATR = simple average
        atr = sum(tr_list[:period]) / period
        result[period] = atr

        # Wilder's smoothing
        for i in range(period, len(tr_list)):
            atr = (atr * (period - 1) + tr_list[i]) / period
            result[i + 1] = atr

        return result

    def _compute_adx_series(
        self, highs: List[float], lows: List[float], closes: List[float], period: int
    ) -> List[float]:
        """Compute ADX series. Simplified implementation without pandas."""
        n = len(closes)
        result = [float("nan")] * n

        if n < 2 * period + 1:
            return result

        # Calculate +DM, -DM, TR
        plus_dm_list = []
        minus_dm_list = []
        tr_list = []

        for i in range(1, n):
            up_move = highs[i] - highs[i - 1]
            down_move = lows[i - 1] - lows[i]

            plus_dm = up_move if (up_move > down_move and up_move > 0) else 0.0
            minus_dm = down_move if (down_move > up_move and down_move > 0) else 0.0

            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1]),
            )

            plus_dm_list.append(plus_dm)
            minus_dm_list.append(minus_dm)
            tr_list.append(tr)

        # Wilder's smoothing for +DM, -DM, TR
        sm_plus_dm = sum(plus_dm_list[:period])
        sm_minus_dm = sum(minus_dm_list[:period])
        sm_tr = sum(tr_list[:period])

        dx_values = []

        for i in range(period, len(plus_dm_list)):
            sm_plus_dm = sm_plus_dm - (sm_plus_dm / period) + plus_dm_list[i]
            sm_minus_dm = sm_minus_dm - (sm_minus_dm / period) + minus_dm_list[i]
            sm_tr = sm_tr - (sm_tr / period) + tr_list[i]

            if sm_tr == 0:
                dx_values.append(0.0)
                continue

            plus_di = 100.0 * sm_plus_dm / sm_tr
            minus_di = 100.0 * sm_minus_dm / sm_tr

            di_sum = plus_di + minus_di
            if di_sum == 0:
                dx_values.append(0.0)
            else:
                dx = 100.0 * abs(plus_di - minus_di) / di_sum
                dx_values.append(dx)

        # ADX = smoothed DX
        if len(dx_values) >= period:
            adx = sum(dx_values[:period]) / period
            # Map first ADX value
            adx_start_idx = 2 * period  # index in original series
            result[adx_start_idx] = adx

            for i in range(period, len(dx_values)):
                adx = (adx * (period - 1) + dx_values[i]) / period
                orig_idx = period + 1 + i  # offset to original series
                if orig_idx < n:
                    result[orig_idx] = adx

        return result

    def _compute_vwap_series(
        self,
        highs: List[float],
        lows: List[float],
        closes: List[float],
        volumes: List[float],
    ) -> List[float]:
        """Compute cumulative VWAP series. No pandas."""
        n = len(closes)
        result = [0.0] * n

        cum_pv = 0.0
        cum_vol = 0.0

        for i in range(n):
            typical_price = (highs[i] + lows[i] + closes[i]) / 3.0
            cum_pv += typical_price * volumes[i]
            cum_vol += volumes[i]

            if cum_vol > 0:
                result[i] = cum_pv / cum_vol
            else:
                result[i] = typical_price

        return result
