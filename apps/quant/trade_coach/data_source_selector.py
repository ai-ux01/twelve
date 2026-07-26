"""
Data Source Selector Module.

Orchestrates data retrieval based on the selected source mode (paper, live,
or combined). Handles graceful degradation when sessions expire mid-fetch.

Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.4
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional

from trade_analysis.models import TradeRecord
from trade_analysis.repository import TradeRepository

from .portfolio_fetcher import PortfolioFetcher, SessionError
from .trade_normalizer import TradeNormalizer

logger = logging.getLogger(__name__)


@dataclass
class DataSourceResult:
    """Result of data source selection and retrieval.

    Attributes:
        trades: List of TradeRecord objects from the selected source(s).
        source: The source mode used ("paper", "live", or "combined").
        live_fetch_errors: List of error messages from failed live fetches.
        partial: True if session expired mid-fetch and only partial data is available.
    """

    trades: List[TradeRecord]
    source: str
    live_fetch_errors: List[str] = field(default_factory=list)
    partial: bool = False


class DataSourceSelector:
    """Selects and merges trade data from paper and/or live sources.

    Orchestrates data retrieval based on the selected source mode:
    - "paper": fetches from TradeRepository only
    - "live": fetches from PortfolioFetcher, normalizes with TradeNormalizer
    - "combined": fetches from both, merges into a single list

    Handles session expiry mid-fetch by returning partial results with
    error information rather than failing completely.
    """

    def __init__(
        self,
        repository: TradeRepository,
        fetcher: PortfolioFetcher,
        normalizer: TradeNormalizer,
    ):
        """Initialize DataSourceSelector with its dependencies.

        Args:
            repository: TradeRepository for paper trade data.
            fetcher: PortfolioFetcher for live portfolio data from Kotak Neo BFF.
            normalizer: TradeNormalizer to convert raw API responses to TradeRecords.
        """
        self.repository = repository
        self.fetcher = fetcher
        self.normalizer = normalizer

    async def get_trades(
        self,
        user_id: str,
        source: str,
        session_id: Optional[str] = None,
    ) -> DataSourceResult:
        """Retrieve trades based on source mode.

        Args:
            user_id: User identifier for fetching paper trades.
            source: Source mode - "paper", "live", or "combined".
            session_id: Kotak Neo session ID, required for "live" and "combined" modes.

        Returns:
            DataSourceResult with trades list and metadata.
        """
        if source == "paper":
            return await self._get_paper_trades(user_id)
        elif source == "live":
            return await self._get_live_trades(session_id)
        elif source == "combined":
            return await self._get_combined_trades(user_id, session_id)
        else:
            # Default to paper for unknown source modes
            logger.warning("Unknown source mode '%s', defaulting to paper", source)
            return await self._get_paper_trades(user_id)

    def resolve_default_source(
        self,
        session_id: Optional[str],
        has_paper_trades: bool,
    ) -> str:
        """Determine the default source mode based on available data.

        Returns "combined" when both an active session exists AND paper trades
        are present. Returns "paper" otherwise.

        Args:
            session_id: Kotak Neo session ID (None or empty means no session).
            has_paper_trades: Whether the user has paper trades in the repository.

        Returns:
            Default source mode string: "combined" or "paper".
        """
        session_valid = bool(session_id and session_id.strip())
        if session_valid and has_paper_trades:
            return "combined"
        return "paper"

    async def _get_paper_trades(self, user_id: str) -> DataSourceResult:
        """Fetch trades from the TradeRepository only.

        Args:
            user_id: User identifier.

        Returns:
            DataSourceResult with paper trades.
        """
        trades = self.repository.get_trades(user_id)
        return DataSourceResult(trades=trades, source="paper")

    async def _get_live_trades(
        self, session_id: Optional[str]
    ) -> DataSourceResult:
        """Fetch trades from PortfolioFetcher and normalize them.

        Fetches positions, holdings, and trades from the Kotak Neo BFF,
        normalizes each response, and merges into a single trade list.

        Handles session expiry mid-fetch by returning whatever was
        successfully fetched with partial=True.

        Args:
            session_id: Kotak Neo session ID.

        Returns:
            DataSourceResult with live trades and any fetch errors.
        """
        all_trades: List[TradeRecord] = []
        errors: List[str] = []
        partial = False

        # Fetch positions
        try:
            raw_positions = await self.fetcher.fetch_positions(session_id)
            positions_data = self._extract_data_list(raw_positions)
            normalized_positions = self.normalizer.normalize_positions(positions_data)
            all_trades.extend(normalized_positions)
        except SessionError as e:
            errors.append(f"Positions fetch failed: {e.message}")
            partial = True
        except Exception as e:
            errors.append(f"Positions fetch failed: {str(e)}")
            partial = True

        # Fetch holdings
        try:
            raw_holdings = await self.fetcher.fetch_holdings(session_id)
            holdings_data = self._extract_data_list(raw_holdings)
            normalized_holdings = self.normalizer.normalize_holdings(holdings_data)
            all_trades.extend(normalized_holdings)
        except SessionError as e:
            errors.append(f"Holdings fetch failed: {e.message}")
            partial = True
        except Exception as e:
            errors.append(f"Holdings fetch failed: {str(e)}")
            partial = True

        # Fetch trades
        try:
            raw_trades = await self.fetcher.fetch_trades(session_id)
            trades_data = self._extract_data_list(raw_trades)
            normalized_trades = self.normalizer.normalize_trades(trades_data)
            all_trades.extend(normalized_trades)
        except SessionError as e:
            errors.append(f"Trades fetch failed: {e.message}")
            partial = True
        except Exception as e:
            errors.append(f"Trades fetch failed: {str(e)}")
            partial = True

        return DataSourceResult(
            trades=all_trades,
            source="live",
            live_fetch_errors=errors,
            partial=partial,
        )

    async def _get_combined_trades(
        self, user_id: str, session_id: Optional[str]
    ) -> DataSourceResult:
        """Fetch from both paper and live sources and merge.

        Paper trades are always fetched successfully. Live trades are fetched
        with graceful degradation — if the session expires, paper trades are
        still returned with partial=True.

        Args:
            user_id: User identifier for paper trades.
            session_id: Kotak Neo session ID for live trades.

        Returns:
            DataSourceResult with merged trades from both sources.
        """
        # Always get paper trades (this cannot fail)
        paper_trades = self.repository.get_trades(user_id)

        # Get live trades with error handling
        live_result = await self._get_live_trades(session_id)

        # Merge both sources
        combined_trades = paper_trades + live_result.trades

        return DataSourceResult(
            trades=combined_trades,
            source="combined",
            live_fetch_errors=live_result.live_fetch_errors,
            partial=live_result.partial,
        )

    def _extract_data_list(self, response: dict) -> list[dict]:
        """Extract the data list from a BFF response.

        The BFF may return data in a nested structure. This method
        handles common response formats.

        Args:
            response: Raw dict response from PortfolioFetcher.

        Returns:
            List of record dicts to normalize.
        """
        if isinstance(response, list):
            return response

        # Try common response wrapper keys
        if "data" in response:
            data = response["data"]
            if isinstance(data, list):
                return data
            return []

        # If the response itself looks like a list wrapped in a dict
        # with a results/items key
        for key in ("results", "items", "records", "positions", "holdings", "trades"):
            if key in response and isinstance(response[key], list):
                return response[key]

        # If it's a dict with no recognizable list key, return empty
        logger.warning(
            "Could not extract data list from response keys: %s",
            list(response.keys()),
        )
        return []
