"""
Sync Ledger — Persistent deduplication layer for Trade Sync Service.

Tracks which trades have already been synced and stores pending (unmatched)
orders waiting for their counterpart. Backed by JsonFileStore for persistence
across quant engine restarts.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List

from persistence.json_store import JsonFileStore

from .models import PendingEntry, SyncedEntry

logger = logging.getLogger(__name__)


class SyncLedger:
    """
    Persistent deduplication layer using JsonFileStore.

    Storage structure in data/trade_sync_ledger.json:
    {
      "synced": {
        "paper_trade:abc123": {"trade_analysis_id": "ta_xyz", "sync_timestamp": "..."},
        ...
      },
      "pending": [
        {"source": "live_stock", "source_id": "order789", "symbol": "RELIANCE", ...},
        ...
      ]
    }
    """

    def __init__(self) -> None:
        """Initialize the ledger with JsonFileStore persistence."""
        self._store = JsonFileStore("trade_sync_ledger")
        self.load()

    def is_synced(self, source: str, source_id: str) -> bool:
        """
        Check if a trade ID has already been synced.

        Args:
            source: Trade source ("paper_trade", "live_stock", "live_options").
            source_id: Source-specific trade/order ID.

        Returns:
            True if this trade has already been synced, False otherwise.
        """
        key = f"{source}:{source_id}"
        synced = self._store.get("synced", {})
        return key in synced

    def mark_synced(
        self, source: str, source_id: str, trade_analysis_id: str
    ) -> None:
        """
        Record a trade as successfully synced.

        Args:
            source: Trade source ("paper_trade", "live_stock", "live_options").
            source_id: Source-specific trade/order ID.
            trade_analysis_id: The ID assigned in the Trade Analysis repository.
        """
        key = f"{source}:{source_id}"
        synced = self._store.get("synced", {})
        synced[key] = {
            "source": source,
            "source_id": source_id,
            "trade_analysis_id": trade_analysis_id,
            "sync_timestamp": datetime.utcnow().isoformat(),
        }
        self._store.set("synced", synced)

    def add_pending(self, entry: PendingEntry) -> None:
        """
        Add an unmatched order to the pending list.

        Args:
            entry: The pending entry to store.
        """
        pending = self._store.get("pending", [])
        pending.append({
            "source": entry.source,
            "source_id": entry.source_id,
            "symbol": entry.symbol,
            "direction": entry.direction,
            "price": entry.price,
            "quantity": entry.quantity,
            "timestamp": entry.timestamp.isoformat(),
            "strike_price": entry.strike_price,
            "expiry": entry.expiry,
            "option_type": entry.option_type,
        })
        self._store.set("pending", pending)

    def get_pending(self, source: str, symbol: str) -> List[PendingEntry]:
        """
        Get pending entries filtered by source and symbol.

        Args:
            source: Trade source to filter by.
            symbol: Symbol to filter by.

        Returns:
            List of matching PendingEntry objects.
        """
        pending = self._store.get("pending", [])
        results = []
        for item in pending:
            if item.get("source") == source and item.get("symbol") == symbol:
                results.append(
                    PendingEntry(
                        source=item["source"],
                        source_id=item["source_id"],
                        symbol=item["symbol"],
                        direction=item["direction"],
                        price=item["price"],
                        quantity=item["quantity"],
                        timestamp=datetime.fromisoformat(item["timestamp"])
                        if isinstance(item["timestamp"], str)
                        else item["timestamp"],
                        strike_price=item.get("strike_price"),
                        expiry=item.get("expiry"),
                        option_type=item.get("option_type"),
                    )
                )
        return results

    def remove_pending(self, source: str, source_id: str) -> None:
        """
        Remove a pending entry after successful match.

        Args:
            source: Trade source of the entry to remove.
            source_id: Source-specific order ID to remove.
        """
        pending = self._store.get("pending", [])
        pending = [
            item
            for item in pending
            if not (item.get("source") == source and item.get("source_id") == source_id)
        ]
        self._store.set("pending", pending)

    def get_all_synced(self) -> List[SyncedEntry]:
        """
        Return all synced entries as SyncedEntry dataclass instances.

        Returns:
            List of all SyncedEntry records.
        """
        synced = self._store.get("synced", {})
        results = []
        for key, value in synced.items():
            # key format is "{source}:{source_id}"
            source = value.get("source", key.split(":")[0])
            source_id = value.get("source_id", ":".join(key.split(":")[1:]))
            sync_timestamp = value.get("sync_timestamp")
            if isinstance(sync_timestamp, str):
                sync_timestamp = datetime.fromisoformat(sync_timestamp)
            elif sync_timestamp is None:
                sync_timestamp = datetime.utcnow()

            results.append(
                SyncedEntry(
                    source=source,
                    source_id=source_id,
                    trade_analysis_id=value.get("trade_analysis_id", ""),
                    sync_timestamp=sync_timestamp,
                )
            )
        return results

    def load(self) -> None:
        """
        Load state from JSON file.

        Initializes empty state on missing or corrupted file with a warning log.
        JsonFileStore already handles the file loading, but we ensure the
        expected structure exists.
        """
        # JsonFileStore loads on init, but verify structure
        synced = self._store.get("synced")
        pending = self._store.get("pending")

        if synced is None and pending is None:
            # File was missing or empty — initialize default structure
            logger.warning(
                "Sync ledger file missing or empty, initializing empty state"
            )
            self._store.set("synced", {})
            self._store.set("pending", [])
        else:
            # Ensure both keys exist with correct types
            if not isinstance(synced, dict):
                logger.warning(
                    "Sync ledger 'synced' data corrupted, resetting to empty"
                )
                self._store.set("synced", {})
            if not isinstance(pending, list):
                logger.warning(
                    "Sync ledger 'pending' data corrupted, resetting to empty list"
                )
                self._store.set("pending", [])

    def save(self) -> None:
        """
        Persist current state to JSON file.

        Note: JsonFileStore already does write-through on every set() call,
        so this is effectively a no-op. Provided for explicit save semantics.
        """
        # Force a save by re-setting the data (triggers write-through)
        synced = self._store.get("synced", {})
        pending = self._store.get("pending", [])
        self._store.set("synced", synced)
        self._store.set("pending", pending)
