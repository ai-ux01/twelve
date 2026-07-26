"""
Database migration runner for Options Scalping Agent.

This script applies SQL migrations for the scalper module.
It reads the PostgreSQL connection string from environment variables
and executes migration files in order.

Usage:
    python -m scalper.migrations.run_migration

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
        Example: postgresql://user:password@localhost:5432/twelve
"""

import os
import sys
from pathlib import Path


def get_migration_files() -> list:
    """Get all SQL migration files in order."""
    migrations_dir = Path(__file__).parent
    sql_files = sorted(migrations_dir.glob("*.sql"))
    return sql_files


def run_migrations(database_url: str = None) -> None:
    """
    Run all pending database migrations.

    Args:
        database_url: PostgreSQL connection string. If None, reads from
                     DATABASE_URL environment variable.
    """
    try:
        import psycopg2
    except ImportError:
        print("Error: psycopg2 is required for database migrations.")
        print("Install with: pip install psycopg2-binary")
        sys.exit(1)

    if database_url is None:
        database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        print("Error: DATABASE_URL environment variable is not set.")
        print("Set it with: export DATABASE_URL=postgresql://user:password@localhost:5432/twelve")
        sys.exit(1)

    migration_files = get_migration_files()

    if not migration_files:
        print("No migration files found.")
        return

    print(f"Found {len(migration_files)} migration(s) to apply:")
    for f in migration_files:
        print(f"  - {f.name}")

    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cursor = conn.cursor()

        for migration_file in migration_files:
            print(f"\nApplying migration: {migration_file.name}")
            sql_content = migration_file.read_text()
            cursor.execute(sql_content)
            print(f"  ✓ {migration_file.name} applied successfully")

        conn.commit()
        print("\n✓ All migrations applied successfully!")

    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        if "conn" in locals():
            conn.rollback()
        sys.exit(1)

    finally:
        if "cursor" in locals():
            cursor.close()
        if "conn" in locals():
            conn.close()


if __name__ == "__main__":
    run_migrations()
