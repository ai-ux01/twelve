"""
Trade Analysis Engine Performance Calculator.

Computes aggregate trading metrics from TradeRecords.
Follows the Phase 11 PerformanceCalculator pattern.

Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
"""

from __future__ import annotations

import math
import statistics
from typing import List, Optional

from .models import PerformanceMetrics, TradeRecord


class TradePerformanceCalculator:
    """
    Computes aggregate metrics from TradeRecords.

    Extends the pattern from paper_trading/performance_calculator.py.

    Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
    """

    def calculate_metrics(self, trades: List[TradeRecord]) -> PerformanceMetrics:
        """
        Compute all aggregate metrics from trades.

        Returns zero metrics if trades list is empty.
        """
        if not trades:
            return PerformanceMetrics()

        total_trades = len(trades)
        winning_trades = sum(1 for t in trades if t.realized_pnl > 0)
        losing_trades = sum(1 for t in trades if t.realized_pnl < 0)

        mfe_stats = self.calculate_mfe_mae_stats(trades)

        return PerformanceMetrics(
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=self.calculate_win_rate(trades),
            profit_factor=self.calculate_profit_factor(trades),
            total_pnl=self.calculate_total_pnl(trades),
            expectancy=self.calculate_expectancy(trades),
            max_drawdown=self.calculate_max_drawdown(trades),
            average_r=self.calculate_average_r(trades),
            mfe_mean=mfe_stats.get("mfe_mean"),
            mfe_median=mfe_stats.get("mfe_median"),
            mfe_max=mfe_stats.get("mfe_max"),
            mae_mean=mfe_stats.get("mae_mean"),
            mae_median=mfe_stats.get("mae_median"),
            mae_max=mfe_stats.get("mae_max"),
        )

    def calculate_win_rate(self, trades: List[TradeRecord]) -> float:
        """
        Win Rate = (winning trades / total trades) × 100

        Returns 0 for empty trade list.
        """
        if not trades:
            return 0.0

        winning = sum(1 for t in trades if t.realized_pnl > 0)
        return (winning / len(trades)) * 100

    def calculate_profit_factor(self, trades: List[TradeRecord]) -> float:
        """
        Profit Factor = sum(profits) / |sum(losses)|

        Returns 0 for empty list.
        Returns infinity if there are profits but no losses.
        """
        if not trades:
            return 0.0

        profits = sum(t.realized_pnl for t in trades if t.realized_pnl > 0)
        losses = sum(t.realized_pnl for t in trades if t.realized_pnl < 0)

        if losses == 0:
            return float("inf") if profits > 0 else 0.0

        return profits / abs(losses)

    def calculate_total_pnl(self, trades: List[TradeRecord]) -> float:
        """Total P&L = sum of all realized P&L values."""
        return sum(t.realized_pnl for t in trades)

    def calculate_expectancy(self, trades: List[TradeRecord]) -> float:
        """
        Expectancy = total P&L / total trades

        Returns 0 for empty list.
        """
        if not trades:
            return 0.0

        total_pnl = sum(t.realized_pnl for t in trades)
        return total_pnl / len(trades)

    def calculate_max_drawdown(self, trades: List[TradeRecord]) -> float:
        """
        Max Drawdown = largest peak-to-trough decline in cumulative P&L.

        Trades are ordered by exit_date.
        Returns 0 or negative value (0 means no drawdown).
        """
        if not trades:
            return 0.0

        # Sort by exit_date
        sorted_trades = sorted(trades, key=lambda t: t.exit_date)

        cumulative_pnl = 0.0
        peak = 0.0
        max_dd = 0.0

        for trade in sorted_trades:
            cumulative_pnl += trade.realized_pnl
            if cumulative_pnl > peak:
                peak = cumulative_pnl
            drawdown = peak - cumulative_pnl
            if drawdown > max_dd:
                max_dd = drawdown

        # Return as negative value to indicate loss
        return -max_dd if max_dd > 0 else 0.0

    def calculate_average_r(self, trades: List[TradeRecord]) -> float:
        """
        Average R = mean(realized_pnl / initial_risk) for trades with stop_loss.

        initial_risk = |entry_price - stop_loss| × quantity

        Skips trades without stop_loss or with zero initial risk.
        Returns 0 if no valid trades.
        """
        if not trades:
            return 0.0

        r_values = []
        for trade in trades:
            if trade.stop_loss is None:
                continue
            initial_risk = abs(trade.entry_price - trade.stop_loss) * trade.quantity
            if initial_risk == 0:
                continue
            r_multiple = trade.realized_pnl / initial_risk
            r_values.append(r_multiple)

        if not r_values:
            return 0.0

        return sum(r_values) / len(r_values)

    def calculate_mfe_mae_stats(self, trades: List[TradeRecord]) -> dict:
        """
        Compute mean, median, max of MFE and MAE values.

        Only includes trades that have MFE/MAE populated.
        Returns dict with keys: mfe_mean, mfe_median, mfe_max, mae_mean, mae_median, mae_max.
        """
        mfe_values = [t.mfe for t in trades if t.mfe is not None]
        mae_values = [t.mae for t in trades if t.mae is not None]

        result = {}

        if mfe_values:
            result["mfe_mean"] = statistics.mean(mfe_values)
            result["mfe_median"] = statistics.median(mfe_values)
            result["mfe_max"] = max(mfe_values)
        else:
            result["mfe_mean"] = None
            result["mfe_median"] = None
            result["mfe_max"] = None

        if mae_values:
            result["mae_mean"] = statistics.mean(mae_values)
            result["mae_median"] = statistics.median(mae_values)
            result["mae_max"] = max(mae_values)
        else:
            result["mae_mean"] = None
            result["mae_median"] = None
            result["mae_max"] = None

        return result
