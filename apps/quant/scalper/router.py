"""
FastAPI Router for the Options Scalping Agent.

Provides REST API endpoints for:
- POST /api/options-scalper/analyze - Run analysis workflow
- GET /api/options-scalper/history - Retrieve paginated analysis history
- GET /api/options-scalper/config - Get current configuration
- PUT /api/options-scalper/config - Update configuration

Requirements: 19.1-19.11, 20.3-20.13, 23.1, 23.6, 30.1-30.12
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from scalper.models import (
    ScalperAnalysisResult,
    ScalperConfiguration,
    ScalperSignalType,
    TrendClassification,
    OIInterpretation,
    TrendlineStatus,
)

logger = logging.getLogger(__name__)

# Module-level Signal Forwarder instance for auto paper trade forwarding
# Lazy-initialized to avoid circular imports (scalper -> signal_forwarder -> scalper.models -> scalper)
_signal_forwarder = None


def _get_signal_forwarder():
    """Lazily initialize the SignalForwarder to avoid circular imports."""
    global _signal_forwarder
    if _signal_forwarder is None:
        from signal_forwarder.forwarder import SignalForwarder
        _signal_forwarder = SignalForwarder()
    return _signal_forwarder


router = APIRouter(prefix="/api/options-scalper", tags=["options-scalper"])


# ============================================================
# Request / Response Models
# ============================================================


class AnalyzeRequest(BaseModel):
    """Request body for POST /analyze endpoint."""

    underlying: str = Field(..., description="Underlying symbol: NIFTY or BANKNIFTY")

    @field_validator("underlying")
    @classmethod
    def validate_underlying(cls, v: str) -> str:
        if v not in ("NIFTY", "BANKNIFTY"):
            raise ValueError("underlying must be 'NIFTY' or 'BANKNIFTY'")
        return v


class AnalyzeResponse(BaseModel):
    """Response for POST /analyze endpoint - wraps ScalperAnalysisResult."""

    success: bool = True
    data: ScalperAnalysisResult


class HistoryRecord(BaseModel):
    """Single record in analysis history response."""

    id: int
    timestamp: datetime
    underlying: str
    signal_type: str
    probability: float
    risk_reward_ratio: float
    strike_price: Optional[float] = None
    expiry_date: Optional[date] = None
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    spot_price: float
    trend: str
    hold_reason: Optional[str] = None


class HistoryResponse(BaseModel):
    """Response for GET /history endpoint."""

    success: bool = True
    data: List[HistoryRecord]
    page: int
    page_size: int
    total_records: int


class ConfigUpdateRequest(BaseModel):
    """Request body for PUT /config endpoint."""

    refresh_interval: Optional[int] = Field(
        None, description="Refresh interval in seconds (30-300)"
    )
    probability_threshold: Optional[float] = Field(
        None, description="Probability threshold percentage (50-90)"
    )
    risk_reward_threshold: Optional[float] = Field(
        None, description="Risk/reward ratio threshold (1.0-5.0)"
    )
    max_spread_percentage: Optional[float] = Field(
        None, description="Max spread percentage (1-10)"
    )
    min_open_interest: Optional[int] = Field(
        None, description="Minimum open interest (100-10000)"
    )

    @field_validator("refresh_interval")
    @classmethod
    def validate_refresh_interval(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            if not isinstance(v, int):
                raise ValueError("refresh_interval must be an integer")
            if v < 30 or v > 300:
                raise ValueError("refresh_interval must be between 30 and 300")
        return v

    @field_validator("probability_threshold")
    @classmethod
    def validate_probability_threshold(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if not isinstance(v, (int, float)):
                raise ValueError("probability_threshold must be a number")
            if v < 50 or v > 90:
                raise ValueError("probability_threshold must be between 50 and 90")
        return v

    @field_validator("risk_reward_threshold")
    @classmethod
    def validate_risk_reward_threshold(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if not isinstance(v, (int, float)):
                raise ValueError("risk_reward_threshold must be a number")
            if v < 1.0 or v > 5.0:
                raise ValueError("risk_reward_threshold must be between 1.0 and 5.0")
        return v

    @field_validator("max_spread_percentage")
    @classmethod
    def validate_max_spread_percentage(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if not isinstance(v, (int, float)):
                raise ValueError("max_spread_percentage must be a number")
            if v < 1 or v > 10:
                raise ValueError("max_spread_percentage must be between 1 and 10")
        return v

    @field_validator("min_open_interest")
    @classmethod
    def validate_min_open_interest(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            if not isinstance(v, int):
                raise ValueError("min_open_interest must be an integer")
            if v < 100 or v > 10000:
                raise ValueError("min_open_interest must be between 100 and 10000")
        return v


class ConfigResponse(BaseModel):
    """Response for GET/PUT /config endpoint."""

    success: bool = True
    data: ScalperConfiguration


class ErrorResponse(BaseModel):
    """Standard error response."""

    success: bool = False
    error: str
    detail: Optional[str] = None


# ============================================================
# In-Memory Storage (placeholder until DB is wired)
# ============================================================

# In-memory store for analysis history
_analysis_history: List[HistoryRecord] = []
_history_id_counter: int = 0

# In-memory store for user configuration (keyed by user_id)
_user_configs: dict[str, ScalperConfiguration] = {}

# Default user ID (will be replaced with actual auth later)
DEFAULT_USER_ID = "default_user"


def _get_default_config() -> ScalperConfiguration:
    """Return default configuration for a user."""
    return ScalperConfiguration(
        user_id=DEFAULT_USER_ID,
        refresh_interval=60,
        probability_threshold=70.0,
        risk_reward_threshold=2.0,
        max_spread_percentage=5.0,
        min_open_interest=1000,
    )


def _store_analysis_record(result: ScalperAnalysisResult) -> HistoryRecord:
    """Store an analysis result in the in-memory history."""
    global _history_id_counter
    _history_id_counter += 1

    record = HistoryRecord(
        id=_history_id_counter,
        timestamp=result.timestamp,
        underlying=result.underlying,
        signal_type=result.signal_type.value if isinstance(result.signal_type, ScalperSignalType) else result.signal_type,
        probability=result.probability,
        risk_reward_ratio=result.risk_reward_ratio,
        strike_price=result.strike_price,
        expiry_date=result.expiry_date,
        entry_price=result.entry_price,
        target_price=result.target_price,
        stop_loss=result.stop_loss,
        spot_price=result.spot_price,
        trend=result.trend.value if isinstance(result.trend, TrendClassification) else result.trend,
        hold_reason=result.hold_reason,
    )
    _analysis_history.append(record)
    return record


# ============================================================
# Endpoints
# ============================================================


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request parameters"},
        500: {"model": ErrorResponse, "description": "Analysis failure"},
        504: {"model": ErrorResponse, "description": "Analysis timeout"},
    },
)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Execute a complete analysis workflow for the specified underlying.

    Accepts JSON body with "underlying" parameter (NIFTY or BANKNIFTY).
    Orchestrates the full analysis pipeline: fetch market data, compute
    technical indicators, analyze options chain, run AI analysis, and
    generate a trading signal.

    Returns:
        200: AnalysisResult as JSON
        400: Invalid or missing underlying parameter
        500: Analysis failures with error details
        504: Timeout (>10 seconds)

    Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11, 23.1
    """
    start_time = time.time()

    try:
        # Execute analysis with a 10-second timeout
        result = await asyncio.wait_for(
            _execute_analysis(request.underlying),
            timeout=10.0,
        )

        elapsed = time.time() - start_time
        logger.info(
            f"Analysis completed for {request.underlying} in {elapsed:.2f}s"
        )

        # Store in history
        _store_analysis_record(result)

        # Fire-and-forget: forward signal to paper trading API
        try:
            asyncio.create_task(_get_signal_forwarder().forward_scalper_signal(result))
        except Exception as e:
            logger.warning(f"Failed to schedule signal forwarding: {e}")

        return AnalyzeResponse(success=True, data=result)

    except asyncio.TimeoutError:
        elapsed = time.time() - start_time
        logger.error(
            f"Analysis timeout for {request.underlying} after {elapsed:.2f}s"
        )
        raise HTTPException(
            status_code=504,
            detail=f"Analysis timed out after 10 seconds for {request.underlying}",
        )
    except HTTPException:
        raise
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            f"Analysis failed for {request.underlying} after {elapsed:.2f}s: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}",
        )


