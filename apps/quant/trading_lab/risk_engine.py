"""
AI Trading Lab Risk Engine.

This module implements risk evaluation logic for trading recommendations,
including risk/reward ratio calculation, position sizing based on 2% max risk,
and high-risk trade flagging.

Requirements: 7.1, 7.2, 7.3, 7.4
"""

from __future__ import annotations

import logging
from typing import List

from .models import RiskAssessment

logger = logging.getLogger(__name__)


class RiskEngine:
    """
    Evaluates risk parameters for trading recommendations.

    Calculates risk/reward ratios, position sizing, and flags high-risk trades.
    Uses a maximum risk of 2% of portfolio value per trade for position sizing.

    Requirements: 7.1, 7.2, 7.3, 7.4
    """

    MAX_RISK_PERCENT: float = 0.02  # 2% max risk per trade
    HIGH_RISK_RR_THRESHOLD: float = 1.5  # R:R below this is high-risk

    def evaluate(
        self,
        entry_price: float,
        stop_loss: float,
        target_price: float,
        portfolio_value: float = 1000000.0,
    ) -> RiskAssessment:
        """
        Evaluate risk for a proposed trade.

        Calculates the risk/reward ratio, suggested position size (based on 2%
        max portfolio risk), maximum loss amount, and flags high-risk trades.

        Args:
            entry_price: Proposed entry price for the trade.
            stop_loss: Stop loss price level.
            target_price: Target/take-profit price level.
            portfolio_value: Total portfolio value for position sizing.
                Defaults to 1,000,000.

        Returns:
            RiskAssessment with calculated metrics and risk flags.
        """
        warnings: List[str] = []

        # Handle edge cases
        if entry_price <= 0 or stop_loss <= 0:
            warnings.append("Invalid price levels: entry and stop_loss must be positive")
            return RiskAssessment(
                risk_reward_ratio=0.0,
                max_loss_amount=0.0,
                position_size_suggested=0,
                is_high_risk=True,
                warnings=warnings,
                passed=False,
            )

        # Calculate risk per share
        risk_per_share = abs(entry_price - stop_loss)

        # Handle edge case: stop_loss == entry_price (zero risk per share)
        if risk_per_share == 0:
            warnings.append(
                "Stop loss equals entry price — cannot calculate risk/reward"
            )
            return RiskAssessment(
                risk_reward_ratio=0.0,
                max_loss_amount=0.0,
                position_size_suggested=0,
                is_high_risk=True,
                warnings=warnings,
                passed=False,
            )

        # Calculate reward per share
        reward_per_share = abs(target_price - entry_price)

        # Calculate risk/reward ratio
        risk_reward_ratio = reward_per_share / risk_per_share

        # Calculate position size based on 2% max risk
        max_risk_amount = portfolio_value * self.MAX_RISK_PERCENT
        position_size = int(max_risk_amount / risk_per_share)

        # Calculate max loss amount
        max_loss_amount = position_size * risk_per_share

        # Determine if high-risk
        is_high_risk = risk_reward_ratio < self.HIGH_RISK_RR_THRESHOLD

        # Add warnings for high-risk trades
        if is_high_risk:
            warnings.append(
                f"High-risk trade: R:R ratio {risk_reward_ratio:.2f} is below "
                f"minimum threshold of {self.HIGH_RISK_RR_THRESHOLD}"
            )

        # Trade passes only when R:R >= 1.5
        passed = not is_high_risk

        return RiskAssessment(
            risk_reward_ratio=round(risk_reward_ratio, 4),
            max_loss_amount=round(max_loss_amount, 2),
            position_size_suggested=position_size,
            is_high_risk=is_high_risk,
            warnings=warnings,
            passed=passed,
        )
