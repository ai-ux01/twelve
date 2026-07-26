"""
Backtesting Engine Metrics Calculator.

Computes all performance metrics from trade records and equity curve.
Reuses TradePerformanceCalculator for overlapping metrics.

Metrics:
- Total Return %
- CAGR
- Win Rate
- Profit Factor
- Expectancy
- Average Winner / Average Loser
- Max Drawdown %
- Sharpe Ratio (annualized √252)
- Total Trades
- Average Holding Period
"""

from __future__ import annotations

import math
from typing import List

from .models import EquityPoint, PerformanceMetrics, TradeRecord


class MetricsCalculator:
    """
    Computes all 11 performance metrics from trade records and equity curve.

    Uses equity curve for return-based metrics (Total Return, CAGR, Sharpe, Max DD).
    Uses trade list for trade-based metrics (Win Rate, Profit Factor, etc.).
    """

    def calculate(
        self,
        trades: List[TradeRecord],
        equity_curve: List[EquityPoint],
        initial_capital: float,
        total_bars: int = 0,
    ) -> PerformanceMetrics:
        """
        Compute all performance metrics.

        Args:
            trades: List of completed trade records.
            equity_curve: Equity curve points.
            initial_capital: Starting capital.
            total_bars: Total number of bars in the backtest.

        Returns:
            PerformanceMetrics dataclass.
        """
        if not equity_curve:
            return PerformanceMetrics()

        final_equity = equity_curve[-1].equity
        total_trades = len(trades)

        # Total Return
        total_return_pct = self._calculate_total_return(initial_capital, final_equity)

        # CAGR
        cagr = self._calculate_cagr(initial_capital, final_equity, total_bars)

        # Sharpe Ratio
        sharpe = self._calculate_sharpe(equity_curve)

        # Max Drawdown %
        max_drawdown_pct = self._calculate_max_drawdown_pct(equity_curve)

        # Trade-based metrics
        win_rate = self._calculate_win_rate(trades)
        profit_factor = self._calculate_profit_factor(trades)
        expectancy = self._calculate_expectancy(trades)
        average_winner = self._calculate_average_winner(trades)
        average_loser = self._calculate_average_loser(trades)
        average_holding = self._calculate_average_holding_period(trades)

        return PerformanceMetrics(
            total_return_pct=total_return_pct,
            cagr=cagr,
            win_rate=win_rate,
            profit_factor=profit_factor,
            expectancy=expectancy,
            average_winner=average_winner,
            average_loser=average_loser,
            max_drawdown_pct=max_drawdown_pct,
            sharpe_ratio=sharpe,
            total_trades=total_trades,
            average_holding_period=average_holding,
        )

    def _calculate_total_return(self, initial: float, final: float) -> float:
        """Total Return = (final - initial) / initial * 100."""
        if initial <= 0:
            return 0.0
        return ((final - initial) / initial) * 100.0

    def _calculate_cagr(self, initial: float, final: float, total_bars: int) -> float:
        """
        CAGR = ((final/initial) ^ (365/days)) - 1.

        Assumes daily bars for day counting (total_bars ≈ trading days).
        Uses 252 trading days per year ratio to convert bars to calendar days.
        """
        if initial <= 0 or final <= 0 or total_bars <= 0:
            return 0.0

        # Approximate calendar days: total_bars * (365/252) for daily bars
        days = total_bars * (365.0 / 252.0)
        if days <= 0:
            return 0.0

        try:
            ratio = final / initial
            cagr = (ratio ** (365.0 / days)) - 1.0
            return cagr * 100.0  # as percentage
        except (OverflowError, ZeroDivisionError):
            return 0.0

    def _calculate_sharpe(self, equity_curve: List[EquityPoint]) -> float:
        """
        Sharpe Ratio = (mean_daily_return) / std_daily_return * sqrt(252).

        Uses 0 as risk-free rate.
        """
        if len(equity_curve) < 2:
            return 0.0

        # Calculate daily returns
        daily_returns = []
        for i in range(1, len(equity_curve)):
            prev_equity = equity_curve[i - 1].equity
            curr_equity = equity_curve[i].equity
            if prev_equity > 0:
                ret = (curr_equity - prev_equity) / prev_equity
                daily_returns.append(ret)

        if len(daily_returns) < 2:
            return 0.0

        mean_return = sum(daily_returns) / len(daily_returns)
        variance = sum((r - mean_return) ** 2 for r in daily_returns) / (len(daily_returns) - 1)
        std_return = math.sqrt(variance) if variance > 0 else 0.0

        if std_return == 0:
            return 0.0

        # Annualized Sharpe
        sharpe = (mean_return / std_return) * math.sqrt(252)
        return sharpe

    def _calculate_max_drawdown_pct(self, equity_curve: List[EquityPoint]) -> float:
        """
        Max Drawdown % = largest peak-to-trough decline as percentage of peak.

        Returns as negative percentage (e.g., -15.0 for 15% drawdown).
        """
        if len(equity_curve) < 2:
            return 0.0

        peak = equity_curve[0].equity
        max_dd_pct = 0.0

        for point in equity_curve:
            if point.equity > peak:
                peak = point.equity

            if peak > 0:
                dd_pct = (peak - point.equity) / peak * 100.0
                if dd_pct > max_dd_pct:
                    max_dd_pct = dd_pct

        return -max_dd_pct if max_dd_pct > 0 else 0.0

    def _calculate_win_rate(self, trades: List[TradeRecord]) -> float:
        """Win Rate = winning_trades / total_trades * 100."""
        if not trades:
            return 0.0
        winners = sum(1 for t in trades if t.net_pnl > 0)
        return (winners / len(trades)) * 100.0

    def _calculate_profit_factor(self, trades: List[TradeRecord]) -> float:
        """Profit Factor = sum(profits) / |sum(losses)|."""
        if not trades:
            return 0.0

        profits = sum(t.net_pnl for t in trades if t.net_pnl > 0)
        losses = sum(t.net_pnl for t in trades if t.net_pnl < 0)

        if losses == 0:
            return float("inf") if profits > 0 else 0.0

        return profits / abs(losses)

    def _calculate_expectancy(self, trades: List[TradeRecord]) -> float:
        """Expectancy = total_net_pnl / total_trades."""
        if not trades:
            return 0.0
        total_pnl = sum(t.net_pnl for t in trades)
        return total_pnl / len(trades)

    def _calculate_average_winner(self, trades: List[TradeRecord]) -> float:
        """Average Winner = mean of positive net P&L trades."""
        winners = [t.net_pnl for t in trades if t.net_pnl > 0]
        if not winners:
            return 0.0
        return sum(winners) / len(winners)

    def _calculate_average_loser(self, trades: List[TradeRecord]) -> float:
        """Average Loser = mean of negative net P&L trades."""
        losers = [t.net_pnl for t in trades if t.net_pnl < 0]
        if not losers:
            return 0.0
        return sum(losers) / len(losers)

    def _calculate_average_holding_period(self, trades: List[TradeRecord]) -> float:
        """Average Holding Period = mean holding period in bars."""
        if not trades:
            return 0.0
        total_holding = sum(t.holding_period for t in trades)
        return total_holding / len(trades)