@router.get(
    "/history",
    response_model=HistoryResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid query parameters"},
    },
)
async def get_history(
    underlying: Optional[str] = Query(
        None, description="Filter by underlying (NIFTY or BANKNIFTY)"
    ),
    signal_type: Optional[str] = Query(
        None, description="Filter by signal type (BUY CE, BUY PE, HOLD)"
    ),
    date_from: Optional[str] = Query(
        None, description="Filter from date (YYYY-MM-DD)"
    ),
    date_to: Optional[str] = Query(
        None, description="Filter to date (YYYY-MM-DD)"
    ),
    page: int = Query(1, ge=1, description="Page number (starts at 1)"),
    page_size: int = Query(50, ge=1, le=100, description="Records per page (max 100)"),
) -> HistoryResponse:
    """
    Retrieve paginated analysis history with optional filters.

    Query Parameters:
        underlying: Filter by underlying (NIFTY or BANKNIFTY)
        signal_type: Filter by signal type (BUY CE, BUY PE, HOLD)
        date_from: Filter records from this date (inclusive, YYYY-MM-DD)
        date_to: Filter records to this date (inclusive, YYYY-MM-DD)
        page: Page number (default 1)
        page_size: Records per page (default 50, max 100)

    Returns:
        200: Paginated JSON array of analysis records
        400: Invalid query parameters

    Requirements: 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 20.13, 23.6
    """
    # Validate underlying filter
    if underlying is not None and underlying not in ("NIFTY", "BANKNIFTY"):
        raise HTTPException(
            status_code=400,
            detail="underlying must be 'NIFTY' or 'BANKNIFTY'",
        )

    # Validate signal_type filter
    valid_signal_types = ("BUY CE", "BUY PE", "HOLD")
    if signal_type is not None and signal_type not in valid_signal_types:
        raise HTTPException(
            status_code=400,
            detail=f"signal_type must be one of: {', '.join(valid_signal_types)}",
        )

    # Parse date filters
    parsed_date_from: Optional[datetime] = None
    parsed_date_to: Optional[datetime] = None

    if date_from is not None:
        try:
            parsed_date_from = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="date_from must be in YYYY-MM-DD format",
            )

    if date_to is not None:
        try:
            parsed_date_to = datetime.strptime(date_to, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="date_to must be in YYYY-MM-DD format",
            )

    # Filter records
    filtered = _analysis_history.copy()

    if underlying is not None:
        filtered = [r for r in filtered if r.underlying == underlying]

    if signal_type is not None:
        filtered = [r for r in filtered if r.signal_type == signal_type]

    if parsed_date_from is not None:
        filtered = [r for r in filtered if r.timestamp >= parsed_date_from]

    if parsed_date_to is not None:
        filtered = [r for r in filtered if r.timestamp <= parsed_date_to]

    # Sort by timestamp descending (most recent first)
    filtered.sort(key=lambda r: r.timestamp, reverse=True)

    # Paginate
    total_records = len(filtered)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_data = filtered[start_idx:end_idx]

    return HistoryResponse(
        success=True,
        data=page_data,
        page=page,
        page_size=page_size,
        total_records=total_records,
    )


