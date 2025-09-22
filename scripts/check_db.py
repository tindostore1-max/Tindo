#!/usr/bin/env python3
"""
Quick SQLite checker for this project.

Usage examples:
  - Use DATABASE_PATH from env (recommended):
      python scripts/check_db.py
  - Specify a path explicitly:
      python scripts/check_db.py --db /path/to/inefablestore.db

It prints:
  - Effective database path and whether the file exists
  - Connectivity via sqlite3
  - List of tables in sqlite_master
  - Presence of required tables
  - Row counts for key tables (if present)
  - Admin users count in `usuarios` (if present)
"""
import os
import sys
import sqlite3
import argparse
from typing import List

REQUIRED_TABLES: List[str] = [
    "usuarios",
    "juegos",
    "paquetes",
    "ordenes",
    "imagenes",
    "configuracion",
    "valoraciones",
]


def connect_sqlite(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def list_tables(conn: sqlite3.Connection) -> List[str]:
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    return [row[0] for row in cur.fetchall()]


def table_count(conn: sqlite3.Connection, table: str) -> int:
    try:
        cur = conn.execute(f"SELECT COUNT(*) FROM {table}")
        return int(cur.fetchone()[0])
    except Exception:
        return -1


def main() -> int:
    parser = argparse.ArgumentParser(description="Check project SQLite DB tables and counts")
    parser.add_argument("--db", dest="db_path", default=None, help="Path to SQLite database file. Defaults to env DATABASE_PATH or inefablestore.db")
    args = parser.parse_args()

    db_path = args.db_path or os.environ.get("DATABASE_PATH", "inefablestore.db")

    print("=== SQLite Check ===")
    print(f"DATABASE_PATH: {db_path}")
    print(f"File exists:   {os.path.exists(db_path)}")

    try:
        conn = connect_sqlite(db_path)
    except Exception as e:
        print(f"Connect error: {e}")
        return 1

    try:
        # Basic pragma
        conn.execute("PRAGMA journal_mode")
        print("Connect OK:    True")

        tables = list_tables(conn)
        print("\nTables (sqlite_master):")
        for t in tables:
            print(f"  - {t}")

        # Required presence
        print("\nRequired tables present:")
        for t in REQUIRED_TABLES:
            print(f"  {t:15} : {'YES' if t in tables else 'NO'}")

        # Counts
        print("\nRow counts:")
        for t in ["usuarios", "juegos", "paquetes", "ordenes", "valoraciones", "configuracion"]:
            if t in tables:
                cnt = table_count(conn, t)
                print(f"  {t:15} : {cnt}")

        # Admins count if table exists
        if "usuarios" in tables:
            try:
                cur = conn.execute("SELECT COUNT(*) FROM usuarios WHERE es_admin = 1")
                admins = int(cur.fetchone()[0])
                print(f"\nAdmins total: {admins}")
            except Exception as e:
                print(f"Admins check error: {e}")

    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
