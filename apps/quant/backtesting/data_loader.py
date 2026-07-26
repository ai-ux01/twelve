"""
Backtesting Engine Data Loader.

Loads OHLCV data from JSON files or HTTP API into numpy arrays.
Validates data integrity: chronological order, no NaN, minimum bar count.
Validates that requested date ranges fall within the 2-year historical data window.
No pandas dependency.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Minimum number of bars required for meaningful backtest
MIN_BAR_COUNT = 30

# Maximum historical data retention window in years.
# The NestJS HistoricalDataService enforces this — this is a lightweight
# client-side validation to give users early feedback.
MAX_RETENTION_YEARS = 2


@dataclass
class OHLCVData:
    """OHLCV data stored as numpy arrays for performance."""
    timestamps: np.ndarray  # float64 (unix timestamps)
    opens: np.ndarray       # float64
    highs: np.ndarray       # float64
    lows: np.ndarray        # float64
    closes: np.ndarray      # float64
    volumes: np.ndarray     # float64

    @property
    def bar_count(self) -> int:
        """Number of bars in the dataset."""
        return len(self.closes)


class DataLoadError(Exception):
    """Raised when data loading or validation fails."""
    pass


class DataLoader:
    """
    Loads and validates OHLCV data from JSON files or HTTP APIs.

    Stores data in numpy arrays for efficient access during backtesting.
    Validates chronological order, no NaN/None values, and minimum bar count.
    """

    def __init__(self, min_bars: int = MIN_BAR_COUNT):
        """
        Initialize DataLoader.

        Args:
            min_bars: Minimum number of bars required.
        """
        self.min_bars = min_bars

    def load_from_json(self, file_path: str) -> OHLCVData:
        """
        Load OHLCV data from a JSON file.

        Expected JSON format:
        [
            {"timestamp": 1700000000, "open": 100.0, "high": 105.0,
             "low": 99.0, "close": 103.0, "volume": 10000},
            ...
        ]

        Args:
            file_path: Path to the JSON file.

        Returns:
            OHLCVData with numpy arrays.

        Raises:
            DataLoadError: If file cannot be read or data is invalid.
        """
        try:
            with open(file_path, "r") as f:
                raw_data = json.load(f)
        except FileNotFoundError:
            raise DataLoadError(f"File not found: {file_path}")
        except json.JSONDecodeError as e:
            raise DataLoadError(f"Invalid JSON in file {file_path}: {e}")

        return self._parse_ohlcv_list(raw_data)

    def load_from_api(self, url: str) -> OHLCVData:
        """
        Load OHLCV data from an HTTP API endpoint.

        Args:
            url: API URL that returns JSON array of OHLCV bars.

        Returns:
            OHLCVData with numpy arrays.

        Raises:
            DataLoadError: If API request fails or data is invalid.
        """
        try:
            import httpx
            response = httpx.get(url, timeout=30.0)
            response.raise_for_status()
            raw_data = response.json()
        except ImportError:
            # Fallback to urllib if httpx not available
            import urllib.request
            try:
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    raw_data = json.loads(resp.read().decode("utf-8"))
            except Exception as e:
                raise DataLoadError(f"Failed to fetch data from API {url}: {e}")
        except Exception as e:
            raise DataLoadError(f"Failed to fetch data from API {url}: {e}")

        return self._parse_ohlcv_list(raw_data)

    def load(self, file_path: Optional[str] = None, api_url: Optional[str] = None, symbol: Optional[str] = None, timeframe: str = "day", start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> OHLCVData:
        """
        Load OHLCV data from either a file path, API URL, or MongoDB.

        Args:
            file_path: Path to JSON file (preferred if both provided).
            api_url: API URL to fetch data from.
            symbol: Trading symbol for MongoDB lookup (e.g., 'RELIANCE').
            timeframe: Candle timeframe for MongoDB lookup (default: 'day').
            start_date: Optional start date for range validation.
            end_date: Optional end date for range validation.

        Returns:
            OHLCVData with numpy arrays.

        Raises:
            DataLoadError: If no source provided, loading fails, or date range
                exceeds the 2-year historical data window.
        """
        if file_path:
            return self.load_from_json(file_path)
        elif api_url:
            return self.load_from_api(api_url)
        elif symbol:
            # Validate that the requested date range doesn't exceed 2 years.
            # The actual enforcement is in the NestJS HistoricalDataService;
            # this is a lightweight early check for user feedback.
            if start_date is not None:
                self.validate_date_range(start_date)
            return self.load_from_mongodb(symbol, timeframe)
        else:
            raise DataLoadError("No data source provided. Specify file_path, api_url, or symbol.")

    def validate_date_range(self, start_date: datetime) -> None:
        """
        Validate that the requested start date is within the 2-year retention window.

        Historical data is available for a maximum of 2 years from today.
        The actual enforcement is in the NestJS HistoricalDataService — this
        provides early validation for a better user experience.

        Args:
            start_date: The requested backtest start date.

        Raises:
            DataLoadError: If start_date is older than 2 years ago.

        Requirements: 8.1, 8.2, 8.3
        """
        now = datetime.now(timezone.utc)
        # Ensure start_date is timezone-aware for comparison
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)

        retention_boundary = now - timedelta(days=MAX_RETENTION_YEARS * 365)

        if start_date < retention_boundary:
            earliest = retention_boundary.strftime("%Y-%m-%d")
            raise DataLoadError(
                f"Historical data is available for a maximum of 2 years. "
                f"Earliest available: {earliest}"
            )

    def load_from_mongodb(self, symbol: str, timeframe: str = "day") -> OHLCVData:
        """
        Load OHLCV data from MongoDB candles collection.

        Args:
            symbol: Trading symbol (e.g., 'RELIANCE').
            timeframe: Candle timeframe ('day', '60minute').

        Returns:
            OHLCVData with numpy arrays.

        Raises:
            DataLoadError: If data cannot be loaded from MongoDB.
        """
        try:
            from market_data.mongo_provider import MongoMarketDataProvider

            provider = MongoMarketDataProvider()
            if not provider.connect():
                raise DataLoadError("Failed to connect to MongoDB")

            candles = provider.get_ohlcv(symbol=symbol, timeframe=timeframe, limit=1000)
            provider.close()

            if not candles:
                raise DataLoadError(f"No data found in MongoDB for {symbol}/{timeframe}")

            return self._parse_ohlcv_list(candles)
        except DataLoadError:
            raise
        except Exception as e:
            raise DataLoadError(f"MongoDB data load failed for {symbol}: {e}")

    def _parse_ohlcv_list(self, raw_data: list) -> OHLCVData:
        """
        Parse a list of OHLCV dictionaries into numpy arrays with validation.

        Args:
            raw_data: List of dicts with timestamp, open, high, low, close, volume.

        Returns:
            Validated OHLCVData.

        Raises:
            DataLoadError: If data fails validation.
        """
        if not isinstance(raw_data, list):
            raise DataLoadError("OHLCV data must be a JSON array")

        if len(raw_data) < self.min_bars:
            raise DataLoadError(
                f"Insufficient data: need at least {self.min_bars} bars, "
                f"got {len(raw_data)}"
            )

        required_fields = {"timestamp", "open", "high", "low", "close", "volume"}

        timestamps = []
        opens = []
        highs = []
        lows = []
        closes = []
        volumes = []

        for i, bar in enumerate(raw_data):
            if not isinstance(bar, dict):
                raise DataLoadError(f"Bar at index {i} is not a dictionary")

            missing = required_fields - set(bar.keys())
            if missing:
                raise DataLoadError(
                    f"Bar at index {i} missing fields: {missing}"
                )

            try:
                ts = float(bar["timestamp"])
                o = float(bar["open"])
                h = float(bar["high"])
                l = float(bar["low"])
                c = float(bar["close"])
                v = float(bar["volume"])
            except (TypeError, ValueError) as e:
                raise DataLoadError(f"Invalid numeric value at bar index {i}: {e}")

            timestamps.append(ts)
            opens.append(o)
            highs.append(h)
            lows.append(l)
            closes.append(c)
            volumes.append(v)

        # Convert to numpy arrays
        data = OHLCVData(
            timestamps=np.array(timestamps, dtype=np.float64),
            opens=np.array(opens, dtype=np.float64),
            highs=np.array(highs, dtype=np.float64),
            lows=np.array(lows, dtype=np.float64),
            closes=np.array(closes, dtype=np.float64),
            volumes=np.array(volumes, dtype=np.float64),
        )

        # Validate
        self._validate(data)

        return data

    def _validate(self, data: OHLCVData) -> None:
        """
        Validate OHLCV data integrity.

        Checks:
        - Chronological timestamp order
        - No NaN or Inf values
        - Minimum bar count
        - High >= Low for every bar

        Raises:
            DataLoadError: If validation fails.
        """
        # Check minimum bar count
        if data.bar_count < self.min_bars:
            raise DataLoadError(
                f"Insufficient data: need at least {self.min_bars} bars, "
                f"got {data.bar_count}"
            )

        # Check for NaN or Inf
        arrays = [data.timestamps, data.opens, data.highs, data.lows, data.closes, data.volumes]
        names = ["timestamps", "opens", "highs", "lows", "closes", "volumes"]
        for arr, name in zip(arrays, names):
            if np.any(np.isnan(arr)):
                raise DataLoadError(f"NaN values found in {name}")
            if np.any(np.isinf(arr)):
                raise DataLoadError(f"Inf values found in {name}")

        # Check chronological order
        if not np.all(np.diff(data.timestamps) >= 0):
            raise DataLoadError("Timestamps are not in chronological order")

        # Check high >= low
        if not np.all(data.highs >= data.lows):
            raise DataLoadError("Found bars where high < low")
