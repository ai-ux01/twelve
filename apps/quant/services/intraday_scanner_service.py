"""
Intraday Scanner Service.

Periodically scores a watchlist of symbols using the IntradayScoringService
and forwards qualifying STRONG signals to paper trading via the Signal Forwarder.

Runs as a background task during market hours.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, time, timezone, timedelta
from typing import List, Optional

from services.intraday_scoring_service import IntradayScoringService
from services.intraday_analysis_service import IntradayAnalysisService

logger = logging.getLogger(__name__)

# Default NIFTY50 watchlist for intraday scanning
DEFAULT_INTRADAY_WATCHLIST = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
    "HINDUNILVR", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK",
    "LT", "HCLTECH", "AXISBANK", "ASIANPAINT", "MARUTI",
    "SUNPHARMA", "TITAN", "BAJFINANCE", "WIPRO", "ONGC",
    "NTPC", "POWERGRID", "TATASTEEL", "ADANIENT", "NESTLEIND",
    "TATAMOTORS", "ULTRACEMCO", "BAJAJFINSV", "TECHM", "INDUSINDBK",
]

# IST market hours
MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)
IST_OFFSET = timedelta(hours=5, minutes=30)


def _is_market_hours() -> bool:
    """Check if current IST time is within market hours (Mon-Fri 9:15-15:30)."""
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc + IST_OFFSET
    if now_ist.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    current_time = now_ist.time()
    return MARKET_OPEN <= current_time <= MARKET_CLOSE


class IntradayScannerService:
    """
    Background service that scans a watchlist of symbols for intraday signals.

    Periodically scores each symbol using the IntradayScoringService and
    forwards qualifying signals to paper trading via the Signal Forwarder.
    """

    def __init__(
        self,
        watchlist: Optional[List[str]] = None,
        interval_seconds: int = 300,  # Default: 5 minutes
        api_base_url: str = "http://localhost:4000",
    ):
        """
        Initialize the intraday scanner.

        Args:
            watchlist: List of symbols to scan. Defaults to NIFTY50.
            interval_seconds: Seconds between scan cycles. Default 300 (5 min).
            api_base_url: Base URL for market data API.
        """
        self.watchlist = watchlist or DEFAULT_INTRADAY_WATCHLIST
        self.interval = interval_seconds
        self.api_base_url = api_base_url
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_scan_time: Optional[datetime] = None
        self._signals_found: int = 0
        self._total_scans: int = 0

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self) -> None:
        """Start the background scanning loop."""
        if self._running:
            logger.warning("Intraday scanner is already running")
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            f"Intraday scanner started: {len(self.watchlist)} symbols, "
            f"interval={self.interval}s"
        )

    async def stop(self) -> None:
        """Stop the background scanning loop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Intraday scanner stopped")

    async def _run_loop(self) -> None:
        """Main scanning loop — runs during market hours only."""
        while self._running:
            try:
                if _is_market_hours():
                    await self._run_scan_cycle()
                else:
                    logger.debug("Outside market hours, skipping intraday scan")
            except Exception as e:
                logger.error(f"Intraday scan cycle error: {e}")

            await asyncio.sleep(self.interval)

    async def _run_scan_cycle(self) -> None:
        """Run a single scan cycle across all watchlist symbols."""
        import httpx
        from signal_forwarder.forwarder import SignalForwarder

        logger.info(f"Starting intraday scan cycle: {len(self.watchlist)} symbols")
        self._total_scans += 1
        self._last_scan_time = datetime.now(timezone.utc)
        signals_this_cycle = 0

        forwarder = SignalForwarder(api_base_url=self.api_base_url)

        for symbol in self.watchlist:
            try:
                # Fetch recent candle data from MongoDB market data endpoint
                # Try 5-minute first, fall back to daily
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        f"http://localhost:8000/api/market-data/ohlcv",
                        params={
                            "symbol": symbol,
                            "timeframe": "5minute",
                            "limit": 50,
                        },
                    )

                candle_data = response.json() if response.status_code == 200 else {}
                candles = candle_data.get("candles", []) if isinstance(candle_data, dict) else []

                # Fall back to daily if no intraday candles available
                if len(candles) < 30:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.get(
                            f"http://localhost:8000/api/market-data/ohlcv",
                            params={
                                "symbol": symbol,
                                "timeframe": "day",
                                "limit": 50,
                            },
                        )
                    if response.status_code != 200:
                        continue
                    candle_data = response.json()
                    candles = candle_data.get("candles", []) if isinstance(candle_data, dict) else []

                if len(candles) < 30:
                    continue  # Not enough data for analysis

                # Run intraday analysis
                analysis_service = IntradayAnalysisService()
                scoring_service = IntradayScoringService()

                # Build OHLCV data for analysis
                from models import OHLCVData
                ohlcv_list = []
                for c in candles:
                    try:
                        ohlcv_list.append(OHLCVData(
                            open=float(c.get("open", 0)),
                            high=float(c.get("high", 0)),
                            low=float(c.get("low", 0)),
                            close=float(c.get("close", 0)),
                            volume=int(c.get("volume", 0)),
                        ))
                    except (ValueError, TypeError):
                        continue

                if len(ohlcv_list) < 30:
                    continue

                # Perform technical analysis
                technical_analysis = analysis_service.analyze(
                    symbol=symbol,
                    interval="5min",
                    data=ohlcv_list,
                )

                # Calculate score
                current_price = ohlcv_list[-1].close
                score_result = scoring_service.calculate_score(
                    current_price=current_price,
                    technical_analysis=technical_analysis,
                )

                # Only forward STRONG signals
                if score_result.strength.value.upper() != "STRONG":
                    continue

                if score_result.total_score < 70.0:
                    continue

                # Determine direction from VWAP
                if hasattr(technical_analysis, 'vwap') and technical_analysis.vwap:
                    direction = "LONG" if current_price > technical_analysis.vwap else "SHORT"
                else:
                    direction = "LONG"

                # Calculate stop/target from ATR or fixed %
                atr = getattr(technical_analysis, 'atr', current_price * 0.01)
                if direction == "LONG":
                    stop_loss = current_price - atr * 1.5
                    target = current_price + atr * 2.0
                else:
                    stop_loss = current_price + atr * 1.5
                    target = current_price - atr * 2.0

                # Forward to paper trading
                result_dict = {
                    "total_score": score_result.total_score,
                    "strength": score_result.strength.value,
                    "trend_score": score_result.components.trend_score if hasattr(score_result, 'components') else 0,
                    "momentum_score": score_result.components.momentum_score if hasattr(score_result, 'components') else 0,
                    "volume_score": score_result.components.volume_score if hasattr(score_result, 'components') else 0,
                    "vwap_score": score_result.components.vwap_score if hasattr(score_result, 'components') else 0,
                }

                trade_id = await forwarder.forward_intraday_signal(
                    result=result_dict,
                    symbol=symbol,
                    current_price=current_price,
                    stop_loss=stop_loss,
                    target=target,
                    direction=direction,
                )

                if trade_id:
                    signals_this_cycle += 1
                    logger.info(
                        f"Intraday signal forwarded: {symbol} {direction} "
                        f"score={score_result.total_score:.1f} trade_id={trade_id}"
                    )

            except Exception as e:
                logger.debug(f"Intraday scan error for {symbol}: {e}")
                continue

            # Small delay between symbols to avoid overwhelming APIs
            await asyncio.sleep(0.5)

        self._signals_found += signals_this_cycle
        logger.info(
            f"Intraday scan cycle complete: {signals_this_cycle} signals "
            f"from {len(self.watchlist)} symbols"
        )

    def get_status(self) -> dict:
        """Return scanner status."""
        return {
            "running": self._running,
            "watchlist_size": len(self.watchlist),
            "interval_seconds": self.interval,
            "last_scan_time": self._last_scan_time.isoformat() if self._last_scan_time else None,
            "total_scans": self._total_scans,
            "signals_found": self._signals_found,
            "market_hours": _is_market_hours(),
        }
