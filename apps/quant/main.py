import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
import logging
import time
import threading
from collections import defaultdict

# Import Pydantic models
from models import (
    MarketDataRequest,
    AnalysisResult,
    OptionsRequest,
    GreeksResult,
    OptionsGreeks,
    BatchGreeksContract,
    BatchGreeksRequest,
    BatchGreeksContractResult,
    BatchGreeksResult,
    OptionType,
    IndicatorResult,
    MACDValues,
    BollingerBands,
    ScoreResult,
    IntradayAnalysisRequest,
    IntradayAnalysisResult,
    IntradayInterval,
    OHLCVData,
    OptionsChainRequest,
    OptionsChainContractRequest,
    OptionsChainData,
    OptionsChainContractResult,
    LiquidityWarning,
)

# Import calculator functions
from calculators.rsi import calculate_rsi
from calculators.macd import calculate_macd
from calculators.moving_averages import calculate_sma, calculate_ema
from calculators.bollinger import calculate_bollinger_bands
from calculators.support_resistance import detect_support_resistance
from calculators.trendlines import detect_trendlines
from calculators.adx import calculate_adx
from calculators.atr import calculate_atr
from calculators.vwap import calculate_vwap
from calculators.volume_analysis import calculate_volume_ma, calculate_relative_volume
from calculators.price_range import calculate_52_week_high_low, calculate_momentum
from calculators.price_action import analyze_price_action

# Import services
from services.scoring_service import ScoringService
from services.trendline_service import TrendlineService, TrendlineServiceResult
from services.swing_scanner_service import SwingScannerService, ScanPerformanceMetrics
from services.swing_analysis_service import SwingAnalysisService, SwingAnalysisResult
from services.swing_scoring_service import (
    SwingScoringService,
    SwingScoreResult,
    ScoringWeights,
)
from services.intraday_analysis_service import IntradayAnalysisService
from services.intraday_scoring_service import (
    IntradayScoringService,
    IntradayScoreResult,
)
from services.options_chain_service import OptionsChainService
from validators.symbol_validator import SymbolValidator

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# === Rate Limiting Middleware ===


class EndpointRateLimiter:
    """
    Simple in-memory rate limiter for API endpoints.
    
    Implements a sliding window rate limiter per endpoint pattern.
    For production use, consider Redis-based distributed rate limiting.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        """
        Initialize rate limiter.
        
        Args:
            max_requests: Maximum requests allowed per window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)
        self.lock = threading.Lock()

    def is_allowed(self, identifier: str) -> bool:
        """
        Check if request is allowed for given identifier.
        
        Args:
            identifier: Unique identifier (e.g., "endpoint:ip")
            
        Returns:
            True if request is allowed, False if rate limit exceeded
        """
        with self.lock:
            current_time = time.time()
            window_start = current_time - self.window_seconds

            # Clean up old requests outside the window
            self.requests[identifier] = [
                req_time
                for req_time in self.requests[identifier]
                if req_time > window_start
            ]

            # Check if under limit
            if len(self.requests[identifier]) < self.max_requests:
                self.requests[identifier].append(current_time)
                return True

            return False

    def get_remaining(self, identifier: str) -> int:
        """Get remaining requests for identifier."""
        with self.lock:
            current_time = time.time()
            window_start = current_time - self.window_seconds
            
            # Count requests in current window
            recent_requests = [
                req_time
                for req_time in self.requests.get(identifier, [])
                if req_time > window_start
            ]
            
            return max(0, self.max_requests - len(recent_requests))


# Initialize rate limiter for options endpoints: 10 requests per minute
options_rate_limiter = EndpointRateLimiter(max_requests=10, window_seconds=60)

# === Paper Trading Monitor Lifespan ===
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: start/stop the trade monitor."""
    import os
    from paper_trading.trade_monitor import TradeMonitor
    from paper_trading.router import set_trade_monitor

    api_base_url = os.environ.get("API_BASE_URL", "http://localhost:4000")
    monitor_interval = int(os.environ.get("TRADE_MONITOR_INTERVAL", "30"))
    monitor_enabled = os.environ.get("TRADE_MONITOR_ENABLED", "true").lower() == "true"

    trade_monitor = TradeMonitor(
        api_base_url=api_base_url,
        interval=monitor_interval,
    )
    set_trade_monitor(trade_monitor)

    if monitor_enabled:
        await trade_monitor.start()
        logger.info(f"Trade monitor started: interval={monitor_interval}s, api={api_base_url}")

    yield

    if trade_monitor.is_running:
        await trade_monitor.stop()
        logger.info("Trade monitor stopped during shutdown")


app = FastAPI(
    title="ProfitTerminal Quant Engine",
    description="Deterministic quantitative analysis for trading decisions",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for both frontend and backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Frontend (Next.js)
        "http://localhost:4000",  # Backend (NestJS)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register options scalper router
from scalper.router import router as scalper_router
from scalper.websocket import ws_router as scalper_ws_router

app.include_router(scalper_router)
app.include_router(scalper_ws_router)

# Register AI Trading Lab router
from trading_lab.router import router as trading_lab_router

app.include_router(trading_lab_router)

# Register Paper Trading router
from paper_trading.router import router as paper_trading_router

app.include_router(paper_trading_router)

# Register Trade Analysis router
from trade_analysis.router import router as trade_analysis_router

app.include_router(trade_analysis_router)

# Register Prompt Library router
from prompt_library.router import router as prompt_library_router

app.include_router(prompt_library_router)

# Register Backtesting Engine router
from backtesting.router import router as backtesting_router

app.include_router(backtesting_router)

# Register Trade Coach router
from trade_coach.router import router as trade_coach_router

app.include_router(trade_coach_router)

# Register Agents router
from agents.router import router as agents_router

app.include_router(agents_router)

# Register Agent Readiness router
from agent_readiness.router import router as agent_readiness_router

app.include_router(agent_readiness_router)

# Register Market Data router (MongoDB candle data)
from market_data.router import router as market_data_router

app.include_router(market_data_router)


# Request models
class SwingScoreRequest(BaseModel):
    """Request model for POST /quant/swing/score endpoint."""

    analysis: SwingAnalysisResult = Field(
        ..., description="Complete swing technical analysis result"
    )
    entry_price: float = Field(..., gt=0, description="Suggested entry price")
    stop_loss: float = Field(..., gt=0, description="Suggested stop loss price")
    target: float = Field(..., gt=0, description="Suggested target price")
    sector_comparison: float = Field(
        default=50.0,
        ge=0.0,
        le=100.0,
        description="Stock vs sector performance (0-100)",
    )
    market_comparison: float = Field(
        default=50.0,
        ge=0.0,
        le=100.0,
        description="Stock vs market performance (0-100)",
    )
    breakout_detected: bool = Field(
        default=False, description="Whether a breakout pattern is detected"
    )
    volume_confirmed: bool = Field(
        default=False, description="Whether breakout has volume confirmation"
    )
    retest_detected: bool = Field(
        default=False, description="Whether a retest pattern is detected"
    )
    sector_strength: float = Field(
        default=50.0, ge=0.0, le=100.0, description="Sector strength value (0-100)"
    )
    weights: Optional[ScoringWeights] = Field(
        default=None, description="Optional custom scoring weights"
    )


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Middleware to log all incoming requests with timing information.

    Logs:
    - Request method and path
    - Client host
    - Response status code
    - Request processing time
    - Special logging for new /quant/* endpoints
    """
    start_time = time.time()

    # Log incoming request
    logger.info(
        f"Incoming request: {request.method} {request.url.path} "
        f"from {request.client.host if request.client else 'unknown'}"
    )

    # Process request
    response = await call_next(request)

    # Calculate processing time
    process_time = (time.time() - start_time) * 1000  # Convert to milliseconds

    # Log response with processing time
    logger.info(
        f"Completed: {request.method} {request.url.path} "
        f"status={response.status_code} duration={process_time:.2f}ms"
    )

    # Add custom header with processing time
    response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

    return response


# Rate limiting middleware for options endpoints
@app.middleware("http")
async def rate_limit_options_endpoints(request: Request, call_next):
    """
    Rate limiting middleware for options endpoints.
    
    Applies rate limit of 10 requests per minute to:
    - /quant/options/chain
    - /quant/options/analyze
    
    Returns 429 Too Many Requests if limit exceeded.
    Adds rate limit headers to all responses for these endpoints.
    """
    # Check if this is an options endpoint
    options_endpoints = ["/quant/options/chain", "/quant/options/analyze"]
    is_options_endpoint = any(
        request.url.path == endpoint for endpoint in options_endpoints
    )
    
    if is_options_endpoint:
        # Create identifier from endpoint + client IP
        client_ip = request.client.host if request.client else "unknown"
        identifier = f"{request.url.path}:{client_ip}"
        
        # Check rate limit
        if not options_rate_limiter.is_allowed(identifier):
            logger.warning(
                f"Rate limit exceeded for {request.url.path} from {client_ip}"
            )
            return Response(
                content='{"detail":"Rate limit exceeded. Maximum 10 requests per minute for options endpoints."}',
                status_code=429,
                media_type="application/json",
                headers={
                    "X-RateLimit-Limit": "10",
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + 60),
                    "Retry-After": "60",
                },
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = options_rate_limiter.get_remaining(identifier)
        response.headers["X-RateLimit-Limit"] = "10"
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)
        
        return response
    
    # Not an options endpoint, process normally
    return await call_next(request)