@router.get(
    "/config",
    response_model=ConfigResponse,
)
async def get_config() -> ConfigResponse:
    """
    Get the current user's ScalperConfiguration.

    Returns the configuration for the current user. If no configuration
    exists, returns default values.

    Returns:
        200: Current ScalperConfiguration as JSON

    Requirements: 30.1, 30.11, 30.12
    """
    config = _user_configs.get(DEFAULT_USER_ID)
    if config is None:
        config = _get_default_config()
        _user_configs[DEFAULT_USER_ID] = config

    return ConfigResponse(success=True, data=config)


@router.put(
    "/config",
    response_model=ConfigResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid configuration values"},
    },
)
async def update_config(request: ConfigUpdateRequest) -> ConfigResponse:
    """
    Update the current user's ScalperConfiguration.

    Accepts JSON body with configuration fields to update. Only provided
    fields are updated; omitted fields retain their current values.

    Validates ranges:
        - refresh_interval: 30-300 seconds
        - probability_threshold: 50-90%
        - risk_reward_threshold: 1.0-5.0
        - max_spread_percentage: 1-10%
        - min_open_interest: 100-10000

    Returns:
        200: Updated ScalperConfiguration as JSON
        400: Values outside valid ranges or non-numeric values

    Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8, 30.9, 30.10, 30.11, 30.12
    """
    # Get current config or create default
    config = _user_configs.get(DEFAULT_USER_ID)
    if config is None:
        config = _get_default_config()

    # Apply updates (only non-None fields)
    update_data = request.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No valid configuration fields provided",
        )

    # Create updated config
    current_data = config.model_dump()
    current_data.update(update_data)

    try:
        updated_config = ScalperConfiguration(**current_data)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid configuration: {str(e)}",
        )

    # Store updated config
    _user_configs[DEFAULT_USER_ID] = updated_config

    logger.info(f"Configuration updated for user {DEFAULT_USER_ID}: {update_data}")

    return ConfigResponse(success=True, data=updated_config)


