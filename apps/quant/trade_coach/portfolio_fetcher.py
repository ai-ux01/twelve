"""
Portfolio Fetcher Module.

Fetches live portfolio data (positions, holdings, trades) from the
Kotak Neo BFF proxy layer. Handles session validation, error propagation,
and connection retries.

Portfolio Trade Coaching Feature
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class PortfolioFetchError(Exception):
    """Base error for portfolio fetch failures."""

    def __init__(self, message: str, status_code: int | None = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class SessionError(PortfolioFetchError):
    """Raised when the Kotak Neo session is missing, expired, or invalid."""
    pass


class BFFError(PortfolioFetchError):
    """Raised when the BFF returns a server error (5xx)."""
    pass


class ConnectionError(PortfolioFetchError):
    """Raised when the BFF is unreachable after retry."""
    pass


class PortfolioFetcher:
    """Fetches live portfolio data from the Kotak Neo BFF proxy.

    Makes HTTP requests to the NestJS BFF endpoints and returns raw JSON
    responses. Implements session validation, error handling, and single
    retry on connection failures.
    """

    def __init__(self, bff_base_url: str = "http://localhost:4000/api/kotak-neo"):
        self.bff_base_url = bff_base_url.rstrip("/")

    async def fetch_positions(self, session_id: str) -> dict:
        """Fetch open positions from the Kotak Neo BFF.

        GET /reports/positions with X-Session-Id header.

        Args:
            session_id: Active Kotak Neo session identifier.

        Returns:
            Raw JSON response from the BFF positions endpoint.

        Raises:
            SessionError: If session_id is missing/empty or BFF returns 401/403.
            BFFError: If BFF returns a 5xx server error.
            ConnectionError: If BFF is unreachable after retry.
        """
        self._validate_session_id(session_id)
        return await self._make_request("/reports/positions", session_id)

    async def fetch_holdings(self, session_id: str) -> dict:
        """Fetch holdings from the Kotak Neo BFF.

        GET /reports/holdings with X-Session-Id header.

        Args:
            session_id: Active Kotak Neo session identifier.

        Returns:
            Raw JSON response from the BFF holdings endpoint.

        Raises:
            SessionError: If session_id is missing/empty or BFF returns 401/403.
            BFFError: If BFF returns a 5xx server error.
            ConnectionError: If BFF is unreachable after retry.
        """
        self._validate_session_id(session_id)
        return await self._make_request("/reports/holdings", session_id)

    async def fetch_trades(self, session_id: str) -> dict:
        """Fetch completed trades from the Kotak Neo BFF.

        GET /reports/trades with X-Session-Id header.

        Args:
            session_id: Active Kotak Neo session identifier.

        Returns:
            Raw JSON response from the BFF trades endpoint.

        Raises:
            SessionError: If session_id is missing/empty or BFF returns 401/403.
            BFFError: If BFF returns a 5xx server error.
            ConnectionError: If BFF is unreachable after retry.
        """
        self._validate_session_id(session_id)
        return await self._make_request("/reports/trades", session_id)

    async def validate_session(self, session_id: str) -> bool:
        """Validate that a Kotak Neo session is active.

        GET /status with X-Session-Id header.

        Args:
            session_id: Kotak Neo session identifier to validate.

        Returns:
            True if the session is active, False otherwise.
        """
        self._validate_session_id(session_id)
        try:
            await self._make_request("/status", session_id)
            return True
        except SessionError:
            return False
        except (BFFError, ConnectionError):
            return False

    def _validate_session_id(self, session_id: str) -> None:
        """Validate that a session_id is provided and non-empty.

        Args:
            session_id: Value to validate.

        Raises:
            SessionError: If session_id is None, empty, or whitespace-only.
        """
        if not session_id or not session_id.strip():
            raise SessionError(
                "Session ID is required. Please authenticate with Kotak Neo first."
            )

    async def _make_request(
        self, path: str, session_id: str, *, _retry: bool = True
    ) -> dict[str, Any]:
        """Make an HTTP GET request to the BFF with retry logic.

        Args:
            path: Endpoint path (e.g., "/reports/positions").
            session_id: Session ID for the X-Session-Id header.
            _retry: Whether to retry on connection error (used internally).

        Returns:
            Parsed JSON response as a dict.

        Raises:
            SessionError: If BFF returns 401 or 403.
            BFFError: If BFF returns a 5xx status code.
            ConnectionError: If BFF is unreachable after retry.
            PortfolioFetchError: For other HTTP errors.
        """
        url = f"{self.bff_base_url}{path}"
        headers = {"X-Session-Id": session_id}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)

            if response.status_code == 401 or response.status_code == 403:
                raise SessionError(
                    "Kotak Neo session expired or invalid. Please log in again.",
                    status_code=response.status_code,
                )

            if 500 <= response.status_code < 600:
                raise BFFError(
                    f"Trading API error ({response.status_code}). Please try again later.",
                    status_code=response.status_code,
                )

            if response.status_code >= 400:
                raise PortfolioFetchError(
                    f"BFF request failed with status {response.status_code}: "
                    f"{response.text}",
                    status_code=response.status_code,
                )

            return response.json()

        except httpx.TimeoutException:
            raise ConnectionError(
                "Trading API timeout. Please try again."
            )
        except httpx.ConnectError:
            if _retry:
                logger.warning(
                    "Connection to BFF failed for %s, retrying once...", url
                )
                return await self._make_request(path, session_id, _retry=False)
            raise ConnectionError(
                "Cannot reach trading API. Please try again."
            )
        except (SessionError, BFFError, PortfolioFetchError, ConnectionError):
            # Re-raise our own errors without wrapping
            raise
        except httpx.HTTPError as exc:
            if _retry:
                logger.warning(
                    "HTTP error for %s: %s, retrying once...", url, str(exc)
                )
                return await self._make_request(path, session_id, _retry=False)
            raise ConnectionError(
                f"Cannot reach trading API: {exc}. Please try again."
            )