@app.get("/")
async def root():
    return {
        "service": "ProfitTerminal Quant Engine",
        "status": "running",
        "port": 8000,
        "description": "Deterministic quantitative analysis engine",
        "endpoints": {
            "analysis": [
                "POST /quant/analyze - Full technical analysis with all indicators",
                "POST /quant/score - Deterministic market scoring",
                "POST /quant/trendline - Comprehensive trendline analysis",
            ],
            "swing_trading": [
                "POST /quant/swing/scan - Scan multiple stocks for swing opportunities",
                "POST /quant/swing/analyze - Comprehensive swing analysis for single symbol",
                "POST /quant/swing/score - Deterministic swing trading score",
                "GET /quant/swing/cache/stats - Get cache statistics",
                "POST /quant/swing/cache/clear - Clear market data cache",
            ],
            "intraday_trading": [
                "POST /quant/intraday/analyze - Comprehensive intraday analysis with scoring and recommendations",
            ],
            "options": [
                "POST /options/greeks - Calculate options Greeks (Black-Scholes)",
                "POST /options/greeks/batch - Calculate Greeks for entire options chain (batch processing)",
                "POST /quant/options/chain - Process options chain with Greeks and liquidity filtering [RATE LIMITED: 10 req/min]",
                "POST /quant/options/analyze - Analyze options chain for PCR, ATM, OI analysis, support/resistance [RATE LIMITED: 10 req/min]",
            ],
            "legacy": [
                "POST /analyze - Legacy analysis endpoint (deprecated)",
                "POST /indicators - Legacy indicators endpoint (deprecated)",
                "POST /trendlines - Legacy trendlines endpoint (deprecated)",
            ],
            "metadata": [
                "GET /health - Health check",
                "GET /quant/indicators - List available indicators",
            ],
        },
        "rate_limits": {
            "options_endpoints": {
                "endpoints": ["/quant/options/chain", "/quant/options/analyze"],
                "limit": "10 requests per minute",
                "headers": [
                    "X-RateLimit-Limit: Maximum requests allowed",
                    "X-RateLimit-Remaining: Requests remaining in current window",
                    "X-RateLimit-Reset: Unix timestamp when limit resets",
                ],
                "error_response": {
                    "status": 429,
                    "body": {"detail": "Rate limit exceeded. Maximum 10 requests per minute for options endpoints."},
                    "headers": ["Retry-After: 60"],
                },
            }
        },
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Quant Engine",
        "port": 8000,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/quant/analyze", response_model=AnalysisResult)
async def analyze_market_data_v2(
    request: MarketDataRequest, include_trendline: bool = False
) -> AnalysisResult:
    """
    Main quantitative analysis endpoint with full indicator suite (NEW).

    This endpoint provides comprehensive technical analysis including all new indicators:
    - RSI, MACD, SMAs, EMAs (5, 15, 20, 50, 200), Bollinger Bands
    - ADX (Average Directional Index) for trend strength
    - ATR (Average True Range) for volatility
    - VWAP (Volume Weighted Average Price)
    - Volume analysis (volume MA, relative volume)
    - 52-week high/low
    - Momentum indicator
    - Support/resistance levels and trendlines

    This is the recommended endpoint for full market analysis.

    Args:
        request: MarketDataRequest with symbol, timeframe, and OHLCV data (minimum 200 candles)
        include_trendline: Optional boolean to include comprehensive trendline analysis (default: False)

    Returns:
        AnalysisResult with complete technical analysis including all indicators

    Raises:
        HTTPException: If insufficient data or calculation errors occur

    Example:
        POST /quant/analyze?include_trendline=true
        {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": "2024-01-15T00:00:00Z",
                    "open": 2450.0,
                    "high": 2470.0,
                    "low": 2445.0,
                    "close": 2465.0,
                    "volume": 1000000
                },
                ... (minimum 200 candles required)
            ]
        }
    """
    # Extract data arrays for calculations
    close_prices = [candle.close for candle in request.data]
    high_prices = [candle.high for candle in request.data]
    low_prices = [candle.low for candle in request.data]
    volumes = [candle.volume for candle in request.data]

    # Validate minimum data requirements
    # Need at least 200 data points for SMA-200 and EMA-200
    if len(close_prices) < 200:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient data: need at least 200 data points for "
                f"full analysis, got {len(close_prices)}"
            ),
        )

    try:
        # === Core Technical Indicators ===

        # RSI (14-period)
        rsi = calculate_rsi(close_prices, period=14)

        # MACD (12, 26, 9)
        macd_result = calculate_macd(
            close_prices, fast_period=12, slow_period=26, signal_period=9
        )
        macd = MACDValues(
            value=macd_result["value"],
            signal=macd_result["signal"],
            histogram=macd_result["histogram"],
        )

        # Simple Moving Averages
        sma_20 = calculate_sma(close_prices, period=20)
        sma_50 = calculate_sma(close_prices, period=50)
        sma_200 = calculate_sma(close_prices, period=200)

        # Exponential Moving Averages (including new variants)
        ema_5 = calculate_ema(close_prices, period=5)
        ema_15 = calculate_ema(close_prices, period=15)
        ema_20 = calculate_ema(close_prices, period=20)
        ema_50 = calculate_ema(close_prices, period=50)
        ema_200 = calculate_ema(close_prices, period=200)

        # Bollinger Bands (20-period, 2 std dev)
        upper_band, middle_band, lower_band = calculate_bollinger_bands(
            close_prices, period=20, num_std=2.0
        )
        bollinger = BollingerBands(
            upper=upper_band, middle=middle_band, lower=lower_band
        )

        # === New Indicators ===

        # ADX (Average Directional Index) - trend strength
        adx_result = calculate_adx(high_prices, low_prices, close_prices, period=14)
        adx = adx_result["adx"]

        # ATR (Average True Range) - volatility
        atr = calculate_atr(high_prices, low_prices, close_prices, period=14)

        # VWAP (Volume Weighted Average Price)
        vwap = calculate_vwap(high_prices, low_prices, close_prices, volumes)

        # Volume analysis
        volume_ma = calculate_volume_ma(volumes, period=20)
        relative_volume = calculate_relative_volume(
            volumes[-1], volumes[:-1], period=20
        )

        # 52-week high/low
        high_low_52w = calculate_52_week_high_low(close_prices)
        week_52_high = high_low_52w["high_52w"]
        week_52_low = high_low_52w["low_52w"]

        # Momentum (10-period rate of change)
        momentum = calculate_momentum(close_prices, period=10)

        # Create IndicatorResult with all indicators
        indicators = IndicatorResult(
            rsi=rsi,
            macd=macd,
            sma_20=sma_20,
            sma_50=sma_50,
            sma_200=sma_200,
            ema_5=ema_5,
            ema_15=ema_15,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            bollinger_bands=bollinger,
            adx=adx,
            atr=atr,
            vwap=vwap,
            volume_ma=volume_ma,
            relative_volume=relative_volume,
            week_52_high=week_52_high,
            week_52_low=week_52_low,
            momentum=momentum,
        )

        # Detect support and resistance levels
        support_resistance = detect_support_resistance(
            data=request.data, window=5, tolerance_pct=0.02, min_touches=2
        )

        # Detect trendlines
        trendlines = detect_trendlines(
            data=request.data, min_touches=3, min_r_squared=0.5
        )

        # Perform price action analysis
        try:
            open_prices = [candle.open for candle in request.data]
            price_action_result = analyze_price_action(
                highs=high_prices,
                lows=low_prices,
                opens=open_prices,
                closes=close_prices,
                volumes=volumes,
                lookback_period=3,  # Standard lookback for swing detection
                momentum_period=10,  # Standard momentum period
            )
        except Exception as e:
            # Log error but don't fail the entire request
            logger.warning(
                f"Price action analysis failed for {request.symbol}: {str(e)}"
            )
            price_action_result = None

        # Optionally perform comprehensive trendline analysis
        trendline_analysis = None
        if include_trendline:
            try:
                # Create TrendlineService with default lookback period
                trendline_service = TrendlineService(
                    lookback_period=3,
                    min_trendline_points=2,
                    volume_period=20,
                    volume_threshold=1.0,
                )
                # Perform comprehensive trendline analysis
                trendline_analysis = trendline_service.analyze_trendlines(request.data)
            except Exception as e:
                # Log error but don't fail the entire request
                logger.warning(
                    f"Trendline analysis failed for {request.symbol}: {str(e)}"
                )

        # Construct and return complete analysis result
        return AnalysisResult(
            symbol=request.symbol,
            timeframe=request.timeframe,
            indicators=indicators,
            price_action=price_action_result,
            support_resistance=support_resistance,
            trendlines=trendlines,
            options_greeks=None,  # Options Greeks calculated via separate endpoint
            trendline=trendline_analysis,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/quant/score", response_model=ScoreResult)
async def score_market_data(request: MarketDataRequest) -> ScoreResult:
    """
    Deterministic market scoring endpoint.

    This endpoint provides a comprehensive market scoring analysis that is fully
    deterministic (no AI involved). It analyzes market data and returns:
    - Trend classification (BULLISH/BEARISH/NEUTRAL)
    - Deterministic score (0-100) based on weighted indicator formula
    - Key indicator values (RSI, ADX, VWAP, volume ratio)
    - Human-readable signals array explaining the score

    The score is calculated using a weighted combination of:
    - RSI (30%): Momentum indicator
    - ADX (25%): Trend strength indicator
    - VWAP (25%): Price position relative to volume-weighted average
    - Volume (20%): Relative volume strength

    **IMPORTANT**: All calculations are deterministic and mathematical. No AI or
    machine learning is involved in the scoring process.

    Args:
        request: MarketDataRequest with symbol, timeframe, and OHLCV data

    Returns:
        ScoreResult with trend classification, score, and detailed signals

    Raises:
        HTTPException: If insufficient data or calculation errors occur

    Example:
        POST /quant/score
        {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": "2024-01-15T00:00:00Z",
                    "open": 2450.0,
                    "high": 2470.0,
                    "low": 2445.0,
                    "close": 2465.0,
                    "volume": 1000000
                },
                ...
            ]
        }

        Response:
        {
            "trend": "BULLISH",
            "rsi": 65.4,
            "adx": 28.5,
            "vwap": 2461.0,
            "volumeRatio": 1.25,
            "score": 78.5,
            "signals": [
                "Strong upward trend detected (ADX: 28.5)",
                "RSI in bullish range (65.4)",
                "Above average volume (1.25x average)",
                "Price above VWAP (+0.16%: 2465.00 > 2461.00)",
                "Price above all major EMAs (20/50/200: 2458.00/2452.00/2385.00)",
                "Positive momentum (15.20)"
            ]
        }
    """
    # Extract data arrays for calculations
    close_prices = [candle.close for candle in request.data]
    high_prices = [candle.high for candle in request.data]
    low_prices = [candle.low for candle in request.data]
    volumes = [candle.volume for candle in request.data]

    # Validate minimum data requirements
    # Need at least 200 data points for EMA-200
    if len(close_prices) < 200:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient data: need at least 200 data points for "
                f"scoring analysis, got {len(close_prices)}"
            ),
        )

    try:
        # Get current price (latest close)
        current_price = close_prices[-1]

        # === Calculate all required indicators ===

        # RSI (14-period)
        rsi = calculate_rsi(close_prices, period=14)

        # MACD (12, 26, 9)
        macd_result = calculate_macd(
            close_prices, fast_period=12, slow_period=26, signal_period=9
        )
        macd = MACDValues(
            value=macd_result["value"],
            signal=macd_result["signal"],
            histogram=macd_result["histogram"],
        )

        # Simple Moving Averages
        sma_20 = calculate_sma(close_prices, period=20)
        sma_50 = calculate_sma(close_prices, period=50)
        sma_200 = calculate_sma(close_prices, period=200)

        # Exponential Moving Averages
        ema_5 = calculate_ema(close_prices, period=5)
        ema_15 = calculate_ema(close_prices, period=15)
        ema_20 = calculate_ema(close_prices, period=20)
        ema_50 = calculate_ema(close_prices, period=50)
        ema_200 = calculate_ema(close_prices, period=200)

        # Bollinger Bands (20-period, 2 std dev)
        upper_band, middle_band, lower_band = calculate_bollinger_bands(
            close_prices, period=20, num_std=2.0
        )
        bollinger = BollingerBands(
            upper=upper_band, middle=middle_band, lower=lower_band
        )

        # ADX (Average Directional Index) - trend strength
        adx_result = calculate_adx(high_prices, low_prices, close_prices, period=14)
        adx = adx_result["adx"]

        # ATR (Average True Range) - volatility
        atr = calculate_atr(high_prices, low_prices, close_prices, period=14)

        # VWAP (Volume Weighted Average Price)
        vwap = calculate_vwap(high_prices, low_prices, close_prices, volumes)

        # Volume analysis
        volume_ma = calculate_volume_ma(volumes, period=20)
        relative_volume = calculate_relative_volume(
            volumes[-1], volumes[:-1], period=20
        )

        # 52-week high/low
        high_low_52w = calculate_52_week_high_low(close_prices)
        week_52_high = high_low_52w["high_52w"]
        week_52_low = high_low_52w["low_52w"]

        # Momentum (10-period rate of change)
        momentum = calculate_momentum(close_prices, period=10)

        # Create IndicatorResult with all indicators
        indicators = IndicatorResult(
            rsi=rsi,
            macd=macd,
            sma_20=sma_20,
            sma_50=sma_50,
            sma_200=sma_200,
            ema_5=ema_5,
            ema_15=ema_15,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            bollinger_bands=bollinger,
            adx=adx,
            atr=atr,
            vwap=vwap,
            volume_ma=volume_ma,
            relative_volume=relative_volume,
            week_52_high=week_52_high,
            week_52_low=week_52_low,
            momentum=momentum,
        )

        # === Use ScoringService to calculate score ===
        score_result = ScoringService.score_market(current_price, indicators)

        return score_result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/quant/trendline", response_model=TrendlineServiceResult)
