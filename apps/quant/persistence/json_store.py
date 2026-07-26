"""
JSON File-based Persistence Store.

Provides a thread-safe, write-through JSON file store that automatically
saves/loads Python dicts to/from JSON files in the data/ directory.

Features:
- Auto-creates data/ directory
- Auto-loads existing data on initialization
- Write-through: saves after every mutation
- Thread-safe with threading.Lock
- Handles datetime (ISO format), enum (.value), dataclass, and Pydantic model serialization
"""

from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Data directory relative to the quant app root
_QUANT_ROOT = Path(__file__).parent.parent
DATA_DIR = _QUANT_ROOT / "data"


class _CustomEncoder(json.JSONEncoder):
    """Custom JSON encoder handling datetime, enum, dataclass, and Pydantic models."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return {"__datetime__": True, "value": obj.isoformat()}
        if isinstance(obj, Enum):
            return {"__enum__": True, "type": type(obj).__name__, "value": obj.value}
        # Pydantic BaseModel
        if hasattr(obj, "model_dump"):
            return {"__pydantic__": True, "data": obj.model_dump(mode="python")}
        # dataclass
        if hasattr(obj, "__dataclass_fields__"):
            import dataclasses
            return {"__dataclass__": True, "data": dataclasses.asdict(obj)}
        # Fallback for other objects
        try:
            return super().default(obj)
        except TypeError:
            return str(obj)


def _custom_decoder(obj: Dict[str, Any]) -> Any:
    """Custom JSON decoder hook for datetime and enum markers."""
    if "__datetime__" in obj:
        return datetime.fromisoformat(obj["value"])
    # Enums and complex types are stored as plain dicts on decode
    # They'll be reconstructed by the module when loading
    if "__enum__" in obj:
        return obj["value"]
    if "__pydantic__" in obj:
        return obj["data"]
    if "__dataclass__" in obj:
        return obj["data"]
    return obj


class JsonFileStore:
    """
    Thread-safe JSON file-based persistence store.

    Wraps an in-memory dict with automatic save/load to a JSON file.
    The file is stored in apps/quant/data/<module_name>.json.

    Usage:
        store = JsonFileStore("trading_lab_sessions")
        store.set("key", {"some": "data"})
        value = store.get("key")
        store.delete("key")
    """

    def __init__(self, module_name: str):
        """
        Initialize the store, creating the data directory and loading existing data.

        Args:
            module_name: Name used for the JSON file (without .json extension).
        """
        self._module_name = module_name
        self._lock = threading.Lock()
        self._data: Dict[str, Any] = {}

        # Ensure data directory exists
        DATA_DIR.mkdir(parents=True, exist_ok=True)

        self._file_path = DATA_DIR / f"{module_name}.json"
        self._load()

    @property
    def file_path(self) -> Path:
        """Return the path to the JSON file."""
        return self._file_path

    @property
    def module_name(self) -> str:
        """Return the module name."""
        return self._module_name

    def _load(self) -> None:
        """Load data from the JSON file if it exists."""
        with self._lock:
            if self._file_path.exists():
                try:
                    with open(self._file_path, "r", encoding="utf-8") as f:
                        self._data = json.load(f, object_hook=_custom_decoder)
                    logger.info(f"Loaded data from {self._file_path}")
                except (json.JSONDecodeError, OSError) as e:
                    logger.warning(
                        f"Failed to load {self._file_path}, starting fresh: {e}"
                    )
                    self._data = {}
            else:
                logger.debug(f"No existing data file at {self._file_path}")

    def _save(self) -> None:
        """Save current data to the JSON file (write-through)."""
        with self._lock:
            try:
                # Write to temp file first, then rename for atomicity
                tmp_path = self._file_path.with_suffix(".json.tmp")
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(self._data, f, cls=_CustomEncoder, indent=2)
                # Atomic rename on POSIX systems
                os.replace(str(tmp_path), str(self._file_path))
                logger.debug(f"Saved data to {self._file_path}")
            except OSError as e:
                logger.error(f"Failed to save {self._file_path}: {e}")

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a value by key.

        Args:
            key: The key to look up.
            default: Default value if key not found.

        Returns:
            The stored value, or default.
        """
        with self._lock:
            return self._data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """
        Set a value by key and persist to disk.

        Args:
            key: The key to store under.
            value: The value to store.
        """
        self._data[key] = value
        self._save()

    def delete(self, key: str) -> bool:
        """
        Delete a key and persist to disk.

        Args:
            key: The key to delete.

        Returns:
            True if key was found and deleted, False otherwise.
        """
        if key in self._data:
            del self._data[key]
            self._save()
            return True
        return False

    def get_all(self) -> Dict[str, Any]:
        """
        Get all stored data.

        Returns:
            A copy of the internal data dictionary.
        """
        with self._lock:
            return dict(self._data)

    def set_all(self, data: Dict[str, Any]) -> None:
        """
        Replace all stored data and persist to disk.

        Args:
            data: The complete data dictionary to store.
        """
        self._data = data
        self._save()

    def clear(self) -> None:
        """Clear all data and persist the empty state."""
        self._data = {}
        self._save()

    def keys(self) -> list:
        """Return all keys."""
        with self._lock:
            return list(self._data.keys())

    def __contains__(self, key: str) -> bool:
        """Check if a key exists."""
        with self._lock:
            return key in self._data

    def __len__(self) -> int:
        """Return number of stored keys."""
        with self._lock:
            return len(self._data)
