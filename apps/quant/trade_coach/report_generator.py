"""
Trade Coach Report Generator.

Uses GPT-4 to generate structured coaching reports from actual trade statistics.
All reports are grounded in real data - never fabricated.

Phase 15 - AI Trade Coach
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Dict, List, Optional

from trade_analysis.models import TradeRecord, PerformanceMetrics
from trade_analysis.performance_calculator import TradePerformanceCalculator
from trade_analysis.grouping_engine import GroupingEngine

from .models import (
    BehaviorDetection,
    CoachReport,
)

logger = logging.getLogger(__name__)


class ReportGenerator:
    """
    Generates AI coaching reports using GPT-4, grounded in actual statistics.

    Queries stored trade statistics, builds factual context, and uses GPT-4
    to generate structured coaching insights. Never fabricates data.

    Phase 15 - AI Trade Coach
    """

    MAX_RETRIES: int = 2
    BASE_DELAY: float = 1.0
    BACKOFF_MULTIPLIER: float = 2.0
    LLM_MODEL: str = "gpt-4"

    SYSTEM_PROMPT: str = """You are an expert trading coach. You analyze a trader's performance data and behavior patterns to provide actionable coaching.

RULES:
1. Only reference statistics and data explicitly provided in the context.
2. Do NOT invent, hallucinate, or assume any statistics.
3. Provide specific, actionable recommendations based on the data.
4. Reference actual numbers (win rate, profit factor, expectancy) in your points.
5. Be honest about weaknesses but constructive in tone.
6. If certain data is missing, say so explicitly.

OUTPUT FORMAT:
You MUST respond with a valid JSON object with these exact keys:
{
  "strengths": ["list of things the trader does well, referencing specific numbers"],
  "weaknesses": ["list of recurring mistakes with data evidence"],
  "best_setups": ["highest performing setups/strategies with metrics"],
  "worst_setups": ["lowest performing setups/strategies with metrics"],
  "best_conditions": ["market conditions where trader excels"],
  "common_mistakes": ["most frequent bad behaviors detected"],
  "recommendations": ["specific actionable improvements, max 5"]
}

