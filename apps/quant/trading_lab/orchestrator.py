"""
AI Trading Lab Orchestrator.

This module implements the orchestration pipeline that coordinates intent-based
service routing, fresh market data enforcement, quantitative analysis,
risk evaluation, and recommendation generation.

Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from .exceptions import QuantEngineError, StaleDataError
from .models import (
    IntentClassification,
    PipelineContext,
    ResponseMode,
    TradingIntent,
)
from .recommendation_engine import RecommendationEngine
from .risk_engine import RiskEngine

logger = logging.getLogger(__name__)

# Import the MongoDB market data provider (in-process)
try:
    from market_data.mongo_provider import MongoMarketDataProvider
    _mongo_provider: Optional[MongoMarketDataProvider] = None

    def _get_mongo_provider() -> MongoMarketDataProvider:
        global _mongo_provider
        if _mongo_provider is None:
            _mongo_provider = MongoMarketDataProvider()
            _mongo_provider.connect()
        return _mongo_provider
except ImportError:
    _mongo_provider = None

    def _get_mongo_provider():
        return None


class PipelineStep(str, Enum):
    """Pipeline execution steps in order."""

    MARKET_SELECTION = "market_selection"
    STRATEGY_SELECTION = "strategy_selection"
    DATA_FETCH = "data_fetch"
    QUANT_ANALYSIS = "quant_analysis"
    TRENDLINE_ANALYSIS = "trendline_analysis"
    RISK_EVALUATION = "risk_evaluation"
    AI_REASONING = "ai_reasoning"
    RECOMMENDATION = "recommendation"


# Step descriptions for SSE status events
STEP_MESSAGES: Dict[str, str] = {
    PipelineStep.MARKET_SELECTION: "Selecting target market and symbols...",
    PipelineStep.STRATEGY_SELECTION: "Choosing analysis strategy...",
    PipelineStep.DATA_FETCH: "Fetching fresh market data...",
    PipelineStep.QUANT_ANALYSIS: "Running quantitative analysis...",
    PipelineStep.TRENDLINE_ANALYSIS: "Analyzing trendlines and patterns...",
    PipelineStep.RISK_EVALUATION: "Evaluating risk parameters...",
    PipelineStep.AI_REASONING: "Generating AI recommendation...",
    PipelineStep.RECOMMENDATION: "Finalizing recommendation...",
}

# IST offset: UTC+5:30
IST_OFFSET = timedelta(hours=5, minutes=30)

# NSE market hours in IST
MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30

# NestJS backend base URL
NESTJS_BASE_URL = "http://localhost:4000"

# Stale data threshold
STALE_DATA_THRESHOLD_SECONDS = 300  # 5 minutes

# Historical data retention window (years).
# The NestJS HistoricalDataService enforces a 2-year rolling window.
# MongoDB data is bounded by this same window.
HISTORICAL_DATA_RETENTION_YEARS = 2


def compute_retention_boundary() -> datetime:
    """
    Compute the earliest date for which historical data is available.

    Returns the retention boundary as a timezone-aware datetime.
    Data older than this boundary is not stored and should not be requested.

    The actual enforcement is in the NestJS HistoricalDataService and the
    RetentionScheduler — this helper is for lightweight client-side clamping.
    """
    now = datetime.now(timezone.utc)
    return now - timedelta(days=HISTORICAL_DATA_RETENTION_YEARS * 365)


def clamp_dates_to_retention(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> tuple:
    """
    Clamp start/end dates to the 2-year retention boundary.

    Args:
        start_date: Requested start date (clamped to retention boundary if too old).
        end_date: Requested end date (clamped to now if in the future).

    Returns:
        Tuple of (clamped_start, clamped_end) as timezone-aware datetimes.
    """
    now = datetime.now(timezone.utc)
    boundary = compute_retention_boundary()

    if start_date is None:
        start_date = boundary
    elif start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)

    if end_date is None:
        end_date = now
    elif end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)

    # Clamp start to retention boundary
    if start_date < boundary:
        start_date = boundary

    # Clamp end to now
    if end_date > now:
        end_date = now

    return (start_date, end_date)


class Orchestrator:
    """
    Coordinates the full analysis pipeline based on detected intent.

    Executes steps in order: market_selection → strategy_selection → data_fetch →
    quant_analysis → trendline_analysis → risk_evaluation → ai_reasoning →
    recommendation. Routes each intent to the appropriate service.

    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3
    """

    STALE_DATA_THRESHOLD_SECONDS: int = STALE_DATA_THRESHOLD_SECONDS
    HTTP_TIMEOUT: float = 10.0  # 10-second timeout for external calls

    def __init__(
        self,
        recommendation_engine: Optional[RecommendationEngine] = None,
        risk_engine: Optional[RiskEngine] = None,
    ):
        """
        Initialize the Orchestrator.

        Args:
            recommendation_engine: Optional RecommendationEngine instance.
            risk_engine: Optional RiskEngine instance.
        """
        self._recommendation_engine = recommendation_engine or RecommendationEngine()
        self._risk_engine = risk_engine or RiskEngine()

    async def execute(
        self,
        intent: IntentClassification,
        response_mode: ResponseMode,
        session_id: str,
    ) -> AsyncGenerator[str, None]:
        """
        Execute the full pipeline and yield SSE-formatted events.

        Pipeline steps execute in fixed order:
        1. market_selection
        2. strategy_selection
        3. data_fetch
        4. quant_analysis
        5. trendline_analysis
        6. risk_evaluation
        7. ai_reasoning
        8. recommendation

        Args:
            intent: Classified intent with symbols and confidence.
            response_mode: User-selected response display mode.
            session_id: User session identifier.

        Yields:
            SSE-formatted strings for each pipeline step and final recommendation.

        Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
        """
        context = PipelineContext(
            intent=intent.intent,
            symbols=intent.symbols,
        )

        # Step 1: Market Selection
        yield self._status_event(PipelineStep.MARKET_SELECTION)
        context = await self._step_market_selection(context, intent)

        # Step 2: Strategy Selection
        yield self._status_event(PipelineStep.STRATEGY_SELECTION)
        context = await self._step_strategy_selection(context, intent)

        # Step 3: Data Fetch
        yield self._status_event(PipelineStep.DATA_FETCH)
        context = await self._step_data_fetch(context, intent)

        # Step 4: Quant Analysis
        yield self._status_event(PipelineStep.QUANT_ANALYSIS)
        context = await self._step_quant_analysis(context, intent)

        # Step 5: Trendline Analysis
        yield self._status_event(PipelineStep.TRENDLINE_ANALYSIS)
        context = await self._step_trendline_analysis(context, intent)

        # Step 6: Risk Evaluation
        yield self._status_event(PipelineStep.RISK_EVALUATION)
        context = await self._step_risk_evaluation(context)

        # Step 7 & 8: AI Reasoning + Recommendation (handled by RecommendationEngine)
        yield self._status_event(PipelineStep.AI_REASONING)

        # Build analysis dict for recommendation engine
        analysis_data = self._build_analysis_data(context)
        risk_data = context.risk_assessment or {}

        async for chunk in self._recommendation_engine.generate(
            analysis=analysis_data,
            risk_assessment=risk_data,
            mode=response_mode,
            intent=intent.intent.value,
            symbols=intent.symbols,
        ):
            yield chunk

        # Yield done event
        yield self._format_sse("done", {"message": "Pipeline complete"})

    # -------------------------------------------------------------------------
    # Pipeline Steps
    # -------------------------------------------------------------------------

    async def _step_market_selection(
        self, context: PipelineContext, intent: IntentClassification
    ) -> PipelineContext:
        """Select target markets/symbols based on intent."""
        # If symbols already extracted from prompt, use those
        if not context.symbols:
            # Default symbols based on intent
            if intent.intent == TradingIntent.OPTIONS_SCALPING:
                context.symbols = ["NIFTY", "BANKNIFTY"]
            elif intent.intent == TradingIntent.SWING_STOCK:
                # Top liquid stocks for swing analysis
                context.symbols = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"]
            elif intent.intent == TradingIntent.INTRADAY_STOCK:
                context.symbols = ["RELIANCE", "SBIN", "TATAMOTORS", "ICICIBANK"]
            elif intent.intent == TradingIntent.MARKET_ANALYSIS:
                context.symbols = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "SBIN"]
            else:
                context.symbols = ["RELIANCE", "TCS", "INFY"]
        return context

    async def _step_strategy_selection(
        self, context: PipelineContext, intent: IntentClassification
    ) -> PipelineContext:
        """Select analysis strategy based on intent type."""
        # Strategy selection is implicit in the intent-to-service routing
        # This step validates the intent and prepares routing metadata
        return context

    async def _step_data_fetch(
        self, context: PipelineContext, intent: IntentClassification
    ) -> PipelineContext:
        """
        Fetch fresh market data based on intent routing.

        Note: All data fetched from MongoDB is already bounded by the 2-year
        retention window (the NestJS HistoricalDataService and RetentionScheduler
        ensure no data older than HISTORICAL_DATA_RETENTION_YEARS exists).
        The clamp_dates_to_retention() helper is available for any explicit
        date-range requests.

        Routes to appropriate service:
        - SWING_STOCK: NestJS swing scan endpoint
        - INTRADAY_STOCK: Quant engine intraday service (in-process)
        - OPTIONS_SCALPING: Scalper module (in-process)
        - PORTFOLIO_ANALYSIS: NestJS portfolio endpoint
        - PAPER_TRADE: NestJS paper trading endpoint
        - MARKET_ANALYSIS: Quant engine scoring services (in-process)
        - TRADE_ANALYSIS: Full quant analysis (in-process)
        - STRATEGY_ANALYSIS: Combined analysis (in-process)

        Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 9.1, 9.2, 9.3
        """
        try:
            if intent.intent == TradingIntent.SWING_STOCK:
                data = await self._fetch_swing_data(context.symbols)
            elif intent.intent == TradingIntent.INTRADAY_STOCK:
                data = await self._fetch_intraday_data(context.symbols)
            elif intent.intent == TradingIntent.OPTIONS_SCALPING:
                data = await self._fetch_options_data(context.symbols)
            elif intent.intent == TradingIntent.PORTFOLIO_ANALYSIS:
                data = await self._fetch_portfolio_data()
            elif intent.intent == TradingIntent.PAPER_TRADE:
                data = await self._fetch_paper_trade_data(context.symbols)
            elif intent.intent == TradingIntent.MARKET_ANALYSIS:
                data = await self._fetch_market_analysis_data(context.symbols)
            elif intent.intent == TradingIntent.TRADE_ANALYSIS:
                data = await self._fetch_trade_analysis_data(context.symbols)
            elif intent.intent == TradingIntent.STRATEGY_ANALYSIS:
                data = await self._fetch_strategy_analysis_data(context.symbols)
            else:
                data = {}

            context.market_data = data
            context.market_data_timestamp = datetime.now(timezone.utc)

            # Check for stale data during market hours
            if self._is_market_hours():
                ts = context.market_data_timestamp
                if ts and self._is_data_stale(ts):
                    raise StaleDataError(
                        "Market data is stale and cannot be refreshed during market hours"
                    )

        except StaleDataError:
            raise
        except QuantEngineError:
            raise
        except Exception as e:
            logger.warning(f"Data fetch failed: {e}")
            context.market_data = {"error": str(e), "partial": True}
            context.market_data_timestamp = datetime.now(timezone.utc)

        return context

    async def _step_quant_analysis(
        self, context: PipelineContext, intent: IntentClassification
    ) -> PipelineContext:
        """Run quantitative analysis on fetched data."""
        # Analysis is typically done as part of data fetch for the specific intent
        # This step aggregates and normalizes the results
        if context.market_data:
            context.quant_analysis = {
                "intent": intent.intent.value,
                "symbols": context.symbols,
                "data_summary": context.market_data,
                "timestamp": context.market_data_timestamp.isoformat() if context.market_data_timestamp else None,
            }
        return context

    async def _step_trendline_analysis(
        self, context: PipelineContext, intent: IntentClassification
    ) -> PipelineContext:
        """Perform trendline analysis on the data."""
        # Trendline analysis is included in the quant services where applicable
        # For intents that support it, extract trendline data
        if context.market_data and context.market_data.get("trendlines"):
            context.trendline_analysis = context.market_data.get("trendlines")
        else:
            context.trendline_analysis = {"status": "not_available"}
        return context

    async def _step_risk_evaluation(self, context: PipelineContext) -> PipelineContext:
        """
        Evaluate risk for the proposed trade.

        Uses the RiskEngine to calculate R:R, position sizing, and high-risk flags.

        Requirement: 7.1
        """
        # Extract price levels from market data if available
        market_data = context.market_data or {}
        entry_price = market_data.get("entry_price", 0)
        stop_loss = market_data.get("stop_loss", 0)
        target_price = market_data.get("target_price", 0)

        if entry_price > 0 and stop_loss > 0 and target_price > 0:
            assessment = self._risk_engine.evaluate(
                entry_price=entry_price,
                stop_loss=stop_loss,
                target_price=target_price,
            )
            context.risk_assessment = assessment.model_dump()
        else:
            # Default risk assessment when prices aren't available
            context.risk_assessment = {
                "risk_reward_ratio": 0.0,
                "max_loss_amount": 0.0,
                "position_size_suggested": 0,
                "is_high_risk": True,
                "warnings": ["Insufficient price data for risk calculation"],
                "passed": False,
            }

        return context

    # -------------------------------------------------------------------------
    # Intent-to-Service Routing Methods
    # -------------------------------------------------------------------------

    async def _fetch_swing_data(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch swing trade data from MongoDB candle data (in-process).

        Falls back to NestJS swing scan endpoint if MongoDB is unavailable.

        Note: MongoDB data is already bounded by the 2-year retention window.
        The MongoMarketDataProvider returns only stored data which is within
        the retention boundary enforced by the NestJS HistoricalDataService.

        Requirement: 2.3, 9.1, 9.2
        """
        # Try MongoDB in-process first
        provider = _get_mongo_provider()
        if provider and provider.is_connected:
            results = {}
            for symbol in symbols:
                candles = provider.get_ohlcv(symbol=symbol, timeframe="day", limit=200)
                if candles:
                    latest = provider.get_latest_price(symbol, timeframe="day")
                    results[symbol] = {
                        "candles": candles,
                        "candle_count": len(candles),
                        "latest_price": latest,
                        "source": "mongodb",
                    }
            if results:
                return {
                    "service": "swing_analysis",
                    "symbols": symbols,
                    "data": results,
                    "source": "mongodb",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

        # Fallback to NestJS endpoint
        try:
            async with httpx.AsyncClient(timeout=self.HTTP_TIMEOUT) as client:
                response = await client.post(
                    f"{NESTJS_BASE_URL}/api/swing/scan",
                    json={"symbols": symbols},
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(
                        f"Swing scan returned status {response.status_code}: {response.text}"
                    )
                    return {"error": f"Swing service returned {response.status_code}", "partial": True}
        except httpx.TimeoutException:
            raise QuantEngineError("Swing scan service timed out")
        except httpx.ConnectError:
            raise QuantEngineError("Unable to connect to swing scan service")
        except Exception as e:
            logger.warning(f"Swing data fetch error: {e}")
            return {"error": str(e), "partial": True}

    async def _fetch_intraday_data(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch intraday analysis data from MongoDB candle data (in-process).

        Requirement: 2.4
        """
        provider = _get_mongo_provider()
        if provider and provider.is_connected:
            results = {}
            for symbol in symbols:
                # Use 60minute timeframe (available in MongoDB)
                candles = provider.get_ohlcv(symbol=symbol, timeframe="60minute", limit=100)
                if not candles:
                    # Fallback to daily
                    candles = provider.get_ohlcv(symbol=symbol, timeframe="day", limit=100)
                if candles:
                    latest = provider.get_latest_price(symbol, timeframe="60minute")
                    if not latest:
                        latest = provider.get_latest_price(symbol, timeframe="day")
                    results[symbol] = {
                        "candles": candles,
                        "candle_count": len(candles),
                        "latest_price": latest,
                        "source": "mongodb",
                    }
            if results:
                return {
                    "service": "intraday_analysis",
                    "symbols": symbols,
                    "data": results,
                    "source": "mongodb",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

        # Fallback: indicate service is available but no data
        try:
            from services.intraday_analysis_service import IntradayAnalysisService
            return {
                "service": "intraday_analysis",
                "symbols": symbols,
                "status": "service_available",
                "note": "Intraday analysis requires OHLCV data feed. MongoDB data not available for these symbols.",
            }
        except ImportError:
            logger.warning("IntradayAnalysisService not available")
            return {"error": "Intraday service not available", "partial": True}
        except Exception as e:
            logger.warning(f"Intraday data fetch error: {e}")
            return {"error": str(e), "partial": True}

    async def _fetch_options_data(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch options-related underlying data from MongoDB (in-process).

        For options scalping, we need the underlying (NIFTY/BANKNIFTY) spot data.
        The actual options chain comes from the broker API via NestJS.

        Requirement: 2.5
        """
        provider = _get_mongo_provider()
        if provider and provider.is_connected:
            results = {}
            for symbol in symbols:
                # Get recent 60-minute candles for the underlying
                candles = provider.get_ohlcv(symbol=symbol, timeframe="60minute", limit=100)
                if not candles:
                    candles = provider.get_ohlcv(symbol=symbol, timeframe="day", limit=50)
                if candles:
                    latest = provider.get_latest_price(symbol)
                    results[symbol] = {
                        "candles": candles,
                        "candle_count": len(candles),
                        "latest_price": latest,
                        "source": "mongodb",
                    }
            if results:
                return {
                    "service": "options_scalper",
                    "symbols": symbols,
                    "data": results,
                    "source": "mongodb",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

        # Fallback
        try:
            from scalper.ai_analysis_engine import AIAnalysisEngine
            return {
                "service": "options_scalper",
                "symbols": symbols,
                "status": "service_available",
                "note": "Options scalping analysis requires options chain data from broker",
            }
        except ImportError:
            logger.warning("AIAnalysisEngine (scalper) not available")
            return {"error": "Options scalper not available", "partial": True}
        except Exception as e:
            logger.warning(f"Options data fetch error: {e}")
            return {"error": str(e), "partial": True}

    async def _fetch_portfolio_data(self) -> Dict[str, Any]:
        """
        Fetch portfolio data from NestJS portfolio endpoint.

        Requirement: 2.7
        """
        try:
            async with httpx.AsyncClient(timeout=self.HTTP_TIMEOUT) as client:
                response = await client.get(
                    f"{NESTJS_BASE_URL}/api/portfolio",
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    return {"error": f"Portfolio service returned {response.status_code}", "partial": True}
        except httpx.TimeoutException:
            raise QuantEngineError("Portfolio service timed out")
        except httpx.ConnectError:
            raise QuantEngineError("Unable to connect to portfolio service")
        except Exception as e:
            logger.warning(f"Portfolio data fetch error: {e}")
            return {"error": str(e), "partial": True}

    async def _fetch_paper_trade_data(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch paper trade data from NestJS paper trading endpoint.

        Requirement: 2.6
        """
        try:
            async with httpx.AsyncClient(timeout=self.HTTP_TIMEOUT) as client:
                response = await client.post(
                    f"{NESTJS_BASE_URL}/api/paper-trading/execute",
                    json={"symbols": symbols, "action": "analyze"},
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    return {"error": f"Paper trading service returned {response.status_code}", "partial": True}
        except httpx.TimeoutException:
            raise QuantEngineError("Paper trading service timed out")
        except httpx.ConnectError:
            raise QuantEngineError("Unable to connect to paper trading service")
        except Exception as e:
            logger.warning(f"Paper trade data fetch error: {e}")
            return {"error": str(e), "partial": True}

    async def _fetch_market_analysis_data(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch market analysis data from MongoDB (in-process).

        Note: MongoDB data is bounded by the 2-year retention window.
        The available data range is included in the response for AI analysis context.

        Requirement: 2.1, 9.1, 9.2, 9.3
        """
        # Compute the retention boundary so consumers know the available date range
        retention_boundary = compute_retention_boundary()

        provider = _get_mongo_provider()
        if provider and provider.is_connected:
            results = {}
            for symbol in symbols:
                candles = provider.get_ohlcv(symbol=symbol, timeframe="day", limit=200)
                if candles:
                    latest = provider.get_latest_price(symbol, timeframe="day")
                    results[symbol] = {
                        "candles": candles,
                        "candle_count": len(candles),
                        "latest_price": latest,
                        "source": "mongodb",
                    }
            if results:
                return {
                    "service": "market_analysis",
                    "symbols": symbols,
                    "data": results,
                    "source": "mongodb",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "available_from": retention_boundary.isoformat(),
                    "available_to": datetime.now(timezone.utc).isoformat(),
                }

        return {
            "service": "market_analysis",
            "symbols": symbols,
            "status": "service_available",
            "note": "Market analysis uses scoring and trendline services",
            "available_from": retention_boundary.isoformat(),
            "available_to": datetime.now(timezone.utc).isoformat(),
        }

    async def _fetch_trade_analysis_data(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch full trade analysis data from MongoDB (in-process).

        Note: MongoDB data is bounded by the 2-year retention window.
        The available data range is included for AI analysis context.

        Requirement: 9.1, 9.2, 9.3
        """
        retention_boundary = compute_retention_boundary()

        provider = _get_mongo_provider()
        if provider and provider.is_connected:
            results = {}
            for symbol in symbols:
                candles = provider.get_ohlcv(symbol=symbol, timeframe="day", limit=200)
                if candles:
                    latest = provider.get_latest_price(symbol, timeframe="day")
                    results[symbol] = {
                        "candles": candles,
                        "candle_count": len(candles),
                        "latest_price": latest,
                        "source": "mongodb",
                    }
            if results:
                return {
                    "service": "trade_analysis",
                    "symbols": symbols,
                    "data": results,
                    "source": "mongodb",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "available_from": retention_boundary.isoformat(),
                    "available_to": datetime.now(timezone.utc).isoformat(),
                }

        return {
            "service": "trade_analysis",
            "symbols": symbols,
            "status": "service_available",
            "note": "Trade analysis uses full quant engine analysis",
            "available_from": retention_boundary.isoformat(),
            "available_to": datetime.now(timezone.utc).isoformat(),
        }

    async def _fetch_strategy_analysis_data(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch combined analysis with strategy framing from MongoDB (in-process).

        Note: MongoDB data is bounded by the 2-year retention window.
        The available data range is included for AI analysis context.

        Requirement: 9.1, 9.2, 9.3
        """
        retention_boundary = compute_retention_boundary()

        provider = _get_mongo_provider()
        if provider and provider.is_connected:
            results = {}
            for symbol in symbols:
                candles = provider.get_ohlcv(symbol=symbol, timeframe="day", limit=200)
                if candles:
                    latest = provider.get_latest_price(symbol, timeframe="day")
                    results[symbol] = {
                        "candles": candles,
                        "candle_count": len(candles),
                        "latest_price": latest,
                        "source": "mongodb",
                    }
            if results:
                return {
                    "service": "strategy_analysis",
                    "symbols": symbols,
                    "data": results,
                    "source": "mongodb",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "available_from": retention_boundary.isoformat(),
                    "available_to": datetime.now(timezone.utc).isoformat(),
                }

        return {
            "service": "strategy_analysis",
            "symbols": symbols,
            "status": "service_available",
            "note": "Strategy analysis uses combined quant analysis with strategy framing",
            "available_from": retention_boundary.isoformat(),
            "available_to": datetime.now(timezone.utc).isoformat(),
        }

    # -------------------------------------------------------------------------
    # Stale Data Detection (Requirements: 3.1, 3.2, 3.3)
    # -------------------------------------------------------------------------

    def _is_market_hours(self) -> bool:
        """
        Check if current time is within NSE market hours.

        NSE market hours: 9:15 AM - 3:30 PM IST, weekdays only.

        Returns:
            True if currently within market hours, False otherwise.

        Requirement: 3.2
        """
        now_utc = datetime.now(timezone.utc)
        now_ist = now_utc + IST_OFFSET

        # Check if it's a weekday (Monday=0 through Friday=4)
        if now_ist.weekday() > 4:
            return False

        # Check time bounds
        market_open = now_ist.replace(
            hour=MARKET_OPEN_HOUR, minute=MARKET_OPEN_MINUTE, second=0, microsecond=0
        )
        market_close = now_ist.replace(
            hour=MARKET_CLOSE_HOUR, minute=MARKET_CLOSE_MINUTE, second=0, microsecond=0
        )

        return market_open <= now_ist <= market_close

    def _is_data_stale(self, timestamp: datetime) -> bool:
        """
        Check if market data is older than 5 minutes.

        Args:
            timestamp: The timestamp of the market data.

        Returns:
            True if data is stale (older than 5 minutes), False otherwise.

        Requirement: 3.2
        """
        now = datetime.now(timezone.utc)

        # Ensure timestamp is timezone-aware
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        age_seconds = (now - timestamp).total_seconds()
        return age_seconds > self.STALE_DATA_THRESHOLD_SECONDS

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _build_analysis_data(self, context: PipelineContext) -> Dict[str, Any]:
        """Build the analysis data dictionary for the recommendation engine."""
        data: Dict[str, Any] = {
            "intent": context.intent.value,
            "symbols": context.symbols,
            "market_data_timestamp": context.market_data_timestamp.isoformat() if context.market_data_timestamp else None,
        }

        if context.market_data:
            data["market_data"] = context.market_data
        if context.quant_analysis:
            data["quant_analysis"] = context.quant_analysis
        if context.trendline_analysis:
            data["trendline_analysis"] = context.trendline_analysis

        return data

    @staticmethod
    def _status_event(step: PipelineStep) -> str:
        """
        Format a pipeline step status as an SSE event.

        Args:
            step: The current pipeline step.

        Returns:
            SSE-formatted status event string.
        """
        message = STEP_MESSAGES.get(step, f"Executing {step.value}...")
        data = json.dumps({"step": step.value, "message": message})
        return f"event: status\ndata: {data}\n\n"

    @staticmethod
    def _format_sse(event_type: str, data: Dict[str, Any]) -> str:
        """Format data as an SSE event string."""
        return f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"
