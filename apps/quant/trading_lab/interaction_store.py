"""
AI Trading Lab Interaction Store.

This module implements in-memory storage for decision records (prompt-response
interactions), providing persistence and paginated retrieval ordered by
creation timestamp.

Requirements: 5.1, 5.2, 5.3, 5.4
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Tuple
from uuid import uuid4

from .models import DecisionRecord

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from persistence.json_store import JsonFileStore

logger = logging.getLogger(__name__)


class InteractionStore:
    """
    In-memory store for AI Trading Lab decision records.

    Stores records keyed by session_id with support for paginated retrieval
    in descending chronological order. Each instance generates a unique
    agent_id for provenance tracking.

    Data is automatically persisted to data/trading_lab_sessions.json.

    Requirements: 5.1, 5.2, 5.3, 5.4
    """

    MAX_PAGE_SIZE: int = 100

    def __init__(self):
        """Initialize the interaction store with empty storage and a unique agent_id."""
        self._store = JsonFileStore("trading_lab_sessions")
        self._records: Dict[str, List[DecisionRecord]] = {}
        self._agent_id: str = f"ai-trading-lab-{uuid4().hex[:8]}"
        self._load()

    @property
    def agent_id(self) -> str:
        """Return the agent_id for this store instance."""
        return self._agent_id

    def _load(self) -> None:
        """Load persisted records from JSON file."""
        raw_data = self._store.get_all()
        if raw_data:
            for session_id, records_data in raw_data.items():
                if session_id.startswith("_"):
                    continue
                self._records[session_id] = [
                    DecisionRecord(**record) if isinstance(record, dict) else record
                    for record in records_data
                ]

    def _save(self) -> None:
        """Persist all records to JSON file."""
        serialized: Dict[str, Any] = {}
        for session_id, records in self._records.items():
            serialized[session_id] = [
                record.model_dump(mode="python") for record in records
            ]
        self._store.set_all(serialized)

    def persist(self, session_id: str, record: DecisionRecord) -> None:
        """
        Store a decision record for a given session.

        Args:
            session_id: The user session identifier.
            record: The DecisionRecord to persist.
        """
        if session_id not in self._records:
            self._records[session_id] = []
        self._records[session_id].append(record)
        self._save()
        logger.debug(
            f"Persisted decision {record.decision_id} for session {session_id}"
        )

    def get_history(
        self, session_id: str, page: int = 1, page_size: int = 20
    ) -> Tuple[List[DecisionRecord], int]:
        """
        Get paginated history for a session, ordered by created_at descending.

        Args:
            session_id: The user session identifier.
            page: Page number (1-indexed). Defaults to 1.
            page_size: Number of records per page. Defaults to 20.
                Clamped to maximum of 100.

        Returns:
            A tuple of (records_for_page, total_record_count).
            Returns ([], 0) for unknown session_id.
        """
        if session_id not in self._records:
            return ([], 0)

        # Clamp page_size to max
        page_size = min(page_size, self.MAX_PAGE_SIZE)

        # Get all records for session, sorted by created_at descending
        all_records = sorted(
            self._records[session_id],
            key=lambda r: r.created_at,
            reverse=True,
        )

        total = len(all_records)

        # Calculate pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        # Return the page slice
        page_records = all_records[start_idx:end_idx]

        return (page_records, total)
