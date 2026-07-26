"""
Trade Analysis Engine AI Analyzer.

Provides AI-driven trade analysis using OpenAI GPT-4, grounded in
actual stored trade statistics.

Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Dict, List, Optional

from .exceptions import AIAnalysisError
from .models import (
    AIAnalysisResponse,
    GroupedMetrics,
    PerformanceMetrics,
    PerformanceMetricsResponse,
    TradeRecord,
)
from .grouping_engine import GroupingEngine
from .performance_calculator import TradePerformanceCalculator
from .repository import TradeRepository

logger = logging.getLogger(__name__)


class AIAnalyzer:
    """
    AI-driven trade analysis using OpenAI GPT-4.

    Queries stored trade statistics, builds context with factual metrics,
    and generates insights grounded in actual data.

    Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
    """

    MAX_RETRIES: int = 2
    BASE_DELAY: float = 1.0
    BACKOFF_MULTIPLIER: float = 2.0
    LLM_MODEL: str = "gpt-4"

    SYSTEM_PROMPT: str = """You are an expert trading analyst. You analyze trading performance data and provide actionable insights.

RULES:
1. Only reference statistics and data that are explicitly provided in the context below.
2. Do NOT invent, hallucinate, or assume any trade statistics.
3. Identify the weakest-performing dimensions and provide specific improvement suggestions.
4. Reference specific numbers (win rate, profit factor, expectancy) when making points.
5. Be concise but thorough. Focus on patterns and actionable advice.
6. If certain data is missing or insufficient, say so explicitly.
"""

    def __init__(
        self,
        repository: TradeRepository,
        performance_calculator: Optional[TradePerformanceCalculator] = None,
        grouping_engine: Optional[GroupingEngine] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        """
        Initialize AI Analyzer.

        Args:
            repository: TradeRepository for fetching stored trades.
            performance_calculator: Optional calculator (created if not provided).
            grouping_engine: Optional grouping engine (created if not provided).
            api_key: OpenAI API key (reads OPENAI_API_KEY env if not provided).
            model: LLM model to use (defaults to GPT-4).
        """
        self._repository = repository
        self._calculator = performance_calculator or TradePerformanceCalculator()
        self._grouping_engine = grouping_engine or GroupingEngine()
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._model = model or os.environ.get("AI_MODEL", "") or self.LLM_MODEL
        self._client = None

    def _get_client(self):
        """Lazily initialize the OpenAI async client."""
        if self._client is None:
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(api_key=self._api_key)
            except ImportError:
                raise AIAnalysisError(
                    "openai package not installed. Install with: pip install openai"
                )
            except Exception as e:
                raise AIAnalysisError(f"Failed to initialize OpenAI client: {e}")
        return self._client

    async def analyze(self, prompt: str, user_id: str) -> AIAnalysisResponse:
        """
        Analyze trades for a user based on their prompt.

        1. Fetch stored trade statistics from repository
        2. Compute aggregate + grouped metrics
        3. Build context with factual data
        4. Generate AI response grounded in actual statistics

        Args:
            prompt: User's analysis question.
            user_id: User whose trades to analyze.

        Returns:
            AIAnalysisResponse with analysis text and metrics used.
        """
        # Fetch trades from repository
        trades = self._repository.get_trades(user_id)

        # No data case
        if not trades:
            return AIAnalysisResponse(
                success=True,
                analysis=(
                    "No trade data found for analysis. Please import your trades "
                    "via CSV upload or manual entry first, then ask me to analyze "
                    "your trading patterns."
                ),
                metrics_used=None,
                data_source="no_data",
            )

        # Compute metrics
        metrics = self._calculator.calculate_metrics(trades)

        # Compute grouped breakdowns
        grouped: Dict[str, List[GroupedMetrics]] = {}
        for dimension in ["strategy", "market_regime", "time_of_day", "setup"]:
            try:
                grouped[dimension] = self._grouping_engine.group_and_calculate(
                    trades, dimension
                )
            except Exception:
                pass  # Skip dimensions that fail

        # Build context
        context = self._build_analysis_context(metrics, grouped)

        # Generate AI response
        try:
            analysis_text = await self._generate_response(prompt, context)
        except AIAnalysisError:
            # Graceful fallback
            analysis_text = (
                "AI analysis is temporarily unavailable. Here are your raw metrics:\n\n"
                f"• Win Rate: {metrics.win_rate:.1f}%\n"
                f"• Profit Factor: {metrics.profit_factor:.2f}\n"
                f"• Expectancy: ₹{metrics.expectancy:.2f}\n"
                f"• Max Drawdown: ₹{metrics.max_drawdown:.2f}\n"
                f"• Average R: {metrics.average_r:.2f}\n"
                f"• Total Trades: {metrics.total_trades}\n\n"
                "Please try again later for AI-powered insights."
            )

        # Build response
        metrics_response = PerformanceMetricsResponse(
            total_trades=metrics.total_trades,
            winning_trades=metrics.winning_trades,
            losing_trades=metrics.losing_trades,
            win_rate=metrics.win_rate,
            profit_factor=metrics.profit_factor if not (metrics.profit_factor == float("inf")) else 9999.99,
            total_pnl=metrics.total_pnl,
            expectancy=metrics.expectancy,
            max_drawdown=metrics.max_drawdown,
            average_r=metrics.average_r,
            mfe_mean=metrics.mfe_mean,
            mfe_median=metrics.mfe_median,
            mfe_max=metrics.mfe_max,
            mae_mean=metrics.mae_mean,
            mae_median=metrics.mae_median,
            mae_max=metrics.mae_max,
        )

        return AIAnalysisResponse(
            success=True,
            analysis=analysis_text,
            metrics_used=metrics_response,
            data_source="stored_trade_statistics",
        )

    def _build_analysis_context(
        self,
        metrics: PerformanceMetrics,
        grouped: Dict[str, List[GroupedMetrics]],
    ) -> str:
        """Build context string with factual trade statistics for AI prompt."""
        lines = [
            "=== TRADE PERFORMANCE DATA ===",
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
                f"  MFE Median: ₹{metrics.mfe_median:.2f}",
                f"  MAE Mean: ₹{metrics.mae_mean:.2f}",
                f"  MAE Median: ₹{metrics.mae_median:.2f}",
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

        return "\n".join(lines)

    async def _generate_response(self, prompt: str, context: str) -> str:
        """Call OpenAI API to generate analysis."""
        last_error = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                client = self._get_client()
                response = await client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": f"{context}\n\n---\n\nUser question: {prompt}"},
                    ],
                    temperature=0.3,
                    max_tokens=1500,
                )

                content = response.choices[0].message.content
                if not content:
                    raise AIAnalysisError("Empty response from AI model")

                return content

            except AIAnalysisError:
                raise
            except Exception as e:
                last_error = e
                logger.warning(f"AI analysis attempt {attempt + 1} failed: {e}")
                if attempt < self.MAX_RETRIES:
                    delay = self.BASE_DELAY * (self.BACKOFF_MULTIPLIER ** attempt)
                    await asyncio.sleep(delay)

        raise AIAnalysisError(
            f"AI analysis failed after {self.MAX_RETRIES + 1} attempts: {last_error}"
        )
