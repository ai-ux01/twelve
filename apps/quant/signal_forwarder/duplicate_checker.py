"""
Duplicate Checker Module.

Tracks recently created trades and suppresses duplicate signals for the same
(symbol, direction, tradeType) combination when an open trade exists or when
a trade was created within the configured duplicate window.

Requirements: 4.1, 4.2, 4.3
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

from persistence.json_store import JsonFileStore

logger = logging.getLogger(__name__)


class DuplicateChecker:
    """
    Checks for and suppresses duplicate trade signals.

    A signal is considered duplicate if:
    - There is an OPEN trade for the same (symbol, direction, tradeType) key
    - A trade for that key was created within the configured duplicate window

    State is persisted via JsonFileStore at apps/quant/data/dedup_state.json
    for recovery across restarts.

    Key format: {symbol}|{direction}|{trade_type}
    """

    def __init__(self, store: Optional[JsonFileStore] = None):
        """
        Initialize the duplicate checker.

        Args:
            store: JsonFileStore instance. If None, creates one at
                   apps/quant/data/dedup_state.json.
        """
        self._store = store or JsonFileStore("dedup_state")

    @staticmethod
    def _make_key(symbol: str, direction: str, trade_type: str) -> str:
        """
        Build the deduplication key.

        Args:
            symbol: Trading symbol (e.g., "RELIANCE")
            direction: Trade direction ("LONG" or "SHORT")
            trade_type: Trade type (e.g., "SWING", "INTRADAY", "OPTIONS_SCALPING")

        Returns:
            Key string in format: {symbol}|{direction}|{trade_type}
        """
        return f"{symbol}|{direction}|{trade_type}"

    def is_duplicate(
        self,
        symbol: str,
        direction: str,
        trade_type: str,
        duplicate_window_minutes: int,
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a signal is a duplicate.

        A signal is considered duplicate if:
        1. There is an OPEN trade for the same key, OR
        2. The last trade for that key was created within duplicate_window_minutes

        Args:
            symbol: Trading symbol.
            direction: Trade direction ("LONG" or "SHORT").
            trade_type: Trade type (e.g., "SWING", "INTRADAY").
            duplicate_window_minutes: Time window in minutes for duplicate suppression.

        Returns:
            Tuple of (is_duplicate: bool, reason: Optional[str]).
            If duplicate, reason explains why. If not duplicate, reason is None.
        """
        key = self._make_key(symbol, direction, trade_type)
        entry = self._store.get(key)

        if entry is None:
            return (False, None)

        # Check if there's an open trade for this key
        status = entry.get("status", "")
        if status == "OPEN":
            return (True, f"Open trade exists for {symbol} {direction} {trade_type}")

        # Check if the last trade was within the duplicate window
        created_at_str = entry.get("created_at")
        if created_at_str:
            # Parse the ISO-format timestamp
            if isinstance(created_at_str, str):
                created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            else:
                # JsonFileStore may have already decoded the datetime
                created_at = created_at_str

            # Ensure created_at is timezone-aware
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            now = datetime.now(timezone.utc)
            elapsed_minutes = (now - created_at).total_seconds() / 60.0

            if elapsed_minutes < duplicate_window_minutes:
                remaining = duplicate_window_minutes - elapsed_minutes
                return (
                    True,
                    f"Trade for {symbol} {direction} {trade_type} created "
                    f"{elapsed_minutes:.1f}min ago (window: {duplicate_window_minutes}min, "
                    f"{remaining:.1f}min remaining)",
                )

        return (False, None)

    def record_trade(
        self,
        symbol: str,
        direction: str,
        trade_type: str,
        trade_id: str,
    ) -> None:
        """
        Record a new trade creation for future duplicate checks.

        Args:
            symbol: Trading symbol.
            direction: Trade direction ("LONG" or "SHORT").
            trade_type: Trade type (e.g., "SWING", "INTRADAY").
            trade_id: Unique identifier of the created trade.
        """
        key = self._make_key(symbol, direction, trade_type)
        entry = {
            "trade_id": trade_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "OPEN",
        }
        self._store.set(key, entry)
        logger.debug(f"Recorded trade {trade_id} for key {key}")

    def mark_trade_closed(
        self,
        symbol: str,
        direction: str,
        trade_type: str,
    ) -> None:
        """
        Mark a trade as closed to allow new signals for that key.

        Args:
            symbol: Trading symbol.
            direction: Trade direction ("LONG" or "SHORT").
            trade_type: Trade type (e.g., "SWING", "INTRADAY").
        """
        key = self._make_key(symbol, direction, trade_type)
        entry = self._store.get(key)

        if entry is not None:
            entry["status"] = "CLOSED"
            self._store.set(key, entry)
            logger.debug(f"Marked trade closed for key {key}")
        else:
            logger.warning(f"No trade found to close for key {key}")
