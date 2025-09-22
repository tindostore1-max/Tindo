import os
import argparse
import sqlite3
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash


def ensure_db_path(db_path: str) -> str:
    if not db_path:
        return 'inefablestore.db'
    return db_path


def upsert_admin(db_path: str, email: str, password: str, name: str = 'Administrador') -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Asegurar tabla usuarios (por si se ejecuta antes de iniciar la app)
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                telefono TEXT,
                password_hash TEXT NOT NULL,
                es_admin INTEGER DEFAULT 0,
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # Ver si existe
        cur.execute("SELECT id FROM usuarios WHERE email = ?", (email,))
        row = cur.fetchone()

        pwd_hash = generate_password_hash(password)
        if row is None:
            cur.execute(
                """
                INSERT INTO usuarios (nombre, email, password_hash, es_admin)
                VALUES (?, ?, ?, 1)
                """,
                (name, email, pwd_hash),
            )
            print(f"✅ Admin creado: {email}")
        else:
            cur.execute(
                """
                UPDATE usuarios
                SET es_admin = 1, password_hash = ?
                WHERE email = ?
                """,
                (pwd_hash, email),
            )
            print(f"✅ Admin actualizado: {email}")

        conn.commit()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Crear o actualizar un usuario administrador en SQLite')
    parser.add_argument('--email', type=str, help='Correo del administrador')
    parser.add_argument('--password', type=str, help='Contraseña del administrador')
    parser.add_argument('--name', type=str, default='Administrador', help='Nombre del administrador')
    args = parser.parse_args()

    load_dotenv()
    email = args.email or os.getenv('ADMIN_EMAIL')
    password = args.password or os.getenv('ADMIN_PASSWORD')
    if not email or not password:
        raise SystemExit('ERROR: Debes especificar --email y --password o definir ADMIN_EMAIL y ADMIN_PASSWORD en el entorno/.env')

    db_path = ensure_db_path(os.getenv('DATABASE_PATH', 'inefablestore.db'))
    print(f"Usando base de datos: {db_path}")

    upsert_admin(db_path=db_path, email=email, password=password, name=args.name)


if __name__ == '__main__':
    main()
