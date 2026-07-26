"""
Trade Analysis Engine Repository.

In-memory storage for trade records, following the same pattern as
trading_lab/interaction_store.py. Data is persisted to JSON file.

Requirements: 10.1, 10.2, 10.3
"""

from __future__ import annotations

import dataclasses
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from .models import TradeRecord, TradeDirection, MarketRegime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from persistence.json_store import JsonFileStore

logger = logging.getLogger(__name__)


class TradeRepository:
    """
    In-memory store for trade records with JSON file persistence.

    Stores records keyed by user_id with support for CRUD operations.
    Automatically persists to data/trade_analysis_trades.json.

    Requirements: 10.1, 10.2, 10.3
    """

    def __init__(self):
        """Initialize the repository with empty storage and load persisted data."""
        self._store = JsonFileStore("trade_analysis_trades")
        self._trades: Dict[str, List[TradeRecord]] = {}
        self._load()

    def _load(self) -> None:
        """Load persisted trade records from JSON file."""
        raw_data = self._store.get_all()
        if raw_data:
            for user_id, trades_data in raw_data.items():
                self._trades[user_id] = [
                    self._deserialize_trade(t) if isinstance(t, dict) else t
                    for t in trades_data
                ]

    def _save(self) -> None:
        """Persist all trade records to JSON file."""
        serialized: Dict[str, Any] = {}
        for user_id, trades in self._trades.items():
            serialized[user_id] = [
                self._serialize_trade(trade) for trade in trades
            ]
        self._store.set_all(serialized)

    def _serialize_trade(self, trade: TradeRecord) -> Dict[str, Any]:
        """Serialize a TradeRecord to a dict for JSON storage."""
        data = dataclasses.asdict(trade)
        # Convert datetime objects to ISO strings
        for key in ("entry_date", "exit_date", "created_at", "updated_at"):
            if data.get(key) and isinstance(data[key], datetime):
                data[key] = data[key].isoformat()
        # Convert enum to value
        if data.get("direction"):
            data["direction"] = data["direction"] if isinstance(data["direction"], str) else data["direction"].value
        if data.get("market_regime"):
            data["market_regime"] = data["market_regime"] if isinstance(data["market_regime"], str) else data["market_regime"].value
        return data

    def _deserialize_trade(self, data: Dict[str, Any]) -> TradeRecord:
        """Deserialize a dict back to a TradeRecord."""
        # Convert ISO strings back to datetime
        for key in ("entry_date", "exit_date", "created_at", "updated_at"):
            if data.get(key) and isinstance(data[key], str):
                data[key] = datetime.fromisoformat(data[key])
        # Convert string back to enum
        if data.get("direction") and isinstance(data["direction"], str):
            data["direction"] = TradeDirection(data["direction"])
        if data.get("market_regime") and isinstance(data["market_regime"], str):
            data["market_regime"] = MarketRegime(data["market_regime"])
        return TradeRecord(**data)

    def persist_trades(self, user_id: str, trades: List[TradeRecord]) -> None:
        """
        Store trades for a given user.

        Appends to existing trades for the user.

        Args:
            user_id: The user identifier.
            trades: List of TradeRecords to persist.
        """
        if user_id not in self._trades:
            self._trades[user_id] = []
        self._trades[user_id].extend(trades)
        self._save()
        logger.debug(f"Persisted {len(trades)} trades for user {user_id}")

    def get_trades(self, user_id: str) -> List[TradeRecord]:
        """
        Retrieve all trades for a user.

        Args:
            user_id: The user identifier.

        Returns:
            List of TradeRecords for the user (empty list if none).
        """
        return self._trades.get(user_id, [])

    def update_enrichment(self, trade_id: str, enrichment_data: dict) -> bool:
        """
        Update enrichment fields for a specific trade.

        Searches across all users for the trade_id.

        Args:
            trade_id: The trade ID to update.
            enrichment_data: Dictionary of enrichment fields to update.

        Returns:
            True if trade was found and updated, False otherwise.
        """
        for user_id, trades in self._trades.items():
            for trade in trades:
                if trade.id == trade_id:
                    # Update enrichment fields
                    for key, value in enrichment_data.items():
                        if hasattr(trade, key):
                            setattr(trade, key, value)
                    self._save()
                    logger.debug(f"Updated enrichment for trade {trade_id}")
                    return True

        logger.warning(f"Trade {trade_id} not found for enrichment update")
        return False

    def get_trade_by_id(self, trade_id: str) -> Optional[TradeRecord]:
        """
        Find a specific trade by its ID.

        Args:
            trade_id: The trade ID to find.

        Returns:
            TradeRecord if found, None otherwise.
        """
        for user_id, trades in self._trades.items():
            for trade in trades:
                if trade.id == trade_id:
                    return trade
        return None

    def get_trades_by_strategy(self, user_id: str, strategy: str) -> List[TradeRecord]:
        """
        Retrieve trades for a user filtered by strategy field.

        Args:
            user_id: The user identifier.
            strategy: The strategy value to filter by (e.g., "paper_trade", "live_stock", "live_options").

        Returns:
            List of TradeRecords matching the given strategy (empty list if none).

        Requirements: 6.2
        """
        all_trades = self.get_trades(user_id)
        return [trade for trade in all_trades if trade.strategy == strategy]

    def clear_user_trades(self, user_id: str) -> None:
        """
        Remove all trades for a user.

        Args:
            user_id: The user identifier.
        """
        if user_id in self._trades:
            del self._trades[user_id]
            self._save()
            logger.debug(f"Cleared all trades for user {user_id}")
