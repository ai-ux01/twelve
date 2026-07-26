"""
Trade Coach Source Comparator.

Compares performance across Paper, Live, and Backtest trade sources.
Generates insights on differences between trading environments.

Phase 15 - AI Trade Coach
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from trade_analysis.models import TradeRecord
from trade_analysis.performance_calculator import TradePerformanceCalculator

from .models import SourceComparison, SourceMetrics

logger = logging.getLogger(__name__)

# Source classification based on strategy/setup naming conventions
PAPER_INDICATORS = ["paper", "simulated", "demo", "virtual"]
BACKTEST_INDICATORS = ["backtest", "historical", "replay"]
LIVE_INDICATORS = ["live", "real", "actual"]


class SourceComparator:
    """
    Compares trading performance across Paper, Live, and Backtest sources.

    Classifies trades by source based on strategy/setup naming conventions
    and computes separate metrics for each source.

    Phase 15 - AI Trade Coach
    """

    def __init__(self):
        """Initialize the SourceComparator."""
        self._calculator = TradePerformanceCalculator()

    def compare_sources(self, trades: List[TradeRecord]) -> SourceComparison:
        """
        Compare performance across Paper, Live, and Backtest sources.

        Classifies trades by source and computes metrics for each group.

        Args:
            trades: All trade records to classify and compare.

        Returns:
            SourceComparison with metrics per source and insights.
        """
        if not trades:
            return SourceComparison(insights=["No trades available for comparison"])

        # Classify trades by source
        classified = self._classify_trades(trades)

        paper_trades = classified.get("paper", [])
        live_trades = classified.get("live", [])
        backtest_trades = classified.get("backtest", [])

        # Compute metrics for each source
        paper_metrics = self._compute_source_metrics("paper", paper_trades) if paper_trades else None
        live_metrics = self._compute_source_metrics("live", live_trades) if live_trades else None
        backtest_metrics = self._compute_source_metrics("backtest", backtest_trades) if backtest_trades else None

        # Generate insights
        insights = self._generate_insights(paper_metrics, live_metrics, backtest_metrics)

        return SourceComparison(
            paper=paper_metrics,
            live=live_metrics,
            backtest=backtest_metrics,
            insights=insights,
        )

    def _classify_trades(self, trades: List[TradeRecord]) -> Dict[str, List[TradeRecord]]:
        """
        Classify trades into paper, live, or backtest based on metadata.

        Uses strategy and setup fields to determine source.
        Defaults to 'live' if no indicators match.
        """
        classified: Dict[str, List[TradeRecord]] = {
            "paper": [],
            "live": [],
            "backtest": [],
        }

        for trade in trades:
            source = self._determine_source(trade)
            classified[source].append(trade)

        return classified

    def _determine_source(self, trade: TradeRecord) -> str:
        """Determine the source of a trade based on its metadata."""
        # Check strategy and setup fields for source indicators
        text_fields = []
        if trade.strategy:
            text_fields.append(trade.strategy.lower())
        if trade.setup:
            text_fields.append(trade.setup.lower())

        combined = " ".join(text_fields)

        for indicator in PAPER_INDICATORS:
            if indicator in combined:
                return "paper"

        for indicator in BACKTEST_INDICATORS:
            if indicator in combined:
                return "backtest"

        for indicator in LIVE_INDICATORS:
            if indicator in combined:
                return "live"

        # Default to live if no indicators match
        return "live"

    def _compute_source_metrics(
        self, source: str, trades: List[TradeRecord]
    ) -> SourceMetrics:
        """Compute performance metrics for a trade source."""
        if not trades:
            return SourceMetrics(source=source)

        metrics = self._calculator.calculate_metrics(trades)

        return SourceMetrics(
            source=source,
            total_trades=metrics.total_trades,
            win_rate=metrics.win_rate,
            profit_factor=metrics.profit_factor if metrics.profit_factor != float("inf") else 9999.99,
            expectancy=metrics.expectancy,
            average_r=metrics.average_r,
            total_pnl=metrics.total_pnl,
            max_drawdown=metrics.max_drawdown,
        )

    def _generate_insights(
        self,
        paper: Optional[SourceMetrics],
        live: Optional[SourceMetrics],
        backtest: Optional[SourceMetrics],
    ) -> List[str]:
        """Generate comparison insights between sources."""
        insights: List[str] = []

        sources_available = []
        if paper and paper.total_trades > 0:
            sources_available.append(("Paper", paper))
        if live and live.total_trades > 0:
            sources_available.append(("Live", live))
        if backtest and backtest.total_trades > 0:
            sources_available.append(("Backtest", backtest))

        if len(sources_available) < 2:
            insights.append(
                "Insufficient data: need trades from at least 2 sources for comparison"
            )
            if sources_available:
                name, m = sources_available[0]
                insights.append(
                    f"Only {name} data available: {m.total_trades} trades, "
                    f"WR={m.win_rate:.1f}%, PF={m.profit_factor:.2f}"
                )
            return insights

        # Compare win rates
        best_wr_name, best_wr = max(sources_available, key=lambda x: x[1].win_rate)
        worst_wr_name, worst_wr = min(sources_available, key=lambda x: x[1].win_rate)

        if best_wr.win_rate - worst_wr.win_rate > 10:
            insights.append(
                f"Win rate gap: {best_wr_name} ({best_wr.win_rate:.1f}%) "
                f"outperforms {worst_wr_name} ({worst_wr.win_rate:.1f}%) "
                f"by {best_wr.win_rate - worst_wr.win_rate:.1f} percentage points"
            )

        # Compare profit factors
        best_pf_name, best_pf = max(sources_available, key=lambda x: x[1].profit_factor)
        worst_pf_name, worst_pf = min(sources_available, key=lambda x: x[1].profit_factor)

        if best_pf.profit_factor > 1.5 * worst_pf.profit_factor and worst_pf.profit_factor > 0:
            insights.append(
                f"Profit factor divergence: {best_pf_name} ({best_pf.profit_factor:.2f}) "
                f"significantly higher than {worst_pf_name} ({worst_pf.profit_factor:.2f})"
            )

        # Paper vs Live comparison (common gap)
        if paper and live and paper.total_trades > 0 and live.total_trades > 0:
            if paper.win_rate > live.win_rate + 5:
                insights.append(
                    f"Paper trading outperforms live: paper WR={paper.win_rate:.1f}% "
                    f"vs live WR={live.win_rate:.1f}%. "
                    f"This may indicate emotional interference in live trading."
                )
            elif live.win_rate > paper.win_rate + 5:
                insights.append(
                    f"Live trading outperforms paper: live WR={live.win_rate:.1f}% "
                    f"vs paper WR={paper.win_rate:.1f}%. "
                    f"Good execution under real conditions."
                )

        # Backtest vs Live comparison
        if backtest and live and backtest.total_trades > 0 and live.total_trades > 0:
            if backtest.win_rate > live.win_rate + 10:
                insights.append(
                    f"Backtest-to-live gap: backtest WR={backtest.win_rate:.1f}% "
                    f"vs live WR={live.win_rate:.1f}%. "
                    f"Consider slippage, emotions, or curve-fitting in backtests."
                )

        # Expectancy comparison
        best_exp_name, best_exp = max(sources_available, key=lambda x: x[1].expectancy)
        if best_exp.expectancy > 0:
            insights.append(
                f"Best expectancy: {best_exp_name} with ₹{best_exp.expectancy:.2f} per trade"
            )

        return insights
