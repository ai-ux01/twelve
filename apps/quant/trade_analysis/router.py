"""
Trade Analysis Engine FastAPI Router.

Exposes all API endpoints for trade import, metrics, grouping, and AI analysis.

Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 3.1, 3.2
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from .ai_analyzer import AIAnalyzer
from .csv_importer import CSVImporter
from .exceptions import CSVParseError, GroupingDimensionError
from .grouping_engine import GroupingEngine
from .models import (
    AIAnalyzeRequest,
    AIAnalysisResponse,
    CSVImportResponse,
    CSVRowErrorResponse,
    ErrorResponse,
    FieldError,
    GroupedMetricsItem,
    GroupedMetricsResponse,
    ManualTradeRequest,
    MetricsResponse,
    PerformanceMetricsResponse,
    TradeDirection,
    TradeRecord,
    TradeRecordResponse,
    UnmatchedEntryResponse,
)
from .performance_calculator import TradePerformanceCalculator
from .repository import TradeRepository
from .trade_enricher import TradeEnricher

logger = logging.getLogger(__name__)

# Module-level singleton instances
_repository = TradeRepository()
_csv_importer = CSVImporter()
_enricher = TradeEnricher()
_calculator = TradePerformanceCalculator()
_grouping_engine = GroupingEngine()
_ai_analyzer = AIAnalyzer(
    repository=_repository,
    performance_calculator=_calculator,
    grouping_engine=_grouping_engine,
)

router = APIRouter(prefix="/api/trade-analysis", tags=["trade-analysis"])


def _trade_to_response(trade: TradeRecord) -> TradeRecordResponse:
    """Convert a TradeRecord to API response."""
    return TradeRecordResponse(
        id=trade.id,
        symbol=trade.symbol,
        direction=trade.direction,
        entry_date=trade.entry_date,
        exit_date=trade.exit_date,
        entry_price=trade.entry_price,
        exit_price=trade.exit_price,
        quantity=trade.quantity,
        realized_pnl=trade.realized_pnl,
        holding_period_days=trade.holding_period_days,
        strategy=trade.strategy,
        setup=trade.setup,
        sector=trade.sector,
        stop_loss=trade.stop_loss,
        mfe=trade.mfe,
        mae=trade.mae,
        rsi_at_entry=trade.rsi_at_entry,
        adx_at_entry=trade.adx_at_entry,
        volume_ratio=trade.volume_ratio,
        market_regime=trade.market_regime.value if trade.market_regime else None,
        risk_reward_ratio=trade.risk_reward_ratio,
    )


@router.post("/import/csv", response_model=CSVImportResponse)
async def import_csv(
    file: UploadFile = File(...),
    user_id: str = Query(default="default", description="User ID"),
) -> CSVImportResponse:
    """
    Import trades from a CSV file.

    Parses the CSV, matches BUY/SELL pairs, and persists trade records.

    Requirements: 9.1
    """
    try:
        content = await file.read()
        file_content = content.decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    try:
        # Parse CSV
        parse_result = _csv_importer.parse_csv(file_content)
    except CSVParseError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Match trades
    match_result = _csv_importer.match_trades(parse_result.trade_actions, user_id=user_id)

    # Persist matched trades
    if match_result.matched_trades:
        _repository.persist_trades(user_id, match_result.matched_trades)

    # Build response
    trades_response = [_trade_to_response(t) for t in match_result.matched_trades]
    errors_response = [
        CSVRowErrorResponse(
            row_number=e.row_number,
            field_name=e.field_name,
            message=e.message,
        )
        for e in parse_result.errors
    ]
    unmatched_response = [
        UnmatchedEntryResponse(
            row_number=u.row_number,
            symbol=u.symbol,
            action=u.action,
            date=u.date,
            price=u.price,
            quantity=u.quantity,
            reason=u.reason,
        )
        for u in match_result.unmatched_entries
    ]

    return CSVImportResponse(
        success=True,
        trades_imported=len(match_result.matched_trades),
        trades=trades_response,
        errors=errors_response,
        unmatched=unmatched_response,
    )


@router.post("/trades", response_model=TradeRecordResponse)
async def create_trade(
    trade_request: ManualTradeRequest,
    user_id: str = Query(default="default", description="User ID"),
) -> TradeRecordResponse:
    """
    Manually enter a single trade.

    Requirements: 9.2
    """
    # Calculate P&L
    if trade_request.direction == TradeDirection.LONG:
        realized_pnl = (trade_request.exit_price - trade_request.entry_price) * trade_request.quantity
    else:
        realized_pnl = (trade_request.entry_price - trade_request.exit_price) * trade_request.quantity

    # Calculate holding period
    holding_period_days = (trade_request.exit_date - trade_request.entry_date).days

    # Create TradeRecord
    trade = TradeRecord(
        id=str(uuid4()),
        user_id=user_id,
        symbol=trade_request.symbol.upper(),
        direction=trade_request.direction,
        entry_date=trade_request.entry_date,
        exit_date=trade_request.exit_date,
        entry_price=trade_request.entry_price,
        exit_price=trade_request.exit_price,
        quantity=trade_request.quantity,
        realized_pnl=realized_pnl,
        holding_period_days=holding_period_days,
        strategy=trade_request.strategy,
        setup=trade_request.setup,
        sector=trade_request.sector,
        stop_loss=trade_request.stop_loss,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    # Calculate risk/reward if stop_loss provided
    if trade_request.stop_loss is not None:
        trade.risk_reward_ratio = _enricher.calculate_risk_reward_ratio(
            trade.entry_price, trade.exit_price, trade.stop_loss, trade.direction
        )

    # Persist
    _repository.persist_trades(user_id, [trade])

    return _trade_to_response(trade)


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    user_id: str = Query(default="default", description="User ID"),
) -> MetricsResponse:
    """
    Get aggregate performance metrics for the user's trades.

    Requirements: 9.3
    """
    trades = _repository.get_trades(user_id)
    metrics = _calculator.calculate_metrics(trades)

    pf = metrics.profit_factor if metrics.profit_factor != float("inf") else 9999.99

    return MetricsResponse(
        success=True,
        metrics=PerformanceMetricsResponse(
            total_trades=metrics.total_trades,
            winning_trades=metrics.winning_trades,
            losing_trades=metrics.losing_trades,
            win_rate=metrics.win_rate,
            profit_factor=pf,
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
        ),
    )


@router.get("/metrics/grouped", response_model=GroupedMetricsResponse)
async def get_grouped_metrics(
    dimension: str = Query(..., description="Grouping dimension"),
    user_id: str = Query(default="default", description="User ID"),
) -> GroupedMetricsResponse:
    """
    Get performance metrics grouped by a specific dimension.

    Requirements: 9.4
    """
    try:
        trades = _repository.get_trades(user_id)
        groups = _grouping_engine.group_and_calculate(trades, dimension)
    except GroupingDimensionError as e:
        raise HTTPException(
            status_code=422,
            detail=ErrorResponse(
                detail=e.message,
                errors=[FieldError(field="dimension", message=e.message)],
            ).model_dump(),
        )

    groups_response = [
        GroupedMetricsItem(
            dimension_value=g.dimension_value,
            trade_count=g.trade_count,
            win_rate=g.win_rate,
            profit_factor=g.profit_factor if g.profit_factor != float("inf") else 9999.99,
            expectancy=g.expectancy,
            total_pnl=g.total_pnl,
            average_r=g.average_r,
        )
        for g in groups
    ]

    return GroupedMetricsResponse(
        success=True,
        dimension=dimension,
        groups=groups_response,
    )


@router.post("/ai/analyze", response_model=AIAnalysisResponse)
async def ai_analyze(
    request: AIAnalyzeRequest,
    user_id: str = Query(default="default", description="User ID"),
) -> AIAnalysisResponse:
    """
    Run AI-powered analysis on the user's trade history.

    Requirements: 9.5
    """
    try:
        result = await _ai_analyzer.analyze(request.prompt, user_id)
        return result
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        return AIAnalysisResponse(
            success=False,
            analysis=f"AI analysis encountered an error: {str(e)}. Please try again later.",
            metrics_used=None,
            data_source="error",
        )


@router.get("/broker/kotak-neo")
async def kotak_neo_status():
    """
    Kotak Neo broker integration placeholder.

    Returns a "coming soon" message and suggests CSV import as alternative.

    Requirements: 3.1, 3.2
    """
    return {
        "success": True,
        "status": "coming_soon",
        "message": (
            "Kotak Neo broker integration is coming soon. "
            "In the meantime, you can import your trades via CSV upload "
            "at POST /api/trade-analysis/import/csv or enter trades manually "
            "at POST /api/trade-analysis/trades."
        ),
        "alternatives": [
            {
                "method": "CSV Import",
                "endpoint": "POST /api/trade-analysis/import/csv",
                "description": "Upload your brokerage CSV export file",
            },
            {
                "method": "Manual Entry",
                "endpoint": "POST /api/trade-analysis/trades",
                "description": "Enter trades one at a time",
            },
        ],
    }
