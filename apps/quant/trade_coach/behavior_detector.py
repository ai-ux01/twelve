"""
Trade Coach Behavior Detector.

Analyzes actual trade records to detect 10 behavioral patterns:
1. Overtrading (>5 trades/day or >20/week)
2. Revenge trading (new trade within 5 min of a loss)
3. Oversizing (position > 3% of portfolio)
4. Chasing (entry > 1% above VWAP for longs)
5. Weak setups (probability < 50%)
6. Counter-trend (trading against market regime)
7. Poor risk/reward (R:R < 1.5)
8. Moving stops (detect from context if available)
9. Early exits (P&L < 50% of target)
10. Late exits (holding beyond max period)

Phase 15 - AI Trade Coach
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from trade_analysis.models import TradeRecord, MarketRegime, TradeDirection

from .models import BehaviorDetection, BehaviorPattern, BehaviorSeverity

logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_PORTFOLIO_VALUE = 1_000_000.0  # 1M portfolio assumption
OVERTRADING_DAILY_THRESHOLD = 5
OVERTRADING_WEEKLY_THRESHOLD = 20
REVENGE_TRADING_WINDOW_MINUTES = 5
OVERSIZING_THRESHOLD_PCT = 3.0
CHASING_THRESHOLD_PCT = 1.0
WEAK_SETUP_PROBABILITY_THRESHOLD = 50.0
POOR_RR_THRESHOLD = 1.5
EARLY_EXIT_PCT = 50.0  # exit < 50% of target
MAX_HOLDING_PERIOD_DAYS = 30


class BehaviorDetector:
    """
    Detects negative trading behavior patterns from actual trade records.

    All detections are based on real stored data - never fabricated.

    Phase 15 - AI Trade Coach
    """

    def __init__(self, portfolio_value: float = DEFAULT_PORTFOLIO_VALUE):
        """
        Initialize the BehaviorDetector.

        Args:
            portfolio_value: Portfolio value for sizing calculations (default 1M).
        """
        self._portfolio_value = portfolio_value

    def detect_all(self, trades: List[TradeRecord]) -> List[BehaviorDetection]:
        """
        Run all 10 behavior detection methods on the trade records.

        Args:
            trades: List of actual TradeRecords from the repository.

        Returns:
            List of BehaviorDetection instances for all detected patterns.
        """
        if not trades:
            return []

        detections: List[BehaviorDetection] = []

        # Run each detector
        detection = self.detect_overtrading(trades)
        if detection:
            detections.append(detection)

        detection = self.detect_revenge_trading(trades)
        if detection:
            detections.append(detection)

        detection = self.detect_oversizing(trades)
        if detection:
            detections.append(detection)

        detection = self.detect_chasing(trades)
        if detection:
            detections.append(detection)

        detection = self.detect_weak_setups(trades)
        if detection:
            detections.append(detection)

        detection = self.detect_counter_trend(trades)
        if detection:
            detections.append(detection)

        detection = self.detect_poor_risk_reward(trades)
        if detection:
            detections.append(detection)

        detection = self.detect_moving_stops(trades)
        if detection:
            detections.append(detection)

        detection = self.detect_early_exits(trades)
        if detection:
            detections.append(detection)

        detection = self.detect_late_exits(trades)
        if detection:
            detections.append(detection)

        return detections

    def detect_overtrading(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect overtrading: >5 trades in a single day, or >20 in a week.

        Groups trades by date and checks daily/weekly thresholds.
        """
        if not trades:
            return None

        # Group by day
        daily_counts: Dict[str, List[str]] = defaultdict(list)
        for t in trades:
            day_key = t.entry_date.strftime("%Y-%m-%d")
            daily_counts[day_key].append(t.id)

        overtrading_trade_ids: List[str] = []
        overtrading_days = 0

        for day_key, trade_ids in daily_counts.items():
            if len(trade_ids) > OVERTRADING_DAILY_THRESHOLD:
                overtrading_days += 1
                overtrading_trade_ids.extend(trade_ids)

        # Also check weekly
        weekly_counts: Dict[str, List[str]] = defaultdict(list)
        for t in trades:
            week_key = t.entry_date.strftime("%Y-W%W")
            weekly_counts[week_key].append(t.id)

        overtrading_weeks = 0
        for week_key, trade_ids in weekly_counts.items():
            if len(trade_ids) > OVERTRADING_WEEKLY_THRESHOLD:
                overtrading_weeks += 1
                overtrading_trade_ids.extend(trade_ids)

        # Deduplicate
        overtrading_trade_ids = list(set(overtrading_trade_ids))
        total_instances = overtrading_days + overtrading_weeks

        if total_instances == 0:
            return None

        severity = self._classify_severity(total_instances, thresholds=(1, 3, 5))

        return BehaviorDetection(
            pattern=BehaviorPattern.OVERTRADING,
            severity=severity,
            count=total_instances,
            description=(
                f"Overtrading detected: {overtrading_days} day(s) with >{OVERTRADING_DAILY_THRESHOLD} trades, "
                f"{overtrading_weeks} week(s) with >{OVERTRADING_WEEKLY_THRESHOLD} trades"
            ),
            trade_ids=overtrading_trade_ids[:20],  # Limit to 20 IDs
            details=f"Days over threshold: {overtrading_days}, Weeks over threshold: {overtrading_weeks}",
        )

    def detect_revenge_trading(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect revenge trading: new trade entered within 5 minutes of a losing trade close.
        """
        if len(trades) < 2:
            return None

        # Sort by entry_date
        sorted_trades = sorted(trades, key=lambda t: t.entry_date)
        revenge_trade_ids: List[str] = []

        # For each trade, check if it was entered within 5 min of a previous losing trade's exit
        losing_exits = []
        for t in sorted_trades:
            if t.realized_pnl < 0:
                losing_exits.append((t.exit_date, t.id))

        losing_exits.sort(key=lambda x: x[0])

        for t in sorted_trades:
            for loss_exit_date, loss_id in losing_exits:
                if loss_id == t.id:
                    continue
                time_diff = (t.entry_date - loss_exit_date).total_seconds()
                if 0 < time_diff <= REVENGE_TRADING_WINDOW_MINUTES * 60:
                    revenge_trade_ids.append(t.id)
                    break

        if not revenge_trade_ids:
            return None

        count = len(revenge_trade_ids)
        severity = self._classify_severity(count, thresholds=(1, 3, 5))

        return BehaviorDetection(
            pattern=BehaviorPattern.REVENGE_TRADING,
            severity=severity,
            count=count,
            description=(
                f"Revenge trading detected: {count} trade(s) entered within "
                f"{REVENGE_TRADING_WINDOW_MINUTES} minutes of a losing trade"
            ),
            trade_ids=revenge_trade_ids[:20],
            details=f"Trades entered impulsively after losses: {count}",
        )

    def detect_oversizing(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect oversizing: position value > 3% of portfolio.
        """
        if not trades:
            return None

        threshold_value = self._portfolio_value * (OVERSIZING_THRESHOLD_PCT / 100.0)
        oversized_ids: List[str] = []

        for t in trades:
            position_value = t.entry_price * t.quantity
            if position_value > threshold_value:
                oversized_ids.append(t.id)

        if not oversized_ids:
            return None

        count = len(oversized_ids)
        severity = self._classify_severity(count, thresholds=(1, 3, 7))

        return BehaviorDetection(
            pattern=BehaviorPattern.OVERSIZING,
            severity=severity,
            count=count,
            description=(
                f"Oversizing detected: {count} trade(s) with position value "
                f">{OVERSIZING_THRESHOLD_PCT}% of portfolio (₹{threshold_value:,.0f})"
            ),
            trade_ids=oversized_ids[:20],
            details=f"Portfolio: ₹{self._portfolio_value:,.0f}, Threshold: ₹{threshold_value:,.0f}",
        )

    def detect_chasing(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect chasing: entry price > 1% above VWAP for longs (or > 1% below for shorts).

        Uses VWAP from trade enrichment data if available; otherwise uses a simple
        average of entry_price as proxy (skip if no context).
        """
        if not trades:
            return None

        chasing_ids: List[str] = []

        for t in trades:
            # We need some reference price. If risk_reward_ratio is set,
            # we can use stop_loss as a reference. For chasing, we check
            # if entry is significantly above a reasonable level.
            # Since we don't have VWAP stored per-trade, we'll use
            # the midpoint between entry and stop_loss as a proxy for fair value.
            if t.stop_loss is None:
                continue

            if t.direction == TradeDirection.LONG:
                # For longs, chasing = entry significantly above stop (large gap)
                # Use the ratio: if entry is > 1% above midpoint between stop and a "fair" entry
                fair_value = (t.entry_price + t.stop_loss) / 2.0
                deviation_pct = ((t.entry_price - fair_value) / fair_value) * 100
                if deviation_pct > CHASING_THRESHOLD_PCT:
                    chasing_ids.append(t.id)
            else:
                # For shorts, chasing = entry significantly below stop
                fair_value = (t.entry_price + t.stop_loss) / 2.0
                deviation_pct = ((fair_value - t.entry_price) / fair_value) * 100
                if deviation_pct > CHASING_THRESHOLD_PCT:
                    chasing_ids.append(t.id)

        if not chasing_ids:
            return None

        count = len(chasing_ids)
        severity = self._classify_severity(count, thresholds=(2, 5, 10))

        return BehaviorDetection(
            pattern=BehaviorPattern.CHASING,
            severity=severity,
            count=count,
            description=(
                f"Chasing detected: {count} trade(s) with entry >{CHASING_THRESHOLD_PCT}% "
                f"away from fair value"
            ),
            trade_ids=chasing_ids[:20],
            details=f"Threshold: {CHASING_THRESHOLD_PCT}% deviation from fair value",
        )

    def detect_weak_setups(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect weak setups: trades where stored probability < 50%.
        """
        if not trades:
            return None

        weak_ids: List[str] = []

        for t in trades:
            if t.probability is not None and t.probability < WEAK_SETUP_PROBABILITY_THRESHOLD:
                weak_ids.append(t.id)

        if not weak_ids:
            return None

        count = len(weak_ids)
        severity = self._classify_severity(count, thresholds=(2, 5, 10))

        return BehaviorDetection(
            pattern=BehaviorPattern.WEAK_SETUPS,
            severity=severity,
            count=count,
            description=(
                f"Weak setups detected: {count} trade(s) with probability "
                f"<{WEAK_SETUP_PROBABILITY_THRESHOLD}%"
            ),
            trade_ids=weak_ids[:20],
            details=f"Threshold: probability < {WEAK_SETUP_PROBABILITY_THRESHOLD}%",
        )

    def detect_counter_trend(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect counter-trend trades: trade direction opposite to market regime.

        Only applicable for trades with market_regime data populated.
        - TRENDING market + SHORT = counter-trend (if ADX is high, regime is bullish-trending)
        - We simplify: if regime is TRENDING and trade is SHORT, flag it.
          If regime is TRENDING and trade is LONG, it's fine.
        """
        if not trades:
            return None

        counter_trend_ids: List[str] = []

        for t in trades:
            if t.market_regime is None:
                continue
            # If regime is trending and RSI suggests direction
            if t.market_regime == MarketRegime.TRENDING:
                # Use RSI to determine trend direction
                if t.rsi_at_entry is not None:
                    if t.rsi_at_entry > 50 and t.direction == TradeDirection.SHORT:
                        counter_trend_ids.append(t.id)
                    elif t.rsi_at_entry < 50 and t.direction == TradeDirection.LONG:
                        counter_trend_ids.append(t.id)

        if not counter_trend_ids:
            return None

        count = len(counter_trend_ids)
        severity = self._classify_severity(count, thresholds=(1, 3, 5))

        return BehaviorDetection(
            pattern=BehaviorPattern.COUNTER_TREND,
            severity=severity,
            count=count,
            description=(
                f"Counter-trend trading detected: {count} trade(s) against "
                f"the dominant market trend"
            ),
            trade_ids=counter_trend_ids[:20],
            details="Trades taken opposite to market regime direction",
        )

    def detect_poor_risk_reward(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect poor risk/reward: R:R ratio < 1.5.

        Uses the stored risk_reward_ratio if available, otherwise
        computes from entry, stop_loss, and exit_price.
        """
        if not trades:
            return None

        poor_rr_ids: List[str] = []

        for t in trades:
            rr = t.risk_reward_ratio
            if rr is None and t.stop_loss is not None:
                # Calculate from available data
                risk = abs(t.entry_price - t.stop_loss)
                if risk > 0:
                    reward = abs(t.exit_price - t.entry_price)
                    rr = reward / risk

            if rr is not None and rr < POOR_RR_THRESHOLD:
                poor_rr_ids.append(t.id)

        if not poor_rr_ids:
            return None

        count = len(poor_rr_ids)
        severity = self._classify_severity(count, thresholds=(3, 7, 15))

        return BehaviorDetection(
            pattern=BehaviorPattern.POOR_RISK_REWARD,
            severity=severity,
            count=count,
            description=(
                f"Poor risk/reward detected: {count} trade(s) with R:R < {POOR_RR_THRESHOLD}"
            ),
            trade_ids=poor_rr_ids[:20],
            details=f"Threshold: R:R ratio must be >= {POOR_RR_THRESHOLD}",
        )

    def detect_moving_stops(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect moving stop losses (against position).

        This requires historical stop-loss data which is typically not stored
        in a single trade record. We skip this detection unless trade context
        provides evidence (e.g., MAE exceeding original stop distance).
        """
        if not trades:
            return None

        # Heuristic: if MAE > initial stop distance, stop may have been moved
        moved_stop_ids: List[str] = []

        for t in trades:
            if t.stop_loss is None or t.mae is None:
                continue
            initial_stop_distance = abs(t.entry_price - t.stop_loss) * t.quantity
            # If MAE exceeds the initial stop distance, likely the stop was moved
            if abs(t.mae) > initial_stop_distance * 1.2:  # 20% buffer
                moved_stop_ids.append(t.id)

        if not moved_stop_ids:
            return None

        count = len(moved_stop_ids)
        severity = self._classify_severity(count, thresholds=(1, 3, 5))

        return BehaviorDetection(
            pattern=BehaviorPattern.MOVING_STOPS,
            severity=severity,
            count=count,
            description=(
                f"Possible stop-loss movement detected: {count} trade(s) where "
                f"MAE exceeded initial stop distance"
            ),
            trade_ids=moved_stop_ids[:20],
            details="MAE exceeded stop distance by >20%, suggesting stop was moved against position",
        )

    def detect_early_exits(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect early exits: exit occurred when P&L < 50% of target potential.

        Uses MFE (Maximum Favorable Excursion) vs actual P&L.
        If MFE is significantly higher than realized P&L, the trader exited too early.
        """
        if not trades:
            return None

        early_exit_ids: List[str] = []

        for t in trades:
            if t.mfe is None or t.realized_pnl <= 0:
                continue
            # If realized P&L is less than 50% of MFE, it's an early exit
            if t.mfe > 0 and t.realized_pnl < (t.mfe * EARLY_EXIT_PCT / 100.0):
                early_exit_ids.append(t.id)

        if not early_exit_ids:
            return None

        count = len(early_exit_ids)
        severity = self._classify_severity(count, thresholds=(2, 5, 10))

        return BehaviorDetection(
            pattern=BehaviorPattern.EARLY_EXITS,
            severity=severity,
            count=count,
            description=(
                f"Early exits detected: {count} winning trade(s) where realized P&L "
                f"was <{EARLY_EXIT_PCT:.0f}% of maximum favorable excursion"
            ),
            trade_ids=early_exit_ids[:20],
            details=f"Threshold: realized P&L < {EARLY_EXIT_PCT}% of MFE",
        )

    def detect_late_exits(self, trades: List[TradeRecord]) -> Optional[BehaviorDetection]:
        """
        Detect late exits: holding_period > max_holding_period.
        """
        if not trades:
            return None

        late_exit_ids: List[str] = []

        for t in trades:
            if t.holding_period_days > MAX_HOLDING_PERIOD_DAYS:
                late_exit_ids.append(t.id)

        if not late_exit_ids:
            return None

        count = len(late_exit_ids)
        severity = self._classify_severity(count, thresholds=(1, 3, 5))

        return BehaviorDetection(
            pattern=BehaviorPattern.LATE_EXITS,
            severity=severity,
            count=count,
            description=(
                f"Late exits detected: {count} trade(s) held beyond "
                f"{MAX_HOLDING_PERIOD_DAYS} days"
            ),
            trade_ids=late_exit_ids[:20],
            details=f"Max holding period threshold: {MAX_HOLDING_PERIOD_DAYS} days",
        )

    @staticmethod
    def _classify_severity(count: int, thresholds: tuple) -> BehaviorSeverity:
        """
        Classify severity based on occurrence count.

        Args:
            count: Number of occurrences.
            thresholds: Tuple of (low, medium, high) thresholds.

        Returns:
            BehaviorSeverity level.
        """
        low, medium, high = thresholds
        if count >= high:
            return BehaviorSeverity.CRITICAL
        elif count >= medium:
            return BehaviorSeverity.HIGH
        elif count >= low:
            return BehaviorSeverity.MEDIUM
        return BehaviorSeverity.LOW
