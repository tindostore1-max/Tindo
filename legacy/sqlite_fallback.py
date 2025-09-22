"""
Obsoleto: inicialización SQLite ahora se hace desde main.py:init_db().
Este script se mantiene solo con fines históricos/legacy.
"""

import sqlite3

def create_sqlite_db(db_path='inefablestore.db'):
    conn = sqlite3.connect(db_path)
    conn.execute('SELECT 1')
    conn.close()
    print(f"SQLite OK en {db_path}")

if __name__ == '__main__':
    create_sqlite_db()
