"""
Trade Sync Service — Background synchronization of completed trades.

Orchestrates automatic capture of trades from all sources (paper trading,
live stock, live options) into the Trade Analysis module. Follows the same
background loop pattern as TradeMonitor.

Requirements: 1.1, 1.4, 1.5, 1.6, 2.1, 2.4, 2.6, 2.7, 3.5, 3.6, 3.7,
              4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3, 7.4, 7.5
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime
from typing import List, Optional, Tuple

import httpx

from trade_analysis.repository import TradeRepository
from trade_coach.portfolio_fetcher import (
    BFFError,
    ConnectionError as PFConnectionError,
    PortfolioFetcher,
    SessionError,
)

from .ledger import SyncLedger
from .mapper import MappingError, TradeMapper
from .models import PendingEntry, SyncCycleResult, SyncStatus

logger = logging.getLogger(__name__)


class TradeSyncService:
    """
    Background service that synchronizes completed trades from all sources.

    Polls at a configurable interval, fetches closed paper trades and live
    trade book, maps them to TradeRecords, and persists them to the
    Trade Analysis repository. Uses SyncLedger for deduplication.
    """

    def __init__(
        self,
        api_base_url: str = "http://localhost:4000",
        bff_base_url: str = "http://localhost:4000/api/kotak-neo",
        interval: Optional[int] = None,
        user_id: str = "default",
    ):
        """Configure the Trade Sync Service.

        Args:
            api_base_url: Base URL of the NestJS Paper Trading API.
            bff_base_url: Base URL of the Kotak Neo BFF proxy.
            interval: Sync interval in seconds. Defaults to TRADE_SYNC_INTERVAL
                      env var or 60 seconds.
            user_id: User ID for persisting trades in the repository.
        """
        self.api_base_url = api_base_url.rstrip("/")
        self.bff_base_url = bff_base_url.rstrip("/")
        self.interval = interval if interval is not None else int(
            os.environ.get("TRADE_SYNC_INTERVAL", "60")
        )
        self.user_id = user_id

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._client: Optional[httpx.AsyncClient] = None
        self._last_cycle_result: Optional[SyncCycleResult] = None
        self._last_sync_timestamp: Optional[datetime] = None
        self._kotak_session_valid = False
        self._kotak_session_id: Optional[str] = None

        # Collaborators
        self._mapper = TradeMapper()
        self._ledger = SyncLedger()
        self._repository = TradeRepository()
        self._portfolio_fetcher = PortfolioFetcher(bff_base_url=bff_base_url)

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self) -> None:
        """Start the background sync polling loop."""
        if self._running:
            logger.warning("Trade sync service is already running")
            return

        self._running = True
        self._client = httpx.AsyncClient(timeout=30.0)
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            f"Trade sync service started with interval={self.interval}s, "
            f"api={self.api_base_url}, user={self.user_id}"
        )

    async def stop(self) -> None:
        """Gracefully stop the background sync loop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._client:
            await self._client.aclose()
            self._client = None
        logger.info("Trade sync service stopped")

    async def _run_loop(self) -> None:
        """Internal loop that runs sync cycles at the configured interval."""
        while self._running:
            try:
                result = await self.run_sync_cycle()
                self._last_cycle_result = result
                self._last_sync_timestamp = result.timestamp
                logger.info(
                    f"Sync cycle: paper={result.paper_trades_synced}, "
                    f"stock={result.live_stock_trades_synced}, "
                    f"options={result.live_options_trades_synced}, "
                    f"errors={len(result.errors)}"
                )
            except Exception as e:
                # Never crash regardless of errors (Req 7.5)
                logger.error(f"Sync cycle failed unexpectedly: {e}")
                self._last_cycle_result = SyncCycleResult(
                    timestamp=datetime.utcnow(),
                    errors=[str(e)],
                )

            await asyncio.sleep(self.interval)

    async def run_sync_cycle(self) -> SyncCycleResult:
        """Orchestrate a full sync cycle.

        1. Sync paper trades (always)
        2. Check Kotak session validity
        3. If valid session: sync live stock trades and live options trades
        4. Return cycle result with counts and errors

        Returns:
            SyncCycleResult with counts and any errors encountered.
        """
        result = SyncCycleResult(timestamp=datetime.utcnow())

        # 1. Sync paper trades (always runs regardless of Kotak session)
        paper_count, paper_errors = await self._sync_paper_trades()
        result.paper_trades_synced = paper_count
        result.errors.extend(paper_errors)

        # 2. Check Kotak session validity
        session_valid = await self._check_kotak_session()
        result.kotak_session_valid = session_valid

        # 3. If valid session: sync live trades
        if session_valid:
            stock_count, options_count, live_errors = await self._sync_live_trades()
            result.live_stock_trades_synced = stock_count
            result.live_options_trades_synced = options_count
            result.errors.extend(live_errors)

        return result

    async def _sync_paper_trades(self) -> Tuple[int, List[str]]:
        """Fetch closed paper trades, filter, map, persist, and mark synced.

        Returns:
            Tuple of (trades_synced_count, error_messages).
        """
        synced_count = 0
        errors: List[str] = []

        # Fetch closed paper trades from NestJS API
        try:
            trades = await self._fetch_closed_paper_trades()
        except httpx.ConnectError as e:
            # API unreachable — log warning, skip (Req 7.1)
            logger.warning(f"Paper Trading API unreachable: {e}")
            errors.append(f"Paper Trading API unreachable: {e}")
            return synced_count, errors
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                # 5xx — log error, retry next cycle (Req 7.3)
                logger.error(f"Paper Trading API server error: {e}")
                errors.append(f"Paper Trading API server error: {e}")
            else:
                logger.warning(f"Paper Trading API error: {e}")
                errors.append(f"Paper Trading API error: {e}")
            return synced_count, errors
        except Exception as e:
            # Never crash (Req 7.5)
            logger.error(f"Unexpected error fetching paper trades: {e}")
            errors.append(f"Unexpected error fetching paper trades: {e}")
            return synced_count, errors

        # Process each trade independently (Req 7.4)
        for trade in trades:
            try:
                trade_id = trade.get("id", "")
                if not trade_id:
                    errors.append("Paper trade missing 'id' field")
                    continue

                # Skip if already synced (Req 1.5)
                if self._ledger.is_synced("paper_trade", trade_id):
                    continue

                # Map to TradeRecord
                record = self._mapper.map_paper_trade(trade)
                record.user_id = self.user_id

                # Persist to repository
                self._repository.persist_trades(self.user_id, [record])

                # Mark synced in ledger (Req 1.4)
                self._ledger.mark_synced("paper_trade", trade_id, record.id)
                synced_count += 1

            except MappingError as e:
                # Individual mapping failure (Req 7.4)
                logger.warning(
                    f"Failed to map paper trade {trade.get('id', '?')}: {e}"
                )
                errors.append(str(e))
            except Exception as e:
                # Never crash (Req 7.5)
                logger.error(
                    f"Failed to sync paper trade {trade.get('id', '?')}: {e}"
                )
                errors.append(str(e))

        return synced_count, errors

    async def _sync_live_trades(self) -> Tuple[int, int, List[str]]:
        """Fetch trade book, filter, match orders, persist matched trades.

        Returns:
            Tuple of (stock_trades_synced, options_trades_synced, error_messages).
        """
        stock_count = 0
        options_count = 0
        errors: List[str] = []

        # Fetch trade book via PortfolioFetcher
        try:
            raw_response = await self._portfolio_fetcher.fetch_trades(
                self._kotak_session_id or ""
            )
        except SessionError as e:
            # 401/403 — mark session invalid (Req 7.2)
            logger.warning(f"Kotak session invalid: {e}")
            self._kotak_session_valid = False
            errors.append(f"Kotak session invalid: {e}")
            return stock_count, options_count, errors
        except BFFError as e:
            # 5xx — log error, retry next cycle (Req 7.3)
            logger.error(f"Kotak BFF server error: {e}")
            errors.append(f"Kotak BFF server error: {e}")
            return stock_count, options_count, errors
        except PFConnectionError as e:
            # API unreachable — log warning, skip (Req 7.1)
            logger.warning(f"Kotak BFF unreachable: {e}")
            errors.append(f"Kotak BFF unreachable: {e}")
            return stock_count, options_count, errors
        except Exception as e:
            # Never crash (Req 7.5)
            logger.error(f"Unexpected error fetching trade book: {e}")
            errors.append(f"Unexpected error fetching trade book: {e}")
            return stock_count, options_count, errors

        # Extract orders list from response
        orders = self._extract_orders(raw_response)

        # Sync stock trades
        stock_synced, stock_errors = await self._sync_stock_trades(orders)
        stock_count = stock_synced
        errors.extend(stock_errors)

        # Sync options trades
        options_synced, options_errors = await self._sync_options_trades(orders)
        options_count = options_synced
        errors.extend(options_errors)

        return stock_count, options_count, errors

    async def _sync_stock_trades(
        self, orders: List[dict]
    ) -> Tuple[int, List[str]]:
        """Filter equity orders, match pairs, persist, handle pending.

        Args:
            orders: Full list of orders from trade book.

        Returns:
            Tuple of (synced_count, errors).
        """
        synced_count = 0
        errors: List[str] = []

        # Filter to completed equity orders
        equity_orders = self._mapper.filter_equity_orders(orders)

        # Filter out already-synced orders
        unsyced_equity = [
            o for o in equity_orders
            if not self._ledger.is_synced(
                "live_stock", o.get("nOrdNo", o.get("orderId", ""))
            )
        ]

        if not unsyced_equity:
            return synced_count, errors

        # Match BUY/SELL pairs
        match_result = self._mapper.match_orders(unsyced_equity, "equity")

        # Process matched pairs
        for buy_order, sell_order in match_result.matched_pairs:
            try:
                record = self._mapper.map_live_stock_trade(buy_order, sell_order)
                record.user_id = self.user_id

                # Persist to repository
                self._repository.persist_trades(self.user_id, [record])

                # Mark both orders as synced (Req 2.6)
                buy_id = buy_order.get("nOrdNo", buy_order.get("orderId", ""))
                sell_id = sell_order.get("nOrdNo", sell_order.get("orderId", ""))
                self._ledger.mark_synced("live_stock", buy_id, record.id)
                self._ledger.mark_synced("live_stock", sell_id, record.id)

                # Remove from pending if they were pending
                self._ledger.remove_pending("live_stock", buy_id)
                self._ledger.remove_pending("live_stock", sell_id)

                synced_count += 1

            except MappingError as e:
                logger.warning(f"Failed to map stock trade: {e}")
                errors.append(str(e))
            except Exception as e:
                logger.error(f"Failed to sync stock trade: {e}")
                errors.append(str(e))

        # Handle unmatched orders — store as pending (Req 2.4)
        for order in match_result.unmatched_orders:
            try:
                order_id = order.get("nOrdNo", order.get("orderId", ""))
                if not order_id:
                    continue

                # Skip if already synced or already pending
                if self._ledger.is_synced("live_stock", order_id):
                    continue

                txn_type = order.get("trnsTp", "")
                direction = "BUY" if txn_type == "B" else "SELL"

                pending_entry = PendingEntry(
                    source="live_stock",
                    source_id=order_id,
                    symbol=order.get("trdSym", ""),
                    direction=direction,
                    price=float(order.get("prc", 0)),
                    quantity=int(order.get("flQty", order.get("qty", 0))),
                    timestamp=datetime.utcnow(),
                )
                self._ledger.add_pending(pending_entry)

            except Exception as e:
                logger.warning(f"Failed to store pending stock order: {e}")
                errors.append(str(e))

        return synced_count, errors

    async def _sync_options_trades(
        self, orders: List[dict]
    ) -> Tuple[int, List[str]]:
        """Filter options orders, match pairs, persist, handle pending.

        Args:
            orders: Full list of orders from trade book.

        Returns:
            Tuple of (synced_count, errors).
        """
        synced_count = 0
        errors: List[str] = []

        # Filter to completed options orders
        options_orders = self._mapper.filter_options_orders(orders)

        # Filter out already-synced orders
        unsynced_options = [
            o for o in options_orders
            if not self._ledger.is_synced(
                "live_options", o.get("nOrdNo", o.get("orderId", ""))
            )
        ]

        if not unsynced_options:
            return synced_count, errors

        # Match BUY/SELL pairs by contract
        match_result = self._mapper.match_orders(unsynced_options, "options")

        # Process matched pairs
        for buy_order, sell_order in match_result.matched_pairs:
            try:
                record = self._mapper.map_live_options_trade(
                    buy_order, sell_order
                )
                record.user_id = self.user_id

                # Persist to repository
                self._repository.persist_trades(self.user_id, [record])

                # Mark both orders as synced (Req 3.6)
                buy_id = buy_order.get("nOrdNo", buy_order.get("orderId", ""))
                sell_id = sell_order.get("nOrdNo", sell_order.get("orderId", ""))
                self._ledger.mark_synced("live_options", buy_id, record.id)
                self._ledger.mark_synced("live_options", sell_id, record.id)

                # Remove from pending if they were pending
                self._ledger.remove_pending("live_options", buy_id)
                self._ledger.remove_pending("live_options", sell_id)

                synced_count += 1

            except MappingError as e:
                logger.warning(f"Failed to map options trade: {e}")
                errors.append(str(e))
            except Exception as e:
                logger.error(f"Failed to sync options trade: {e}")
                errors.append(str(e))

        # Handle unmatched orders — store as pending (Req 3.5)
        for order in match_result.unmatched_orders:
            try:
                order_id = order.get("nOrdNo", order.get("orderId", ""))
                if not order_id:
                    continue

                # Skip if already synced or already pending
                if self._ledger.is_synced("live_options", order_id):
                    continue

                txn_type = order.get("trnsTp", "")
                direction = "BUY" if txn_type == "B" else "SELL"

                pending_entry = PendingEntry(
                    source="live_options",
                    source_id=order_id,
                    symbol=order.get("trdSym", ""),
                    direction=direction,
                    price=float(order.get("prc", 0)),
                    quantity=int(order.get("flQty", order.get("qty", 0))),
                    timestamp=datetime.utcnow(),
                    strike_price=float(order.get("strike", 0)) if order.get("strike") else None,
                    expiry=order.get("expiry"),
                    option_type=order.get("option_type"),
                )
                self._ledger.add_pending(pending_entry)

            except Exception as e:
                logger.warning(f"Failed to store pending options order: {e}")
                errors.append(str(e))

        return synced_count, errors

    async def _check_kotak_session(self) -> bool:
        """Check Kotak session validity via the NestJS API status endpoint.

        GET /api/kotak-neo/status — returns { connected: bool, ... }

        Returns:
            True if a valid Kotak session exists, False otherwise.
        """
        try:
            url = f"{self.api_base_url}/api/kotak-neo/status"
            response = await self._client.get(url)

            if response.status_code == 401 or response.status_code == 403:
                # Session invalid (Req 7.2)
                self._kotak_session_valid = False
                self._kotak_session_id = None
                return False

            if response.status_code >= 500:
                # Server error — treat as session unknown (Req 7.3)
                logger.error(
                    f"Kotak session status check returned {response.status_code}"
                )
                self._kotak_session_valid = False
                return False

            response.raise_for_status()
            data = response.json()

            connected = data.get("connected", False)
            if connected:
                self._kotak_session_valid = True
                # Use session ID from response or a default marker
                self._kotak_session_id = data.get("sessionId", "active")
                return True
            else:
                self._kotak_session_valid = False
                self._kotak_session_id = None
                return False

        except httpx.ConnectError:
            # API unreachable — treat as no session (Req 7.1)
            logger.warning("Cannot reach Kotak session status endpoint")
            self._kotak_session_valid = False
            return False
        except Exception as e:
            # Never crash (Req 7.5)
            logger.error(f"Error checking Kotak session: {e}")
            self._kotak_session_valid = False
            return False

    async def _fetch_closed_paper_trades(self) -> List[dict]:
        """Fetch closed paper trades from the NestJS Paper Trading API.

        GET /api/paper-trades?status=TARGET_HIT,STOP_HIT,MANUAL_EXIT,EXPIRED

        Returns:
            List of closed paper trade dicts.
        """
        url = f"{self.api_base_url}/api/paper-trades"
        params = {"status": "TARGET_HIT,STOP_HIT,MANUAL_EXIT,EXPIRED"}
        response = await self._client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        # Handle both list and wrapped response formats
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            if "data" in data and isinstance(data["data"], list):
                return data["data"]
            for key in ("results", "items", "trades"):
                if key in data and isinstance(data[key], list):
                    return data[key]
        return []

    def _extract_orders(self, raw_response: dict) -> List[dict]:
        """Extract orders list from PortfolioFetcher response.

        Handles various response wrapper formats.

        Args:
            raw_response: Raw response from PortfolioFetcher.fetch_trades().

        Returns:
            List of order dicts.
        """
        if isinstance(raw_response, list):
            return raw_response

        if isinstance(raw_response, dict):
            if "data" in raw_response and isinstance(raw_response["data"], list):
                return raw_response["data"]
            for key in ("results", "items", "records", "trades"):
                if key in raw_response and isinstance(raw_response[key], list):
                    return raw_response[key]

        return []

    def get_status(self) -> SyncStatus:
        """Return current service status.

        Returns:
            SyncStatus with running state, last sync info, and counts.
        """
        total_synced = len(self._ledger.get_all_synced())
        pending = self._ledger._store.get("pending", [])
        pending_count = len(pending) if isinstance(pending, list) else 0

        return SyncStatus(
            running=self._running,
            last_sync_timestamp=self._last_sync_timestamp,
            last_cycle_result=self._last_cycle_result,
            total_synced_count=total_synced,
            pending_count=pending_count,
        )