async def analyze_trendline(
    request: MarketDataRequest,
    lookback_period: int = 3,
) -> TrendlineServiceResult:
    """
    Comprehensive trendline analysis endpoint.

    This endpoint performs complete trendline analysis including:
    - Swing point detection (swing highs and swing lows)
    - Support trendline calculation (fitted to swing lows)
    - Resistance trendline calculation (fitted to swing highs)
    - Breakout/breakdown detection with volume confirmation

    The analysis uses configurable lookback period for swing detection
    and returns structured results including trendline equations, swing points,
    and breakout status.

    Args:
        request: MarketDataRequest with symbol, timeframe, and OHLCV data
        lookback_period: Number of candles to look back for swing detection (default: 3)

    Returns:
        TrendlineServiceResult with swing points, support/resistance lines, and breakout status

    Raises:
        HTTPException: If insufficient data or calculation errors occur

    Example:
        POST /quant/trendline?lookback_period=3
        {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": "2024-01-15T00:00:00Z",
                    "open": 2450.0,
                    "high": 2470.0,
                    "low": 2445.0,
                    "close": 2465.0,
                    "volume": 1000000
                },
                ... (minimum 10 candles recommended)
            ]
        }

        Response:
        {
            "swing_points": [
                {
                    "timestamp": "2024-01-15T09:15:00Z",
                    "price": 2470.0,
                    "type": "HIGH",
                    "index": 5
                },
                {
                    "timestamp": "2024-01-16T14:30:00Z",
                    "price": 2445.0,
                    "type": "LOW",
                    "index": 12
                }
            ],
            "support_trendline": {
                "slope": 2.5,
                "intercept": 2350.0,
                "r_squared": 0.89,
                "start_point": [0, 2350.0],
                "end_point": [30, 2425.0]
            },
            "resistance_trendline": {
                "slope": 1.8,
                "intercept": 2400.0,
                "r_squared": 0.85,
                "start_point": [0, 2400.0],
                "end_point": [30, 2454.0]
            },
            "breakout": {
                "breakout_type": "RESISTANCE_BREAKOUT",
                "confirmed": true,
                "volume_ratio": 1.5,
                "breakout_index": 25,
                "breakout_price": 2465.0,
                "trendline_price": 2455.0
            }
        }
    """
    # Validate lookback period
    if lookback_period < 1:
        raise HTTPException(
            status_code=400, detail="lookback_period must be at least 1"
        )

    # Validate minimum data requirements
    # Need at least 10 data points for meaningful trendline analysis
    if len(request.data) < 10:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient data: need at least 10 data points for "
                f"trendline analysis, got {len(request.data)}"
            ),
        )

    try:
        # Create TrendlineService instance with specified lookback period
        trendline_service = TrendlineService(
            lookback_period=lookback_period,
            min_trendline_points=2,
            volume_period=20,
            volume_threshold=1.0,
        )

        # Perform complete trendline analysis
        result = trendline_service.analyze_trendlines(request.data)

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/analyze", response_model=AnalysisResult, deprecated=True)
async def analyze_market_data(request: MarketDataRequest) -> AnalysisResult:
    """
    Main analysis endpoint that orchestrates all technical indicator calculations.

    **DEPRECATED**: This endpoint is deprecated. Use POST /quant/analyze instead,
    which includes all new indicators (ADX, ATR, VWAP, volume analysis, EMA variants).

    This endpoint:
    - Accepts OHLCV market data
    - Calculates all technical indicators (RSI, MACD, SMAs, EMA, Bollinger Bands)
    - Detects trendlines and support/resistance levels
    - Returns complete AnalysisResult

    NOTE: This endpoint will be removed in a future version. Please migrate to /quant/analyze.

    Args:
        request: MarketDataRequest with symbol, timeframe, and OHLCV data

    Returns:
        AnalysisResult with all calculated indicators and patterns

    Raises:
        HTTPException: If insufficient data or calculation errors occur
    """
    # Extract closing prices for indicator calculations
    close_prices = [candle.close for candle in request.data]
    high_prices = [candle.high for candle in request.data]
    low_prices = [candle.low for candle in request.data]
    volumes = [candle.volume for candle in request.data]

    # Validate minimum data requirements
    # Need at least 200 data points for SMA-200
    if len(close_prices) < 200:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient data: need at least 200 data points for "
                f"full analysis, got {len(close_prices)}"
            ),
        )

    try:

        # Calculate RSI (14-period)
        rsi = calculate_rsi(close_prices, period=14)

        # Calculate MACD (12, 26, 9)
        macd_result = calculate_macd(
            close_prices, fast_period=12, slow_period=26, signal_period=9
        )
        macd = MACDValues(
            value=macd_result["value"],
            signal=macd_result["signal"],
            histogram=macd_result["histogram"],
        )

        # Calculate Simple Moving Averages
        sma_20 = calculate_sma(close_prices, period=20)
        sma_50 = calculate_sma(close_prices, period=50)
        sma_200 = calculate_sma(close_prices, period=200)

        # Calculate Exponential Moving Averages
        ema_5 = calculate_ema(close_prices, period=5)
        ema_15 = calculate_ema(close_prices, period=15)
        ema_20 = calculate_ema(close_prices, period=20)
        ema_50 = calculate_ema(close_prices, period=50)
        ema_200 = calculate_ema(close_prices, period=200)

        # Calculate Bollinger Bands (20-period, 2 std dev)
        upper_band, middle_band, lower_band = calculate_bollinger_bands(
            close_prices, period=20, num_std=2.0
        )
        bollinger = BollingerBands(
            upper=upper_band, middle=middle_band, lower=lower_band
        )

        # Calculate new indicators for backward compatibility
        # ADX (Average Directional Index)
        adx_result = calculate_adx(high_prices, low_prices, close_prices, period=14)
        adx = adx_result["adx"]

        # ATR (Average True Range)
        atr = calculate_atr(high_prices, low_prices, close_prices, period=14)

        # VWAP (Volume Weighted Average Price)
        vwap = calculate_vwap(high_prices, low_prices, close_prices, volumes)

        # Volume analysis
        volume_ma = calculate_volume_ma(volumes, period=20)
        relative_volume = calculate_relative_volume(
            volumes[-1], volumes[:-1], period=20
        )

        # 52-week high/low
        high_low_52w = calculate_52_week_high_low(close_prices)
        week_52_high = high_low_52w["high_52w"]
        week_52_low = high_low_52w["low_52w"]

        # Momentum
        momentum = calculate_momentum(close_prices, period=10)

        # Create IndicatorResult
        indicators = IndicatorResult(
            rsi=rsi,
            macd=macd,
            sma_20=sma_20,
            sma_50=sma_50,
            sma_200=sma_200,
            ema_5=ema_5,
            ema_15=ema_15,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            bollinger_bands=bollinger,
            adx=adx,
            atr=atr,
            vwap=vwap,
            volume_ma=volume_ma,
            relative_volume=relative_volume,
            week_52_high=week_52_high,
            week_52_low=week_52_low,
            momentum=momentum,
        )

        # Detect support and resistance levels
        support_resistance = detect_support_resistance(
            data=request.data, window=5, tolerance_pct=0.02, min_touches=2
        )

        # Detect trendlines
        trendlines = detect_trendlines(
            data=request.data, min_touches=3, min_r_squared=0.5
        )

        # Construct and return analysis result
        return AnalysisResult(
            symbol=request.symbol,
            timeframe=request.timeframe,
            indicators=indicators,
            support_resistance=support_resistance,
            trendlines=trendlines,
            options_greeks=None,  # Options Greeks only calculated via separate endpoint
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/trendlines")
async def analyze_trendlines(request: MarketDataRequest) -> dict:
    """
    Detect support/resistance levels and trendlines from market data.

    This endpoint analyzes historical price data to identify:
    - Support and resistance levels using clustering algorithm on local extrema
    - Trendlines using linear regression on swing highs and lows

    This is a lightweight endpoint focused specifically on trendline detection,
    without calculating the full suite of technical indicators.

    Args:
        request: MarketDataRequest with symbol, timeframe, and OHLCV data

    Returns:
        Dictionary containing:
        - symbol: Trading symbol
        - timeframe: Data timeframe
        - support_resistance: List of detected support/resistance levels
        - trendlines: List of detected trendlines

    Raises:
        HTTPException: 400 if data is insufficient or invalid
        HTTPException: 500 if calculation fails

    Example:
        POST /trendlines
        {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": "2024-01-15T00:00:00Z",
                    "open": 2450.0,
                    "high": 2470.0,
                    "low": 2445.0,
                    "close": 2465.0,
                    "volume": 1000000
                },
                ...
            ]
        }
    """
    try:
        # Validate minimum data points for trendline analysis
        # Need at least 10 points to detect meaningful patterns
        if len(request.data) < 10:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient data: At least 10 data points required for "
                    f"trendline analysis, got {len(request.data)}"
                ),
            )

        # Detect support and resistance levels
        # Using default parameters: window=5, tolerance=2%, min_touches=2
        support_resistance = detect_support_resistance(
            data=request.data, window=5, tolerance_pct=0.02, min_touches=2
        )

        # Detect trendlines using linear regression
        # Using default parameters: min_touches=3, min_r_squared=0.5
        trendlines = detect_trendlines(
            data=request.data, min_touches=3, min_r_squared=0.5
        )

        # Return results in a structured format
        return {
            "symbol": request.symbol,
            "timeframe": request.timeframe,
            "support_resistance": [level.model_dump() for level in support_resistance],
            "trendlines": [line.model_dump() for line in trendlines],
        }

    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except ValueError as e:
        # Handle validation errors from calculators
        raise HTTPException(
            status_code=400, detail=f"Invalid data for trendline analysis: {str(e)}"
        )
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=500, detail=f"Trendline analysis failed: {str(e)}"
        )


@app.get("/quant/indicators")
async def get_available_indicators() -> dict:
    """
    Get list of all available technical indicators with descriptions and parameters.

    This endpoint returns metadata about all technical indicators supported by the
    Quant Engine, including their descriptions and required parameters.

    Returns:
        Dictionary containing:
        - indicators: List of indicator metadata objects with name, description, parameters

    Example:
        GET /quant/indicators

        Response:
        {
            "indicators": [
                {
                    "name": "RSI",
                    "description": "Relative Strength Index - momentum oscillator",
                    "parameters": {
                        "period": {
                            "type": "integer",
                            "default": 14,
                            "description": "Number of periods for RSI calculation"
                        }
                    },
                    "output_range": "0 to 100"
                },
                ...
            ]
        }
    """
    return {
        "indicators": [
            {
                "name": "RSI",
                "description": "Relative Strength Index - Momentum oscillator that measures the speed and magnitude of price changes. Values range from 0 to 100, with readings above 70 indicating overbought conditions and below 30 indicating oversold conditions.",
                "parameters": {
                    "period": {
                        "type": "integer",
                        "default": 14,
                        "description": "Number of periods for RSI calculation",
                    }
                },
                "output_range": "0 to 100",
            },
            {
                "name": "MACD",
                "description": "Moving Average Convergence Divergence - Trend-following momentum indicator that shows the relationship between two moving averages. Consists of MACD line, signal line, and histogram.",
                "parameters": {
                    "fast_period": {
                        "type": "integer",
                        "default": 12,
                        "description": "Fast EMA period",
                    },
                    "slow_period": {
                        "type": "integer",
                        "default": 26,
                        "description": "Slow EMA period",
                    },
                    "signal_period": {
                        "type": "integer",
                        "default": 9,
                        "description": "Signal line EMA period",
                    },
                },
                "output_fields": ["value", "signal", "histogram"],
            },
            {
                "name": "SMA",
                "description": "Simple Moving Average - Average price over a specified number of periods. Commonly used periods are 20, 50, and 200 days.",
                "parameters": {
                    "period": {
                        "type": "integer",
                        "default": 20,
                        "description": "Number of periods for average calculation",
                    }
                },
                "common_periods": [20, 50, 200],
            },
            {
                "name": "EMA",
                "description": "Exponential Moving Average - Weighted moving average that gives more importance to recent prices. More responsive to price changes than SMA.",
                "parameters": {
                    "period": {
                        "type": "integer",
                        "default": 20,
                        "description": "Number of periods for average calculation",
                    }
                },
                "common_periods": [5, 15, 20, 50, 200],
            },
            {
                "name": "Bollinger Bands",
                "description": "Volatility indicator consisting of a middle band (SMA) and upper/lower bands at standard deviations away. Price touching upper band suggests overbought, lower band suggests oversold.",
                "parameters": {
                    "period": {
                        "type": "integer",
                        "default": 20,
                        "description": "Number of periods for middle band SMA",
                    },
                    "num_std": {
                        "type": "float",
                        "default": 2.0,
                        "description": "Number of standard deviations for bands",
                    },
                },
                "output_fields": ["upper", "middle", "lower"],
            },
        ]
    }


