"""
Market Data Fetcher for the Options Scalping Agent.

This module retrieves and validates spot prices, OHLCV data, and options chain
data from market data APIs. It implements timeout handling (5s per API call,
10s total), retry logic (up to 2 additional attempts with 1s delay), and
data freshness validation (<2 minutes old).

Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Any, Dict, List, Optional

import httpx

from scalper.models import OptionsContract, MarketDataPackage


logger = logging.getLogger(__name__)


class MarketDataFetchError(Exception):
    """Raised when market data fetch fails after all retries."""

    pass


class StaleDataError(Exception):
    """Raised when fetched data is older than the freshness threshold."""

    pass


class MarketDataFetcher:
    """
    Retrieves and validates spot prices, OHLCV data, and options chain.

    Integrates with the backend API (port 4000) to fetch market data for
    NIFTY50 and BANKNIFTY options scalping. Implements:
    - Timeout: 5 seconds per API call, 10 seconds total for complete fetch
    - Retry: up to 2 additional attempts with 1-second delay
    - Data freshness validation: timestamps must be <2 minutes old

    Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10
    """

    # Timeout configuration
    API_CALL_TIMEOUT: float = 5.0  # 5 seconds per API call
    TOTAL_FETCH_TIMEOUT: float = 10.0  # 10 seconds total for complete fetch

    # Retry configuration
    MAX_RETRIES: int = 2  # Up to 2 additional attempts
    RETRY_DELAY: float = 1.0  # 1-second delay between retries

    # Data freshness threshold
    FRESHNESS_THRESHOLD: timedelta = timedelta(minutes=2)

    # Supported underlyings
    SUPPORTED_SYMBOLS: List[str] = ["NIFTY", "BANKNIFTY"]

    def __init__(
        self,
        base_url: str = "http://localhost:4000",
        quant_base_url: str = "http://localhost:8000",
        api_call_timeout: Optional[float] = None,
        total_fetch_timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        retry_delay: Optional[float] = None,
    ):
        """
        Initialize MarketDataFetcher.

        Args:
            base_url: Base URL for the NestJS backend API (default: http://localhost:4000)
            quant_base_url: Base URL for the quant engine API with MongoDB data (default: http://localhost:8000)
            api_call_timeout: Timeout per API call in seconds (default: 5.0)
            total_fetch_timeout: Total timeout for complete fetch in seconds (default: 10.0)
            max_retries: Max additional retry attempts (default: 2)
            retry_delay: Delay between retries in seconds (default: 1.0)
        """
        self.base_url = base_url.rstrip("/")
        self.quant_base_url = quant_base_url.rstrip("/")
        self.api_call_timeout = api_call_timeout or self.API_CALL_TIMEOUT
        self.total_fetch_timeout = total_fetch_timeout or self.TOTAL_FETCH_TIMEOUT
        self.max_retries = max_retries if max_retries is not None else self.MAX_RETRIES
        self.retry_delay = retry_delay if retry_delay is not None else self.RETRY_DELAY

    async def fetch_spot_prices(self) -> Dict[str, float]:
        """
        Fetch current spot prices for NIFTY50 and BANKNIFTY.

        Returns:
            Dictionary with keys "NIFTY" and "BANKNIFTY" mapped to their spot prices.

        Raises:
            MarketDataFetchError: If fetch fails after all retries.
            StaleDataError: If fetched data is stale (>2 minutes old).

        Requirements: 4.1, 4.2
        """

        async def _fetch() -> Dict[str, float]:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.api_call_timeout)
            ) as client:
                response = await client.get(
                    f"{self.quant_base_url}/api/market-data/spot-prices",
                    params={"symbols": "NIFTY,BANKNIFTY"},
                )
                response.raise_for_status()
                data = response.json()

                # Validate response structure
                spot_prices: Dict[str, float] = {}
                for symbol in self.SUPPORTED_SYMBOLS:
                    price_data = data.get(symbol, {})
                    price = price_data.get("price") if isinstance(price_data, dict) else price_data

                    if price is None or price <= 0:
                        raise MarketDataFetchError(
                            f"Invalid spot price for {symbol}: {price}"
                        )
                    spot_prices[symbol] = float(price)

                    # Validate freshness if timestamp available
                    timestamp = price_data.get("timestamp") if isinstance(price_data, dict) else None
                    if timestamp:
                        self.validate_data_freshness({"timestamp": timestamp})

                return spot_prices

        return await self._fetch_with_retry(_fetch, "spot prices")

    async def fetch_ohlcv_data(
        self,
        symbol: str,
        interval: str = "60minute",
        count: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Fetch OHLCV (candlestick) data for the given symbol.

        Args:
            symbol: Trading symbol ("NIFTY" or "BANKNIFTY")
            interval: Candle interval (default: "60minute" for 1-hour candles from MongoDB)
            count: Number of candles to fetch (default: 100, last 100 bars)

        Returns:
            List of OHLCV dictionaries with keys: timestamp, open, high, low, close, volume.

        Raises:
            MarketDataFetchError: If fetch fails after all retries.
            StaleDataError: If fetched data is stale (>2 minutes old).
            ValueError: If symbol is not supported.

        Requirements: 4.3
        """
        if symbol not in self.SUPPORTED_SYMBOLS:
            raise ValueError(
                f"Unsupported symbol: {symbol}. Must be one of {self.SUPPORTED_SYMBOLS}"
            )

        async def _fetch() -> List[Dict[str, Any]]:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.api_call_timeout)
            ) as client:
                response = await client.get(
                    f"{self.quant_base_url}/api/market-data/ohlcv",
                    params={
                        "symbol": symbol,
                        "timeframe": interval,
                        "limit": count,
                    },
                )
                response.raise_for_status()
                data = response.json()

                candles = data if isinstance(data, list) else data.get("candles", [])

                if not candles:
                    raise MarketDataFetchError(
                        f"No OHLCV data returned for {symbol}"
                    )

                # Validate each candle
                validated_candles = []
                for candle in candles:
                    self._validate_ohlcv_candle(candle)
                    validated_candles.append(candle)

                # Validate freshness of the most recent candle
                if validated_candles:
                    latest_candle = validated_candles[-1]
                    self.validate_data_freshness(latest_candle)

                return validated_candles

        return await self._fetch_with_retry(_fetch, f"OHLCV data for {symbol}")

    async def fetch_options_chain(
        self,
        symbol: str,
        spot_price: float,
    ) -> List[OptionsContract]:
        """
        Fetch options chain for the given symbol, filtered to contracts
        within 10% of spot price and up to 30 days to expiry.

        Args:
            symbol: Trading symbol ("NIFTY" or "BANKNIFTY")
            spot_price: Current spot price for filtering

        Returns:
            List of OptionsContract objects that meet filtering criteria.

        Raises:
            MarketDataFetchError: If fetch fails after all retries.
            StaleDataError: If fetched data is stale (>2 minutes old).
            ValueError: If symbol is not supported or spot_price is invalid.

        Requirements: 4.4, 4.5
        """
        if symbol not in self.SUPPORTED_SYMBOLS:
            raise ValueError(
                f"Unsupported symbol: {symbol}. Must be one of {self.SUPPORTED_SYMBOLS}"
            )
        if spot_price <= 0:
            raise ValueError(f"Invalid spot price: {spot_price}. Must be positive.")

        async def _fetch() -> List[OptionsContract]:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.api_call_timeout)
            ) as client:
                response = await client.post(
                    f"{self.base_url}/api/options/chain",
                    json={"symbol": symbol},
                )
                response.raise_for_status()
                data = response.json()

                contracts_data = data.get("contracts", [])
                if not contracts_data:
                    raise MarketDataFetchError(
                        f"No options chain data returned for {symbol}"
                    )

                # Validate freshness using response timestamp
                response_timestamp = data.get("timestamp")
                if response_timestamp:
                    self.validate_data_freshness({"timestamp": response_timestamp})

                # Filter and validate contracts
                filtered_contracts = self._filter_options_contracts(
                    contracts_data, spot_price
                )

                return filtered_contracts

        return await self._fetch_with_retry(
            _fetch, f"options chain for {symbol}"
        )

    def validate_data_freshness(self, data: Any) -> bool:
        """
        Validate that data timestamp is within the freshness threshold (<2 minutes).

        Args:
            data: Data object containing a 'timestamp' field (dict, object with .timestamp)

        Returns:
            True if data is fresh (within threshold).

        Raises:
            StaleDataError: If data timestamp exceeds 2-minute threshold.

        Requirements: 4.6, 4.7
        """
        timestamp = self._extract_timestamp(data)
        if timestamp is None:
            # If no timestamp available, skip freshness check
            return True

        now = datetime.now(timezone.utc)

        # Ensure timestamp is timezone-aware
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        age = now - timestamp
        if age > self.FRESHNESS_THRESHOLD:
            raise StaleDataError(
                f"Data is stale: timestamp={timestamp.isoformat()}, "
                f"age={age.total_seconds():.1f}s, "
                f"threshold={self.FRESHNESS_THRESHOLD.total_seconds():.0f}s"
            )

        return True

    async def fetch_all(
        self, underlying: str
    ) -> MarketDataPackage:
        """
        Fetch all market data (spot prices, OHLCV, options chain) for the
        given underlying within the total fetch timeout.

        Args:
            underlying: Trading symbol ("NIFTY" or "BANKNIFTY")

        Returns:
            Complete MarketDataPackage with all market data.

        Raises:
            MarketDataFetchError: If any fetch fails after all retries.
            StaleDataError: If any data is stale.
            asyncio.TimeoutError: If total fetch exceeds 10-second timeout.

        Requirements: 4.8, 4.9, 4.10
        """
        if underlying not in self.SUPPORTED_SYMBOLS:
            raise ValueError(
                f"Unsupported underlying: {underlying}. "
                f"Must be one of {self.SUPPORTED_SYMBOLS}"
            )

        async def _do_fetch_all():
            # Fetch spot prices first (needed for options chain filtering)
            spot_prices = await self.fetch_spot_prices()
            spot_price = spot_prices[underlying]

            # Fetch OHLCV and options chain in parallel
            ohlcv_task = self.fetch_ohlcv_data(
                symbol=underlying, interval="60minute", count=100
            )
            options_task = self.fetch_options_chain(
                symbol=underlying, spot_price=spot_price
            )

            ohlcv_data, options_chain = await asyncio.gather(
                ohlcv_task, options_task
            )

            return MarketDataPackage(
                timestamp=datetime.now(timezone.utc),
                underlying=underlying,
                spot_price=spot_price,
                ohlcv_data=ohlcv_data,
                options_chain=options_chain,
                previous_analysis=None,
            )

        try:
            return await asyncio.wait_for(
                _do_fetch_all(), timeout=self.total_fetch_timeout
            )
        except asyncio.TimeoutError:
            raise MarketDataFetchError(
                f"Total fetch timeout exceeded ({self.total_fetch_timeout}s) "
                f"for {underlying}"
            )

    # --- Private helper methods ---

    async def _fetch_with_retry(self, fetch_fn, description: str) -> Any:
        """
        Execute a fetch function with retry logic.

        Retries up to max_retries additional times with retry_delay between attempts.

        Args:
            fetch_fn: Async callable to execute
            description: Description for logging

        Returns:
            Result of the fetch function.

        Raises:
            MarketDataFetchError: If all attempts fail.
        """
        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                result = await fetch_fn()
                if attempt > 0:
                    logger.info(
                        f"Successfully fetched {description} on attempt "
                        f"{attempt + 1}/{self.max_retries + 1}"
                    )
                return result
            except StaleDataError:
                # Don't retry on stale data - it's a validation issue, not transient
                raise
            except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.ConnectError) as e:
                last_error = e
                logger.warning(
                    f"Attempt {attempt + 1}/{self.max_retries + 1} failed for "
                    f"{description}: {type(e).__name__}: {e}"
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(self.retry_delay)
            except MarketDataFetchError:
                raise
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Attempt {attempt + 1}/{self.max_retries + 1} failed for "
                    f"{description}: {type(e).__name__}: {e}"
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(self.retry_delay)

        raise MarketDataFetchError(
            f"Failed to fetch {description} after {self.max_retries + 1} attempts: "
            f"{last_error}"
        )

    def _validate_ohlcv_candle(self, candle: Dict[str, Any]) -> None:
        """
        Validate a single OHLCV candle for required fields and valid values.

        Args:
            candle: Dictionary with OHLCV data

        Raises:
            MarketDataFetchError: If candle data is invalid.

        Requirements: 4.9 (reject OHLCV candles with null OHLC values)
        """
        required_fields = ["open", "high", "low", "close"]

        for field in required_fields:
            value = candle.get(field)
            if value is None:
                raise MarketDataFetchError(
                    f"OHLCV candle has null {field} value"
                )
            if not isinstance(value, (int, float)):
                raise MarketDataFetchError(
                    f"OHLCV candle has non-numeric {field} value: {value}"
                )
            if value <= 0:
                raise MarketDataFetchError(
                    f"OHLCV candle has non-positive {field} value: {value}"
                )

        # Validate OHLC relationships
        high = candle["high"]
        low = candle["low"]
        if high < low:
            raise MarketDataFetchError(
                f"OHLCV candle has high ({high}) < low ({low})"
            )

    def _filter_options_contracts(
        self,
        contracts_data: List[Dict[str, Any]],
        spot_price: float,
    ) -> List[OptionsContract]:
        """
        Filter and convert raw contract data to OptionsContract objects.

        Filters:
        - Strike price within 10% of spot price
        - Expiry within 30 days
        - Required fields non-null (bid, ask, volume, OI)

        Args:
            contracts_data: Raw contract dictionaries from API
            spot_price: Current spot price for proximity filtering

        Returns:
            List of valid OptionsContract objects.

        Requirements: 4.4, 4.5, 4.9
        """
        strike_range_pct = 0.10  # 10% of spot
        max_expiry_days = 30
        today = date.today()

        lower_strike = spot_price * (1 - strike_range_pct)
        upper_strike = spot_price * (1 + strike_range_pct)

        filtered_contracts: List[OptionsContract] = []

        for contract in contracts_data:
            try:
                # Extract and validate required fields
                strike_price = contract.get("strikePrice") or contract.get("strike_price")
                option_type = contract.get("optionType") or contract.get("option_type")
                expiry_str = contract.get("expiryDate") or contract.get("expiry_date")
                bid = contract.get("bid")
                ask = contract.get("ask")
                ltp = contract.get("ltp") or contract.get("lastPrice", 0)
                volume = contract.get("volume", 0)
                oi = contract.get("openInterest") or contract.get("open_interest", 0)
                iv = contract.get("impliedVolatility") or contract.get("implied_volatility")

                # Skip contracts with null required fields
                if any(v is None for v in [strike_price, option_type, expiry_str, bid, ask]):
                    continue

                # Validate non-null required fields
                strike_price = float(strike_price)
                bid = float(bid)
                ask = float(ask)
                ltp = float(ltp) if ltp else 0.0
                volume = int(volume) if volume else 0
                oi = int(oi) if oi else 0

                # Normalize option type
                if option_type in ("CALL", "CE", "call", "ce"):
                    option_type = "CE"
                elif option_type in ("PUT", "PE", "put", "pe"):
                    option_type = "PE"
                else:
                    continue

                # Parse expiry date
                if isinstance(expiry_str, str):
                    # Try ISO format first, then other formats
                    try:
                        expiry_date = date.fromisoformat(expiry_str[:10])
                    except ValueError:
                        try:
                            expiry_date = datetime.strptime(
                                expiry_str[:10], "%Y-%m-%d"
                            ).date()
                        except ValueError:
                            continue
                elif isinstance(expiry_str, date):
                    expiry_date = expiry_str
                else:
                    continue

                # Filter: Strike within 10% of spot
                if strike_price < lower_strike or strike_price > upper_strike:
                    continue

                # Filter: Expiry within 30 days
                days_to_expiry = (expiry_date - today).days
                if days_to_expiry < 0 or days_to_expiry > max_expiry_days:
                    continue

                # Calculate liquidity metrics
                mid_price = (bid + ask) / 2 if (bid + ask) > 0 else 0.0
                spread = ask - bid if ask >= bid else 0.0
                spread_pct = (spread / mid_price * 100) if mid_price > 0 else 100.0

                # Determine liquidity
                is_liquid = (
                    spread_pct <= 5.0
                    and volume > 0
                    and oi > 100
                    and bid > 0
                    and ask > 0
                    and bid < ask
                )

                # Extract Greeks if available
                delta = contract.get("delta")
                gamma = contract.get("gamma")
                theta = contract.get("theta")
                vega = contract.get("vega")

                options_contract = OptionsContract(
                    strike_price=strike_price,
                    option_type=option_type,
                    expiry_date=expiry_date,
                    bid=bid,
                    ask=ask,
                    ltp=ltp,
                    volume=volume,
                    open_interest=oi,
                    implied_volatility=float(iv) if iv is not None else None,
                    mid_price=mid_price,
                    spread=spread,
                    spread_percentage=round(spread_pct, 2),
                    is_liquid=is_liquid,
                    delta=float(delta) if delta is not None else None,
                    gamma=float(gamma) if gamma is not None else None,
                    theta=float(theta) if theta is not None else None,
                    vega=float(vega) if vega is not None else None,
                )
                filtered_contracts.append(options_contract)

            except (ValueError, TypeError, KeyError) as e:
                logger.debug(f"Skipping invalid contract: {e}")
                continue

        return filtered_contracts

    def _extract_timestamp(self, data: Any) -> Optional[datetime]:
        """
        Extract timestamp from various data formats.

        Args:
            data: Data that may contain a timestamp field

        Returns:
            Parsed datetime or None if no timestamp found.
        """
        if data is None:
            return None

        timestamp_value = None

        if isinstance(data, dict):
            timestamp_value = data.get("timestamp")
        elif hasattr(data, "timestamp"):
            timestamp_value = data.timestamp

        if timestamp_value is None:
            return None

        if isinstance(timestamp_value, datetime):
            return timestamp_value

        if isinstance(timestamp_value, str):
            # Try ISO format parsing
            try:
                return datetime.fromisoformat(
                    timestamp_value.replace("Z", "+00:00")
                )
            except ValueError:
                pass

            # Try common datetime formats
            for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
                try:
                    return datetime.strptime(timestamp_value, fmt)
                except ValueError:
                    continue

        if isinstance(timestamp_value, (int, float)):
            # Assume Unix timestamp
            try:
                return datetime.fromtimestamp(timestamp_value, tz=timezone.utc)
            except (ValueError, OSError):
                pass

        return None
