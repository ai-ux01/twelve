"""
AI Trading Lab Response Formatter.

This module implements mode-specific formatting of trading recommendations,
supporting QUICK, DETAILED, TRADER, QUANT, and COACH response modes.

Requirements: 4.4, 4.5, 4.6, 4.7, 4.8
"""

from __future__ import annotations

import logging
from typing import List

from .models import Recommendation, ResponseMode, SignalDirection

logger = logging.getLogger(__name__)


class ResponseFormatter:
    """
    Formats trading recommendations according to the selected response mode.

    Each mode produces a distinct output style:
    - QUICK: Concise one-liner with key metrics
    - DETAILED: Full technical breakdown with sections
    - TRADER: Actionable trade plan format
    - QUANT: Numerical/statistical focus
    - COACH: Educational explanations

    Requirements: 4.4, 4.5, 4.6, 4.7, 4.8
    """

    def format(self, recommendation: Recommendation, mode: ResponseMode) -> str:
        """
        Format a recommendation based on the selected response mode.

        Args:
            recommendation: The structured trading recommendation to format.
            mode: The response display mode.

        Returns:
            Formatted string representation of the recommendation.
        """
        if mode == ResponseMode.QUICK:
            return self._format_quick(recommendation)
        elif mode == ResponseMode.DETAILED:
            return self._format_detailed(recommendation)
        elif mode == ResponseMode.TRADER:
            return self._format_trader(recommendation)
        elif mode == ResponseMode.QUANT:
            return self._format_quant(recommendation)
        elif mode == ResponseMode.COACH:
            return self._format_coach(recommendation)
        else:
            return self._format_quick(recommendation)

    def _format_quick(self, rec: Recommendation) -> str:
        """
        QUICK mode: Concise one-liner with signal, probability, R:R, and levels.

        Requirement: 4.4
        """
        signal_emoji = self._get_signal_emoji(rec.signal)
        parts = [
            f"{signal_emoji} {rec.signal.value}",
            f"Probability: {rec.probability:.0f}%",
            f"R:R: 1:{rec.risk_reward_ratio:.1f}",
        ]

        if rec.entry_price is not None:
            parts.append(f"Entry: ₹{rec.entry_price:.2f}")
        if rec.stop_loss is not None:
            parts.append(f"SL: ₹{rec.stop_loss:.2f}")
        if rec.target_price is not None:
            parts.append(f"Target: ₹{rec.target_price:.2f}")

        result = " | ".join(parts)

        # Add warnings
        warnings = self._get_warnings(rec)
        if warnings:
            result += "\n" + warnings

        return result

    def _format_detailed(self, rec: Recommendation) -> str:
        """
        DETAILED mode: Full breakdown with sections for analysis components.

        Requirement: 4.5
        """
        sections = []

        # Header
        signal_emoji = self._get_signal_emoji(rec.signal)
        sections.append(
            f"{'='*50}\n"
            f"{signal_emoji} DETAILED ANALYSIS — {rec.signal.value} Signal\n"
            f"{'='*50}"
        )

        # Price Action Section
        sections.append(
            "📊 PRICE ACTION\n"
            f"  Signal: {rec.signal.value}\n"
            f"  Probability: {rec.probability:.1f}%\n"
            f"  Risk/Reward: 1:{rec.risk_reward_ratio:.2f}"
        )

        # Trend Section
        sections.append(
            "📈 TREND\n"
            f"  Direction: {'Bullish' if rec.signal == SignalDirection.BUY else 'Bearish' if rec.signal == SignalDirection.SELL else 'Neutral'}\n"
            f"  Confidence: {rec.probability:.1f}%"
        )

        # Indicators Section
        sections.append(
            "📉 INDICATORS\n"
            f"  Signal Strength: {'Strong' if rec.probability >= 70 else 'Moderate' if rec.probability >= 50 else 'Weak'}\n"
            f"  Risk Level: {'High' if rec.is_high_risk else 'Normal'}"
        )

        # Options Chain Section (if applicable)
        sections.append(
            "🔗 OPTIONS CHAIN\n"
            f"  Bias: {rec.signal.value}"
        )

        # Support/Resistance Section
        levels = []
        if rec.entry_price is not None:
            levels.append(f"  Entry: ₹{rec.entry_price:.2f}")
        if rec.stop_loss is not None:
            levels.append(f"  Support (SL): ₹{rec.stop_loss:.2f}")
        if rec.target_price is not None:
            levels.append(f"  Resistance (Target): ₹{rec.target_price:.2f}")
        if levels:
            sections.append("🎯 SUPPORT / RESISTANCE\n" + "\n".join(levels))

        # Rationale Section
        sections.append(f"💡 RATIONALE\n  {rec.rationale}")

        result = "\n\n".join(sections)

        # Add warnings
        warnings = self._get_warnings(rec)
        if warnings:
            result += "\n\n" + warnings

        return result

    def _format_trader(self, rec: Recommendation) -> str:
        """
        TRADER mode: Actionable trade plan format.

        Requirement: 4.6
        """
        lines = [
            f"ACTION: {rec.signal.value}",
        ]

        if rec.entry_price is not None:
            lines.append(f"ENTRY: ₹{rec.entry_price:.2f}")
        if rec.stop_loss is not None:
            lines.append(f"STOP LOSS: ₹{rec.stop_loss:.2f}")
        if rec.target_price is not None:
            lines.append(f"TARGET: ₹{rec.target_price:.2f}")
        if rec.position_size is not None:
            lines.append(f"POSITION SIZE: {rec.position_size} shares")

        lines.append(f"R:R: 1:{rec.risk_reward_ratio:.1f}")

        # Calculate max risk
        if rec.entry_price is not None and rec.stop_loss is not None and rec.position_size is not None:
            risk_per_share = abs(rec.entry_price - rec.stop_loss)
            max_risk = rec.position_size * risk_per_share
            lines.append(f"RISK: ₹{max_risk:.0f} max")
        elif rec.entry_price is not None and rec.stop_loss is not None:
            risk_per_share = abs(rec.entry_price - rec.stop_loss)
            lines.append(f"RISK: ₹{risk_per_share:.2f}/share")

        result = "\n".join(lines)

        # Add warnings
        warnings = self._get_warnings(rec)
        if warnings:
            result += "\n\n" + warnings

        return result

    def _format_quant(self, rec: Recommendation) -> str:
        """
        QUANT mode: Numerical/statistical focus with probability distributions.

        Requirement: 4.7
        """
        lines = [
            "═══ QUANTITATIVE SUMMARY ═══",
            "",
            "PROBABILITY DISTRIBUTION:",
            f"  Signal: {rec.signal.value}",
            f"  P(success): {rec.probability:.2f}%",
            f"  P(failure): {100 - rec.probability:.2f}%",
            "",
            "RISK METRICS:",
            f"  Risk/Reward Ratio: {rec.risk_reward_ratio:.4f}",
            f"  Expected Value: {(rec.probability / 100) * rec.risk_reward_ratio - (1 - rec.probability / 100):.4f}R",
        ]

        if rec.entry_price is not None:
            lines.append(f"  Entry Price: ₹{rec.entry_price:.2f}")
        if rec.stop_loss is not None:
            lines.append(f"  Stop Loss: ₹{rec.stop_loss:.2f}")
        if rec.target_price is not None:
            lines.append(f"  Target Price: ₹{rec.target_price:.2f}")
        if rec.entry_price is not None and rec.stop_loss is not None:
            risk_per_share = abs(rec.entry_price - rec.stop_loss)
            lines.append(f"  Risk/Share: ₹{risk_per_share:.2f}")
        if rec.entry_price is not None and rec.target_price is not None:
            reward_per_share = abs(rec.target_price - rec.entry_price)
            lines.append(f"  Reward/Share: ₹{reward_per_share:.2f}")

        lines.extend([
            "",
            "POSITION SIZING:",
            f"  Suggested Size: {rec.position_size if rec.position_size else 0} shares",
        ])

        lines.extend([
            "",
            "STATISTICAL CONFIDENCE:",
            f"  Confidence Level: {'HIGH' if rec.probability >= 70 else 'MODERATE' if rec.probability >= 50 else 'LOW'}",
            f"  Is Low Confidence: {rec.is_low_confidence}",
            f"  Is High Risk: {rec.is_high_risk}",
        ])

        result = "\n".join(lines)

        # Add warnings
        warnings = self._get_warnings(rec)
        if warnings:
            result += "\n\n" + warnings

        return result

    def _format_coach(self, rec: Recommendation) -> str:
        """
        COACH mode: Educational explanations for beginners.

        Requirement: 4.8
        """
        sections = []

        # Header
        signal_emoji = self._get_signal_emoji(rec.signal)
        sections.append(
            f"{signal_emoji} TRADING COACH — Understanding This {rec.signal.value} Signal\n"
            f"{'─'*50}"
        )

        # Explain the signal
        signal_explanation = self._get_signal_explanation(rec.signal)
        sections.append(
            f"📖 WHAT IS A {rec.signal.value} SIGNAL?\n"
            f"  {signal_explanation}"
        )

        # Explain probability
        sections.append(
            f"🎲 PROBABILITY ({rec.probability:.0f}%)\n"
            f"  This means the model estimates a {rec.probability:.0f}% chance this\n"
            f"  trade will move in the suggested direction.\n"
            f"  {'⚠️  This is below 60% — considered low confidence. Be cautious.' if rec.is_low_confidence else '✅ This is above 60% — a reasonable confidence level.'}"
        )

        # Explain R:R ratio
        sections.append(
            f"⚖️  RISK/REWARD RATIO (1:{rec.risk_reward_ratio:.1f})\n"
            f"  For every ₹1 you risk, you stand to gain ₹{rec.risk_reward_ratio:.1f}.\n"
            f"  {'⚠️  R:R below 1.5 is considered high-risk. The potential reward may not justify the risk.' if rec.is_high_risk else '✅ A ratio above 1.5 means potential reward outweighs the risk.'}"
        )

        # Explain key levels
        if rec.entry_price is not None:
            sections.append(
                f"🎯 KEY PRICE LEVELS\n"
                f"  Entry (₹{rec.entry_price:.2f}): The price at which you would open the trade.\n"
                + (f"  Stop Loss (₹{rec.stop_loss:.2f}): Exit here to limit losses if the trade goes against you.\n" if rec.stop_loss else "")
                + (f"  Target (₹{rec.target_price:.2f}): The price where you plan to take profits.\n" if rec.target_price else "")
                + (f"  Position Size ({rec.position_size} shares): How many shares to buy based on your risk tolerance." if rec.position_size else "")
            )

        # Explain rationale
        sections.append(
            f"💡 WHY THIS DIRECTION?\n"
            f"  {rec.rationale}"
        )

        # Beginner tips
        sections.append(
            "📚 WHAT BEGINNERS SHOULD KNOW\n"
            "  • Always use a stop loss to limit potential losses\n"
            "  • Never risk more than 2% of your portfolio on a single trade\n"
            "  • A high probability doesn't guarantee success — manage risk always\n"
            "  • Paper trade first before committing real capital\n"
            "  • Review your trade history to learn from past decisions"
        )

        result = "\n\n".join(sections)

        # Add warnings
        warnings = self._get_warnings(rec)
        if warnings:
            result += "\n\n" + warnings

        return result

    def _get_signal_emoji(self, signal: SignalDirection) -> str:
        """Get the appropriate emoji for a signal direction."""
        if signal == SignalDirection.BUY:
            return "📈"
        elif signal == SignalDirection.SELL:
            return "📉"
        return "⏸️"

    def _get_signal_explanation(self, signal: SignalDirection) -> str:
        """Get an educational explanation for a signal direction."""
        if signal == SignalDirection.BUY:
            return (
                "A BUY signal suggests the stock is likely to move UP from current levels.\n"
                "  This is based on technical indicators, price patterns, and market conditions\n"
                "  suggesting bullish (upward) momentum."
            )
        elif signal == SignalDirection.SELL:
            return (
                "A SELL signal suggests the stock is likely to move DOWN from current levels.\n"
                "  This is based on technical indicators, price patterns, and market conditions\n"
                "  suggesting bearish (downward) momentum."
            )
        return (
            "A HOLD signal means no clear directional bias exists right now.\n"
            "  The indicators are mixed or neutral, suggesting it's best to wait\n"
            "  for a clearer setup before entering a trade."
        )

    def _get_warnings(self, rec: Recommendation) -> str:
        """Build a warnings section string if there are any warnings/flags."""
        warning_lines: List[str] = []

        if rec.is_low_confidence:
            warning_lines.append(
                "⚠️  LOW CONFIDENCE: Probability below 60% — exercise extra caution"
            )
        if rec.is_high_risk:
            warning_lines.append(
                "⚠️  HIGH RISK: Risk/Reward ratio below 1.5 — consider reducing position size"
            )
        if rec.warnings:
            for w in rec.warnings:
                warning_lines.append(f"⚠️  {w}")

        if warning_lines:
            return "⚠️  WARNINGS:\n" + "\n".join(f"  {w}" for w in warning_lines)
        return ""
