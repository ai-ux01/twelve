"""
Performance Calculator for Paper Trading.

Computes aggregate trading metrics from closed trade records:
- Win Rate
- Profit Factor
- Total P&L
- Expectancy
- Average R-multiple
- Maximum Drawdown
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
import math

from .models import ClosedTradeData


@dataclass
class PerformanceMetrics:
    """Aggregate performance metrics for a set of closed trades."""

    win_rate: float = 0.0  # percentage (0-100)
    profit_factor: float = 0.0  # ratio
    total_pnl: float = 0.0  # absolute currency
    expectancy: float = 0.0  # average per trade
    average_r: float = 0.0  # mean R-multiple
    max_drawdown: float = 0.0  # absolute currency (negative or zero)
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0


class PerformanceCalculator:
    """
    Computes aggregate trading metrics from closed trade records.

    Supports optional trade_type filtering.
    """

    def calculate_metrics(
        self,
        closed_trades: List[ClosedTradeData],
        trade_type: Optional[str] = None,
    ) -> PerformanceMetrics:
        """
        Calculate all performance metrics from closed trades.

        Args:
            closed_trades: List of closed trade records.
            trade_type: Optional filter by trade type (SWING, INTRADAY, OPTIONS_SCALPING).

        Returns:
            PerformanceMetrics with all calculated values.
        """
        # Filter by trade_type if specified
        if trade_type:
            trades = [t for t in closed_trades if t.trade_type == trade_type]
        else:
            trades = list(closed_trades)

        if not trades:
            return PerformanceMetrics()

        total_trades = len(trades)
        winning_trades = sum(1 for t in trades if t.realized_pnl > 0)
        losing_trades = sum(1 for t in trades if t.realized_pnl < 0)

        return PerformanceMetrics(
            win_rate=self.calculate_win_rate(trades),
            profit_factor=self.calculate_profit_factor(trades),
            total_pnl=self.calculate_total_pnl(trades),
            expectancy=self.calculate_expectancy(trades),
            average_r=self.calculate_average_r(trades),
            max_drawdown=self.calculate_max_drawdown(trades),
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
        )

    def calculate_win_rate(self, trades: List[ClosedTradeData]) -> float:
        """
        Win Rate = (winning trades / total trades) × 100

        Returns 0 for empty trade list.
        """
        if not trades:
            return 0.0

        winning = sum(1 for t in trades if t.realized_pnl > 0)
        return (winning / len(trades)) * 100

    def calculate_profit_factor(self, trades: List[ClosedTradeData]) -> float:
        """
        Profit Factor = sum(profits) / abs(sum(losses))

        Returns 0 for empty list.
        Returns Infinity if there are profits but no losses.
        """
        if not trades:
            return 0.0

        profits = sum(t.realized_pnl for t in trades if t.realized_pnl > 0)
        losses = sum(t.realized_pnl for t in trades if t.realized_pnl < 0)

        if losses == 0:
            return float("inf") if profits > 0 else 0.0

        return profits / abs(losses)

    def calculate_total_pnl(self, trades: List[ClosedTradeData]) -> float:
        """Total P&L = sum of all realized P&L values."""
        return sum(t.realized_pnl for t in trades)

    def calculate_expectancy(self, trades: List[ClosedTradeData]) -> float:
        """
        Expectancy = total P&L / total trades

        Returns 0 for empty list.
        """
        if not trades:
            return 0.0

        total_pnl = sum(t.realized_pnl for t in trades)
        return total_pnl / len(trades)

    def calculate_average_r(self, trades: List[ClosedTradeData]) -> float:
        """
        Average R = mean(realized_pnl / initial_risk) per trade.

        initial_risk = |entry_price - stop_loss| × quantity

        Skips trades with zero initial risk.
        Returns 0 if no valid trades.
        """
        if not trades:
            return 0.0

        r_values = []
        for trade in trades:
            initial_risk = abs(trade.entry_price - trade.stop_loss) * trade.quantity
            if initial_risk == 0:
                continue  # Skip trades with zero risk
            r_multiple = trade.realized_pnl / initial_risk
            r_values.append(r_multiple)

        if not r_values:
            return 0.0

        return sum(r_values) / len(r_values)

    def calculate_max_drawdown(self, trades: List[ClosedTradeData]) -> float:
        """
        Max Drawdown = largest peak-to-trough decline in cumulative P&L.

        Trades are ordered by exit time (or list order if no exit time).
        Returns 0 or negative value (0 means no drawdown).
        """
        if not trades:
            return 0.0

        # Sort by exited_at if available
        sorted_trades = sorted(
            trades,
            key=lambda t: t.exited_at if t.exited_at else t.entered_at or 0,
        )

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
