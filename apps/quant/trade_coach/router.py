"""
Trade Coach FastAPI Router.

Provides endpoints for AI coaching analysis, behavior detection,
and source comparison. Supports paper, live, and combined data sources.

Phase 15 - AI Trade Coach
Portfolio Trade Coaching Extension
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from trade_analysis.repository import TradeRepository

from .behavior_detector import BehaviorDetector
from .data_source_selector import DataSourceSelector
from .live_analysis import LiveAnalyzer
from .models import (
    BehaviorDetectionResponse,
    BehaviorsResponse,
    CoachRequest,
    CoachReportResponse,
    CoachResponse,
    SourceComparisonResponse,
    SourceMetricsResponse,
)
from .portfolio_fetcher import PortfolioFetcher
from .report_generator import ReportGenerator
from .source_comparator import SourceComparator
from .trade_normalizer import TradeNormalizer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trade-coach", tags=["trade-coach"])

# Module-level instances (shared with trade_analysis)
_repository: Optional[TradeRepository] = None
_behavior_detector = BehaviorDetector()
_report_generator = ReportGenerator()
_source_comparator = SourceComparator()
_portfolio_fetcher = PortfolioFetcher()
_trade_normalizer = TradeNormalizer()
_live_analyzer = LiveAnalyzer()
_data_source_selector: Optional[DataSourceSelector] = None


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


def get_data_source_selector() -> DataSourceSelector:
    """Get or create the DataSourceSelector instance."""
    global _data_source_selector
    if _data_source_selector is None:
        _data_source_selector = DataSourceSelector(
            repository=get_repository(),
            fetcher=_portfolio_fetcher,
            normalizer=_trade_normalizer,
        )
    return _data_source_selector


def set_data_source_selector(selector: DataSourceSelector) -> None:
    """Set the DataSourceSelector (useful for testing)."""
    global _data_source_selector
    _data_source_selector = selector


def _validate_session_for_source(data_source: str, session_id: Optional[str]) -> None:
    """Validate that session_id is provided when data_source requires it.

    Args:
        data_source: The requested data source mode.
        session_id: The session ID provided.

    Raises:
        HTTPException: 400 if session_id is required but missing.
    """
    if data_source in ("live", "combined"):
        if not session_id or not session_id.strip():
            raise HTTPException(
                status_code=400,
                detail="session_id is required when data_source is 'live' or 'combined'",
            )


@router.post("/analyze", response_model=CoachResponse)
async def analyze_trading(request: CoachRequest):
    """
    Generate a full AI coaching report from trade data.

    Analyzes trades from the selected data source (paper, live, or combined),
    detects behavioral patterns, and generates a structured coaching report.

    All conclusions reference real numbers from stored/live trades.

    Args:
        request: CoachRequest with user_id, data_source, session_id, and optional filters.

    Returns:
        CoachResponse with report, behaviors, and metadata.
    """
    # Validate session_id requirement
    _validate_session_for_source(request.data_source, request.session_id)

    # Use DataSourceSelector to get trades
    selector = get_data_source_selector()
    result = await selector.get_trades(
        user_id=request.user_id,
        source=request.data_source,
        session_id=request.session_id,
    )

    trades = result.trades

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
            data_source=result.source,
            live_trade_count=0 if result.source in ("live", "combined") else None,
            paper_trade_count=0 if result.source in ("paper", "combined") else None,
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
            data_source=result.source,
            live_trade_count=0 if result.source in ("live", "combined") else None,
            paper_trade_count=0 if result.source in ("paper", "combined") else None,
        )

    # Count trades by source
    live_trade_count = sum(1 for t in trades if getattr(t, "id", "").startswith("live-"))
    paper_trade_count = len(trades) - live_trade_count

    # Detect behaviors
    behaviors = _behavior_detector.detect_all(trades)

    # Run live-specific analysis when applicable
    slippage_summary_dict = None
    if result.source in ("live", "combined") and live_trade_count > 0:
        live_trades = [t for t in trades if getattr(t, "id", "").startswith("live-")]
        paper_trades_only = [t for t in trades if not getattr(t, "id", "").startswith("live-")]

        live_result_analysis = _live_analyzer.analyze(
            live_trades=live_trades,
            paper_trades=paper_trades_only if result.source == "combined" else None,
            data_source=result.source,
        )

        # Include partial fill detection in behaviors
        if live_result_analysis.partial_fill_detection:
            behaviors.append(live_result_analysis.partial_fill_detection)

        # Include slippage summary
        if live_result_analysis.slippage_summary:
            slippage_summary_dict = live_result_analysis.slippage_summary.to_dict()

        # Add live-specific recommendations to report later
        live_recommendations = live_result_analysis.recommendations
        live_divergence_insights = live_result_analysis.divergence_insights
    else:
        live_recommendations = []
        live_divergence_insights = []

    # Generate AI report
    report = await _report_generator.generate_report(trades, behaviors)

    # Append live-specific recommendations
    if live_recommendations:
        report.recommendations.extend(live_recommendations)

    # Append divergence insights as recommendations
    if live_divergence_insights:
        report.recommendations.extend(live_divergence_insights)

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
        data_source=result.source,
        live_trade_count=live_trade_count if result.source in ("live", "combined") else None,
        paper_trade_count=paper_trade_count if result.source in ("paper", "combined") else None,
        slippage_summary=slippage_summary_dict,
        generated_at=report.generated_at.isoformat(),
    )


@router.get("/behaviors", response_model=BehaviorsResponse)
async def get_behaviors(
    user_id: str = Query(default="default", description="User ID to analyze"),
    data_source: str = Query(default="paper", description="Data source: paper, live, or combined"),
    session_id: Optional[str] = Query(default=None, description="Kotak Neo session ID"),
):
    """
    List detected behavior patterns for a user.

    Analyzes trades from the selected data source and returns all detected
    negative behavior patterns with counts and severity levels.

    Args:
        user_id: User whose trades to analyze.
        data_source: Data source mode (paper, live, combined).
        session_id: Kotak Neo session ID (required for live/combined).

    Returns:
        BehaviorsResponse with list of detected behaviors.
    """
    # Validate session_id requirement
    _validate_session_for_source(data_source, session_id)

    # Use DataSourceSelector to get trades
    selector = get_data_source_selector()
    result = await selector.get_trades(
        user_id=user_id,
        source=data_source,
        session_id=session_id,
    )

    trades = result.trades

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
    session_id: Optional[str] = Query(default=None, description="Kotak Neo session ID for live metrics"),
):
    """
    Compare performance across Paper, Live, and Backtest trade sources.

    Classifies trades by source and provides side-by-side metrics comparison
    with generated insights. When a valid session_id is provided, live portfolio
    metrics are included as an additional source.

    Args:
        user_id: User whose trades to compare.
        session_id: Optional Kotak Neo session ID. If provided, live portfolio
                    metrics are fetched and included in the comparison.

    Returns:
        SourceComparisonResponse with per-source metrics and insights.
    """
    repo = get_repository()
    trades = repo.get_trades(user_id)

    # If session_id is provided, fetch live trades and include them
    live_trades = []
    if session_id and session_id.strip():
        selector = get_data_source_selector()
        live_result = await selector.get_trades(
            user_id=user_id,
            source="live",
            session_id=session_id,
        )
        live_trades = live_result.trades

    # Combine paper + live for comparison
    all_trades = trades + live_trades

    if not all_trades:
        return SourceComparisonResponse(
            success=True,
            insights=["No trades available for comparison"],
        )

    comparison = _source_comparator.compare_sources(all_trades)

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
