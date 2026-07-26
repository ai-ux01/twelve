"""
Trade Monitor Background Service.

Polls open paper trades from the NestJS API at a configurable interval,
fetches current market prices, evaluates trade conditions (target/stop/expiry),
and triggers close or update actions via the API.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime
from typing import Optional, List

import httpx

from .models import PaperTradeData, TradeAction, MonitorCycleResult
from .exceptions import APIConnectionError, MarketDataUnavailableError

logger = logging.getLogger(__name__)


class TradeMonitor:
    """
    Background service that monitors open paper trades.

    Polls every `interval` seconds, fetches current prices,
    evaluates trade conditions, and triggers close/update API calls.
    """

    def __init__(
        self,
        api_base_url: str = "http://localhost:4000",
        interval: int = 30,
    ):
        self.api_base_url = api_base_url.rstrip("/")
        self.interval = interval
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_cycle_result: Optional[MonitorCycleResult] = None
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def last_cycle_result(self) -> Optional[MonitorCycleResult]:
        return self._last_cycle_result

    async def start(self) -> None:
        """Start the monitoring background loop."""
        if self._running:
            logger.warning("Trade monitor is already running")
            return

        self._running = True
        self._client = httpx.AsyncClient(timeout=30.0)
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"Trade monitor started with interval={self.interval}s, api={self.api_base_url}")

    async def stop(self) -> None:
        """Gracefully stop the monitoring loop."""
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
        logger.info("Trade monitor stopped")

    async def _run_loop(self) -> None:
        """Internal loop that runs check_trades at the configured interval."""
        while self._running:
            try:
                result = await self.check_trades()
                self._last_cycle_result = result
                logger.info(
                    f"Monitor cycle: checked={result.trades_checked}, "
                    f"closed={result.trades_closed}, updated={result.trades_updated}, "
                    f"errors={len(result.errors)}"
                )
            except Exception as e:
                logger.error(f"Monitor cycle failed: {e}")
                self._last_cycle_result = MonitorCycleResult(
                    timestamp=datetime.utcnow(),
                    errors=[str(e)],
                )

            await asyncio.sleep(self.interval)

    async def check_trades(self) -> MonitorCycleResult:
        """
        Single monitoring cycle:
        1. Fetch open trades from NestJS API
        2. Get current prices for each symbol
        3. Evaluate each trade
        4. Execute actions (close or update)
        """
        result = MonitorCycleResult(timestamp=datetime.utcnow())

        # Fetch open trades
        trades = await self._fetch_open_trades()
        result.trades_checked = len(trades)

        if not trades:
            return result

        # Group trades by symbol for batched price fetching
        symbols = list(set(t.symbol for t in trades))
        prices = await self._fetch_current_prices(symbols)

        # Evaluate each trade
        for trade in trades:
            current_price = prices.get(trade.symbol)
            if current_price is None:
                result.errors.append(f"No price available for {trade.symbol}")
                continue

            try:
                action = self.evaluate_trade(trade, current_price)

                if action.action == "CLOSE":
                    await self._close_trade(trade.id, action.exit_price or current_price, action.new_status or "MANUAL_EXIT")
                    result.trades_closed += 1
                elif action.action == "UPDATE":
                    await self._update_trade_price(trade.id, current_price)
                    result.trades_updated += 1

            except Exception as e:
                error_msg = f"Error processing trade {trade.id}: {e}"
                logger.error(error_msg)
                result.errors.append(error_msg)

        return result

    def evaluate_trade(self, trade: PaperTradeData, current_price: float) -> TradeAction:
        """
        Determine the appropriate action for a trade based on current price.

        For LONG trades:
            - Target hit: price >= target
            - Stop hit: price <= stop_loss

        For SHORT trades:
            - Target hit: price <= target
            - Stop hit: price >= stop_loss

        For OPTIONS_SCALPING:
            - Check expiry date
        """
        # Check OPTIONS_SCALPING expiry
        if trade.trade_type == "OPTIONS_SCALPING" and trade.expiry_date:
            today = date.today()
            if today > trade.expiry_date:
                return TradeAction(
                    trade_id=trade.id,
                    action="CLOSE",
                    new_status="EXPIRED",
                    exit_price=current_price,
                    current_price=current_price,
                    unrealized_pnl=self._calculate_unrealized_pnl(trade, current_price),
                )

        # Evaluate price conditions
        if trade.direction == "LONG":
            if current_price >= trade.target:
                return TradeAction(
                    trade_id=trade.id,
                    action="CLOSE",
                    new_status="TARGET_HIT",
                    exit_price=current_price,
                    current_price=current_price,
                    unrealized_pnl=self._calculate_unrealized_pnl(trade, current_price),
                )
            elif current_price <= trade.stop_loss:
                return TradeAction(
                    trade_id=trade.id,
                    action="CLOSE",
                    new_status="STOP_HIT",
                    exit_price=current_price,
                    current_price=current_price,
                    unrealized_pnl=self._calculate_unrealized_pnl(trade, current_price),
                )
        elif trade.direction == "SHORT":
            if current_price <= trade.target:
                return TradeAction(
                    trade_id=trade.id,
                    action="CLOSE",
                    new_status="TARGET_HIT",
                    exit_price=current_price,
                    current_price=current_price,
                    unrealized_pnl=self._calculate_unrealized_pnl(trade, current_price),
                )
            elif current_price >= trade.stop_loss:
                return TradeAction(
                    trade_id=trade.id,
                    action="CLOSE",
                    new_status="STOP_HIT",
                    exit_price=current_price,
                    current_price=current_price,
                    unrealized_pnl=self._calculate_unrealized_pnl(trade, current_price),
                )

        # No conditions met — update price
        return TradeAction(
            trade_id=trade.id,
            action="UPDATE",
            current_price=current_price,
            unrealized_pnl=self._calculate_unrealized_pnl(trade, current_price),
        )

    def _calculate_unrealized_pnl(self, trade: PaperTradeData, current_price: float) -> float:
        """Calculate unrealized P&L for a trade."""
        if trade.direction == "LONG":
            return (current_price - trade.entry_price) * trade.quantity
        else:
            return (trade.entry_price - current_price) * trade.quantity

    async def _fetch_open_trades(self) -> List[PaperTradeData]:
        """Fetch open trades from the NestJS API."""
        try:
            url = f"{self.api_base_url}/api/paper-trades"
            params = {"status": "OPEN", "pageSize": "1000"}
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            trades_data = data.get("data", []) if isinstance(data, dict) else data
            trades = []
            for t in trades_data:
                expiry_date = None
                if t.get("expiryDate"):
                    try:
                        expiry_date = date.fromisoformat(t["expiryDate"][:10])
                    except (ValueError, TypeError):
                        pass

                trades.append(PaperTradeData(
                    id=t["id"],
                    symbol=t["symbol"],
                    direction=t["direction"],
                    trade_type=t.get("tradeType", "SWING"),
                    entry_price=t["entryPrice"],
                    stop_loss=t["stopLoss"],
                    target=t["target"],
                    quantity=t["quantity"],
                    status=t["status"],
                    current_price=t.get("currentPrice"),
                    strike_price=t.get("strikePrice"),
                    option_type=t.get("optionType"),
                    expiry_date=expiry_date,
                    underlying=t.get("underlying"),
                ))
            return trades

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch open trades: {e}")
            raise APIConnectionError(self.api_base_url, str(e))

    async def _fetch_current_prices(self, symbols: List[str]) -> dict:
        """
        Fetch current market prices for the given symbols.
        In a production system this would call a market data API.
        For now, returns the last known price from trades or a mock.
        """
        # In production, this would call a real market data API
        # For now we return an empty dict - the monitor will skip trades without prices
        prices = {}
        for symbol in symbols:
            try:
                # Attempt to get price from any available market data source
                # This is a placeholder - integrate with actual market data fetcher
                price = await self._get_market_price(symbol)
                if price is not None:
                    prices[symbol] = price
            except Exception as e:
                logger.warning(f"Could not fetch price for {symbol}: {e}")

        return prices

    async def _get_market_price(self, symbol: str) -> Optional[float]:
        """
        Get current market price for a symbol.
        Override this in tests or production with actual market data integration.
        """
        # Placeholder - in production, integrate with market data fetcher
        return None

    async def _close_trade(self, trade_id: str, exit_price: float, exit_reason: str) -> None:
        """Call PATCH /api/paper-trades/:id/close on the NestJS API."""
        try:
            url = f"{self.api_base_url}/api/paper-trades/{trade_id}/close"
            response = await self._client.patch(url, json={
                "exitPrice": exit_price,
                "exitReason": exit_reason,
            })
            response.raise_for_status()
            logger.info(f"Closed trade {trade_id}: {exit_reason} @ {exit_price}")
        except httpx.HTTPError as e:
            logger.error(f"Failed to close trade {trade_id}: {e}")
            raise

    async def _update_trade_price(self, trade_id: str, current_price: float) -> None:
        """Call PATCH /api/paper-trades/:id on the NestJS API."""
        try:
            url = f"{self.api_base_url}/api/paper-trades/{trade_id}"
            response = await self._client.patch(url, json={
                "currentPrice": current_price,
            })
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"Failed to update trade {trade_id} price: {e}")
            raise