Each array should contain 2-5 items. Be specific and reference actual data."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        """
        Initialize the ReportGenerator.

        Args:
            api_key: OpenAI API key (reads OPENAI_API_KEY env if not provided).
            model: LLM model to use (defaults to GPT-4).
        """
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._model = model or os.environ.get("AI_MODEL", "") or self.LLM_MODEL
        self._client = None
        self._calculator = TradePerformanceCalculator()
        self._grouping_engine = GroupingEngine()

    def _get_client(self):
        """Lazily initialize the OpenAI async client."""
        if self._client is None:
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(api_key=self._api_key)
            except ImportError:
                raise RuntimeError(
                    "openai package not installed. Install with: pip install openai"
                )
            except Exception as e:
                raise RuntimeError(f"Failed to initialize OpenAI client: {e}")
        return self._client

    async def generate_report(
        self,
        trades: List[TradeRecord],
        behaviors: List[BehaviorDetection],
    ) -> CoachReport:
        """
        Generate a full coaching report from actual trade data.

        1. Compute aggregate metrics from trades
        2. Compute grouped breakdowns
        3. Build context with factual data + detected behaviors
        4. Call GPT-4 to generate structured report
        5. Parse JSON response into CoachReport

        Args:
            trades: Actual trade records from repository.
            behaviors: Detected behavior patterns.

        Returns:
            CoachReport with structured coaching insights.
        """
        if not trades:
            return CoachReport(
                strengths=["No trade data available for analysis"],
                weaknesses=[],
                best_setups=[],
                worst_setups=[],
                best_conditions=[],
                common_mistakes=[],
                recommendations=["Import your trades to receive personalized coaching"],
            )

        # Compute metrics
        metrics = self._calculator.calculate_metrics(trades)

        # Compute grouped breakdowns
        grouped: Dict[str, list] = {}
        for dimension in ["strategy", "market_regime", "time_of_day", "setup"]:
            try:
                grouped[dimension] = self._grouping_engine.group_and_calculate(
                    trades, dimension
                )
            except Exception:
                pass

        # Build context
        context = self._build_context(metrics, grouped, behaviors, len(trades))

        # Generate AI response
        try:
            report = await self._generate_ai_report(context)
            return report
        except Exception as e:
            logger.error(f"AI report generation failed: {e}")
            # Fallback: generate basic report from data
            return self._generate_fallback_report(metrics, behaviors)

    def _build_context(
        self,
        metrics: PerformanceMetrics,
        grouped: Dict[str, list],
        behaviors: List[BehaviorDetection],
        total_trades: int,
    ) -> str:
        """Build context string with factual trade statistics for AI prompt."""
        lines = [
            "=== TRADING PERFORMANCE DATA ===",
            "",
            "AGGREGATE METRICS:",
            f"  Total Trades: {metrics.total_trades}",
            f"  Winning Trades: {metrics.winning_trades}",
            f"  Losing Trades: {metrics.losing_trades}",
            f"  Win Rate: {metrics.win_rate:.1f}%",
            f"  Profit Factor: {metrics.profit_factor:.2f}",
            f"  Total P&L: ₹{metrics.total_pnl:.2f}",
            f"  Expectancy: ₹{metrics.expectancy:.2f}",
            f"  Max Drawdown: ₹{metrics.max_drawdown:.2f}",
            f"  Average R: {metrics.average_r:.2f}",
        ]

        if metrics.mfe_mean is not None:
            lines.extend([
                f"  MFE Mean: ₹{metrics.mfe_mean:.2f}",
                f"  MAE Mean: ₹{metrics.mae_mean:.2f}",
            ])

        # Add grouped breakdowns
        for dimension, groups in grouped.items():
            if not groups:
                continue
            lines.append(f"\nBREAKDOWN BY {dimension.upper().replace('_', ' ')}:")
            for g in groups:
                pf_str = f"{g.profit_factor:.2f}" if g.profit_factor != float("inf") else "∞"
                lines.append(
                    f"  {g.dimension_value}: "
                    f"{g.trade_count} trades, "
                    f"WR={g.win_rate:.1f}%, "
                    f"PF={pf_str}, "
                    f"Exp=₹{g.expectancy:.2f}"
                )

        # Add behavior detections
        if behaviors:
            lines.append("\n=== DETECTED BEHAVIOR PATTERNS ===")
            for b in behaviors:
                lines.append(
                    f"  [{b.severity.value.upper()}] {b.pattern.value}: "
                    f"{b.description} (count: {b.count})"
                )

        return "\n".join(lines)

    async def _generate_ai_report(self, context: str) -> CoachReport:
        """Call GPT-4 to generate structured coaching report."""
        last_error = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                client = self._get_client()
                response = await client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": (
                                f"{context}\n\n---\n\n"
                                "Based on this data, generate a comprehensive coaching report. "
                                "Respond with ONLY the JSON object as specified."
                            ),
                        },
                    ],
                    temperature=0.3,
                    max_tokens=2000,
                )

                content = response.choices[0].message.content
                if not content:
                    raise RuntimeError("Empty response from AI model")

                # Parse JSON response
                return self._parse_report_json(content)

            except (json.JSONDecodeError, KeyError, RuntimeError) as e:
                last_error = e
                logger.warning(f"Report generation attempt {attempt + 1} failed: {e}")
                if attempt < self.MAX_RETRIES:
                    delay = self.BASE_DELAY * (self.BACKOFF_MULTIPLIER ** attempt)
                    await asyncio.sleep(delay)
            except Exception as e:
                last_error = e
                logger.warning(f"Report generation attempt {attempt + 1} failed: {e}")
                if attempt < self.MAX_RETRIES:
                    delay = self.BASE_DELAY * (self.BACKOFF_MULTIPLIER ** attempt)
                    await asyncio.sleep(delay)

        raise RuntimeError(
            f"Report generation failed after {self.MAX_RETRIES + 1} attempts: {last_error}"
        )

    def _parse_report_json(self, content: str) -> CoachReport:
        """Parse GPT-4 JSON response into CoachReport."""
        # Strip markdown code blocks if present
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        data = json.loads(content)

        return CoachReport(
            strengths=data.get("strengths", []),
            weaknesses=data.get("weaknesses", []),
            best_setups=data.get("best_setups", []),
            worst_setups=data.get("worst_setups", []),
            best_conditions=data.get("best_conditions", []),
            common_mistakes=data.get("common_mistakes", []),
            recommendations=data.get("recommendations", []),
        )

    def _generate_fallback_report(
        self,
        metrics: PerformanceMetrics,
        behaviors: List[BehaviorDetection],
    ) -> CoachReport:
        """Generate a basic report without AI when GPT-4 is unavailable."""
        strengths = []
        weaknesses = []
        recommendations = []

        # Analyze metrics for strengths/weaknesses
        if metrics.win_rate > 60:
            strengths.append(f"Strong win rate of {metrics.win_rate:.1f}%")
        elif metrics.win_rate < 40:
            weaknesses.append(f"Low win rate of {metrics.win_rate:.1f}% needs improvement")

        if metrics.profit_factor > 2.0:
            strengths.append(f"Excellent profit factor of {metrics.profit_factor:.2f}")
        elif metrics.profit_factor < 1.0:
            weaknesses.append(f"Negative expectancy with profit factor {metrics.profit_factor:.2f}")

        if metrics.average_r > 1.5:
            strengths.append(f"Good risk management with average R of {metrics.average_r:.2f}")
        elif metrics.average_r < 0.5:
            weaknesses.append(f"Poor risk/reward with average R of {metrics.average_r:.2f}")

        # Add behavior-based insights
        common_mistakes = []
        for b in behaviors:
            common_mistakes.append(f"{b.pattern.value}: {b.description}")
            if b.pattern.value == "overtrading":
                recommendations.append("Reduce trade frequency - focus on quality over quantity")
            elif b.pattern.value == "revenge_trading":
                recommendations.append("Implement a mandatory cooling-off period after losses")
            elif b.pattern.value == "poor_risk_reward":
                recommendations.append("Only take trades with R:R >= 1.5")

        if not recommendations:
            recommendations.append("Continue monitoring your trading patterns")

        return CoachReport(
            strengths=strengths or ["Consistent trading activity"],
            weaknesses=weaknesses,
            best_setups=["AI analysis unavailable - review grouped metrics manually"],
            worst_setups=["AI analysis unavailable - review grouped metrics manually"],
            best_conditions=["AI analysis unavailable - review market regime breakdown"],
            common_mistakes=common_mistakes,
            recommendations=recommendations,
        )
