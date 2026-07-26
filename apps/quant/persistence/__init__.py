"""
Persistence module for the Quant Engine.

Provides pluggable storage backends (JSON file-based and PostgreSQL)
with a factory function to select based on environment configuration.

Usage:
    from persistence import get_store, JsonFileStore

    # Direct usage
    store = JsonFileStore("my_module")

    # Factory-based (respects PERSISTENCE_BACKEND env var)
    store = get_store("my_module")
"""

from __future__ import annotations

import os
from typing import Union

from .json_store import JsonFileStore
from .postgres_store import PostgresStore

# Configuration
PERSISTENCE_BACKEND = os.environ.get("PERSISTENCE_BACKEND", "json").lower()


def get_store(module_name: str) -> Union[JsonFileStore, PostgresStore]:
    """
    Factory function to get the appropriate store based on configuration.

    Args:
        module_name: Identifier for the module (used as filename or table partition).

    Returns:
        Either a JsonFileStore or PostgresStore instance.

    Raises:
        ValueError: If PERSISTENCE_BACKEND is not 'json' or 'postgres'.
    """
    backend = os.environ.get("PERSISTENCE_BACKEND", "json").lower()

    if backend == "json":
        return JsonFileStore(module_name)
    elif backend == "postgres":
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise ValueError(
                "DATABASE_URL environment variable is required for postgres backend"
            )
        return PostgresStore(module_name, database_url)
    else:
        raise ValueError(
            f"Unknown PERSISTENCE_BACKEND: '{backend}'. Use 'json' or 'postgres'."
        )


__all__ = [
    "JsonFileStore",
    "PostgresStore",
    "get_store",
    "PERSISTENCE_BACKEND",
]