@app.post("/indicators", response_model=IndicatorResult, deprecated=True)
async def calculate_indicators(request: MarketDataRequest) -> IndicatorResult:
    """
    Calculate specific technical indicators on demand.

    **DEPRECATED**: This endpoint is deprecated. Use GET /quant/indicators to discover
    available indicators and POST /analyze for full technical analysis.

    This endpoint accepts OHLCV market data and returns a complete set of
    technical indicators including RSI, MACD, moving averages, and Bollinger Bands.
    This is a lightweight endpoint focused on indicator calculation only, without
    trendline or support/resistance analysis.

    Args:
        request: MarketDataRequest containing symbol, timeframe, and OHLCV data

    Returns:
        IndicatorResult with all calculated technical indicators

    Raises:
        HTTPException: If there's insufficient data or calculation errors occur

    Example:
        POST /indicators
        {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": "2024-01-15T00:00:00Z",
                    "open": 2450.0,
                    "high": 2470.0,
                    "low": 2445.0,
                    "close": 2465.0,
                    "volume": 1000000
                },
                ...
            ]
        }
    """
    try:
        # Import additional calculators
        from calculators.adx import calculate_adx
        from calculators.atr import calculate_atr
        from calculators.vwap import calculate_vwap
        from calculators.volume_analysis import (
            calculate_volume_ma,
            calculate_relative_volume,
        )
        from calculators.price_range import (
            calculate_52_week_high_low,
            calculate_momentum,
        )

        # Extract price and volume data from OHLCV
        close_prices = [candle.close for candle in request.data]
        high_prices = [candle.high for candle in request.data]
        low_prices = [candle.low for candle in request.data]
        volumes = [candle.volume for candle in request.data]

        # Validate we have enough data for all indicators
        min_required = 200  # Need at least 200 periods for SMA-200
        if len(close_prices) < min_required:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data: need at least {min_required} data points "
                f"for all indicators, got {len(close_prices)}",
            )

        # Calculate RSI (14-period)
        rsi = calculate_rsi(close_prices, period=14)

        # Calculate MACD (12, 26, 9)
        macd_result = calculate_macd(
            close_prices, fast_period=12, slow_period=26, signal_period=9
        )
        macd = MACDValues(
            value=macd_result["value"],
            signal=macd_result["signal"],
            histogram=macd_result["histogram"],
        )

        # Calculate moving averages
        sma_20 = calculate_sma(close_prices, period=20)
        sma_50 = calculate_sma(close_prices, period=50)
        sma_200 = calculate_sma(close_prices, period=200)

        # Calculate exponential moving averages
        ema_5 = calculate_ema(close_prices, period=5)
        ema_15 = calculate_ema(close_prices, period=15)
        ema_20 = calculate_ema(close_prices, period=20)
        ema_50 = calculate_ema(close_prices, period=50)
        ema_200 = calculate_ema(close_prices, period=200)

        # Calculate Bollinger Bands (20-period, 2 std dev)
        upper, middle, lower = calculate_bollinger_bands(
            close_prices, period=20, num_std=2.0
        )
        bollinger = BollingerBands(upper=upper, middle=middle, lower=lower)

        # Calculate ADX
        adx_result = calculate_adx(high_prices, low_prices, close_prices, period=14)
        adx_value = adx_result["adx"]

        # Calculate ATR
        atr_value = calculate_atr(high_prices, low_prices, close_prices, period=14)

        # Calculate VWAP
        vwap_value = calculate_vwap(high_prices, low_prices, close_prices, volumes)

        # Calculate volume metrics
        volume_ma_value = calculate_volume_ma(volumes, period=20)

        # Get current volume for relative volume calculation
        current_volume = volumes[-1]
        # Use previous 20 volumes for baseline
        baseline_volumes = volumes[-21:-1] if len(volumes) > 20 else volumes[:-1]
        relative_volume_value = calculate_relative_volume(
            current_volume, baseline_volumes, period=min(20, len(baseline_volumes))
        )

        # Calculate 52-week high/low
        high_low_result = calculate_52_week_high_low(close_prices)
        week_52_high = high_low_result["high_52w"]
        week_52_low = high_low_result["low_52w"]

        # Calculate momentum
        momentum_value = calculate_momentum(close_prices, period=10)

        # Return complete indicator result
        return IndicatorResult(
            rsi=rsi,
            macd=macd,
            sma_20=sma_20,
            sma_50=sma_50,
            sma_200=sma_200,
            ema_5=ema_5,
            ema_15=ema_15,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            bollinger_bands=bollinger,
            adx=adx_value,
            atr=atr_value,
            vwap=vwap_value,
            volume_ma=volume_ma_value,
            relative_volume=relative_volume_value,
            week_52_high=week_52_high,
            week_52_low=week_52_low,
            momentum=momentum_value,
        )

    except ValueError as e:
        # Handle calculation errors (e.g., insufficient data)
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/options/greeks", response_model=GreeksResult)
async def calculate_options_greeks(request: OptionsRequest) -> GreeksResult:
    """
    Calculate options Greeks for a given options contract using Black-Scholes model.

    This endpoint calculates Delta, Gamma, Theta, Vega, and Rho for European-style
    options (NIFTY/BANKNIFTY) based on the Black-Scholes-Merton pricing model.

    Args:
        request: OptionsRequest containing:
            - underlying: Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY')
            - spot_price: Current spot price of the underlying
            - strike_price: Strike price of the option
            - option_type: Type of option (CALL or PUT)
            - expiry_date: Expiry date of the option
            - volatility: Implied volatility (as decimal, e.g., 0.15 for 15%)
            - risk_free_rate: Risk-free interest rate (as decimal, e.g., 0.07 for 7%)

    Returns:
        GreeksResult containing the calculated Greeks along with input parameters

    Raises:
        HTTPException: If calculation fails or input validation errors occur

    Example:
        POST /options/greeks
        {
            "underlying": "NIFTY",
            "spot_price": 21500.0,
            "strike_price": 21600.0,
            "option_type": "CALL",
            "expiry_date": "2024-12-26T00:00:00Z",
            "volatility": 0.15,
            "risk_free_rate": 0.07
        }
    """
    try:
        # Import here to avoid circular dependency
        from calculators.greeks import calculate_greeks

        # Calculate Greeks using the Black-Scholes calculator
        greeks_dict = calculate_greeks(
            spot_price=request.spot_price,
            strike_price=request.strike_price,
            expiry_date=request.expiry_date,
            volatility=request.volatility,
            risk_free_rate=request.risk_free_rate,
            option_type=request.option_type.value,  # Convert enum to string
        )

        # Create OptionsGreeks object from the calculated values
        greeks = OptionsGreeks(
            delta=greeks_dict["delta"],
            gamma=greeks_dict["gamma"],
            theta=greeks_dict["theta"],
            vega=greeks_dict["vega"],
            rho=greeks_dict["rho"],
        )

        # Return complete result with input parameters
        return GreeksResult(
            underlying=request.underlying,
            spot_price=request.spot_price,
            strike_price=request.strike_price,
            option_type=request.option_type,
            expiry_date=request.expiry_date,
            greeks=greeks,
        )

    except ValueError as e:
        # Handle validation errors from the calculator
        raise HTTPException(
            status_code=400,
            detail=f"Invalid input parameters for Greeks calculation: {str(e)}",
        )
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=500, detail=f"Failed to calculate Greeks: {str(e)}"
        )


@app.post("/options/greeks/batch", response_model=BatchGreeksResult)
async def calculate_options_greeks_batch(request: BatchGreeksRequest) -> BatchGreeksResult:
    """
    Calculate options Greeks for multiple contracts simultaneously (batch processing).

    This endpoint is optimized for calculating Greeks for entire options chains
    (100+ contracts) efficiently. It processes all contracts in a single pass,
    calculating only the basic Greeks: Delta, Gamma, Theta, Vega.

    Note: Rho is NOT calculated in batch mode for performance optimization,
    as it's less relevant for NIFTY/BANKNIFTY options scalping.

    Args:
        request: BatchGreeksRequest containing:
            - underlying: Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY')
            - spot_price: Current spot price of the underlying
            - contracts: List of contracts with strike, expiry, volatility, option_type
            - risk_free_rate: Risk-free interest rate (optional, default: 0.07)

    Returns:
        BatchGreeksResult containing:
            - underlying: Symbol
            - spot_price: Spot price used
            - total_contracts: Number of contracts processed
            - contracts: List of contract results with Greeks

    Raises:
        HTTPException: If calculation fails or input validation errors occur

    Performance:
        - Processes 100+ contracts in < 100ms
        - Optimized for entire options chain analysis
        - Suitable for real-time chain scanning

    Example:
        POST /options/greeks/batch
        {
            "underlying": "NIFTY",
            "spot_price": 21500.0,
            "contracts": [
                {
                    "strike_price": 21400.0,
                    "expiry_date": "2024-12-26T00:00:00Z",
                    "volatility": 0.15,
                    "option_type": "CALL"
                },
                {
                    "strike_price": 21400.0,
                    "expiry_date": "2024-12-26T00:00:00Z",
                    "volatility": 0.15,
                    "option_type": "PUT"
                },
                {
                    "strike_price": 21500.0,
                    "expiry_date": "2024-12-26T00:00:00Z",
                    "volatility": 0.14,
                    "option_type": "CALL"
                }
            ],
            "risk_free_rate": 0.07
        }

    Requirements: 7.3 - Basic Greeks calculation for options chain analysis
    """
    try:
        logger.info(
            f"Batch Greeks calculation for {request.underlying}: "
            f"{len(request.contracts)} contracts at spot={request.spot_price}"
        )

        # Import here to avoid circular dependency
        from calculators.greeks import calculate_greeks_batch

        # Prepare contracts list for batch calculation
        contracts_list = []
        for contract in request.contracts:
            contracts_list.append(
                {
                    "strike_price": contract.strike_price,
                    "expiry_date": contract.expiry_date,
                    "volatility": contract.volatility,
                    "option_type": contract.option_type.value,  # Convert enum to string
                }
            )

        # Calculate Greeks for all contracts in batch
        greeks_results = calculate_greeks_batch(
            spot_price=request.spot_price,
            contracts=contracts_list,
            risk_free_rate=request.risk_free_rate,
        )

        # Convert results to response model
        contract_results = []
        for result in greeks_results:
            contract_results.append(
                BatchGreeksContractResult(
                    strike_price=result["strike_price"],
                    expiry_date=result["expiry_date"],
                    option_type=OptionType(result["option_type"]),
                    delta=result["delta"],
                    gamma=result["gamma"],
                    theta=result["theta"],
                    vega=result["vega"],
                )
            )

        logger.info(
            f"Batch Greeks calculation completed: {len(contract_results)} contracts processed"
        )

        # Return complete batch result
        return BatchGreeksResult(
            underlying=request.underlying,
            spot_price=request.spot_price,
            total_contracts=len(contract_results),
            contracts=contract_results,
        )

    except ValueError as e:
        # Handle validation errors from the calculator
        logger.error(f"Invalid input for batch Greeks calculation: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid input parameters for batch Greeks calculation: {str(e)}",
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Failed to calculate batch Greeks: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to calculate batch Greeks: {str(e)}"
        )


# === Options Analysis Endpoint ===


class OptionsAnalysisRequest(BaseModel):
    """
    Request model for options chain analysis.

    Used to analyze an options chain to calculate PCR, identify ATM strikes,
    detect OI buildup/unwinding, and identify support/resistance levels.

    Attributes:
        symbol: Symbol (NIFTY or BANKNIFTY)
        spot_price: Current spot price of the underlying
        contracts: List of option contracts in the chain
    """

    symbol: str = Field(
        ...,
        pattern=r"^(NIFTY|BANKNIFTY)$",
        description="Underlying symbol (NIFTY or BANKNIFTY only)",
    )
    spot_price: float = Field(..., gt=0, description="Current spot price")
    contracts: List[dict] = Field(
        ..., min_length=1, description="List of option contracts in the chain"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "NIFTY",
                    "spot_price": 21500.0,
                    "contracts": [
                        {
                            "strike_price": 21400.0,
                            "option_type": "CALL",
                            "ltp": 150.5,
                            "open_interest": 15000,
                            "change_in_oi": 2500,
                            "volume": 5000,
                        },
                        {
                            "strike_price": 21400.0,
                            "option_type": "PUT",
                            "ltp": 45.3,
                            "open_interest": 12000,
                            "change_in_oi": -1000,
                            "volume": 3000,
                        },
                    ],
                }
            ]
        }
    }


