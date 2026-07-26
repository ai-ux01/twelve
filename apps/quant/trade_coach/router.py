"""
Trade Coach FastAPI Router.

Provides endpoints for AI coaching analysis, behavior detection,
and source comparison.

Phase 15 - AI Trade Coach
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from trade_analysis.repository import TradeRepository

from .behavior_detector import BehaviorDetector
from .models import (
    BehaviorDetectionResponse,
    BehaviorsResponse,
    CoachRequest,
    CoachReportResponse,
    CoachResponse,
    SourceComparisonResponse,
    SourceMetricsResponse,
)
from .report_generator import ReportGenerator
from .source_comparator import SourceComparator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trade-coach", tags=["trade-coach"])

# Module-level instances (shared with trade_analysis)
_repository: Optional[TradeRepository] = None
_behavior_detector = BehaviorDetector()
_report_generator = ReportGenerator()
_source_comparator = SourceComparator()


def get_repository() -> TradeRepository:
    """Get the shared TradeRepository instance."""
    global _repository
    if _repository is None:
        # Import from trade_analysis to share the same repository
        try:
            from trade_analysis.router import _repository as ta_repository
            _repository = ta_repository
        except ImportError:
            _repository = TradeRepository()
    return _repository


def set_repository(repo: TradeRepository) -> None:
    """Set the repository (useful for testing)."""
    global _repository
    _repository = repo


@router.post("/analyze", response_model=CoachResponse)
async def analyze_trading(request: CoachRequest):
    """
    Generate a full AI coaching report from actual trade data.

    Analyzes stored trades, detects behavioral patterns, and generates
    a structured coaching report using GPT-4.

    All conclusions reference real numbers from stored trades.

    Args:
        request: CoachRequest with user_id and optional filters.

    Returns:
        CoachResponse with report, behaviors, and metadata.
    """
    repo = get_repository()
    trades = repo.get_trades(request.user_id)

    if not trades:
        return CoachResponse(
            success=True,
            report=CoachReportResponse(
                strengths=["No trade data found for analysis"],
                recommendations=[
                    "Import your trades via CSV upload or manual entry to receive coaching"
                ],
            ),
            behaviors=[],
            total_trades_analyzed=0,
            data_source="no_data",
        )

    # Apply time range filter if specified
    if request.time_range_days is not None:
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(days=request.time_range_days)
        trades = [t for t in trades if t.entry_date >= cutoff]

    if not trades:
        return CoachResponse(
            success=True,
            report=CoachReportResponse(
                strengths=["No trades found in the specified time range"],
                recommendations=["Expand your time range or import more trades"],
            ),
            behaviors=[],
            total_trades_analyzed=0,
            data_source="stored_trade_statistics",
        )

    # Detect behaviors
    behaviors = _behavior_detector.detect_all(trades)

    # Generate AI report
    report = await _report_generator.generate_report(trades, behaviors)

    # Convert to response models
    behavior_responses = [
        BehaviorDetectionResponse(
            pattern=b.pattern.value,
            severity=b.severity.value,
            count=b.count,
            description=b.description,
            trade_ids=b.trade_ids,
            details=b.details,
        )
        for b in behaviors
    ]

    report_response = CoachReportResponse(
        strengths=report.strengths,
        weaknesses=report.weaknesses,
        best_setups=report.best_setups,
        worst_setups=report.worst_setups,
        best_conditions=report.best_conditions,
        common_mistakes=report.common_mistakes,
        recommendations=report.recommendations,
    )

    return CoachResponse(
        success=True,
        report=report_response,
        behaviors=behavior_responses,
        total_trades_analyzed=len(trades),
        data_source="stored_trade_statistics",
        generated_at=report.generated_at.isoformat(),
    )


@router.get("/behaviors", response_model=BehaviorsResponse)
async def get_behaviors(
    user_id: str = Query(default="default", description="User ID to analyze"),
):
    """
    List detected behavior patterns for a user.

    Analyzes stored trades and returns all detected negative behavior patterns
    with counts and severity levels.

    Args:
        user_id: User whose trades to analyze.

    Returns:
        BehaviorsResponse with list of detected behaviors.
    """
    repo = get_repository()
    trades = repo.get_trades(user_id)

    if not trades:
        return BehaviorsResponse(
            success=True,
            total_patterns_detected=0,
            behaviors=[],
        )

    behaviors = _behavior_detector.detect_all(trades)

    behavior_responses = [
        BehaviorDetectionResponse(
            pattern=b.pattern.value,
            severity=b.severity.value,
            count=b.count,
            description=b.description,
            trade_ids=b.trade_ids,
            details=b.details,
        )
        for b in behaviors
    ]

    return BehaviorsResponse(
        success=True,
        total_patterns_detected=len(behaviors),
        behaviors=behavior_responses,
    )


@router.get("/compare", response_model=SourceComparisonResponse)
async def compare_sources(
    user_id: str = Query(default="default", description="User ID to analyze"),
):
    """
    Compare performance across Paper, Live, and Backtest trade sources.

    Classifies trades by source and provides side-by-side metrics comparison
    with generated insights.

    Args:
        user_id: User whose trades to compare.

    Returns:
        SourceComparisonResponse with per-source metrics and insights.
    """
    repo = get_repository()
    trades = repo.get_trades(user_id)

    if not trades:
        return SourceComparisonResponse(
            success=True,
            insights=["No trades available for comparison"],
        )

    comparison = _source_comparator.compare_sources(trades)

    paper_response = None
    if comparison.paper:
        paper_response = SourceMetricsResponse(
            source=comparison.paper.source,
            total_trades=comparison.paper.total_trades,
            win_rate=comparison.paper.win_rate,
            profit_factor=comparison.paper.profit_factor,
            expectancy=comparison.paper.expectancy,
            average_r=comparison.paper.average_r,
            total_pnl=comparison.paper.total_pnl,
            max_drawdown=comparison.paper.max_drawdown,
        )

    live_response = None
    if comparison.live:
        live_response = SourceMetricsResponse(
            source=comparison.live.source,
            total_trades=comparison.live.total_trades,
            win_rate=comparison.live.win_rate,
            profit_factor=comparison.live.profit_factor,
            expectancy=comparison.live.expectancy,
            average_r=comparison.live.average_r,
            total_pnl=comparison.live.total_pnl,
            max_drawdown=comparison.live.max_drawdown,
        )

    backtest_response = None
    if comparison.backtest:
        backtest_response = SourceMetricsResponse(
            source=comparison.backtest.source,
            total_trades=comparison.backtest.total_trades,
            win_rate=comparison.backtest.win_rate,
            profit_factor=comparison.backtest.profit_factor,
            expectancy=comparison.backtest.expectancy,
            average_r=comparison.backtest.average_r,
            total_pnl=comparison.backtest.total_pnl,
            max_drawdown=comparison.backtest.max_drawdown,
        )

    return SourceComparisonResponse(
        success=True,
        paper=paper_response,
        live=live_response,
        backtest=backtest_response,
        insights=comparison.insights,
    )
