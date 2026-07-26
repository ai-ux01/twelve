"""
Backtesting Engine Position Manager.

Tracks open positions and evaluates exit conditions including
stop loss, target, trailing stop, and holding period.
Handles same-bar conflict resolution with conservative assumptions.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from .models import (
    StopLossConfig,
    TargetConfig,
    TradeDirection,
    TrailingStopConfig,
)

logger = logging.getLogger(__name__)


@dataclass
class Position:
    """An open position being tracked."""
    direction: TradeDirection = TradeDirection.LONG
    entry_price: float = 0.0
    entry_bar: int = 0
    quantity: float = 0.0
    stop_loss_price: Optional[float] = None
    target_price: Optional[float] = None
    trailing_stop_price: Optional[float] = None
    trailing_stop_distance: Optional[float] = None  # absolute distance
    max_holding_period: Optional[int] = None


@dataclass
class ExitSignal:
    """Signal indicating position should be closed."""
    should_exit: bool = False
    exit_price: float = 0.0
    exit_reason: str = ""


class PositionManager:
    """
    Tracks positions and evaluates exit conditions.

    Single position model (no pyramiding).
    Evaluates stop loss, target, trailing stop, and holding period each bar.
    Handles same-bar conflicts conservatively.
    """

    def __init__(self):
        """Initialize PositionManager."""
        self._position: Optional[Position] = None

    @property
    def has_position(self) -> bool:
        """Whether there is an open position."""
        return self._position is not None

    @property
    def current_position(self) -> Optional[Position]:
        """Get the current open position."""
        return self._position

    def open_position(
        self,
        entry_price: float,
        bar_index: int,
        direction: TradeDirection,
        quantity: float,
        stop_loss: Optional[StopLossConfig] = None,
        target: Optional[TargetConfig] = None,
        trailing_stop: Optional[TrailingStopConfig] = None,
        max_holding_period: Optional[int] = None,
    ) -> None:
        """
        Open a new position.

        Args:
            entry_price: Entry execution price (after slippage).
            bar_index: Bar index of entry.
            direction: LONG or SHORT.
            quantity: Number of shares/units.
            stop_loss: Stop loss configuration.
            target: Target/take-profit configuration.
            trailing_stop: Trailing stop configuration.
            max_holding_period: Max bars to hold.
        """
        if self._position is not None:
            logger.warning("Attempted to open position while one is already open")
            return

        # Calculate stop loss price
        stop_price = None
        if stop_loss and stop_loss.value > 0:
            if stop_loss.model == "fixed":
                if direction == TradeDirection.LONG:
                    stop_price = entry_price - stop_loss.value
                else:
                    stop_price = entry_price + stop_loss.value
            elif stop_loss.model == "percentage":
                if direction == TradeDirection.LONG:
                    stop_price = entry_price * (1 - stop_loss.value / 100.0)
                else:
                    stop_price = entry_price * (1 + stop_loss.value / 100.0)

        # Calculate target price
        tgt_price = None
        if target and target.value > 0:
            if target.model == "fixed":
                if direction == TradeDirection.LONG:
                    tgt_price = entry_price + target.value
                else:
                    tgt_price = entry_price - target.value
            elif target.model == "percentage":
                if direction == TradeDirection.LONG:
                    tgt_price = entry_price * (1 + target.value / 100.0)
                else:
                    tgt_price = entry_price * (1 - target.value / 100.0)

        # Calculate trailing stop
        trail_price = None
        trail_distance = None
        if trailing_stop and trailing_stop.value > 0:
            if trailing_stop.model == "fixed":
                trail_distance = trailing_stop.value
            elif trailing_stop.model == "percentage":
                trail_distance = entry_price * (trailing_stop.value / 100.0)

            if trail_distance:
                if direction == TradeDirection.LONG:
                    trail_price = entry_price - trail_distance
                else:
                    trail_price = entry_price + trail_distance

        self._position = Position(
            direction=direction,
            entry_price=entry_price,
            entry_bar=bar_index,
            quantity=quantity,
            stop_loss_price=stop_price,
            target_price=tgt_price,
            trailing_stop_price=trail_price,
            trailing_stop_distance=trail_distance,
            max_holding_period=max_holding_period,
        )

    def evaluate_exit(
        self,
        bar_index: int,
        open_price: float,
        high_price: float,
        low_price: float,
        close_price: float,
    ) -> ExitSignal:
        """
        Evaluate exit conditions against current bar OHLC.

        Checks stop loss, target, trailing stop, and holding period.
        Updates trailing stop if position still open.

        Args:
            bar_index: Current bar index.
            open_price: Current bar open.
            high_price: Current bar high.
            low_price: Current bar low.
            close_price: Current bar close.

        Returns:
            ExitSignal indicating whether to exit and at what price.
        """
        if self._position is None:
            return ExitSignal(should_exit=False)

        pos = self._position

        # Check holding period first
        holding_bars = bar_index - pos.entry_bar
        if pos.max_holding_period and holding_bars >= pos.max_holding_period:
            return ExitSignal(
                should_exit=True,
                exit_price=open_price,  # Exit at open of the bar that exceeds holding
                exit_reason="holding_period",
            )

        # Check for same-bar conflict (both stop and target could be hit)
        stop_hit = False
        target_hit = False

        if pos.direction == TradeDirection.LONG:
            if pos.stop_loss_price is not None and low_price <= pos.stop_loss_price:
                stop_hit = True
            if pos.target_price is not None and high_price >= pos.target_price:
                target_hit = True
        else:  # SHORT
            if pos.stop_loss_price is not None and high_price >= pos.stop_loss_price:
                stop_hit = True
            if pos.target_price is not None and low_price <= pos.target_price:
                target_hit = True

        # Check trailing stop
        trailing_hit = False
        if pos.trailing_stop_price is not None:
            if pos.direction == TradeDirection.LONG:
                if low_price <= pos.trailing_stop_price:
                    trailing_hit = True
            else:
                if high_price >= pos.trailing_stop_price:
                    trailing_hit = True

        # Same-bar conflict resolution: conservative approach
        if stop_hit and target_hit:
            # For longs: if open is closer to stop, assume stop hit first
            # For shorts: if open is closer to stop, assume stop hit first
            if pos.direction == TradeDirection.LONG:
                dist_to_stop = abs(open_price - pos.stop_loss_price)
                dist_to_target = abs(open_price - pos.target_price)
            else:
                dist_to_stop = abs(open_price - pos.stop_loss_price)
                dist_to_target = abs(open_price - pos.target_price)

            if dist_to_stop <= dist_to_target:
                # Stop hit first (conservative)
                return ExitSignal(
                    should_exit=True,
                    exit_price=pos.stop_loss_price,
                    exit_reason="stop_loss",
                )
            else:
                return ExitSignal(
                    should_exit=True,
                    exit_price=pos.target_price,
                    exit_reason="target",
                )

        # Individual checks (priority: stop > trailing > target)
        if stop_hit:
            return ExitSignal(
                should_exit=True,
                exit_price=pos.stop_loss_price,
                exit_reason="stop_loss",
            )

        if trailing_hit:
            return ExitSignal(
                should_exit=True,
                exit_price=pos.trailing_stop_price,
                exit_reason="trailing_stop",
            )

        if target_hit:
            return ExitSignal(
                should_exit=True,
                exit_price=pos.target_price,
                exit_reason="target",
            )

        # Update trailing stop (no exit triggered)
        self._update_trailing_stop(high_price, low_price)

        return ExitSignal(should_exit=False)

    def close_position(self) -> Optional[Position]:
        """
        Close the current position and return it.

        Returns:
            The closed Position, or None if no position was open.
        """
        pos = self._position
        self._position = None
        return pos

    def _update_trailing_stop(self, high_price: float, low_price: float) -> None:
        """
        Update trailing stop price based on new high/low.

        For longs: trail_stop = max(trail_stop, high - trail_distance)
        For shorts: trail_stop = min(trail_stop, low + trail_distance)

        The trailing stop never moves against the trade direction (monotonic).
        """
        if self._position is None or self._position.trailing_stop_price is None:
            return

        pos = self._position

        if pos.trailing_stop_distance is None:
            return

        if pos.direction == TradeDirection.LONG:
            # Trailing stop moves up only
            new_stop = high_price - pos.trailing_stop_distance
            if new_stop > pos.trailing_stop_price:
                pos.trailing_stop_price = new_stop
        else:
            # Trailing stop moves down only
            new_stop = low_price + pos.trailing_stop_distance
            if new_stop < pos.trailing_stop_price:
                pos.trailing_stop_price = new_stop