@app.post("/quant/options/analyze")
async def analyze_options_chain(request: OptionsAnalysisRequest):
    """
    Analyze options chain data for PCR, ATM strikes, OI analysis, and support/resistance.

    This endpoint performs comprehensive options chain analysis including:
    - PCR (Put-Call Ratio) calculation from Open Interest and Volume
    - ATM strike identification (closest to spot price)
    - Near ATM strikes (±3 strikes from ATM)
    - OI buildup/unwinding detection (long buildup, short buildup, etc.)
    - Support zones identification (from high put OI)
    - Resistance zones identification (from high call OI)

    The analysis is fully deterministic and based on quantitative metrics.

    Args:
        request: OptionsAnalysisRequest containing:
            - symbol: Underlying symbol (NIFTY or BANKNIFTY)
            - spot_price: Current spot price
            - contracts: List of option contracts with strike, type, LTP, OI, change in OI, volume

    Returns:
        OptionsAnalysisResult with:
            - pcr_analysis: PCR ratios and sentiment
            - atm_analysis: ATM strike and near ATM strikes
            - oi_analysis: OI buildup type, support/resistance levels, max OI strikes

    Raises:
        HTTPException: If validation fails or insufficient data provided

    Example:
        POST /quant/options/analyze
        {
            "symbol": "NIFTY",
            "spot_price": 21500.0,
            "contracts": [
                {
                    "strike_price": 21400.0,
                    "option_type": "CALL",
                    "ltp": 150.5,
                    "open_interest": 15000,
                    "change_in_oi": 2500,
                    "volume": 5000
                },
                {
                    "strike_price": 21400.0,
                    "option_type": "PUT",
                    "ltp": 45.3,
                    "open_interest": 12000,
                    "change_in_oi": -1000,
                    "volume": 3000
                },
                ...
            ]
        }

    Requirements: 7.1 - Options Scalping Analysis
    """
    try:
        logger.info(
            f"Options chain analysis for {request.symbol} at spot={request.spot_price}, "
            f"{len(request.contracts)} contracts"
        )

        # Import OptionContractData and OptionsAnalysisService
        from services.options_analysis_service import (
            OptionsAnalysisService,
            OptionContractData,
            OptionType as OAOptionType,
        )
        from validators.symbol_validator import SymbolValidator

        # Validate symbol
        validator = SymbolValidator()
        validation_result = validator.validate_symbol(request.symbol)
        if not validation_result.is_valid:
            logger.warning(
                f"Invalid symbol for options analysis: {request.symbol}"
            )
            raise HTTPException(
                status_code=400,
                detail=validation_result.error.reason,
            )

        # Parse contracts into OptionContractData objects
        contract_objects = []
        for i, contract_dict in enumerate(request.contracts):
            try:
                # Convert option_type string to enum
                option_type_str = contract_dict.get("option_type", "").upper()
                if option_type_str not in ["CALL", "PUT"]:
                    raise ValueError(
                        f"Invalid option_type: {contract_dict.get('option_type')}. Must be CALL or PUT."
                    )
                option_type = OAOptionType(option_type_str)

                # Create OptionContractData object
                contract_obj = OptionContractData(
                    strike_price=contract_dict["strike_price"],
                    option_type=option_type,
                    ltp=contract_dict["ltp"],
                    open_interest=contract_dict["open_interest"],
                    change_in_oi=contract_dict["change_in_oi"],
                    volume=contract_dict["volume"],
                )
                contract_objects.append(contract_obj)
            except KeyError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Contract at index {i} missing required field: {str(e)}",
                )
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Contract at index {i} has invalid data: {str(e)}",
                )

        # Create OptionsAnalysisService instance
        analysis_service = OptionsAnalysisService()

        # Perform analysis
        analysis_result = analysis_service.analyze(
            symbol=request.symbol,
            spot_price=request.spot_price,
            contracts=contract_objects,
        )

        logger.info(
            f"Options analysis completed for {request.symbol}: "
            f"PCR={analysis_result.pcr_analysis.pcr_by_oi:.2f}, "
            f"ATM={analysis_result.atm_analysis.atm_strike}, "
            f"Buildup={analysis_result.oi_analysis.buildup_type.value}"
        )

        # Return the result (Pydantic model will auto-serialize to JSON)
        return analysis_result

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        # Handle validation errors
        logger.error(f"Validation error in options analysis: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid input data: {str(e)}",
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Failed to analyze options chain: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during options analysis: {str(e)}",
        )


