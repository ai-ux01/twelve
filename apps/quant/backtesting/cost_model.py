"""
Backtesting Engine Cost Model.

Applies slippage to entry/exit prices and calculates brokerage fees.
Provides net P&L after all transaction costs.
"""

from __future__ import annotations

from .models import BrokerageConfig, SlippageConfig, TradeDirection


class CostModel:
    """
    Simulates transaction costs: slippage and brokerage fees.

    Slippage: adverse price movement on execution (fixed points or percentage).
    Brokerage: per-trade fee (fixed amount or percentage of trade value).
    """

    def __init__(
        self,
        slippage_config: SlippageConfig,
        brokerage_config: BrokerageConfig,
    ):
        """
        Initialize CostModel.

        Args:
            slippage_config: Slippage configuration.
            brokerage_config: Brokerage fee configuration.
        """
        self.slippage_config = slippage_config
        self.brokerage_config = brokerage_config

    def apply_slippage(self, price: float, direction: TradeDirection, is_entry: bool) -> float:
        """
        Apply slippage to an execution price.

        For entries:
            LONG buy: price + slippage (worse fill)
            SHORT sell: price - slippage (worse fill)

        For exits:
            LONG sell: price - slippage (worse fill)
            SHORT buy: price + slippage (worse fill)

        Args:
            price: Intended execution price.
            direction: Trade direction (LONG or SHORT).
            is_entry: True for entry, False for exit.

        Returns:
            Adjusted price after slippage.
        """
        if self.slippage_config.value <= 0:
            return price

        slippage_amount = self._calculate_slippage_amount(price)

        if direction == TradeDirection.LONG:
            if is_entry:
                # Buying: slip up (worse)
                return price + slippage_amount
            else:
                # Selling: slip down (worse)
                return price - slippage_amount
        else:  # SHORT
            if is_entry:
                # Selling short: slip down (worse)
                return price - slippage_amount
            else:
                # Buying to cover: slip up (worse)
                return price + slippage_amount

    def calculate_brokerage(self, trade_value: float) -> float:
        """
        Calculate brokerage fee for a trade.

        Args:
            trade_value: Absolute value of the trade (price * quantity).

        Returns:
            Brokerage fee amount.
        """
        if self.brokerage_config.value <= 0:
            return 0.0

        if self.brokerage_config.model == "fixed":
            return self.brokerage_config.value
        elif self.brokerage_config.model == "percentage":
            return trade_value * (self.brokerage_config.value / 100.0)
        else:
            return 0.0

    def calculate_net_pnl(
        self, gross_pnl: float, entry_cost: float, exit_cost: float
    ) -> float:
        """
        Calculate net P&L after all costs.

        Args:
            gross_pnl: Gross profit/loss before costs.
            entry_cost: Brokerage cost on entry.
            exit_cost: Brokerage cost on exit.

        Returns:
            Net P&L after deducting all costs.
        """
        return gross_pnl - entry_cost - exit_cost

    def calculate_entry_exit_costs(
        self, entry_price: float, exit_price: float, quantity: float
    ) -> tuple:
        """
        Calculate entry and exit brokerage costs.

        Args:
            entry_price: Entry execution price.
            exit_price: Exit execution price.
            quantity: Trade quantity.

        Returns:
            Tuple of (entry_cost, exit_cost).
        """
        entry_value = abs(entry_price * quantity)
        exit_value = abs(exit_price * quantity)

        entry_cost = self.calculate_brokerage(entry_value)
        exit_cost = self.calculate_brokerage(exit_value)

        return entry_cost, exit_cost

    def _calculate_slippage_amount(self, price: float) -> float:
        """Calculate slippage amount based on model."""
        if self.slippage_config.model == "fixed":
            return self.slippage_config.value
        elif self.slippage_config.model == "percentage":
            return price * (self.slippage_config.value / 100.0)
        else:
            return 0.0
