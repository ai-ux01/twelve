"""
Kite Connect Historical Data Backfill Service.

On startup, detects gaps in MongoDB candle data and fetches missing candles
from Kite Connect's historical data API. Supports multiple timeframes.

Requires: KITE_API_KEY and a valid Kite access token (obtained via login flow).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import httpx
from pymongo import MongoClient, ASCENDING

logger = logging.getLogger(__name__)

# Kite Connect Historical Data API base URL
KITE_API_BASE = "https://api.kite.trade"

# Timeframe mapping: our names → Kite interval strings
TIMEFRAME_MAP = {
    "5minute": "5minute",
    "15minute": "15minute",
    "1hour": "60minute",
    "day": "day",
    "week": "week",
}

# How far back to look for gaps (per timeframe)
LOOKBACK_DAYS = {
    "5minute": 30,      # 30 days of 5-min candles
    "15minute": 60,     # 60 days of 15-min candles
    "1hour": 180,       # 6 months of hourly candles
    "day": 730,         # 2 years of daily candles
    "week": 1825,       # 5 years of weekly candles
}

# Default NIFTY50 symbols to backfill
DEFAULT_BACKFILL_SYMBOLS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
    "HINDUNILVR", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK",
    "LT", "HCLTECH", "AXISBANK", "ASIANPAINT", "MARUTI",
    "SUNPHARMA", "TITAN", "BAJFINANCE", "WIPRO", "ONGC",
    "NTPC", "POWERGRID", "TATASTEEL", "ADANIENT", "NESTLEIND",
    "TATAMOTORS", "ULTRACEMCO", "BAJAJFINSV", "TECHM", "INDUSINDBK",
]

# Kite instrument tokens for NIFTY50 (NSE equity segment)
# These are approximate — in production, fetch from Kite's instruments dump
# Format: instrument_token for NSE equities
INSTRUMENT_TOKENS: Dict[str, int] = {
    "RELIANCE": 738561,
    "TCS": 2953217,
    "HDFCBANK": 341249,
    "INFY": 408065,
    "ICICIBANK": 1270529,
    "HINDUNILVR": 356865,
    "SBIN": 779521,
    "BHARTIARTL": 2714625,
    "ITC": 424961,
    "KOTAKBANK": 492033,
    "LT": 2939649,
    "HCLTECH": 1850625,
    "AXISBANK": 1510401,
    "ASIANPAINT": 60417,
    "MARUTI": 2815745,
    "SUNPHARMA": 857857,
    "TITAN": 897537,
    "BAJFINANCE": 81153,
    "WIPRO": 969473,
    "ONGC": 633601,
    "NTPC": 2977281,
    "POWERGRID": 3834113,
    "TATASTEEL": 895745,
    "ADANIENT": 6401,
    "NESTLEIND": 4598529,
    "TATAMOTORS": 884737,
    "ULTRACEMCO": 2952193,
    "BAJAJFINSV": 4268801,
    "TECHM": 3465729,
    "INDUSINDBK": 1346049,
}


class KiteBackfillService:
    """
    Fetches historical candle data from Kite Connect API to fill gaps in MongoDB.

    On startup:
    1. Connects to MongoDB
    2. For each symbol + timeframe, finds the last candle timestamp
    3. If there's a gap (last candle is older than expected), fetches missing data
    4. Inserts new candles into MongoDB
    """

    def __init__(
        self,
        mongodb_uri: Optional[str] = None,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        symbols: Optional[List[str]] = None,
        timeframes: Optional[List[str]] = None,
    ):
        self._mongodb_uri = mongodb_uri or os.environ.get(
            "MONGODB_URI", "mongodb://localhost:27017/bot-ai"
        )
        self._api_key = api_key or os.environ.get("KITE_API_KEY", "")
        self._access_token = access_token or os.environ.get("KITE_ACCESS_TOKEN", "")
        self._symbols = symbols or DEFAULT_BACKFILL_SYMBOLS
        self._timeframes = timeframes or ["day", "5minute", "15minute", "1hour"]
        self._client: Optional[MongoClient] = None
        self._collection = None
        self._stats = {
            "symbols_processed": 0,
            "candles_inserted": 0,
            "errors": 0,
            "timeframes_backfilled": [],
        }

    async def run_backfill(self) -> Dict:
        """
        Run the full backfill process.

        Returns:
            Dict with stats: symbols_processed, candles_inserted, errors.
        """
        if not self._api_key:
            logger.warning("KITE_API_KEY not set, skipping backfill")
            return self._stats

        # Try to load access token from file if not set via env
        if not self._access_token:
            self._access_token = self._load_token_from_file()

        if not self._access_token:
            logger.warning(
                "KITE_ACCESS_TOKEN not set and no token file found. "
                "Login via http://localhost:4000/api/kite/login-url to authenticate."
            )
            return self._stats

        # Connect to MongoDB
        try:
            self._client = MongoClient(self._mongodb_uri, serverSelectionTimeoutMS=5000)
            self._client.admin.command("ping")
            db_name = self._mongodb_uri.split("/")[-1].split("?")[0] or "bot-ai"
            db = self._client[db_name]
            self._collection = db["candles"]
            logger.info(f"Backfill service connected to MongoDB: {db_name}.candles")
        except Exception as e:
            logger.error(f"Backfill service failed to connect to MongoDB: {e}")
            self._stats["errors"] += 1
            return self._stats

        try:
            for symbol in self._symbols:
                await self._backfill_symbol(symbol)
                self._stats["symbols_processed"] += 1
                # Rate limit: Kite allows ~3 requests/second for historical data
                await asyncio.sleep(0.5)
        finally:
            if self._client:
                self._client.close()

        logger.info(
            f"Backfill complete: {self._stats['symbols_processed']} symbols, "
            f"{self._stats['candles_inserted']} candles inserted, "
            f"{self._stats['errors']} errors"
        )
        return self._stats

    async def _backfill_symbol(self, symbol: str) -> None:
        """Backfill all timeframes for a single symbol."""
        instrument_token = INSTRUMENT_TOKENS.get(symbol)
        if not instrument_token:
            logger.debug(f"No instrument token for {symbol}, skipping")
            return

        for timeframe in self._timeframes:
            try:
                await self._backfill_timeframe(symbol, instrument_token, timeframe)
            except Exception as e:
                logger.warning(f"Backfill error for {symbol}/{timeframe}: {e}")
                self._stats["errors"] += 1
            # Rate limit between timeframe requests
            await asyncio.sleep(0.4)

    async def _backfill_timeframe(
        self, symbol: str, instrument_token: int, timeframe: str
    ) -> None:
        """Backfill a specific timeframe for a symbol."""
        kite_interval = TIMEFRAME_MAP.get(timeframe)
        if not kite_interval:
            return

        lookback_days = LOOKBACK_DAYS.get(timeframe, 30)

        # Find the last candle in MongoDB for this symbol+timeframe
        last_candle = self._get_last_candle(symbol, timeframe)

        now = datetime.now(timezone.utc)

        if last_candle:
            # Start from after the last candle
            last_ts = last_candle.get("timestamp", 0)
            if isinstance(last_ts, (int, float)):
                from_date = datetime.fromtimestamp(last_ts, tz=timezone.utc) + timedelta(minutes=1)
            else:
                from_date = now - timedelta(days=lookback_days)
        else:
            # No data at all — fetch full lookback
            from_date = now - timedelta(days=lookback_days)

        to_date = now

        # Skip if we're already up to date (within 1 candle interval)
        if timeframe == "5minute" and (to_date - from_date).total_seconds() < 300:
            return
        if timeframe == "15minute" and (to_date - from_date).total_seconds() < 900:
            return
        if timeframe == "1hour" and (to_date - from_date).total_seconds() < 3600:
            return
        if timeframe == "day" and (to_date - from_date).total_seconds() < 86400:
            return

        # Fetch from Kite Connect Historical Data API
        candles = await self._fetch_kite_historical(
            instrument_token, kite_interval, from_date, to_date
        )

        if not candles:
            return

        # Insert into MongoDB
        inserted = self._insert_candles(symbol, timeframe, candles)
        self._stats["candles_inserted"] += inserted

        if inserted > 0:
            logger.info(
                f"Backfilled {inserted} {timeframe} candles for {symbol} "
                f"({from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')})"
            )

    async def _fetch_kite_historical(
        self,
        instrument_token: int,
        interval: str,
        from_date: datetime,
        to_date: datetime,
    ) -> List[List]:
        """
        Fetch historical candles from Kite Connect API.

        Returns list of candles: [[timestamp, open, high, low, close, volume], ...]
        """
        url = f"{KITE_API_BASE}/instruments/historical/{instrument_token}/{interval}"
        params = {
            "from": from_date.strftime("%Y-%m-%d+%H:%M:%S"),
            "to": to_date.strftime("%Y-%m-%d+%H:%M:%S"),
        }
        headers = {
            "X-Kite-Version": "3",
            "Authorization": f"token {self._api_key}:{self._access_token}",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params, headers=headers)

            if response.status_code == 403:
                logger.warning("Kite API returned 403 — access token may be expired")
                return []

            if response.status_code == 429:
                logger.warning("Kite API rate limited, waiting 1s...")
                await asyncio.sleep(1)
                return []

            if response.status_code != 200:
                logger.debug(
                    f"Kite API returned {response.status_code} for "
                    f"token {instrument_token}/{interval}"
                )
                return []

            data = response.json()
            candles = data.get("data", {}).get("candles", [])
            return candles

        except Exception as e:
            logger.debug(f"Kite historical fetch error: {e}")
            return []

    def _get_last_candle(self, symbol: str, timeframe: str) -> Optional[Dict]:
        """Get the most recent candle from MongoDB for a symbol+timeframe."""
        if not self._collection:
            return None

        result = self._collection.find_one(
            {"symbol": symbol, "timeframe": timeframe},
            sort=[("timestamp", -1)],
        )
        return result

    def _load_token_from_file(self) -> str:
        """Load Kite access token from the NestJS-generated token file."""
        import json
        token_file = os.path.join(
            os.path.dirname(__file__), "..", "..", "api", ".kite-token.json"
        )
        try:
            if os.path.exists(token_file):
                with open(token_file, "r") as f:
                    data = json.load(f)
                token = data.get("access_token", "")
                if token:
                    logger.info(f"Loaded Kite access token from {token_file}")
                    # Also set api_key if available
                    if data.get("api_key"):
                        self._api_key = data["api_key"]
                return token
        except Exception as e:
            logger.debug(f"Could not load Kite token file: {e}")
        return ""

    def _insert_candles(
        self, symbol: str, timeframe: str, candles: List[List]
    ) -> int:
        """
        Insert candles into MongoDB using upsert to avoid duplicates.

        Args:
            symbol: Trading symbol.
            timeframe: Candle timeframe.
            candles: List of [timestamp_str, open, high, low, close, volume].

        Returns:
            Number of candles inserted/updated.
        """
        if not self._collection or not candles:
            return 0

        from pymongo import UpdateOne

        operations = []
        for candle in candles:
            try:
                # Kite returns: ["2024-01-15T09:15:00+0530", open, high, low, close, volume]
                ts_str = candle[0]
                # Parse the timestamp
                if isinstance(ts_str, str):
                    # Handle Kite's timestamp format
                    ts = datetime.fromisoformat(ts_str.replace("+0530", "+05:30"))
                    timestamp = ts.timestamp()
                else:
                    timestamp = float(ts_str)

                operations.append(
                    UpdateOne(
                        {
                            "symbol": symbol,
                            "timeframe": timeframe,
                            "timestamp": timestamp,
                        },
                        {
                            "$set": {
                                "symbol": symbol,
                                "timeframe": timeframe,
                                "timestamp": timestamp,
                                "open": float(candle[1]),
                                "high": float(candle[2]),
                                "low": float(candle[3]),
                                "close": float(candle[4]),
                                "volume": int(candle[5]) if len(candle) > 5 else 0,
                            }
                        },
                        upsert=True,
                    )
                )
            except (IndexError, ValueError, TypeError) as e:
                logger.debug(f"Skipping malformed candle: {e}")
                continue

        if operations:
            result = self._collection.bulk_write(operations, ordered=False)
            return result.upserted_count + result.modified_count

        return 0
