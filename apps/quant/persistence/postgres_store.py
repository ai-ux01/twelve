"""
PostgreSQL Persistence Store.

Provides an async PostgreSQL-based persistence store using asyncpg.
Uses a single JSONB key-value table partitioned by module name.

This is the future migration path from JSON file-based storage.
Requires the DATABASE_URL environment variable to be set.

Features:
- Auto-creates table on first use (CREATE TABLE IF NOT EXISTS)
- JSONB columns for flexible storage
- Async methods: save, load, load_all, delete
- Module-partitioned key-value storage
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    import asyncpg
    HAS_ASYNCPG = True
except ImportError:
    HAS_ASYNCPG = False
    asyncpg = None


class _JsonSerializer:
    """JSON serializer for PostgreSQL JSONB columns."""

    @staticmethod
    def encode(obj: Any) -> str:
        """Encode Python object to JSON string with custom type handling."""
        return json.dumps(obj, default=_JsonSerializer._default_handler)

    @staticmethod
    def _default_handler(obj: Any) -> Any:
        if isinstance(obj, datetime):
            return {"__datetime__": True, "value": obj.isoformat()}
        if isinstance(obj, Enum):
            return obj.value
        if hasattr(obj, "model_dump"):
            return obj.model_dump(mode="python")
        if hasattr(obj, "__dataclass_fields__"):
            import dataclasses
            return dataclasses.asdict(obj)
        return str(obj)

    @staticmethod
    def decode(data: Any) -> Any:
        """Decode JSON data, handling datetime markers."""
        if isinstance(data, dict):
            if "__datetime__" in data:
                return datetime.fromisoformat(data["value"])
            return {k: _JsonSerializer.decode(v) for k, v in data.items()}
        if isinstance(data, list):
            return [_JsonSerializer.decode(item) for item in data]
        return data


class PostgresStore:
    """
    Async PostgreSQL-based persistence store.

    Uses a single 'quant_kv_store' table with JSONB columns for flexible storage.
    Each module gets its own partition via the 'module' column.

    Usage:
        store = PostgresStore("trading_lab_sessions", database_url)
        await store.initialize()
        await store.save("key", {"some": "data"})
        value = await store.load("key")
        all_data = await store.load_all()
        await store.delete("key")
    """

    TABLE_NAME = "quant_kv_store"

    def __init__(self, module_name: str, database_url: Optional[str] = None):
        """
        Initialize the PostgreSQL store.

        Args:
            module_name: Module identifier for partitioning data.
            database_url: PostgreSQL connection URL. Falls back to DATABASE_URL env var.
        """
        if not HAS_ASYNCPG:
            raise ImportError(
                "asyncpg is required for PostgresStore. "
                "Install it with: pip install asyncpg"
            )

        self._module_name = module_name
        self._database_url = database_url or os.environ.get("DATABASE_URL")
        if not self._database_url:
            raise ValueError(
                "DATABASE_URL must be provided or set as environment variable"
            )
        self._pool: Optional[asyncpg.Pool] = None
        self._initialized = False

    @property
    def module_name(self) -> str:
        """Return the module name."""
        return self._module_name

    async def initialize(self) -> None:
        """
        Initialize the connection pool and create the table if needed.

        Must be called before any other async operations.
        """
        if self._initialized:
            return

        self._pool = await asyncpg.create_pool(
            self._database_url,
            min_size=1,
            max_size=5,
        )

        # Create table if not exists
        async with self._pool.acquire() as conn:
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.TABLE_NAME} (
                    module TEXT NOT NULL,
                    key TEXT NOT NULL,
                    data JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (module, key)
                )
            """)
            # Create index for module lookups
            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS idx_{self.TABLE_NAME}_module
                ON {self.TABLE_NAME} (module)
            """)

        self._initialized = True
        logger.info(f"PostgresStore initialized for module '{self._module_name}'")

    async def close(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            self._initialized = False

    async def save(self, key: str, data: Any) -> None:
        """
        Save data for a key (upsert).

        Args:
            key: The storage key.
            data: The data to store (will be serialized to JSONB).
        """
        if not self._initialized:
            await self.initialize()

        json_data = json.loads(_JsonSerializer.encode(data))

        async with self._pool.acquire() as conn:
            await conn.execute(
                f"""
                INSERT INTO {self.TABLE_NAME} (module, key, data, created_at, updated_at)
                VALUES ($1, $2, $3::jsonb, NOW(), NOW())
                ON CONFLICT (module, key) DO UPDATE SET
                    data = $3::jsonb,
                    updated_at = NOW()
                """,
                self._module_name,
                key,
                json.dumps(json_data),
            )
        logger.debug(f"Saved key '{key}' for module '{self._module_name}'")

    async def load(self, key: str) -> Optional[Any]:
        """
        Load data for a key.

        Args:
            key: The storage key.

        Returns:
            The stored data, or None if not found.
        """
        if not self._initialized:
            await self.initialize()

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                SELECT data FROM {self.TABLE_NAME}
                WHERE module = $1 AND key = $2
                """,
                self._module_name,
                key,
            )

        if row is None:
            return None

        data = json.loads(row["data"]) if isinstance(row["data"], str) else row["data"]
        return _JsonSerializer.decode(data)

    async def load_all(self) -> Dict[str, Any]:
        """
        Load all key-value pairs for this module.

        Returns:
            Dictionary of all stored key-value pairs.
        """
        if not self._initialized:
            await self.initialize()

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT key, data FROM {self.TABLE_NAME}
                WHERE module = $1
                ORDER BY created_at
                """,
                self._module_name,
            )

        result = {}
        for row in rows:
            data = json.loads(row["data"]) if isinstance(row["data"], str) else row["data"]
            result[row["key"]] = _JsonSerializer.decode(data)
        return result

    async def delete(self, key: str) -> bool:
        """
        Delete a key.

        Args:
            key: The storage key.

        Returns:
            True if the key existed and was deleted, False otherwise.
        """
        if not self._initialized:
            await self.initialize()

        async with self._pool.acquire() as conn:
            result = await conn.execute(
                f"""
                DELETE FROM {self.TABLE_NAME}
                WHERE module = $1 AND key = $2
                """,
                self._module_name,
                key,
            )

        deleted = result.split()[-1] != "0"
        if deleted:
            logger.debug(f"Deleted key '{key}' for module '{self._module_name}'")
        return deleted

    async def delete_all(self) -> int:
        """
        Delete all keys for this module.

        Returns:
            Number of keys deleted.
        """
        if not self._initialized:
            await self.initialize()

        async with self._pool.acquire() as conn:
            result = await conn.execute(
                f"""
                DELETE FROM {self.TABLE_NAME}
                WHERE module = $1
                """,
                self._module_name,
            )

        count = int(result.split()[-1])
        logger.info(f"Deleted {count} keys for module '{self._module_name}'")
        return count
