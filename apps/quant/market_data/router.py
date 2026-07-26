"""
Market Data FastAPI Router.

Exposes MongoDB candle data via REST endpoints for the quant engine
and other services to consume.

Endpoints:
- GET /api/market-data/symbols — list available symbols
- GET /api/market-data/ohlcv — get OHLCV candles for a symbol
- GET /api/market-data/spot-prices — get latest prices for symbols
- GET /api/market-data/search — search symbols by prefix
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from .mongo_provider import MongoMarketDataProvider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/market-data", tags=["market-data"])

# Module-level singleton provider
_provider = MongoMarketDataProvider()


def get_provider() -> MongoMarketDataProvider:
    """Get the shared MongoMarketDataProvider instance."""
    return _provider


@router.on_event("startup")
async def startup_connect():
    """Connect to MongoDB on startup."""
    _provider.connect()


@router.get("/symbols")
async def list_symbols(
    limit: int = Query(default=100, ge=1, le=1000, description="Max symbols to return"),
) -> Dict[str, Any]:
    """List all available trading symbols from MongoDB."""
    provider = get_provider()
    symbols = provider.get_symbols(limit=limit)
    return {
        "success": True,
        "count": len(symbols),
        "symbols": symbols,
    }


@router.get("/ohlcv")
async def get_ohlcv(
    symbol: str = Query(..., description="Trading symbol (e.g., RELIANCE)"),
    timeframe: str = Query(default="day", description="Candle timeframe (day, 15minute, 5minute)"),
    limit: int = Query(default=100, ge=1, le=1000, description="Number of candles"),
) -> Dict[str, Any]:
    """Get OHLCV candle data for a symbol from MongoDB."""
    provider = get_provider()
    candles = provider.get_ohlcv(symbol=symbol, timeframe=timeframe, limit=limit)
    return {
        "success": True,
        "symbol": symbol,
        "timeframe": timeframe,
        "count": len(candles),
        "candles": candles,
    }


@router.get("/spot-prices")
async def get_spot_prices(
    symbols: str = Query(..., description="Comma-separated symbols (e.g., RELIANCE,TCS,INFY)"),
) -> Dict[str, Any]:
    """Get latest close prices for multiple symbols."""
    provider = get_provider()
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]

    # Format response matching what the scalper/trading lab expects
    result = {}
    for sym in symbol_list:
        latest = provider.get_latest_price(sym)
        if latest:
            result[sym] = {"price": latest["price"], "timestamp": latest.get("timestamp")}
        else:
            result[sym] = {"price": 0, "timestamp": None}

    return result


@router.get("/search")
async def search_symbols(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=20, ge=1, le=100, description="Max results"),
) -> Dict[str, Any]:
    """Search for symbols matching a prefix."""
    provider = get_provider()
    symbols = provider.search_symbols(query=q, limit=limit)
    return {
        "success": True,
        "query": q,
        "count": len(symbols),
        "symbols": symbols,
    }


@router.get("/health")
async def market_data_health() -> Dict[str, Any]:
    """Check MongoDB connection health."""
    provider = get_provider()
    connected = provider.is_connected
    if not connected:
        connected = provider.connect()

    return {
        "connected": connected,
        "source": "mongodb",
        "database": "bot-ai",
        "collection": "candles",
    }