# ============================================================
# Analysis Workflow (async)
# ============================================================


async def _execute_analysis(underlying: str) -> ScalperAnalysisResult:
    """
    Execute the complete analysis workflow for the given underlying.

    This orchestrates: market data fetch → technical analysis →
    options analysis → AI analysis → signal generation.

    For now, this creates a mock/placeholder result. The full orchestrator
    (Task 8) will wire up the real components.

    Args:
        underlying: "NIFTY" or "BANKNIFTY"

    Returns:
        ScalperAnalysisResult with complete analysis data.
    """
    # Import components
    from scalper.market_data_fetcher import MarketDataFetcher, MarketDataFetchError
    from scalper.technical_analyzer import TechnicalAnalyzer, TechnicalAnalyzerError
    from scalper.options_analyzer import OptionsAnalyzer, OptionsAnalyzerError
    from scalper.ai_analysis_engine import AIAnalysisEngine, AIAnalysisEngineError
    from scalper.signal_generator import SignalGenerator

    try:
        # Step 1: Fetch market data
        fetcher = MarketDataFetcher()
        market_data = await fetcher.fetch_all(underlying)

    except (MarketDataFetchError, Exception) as data_err:
        # If market data fetch fails (e.g., no NIFTY/BANKNIFTY in local MongoDB),
        # return a HOLD result with available context
        logger.warning(f"Market data fetch failed for {underlying}: {data_err}. Returning HOLD signal.")
        return ScalperAnalysisResult(
            timestamp=datetime.utcnow(),
            underlying=underlying,
            signal_type=ScalperSignalType.HOLD,
            probability=0.0,
            risk_reward_ratio=0.0,
            strike_price=None,
            expiry_date=None,
            entry_price=None,
            target_price=None,
            stop_loss=None,
            lot_size=None,
            spot_price=22000.0 if underlying == "NIFTY" else 48000.0,
            trend=TrendClassification.NEUTRAL,
            oi_interpretation=OIInterpretation.NEUTRAL,
            pcr=1.0,
            trendline_status=TrendlineStatus.NEUTRAL,
            support_level=None,
            resistance_level=None,
            rsi=50.0,
            macd=0.0,
            macd_signal=0.0,
            vwap=22000.0 if underlying == "NIFTY" else 48000.0,
            ema_5=22000.0 if underlying == "NIFTY" else 48000.0,
            ema_15=22000.0 if underlying == "NIFTY" else 48000.0,
            atr=100.0 if underlying == "NIFTY" else 200.0,
            volume_ratio=1.0,
            call_oi=0,
            put_oi=0,
            call_oi_change=0,
            put_oi_change=0,
            atm_iv=None,
            rationale=f"Market data unavailable for {underlying}. No live options chain data from broker. Connect broker API for live options scalping.",
            hold_reason=f"No market data: {str(data_err)[:100]}",
        )

    try:

        # Step 2: Technical analysis
        analyzer = TechnicalAnalyzer()
        technical_result = analyzer.analyze_technical_indicators(
            market_data.ohlcv_data
        )
        support_resistance = analyzer.identify_support_resistance(
            market_data.ohlcv_data
        )
        trendline_status = analyzer.detect_trendlines(market_data.ohlcv_data)

        # Step 3: Options analysis
        options_analyzer = OptionsAnalyzer()
        options_result = options_analyzer.analyze_options_chain(
            market_data.options_chain
        )

        # Step 4: AI analysis
        ai_engine = AIAnalysisEngine()
        ai_result = ai_engine.analyze_market_data(
            data_package=market_data,
            technical_indicators=technical_result,
            options_analysis=options_result,
            support_resistance=support_resistance,
            trendline_status=trendline_status,
        )

        # Step 5: Signal generation
        signal_gen = SignalGenerator()
        signal = signal_gen.generate_signal(
            ai_result=ai_result,
            contracts=market_data.options_chain,
            market_data=market_data,
            technical_indicators=technical_result,
        )

        # Build final analysis result
        lot_size = 50 if underlying == "NIFTY" else 25

        result = ScalperAnalysisResult(
            timestamp=datetime.utcnow(),
            underlying=underlying,
            signal_type=signal.signal_type,
            probability=signal.probability,
            risk_reward_ratio=signal.risk_reward_ratio,
            strike_price=(
                signal.selected_contract.strike_price
                if signal.selected_contract
                else None
            ),
            expiry_date=(
                signal.selected_contract.expiry_date
                if signal.selected_contract
                else None
            ),
            entry_price=signal.entry_price,
            target_price=signal.target_price,
            stop_loss=signal.stop_loss,
            lot_size=lot_size if signal.signal_type != ScalperSignalType.HOLD else None,
            spot_price=market_data.spot_price,
            trend=TrendClassification(ai_result.trend) if ai_result.trend in ("Bullish", "Bearish", "Neutral") else TrendClassification.NEUTRAL,
            oi_interpretation=OIInterpretation(ai_result.oi_interpretation) if ai_result.oi_interpretation in ("Bullish", "Bearish", "Neutral") else OIInterpretation.NEUTRAL,
            pcr=options_result.pcr,
            trendline_status=TrendlineStatus(trendline_status) if trendline_status in ("Bullish", "Bearish", "Neutral") else TrendlineStatus.NEUTRAL,
            support_level=support_resistance.support_level,
            resistance_level=support_resistance.resistance_level,
            rsi=technical_result.rsi,
            macd=technical_result.macd,
            macd_signal=technical_result.macd_signal,
            vwap=technical_result.vwap,
            ema_5=technical_result.ema_5,
            ema_15=technical_result.ema_15,
            atr=technical_result.atr,
            volume_ratio=technical_result.volume_ratio,
            call_oi=options_result.call_oi,
            put_oi=options_result.put_oi,
            call_oi_change=options_result.call_oi_change,
            put_oi_change=options_result.put_oi_change,
            atm_iv=options_result.atm_call_iv,
            rationale=ai_result.rationale,
            hold_reason=signal.hold_reason,
        )

        return result

    except (MarketDataFetchError, TechnicalAnalyzerError, OptionsAnalyzerError) as e:
        raise Exception(f"Data processing error: {str(e)}")
    except AIAnalysisEngineError as e:
        raise Exception(f"AI analysis error: {str(e)}")
    except Exception as e:
        raise Exception(f"Unexpected error during analysis: {str(e)}")
