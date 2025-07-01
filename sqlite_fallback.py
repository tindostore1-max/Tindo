
import sqlite3
import os

def create_sqlite_db():
    """Crear base de datos SQLite para desarrollo local"""
    conn = sqlite3.connect('inefablestore.db')
    cur = conn.cursor()
    
    # Leer y ejecutar el script SQL adaptado para SQLite
    with open('init_db.sql', 'r') as f:
        sql_script = f.read()
        # Adaptar para SQLite
        sql_script = sql_script.replace('SERIAL PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT')
        sql_script = sql_script.replace('NUMERIC(10,2)', 'REAL')
        sql_script = sql_script.replace('VARCHAR(', 'TEXT(')
        sql_script = sql_script.replace('INTERVAL', "'")
        
        # Ejecutar línea por línea
        for statement in sql_script.split(';'):
            if statement.strip():
                try:
                    cur.execute(statement)
                except Exception as e:
                    print(f"Error ejecutando: {statement[:50]}... - {e}")
    
    conn.commit()
    conn.close()
    print("Base de datos SQLite creada exitosamente")

if __name__ == "__main__":
    create_sqlite_db()
