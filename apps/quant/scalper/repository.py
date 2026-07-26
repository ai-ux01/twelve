"""
Repository classes for the Options Scalping Agent.

Provides data access abstraction for:
- Analysis history storage and retrieval (AnalysisHistoryRepository)
- Configuration management (ConfigurationRepository)

Currently uses async in-memory implementations. The actual PostgreSQL
connection will be wired later when the DB migration is run. The repository
serves as an abstraction layer that the router and orchestrator can use.

Requirements: 20.1, 20.2, 20.3, 20.4, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.14,
              22.6, 30.11, 30.12, 30.13
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional, Tuple

from scalper.models import ScalperAnalysisResult, ScalperConfiguration, ScalperSignalType

logger = logging.getLogger(__name__)


# ============================================================
# Analysis History Repository
# ============================================================


class AnalysisHistoryRepository:
    """
    Repository for analysis history storage and retrieval.

    Stores complete AnalysisResult records and provides filtering,
    pagination, and cleanup functionality.

    Current implementation: async in-memory storage.
    Future: PostgreSQL via SQLAlchemy/asyncpg.

    Requirements: 20.1, 20.2, 20.3, 20.4, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.14, 22.6
    """

    # Records older than this are deleted by cleanup
    RETENTION_DAYS = 90

    def __init__(self) -> None:
        """Initialize the in-memory analysis history store."""
        self._records: List[dict] = []
        self._id_counter: int = 0

    @property
    def record_count(self) -> int:
        """Total number of records in storage."""
        return len(self._records)

    async def store_analysis(self, analysis_result: ScalperAnalysisResult) -> Optional[int]:
        """
        Save a complete AnalysisResult to the analysis_history table.

        Handles storage failures gracefully: logs error, doesn't interrupt operation.

        Args:
            analysis_result: The complete analysis result to store.

        Returns:
            The record ID on success, None on failure.

        Requirements: 20.1, 20.2, 22.6
        """
        try:
            self._id_counter += 1
            record_id = self._id_counter

            # Serialize the analysis result to a dict for storage
            record = {
                "id": record_id,
                "timestamp": analysis_result.timestamp,
                "underlying": analysis_result.underlying,
                "signal_type": (
                    analysis_result.signal_type.value
                    if isinstance(analysis_result.signal_type, ScalperSignalType)
                    else analysis_result.signal_type
                ),
                "probability": analysis_result.probability,
                "risk_reward_ratio": analysis_result.risk_reward_ratio,
                "strike_price": analysis_result.strike_price,
                "expiry_date": analysis_result.expiry_date,
                "entry_price": analysis_result.entry_price,
                "target_price": analysis_result.target_price,
                "stop_loss": analysis_result.stop_loss,
                "lot_size": analysis_result.lot_size,
                "spot_price": analysis_result.spot_price,
                "trend": (
                    analysis_result.trend.value
                    if hasattr(analysis_result.trend, "value")
                    else str(analysis_result.trend)
                ),
                "oi_interpretation": (
                    analysis_result.oi_interpretation.value
                    if hasattr(analysis_result.oi_interpretation, "value")
                    else str(analysis_result.oi_interpretation)
                ),
                "pcr": analysis_result.pcr,
                "trendline_status": (
                    analysis_result.trendline_status.value
                    if hasattr(analysis_result.trendline_status, "value")
                    else str(analysis_result.trendline_status)
                ),
                "support_level": analysis_result.support_level,
                "resistance_level": analysis_result.resistance_level,
                "rsi": analysis_result.rsi,
                "macd": analysis_result.macd,
                "macd_signal": analysis_result.macd_signal,
                "vwap": analysis_result.vwap,
                "ema_5": analysis_result.ema_5,
                "ema_15": analysis_result.ema_15,
                "atr": analysis_result.atr,
                "volume_ratio": analysis_result.volume_ratio,
                "call_oi": analysis_result.call_oi,
                "put_oi": analysis_result.put_oi,
                "call_oi_change": analysis_result.call_oi_change,
                "put_oi_change": analysis_result.put_oi_change,
                "atm_iv": analysis_result.atm_iv,
                "rationale": analysis_result.rationale,
                "hold_reason": analysis_result.hold_reason,
            }

            self._records.append(record)

            logger.info(
                f"Stored analysis record #{record_id} for "
                f"{analysis_result.underlying} - {analysis_result.signal_type}"
            )
            return record_id

        except Exception as e:
            # Handle storage failures gracefully - log error, don't interrupt
            logger.error(
                f"Failed to store analysis result: {e}. "
                "Operation continues without storage.",
                exc_info=True,
            )
            return None

    async def get_analysis_history(
        self,
        underlying: Optional[str] = None,
        signal_type: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[dict], int]:
        """
        Retrieve filtered and paginated analysis history.

        Args:
            underlying: Filter by underlying ("NIFTY" or "BANKNIFTY"), None for all.
            signal_type: Filter by signal type ("BUY CE", "BUY PE", "HOLD"), None for all.
            date_from: Filter records from this datetime (inclusive), None for no lower bound.
            date_to: Filter records up to this datetime (inclusive), None for no upper bound.
            page: Page number (1-indexed, default 1).
            page_size: Records per page (default 50, max 100).

        Returns:
            Tuple of (list of records, total matching record count).

        Requirements: 20.3, 20.4, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11
        """
        try:
            # Clamp page_size to max 100
            page_size = min(page_size, 100)

            # Apply filters
            filtered = self._records.copy()

            if underlying is not None:
                filtered = [
                    r for r in filtered if r["underlying"] == underlying
                ]

            if signal_type is not None:
                filtered = [
                    r for r in filtered if r["signal_type"] == signal_type
                ]

            if date_from is not None:
                filtered = [
                    r for r in filtered if r["timestamp"] >= date_from
                ]

            if date_to is not None:
                filtered = [
                    r for r in filtered if r["timestamp"] <= date_to
                ]

            # Sort by timestamp descending (most recent first)
            filtered.sort(key=lambda r: r["timestamp"], reverse=True)

            # Get total count before pagination
            total_count = len(filtered)

            # Paginate
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            page_data = filtered[start_idx:end_idx]

            return page_data, total_count

        except Exception as e:
            logger.error(f"Failed to retrieve analysis history: {e}", exc_info=True)
            return [], 0

    async def cleanup_old_records(self) -> int:
        """
        Delete records older than 90 days.

        Intended to be run daily at 00:00 IST.

        Returns:
            Number of records deleted.

        Requirements: 20.14
        """
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=self.RETENTION_DAYS)
            initial_count = len(self._records)

            self._records = [
                r for r in self._records
                if r["timestamp"] >= cutoff_date
            ]

            deleted_count = initial_count - len(self._records)

            if deleted_count > 0:
                logger.info(
                    f"Cleaned up {deleted_count} old analysis records "
                    f"(older than {self.RETENTION_DAYS} days)"
                )

            return deleted_count

        except Exception as e:
            logger.error(f"Failed to cleanup old records: {e}", exc_info=True)
            return 0

    async def get_record_by_id(self, record_id: int) -> Optional[dict]:
        """
        Retrieve a single record by ID.

        Args:
            record_id: The record ID to look up.

        Returns:
            The record dict or None if not found.
        """
        for record in self._records:
            if record["id"] == record_id:
                return record
        return None

    def clear(self) -> None:
        """Clear all records (for testing purposes)."""
        self._records.clear()
        self._id_counter = 0


# ============================================================
# Configuration Repository
# ============================================================


class ConfigurationRepository:
    """
    Repository for user configuration management.

    Stores and retrieves ScalperConfiguration for users. Returns
    default values if no configuration exists for a user.

    Current implementation: async in-memory storage.
    Future: PostgreSQL via SQLAlchemy/asyncpg.

    Requirements: 30.11, 30.12, 30.13
    """

    def __init__(self) -> None:
        """Initialize the in-memory configuration store."""
        self._configs: dict[str, ScalperConfiguration] = {}

    async def get_config(self, user_id: str) -> ScalperConfiguration:
        """
        Retrieve the ScalperConfiguration for a user.

        Returns default values if no configuration exists for the user.

        Args:
            user_id: The user ID to retrieve configuration for.

        Returns:
            The user's ScalperConfiguration (with defaults if not found).

        Requirements: 30.11, 30.13
        """
        try:
            config = self._configs.get(user_id)
            if config is None:
                # Return default configuration for the user
                config = ScalperConfiguration(
                    user_id=user_id,
                    refresh_interval=60,
                    probability_threshold=70.0,
                    risk_reward_threshold=2.0,
                    max_spread_percentage=5.0,
                    min_open_interest=1000,
                )
                logger.info(
                    f"No config found for user '{user_id}', returning defaults"
                )
            return config

        except Exception as e:
            logger.error(
                f"Failed to retrieve config for user '{user_id}': {e}",
                exc_info=True,
            )
            # Return defaults on error
            return ScalperConfiguration(
                user_id=user_id,
                refresh_interval=60,
                probability_threshold=70.0,
                risk_reward_threshold=2.0,
                max_spread_percentage=5.0,
                min_open_interest=1000,
            )

    async def save_config(self, config: ScalperConfiguration) -> bool:
        """
        Persist configuration changes for a user.

        Args:
            config: The ScalperConfiguration to save.

        Returns:
            True on success, False on failure.

        Requirements: 30.12
        """
        try:
            self._configs[config.user_id] = config
            logger.info(
                f"Saved configuration for user '{config.user_id}': "
                f"interval={config.refresh_interval}s, "
                f"prob_threshold={config.probability_threshold}%, "
                f"rr_threshold={config.risk_reward_threshold}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to save config for user '{config.user_id}': {e}",
                exc_info=True,
            )
            return False

    async def delete_config(self, user_id: str) -> bool:
        """
        Delete a user's configuration (resets to defaults).

        Args:
            user_id: The user ID whose config to delete.

        Returns:
            True if config was deleted, False if not found.
        """
        if user_id in self._configs:
            del self._configs[user_id]
            logger.info(f"Deleted configuration for user '{user_id}'")
            return True
        return False

    def clear(self) -> None:
        """Clear all stored configurations (for testing purposes)."""
        self._configs.clear()
