"""
Auto-Trade Configuration Module.

Provides per-user configuration for the Signal Forwarder, controlling which
signal sources are enabled, confidence thresholds, default quantities,
and duplicate suppression window.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Any, Dict

from persistence.json_store import JsonFileStore

logger = logging.getLogger(__name__)


@dataclass
class AutoTradeConfigData:
    """Per-user auto-trade configuration."""

    options_scalper_enabled: bool = True
    swing_scanner_enabled: bool = True
    intraday_scorer_enabled: bool = True
    options_scalper_threshold: float = 70.0
    swing_scanner_threshold: float = 65.0
    intraday_scorer_threshold: float = 70.0
    default_swing_quantity: int = 1
    default_intraday_quantity: int = 1
    duplicate_window_minutes: int = 60


# Validation ranges for numeric config fields
_VALIDATION_RANGES: Dict[str, tuple] = {
    "options_scalper_threshold": (50.0, 95.0),
    "swing_scanner_threshold": (0.0, 100.0),
    "intraday_scorer_threshold": (0.0, 100.0),
    "duplicate_window_minutes": (1, 1440),
}


class AutoTradeConfigService:
    """Service for managing per-user auto-trade configuration."""

    def __init__(self, store: JsonFileStore | None = None):
        """
        Initialize the config service.

        Args:
            store: JsonFileStore instance. If None, creates one at
                   apps/quant/data/auto_trade_config.json.
        """
        self._store = store or JsonFileStore("auto_trade_config")

    def get_config(self, user_id: str) -> AutoTradeConfigData:
        """
        Get config for a user, returning defaults if none exists.

        Args:
            user_id: The user identifier.

        Returns:
            AutoTradeConfigData with the user's settings or defaults.
        """
        data = self._store.get(user_id)
        if data is None:
            logger.debug(f"No config found for user '{user_id}', returning defaults")
            return AutoTradeConfigData()

        # Reconstruct dataclass from stored dict
        return AutoTradeConfigData(
            options_scalper_enabled=data.get("options_scalper_enabled", True),
            swing_scanner_enabled=data.get("swing_scanner_enabled", True),
            intraday_scorer_enabled=data.get("intraday_scorer_enabled", True),
            options_scalper_threshold=float(data.get("options_scalper_threshold", 70.0)),
            swing_scanner_threshold=float(data.get("swing_scanner_threshold", 65.0)),
            intraday_scorer_threshold=float(data.get("intraday_scorer_threshold", 70.0)),
            default_swing_quantity=int(data.get("default_swing_quantity", 1)),
            default_intraday_quantity=int(data.get("default_intraday_quantity", 1)),
            duplicate_window_minutes=int(data.get("duplicate_window_minutes", 60)),
        )

    def update_config(self, user_id: str, updates: Dict[str, Any]) -> AutoTradeConfigData:
        """
        Update config fields for a user, validating ranges.

        Args:
            user_id: The user identifier.
            updates: Dictionary of field names to new values.

        Returns:
            The updated AutoTradeConfigData.

        Raises:
            ValueError: If any value is outside its valid range.
        """
        # Validate ranges before applying
        for field_name, value in updates.items():
            if field_name in _VALIDATION_RANGES:
                min_val, max_val = _VALIDATION_RANGES[field_name]
                if not (min_val <= value <= max_val):
                    raise ValueError(
                        f"{field_name} must be between {min_val} and {max_val}, got {value}"
                    )

        # Load current config
        current = self.get_config(user_id)
        current_dict = asdict(current)

        # Apply valid updates
        for field_name, value in updates.items():
            if field_name in current_dict:
                current_dict[field_name] = value

        # Persist
        self._store.set(user_id, current_dict)
        logger.info(f"Updated auto-trade config for user '{user_id}': {list(updates.keys())}")

        # Return updated config
        return AutoTradeConfigData(**current_dict)