@app.post("/quant/options/chain", response_model=OptionsChainData)
async def process_options_chain(request: OptionsChainRequest) -> OptionsChainData:
    """
    Process options chain data with Greeks calculation and liquidity filtering.
    
    This endpoint accepts an options chain for NIFTY or BANKNIFTY and performs:
    1. Symbol validation (only NIFTY/BANKNIFTY allowed)
    2. Batch Greeks calculation for all contracts
    3. Liquidity filtering with warnings for illiquid contracts
    4. Returns complete chain with Greeks, IV, and liquidity data
    
    **Liquidity Criteria:**
    - Minimum Volume: 100 contracts
    - Minimum Open Interest: 500 contracts
    - Maximum Bid-Ask Spread: 5%
    
    **Liquidity Warnings:**
    - LOW_VOLUME: Volume below threshold
    - LOW_OI: Open interest below threshold
    - WIDE_SPREAD: Bid-ask spread above threshold
    - ILLIQUID: 2+ warnings present
    
    Args:
        request: OptionsChainRequest containing:
            - symbol: Underlying symbol (NIFTY or BANKNIFTY only)
            - expiry: Expiry date of options contracts
            - spot_price: Current spot price of underlying
            - risk_free_rate: Risk-free interest rate (default: 0.07)
            - contracts: List of option contracts with strike, IV, prices, OI, volume
    
    Returns:
        OptionsChainData containing:
            - symbol: Underlying symbol
            - expiry: Expiry date
            - spot_price: Current spot price
            - timestamp: Analysis timestamp
            - total_contracts: Total contracts processed
            - liquid_contracts: Number of liquid contracts
            - illiquid_contracts: Number of illiquid contracts
            - contracts: All contracts with Greeks and liquidity data
    
    Raises:
        HTTPException: 400 if symbol validation fails or invalid data
        HTTPException: 500 if processing fails
    
    Example:
        POST /quant/options/chain
        {
            "symbol": "NIFTY",
            "expiry": "2024-12-26T00:00:00Z",
            "spot_price": 21500.0,
            "risk_free_rate": 0.07,
            "contracts": [
                {
                    "strike_price": 21400.0,
                    "option_type": "CALL",
                    "volatility": 0.15,
                    "ltp": 120.0,
                    "open_interest": 10000,
                    "volume": 5000,
                    "bid": 118.0,
                    "ask": 122.0
                },
                {
                    "strike_price": 21400.0,
                    "option_type": "PUT",
                    "volatility": 0.15,
                    "ltp": 85.0,
                    "open_interest": 12000,
                    "volume": 6000,
                    "bid": 83.0,
                    "ask": 87.0
                }
            ]
        }
        
        Response:
        {
            "symbol": "NIFTY",
            "expiry": "2024-12-26T00:00:00Z",
            "spot_price": 21500.0,
            "timestamp": "2024-12-20T10:30:00Z",
            "total_contracts": 2,
            "liquid_contracts": 2,
            "illiquid_contracts": 0,
            "contracts": [
                {
                    "strike_price": 21400.0,
                    "option_type": "CALL",
                    "ltp": 120.0,
                    "open_interest": 10000,
                    "volume": 5000,
                    "bid": 118.0,
                    "ask": 122.0,
                    "greeks": {
                        "delta": 0.62,
                        "gamma": 0.0035,
                        "theta": -15.2,
                        "vega": 42.1
                    },
                    "iv": 0.15,
                    "liquidity_warnings": ["NONE"],
                    "is_liquid": true
                },
                ...
            ]
        }
    
    Requirements: 7.1, 7.3
    """
    try:
        logger.info(
            f"Processing options chain for {request.symbol}: "
            f"{len(request.contracts)} contracts, expiry={request.expiry}, "
            f"spot={request.spot_price}"
        )
        
        # Step 1: Validate symbol (NIFTY/BANKNIFTY only)
        if not SymbolValidator().is_valid_symbol(request.symbol):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid symbol '{request.symbol}'. Only NIFTY and BANKNIFTY options are supported."
            )
        
        # Step 2: Validate minimum contracts
        if len(request.contracts) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one contract must be provided in the chain"
            )
        
        # Step 3: Initialize options chain service
        chain_service = OptionsChainService(
            min_volume=100,      # Minimum volume threshold
            min_oi=500,          # Minimum OI threshold
            max_spread_pct=5.0,  # Maximum bid-ask spread (5%)
        )
        
        # Step 4: Process the entire chain
        processed_contracts, liquid_count, illiquid_count = chain_service.process_options_chain(
            symbol=request.symbol,
            spot_price=request.spot_price,
            expiry=request.expiry,
            contracts=request.contracts,
            risk_free_rate=request.risk_free_rate,
        )
        
        # Step 5: Build response
        result = OptionsChainData(
            symbol=request.symbol,
            expiry=request.expiry,
            spot_price=request.spot_price,
            timestamp=datetime.utcnow(),
            total_contracts=len(processed_contracts),
            liquid_contracts=liquid_count,
            illiquid_contracts=illiquid_count,
            contracts=processed_contracts,
        )
        
        logger.info(
            f"Options chain processing completed: {len(processed_contracts)} contracts, "
            f"{liquid_count} liquid, {illiquid_count} illiquid"
        )
        
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        # Handle validation errors
        logger.error(f"Invalid input for options chain processing: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid input parameters: {str(e)}",
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Failed to process options chain: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process options chain: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


# === Swing Scanner Endpoint with Performance Optimization ===

# Global scanner instance (reused across requests for cache persistence)
_scanner_instance = None


def get_scanner():
    """Get or create singleton scanner instance."""
    global _scanner_instance
    if _scanner_instance is None:
        _scanner_instance = SwingScannerService(
            max_workers=8,
            cache_ttl_seconds=300,  # 5 minutes
            rate_limit_per_second=10.0,
            max_concurrent_api_calls=20,
        )
        logger.info("Initialized global SwingScannerService instance")
    return _scanner_instance


@app.post("/api/swing/scan")
async def api_swing_scan(request: dict = None) -> dict:
    """
    Frontend-compatible swing scan endpoint.

    Accepts: {minScore?: number, maxResults?: number, userId?: string}
    Returns: {scannedCount, candidatesFound, candidates: [{symbol, score, trend, setupType, entry, stopLoss, target, ...}]}
    """
    from market_data.mongo_provider import MongoMarketDataProvider

    body = request or {}
    min_score = body.get("minScore", 60)
    max_results = body.get("maxResults", 20)

    # Get popular symbols from MongoDB (top traded by volume)
    provider = MongoMarketDataProvider()
    provider.connect()

    # Use a curated list of liquid large-cap symbols for scanning
    scan_symbols = [
        "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK",
        "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK",
        "LT", "AXISBANK", "ASIANPAINT", "MARUTI", "TITAN",
        "SUNPHARMA", "BAJFINANCE", "WIPRO", "HCLTECH", "ULTRACEMCO",
        "NESTLEIND", "TATAMOTORS", "TATASTEEL", "POWERGRID", "NTPC",
        "ONGC", "COALINDIA", "ADANIENT", "ADANIPORTS", "TECHM",
    ]

    candidates = []
    scanned = 0

    for symbol in scan_symbols:
        candles = provider.get_ohlcv(symbol=symbol, timeframe="day", limit=200)
        if not candles or len(candles) < 50:
            continue
        scanned += 1

        # Quick technical scoring
        closes = [c["close"] for c in candles]
        highs = [c["high"] for c in candles]
        lows = [c["low"] for c in candles]
        volumes = [c["volume"] for c in candles]

        current_price = closes[-1]

        # Calculate basic indicators for scoring
        try:
            from calculators.rsi import calculate_rsi
            from calculators.moving_averages import calculate_sma, calculate_ema
            from calculators.adx import calculate_adx
            from calculators.atr import calculate_atr

            rsi = calculate_rsi(closes, period=14)
            sma_50 = calculate_sma(closes, period=50)
            sma_200 = calculate_sma(closes, period=200) if len(closes) >= 200 else sma_50
            ema_20 = calculate_ema(closes, period=20)
            adx_result = calculate_adx(highs, lows, closes, period=14)
            adx = adx_result["adx"]
            atr = calculate_atr(highs, lows, closes, period=14)

            # Scoring logic
            score = 50.0

            # RSI scoring (40-60 neutral, <30 oversold=buy, >70 overbought)
            if 40 <= rsi <= 60:
                score += 5
            elif 30 <= rsi <= 40:
                score += 15  # Oversold bounce potential
            elif rsi < 30:
                score += 10

            # Trend: price above SMA50 and SMA200
            if current_price > sma_50:
                score += 10
            if current_price > sma_200:
                score += 10

            # ADX trend strength
            if adx > 25:
                score += 10
            elif adx > 20:
                score += 5

            # EMA proximity (near support)
            ema_distance_pct = abs(current_price - ema_20) / current_price * 100
            if ema_distance_pct < 2:
                score += 5

            # Volume confirmation
            avg_vol = sum(volumes[-20:]) / 20 if len(volumes) >= 20 else sum(volumes) / len(volumes)
            if volumes[-1] > avg_vol * 1.2:
                score += 5

            # Cap at 100
            score = min(score, 100.0)

            if score >= min_score:
                # Determine trend
                trend = "BULLISH" if current_price > sma_50 else "BEARISH" if current_price < sma_50 else "NEUTRAL"

                # Calculate entry/stop/target
                entry = current_price
                stop_loss = current_price - (atr * 2)
                target = current_price + (atr * 3)
                setup_type = "PULLBACK" if ema_distance_pct < 2 else "BREAKOUT" if current_price > max(closes[-20:-1]) else "MOMENTUM"

                candidates.append({
                    "symbol": symbol,
                    "score": round(score, 1),
                    "trend": trend,
                    "setupType": setup_type,
                    "entry": round(entry, 2),
                    "stopLoss": round(stop_loss, 2),
                    "target": round(target, 2),
                    "riskReward": round((target - entry) / (entry - stop_loss), 2) if entry > stop_loss else 0,
                    "rsi": round(rsi, 1),
                    "adx": round(adx, 1),
                    "currentPrice": round(current_price, 2),
                    "volume": volumes[-1],
                })
        except Exception as e:
            logger.debug(f"Swing scan skipping {symbol}: {e}")
            continue

    provider.close()

    # Sort by score descending and limit
    candidates.sort(key=lambda x: x["score"], reverse=True)
    candidates = candidates[:max_results]

    return {
        "scannedCount": scanned,
        "candidatesFound": len(candidates),
        "candidates": candidates,
    }


@app.post("/api/swing/analyze/{symbol}")
async def api_swing_analyze_symbol(symbol: str) -> dict:
    """
    Analyze a specific symbol for swing trading using MongoDB data.
    Returns detailed technical analysis for the given stock.
    """
    from market_data.mongo_provider import MongoMarketDataProvider

    provider = MongoMarketDataProvider()
    provider.connect()

    candles = provider.get_ohlcv(symbol=symbol.upper(), timeframe="day", limit=200)
    provider.close()

    if not candles or len(candles) < 50:
        return {"status": "error", "message": f"Insufficient data for {symbol}. Need at least 50 daily candles."}

    closes = [c["close"] for c in candles]
    highs = [c["high"] for c in candles]
    lows = [c["low"] for c in candles]
    volumes = [c["volume"] for c in candles]
    current_price = closes[-1]

    try:
        from calculators.rsi import calculate_rsi
        from calculators.macd import calculate_macd
        from calculators.moving_averages import calculate_sma, calculate_ema
        from calculators.adx import calculate_adx
        from calculators.atr import calculate_atr
        from calculators.vwap import calculate_vwap
        from calculators.bollinger import calculate_bollinger_bands

        rsi = calculate_rsi(closes, period=14)
        macd_result = calculate_macd(closes, fast_period=12, slow_period=26, signal_period=9)
        sma_20 = calculate_sma(closes, period=20)
        sma_50 = calculate_sma(closes, period=50)
        sma_200 = calculate_sma(closes, period=200) if len(closes) >= 200 else None
        ema_20 = calculate_ema(closes, period=20)
        adx_result = calculate_adx(highs, lows, closes, period=14)
        atr = calculate_atr(highs, lows, closes, period=14)
        vwap = calculate_vwap(highs, lows, closes, volumes)
        upper_bb, middle_bb, lower_bb = calculate_bollinger_bands(closes, period=20, num_std=2.0)

        # Determine trend
        trend = "BULLISH" if current_price > sma_50 else "BEARISH"
        if sma_200 and current_price > sma_200:
            trend = "STRONG_BULLISH" if trend == "BULLISH" else "BULLISH"

        # Support/Resistance
        recent_lows = sorted(lows[-20:])
        recent_highs = sorted(highs[-20:], reverse=True)
        support = recent_lows[1] if len(recent_lows) > 1 else lows[-1]
        resistance = recent_highs[1] if len(recent_highs) > 1 else highs[-1]

        return {
            "status": "success",
            "message": f"Swing analysis for {symbol.upper()}",
            "symbol": symbol.upper(),
            "currentPrice": round(current_price, 2),
            "trend": trend,
            "indicators": {
                "rsi": round(rsi, 2),
                "macd": round(macd_result["value"], 4),
                "macdSignal": round(macd_result["signal"], 4),
                "macdHistogram": round(macd_result["histogram"], 4),
                "sma20": round(sma_20, 2),
                "sma50": round(sma_50, 2),
                "sma200": round(sma_200, 2) if sma_200 else None,
                "ema20": round(ema_20, 2),
                "adx": round(adx_result["adx"], 2),
                "atr": round(atr, 2),
                "vwap": round(vwap, 2),
                "bollingerUpper": round(upper_bb, 2),
                "bollingerMiddle": round(middle_bb, 2),
                "bollingerLower": round(lower_bb, 2),
            },
            "levels": {
                "support": round(support, 2),
                "resistance": round(resistance, 2),
                "entry": round(current_price, 2),
                "stopLoss": round(current_price - atr * 2, 2),
                "target": round(current_price + atr * 3, 2),
            },
            "volume": {
                "current": volumes[-1],
                "average20": round(sum(volumes[-20:]) / 20, 0),
                "ratio": round(volumes[-1] / (sum(volumes[-20:]) / 20), 2) if sum(volumes[-20:]) > 0 else 0,
            },
        }
    except Exception as e:
        return {"status": "error", "message": f"Analysis failed for {symbol}: {str(e)}"}


@app.post("/quant/swing/scan")
async def scan_swing_universe(
    symbols: List[str],
    min_score: float = 0.0,
    clear_cache: bool = False,
) -> dict:
    """
    Scan multiple stocks for swing trading opportunities with performance optimization.

    This endpoint implements high-performance scanning with:
    - Parallel processing (8 workers by default)
    - Market data caching (5-minute TTL)
    - Rate limiting (10 requests/second)
    - Performance monitoring and metrics

    The scanner will:
    1. Fetch market data for all symbols (with caching)
    2. Analyze stocks in parallel
    3. Score and rank candidates
    4. Return top candidates with performance metrics

    **Performance Features:**
    - Cache hit rate typically 80-90% on subsequent scans
    - Parallel processing reduces scan time by 4-6x
    - Rate limiting prevents API throttling
    - Comprehensive performance metrics logged

    Args:
        symbols: List of trading symbols to scan (e.g., ["RELIANCE", "TCS", "INFY"])
        min_score: Minimum score threshold (0-100, default: 0.0)
        clear_cache: Clear cache before scanning (default: False)

    Returns:
        Dictionary containing:
            - candidates: List of swing trade candidates (sorted by score)
            - performance_metrics: Scan duration, cache stats, API calls
            - total_symbols: Total symbols scanned
            - valid_symbols: Symbols with sufficient data
            - candidates_found: Number of candidates above min_score

    Raises:
        HTTPException: If request validation fails

    Example:
        POST /quant/swing/scan?min_score=60.0
        {
            "symbols": ["RELIANCE", "TCS", "INFY", "HDFC", "ICICIBANK"],
            "min_score": 60.0,
            "clear_cache": false
        }

        Response:
        {
            "candidates": [
                {
                    "symbol": "RELIANCE",
                    "score": 78.5,
                    "analysis": {...},
                    "scoring_result": {...},
                    "processing_time_ms": 145.2
                },
                ...
            ],
            "performance_metrics": {
                "total_duration_ms": 2345.6,
                "stocks_scanned": 5,
                "cache_hits": 3,
                "cache_misses": 2,
                "api_calls": 2,
                "parallel_workers": 8,
                "avg_time_per_stock_ms": 469.1,
                "errors": 0
            },
            "total_symbols": 5,
            "valid_symbols": 5,
            "candidates_found": 3
        }
    """
    try:
        # Validate inputs
        if not symbols:
            raise HTTPException(status_code=400, detail="symbols list cannot be empty")

        if len(symbols) > 100:
            raise HTTPException(
                status_code=400, detail="Maximum 100 symbols allowed per scan"
            )

        if min_score < 0.0 or min_score > 100.0:
            raise HTTPException(
                status_code=400, detail="min_score must be between 0.0 and 100.0"
            )

        # Get scanner instance
        scanner = get_scanner()

        # Clear cache if requested
        if clear_cache:
            scanner.clear_cache()
            logger.info("Cache cleared before scan")

        # MongoDB market data provider
        from market_data.mongo_provider import MongoMarketDataProvider

        _scan_provider = MongoMarketDataProvider()
        _scan_provider.connect()

        def mongo_provider(symbol: str, timeframe: str, lookback_days: int):
            """
            MongoDB market data provider for swing scanning.
            Fetches real OHLCV data from the candles collection.
            """
            from datetime import timedelta

            tf = "day" if timeframe in ("1d", "day", "daily") else timeframe
            candles = _scan_provider.get_ohlcv(symbol=symbol, timeframe=tf, limit=lookback_days)

            if not candles:
                return []

            data = []
            for c in candles:
                ts = c.get("timestamp")
                if isinstance(ts, (int, float)):
                    ts = datetime.utcfromtimestamp(ts)
                data.append(
                    OHLCVData(
                        timestamp=ts,
                        open=c["open"],
                        high=c["high"],
                        low=c["low"],
                        close=c["close"],
                        volume=c["volume"],
                    )
                )

            return data

        market_data_provider = mongo_provider

        # Run scan
        logger.info(f"Starting swing scan for {len(symbols)} symbols")
        results = scanner.scan_universe(
            symbols=symbols,
            market_data_provider=market_data_provider,
            min_score=min_score,
        )

        # Convert results to serializable format
        candidates_dict = [
            {
                "symbol": c.symbol,
                "score": c.score,
                "error": c.error,
                "processing_time_ms": c.processing_time_ms,
                # Only include full analysis if no error
                "analysis": c.analysis.model_dump() if c.analysis else None,
                "scoring_result": (
                    c.scoring_result.model_dump() if c.scoring_result else None
                ),
            }
            for c in results["candidates"]
        ]

        return {
            "candidates": candidates_dict,
            "performance_metrics": results["performance_metrics"].model_dump(),
            "total_symbols": results["total_symbols"],
            "valid_symbols": results["valid_symbols"],
            "candidates_found": results["candidates_found"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Swing scan failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Swing scan failed: {str(e)}")


@app.post("/quant/swing/analyze", response_model=SwingAnalysisResult)
async def analyze_swing_stock(request: MarketDataRequest) -> SwingAnalysisResult:
    """
    Perform comprehensive technical analysis for swing trading on a single stock.

    This endpoint analyzes a single stock symbol with 200+ candles of OHLCV data
    and returns comprehensive technical factors required for swing trading:

    **Technical Indicators:**
    - RSI (Relative Strength Index) - momentum
    - ADX (Average Directional Index) - trend strength
    - ATR (Average True Range) - volatility
    - MACD (Moving Average Convergence Divergence)
    - EMAs (5, 15, 20, 50, 200 periods)
    - SMAs (20, 50, 200 periods)
    - VWAP (Volume Weighted Average Price)
    - Bollinger Bands

    **Volume Analysis:**
    - Volume Moving Average (20-period)
    - Relative Volume (current vs average)
    - Volume trend (INCREASING, DECREASING, STABLE)

    **Price Range Analysis:**
    - 52-week high and low
    - Distance from extremes (percentage)
    - Position within range
    - Momentum (rate of change)

    **Pattern Analysis:**
    - Support and resistance levels
    - Trendlines (support and resistance)
    - Breakout detection with volume confirmation
    - Swing point identification

    **Data Requirements:**
    - Minimum 200 candles required for full analysis
    - Data should be sorted by timestamp (oldest first)
    - Daily timeframe recommended for swing trading

    Args:
        request: MarketDataRequest with symbol, timeframe, and OHLCV data (200+ candles)

    Returns:
        SwingAnalysisResult: Complete swing trading technical analysis

    Raises:
        HTTPException: 400 if data is insufficient (< 200 candles)
        HTTPException: 500 if analysis fails

    Example:
        POST /quant/swing/analyze
        {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "data": [
                {
                    "timestamp": "2024-01-01T00:00:00Z",
                    "open": 2450.0,
                    "high": 2470.0,
                    "low": 2445.0,
                    "close": 2465.0,
                    "volume": 1000000
                },
                ... (200+ candles)
            ]
        }

        Response:
        {
            "symbol": "RELIANCE",
            "timeframe": "1d",
            "indicators": {
                "rsi": 58.5,
                "macd": {"value": 12.3, "signal": 10.1, "histogram": 2.2},
                "ema_20": 2460.0,
                "ema_50": 2450.0,
                "ema_200": 2380.0,
                "adx": 32.4,
                "atr": 45.2,
                "vwap": 2455.0,
                ...
            },
            "volume_analysis": {
                "volume_ma": 1200000.0,
                "relative_volume": 1.35,
                "volume_trend": "INCREASING"
            },
            "price_range_analysis": {
                "high_52w": 2600.0,
                "low_52w": 2200.0,
                "current_price": 2465.0,
                "distance_from_high_pct": -5.2,
                "distance_from_low_pct": 12.0,
                "momentum": 8.5
            },
            "support_resistance": [
                {"level": 2400.0, "strength": 0.85, "touches": 5},
                {"level": 2500.0, "strength": 0.72, "touches": 3}
            ],
            "trendline_analysis": {
                "support_trendline": {...},
                "resistance_trendline": {...},
                "breakout": {...}
            }
        }
    """
    try:
        # Validate minimum data requirements for swing analysis
        # Need at least 200 candles for comprehensive swing trading analysis
        if len(request.data) < 200:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient data for swing analysis: need at least 200 candles, "
                    f"got {len(request.data)}. Swing trading analysis requires extensive "
                    f"historical data for reliable technical factor calculations."
                ),
            )

        # Log analysis request
        logger.info(
            f"Swing analysis request for {request.symbol} ({request.timeframe}) "
            f"with {len(request.data)} candles"
        )

        # Create SwingAnalysisService with default parameters
        analysis_service = SwingAnalysisService(
            rsi_period=14,
            adx_period=14,
            atr_period=14,
            macd_fast=12,
            macd_slow=26,
            macd_signal=9,
            volume_period=20,
            momentum_period=10,
            lookback_days=365,  # 52-week high/low
            trendline_lookback=3,
        )

        # Perform comprehensive swing analysis
        start_time = time.time()
        result = analysis_service.analyze(
            symbol=request.symbol,
            timeframe=request.timeframe,
            data=request.data,
            include_trendlines=True,  # Always include trendlines for swing trading
        )
        analysis_time = (time.time() - start_time) * 1000  # Convert to ms

        logger.info(
            f"Swing analysis completed for {request.symbol} in {analysis_time:.2f}ms"
        )

        return result

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        # Handle validation errors from service
        logger.error(f"Validation error in swing analysis: {e}")
        raise HTTPException(
            status_code=400, detail=f"Analysis validation failed: {str(e)}"
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Swing analysis failed for {request.symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Swing analysis failed: {str(e)}")


@app.post("/quant/swing/score", response_model=SwingScoreResult)
async def score_swing_analysis(request: SwingScoreRequest) -> SwingScoreResult:
    """
    Calculate deterministic swing trading score from technical analysis.

    This endpoint takes comprehensive swing trading analysis and applies
    the deterministic scoring algorithm with configurable weights to produce
    a total score (0-100) with component breakdown.

    **CRITICAL**: This endpoint is completely deterministic - same inputs
    always produce same outputs. No AI or randomness involved.

    The scoring evaluates 7 key components:
    1. Trend Score (20%): EMA alignment, ADX strength, price position
    2. Technical Score (20%): RSI, MACD, ATR
    3. Volume Score (15%): Relative volume, volume trend
    4. Relative Strength Score (15%): Stock vs sector vs market
    5. Breakout Score (10%): Breakout detection, volume confirmation, retest
    6. Sector Score (10%): Sector strength mapping
    7. Risk/Reward Score (10%): Risk/reward ratio, stop loss proximity

    Args:
        analysis: SwingAnalysisResult with complete technical analysis
        entry_price: Suggested entry price
        stop_loss: Suggested stop loss price
        target: Suggested target price
        sector_comparison: Stock vs sector performance (0-100, default: 50.0)
        market_comparison: Stock vs market performance (0-100, default: 50.0)
        breakout_detected: Whether a breakout pattern is detected (default: False)
        volume_confirmed: Whether breakout has volume confirmation (default: False)
        retest_detected: Whether a retest pattern is detected (default: False)
        sector_strength: Sector strength value (0-100, default: 50.0)
        weights: Optional custom scoring weights (uses defaults if not provided)

    Returns:
        SwingScoreResult with total score, component breakdown, and signals

    Raises:
        HTTPException: If validation fails or calculation errors occur

    Example:
        POST /quant/swing/score
        {
            "analysis": {
                "symbol": "RELIANCE",
                "timeframe": "1d",
                "indicators": {
                    "rsi": 58.5,
                    "macd": {"value": 12.3, "signal": 10.1, "histogram": 2.2},
                    "ema_20": 2458.0,
                    "ema_50": 2452.0,
                    "ema_200": 2385.0,
                    "adx": 32.4,
                    "atr": 45.2,
                    ...
                },
                "volume_analysis": {
                    "relative_volume": 1.35,
                    "volume_trend": "INCREASING"
                },
                "price_range_analysis": {
                    "current_price": 2460.0,
                    ...
                }
            },
            "entry_price": 2460.0,
            "stop_loss": 2430.0,
            "target": 2520.0,
            "sector_comparison": 70.0,
            "market_comparison": 60.0,
            "breakout_detected": true,
            "volume_confirmed": true,
            "retest_detected": false,
            "sector_strength": 68.5,
            "weights": {
                "trend_weight": 0.20,
                "technical_weight": 0.20,
                "volume_weight": 0.15,
                "relative_strength_weight": 0.15,
                "breakout_weight": 0.10,
                "sector_weight": 0.10,
                "risk_reward_weight": 0.10
            }
        }

        Response:
        {
            "total_score": 72.5,
            "components": {
                "trend_score": 80.0,
                "technical_score": 75.0,
                "volume_score": 85.0,
                "relative_strength_score": 68.0,
                "breakout_score": 100.0,
                "sector_score": 68.5,
                "risk_reward_score": 70.0
            },
            "signals": [
                "Strong swing candidate (Total Score: 72.5/100)",
                "Strong uptrend with EMA alignment (Score: 80.0)",
                "Favorable technical indicators (Score: 75.0)",
                "Strong volume confirmation (Score: 85.0)",
                "Moderate relative strength (Score: 68.0)",
                "Confirmed breakout pattern (Score: 100.0)",
                "Moderate sector performance (Score: 68.5)",
                "Favorable risk/reward ratio (Score: 70.0)"
            ]
        }
    """
    try:
        # Validate entry, stop loss, and target
        if request.entry_price <= 0:
            raise HTTPException(status_code=400, detail="entry_price must be positive")

        if request.stop_loss <= 0:
            raise HTTPException(status_code=400, detail="stop_loss must be positive")

        if request.target <= 0:
            raise HTTPException(status_code=400, detail="target must be positive")

        # Validate stop loss and target positioning for long positions
        # (Assuming BUY signals - adjust if SELL signals are supported)
        if request.stop_loss >= request.entry_price:
            raise HTTPException(
                status_code=400,
                detail="For long positions, stop_loss must be below entry_price",
            )

        if request.target <= request.entry_price:
            raise HTTPException(
                status_code=400,
                detail="For long positions, target must be above entry_price",
            )

        # Validate score inputs
        if not (0.0 <= request.sector_comparison <= 100.0):
            raise HTTPException(
                status_code=400,
                detail="sector_comparison must be between 0.0 and 100.0",
            )

        if not (0.0 <= request.market_comparison <= 100.0):
            raise HTTPException(
                status_code=400,
                detail="market_comparison must be between 0.0 and 100.0",
            )

        if not (0.0 <= request.sector_strength <= 100.0):
            raise HTTPException(
                status_code=400, detail="sector_strength must be between 0.0 and 100.0"
            )

        # Extract current price from price_range_analysis
        current_price = request.analysis.price_range_analysis.get("current_price")
        if current_price is None:
            raise HTTPException(
                status_code=400,
                detail="price_range_analysis must include 'current_price'",
            )

        # Extract required indicators
        indicators = request.analysis.indicators

        # Calculate swing score using SwingScoringService
        score_result = SwingScoringService.calculate_total_score(
            current_price=current_price,
            ema_20=indicators.ema_20,
            ema_50=indicators.ema_50,
            ema_200=indicators.ema_200,
            adx=indicators.adx,
            rsi=indicators.rsi,
            macd_histogram=indicators.macd.histogram,
            atr=indicators.atr,
            relative_volume=request.analysis.volume_analysis["relative_volume"],
            volume_trend=request.analysis.volume_analysis["volume_trend"],
            sector_comparison=request.sector_comparison,
            market_comparison=request.market_comparison,
            breakout_detected=request.breakout_detected,
            volume_confirmed=request.volume_confirmed,
            retest_detected=request.retest_detected,
            sector_strength=request.sector_strength,
            entry_price=request.entry_price,
            stop_loss=request.stop_loss,
            target=request.target,
            weights=request.weights,
        )

        logger.info(
            f"Calculated swing score for {request.analysis.symbol}: "
            f"total={score_result.total_score:.2f}"
        )

        return score_result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Swing scoring failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Swing scoring failed: {str(e)}")


@app.get("/quant/swing/cache/stats")
async def get_cache_stats() -> dict:
    """
    Get cache statistics for the swing scanner.

    Returns cache performance metrics including:
    - Total cache entries
    - Active (non-expired) entries
    - Cache hits and misses
    - Hit rate percentage

    Returns:
        Dictionary with cache statistics

    Example:
        GET /quant/swing/cache/stats

        Response:
        {
            "total_entries": 50,
            "active_entries": 48,
            "expired_entries": 2,
            "cache_hits": 120,
            "cache_misses": 30,
            "hit_rate": 0.80
        }
    """
    scanner = get_scanner()
    return scanner.get_cache_stats()


@app.post("/quant/swing/cache/clear")
async def clear_cache() -> dict:
    """
    Clear all cached market data in the swing scanner.

    Useful when you want to force fresh data fetches or after
    market hours when stale data should be removed.

    Returns:
        Success message

    Example:
        POST /quant/swing/cache/clear

        Response:
        {
            "message": "Cache cleared successfully",
            "timestamp": "2024-01-15T10:30:00Z"
        }
    """
    scanner = get_scanner()
    scanner.clear_cache()

    return {
        "message": "Cache cleared successfully",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ===================================================================
# Intraday Trading Endpoints
# ===================================================================


class IntradayAnalyzeRequest(BaseModel):
    """Request model for POST /quant/intraday/analyze endpoint."""

    symbol: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Stock trading symbol",
        pattern=r"^[A-Z0-9]+$",
    )
    interval: IntradayInterval = Field(
        ..., description="Timeframe interval (1m, 5m, 15m, 30m, 1h)"
    )
    data: List[OHLCVData] = Field(
        ..., min_length=30, description="OHLCV candles (minimum 30 required)"
    )
    include_support_resistance: bool = Field(
        default=True, description="Include support/resistance levels"
    )
    include_opening_range: bool = Field(
        default=True, description="Include opening range analysis"
    )
    include_prev_day_levels: bool = Field(
        default=True, description="Include previous day levels"
    )


@app.post("/quant/intraday/analyze", response_model=IntradayAnalysisResult)
async def analyze_intraday_stock(
    request: IntradayAnalyzeRequest,
) -> IntradayAnalysisResult:
    """
    Perform comprehensive technical analysis for intraday trading on a single stock.

    This endpoint analyzes intraday OHLCV data (1m, 5m, 15m, 30m, 1h candles) and
    returns comprehensive technical factors optimized for same-day trading:

    **Technical Indicators:**
    - RSI (Relative Strength Index) - momentum
    - MACD (Moving Average Convergence Divergence) - trend following
    - EMAs (9, 21, 50 periods) - trend alignment
    - VWAP (Volume Weighted Average Price) - intraday benchmark
    - ATR (Average True Range) - volatility
    - Bollinger Bands - volatility and overbought/oversold
    - Relative Volume - volume strength

    **Intraday-Specific Analysis:**
    - Opening range (first 15-min candle) with breakout detection
    - Previous day high/low/close levels with breach detection
    - Support and resistance levels
    - Data freshness tracking (critical for intraday)

    **Scoring:**
    - Deterministic intraday score (0-100)
    - Component breakdown: momentum, trend, volume, volatility, breakout
    - Human-readable signals explaining the score

    **Data Requirements:**
    - Minimum 30 candles required for intraday analysis
    - Data must be intraday timeframe (1m, 5m, 15m, 30m, 1h)
    - Data should be sorted by timestamp (oldest first)
    - Fresh data recommended (< 5 minutes old)

    Args:
        request: IntradayAnalyzeRequest with symbol, interval, OHLCV data (30+ candles)

    Returns:
        IntradayAnalysisResult: Complete intraday trading analysis with score

    Raises:
        HTTPException: 400 if data is insufficient (< 30 candles)
        HTTPException: 500 if analysis fails

    Example:
        POST /quant/intraday/analyze
        {
            "symbol": "RELIANCE",
            "interval": "5m",
            "data": [
                {
                    "timestamp": "2024-01-15T09:15:00Z",
                    "open": 2460.0,
                    "high": 2465.0,
                    "low": 2458.0,
                    "close": 2463.0,
                    "volume": 50000
                },
                ... (30+ candles)
            ],
            "include_support_resistance": true,
            "include_opening_range": true,
            "include_prev_day_levels": true
        }

        Response:
        {
            "symbol": "RELIANCE",
            "interval": "5m",
            "timestamp": "2024-01-15T14:30:00Z",
            "data_freshness": {
                "timestamp": "2024-01-15T14:30:00Z",
                "age_seconds": 15.5,
                "is_stale": false
            },
            "technical_analysis": {
                "rsi": 58.5,
                "macd": {"value": 12.3, "signal": 10.1, "histogram": 2.2},
                "ema_9": 2465.0,
                "ema_21": 2460.0,
                "ema_50": 2455.0,
                "vwap": 2458.0,
                "atr": 15.5,
                "volume": 150000,
                "relative_volume": 1.35,
                "bollinger_bands": {"upper": 2480.0, "middle": 2460.0, "lower": 2440.0},
                "support_levels": [2430.0, 2445.0],
                "resistance_levels": [2475.0, 2490.0]
            },
            "current_price": 2463.0,
            "price_change": 15.5,
            "price_change_percent": 0.63,
            "score": {
                "total_score": 72.5,
                "components": {
                    "momentum_score": 75.0,
                    "trend_score": 80.0,
                    "volume_score": 85.0,
                    "volatility_score": 70.0,
                    "breakout_score": 65.0
                },
                "signals": [
                    "RSI in optimal intraday range (58.5)",
                    "Strong bullish EMA alignment (9/21/50)",
                    "High volume (1.35x average)",
                    "Price above VWAP (+0.22%)",
                    "Opening range breakout above with volume confirmation (1.35x)"
                ],
                "strength": "STRONG"
            },
            "opening_range": {
                "high": 2470.0,
                "low": 2460.0,
                "midpoint": 2465.0,
                "range_size": 10.0,
                "range_percent": 0.41,
                "breakout_status": "BREAKOUT_ABOVE",
                "current_price": 2480.0,
                "breakout_distance": 0.40,
                "volume_confirmed": true,
                "volume_ratio": 1.35
            },
            "prev_day_levels": {
                "prev_day_high": 2500.0,
                "prev_day_low": 2450.0,
                "prev_day_close": 2480.0,
                "gap_percent": 0.40,
                "gap_type": "GAP_UP",
                "breach_status": "WITHIN_RANGE",
                "current_price": 2463.0,
                "distance_from_high_percent": -1.48,
                "distance_from_low_percent": 0.53,
                "breach_significance": 0.0
            },
            "recommendation": {
                "signal": "BUY",
                "confidence": 0.75,
                "entry": 2463.0,
                "stop_loss": 2445.0,
                "target": 2490.0,
                "risk_reward": 1.5,
                "rationale": "Strong intraday momentum with RSI at 58.5, price above VWAP, and opening range breakout confirmed by volume",
                "is_stale": false,
                "valid_until": "2024-01-15T15:30:00Z",
                "warnings": []
            }
        }
    """
    try:
        # Validate minimum data requirements for intraday analysis
        if len(request.data) < 30:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient data for intraday analysis: need at least 30 candles, "
                    f"got {len(request.data)}. Intraday analysis requires minimum "
                    f"30 candles for reliable indicator calculations."
                ),
            )

        # Log analysis request
        logger.info(
            f"Intraday analysis request for {request.symbol} ({request.interval.value}) "
            f"with {len(request.data)} candles"
        )

        # Create IntradayAnalysisService with default parameters
        analysis_service = IntradayAnalysisService(
            opening_range_minutes=15,
            volume_period=20,
            rsi_period=14,
            atr_period=14,
            stale_threshold_seconds=300.0,  # 5 minutes for intraday
        )

        # Perform comprehensive intraday analysis
        start_time = time.time()
        (
            technical_analysis,
            data_freshness,
            opening_range,
            prev_day_levels,
            support_levels,
            resistance_levels,
            trendlines,
        ) = analysis_service.analyze(
            symbol=request.symbol,
            interval=request.interval,
            data=request.data,
            include_support_resistance=request.include_support_resistance,
            include_opening_range=request.include_opening_range,
            include_prev_day_levels=request.include_prev_day_levels,
        )

        # Calculate intraday score
        scoring_service = IntradayScoringService()
        current_price = request.data[-1].close
        score_result = scoring_service.calculate_score(
            current_price=current_price,
            technical_analysis=technical_analysis,
            opening_range=opening_range,
            prev_day_levels=prev_day_levels,
        )

        # Calculate price changes
        if len(request.data) >= 2:
            previous_close = request.data[-2].close
            price_change = current_price - previous_close
            price_change_percent = (price_change / previous_close) * 100
        else:
            price_change = 0.0
            price_change_percent = 0.0

        # Generate recommendation based on score and analysis
        from models.intraday import IntradayRecommendation, IntradaySignal

        # CRITICAL: Check data freshness BEFORE generating any BUY/SELL signals
        # Requirements: 6.5, 6.8 - Stale data protection
        if data_freshness.is_stale:
            # Override any signal to HOLD when data is stale
            signal = IntradaySignal.HOLD
            entry = current_price
            stop_loss = current_price * 0.98
            target = current_price * 1.02

            # Log stale data event for monitoring
            logger.warning(
                f"Stale data detected for {request.symbol}: "
                f"age={data_freshness.age_seconds:.1f}s, "
                f"threshold={analysis_service.stale_threshold_seconds}s. "
                f"Forcing HOLD signal to prevent trading on outdated data."
            )

            # Build rationale with staleness message
            rationale = "Data is stale. Waiting for fresh data. "
            rationale += f"Last update: {data_freshness.age_seconds:.1f} seconds ago. "
            rationale += (
                f"(Threshold: {analysis_service.stale_threshold_seconds} seconds)"
            )
        else:
            # Data is fresh - proceed with normal signal generation
            # Determine signal based on score and trend
            if score_result.total_score >= 70.0:
                # Strong setup: check trend direction
                if current_price > technical_analysis.vwap:
                    signal = IntradaySignal.BUY
                    entry = current_price
                    # Stop loss below recent support or VWAP
                    stop_loss = max(
                        (
                            technical_analysis.support_levels[0]
                            if technical_analysis.support_levels
                            else technical_analysis.vwap * 0.99
                        ),
                        technical_analysis.vwap * 0.995,
                    )
                    # Target at resistance or ATR-based
                    target = (
                        technical_analysis.resistance_levels[0]
                        if technical_analysis.resistance_levels
                        else current_price + technical_analysis.atr * 1.5
                    )
                else:
                    signal = IntradaySignal.SELL
                    entry = current_price
                    # Stop loss above recent resistance or VWAP
                    stop_loss = min(
                        (
                            technical_analysis.resistance_levels[0]
                            if technical_analysis.resistance_levels
                            else technical_analysis.vwap * 1.01
                        ),
                        technical_analysis.vwap * 1.005,
                    )
                    # Target at support or ATR-based
                    target = (
                        technical_analysis.support_levels[-1]
                        if technical_analysis.support_levels
                        else current_price - technical_analysis.atr * 1.5
                    )
            elif score_result.total_score >= 50.0:
                signal = IntradaySignal.HOLD
                entry = current_price
                stop_loss = current_price * 0.98
                target = current_price * 1.02
            else:
                signal = IntradaySignal.NO_TRADE
                entry = current_price
                stop_loss = current_price * 0.98
                target = current_price * 1.02

            # Build rationale from score signals
            rationale = f"Intraday score: {score_result.total_score:.1f}/100 ({score_result.strength}). "
            rationale += " ".join(score_result.signals[:3])  # Top 3 signals

        # Calculate risk/reward
        risk = abs(entry - stop_loss)
        reward = abs(target - entry)
        risk_reward = reward / risk if risk > 0 else 1.0

        # Determine validity time (typically end of trading day or 1 hour)
        from datetime import timezone, timedelta

        valid_until_dt = datetime.now(timezone.utc) + timedelta(hours=1)
        valid_until = valid_until_dt.isoformat()

        # Create recommendation
        recommendation = IntradayRecommendation(
            signal=signal,
            confidence=min(score_result.total_score / 100.0, 1.0),
            entry=entry,
            stop_loss=stop_loss,
            target=target,
            risk_reward=risk_reward,
            rationale=rationale,
            is_stale=data_freshness.is_stale,
            valid_until=valid_until,
            warnings=(
                ["Data is stale - recommendation may not reflect current market"]
                if data_freshness.is_stale
                else []
            ),
        )

        # Get analysis timestamp
        analysis_timestamp = datetime.now(timezone.utc).isoformat()

        analysis_time = (time.time() - start_time) * 1000  # Convert to ms
        logger.info(
            f"Intraday analysis completed for {request.symbol} in {analysis_time:.2f}ms"
        )

        # Construct and return result
        return IntradayAnalysisResult(
            symbol=request.symbol,
            interval=request.interval,
            timestamp=analysis_timestamp,
            data_freshness=data_freshness,
            technical_analysis=technical_analysis,
            current_price=current_price,
            price_change=price_change,
            price_change_percent=price_change_percent,
            recommendation=recommendation,
            opening_range=opening_range,
            prev_day_levels=prev_day_levels,
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        # Handle validation errors from service
        logger.error(f"Validation error in intraday analysis: {e}")
        raise HTTPException(
            status_code=400, detail=f"Analysis validation failed: {str(e)}"
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(
            f"Intraday analysis failed for {request.symbol}: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Intraday analysis failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
