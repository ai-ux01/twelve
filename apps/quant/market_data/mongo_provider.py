"""
MongoDB Market Data Provider.

Reads OHLCV candle data from MongoDB (bot-ai database, candles collection).
Provides the same interface expected by the quant engine's analysis services.

Collection schema (from candles.json):
{
    "tradingsymbol": "RELIANCE",
    "time": ISODate("2021-04-05T18:30:00Z"),
    "timeframe": "day",
    "open": 668.5,
    "high": 693.3,
    "low": 664.25,
    "close": 677.85,
    "volume": 1084510,
    "symbol": "1793"  (instrument token)
}

Environment:
    MONGODB_URI: MongoDB connection string (default: mongodb://localhost:27017/bot-ai)
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from pymongo import MongoClient, ASCENDING, DESCENDING

logger = logging.getLogger(__name__)

# Default MongoDB connection
DEFAULT_MONGODB_URI = "mongodb://localhost:27017/bot-ai"
COLLECTION_NAME = "candles"


class MongoMarketDataProvider:
    """
    Provides OHLCV market data from MongoDB.

    Reads from the 'candles' collection in the 'bot-ai' database.
    Supports fetching by symbol, timeframe, and date range.
    """

    def __init__(self, mongodb_uri: Optional[str] = None):
        """
        Initialize the MongoDB market data provider.

        Args:
            mongodb_uri: MongoDB connection string. Defaults to MONGODB_URI env var
                        or mongodb://localhost:27017/bot-ai.
        """
        self._uri = mongodb_uri or os.environ.get("MONGODB_URI", DEFAULT_MONGODB_URI)
        self._client: Optional[MongoClient] = None
        self._db = None
        self._collection = None
        self._connected = False

    def connect(self) -> bool:
        """
        Connect to MongoDB.

        Returns:
            True if connection successful, False otherwise.
        """
        try:
            self._client = MongoClient(self._uri, serverSelectionTimeoutMS=5000)
            # Test connection
            self._client.admin.command("ping")
            # Extract database name from URI or use default
            db_name = self._uri.rsplit("/", 1)[-1].split("?")[0] if "/" in self._uri else "bot-ai"
            self._db = self._client[db_name]
            self._collection = self._db[COLLECTION_NAME]
            self._connected = True
            logger.info(f"Connected to MongoDB: {db_name}.{COLLECTION_NAME}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            self._connected = False
            return False

    @property
    def is_connected(self) -> bool:
        """Check if connected to MongoDB."""
        return self._connected

    def _ensure_connected(self) -> None:
        """Ensure connection is established."""
        if not self._connected:
            self.connect()

    def get_symbols(self, limit: int = 100) -> List[str]:
        """
        Get list of available trading symbols.

        Args:
            limit: Max number of symbols to return.

        Returns:
            List of trading symbol strings (e.g., ['RELIANCE', 'TCS', 'INFY']).
        """
        self._ensure_connected()
        if self._collection is None:
            return []

        try:
            symbols = self._collection.distinct("tradingsymbol")
            return sorted(symbols)[:limit]
        except Exception as e:
            logger.error(f"Failed to get symbols: {e}")
            return []

    def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = "day",
        limit: int = 100,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get OHLCV candle data for a symbol.

        Args:
            symbol: Trading symbol (e.g., 'RELIANCE', 'NIFTY 50').
            timeframe: Candle timeframe ('day', '15minute', '5minute', etc.).
            limit: Maximum number of candles to return (most recent first).
            from_date: Start date filter (inclusive).
            to_date: End date filter (inclusive).

        Returns:
            List of OHLCV dicts with keys: timestamp, open, high, low, close, volume.
            Ordered by time ascending (oldest first).
        """
        self._ensure_connected()
        if self._collection is None:
            return []

        try:
            query: Dict[str, Any] = {
                "tradingsymbol": symbol,
                "timeframe": timeframe,
            }

            if from_date or to_date:
                time_filter = {}
                if from_date:
                    time_filter["$gte"] = from_date
                if to_date:
                    time_filter["$lte"] = to_date
                query["time"] = time_filter

            cursor = self._collection.find(
                query,
                {"_id": 0, "time": 1, "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1},
            ).sort("time", DESCENDING).limit(limit)

            candles = []
            for doc in cursor:
                candle = {
                    "timestamp": doc["time"].timestamp() if isinstance(doc["time"], datetime) else doc["time"],
                    "open": float(doc.get("open", 0)),
                    "high": float(doc.get("high", 0)),
                    "low": float(doc.get("low", 0)),
                    "close": float(doc.get("close", 0)),
                    "volume": int(doc.get("volume", 0)),
                }
                candles.append(candle)

            # Return in ascending order (oldest first)
            candles.reverse()
            return candles

        except Exception as e:
            logger.error(f"Failed to get OHLCV for {symbol}: {e}")
            return []

    def get_latest_price(self, symbol: str, timeframe: str = "day") -> Optional[Dict[str, Any]]:
        """
        Get the most recent candle for a symbol.

        Args:
            symbol: Trading symbol.
            timeframe: Candle timeframe.

        Returns:
            Dict with latest OHLCV data, or None if not found.
        """
        self._ensure_connected()
        if self._collection is None:
            return None

        try:
            doc = self._collection.find_one(
                {"tradingsymbol": symbol, "timeframe": timeframe},
                {"_id": 0, "time": 1, "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1},
                sort=[("time", DESCENDING)],
            )

            if not doc:
                return None

            return {
                "symbol": symbol,
                "timestamp": doc["time"].timestamp() if isinstance(doc["time"], datetime) else doc["time"],
                "open": float(doc.get("open", 0)),
                "high": float(doc.get("high", 0)),
                "low": float(doc.get("low", 0)),
                "close": float(doc.get("close", 0)),
                "volume": int(doc.get("volume", 0)),
                "price": float(doc.get("close", 0)),  # current price = latest close
            }

        except Exception as e:
            logger.error(f"Failed to get latest price for {symbol}: {e}")
            return None

    def get_spot_prices(self, symbols: List[str]) -> Dict[str, float]:
        """
        Get latest close prices for multiple symbols.

        Args:
            symbols: List of trading symbols.

        Returns:
            Dict mapping symbol to latest close price.
        """
        self._ensure_connected()
        prices = {}

        for symbol in symbols:
            latest = self.get_latest_price(symbol)
            if latest:
                prices[symbol] = latest["close"]

        return prices

    def get_candle_count(self, symbol: str, timeframe: str = "day") -> int:
        """
        Get total number of candles for a symbol.

        Args:
            symbol: Trading symbol.
            timeframe: Candle timeframe.

        Returns:
            Number of candles available.
        """
        self._ensure_connected()
        if self._collection is None:
            return 0

        try:
            return self._collection.count_documents(
                {"tradingsymbol": symbol, "timeframe": timeframe}
            )
        except Exception as e:
            logger.error(f"Failed to count candles for {symbol}: {e}")
            return 0

    def search_symbols(self, query: str, limit: int = 20) -> List[str]:
        """
        Search for symbols matching a query string.

        Args:
            query: Search string (case-insensitive prefix match).
            limit: Max results.

        Returns:
            List of matching trading symbols.
        """
        self._ensure_connected()
        if self._collection is None:
            return []

        try:
            # Use regex for prefix match
            import re
            pattern = re.compile(f"^{re.escape(query)}", re.IGNORECASE)
            symbols = self._collection.distinct(
                "tradingsymbol",
                {"tradingsymbol": {"$regex": pattern}},
            )
            return sorted(symbols)[:limit]
        except Exception as e:
            logger.error(f"Failed to search symbols: {e}")
            return []

    def close(self) -> None:
        """Close the MongoDB connection."""
        if self._client:
            self._client.close()
            self._connected = False
            logger.info("MongoDB connection closed")
