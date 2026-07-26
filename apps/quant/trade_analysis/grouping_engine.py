"""
Trade Analysis Engine Grouping Engine.

Partitions trades by dimension and computes per-group metrics.

Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import time
from typing import Dict, List, Optional

from .exceptions import GroupingDimensionError
from .models import GroupedMetrics, TradeRecord
from .performance_calculator import TradePerformanceCalculator

logger = logging.getLogger(__name__)


class GroupingEngine:
    """
    Partitions trades by dimension and computes per-group metrics.

    Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
    """

    VALID_DIMENSIONS = [
        "strategy",
        "setup",
        "market_regime",
        "sector",
        "time_of_day",
        "holding_period",
        "probability",
    ]

    TIME_BUCKETS = {
        "pre_market": (time(9, 0), time(9, 15)),
        "morning": (time(9, 15), time(11, 30)),
        "midday": (time(11, 30), time(13, 30)),
        "afternoon": (time(13, 30), time(15, 0)),
        "closing": (time(15, 0), time(15, 30)),
    }

    HOLDING_PERIOD_BUCKETS = {
        "intraday": (0, 0),
        "1-3 days": (1, 3),
        "4-7 days": (4, 7),
        "1-2 weeks": (8, 14),
        "2+ weeks": (15, None),
    }

    PROBABILITY_RANGES = {
        "0-25%": (0, 25),
        "25-50%": (25, 50),
        "50-75%": (50, 75),
        "75-100%": (75, 100),
    }

    def __init__(self):
        """Initialize with performance calculator."""
        self._calculator = TradePerformanceCalculator()

    def group_and_calculate(
        self, trades: List[TradeRecord], dimension: str
    ) -> List[GroupedMetrics]:
        """
        Partition trades by dimension and compute metrics per group.

        Empty groups are omitted from results.

        Args:
            trades: List of TradeRecord objects to group.
            dimension: Grouping dimension (e.g., "strategy", "time_of_day").

        Returns:
            List of GroupedMetrics, one per non-empty group.

        Raises:
            GroupingDimensionError: If dimension is not valid.
        """
        if dimension not in self.VALID_DIMENSIONS:
            raise GroupingDimensionError(dimension, self.VALID_DIMENSIONS)

        # Partition trades into groups
        groups: Dict[str, List[TradeRecord]] = defaultdict(list)

        for trade in trades:
            key = self._get_dimension_value(trade, dimension)
            if key is not None:
                groups[key].append(trade)

        # Compute metrics per group (omit empty groups)
        results: List[GroupedMetrics] = []
        for dimension_value, group_trades in sorted(groups.items()):
            if not group_trades:
                continue

            metrics = self._calculator.calculate_metrics(group_trades)
            results.append(GroupedMetrics(
                dimension_value=dimension_value,
                trade_count=metrics.total_trades,
                win_rate=metrics.win_rate,
                profit_factor=metrics.profit_factor,
                expectancy=metrics.expectancy,
                total_pnl=metrics.total_pnl,
                average_r=metrics.average_r,
            ))

        return results

    def _get_dimension_value(self, trade: TradeRecord, dimension: str) -> Optional[str]:
        """
        Extract the grouping key for a trade based on dimension.

        Returns None if the trade doesn't have a value for this dimension.
        """
        if dimension == "strategy":
            return trade.strategy

        elif dimension == "setup":
            return trade.setup

        elif dimension == "market_regime":
            if trade.market_regime is not None:
                return trade.market_regime.value if hasattr(trade.market_regime, 'value') else str(trade.market_regime)
            return None

        elif dimension == "sector":
            return trade.sector

        elif dimension == "time_of_day":
            return self._get_time_bucket(trade)

        elif dimension == "holding_period":
            return self._get_holding_period_bucket(trade)

        elif dimension == "probability":
            return self._get_probability_bucket(trade)

        return None

    def _get_time_bucket(self, trade: TradeRecord) -> Optional[str]:
        """Determine time-of-day bucket based on entry time."""
        entry_time = trade.entry_date.time()

        for bucket_name, (start, end) in self.TIME_BUCKETS.items():
            if start <= entry_time < end:
                return bucket_name

        # If outside all buckets, return None
        return None

    def _get_holding_period_bucket(self, trade: TradeRecord) -> str:
        """Determine holding period bucket based on holding_period_days."""
        days = trade.holding_period_days

        if days == 0:
            return "intraday"
        elif 1 <= days <= 3:
            return "1-3 days"
        elif 4 <= days <= 7:
            return "4-7 days"
        elif 8 <= days <= 14:
            return "1-2 weeks"
        else:
            return "2+ weeks"

    def _get_probability_bucket(self, trade: TradeRecord) -> Optional[str]:
        """Determine probability bucket."""
        if trade.probability is None:
            return None

        prob = trade.probability

        if 0 <= prob < 25:
            return "0-25%"
        elif 25 <= prob < 50:
            return "25-50%"
        elif 50 <= prob < 75:
            return "50-75%"
        elif 75 <= prob <= 100:
            return "75-100%"

        return None
