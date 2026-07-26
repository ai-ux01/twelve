"""
Live Analysis Module.

Provides slippage calculation, partial fill detection, paper vs live
divergence comparison, and live-specific recommendations for the Trade Coach.

Requirements: 4.1, 4.2, 4.3, 4.5
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from trade_analysis.models import TradeDirection, TradeRecord

from .models import BehaviorDetection, BehaviorPattern, BehaviorSeverity

logger = logging.getLogger(__name__)

# Threshold: fewer than this many live trades triggers insufficient data recommendation
MINIMUM_LIVE_TRADES_THRESHOLD = 5

# Partial fill threshold: if filled quantity < 80% of intended, flag as partial
PARTIAL_FILL_THRESHOLD_PCT = 80.0


@dataclass
class SlippageSummary:
    """Summary of slippage across live trades.

    Attributes:
        average_slippage: Mean slippage across all trades with slippage data.
        total_slippage: Sum of all slippage values.
        unfavorable_count: Number of trades with positive (unfavorable) slippage.
        favorable_count: Number of trades with negative (favorable) slippage.
    """

    average_slippage: float = 0.0
    total_slippage: float = 0.0
    unfavorable_count: int = 0
    favorable_count: int = 0

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "average_slippage": round(self.average_slippage, 4),
            "total_slippage": round(self.total_slippage, 4),
            "unfavorable_count": self.unfavorable_count,
            "favorable_count": self.favorable_count,
        }


@dataclass
class LiveAnalysisResult:
    """Result of live-specific analysis.

    Attributes:
        slippage_summary: Slippage metrics across live trades.
        partial_fill_detection: BehaviorDetection if partial fills are found.
        divergence_insights: Insights from comparing paper vs live metrics.
        recommendations: Additional recommendations for live trading.
    """

    slippage_summary: Optional[SlippageSummary] = None
    partial_fill_detection: Optional[BehaviorDetection] = None
    divergence_insights: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


class LiveAnalyzer:
    """Analyzes live trading data for slippage, partial fills, and divergences.

    Provides live-specific coaching analysis that complements the standard
    behavior detection with execution-quality metrics.

    Requirements: 4.1, 4.2, 4.3, 4.5
    """

    def analyze(
        self,
        live_trades: List[TradeRecord],
        paper_trades: Optional[List[TradeRecord]] = None,
        data_source: str = "live",
    ) -> LiveAnalysisResult:
        """Run all live-specific analysis on the provided trades.

        Args:
            live_trades: Trades from the live (Kotak Neo) source.
            paper_trades: Trades from paper trading (only used in combined mode).
            data_source: The current data source mode.

        Returns:
            LiveAnalysisResult with slippage, partial fills, and recommendations.
        """
        result = LiveAnalysisResult()

        # Calculate slippage summary
        result.slippage_summary = self.calculate_slippage_summary(live_trades)

        # Detect partial fill patterns
        result.partial_fill_detection = self.detect_partial_fills(live_trades)

        # Compare paper vs live when in combined mode
        if data_source == "combined" and paper_trades:
            result.divergence_insights = self.compare_paper_vs_live(
                paper_trades, live_trades
            )

        # Check for insufficient live data
        if len(live_trades) < MINIMUM_LIVE_TRADES_THRESHOLD:
            result.recommendations.append(
                "More trading history needed for meaningful analysis"
            )

        return result

    def calculate_slippage(
        self,
        executed_price: float,
        intended_price: float,
        direction: TradeDirection,
    ) -> float:
        """Calculate slippage for a single trade.

        Slippage is positive when execution is unfavorable (worse than intended)
        and negative when favorable (better than intended).

        For buys: slippage = executed_price - intended_price
            (positive = paid more than intended = unfavorable)
        For sells: slippage = intended_price - executed_price
            (positive = received less than intended = unfavorable)

        Args:
            executed_price: The actual execution price.
            intended_price: The intended/order price.
            direction: Trade direction (LONG = buy, SHORT = sell).

        Returns:
            Slippage value. Positive = unfavorable, negative = favorable.
        """
        if direction == TradeDirection.LONG:
            return executed_price - intended_price
        else:
            return intended_price - executed_price

    def calculate_slippage_summary(
        self, trades: List[TradeRecord]
    ) -> SlippageSummary:
        """Calculate aggregate slippage metrics across trades.

        For live trades, entry_price is the intended price and exit_price is
        the executed price. We calculate slippage for each trade where both
        prices are available and nonzero.

        Args:
            trades: List of live TradeRecord objects.

        Returns:
            SlippageSummary with aggregate metrics.
        """
        slippage_values: List[float] = []

        for trade in trades:
            # Only calculate slippage where we have both intended and executed prices
            # For live trades: entry_price = intended, exit_price = executed
            if trade.entry_price <= 0 or trade.exit_price <= 0:
                continue

            slippage = self.calculate_slippage(
                executed_price=trade.exit_price,
                intended_price=trade.entry_price,
                direction=trade.direction,
            )
            slippage_values.append(slippage)

        if not slippage_values:
            return SlippageSummary()

        total_slippage = sum(slippage_values)
        average_slippage = total_slippage / len(slippage_values)
        unfavorable_count = sum(1 for s in slippage_values if s > 0)
        favorable_count = sum(1 for s in slippage_values if s < 0)

        return SlippageSummary(
            average_slippage=average_slippage,
            total_slippage=total_slippage,
            unfavorable_count=unfavorable_count,
            favorable_count=favorable_count,
        )

    def detect_partial_fills(
        self, trades: List[TradeRecord]
    ) -> Optional[BehaviorDetection]:
        """Detect partial fill patterns in live trades.

        A partial fill is detected when a trade's realized quantity appears
        to be significantly less than what was intended. Since we don't have
        explicit "intended quantity" in TradeRecord, we use a heuristic:
        trades where exit_price equals entry_price (order not fully executed
        in market) or trades with unusually small quantities relative to
        the user's typical trade size.

        For trades fetched from the Kotak Neo trade book, we detect partial
        fills by looking at patterns like multiple executions of the same
        symbol on the same day at different prices (split fills).

        Args:
            trades: List of live TradeRecord objects.

        Returns:
            BehaviorDetection if partial fills are found, None otherwise.
        """
        if not trades:
            return None

        # Group trades by symbol and date to detect split fills
        from collections import defaultdict

        symbol_day_groups: Dict[str, List[TradeRecord]] = defaultdict(list)
        for trade in trades:
            key = f"{trade.symbol}_{trade.entry_date.strftime('%Y-%m-%d')}_{trade.direction.value}"
            symbol_day_groups[key].append(trade)

        partial_fill_ids: List[str] = []

        for key, group in symbol_day_groups.items():
            if len(group) > 1:
                # Multiple fills for same symbol/day/direction = likely partial fills
                # Check if prices differ (indicating split execution)
                prices = set(t.entry_price for t in group)
                if len(prices) > 1:
                    # Different execution prices = split fill
                    for t in group:
                        partial_fill_ids.append(t.id)

        if not partial_fill_ids:
            return None

        count = len(partial_fill_ids)
        # Classify severity based on how many partial fills detected
        if count >= 10:
            severity = BehaviorSeverity.HIGH
        elif count >= 5:
            severity = BehaviorSeverity.MEDIUM
        else:
            severity = BehaviorSeverity.LOW

        return BehaviorDetection(
            pattern=BehaviorPattern.PARTIAL_FILLS,
            severity=severity,
            count=count,
            description=(
                f"Partial fill patterns detected: {count} trade(s) appear to be "
                f"split executions (multiple fills at different prices for the same "
                f"symbol on the same day)"
            ),
            trade_ids=partial_fill_ids[:20],
            details=(
                f"Found {len([g for g in symbol_day_groups.values() if len(g) > 1])} "
                f"symbol/day groups with split fills"
            ),
        )

    def compare_paper_vs_live(
        self,
        paper_trades: List[TradeRecord],
        live_trades: List[TradeRecord],
    ) -> List[str]:
        """Compare paper trading metrics against live trading metrics.

        Identifies divergences between paper and live performance to highlight
        areas where real-market execution differs from simulated trading.

        Args:
            paper_trades: Trades from paper trading source.
            live_trades: Trades from live trading source.

        Returns:
            List of insight strings highlighting divergences.
        """
        insights: List[str] = []

        if not paper_trades or not live_trades:
            return insights

        # Compute basic metrics for each source
        paper_metrics = self._compute_basic_metrics(paper_trades)
        live_metrics = self._compute_basic_metrics(live_trades)

        # Compare win rates
        paper_wr = paper_metrics["win_rate"]
        live_wr = live_metrics["win_rate"]
        wr_diff = abs(paper_wr - live_wr)

        if wr_diff > 10:
            if paper_wr > live_wr:
                insights.append(
                    f"Paper vs Live win rate divergence: Paper {paper_wr:.1f}% vs "
                    f"Live {live_wr:.1f}%. Live execution may be impacted by "
                    f"emotions or market conditions."
                )
            else:
                insights.append(
                    f"Paper vs Live win rate divergence: Live {live_wr:.1f}% vs "
                    f"Paper {paper_wr:.1f}%. Strong live execution."
                )

        # Compare average P&L per trade
        paper_avg_pnl = paper_metrics["avg_pnl"]
        live_avg_pnl = live_metrics["avg_pnl"]

        if paper_avg_pnl != 0:
            pnl_ratio = live_avg_pnl / paper_avg_pnl if paper_avg_pnl != 0 else 0
            if pnl_ratio < 0.5 and paper_avg_pnl > 0:
                insights.append(
                    f"Live average P&L ({live_avg_pnl:.2f}) is significantly lower "
                    f"than paper ({paper_avg_pnl:.2f}). Consider slippage and "
                    f"execution timing."
                )

        # Compare trade frequency
        paper_count = len(paper_trades)
        live_count = len(live_trades)
        if paper_count > 0 and live_count > 0:
            ratio = live_count / paper_count
            if ratio > 2.0:
                insights.append(
                    f"Trading frequency divergence: {live_count} live trades vs "
                    f"{paper_count} paper trades. Higher live frequency may indicate "
                    f"overtrading in real markets."
                )
            elif ratio < 0.5:
                insights.append(
                    f"Trading frequency divergence: {live_count} live trades vs "
                    f"{paper_count} paper trades. Lower live frequency may indicate "
                    f"hesitation or missed opportunities."
                )

        # Compare average slippage impact
        slippage_summary = self.calculate_slippage_summary(live_trades)
        if slippage_summary.average_slippage > 0 and slippage_summary.unfavorable_count > 0:
            insights.append(
                f"Execution slippage: Average unfavorable slippage of "
                f"{slippage_summary.average_slippage:.4f} per trade across "
                f"{slippage_summary.unfavorable_count} trades. This may explain "
                f"part of the paper-live performance gap."
            )

        return insights

    def _compute_basic_metrics(self, trades: List[TradeRecord]) -> Dict[str, float]:
        """Compute basic metrics for a set of trades.

        Args:
            trades: List of TradeRecord objects.

        Returns:
            Dict with win_rate, avg_pnl, total_pnl keys.
        """
        if not trades:
            return {"win_rate": 0.0, "avg_pnl": 0.0, "total_pnl": 0.0}

        wins = sum(1 for t in trades if t.realized_pnl > 0)
        total_pnl = sum(t.realized_pnl for t in trades)
        win_rate = (wins / len(trades)) * 100 if trades else 0.0
        avg_pnl = total_pnl / len(trades) if trades else 0.0

        return {
            "win_rate": win_rate,
            "avg_pnl": avg_pnl,
            "total_pnl": total_pnl,
        }
