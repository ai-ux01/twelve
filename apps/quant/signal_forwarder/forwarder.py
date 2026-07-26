"""
Signal Forwarder Module.

Core service that receives analysis results from signal sources, evaluates them
against configurable thresholds, checks for duplicates, and forwards qualifying
signals to the Paper Trading API via HTTP.

Requirements: 1.1, 1.2, 1.8, 2.1, 2.6, 3.1, 3.5, 5.2, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from scalper.models import ScalperAnalysisResult, ScalperSignalType
from signal_forwarder.config import AutoTradeConfigService
from signal_forwarder.duplicate_checker import DuplicateChecker
from signal_forwarder.mapper import SignalMapper

logger = logging.getLogger(__name__)


@dataclass
class ForwarderHealth:
    """Session statistics for the Signal Forwarder."""

    signals_forwarded: int = 0
    signals_skipped: int = 0
    errors: int = 0
    last_forward_time: Optional[datetime] = field(default=None)
    last_error_time: Optional[datetime] = field(default=None)
    last_error_message: Optional[str] = field(default=None)


class SignalForwarder:
    """
    Core service that forwards qualifying signals to the Paper Trading API.

    Receives analysis results from signal sources (Options Scalper, Swing Scanner,
    Intraday Scorer), evaluates them against configurable thresholds, checks for
    duplicates, and forwards qualifying signals via HTTP POST.
    """

    def __init__(
        self,
        api_base_url: str = "http://localhost:4000",
        user_id: str = "12216205-737a-434d-bdde-14dea994b116",
    ):
        """
        Initialize the Signal Forwarder.

        Args:
            api_base_url: Base URL for the Paper Trading API (default http://localhost:4000).
            user_id: User ID for config lookup and trade creation (default "default").
        """
        self._api_base_url = api_base_url.rstrip("/")
        self._user_id = user_id
        self._config_service = AutoTradeConfigService()
        self._duplicate_checker = DuplicateChecker()
        self._health = ForwarderHealth()

    async def _send_to_api(self, payload: Dict[str, Any]) -> Optional[str]:
        """
        Send a CreatePaperTradeDto payload to the Paper Trading API.

        Performs an async POST to /api/paper-trades with retry logic:
        - Retry once after 2s on connection error or 5xx response
        - Do not retry on 4xx responses

        Args:
            payload: The CreatePaperTradeDto dict to send.

        Returns:
            The trade ID string on success, or None on failure.
        """
        url = f"{self._api_base_url}/api/paper-trades"
        max_attempts = 2

        for attempt in range(max_attempts):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(url, json=payload)

                if response.status_code >= 200 and response.status_code < 300:
                    data = response.json()
                    return data.get("id")

                if response.status_code >= 400 and response.status_code < 500:
                    # 4xx: do not retry
                    logger.error(
                        f"Paper Trading API returned {response.status_code}: "
                        f"{response.text}. Payload: {payload}"
                    )
                    self._health.errors += 1
                    self._health.last_error_time = datetime.now(timezone.utc)
                    self._health.last_error_message = (
                        f"API returned {response.status_code}: {response.text}"
                    )
                    return None

                if response.status_code >= 500:
                    # 5xx: retry once
                    if attempt < max_attempts - 1:
                        logger.warning(
                            f"Paper Trading API returned {response.status_code}, "
                            f"retrying in 2s..."
                        )
                        await asyncio.sleep(2)
                        continue
                    else:
                        logger.error(
                            f"Paper Trading API returned {response.status_code} after retry: "
                            f"{response.text}. Payload: {payload}"
                        )
                        self._health.errors += 1
                        self._health.last_error_time = datetime.now(timezone.utc)
                        self._health.last_error_message = (
                            f"API returned {response.status_code} after retry: {response.text}"
                        )
                        return None

            except (httpx.ConnectError, httpx.ConnectTimeout, httpx.TimeoutException) as e:
                if attempt < max_attempts - 1:
                    logger.warning(
                        f"Connection error to Paper Trading API: {e}, retrying in 2s..."
                    )
                    await asyncio.sleep(2)
                    continue
                else:
                    logger.error(
                        f"Failed to connect to Paper Trading API after retry: {e}. "
                        f"Payload: {payload}"
                    )
                    self._health.errors += 1
                    self._health.last_error_time = datetime.now(timezone.utc)
                    self._health.last_error_message = (
                        f"Connection failed after retry: {e}"
                    )
                    return None

            except Exception as e:
                logger.error(
                    f"Unexpected error sending to Paper Trading API: {e}. "
                    f"Payload: {payload}"
                )
                self._health.errors += 1
                self._health.last_error_time = datetime.now(timezone.utc)
                self._health.last_error_message = f"Unexpected error: {e}"
                return None

        return None

    async def forward_scalper_signal(
        self, result: ScalperAnalysisResult
    ) -> Optional[str]:
        """
        Forward an Options Scalper signal to the Paper Trading API.

        Gates the signal based on:
        1. Config: options_scalper_enabled must be True
        2. Signal type: must be BUY_CE or BUY_PE (skip HOLD)
        3. Threshold: probability must be above options_scalper_threshold
        4. Duplicate: must not be a duplicate signal

        Args:
            result: ScalperAnalysisResult from the Options Scalper analysis.

        Returns:
            Trade ID string on success, or None if skipped/failed.
        """
        config = self._config_service.get_config(self._user_id)

        # Check if source is enabled
        if not config.options_scalper_enabled:
            logger.debug(
                f"Options scalper disabled for user '{self._user_id}', skipping signal"
            )
            self._health.signals_skipped += 1
            return None

        # Gate: skip HOLD signals
        if result.signal_type == ScalperSignalType.HOLD:
            logger.debug(
                f"Skipping HOLD signal for {result.underlying}"
            )
            self._health.signals_skipped += 1
            return None

        # Gate: check probability threshold
        if result.probability < config.options_scalper_threshold:
            logger.debug(
                f"Skipping {result.underlying} scalper signal: probability "
                f"{result.probability:.1f} below threshold {config.options_scalper_threshold}"
            )
            self._health.signals_skipped += 1
            return None

        # Map signal to determine symbol and direction for dedup check
        try:
            payload = SignalMapper.map_scalper_signal(result, self._user_id)
        except ValueError as e:
            logger.warning(f"Failed to map scalper signal: {e}")
            self._health.signals_skipped += 1
            return None

        # Check for duplicates
        symbol = payload["symbol"]
        direction = payload["direction"]
        trade_type = payload["tradeType"]

        is_dup, reason = self._duplicate_checker.is_duplicate(
            symbol, direction, trade_type, config.duplicate_window_minutes
        )
        if is_dup:
            logger.debug(
                f"Skipping duplicate scalper signal for {symbol}: {reason}"
            )
            self._health.signals_skipped += 1
            return None

        # Forward to API
        trade_id = await self._send_to_api(payload)

        if trade_id:
            # Record trade for duplicate checking
            self._duplicate_checker.record_trade(
                symbol, direction, trade_type, trade_id
            )
            self._health.signals_forwarded += 1
            self._health.last_forward_time = datetime.now(timezone.utc)
            logger.info(
                f"Created paper trade {trade_id}: {symbol} {direction} "
                f"entry={payload['entryPrice']} source=options_scalper"
            )
        return trade_id

    async def forward_swing_signals(
        self, candidates: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Forward qualifying Swing Scanner candidates to the Paper Trading API.

        For each candidate, gates based on:
        1. Config: swing_scanner_enabled must be True
        2. Threshold: score must be above swing_scanner_threshold
        3. Validation: must have entry, stop_loss, and target values
        4. Duplicate: must not be a duplicate signal

        Args:
            candidates: List of swing scan result dicts.

        Returns:
            List of trade ID strings for successfully created trades.
        """
        config = self._config_service.get_config(self._user_id)
        trade_ids: List[str] = []

        # Check if source is enabled
        if not config.swing_scanner_enabled:
            logger.debug(
                f"Swing scanner disabled for user '{self._user_id}', skipping signals"
            )
            self._health.signals_skipped += len(candidates)
            return trade_ids

        for candidate in candidates:
            symbol = candidate.get("symbol", "unknown")
            total_score = candidate.get("total_score", candidate.get("score", 0.0))

            # Gate: check score threshold
            if total_score < config.swing_scanner_threshold:
                logger.debug(
                    f"Skipping {symbol} swing signal: score "
                    f"{total_score:.1f} below threshold {config.swing_scanner_threshold}"
                )
                self._health.signals_skipped += 1
                continue

            # Validate required price fields
            entry_price = candidate.get("entry_price", candidate.get("current_price"))
            stop_loss = candidate.get("stop_loss")
            target = candidate.get("target")

            if entry_price is None or stop_loss is None or target is None:
                missing = []
                if entry_price is None:
                    missing.append("entry")
                if stop_loss is None:
                    missing.append("stop_loss")
                if target is None:
                    missing.append("target")
                logger.warning(
                    f"Skipping {symbol} swing signal: missing {', '.join(missing)}"
                )
                self._health.signals_skipped += 1
                continue

            # Map the signal
            try:
                payload = SignalMapper.map_swing_signal(
                    candidate, self._user_id, config.default_swing_quantity
                )
            except ValueError as e:
                logger.warning(f"Failed to map swing signal for {symbol}: {e}")
                self._health.signals_skipped += 1
                continue

            # Check for duplicates
            direction = payload["direction"]
            trade_type = payload["tradeType"]

            is_dup, reason = self._duplicate_checker.is_duplicate(
                symbol, direction, trade_type, config.duplicate_window_minutes
            )
            if is_dup:
                logger.debug(
                    f"Skipping duplicate swing signal for {symbol}: {reason}"
                )
                self._health.signals_skipped += 1
                continue

            # Forward to API (with rate-limit delay between candidates)
            if trade_ids:
                await asyncio.sleep(1)  # 1s delay between paper trade creation to avoid rate limiting

            trade_id = await self._send_to_api(payload)

            if trade_id:
                self._duplicate_checker.record_trade(
                    symbol, direction, trade_type, trade_id
                )
                self._health.signals_forwarded += 1
                self._health.last_forward_time = datetime.now(timezone.utc)
                logger.info(
                    f"Created paper trade {trade_id}: {symbol} {direction} "
                    f"entry={payload['entryPrice']} source=swing_scanner"
                )
                trade_ids.append(trade_id)

        return trade_ids

    async def forward_intraday_signal(
        self,
        result: Dict[str, Any],
        symbol: str,
        current_price: float,
        stop_loss: Optional[float],
        target: Optional[float],
        direction: str = "LONG",
    ) -> Optional[str]:
        """
        Forward an Intraday Scorer signal to the Paper Trading API.

        Gates the signal based on:
        1. Config: intraday_scorer_enabled must be True
        2. Strength: must be STRONG (skip MODERATE/WEAK)
        3. Threshold: total_score must be above intraday_scorer_threshold
        4. Duplicate: must not be a duplicate signal

        Args:
            result: Dict with intraday scoring result (total_score, strength, etc.)
            symbol: Trading symbol.
            current_price: Current market price (used as entry price).
            stop_loss: Stop loss level. Skipped if None.
            target: Target price. Skipped if None.
            direction: Trade direction (default "LONG").

        Returns:
            Trade ID string on success, or None if skipped/failed.
        """
        config = self._config_service.get_config(self._user_id)

        # Check if source is enabled
        if not config.intraday_scorer_enabled:
            logger.debug(
                f"Intraday scorer disabled for user '{self._user_id}', skipping signal"
            )
            self._health.signals_skipped += 1
            return None

        # Gate: only forward STRONG signals
        strength = result.get("strength", "").upper()
        if strength != "STRONG":
            logger.debug(
                f"Skipping {symbol} intraday signal: strength={strength} (not STRONG)"
            )
            self._health.signals_skipped += 1
            return None

        # Gate: check total_score threshold
        total_score = result.get("total_score", 0.0)
        if total_score < config.intraday_scorer_threshold:
            logger.debug(
                f"Skipping {symbol} intraday signal: score "
                f"{total_score:.1f} below threshold {config.intraday_scorer_threshold}"
            )
            self._health.signals_skipped += 1
            return None

        # Validate stop_loss and target
        if stop_loss is None or target is None:
            logger.warning(
                f"Skipping {symbol} intraday signal: missing stop_loss or target"
            )
            self._health.signals_skipped += 1
            return None

        # Map the signal
        payload = SignalMapper.map_intraday_signal(
            result=result,
            symbol=symbol,
            current_price=current_price,
            stop_loss=stop_loss,
            target=target,
            user_id=self._user_id,
            quantity=config.default_intraday_quantity,
            direction=direction,
        )

        # Check for duplicates
        trade_type = payload["tradeType"]

        is_dup, reason = self._duplicate_checker.is_duplicate(
            symbol, direction, trade_type, config.duplicate_window_minutes
        )
        if is_dup:
            logger.debug(
                f"Skipping duplicate intraday signal for {symbol}: {reason}"
            )
            self._health.signals_skipped += 1
            return None

        # Forward to API
        trade_id = await self._send_to_api(payload)

        if trade_id:
            self._duplicate_checker.record_trade(
                symbol, direction, trade_type, trade_id
            )
            self._health.signals_forwarded += 1
            self._health.last_forward_time = datetime.now(timezone.utc)
            logger.info(
                f"Created paper trade {trade_id}: {symbol} {direction} "
                f"entry={current_price} source=intraday_scorer"
            )
        return trade_id

    def get_health(self) -> ForwarderHealth:
        """
        Return session statistics for the Signal Forwarder.

        Returns:
            ForwarderHealth dataclass with current session counters.
        """
        return self._health
