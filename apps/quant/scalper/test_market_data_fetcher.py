"""
Unit tests for MarketDataFetcher class.

Tests timeout handling, retry logic, data freshness validation,
and null/missing field rejection.

Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10
"""

import asyncio
import pytest
import httpx
from datetime import datetime, timezone, timedelta, date
from unittest.mock import AsyncMock, patch, MagicMock

from scalper.market_data_fetcher import (
    MarketDataFetcher,
    MarketDataFetchError,
    StaleDataError,
)
from scalper.models import OptionsContract


@pytest.fixture
def fetcher():
    """Create a MarketDataFetcher with default settings."""
    return MarketDataFetcher(
        base_url="http://localhost:4000",
        retry_delay=0.01,  # Speed up tests
    )


@pytest.fixture
def fresh_timestamp():
    """Return a timestamp that is within the freshness threshold."""
    return (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()


@pytest.fixture
def stale_timestamp():
    """Return a timestamp that exceeds the freshness threshold."""
    return (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()


# --- validate_data_freshness tests ---


class TestValidateDataFreshness:
    """Tests for data freshness validation."""

    def test_fresh_data_returns_true(self, fetcher, fresh_timestamp):
        """Fresh data (< 2 min old) passes validation."""
        data = {"timestamp": fresh_timestamp}
        assert fetcher.validate_data_freshness(data) is True

    def test_stale_data_raises_error(self, fetcher, stale_timestamp):
        """Stale data (> 2 min old) raises StaleDataError."""
        data = {"timestamp": stale_timestamp}
        with pytest.raises(StaleDataError, match="Data is stale"):
            fetcher.validate_data_freshness(data)

    def test_no_timestamp_returns_true(self, fetcher):
        """Data without timestamp passes validation (skip check)."""
        data = {"price": 21500.0}
        assert fetcher.validate_data_freshness(data) is True

    def test_none_data_returns_true(self, fetcher):
        """None data passes validation."""
        assert fetcher.validate_data_freshness(None) is True

    def test_datetime_object_fresh(self, fetcher):
        """Datetime object within threshold passes."""
        now = datetime.now(timezone.utc) - timedelta(seconds=10)
        data = {"timestamp": now}
        assert fetcher.validate_data_freshness(data) is True

    def test_datetime_object_stale(self, fetcher):
        """Datetime object beyond threshold fails."""
        old = datetime.now(timezone.utc) - timedelta(minutes=3)
        data = {"timestamp": old}
        with pytest.raises(StaleDataError):
            fetcher.validate_data_freshness(data)

    def test_unix_timestamp_fresh(self, fetcher):
        """Unix timestamp within threshold passes."""
        now_unix = datetime.now(timezone.utc).timestamp() - 30
        data = {"timestamp": now_unix}
        assert fetcher.validate_data_freshness(data) is True

    def test_unix_timestamp_stale(self, fetcher):
        """Unix timestamp beyond threshold fails."""
        old_unix = datetime.now(timezone.utc).timestamp() - 300
        data = {"timestamp": old_unix}
        with pytest.raises(StaleDataError):
            fetcher.validate_data_freshness(data)

    def test_boundary_exactly_2_minutes(self, fetcher):
        """Data just under 2-minute boundary is still valid."""
        # Slightly under threshold to account for comparison being strict >
        boundary = datetime.now(timezone.utc) - timedelta(minutes=1, seconds=59)
        data = {"timestamp": boundary}
        assert fetcher.validate_data_freshness(data) is True

    def test_just_over_2_minutes(self, fetcher):
        """Data just over 2 minutes old is stale."""
        just_over = datetime.now(timezone.utc) - timedelta(minutes=2, seconds=1)
        data = {"timestamp": just_over}
        with pytest.raises(StaleDataError):
            fetcher.validate_data_freshness(data)


# --- OHLCV candle validation tests ---


class TestOHLCVValidation:
    """Tests for OHLCV candle validation."""

    def test_valid_candle_passes(self, fetcher):
        """Valid OHLCV candle passes validation."""
        candle = {
            "timestamp": "2024-01-15T09:15:00Z",
            "open": 21500.0,
            "high": 21550.0,
            "low": 21480.0,
            "close": 21520.0,
            "volume": 100000,
        }
        # Should not raise
        fetcher._validate_ohlcv_candle(candle)

    def test_null_open_rejected(self, fetcher):
        """Candle with null open is rejected."""
        candle = {"open": None, "high": 100, "low": 90, "close": 95}
        with pytest.raises(MarketDataFetchError, match="null open"):
            fetcher._validate_ohlcv_candle(candle)

    def test_null_high_rejected(self, fetcher):
        """Candle with null high is rejected."""
        candle = {"open": 100, "high": None, "low": 90, "close": 95}
        with pytest.raises(MarketDataFetchError, match="null high"):
            fetcher._validate_ohlcv_candle(candle)

    def test_null_low_rejected(self, fetcher):
        """Candle with null low is rejected."""
        candle = {"open": 100, "high": 110, "low": None, "close": 95}
        with pytest.raises(MarketDataFetchError, match="null low"):
            fetcher._validate_ohlcv_candle(candle)

    def test_null_close_rejected(self, fetcher):
        """Candle with null close is rejected."""
        candle = {"open": 100, "high": 110, "low": 90, "close": None}
        with pytest.raises(MarketDataFetchError, match="null close"):
            fetcher._validate_ohlcv_candle(candle)

    def test_zero_price_rejected(self, fetcher):
        """Candle with zero price is rejected."""
        candle = {"open": 0, "high": 110, "low": 90, "close": 95}
        with pytest.raises(MarketDataFetchError, match="non-positive open"):
            fetcher._validate_ohlcv_candle(candle)

    def test_negative_price_rejected(self, fetcher):
        """Candle with negative price is rejected."""
        candle = {"open": -10, "high": 110, "low": 90, "close": 95}
        with pytest.raises(MarketDataFetchError, match="non-positive open"):
            fetcher._validate_ohlcv_candle(candle)

    def test_non_numeric_rejected(self, fetcher):
        """Candle with non-numeric values is rejected."""
        candle = {"open": "abc", "high": 110, "low": 90, "close": 95}
        with pytest.raises(MarketDataFetchError, match="non-numeric open"):
            fetcher._validate_ohlcv_candle(candle)

    def test_high_less_than_low_rejected(self, fetcher):
        """Candle with high < low is rejected."""
        candle = {"open": 100, "high": 80, "low": 90, "close": 85}
        with pytest.raises(MarketDataFetchError, match="high.*< low"):
            fetcher._validate_ohlcv_candle(candle)


# --- Options chain filtering tests ---


class TestOptionsChainFiltering:
    """Tests for options chain filtering logic."""

    def test_filters_by_strike_proximity(self, fetcher):
        """Contracts outside 10% of spot are filtered out."""
        spot_price = 21500.0
        contracts = [
            {
                "strikePrice": 21500.0,  # ATM - within 10%
                "optionType": "CE",
                "expiryDate": (date.today() + timedelta(days=7)).isoformat(),
                "bid": 100.0,
                "ask": 102.0,
                "ltp": 101.0,
                "volume": 5000,
                "openInterest": 10000,
                "impliedVolatility": 0.15,
            },
            {
                "strikePrice": 25000.0,  # Far OTM - outside 10%
                "optionType": "CE",
                "expiryDate": (date.today() + timedelta(days=7)).isoformat(),
                "bid": 1.0,
                "ask": 2.0,
                "ltp": 1.5,
                "volume": 100,
                "openInterest": 500,
                "impliedVolatility": 0.30,
            },
        ]
        result = fetcher._filter_options_contracts(contracts, spot_price)
        assert len(result) == 1
        assert result[0].strike_price == 21500.0

    def test_filters_by_expiry(self, fetcher):
        """Contracts beyond 30 days to expiry are filtered out."""
        spot_price = 21500.0
        contracts = [
            {
                "strikePrice": 21500.0,
                "optionType": "CE",
                "expiryDate": (date.today() + timedelta(days=7)).isoformat(),
                "bid": 100.0,
                "ask": 102.0,
                "ltp": 101.0,
                "volume": 5000,
                "openInterest": 10000,
                "impliedVolatility": 0.15,
            },
            {
                "strikePrice": 21500.0,
                "optionType": "CE",
                "expiryDate": (date.today() + timedelta(days=45)).isoformat(),
                "bid": 200.0,
                "ask": 205.0,
                "ltp": 202.0,
                "volume": 2000,
                "openInterest": 5000,
                "impliedVolatility": 0.18,
            },
        ]
        result = fetcher._filter_options_contracts(contracts, spot_price)
        assert len(result) == 1
        assert result[0].expiry_date == date.today() + timedelta(days=7)

    def test_skips_contracts_with_null_bid(self, fetcher):
        """Contracts with null bid are skipped."""
        spot_price = 21500.0
        contracts = [
            {
                "strikePrice": 21500.0,
                "optionType": "CE",
                "expiryDate": (date.today() + timedelta(days=7)).isoformat(),
                "bid": None,
                "ask": 102.0,
                "ltp": 101.0,
                "volume": 5000,
                "openInterest": 10000,
            },
        ]
        result = fetcher._filter_options_contracts(contracts, spot_price)
        assert len(result) == 0

    def test_skips_contracts_with_null_ask(self, fetcher):
        """Contracts with null ask are skipped."""
        spot_price = 21500.0
        contracts = [
            {
                "strikePrice": 21500.0,
                "optionType": "CE",
                "expiryDate": (date.today() + timedelta(days=7)).isoformat(),
                "bid": 100.0,
                "ask": None,
                "ltp": 101.0,
                "volume": 5000,
                "openInterest": 10000,
            },
        ]
        result = fetcher._filter_options_contracts(contracts, spot_price)
        assert len(result) == 0

    def test_calculates_liquidity_metrics(self, fetcher):
        """Liquidity metrics are correctly calculated."""
        spot_price = 21500.0
        contracts = [
            {
                "strikePrice": 21500.0,
                "optionType": "CE",
                "expiryDate": (date.today() + timedelta(days=7)).isoformat(),
                "bid": 98.0,
                "ask": 102.0,
                "ltp": 100.0,
                "volume": 5000,
                "openInterest": 10000,
                "impliedVolatility": 0.15,
            },
        ]
        result = fetcher._filter_options_contracts(contracts, spot_price)
        assert len(result) == 1
        contract = result[0]
        assert contract.mid_price == 100.0
        assert contract.spread == 4.0
        assert contract.spread_percentage == 4.0
        assert contract.is_liquid is True

    def test_marks_illiquid_wide_spread(self, fetcher):
        """Contract with spread > 5% is marked illiquid."""
        spot_price = 21500.0
        contracts = [
            {
                "strikePrice": 21500.0,
                "optionType": "CE",
                "expiryDate": (date.today() + timedelta(days=7)).isoformat(),
                "bid": 90.0,
                "ask": 110.0,
                "ltp": 100.0,
                "volume": 5000,
                "openInterest": 10000,
            },
        ]
        result = fetcher._filter_options_contracts(contracts, spot_price)
        assert len(result) == 1
        # spread=20, mid=100, spread_pct=20% > 5%
        assert result[0].is_liquid is False

    def test_normalizes_option_types(self, fetcher):
        """Option types CALL/PUT are normalized to CE/PE."""
        spot_price = 21500.0
        contracts = [
            {
                "strikePrice": 21500.0,
                "optionType": "CALL",
                "expiryDate": (date.today() + timedelta(days=7)).isoformat(),
                "bid": 100.0,
                "ask": 102.0,
                "ltp": 101.0,
                "volume": 5000,
                "openInterest": 10000,
            },
            {
                "strikePrice": 21500.0,
                "optionType": "PUT",
                "expiryDate": (date.today() + timedelta(days=7)).isoformat(),
                "bid": 95.0,
                "ask": 97.0,
                "ltp": 96.0,
                "volume": 4000,
                "openInterest": 8000,
            },
        ]
        result = fetcher._filter_options_contracts(contracts, spot_price)
        assert len(result) == 2
        assert result[0].option_type == "CE"
        assert result[1].option_type == "PE"


# --- Retry logic tests ---


class TestRetryLogic:
    """Tests for retry mechanism."""

    @pytest.mark.asyncio
    async def test_succeeds_on_first_attempt(self, fetcher):
        """Fetch succeeds on first try without retries."""
        call_count = 0

        async def mock_fetch():
            nonlocal call_count
            call_count += 1
            return {"success": True}

        result = await fetcher._fetch_with_retry(mock_fetch, "test")
        assert result == {"success": True}
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_retries_on_timeout(self, fetcher):
        """Fetch retries on timeout error and succeeds on second attempt."""
        call_count = 0

        async def mock_fetch():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise httpx.TimeoutException("timeout")
            return {"success": True}

        result = await fetcher._fetch_with_retry(mock_fetch, "test")
        assert result == {"success": True}
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_retries_up_to_max(self, fetcher):
        """Fetch retries up to max_retries times then raises error."""
        call_count = 0

        async def mock_fetch():
            nonlocal call_count
            call_count += 1
            raise httpx.ConnectError("connection failed")

        with pytest.raises(MarketDataFetchError, match="Failed to fetch"):
            await fetcher._fetch_with_retry(mock_fetch, "test data")

        # 1 initial + 2 retries = 3 total
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_no_retry_on_stale_data(self, fetcher):
        """StaleDataError is not retried - it's raised immediately."""
        call_count = 0

        async def mock_fetch():
            nonlocal call_count
            call_count += 1
            raise StaleDataError("Data is stale")

        with pytest.raises(StaleDataError):
            await fetcher._fetch_with_retry(mock_fetch, "test")

        assert call_count == 1  # No retry

    @pytest.mark.asyncio
    async def test_retries_on_http_error(self, fetcher):
        """Fetch retries on HTTP status errors."""
        call_count = 0

        async def mock_fetch():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                response = httpx.Response(
                    status_code=500,
                    request=httpx.Request("GET", "http://test"),
                )
                raise httpx.HTTPStatusError(
                    "Internal Server Error",
                    request=httpx.Request("GET", "http://test"),
                    response=response,
                )
            return {"success": True}

        result = await fetcher._fetch_with_retry(mock_fetch, "test")
        assert result == {"success": True}
        assert call_count == 3


# --- Timeout handling tests ---


class TestTimeoutHandling:
    """Tests for timeout behavior."""

    @pytest.mark.asyncio
    async def test_api_call_timeout_default(self):
        """Default API call timeout is 5 seconds."""
        fetcher = MarketDataFetcher()
        assert fetcher.api_call_timeout == 5.0

    @pytest.mark.asyncio
    async def test_total_fetch_timeout_default(self):
        """Default total fetch timeout is 10 seconds."""
        fetcher = MarketDataFetcher()
        assert fetcher.total_fetch_timeout == 10.0

    @pytest.mark.asyncio
    async def test_custom_timeout_values(self):
        """Custom timeout values are respected."""
        fetcher = MarketDataFetcher(
            api_call_timeout=3.0,
            total_fetch_timeout=8.0,
        )
        assert fetcher.api_call_timeout == 3.0
        assert fetcher.total_fetch_timeout == 8.0

    @pytest.mark.asyncio
    async def test_fetch_all_total_timeout(self):
        """fetch_all raises error if total timeout exceeded."""
        fetcher = MarketDataFetcher(
            total_fetch_timeout=0.1,  # Very short timeout
            retry_delay=0.01,
        )

        # Mock fetch_spot_prices to take too long
        async def slow_fetch():
            await asyncio.sleep(1.0)
            return {"NIFTY": 21500.0, "BANKNIFTY": 45000.0}

        with patch.object(fetcher, "fetch_spot_prices", side_effect=slow_fetch):
            with pytest.raises(MarketDataFetchError, match="timeout exceeded"):
                await fetcher.fetch_all("NIFTY")


# --- fetch_spot_prices tests ---


class TestFetchSpotPrices:
    """Tests for spot price fetching."""

    @pytest.mark.asyncio
    async def test_unsupported_symbol_in_fetch_ohlcv(self, fetcher):
        """Unsupported symbol raises ValueError."""
        with pytest.raises(ValueError, match="Unsupported symbol"):
            await fetcher.fetch_ohlcv_data("INVALID", "1m", 100)

    @pytest.mark.asyncio
    async def test_unsupported_symbol_in_fetch_options(self, fetcher):
        """Unsupported symbol raises ValueError."""
        with pytest.raises(ValueError, match="Unsupported symbol"):
            await fetcher.fetch_options_chain("INVALID", 21500.0)

    @pytest.mark.asyncio
    async def test_invalid_spot_price_in_fetch_options(self, fetcher):
        """Non-positive spot price raises ValueError."""
        with pytest.raises(ValueError, match="Invalid spot price"):
            await fetcher.fetch_options_chain("NIFTY", -100.0)

    @pytest.mark.asyncio
    async def test_zero_spot_price_in_fetch_options(self, fetcher):
        """Zero spot price raises ValueError."""
        with pytest.raises(ValueError, match="Invalid spot price"):
            await fetcher.fetch_options_chain("NIFTY", 0)


# --- fetch_all integration tests ---


class TestFetchAll:
    """Tests for the complete fetch_all workflow."""

    @pytest.mark.asyncio
    async def test_unsupported_underlying(self, fetcher):
        """Unsupported underlying raises ValueError."""
        with pytest.raises(ValueError, match="Unsupported underlying"):
            await fetcher.fetch_all("SENSEX")

    @pytest.mark.asyncio
    async def test_returns_market_data_package(self):
        """fetch_all returns a complete MarketDataPackage."""
        fetcher = MarketDataFetcher(retry_delay=0.01)

        mock_spot = {"NIFTY": 21500.0, "BANKNIFTY": 45000.0}
        mock_ohlcv = [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "open": 21500.0,
                "high": 21550.0,
                "low": 21480.0,
                "close": 21520.0,
                "volume": 100000,
            }
        ]
        mock_contracts = [
            OptionsContract(
                strike_price=21500.0,
                option_type="CE",
                expiry_date=date.today() + timedelta(days=7),
                bid=98.0,
                ask=102.0,
                ltp=100.0,
                volume=5000,
                open_interest=10000,
                implied_volatility=0.15,
                mid_price=100.0,
                spread=4.0,
                spread_percentage=4.0,
                is_liquid=True,
            )
        ]

        with patch.object(
            fetcher, "fetch_spot_prices", return_value=mock_spot
        ), patch.object(
            fetcher, "fetch_ohlcv_data", return_value=mock_ohlcv
        ), patch.object(
            fetcher, "fetch_options_chain", return_value=mock_contracts
        ):
            result = await fetcher.fetch_all("NIFTY")

        assert result.underlying == "NIFTY"
        assert result.spot_price == 21500.0
        assert len(result.ohlcv_data) == 1
        assert len(result.options_chain) == 1
        assert result.previous_analysis is None
