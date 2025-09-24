from flask import Flask, request, jsonify, render_template, session, redirect, url_for
import os
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
import secrets
from datetime import datetime, timedelta
import uuid
import sqlite3
from pathlib import Path
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.message import EmailMessage
import threading
from dotenv import load_dotenv
import json
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu_clave_secreta_aqui')
app.config['UPLOAD_FOLDER'] = 'static/images'
# Versión de assets para cache busting (se puede sobreescribir con env var)
app.config['ASSET_VERSION'] = os.environ.get('ASSET_VERSION', str(int(time.time())))

# Forzar charset UTF-8 en respuestas de texto para evitar problemas de codificación en el navegador
@app.after_request
def add_utf8_charset(response):
    try:
        # Asegurar charset solo en tipos de texto comunes
        text_mimes = {
            'text/html',
            'text/css',
            'application/javascript',
            'text/javascript',
            'application/json',
        }
        if getattr(response, 'mimetype', None) in text_mimes:
            # Si ya tiene Content-Type, reemplazar/ajustar con charset=utf-8
            response.headers['Content-Type'] = f"{response.mimetype}; charset=utf-8"
    except Exception:
        pass
    return response

# ConfiguraciÃ³n de sesiÃ³n
from datetime import timedelta
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)  # 1 hora
app.config['SESSION_COOKIE_SECURE'] = False  # True en producciÃ³n con HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Previene acceso via JavaScript
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # ProtecciÃ³n CSRF

# Asegurar rutas de almacenamiento (DB persistente y carpeta de imÃ¡genes)
def ensure_storage_paths():
    """Crea el directorio del archivo de base de datos y de imÃ¡genes si no existen.
    - En Render, la variable DATABASE_PATH apunta al disco persistente montado (p.ej. /var/data/inefablestore.db)
    - Creamos el directorio padre si es necesario para evitar errores "no such file or directory".
    """
    try:
        db_path = os.environ.get('DATABASE_PATH', 'inefablestore.db')
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        # TambiÃ©n asegurar carpeta de imÃ¡genes usada por el proyecto
        os.makedirs('static/images', exist_ok=True)
        # Si la DB no existe aÃºn, intentar copiar una semilla incluida en el repo
        if not os.path.exists(db_path):
            seed_path = os.environ.get('SEED_DB_PATH', os.path.join('data', 'proyecto2', 'inefablestore.db'))
            try:
                if os.path.exists(seed_path):
                    import shutil
                    shutil.copyfile(seed_path, db_path)
                    print(f"ðŸŒ± Base de datos sembrada desde {seed_path} -> {db_path}")
                else:
                    print(f"â„¹ï¸ No se encontrÃ³ seed DB en {seed_path}. Se crearÃ¡ una DB nueva en el primer init_db().")
            except Exception as e:
                print(f"âš ï¸ Error copiando seed DB desde {seed_path} a {db_path}: {e}")
        print(f"ðŸ—‚ï¸ Rutas de almacenamiento listas. DB dir: {db_dir or os.getcwd()} | DB file: {db_path}")
    except Exception as e:
        print(f"âš ï¸ No se pudieron crear rutas de almacenamiento: {e}")

# Ejecutar inmediatamente para entornos como Gunicorn en Render
ensure_storage_paths()

# Nota: init_db() se invocarÃ¡ mÃ¡s abajo con un guard para evitar NameError y correrlo solo una vez

# ConfiguraciÃ³n de SQLAlchemy con SQLite
def create_db_engine():
    # Usar SQLite como base de datos por defecto
    db_path = os.environ.get('DATABASE_PATH', 'inefablestore.db')
    database_url = f"sqlite:///{db_path}"
    
    print(f"ðŸ”— Conectando con SQLite: {db_path}")

    try:
        # ConfiguraciÃ³n especÃ­fica para SQLite
        engine = create_engine(
            database_url,
            poolclass=StaticPool,  # Para SQLite
            pool_pre_ping=True,  # Para verificar conexiones antes de usarlas
            connect_args={
                "check_same_thread": False,  # Permitir acceso desde mÃºltiples threads
                "timeout": 30  # Timeout de conexiÃ³n
            },
            echo=False  # Cambiar a True para debug SQL
        )

        # Probar la conexiÃ³n
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))

        print("âœ… ConexiÃ³n a SQLite exitosa")
        return engine
    except Exception as e:
        print(f"âŒ Error conectando a SQLite: {e}")
        print("ðŸ’¡ Verifica que:")
        print("   - El directorio tenga permisos de escritura")
        print("   - No haya problemas de espacio en disco")
        raise e

# Engine global
db_engine = None

def get_db_connection():
    """Obtener conexiÃ³n a la base de datos usando SQLAlchemy"""
    global db_engine
    if db_engine is None:
        db_engine = create_db_engine()
    return db_engine.connect()

def _sqlite_column_exists(conn, table: str, column: str) -> bool:
    try:
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        cols = [row[1] for row in result.fetchall()]
        return column in cols
    except Exception:
        return False

def _ensure_sqlite_column(conn, table: str, column: str, ddl: str):
    """Ensure a column exists in a SQLite table. ddl must be 'column_name TYPE [DEFAULT ...]'."""
    if not _sqlite_column_exists(conn, table, column):
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
            print(f"ðŸ§© MigraciÃ³n SQLite: aÃ±adida columna {table}.{column}")
        except Exception as e:
            print(f"âš ï¸ No se pudo aÃ±adir columna {table}.{column}: {e}")

def get_sqlite_connection():
    """Obtener conexiÃ³n directa con sqlite3 para funciones que lo requieren"""
    db_path = os.environ.get('DATABASE_PATH', 'inefablestore.db')
    
    try:
        conn = sqlite3.connect(
            db_path,
            timeout=30,
            check_same_thread=False
        )
        # Configurar SQLite para que devuelva filas como diccionarios
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"âŒ Error en conexiÃ³n SQLite: {e}")
        print(f"ðŸ”— Ruta utilizada: {db_path}")
        raise e

def enviar_correo_gift_card_completada(orden_info):
    """EnvÃ­a correo al usuario con el cÃ³digo de la Gift Card"""
    try:
        # ConfiguraciÃ³n del correo
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        email_usuario = "1yorbi1@gmail.com"
        email_password = os.environ.get('GMAIL_APP_PASSWORD')

        print(f"ðŸŽ Enviando Gift Card completada para orden #{orden_info['id']}")
        print(f"ðŸ“§ Destinatario: {orden_info['usuario_email']}")

        if not email_password:
            print("âŒ ERROR: No se encontrÃ³ la contraseÃ±a de Gmail")
            return False

        # Crear mensaje
        mensaje = MIMEMultipart()
        mensaje['From'] = email_usuario
        mensaje['To'] = orden_info['usuario_email']
        mensaje['Subject'] = f"ðŸŽ Â¡Tu Gift Card estÃ¡ lista! - Orden #{orden_info['id']} - tindostore"

        # Cuerpo del mensaje especÃ­fico para Gift Cards
        cuerpo = f"""
        Â¡Hola! ðŸŽ

        Â¡Excelentes noticias! Tu Gift Card ha sido procesada exitosamente.

        ðŸ“‹ Detalles de tu orden:
        â€¢ Orden #: {orden_info['id']}
        â€¢ Producto: {orden_info.get('juego_nombre', 'Gift Card')}
        â€¢ Paquete: {orden_info['paquete']}
        â€¢ Monto: ${orden_info['monto']}
        â€¢ Estado: âœ… COMPLETADA
        â€¢ Fecha de procesamiento: {datetime.now().strftime('%d/%m/%Y a las %H:%M')}

        ðŸŽ¯ CÃ“DIGO DE TU GIFT CARD:
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        ðŸ”‘ {orden_info.get('codigo_producto', 'CÃ“DIGO NO DISPONIBLE')}
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

        ðŸ“ Instrucciones de uso:
        â€¢ Guarda este cÃ³digo en un lugar seguro
        â€¢ Utiliza este cÃ³digo en la plataforma correspondiente
        â€¢ El cÃ³digo es de un solo uso
        â€¢ Si tienes problemas para canjearlo, contÃ¡ctanos

        âš ï¸ IMPORTANTE: Este cÃ³digo es personal e intransferible.
        No lo compartas con nadie para evitar fraudes.

        Â¡Gracias por confiar en tindostore! ðŸš€

        ---
        Equipo de tindostore
        """

        mensaje.attach(MIMEText(cuerpo, 'plain'))

        print("ðŸ“¤ Enviando Gift Card con cÃ³digo al usuario...")
        # Enviar correo
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(email_usuario, email_password)
        texto = mensaje.as_string()
        server.sendmail(email_usuario, orden_info['usuario_email'], texto)
        server.quit()

        print(f"âœ… Gift Card enviada exitosamente a: {orden_info['usuario_email']}")
        return True

    except Exception as e:
        print(f"âŒ Error al enviar Gift Card: {str(e)}")
        return False

def enviar_correo_recarga_completada(orden_info):
    """EnvÃ­a correo al usuario confirmando que su recarga ha sido completada"""
    try:
        # ConfiguraciÃ³n del correo
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        email_usuario = "1yorbi1@gmail.com"
        email_password = os.environ.get('GMAIL_APP_PASSWORD')

        print(f"ðŸ“¨ Enviando confirmaciÃ³n de recarga completada para orden #{orden_info['id']}")
        print(f"ðŸ“§ Destinatario: {orden_info['usuario_email']}")

        if not email_password:
            print("âŒ ERROR: No se encontrÃ³ la contraseÃ±a de Gmail")
            return False

        # Crear mensaje
        mensaje = MIMEMultipart()
        mensaje['From'] = email_usuario
        mensaje['To'] = orden_info['usuario_email']
        # Asunto con marca Tindo Store
        mensaje['Subject'] = f"Tu recarga estÃ¡ lista - Orden #{orden_info['id']} - Tindo Store"

        # FunciÃ³n local para formatear la fecha en espaÃ±ol (evita depender del locale del sistema)
        meses_es = [
            "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
        ]
        ahora = datetime.now()
        fecha_es = f"{ahora.day} de {meses_es[ahora.month - 1]} de {ahora.year}"

        # Cuerpo del mensaje con el template solicitado
        cuerpo = f"""
Hola,

Gracias por tu compra. Nos complace informarte que tu pedido ha sido procesado con Ã©xito.

Detalles de la orden:  
ðŸ“… Fecha: {fecha_es}  
ðŸŽ® Producto: {orden_info.get('juego_nombre', 'N/A')}  
ðŸ†” ID de jugador: {orden_info.get('usuario_id', 'No especificado')}  
ðŸ’Ž Paquete adquirido: {orden_info.get('paquete', 'N/A')}  
ðŸ’° Costo: ${orden_info.get('monto', '0.00')} USD

Si necesitas asistencia o tienes alguna consulta, estamos aquÃ­ para ayudarte.

Atentamente,  
Equipo de Tindo Store
"""

        mensaje.attach(MIMEText(cuerpo, 'plain'))

        print("ðŸ“¤ Enviando correo de confirmaciÃ³n al usuario...")
        # Enviar correo
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(email_usuario, email_password)
        texto = mensaje.as_string()
        server.sendmail(email_usuario, orden_info['usuario_email'], texto)
        server.quit()

        print(f"âœ… Correo de confirmaciÃ³n enviado exitosamente a: {orden_info['usuario_email']}")
        return True

    except Exception as e:
        print(f"âŒ Error al enviar correo de confirmaciÃ³n: {str(e)}")
        return False

def enviar_correo_orden_rechazada(orden_info):
    """EnvÃ­a correo al usuario notificando que su orden ha sido rechazada por datos incorrectos"""
    try:
        # ConfiguraciÃ³n del correo
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        email_usuario = "1yorbi1@gmail.com"
        email_password = os.environ.get('GMAIL_APP_PASSWORD')

        print(f"ðŸ“§ Enviando notificaciÃ³n de orden rechazada para orden #{orden_info['id']}")
        print(f"ðŸ“§ Destinatario: {orden_info['usuario_email']}")

        if not email_password:
            print("âŒ ERROR: No se encontrÃ³ la contraseÃ±a de Gmail")
            return False

        # Crear mensaje
        mensaje = MIMEMultipart()
        mensaje['From'] = email_usuario
        mensaje['To'] = orden_info['usuario_email']
        mensaje['Subject'] = f"âš ï¸ Orden Rechazada - Datos Incorrectos - Orden #{orden_info['id']} - tindostore"

        # Cuerpo del mensaje para orden rechazada
        cuerpo = f"""
        Hola,

        Lamentamos informarte que tu orden ha sido rechazada debido a datos incorrectos.

        ðŸ“‹ Detalles de la orden rechazada:
        â€¢ Orden #: {orden_info['id']}
        â€¢ Juego: {orden_info.get('juego_nombre', 'N/A')}
        â€¢ Paquete: {orden_info['paquete']}
        â€¢ Monto: ${orden_info['monto']}
        â€¢ MÃ©todo de pago: {orden_info['metodo_pago']}
        â€¢ Referencia proporcionada: {orden_info['referencia_pago']}
        â€¢ Estado: âŒ RECHAZADA
        â€¢ Fecha de rechazo: {datetime.now().strftime('%d/%m/%Y a las %H:%M')}

        âš ï¸ Motivo del rechazo:
        No pudimos encontrar la referencia de pago proporcionada en nuestro sistema. 
        Esto puede deberse a:
        
        â€¢ Referencia de pago incorrecta o incompleta
        â€¢ El pago aÃºn no se ha procesado
        â€¢ Error al escribir la referencia

        ðŸ”„ Â¿QuÃ© puedes hacer?
        1. Verifica que la referencia de pago sea correcta
        2. AsegÃºrate de que el pago se haya completado exitosamente
        3. Contacta con nosotros si estÃ¡s seguro de que los datos son correctos
        4. Realiza una nueva orden con la informaciÃ³n correcta

        ðŸ“ž Contacto:
        Si tienes alguna duda o necesitas ayuda, no dudes en contactarnos a travÃ©s de nuestros canales de atenciÃ³n.

        Gracias por tu comprensiÃ³n.

        ---
        Equipo de tindostore
        """

        mensaje.attach(MIMEText(cuerpo, 'plain'))

        print("ðŸ“¤ Enviando correo de orden rechazada al usuario...")
        # Enviar correo
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(email_usuario, email_password)
        texto = mensaje.as_string()
        server.sendmail(email_usuario, orden_info['usuario_email'], texto)
        server.quit()

        print(f"âœ… Correo de orden rechazada enviado exitosamente a: {orden_info['usuario_email']}")
        return True

    except Exception as e:
        print(f"âŒ Error al enviar correo de orden rechazada: {str(e)}")
        return False

def limpiar_ordenes_antiguas(usuario_email):
    """Mantiene solo las Ãºltimas 40 Ã³rdenes por usuario, eliminando las mÃ¡s antiguas"""
    conn = get_db_connection()
    try:
        # Contar Ã³rdenes del usuario
        result = conn.execute(text('''
            SELECT COUNT(*) FROM ordenes WHERE usuario_email = :email
        '''), {'email': usuario_email})

        total_ordenes = result.fetchone()[0]

        # Si tiene mÃ¡s de 40 Ã³rdenes, eliminar las mÃ¡s antiguas
        if total_ordenes > 40:
            ordenes_a_eliminar = total_ordenes - 40

            # Obtener IDs de las Ã³rdenes mÃ¡s antiguas
            result = conn.execute(text('''
                SELECT id FROM ordenes 
                WHERE usuario_email = :email 
                ORDER BY fecha ASC 
                LIMIT :limit
            '''), {'email': usuario_email, 'limit': ordenes_a_eliminar})

            ids_a_eliminar = [row[0] for row in result.fetchall()]

            if ids_a_eliminar:
                # Eliminar las Ã³rdenes mÃ¡s antiguas
                for orden_id in ids_a_eliminar:
                    conn.execute(text('DELETE FROM ordenes WHERE id = :id'), {'id': orden_id})

                conn.commit()
                print(f"ðŸ§¹ Limpieza automÃ¡tica: Eliminadas {len(ids_a_eliminar)} Ã³rdenes antiguas del usuario {usuario_email}")

    except Exception as e:
        print(f"âŒ Error al limpiar Ã³rdenes antiguas: {e}")
        conn.rollback()
    finally:
        conn.close()

# Ejecutar init_db() una sola vez por proceso cuando lleguen las primeras solicitudes
_DB_INIT_DONE = False

@app.before_request
def _ensure_db_initialized_once():
    global _DB_INIT_DONE
    if not _DB_INIT_DONE:
        try:
            init_db()
            _DB_INIT_DONE = True
            print("âœ… init_db ejecutado (before_request, una sola vez por worker)")
        except Exception as e:
            # No bloquear la peticiÃ³n, pero loguear el error para diagnÃ³stico
            print(f"âš ï¸ Error ejecutando init_db en before_request: {e}")

# Endpoint pÃºblico de salud para verificar conexiÃ³n a SQLite en Render
@app.route('/health/db', methods=['GET'])
def health_db():
    db_path = os.environ.get('DATABASE_PATH', 'inefablestore.db')
    info = {
        'database_path': db_path,
        'db_file_exists': os.path.exists(db_path),
    }
    # Intentar conexiÃ³n y consultas bÃ¡sicas
    try:
        # Probar con SQLAlchemy
        conn = get_db_connection()
        try:
            conn.execute(text('SELECT 1'))
            info['sqlalchemy_connect'] = True
            # Probar existencia de tablas clave
            res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('usuarios','juegos','ordenes')"))
            info['tables_present'] = [r[0] for r in res.fetchall()]
            # Contar usuarios y si hay admin
            res_user = conn.execute(text('SELECT COUNT(*) FROM usuarios'))
            info['usuarios_total'] = int(res_user.fetchone()[0])
            res_admin = conn.execute(text('SELECT COUNT(*) FROM usuarios WHERE es_admin = 1'))
            info['admins_total'] = int(res_admin.fetchone()[0])
        finally:
            conn.close()
    except Exception as e:
        info['sqlalchemy_connect'] = False
        info['error'] = str(e)
    # TambiÃ©n probar con sqlite3 directa
    try:
        sconn = sqlite3.connect(db_path, timeout=5)
        try:
            sconn.execute('PRAGMA user_version')
            info['sqlite3_connect'] = True
        finally:
            sconn.close()
    except Exception as e:
        info['sqlite3_connect'] = False
        info['sqlite3_error'] = str(e)
    return jsonify(info)

def enviar_notificacion_orden(orden_data):
    """EnvÃ­a notificaciÃ³n por correo de nueva orden"""
    try:
        # ConfiguraciÃ³n del correo
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        email_usuario = "1yorbi1@gmail.com"
        email_password = os.environ.get('GMAIL_APP_PASSWORD')

        print(f"ðŸ”§ Intentando enviar notificaciÃ³n para orden #{orden_data['id']}")
        print(f"ðŸ“§ Email configurado: {email_usuario}")

        if not email_password:
            print("âŒ ERROR: No se encontrÃ³ la contraseÃ±a de Gmail en los secretos")
            print("ðŸ’¡ SoluciÃ³n: Agrega el secreto 'GMAIL_APP_PASSWORD' en Replit")
            print("ðŸ’¡ Usa una contraseÃ±a de aplicaciÃ³n de Gmail, no tu contraseÃ±a normal")
            return False

        print("ðŸ”‘ ContraseÃ±a de aplicaciÃ³n encontrada")

        # Crear mensaje
        mensaje = MIMEMultipart()
        mensaje['From'] = email_usuario
        mensaje['To'] = email_usuario  # Enviamos a nosotros mismos
        mensaje['Subject'] = f"ðŸ›’ Nueva Orden #{orden_data['id']} - tindostore"

        # Cuerpo del mensaje
        cuerpo = f"""
        Â¡Nueva orden recibida en tindostore!

        ðŸ“‹ Detalles de la Orden:
        â€¢ ID: #{orden_data['id']}
        â€¢ Juego: {orden_data.get('juego_nombre', 'N/A')}
        â€¢ Paquete: {orden_data['paquete']}
        â€¢ Monto: ${orden_data['monto']}
        â€¢ Cliente: {orden_data['usuario_email']}
        â€¢ TelÃ©fono: {orden_data.get('usuario_telefono', 'No especificado')}
        â€¢ ID del Usuario en el Juego: {orden_data.get('usuario_id', 'No especificado')}
        â€¢ MÃ©todo de Pago: {orden_data['metodo_pago']}
        â€¢ Referencia: {orden_data['referencia_pago']}
        â€¢ Estado: {orden_data['estado']}
        â€¢ Fecha: {orden_data['fecha']}

        ðŸŽ® Accede al panel de administraciÃ³n para gestionar esta orden.

        Â¡Saludos del equipo de tindostore! ðŸš€
        """

        mensaje.attach(MIMEText(cuerpo, 'plain'))

        print("ðŸ“¨ Conectando al servidor SMTP...")
        # Enviar correo
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        print("ðŸ” Iniciando sesiÃ³n...")
        server.login(email_usuario, email_password)
        print("ðŸ“¤ Enviando correo...")
        texto = mensaje.as_string()
        server.sendmail(email_usuario, email_usuario, texto)
        server.quit()

        print(f"âœ… NotificaciÃ³n enviada exitosamente para orden #{orden_data['id']}")
        print(f"ðŸ“¬ Revisa tu bandeja de entrada en: {email_usuario}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"âŒ ERROR DE AUTENTICACIÃ“N: {str(e)}")
        print("ðŸ’¡ Verifica que tengas una contraseÃ±a de aplicaciÃ³n vÃ¡lida")
        print("ðŸ’¡ AsegÃºrate de tener habilitada la verificaciÃ³n en 2 pasos")
        return False
    except smtplib.SMTPException as e:
        print(f"âŒ ERROR SMTP: {str(e)}")
        return False
    except Exception as e:
        print(f"âŒ Error general al enviar notificaciÃ³n: {str(e)}")
        print(f"ðŸ” Tipo de error: {type(e).__name__}")
        return False

def init_db():
    """Inicializa las tablas de la base de datos"""
    conn = get_db_connection()

    try:
        # Asegurar tablas base (si no existen)
        # Crear tablas usando SQLAlchemy (SQLite compatible)
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS juegos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT,
                descripcion TEXT,
                imagen TEXT,
                categoria TEXT DEFAULT 'juegos',
                orden INTEGER DEFAULT 0,
                etiquetas TEXT
            );
        '''))

        # SQLite no soporta ADD COLUMN IF NOT EXISTS, pero las columnas ya estÃ¡n en CREATE TABLE

        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS paquetes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                juego_id INTEGER REFERENCES juegos(id),
                nombre TEXT,
                precio REAL,
                orden INTEGER DEFAULT 0,
                imagen TEXT
            );
        '''))

        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS ordenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                juego_id INTEGER REFERENCES juegos(id),
                paquete TEXT,
                monto REAL,
                usuario_email TEXT,
                usuario_id TEXT,
                usuario_telefono TEXT,
                metodo_pago TEXT,
                referencia_pago TEXT,
                codigo_producto TEXT,
                estado TEXT DEFAULT 'procesando',
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        '''))

        # SQLite migrations are handled by including all columns in CREATE TABLE statements above

        # Crear tabla de valoraciones
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS valoraciones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                juego_id INTEGER REFERENCES juegos(id) ON DELETE CASCADE,
                usuario_email TEXT NOT NULL,
                calificacion INTEGER CHECK (calificacion >= 1 AND calificacion <= 5),
                comentario TEXT,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(juego_id, usuario_email)
            );
        '''))

        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS imagenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT,
                ruta TEXT
            );
        '''))

        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS configuracion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campo TEXT UNIQUE,
                valor TEXT
            );
        '''))

        # Crear tabla de usuarios
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                telefono TEXT,
                password_hash TEXT NOT NULL,
                es_admin INTEGER DEFAULT 0,
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        '''))

        # Migraciones SQLite: aÃ±adir columnas faltantes si la DB ya existÃ­a sin estas columnas
        _ensure_sqlite_column(conn, 'juegos', 'categoria', "categoria TEXT DEFAULT 'juegos'")
        _ensure_sqlite_column(conn, 'juegos', 'orden', 'orden INTEGER DEFAULT 0')
        _ensure_sqlite_column(conn, 'juegos', 'etiquetas', 'etiquetas TEXT')

        _ensure_sqlite_column(conn, 'paquetes', 'orden', 'orden INTEGER DEFAULT 0')
        _ensure_sqlite_column(conn, 'paquetes', 'imagen', 'imagen TEXT')

        _ensure_sqlite_column(conn, 'ordenes', 'usuario_id', 'usuario_id TEXT')
        _ensure_sqlite_column(conn, 'ordenes', 'usuario_telefono', 'usuario_telefono TEXT')
        _ensure_sqlite_column(conn, 'ordenes', 'codigo_producto', 'codigo_producto TEXT')

        _ensure_sqlite_column(conn, 'usuarios', 'telefono', 'telefono TEXT')
        _ensure_sqlite_column(conn, 'usuarios', 'es_admin', 'es_admin INTEGER DEFAULT 0')

        # Normalizar rutas de imÃ¡genes guardadas antiguas
        try:
            # Quitar prefijo '/static/' si existe (convierte '/static/images/x.jpg' -> 'images/x.jpg')
            conn.execute(text("""
                UPDATE imagenes
                SET ruta = substr(ruta, length('/static/') + 1)
                WHERE ruta LIKE '/static/%'
            """))
            # Normalizar separadores por si existen backslashes
            conn.execute(text("""
                UPDATE imagenes
                SET ruta = REPLACE(ruta, '\\', '/')
                WHERE instr(ruta, '\\') > 0
            """))
            print("ðŸ§¹ MigraciÃ³n: rutas de imÃ¡genes normalizadas")
        except Exception as e:
            print(f"âš ï¸ No se pudo normalizar rutas de imÃ¡genes: {e}")

        # Verificar si ya hay productos
        result = conn.execute(text('SELECT COUNT(*) FROM juegos'))
        product_count = result.fetchone()[0]

        # Insertar productos de ejemplo si no existen
        if product_count == 0:
            # Free Fire
            conn.execute(text('''
                INSERT INTO juegos (nombre, descripcion, imagen, categoria) 
                VALUES (:nombre, :descripcion, :imagen, :categoria)
            '''), {
                'nombre': 'Free Fire',
                'descripcion': 'Juego de batalla real con acciÃ³n intensa y grÃ¡ficos increÃ­bles',
                'imagen': '/static/images/20250701_212818_free_fire.webp',
                'categoria': 'juegos'
            })
            result = conn.execute(text('SELECT last_insert_rowid()'))
            ff_id = result.scalar()

            # Paquetes de Free Fire
            ff_packages = [
                ('100 Diamantes', 2.99, 1),
                ('310 Diamantes', 9.99, 2),
                ('520 Diamantes', 14.99, 3),
                ('1080 Diamantes', 29.99, 4),
                ('2200 Diamantes', 59.99, 5)
            ]

            for nombre, precio, orden in ff_packages:
                conn.execute(text('''
                    INSERT INTO paquetes (juego_id, nombre, precio, orden) 
                    VALUES (:juego_id, :nombre, :precio, :orden)
                '''), {'juego_id': ff_id, 'nombre': nombre, 'precio': precio, 'orden': orden})

            # PUBG Mobile
            conn.execute(text('''
                INSERT INTO juegos (nombre, descripcion, imagen, categoria) 
                VALUES (:nombre, :descripcion, :imagen, :categoria)
            '''), {
                'nombre': 'PUBG Mobile',
                'descripcion': 'Battle royale de Ãºltima generaciÃ³n con mecÃ¡nicas realistas',
                'imagen': '/static/images/default-product.jpg',
                'categoria': 'juegos'
            })
            result = conn.execute(text('SELECT last_insert_rowid()'))
            pubg_id = result.scalar()

            # Paquetes de PUBG
            pubg_packages = [
                ('60 UC', 0.99, 1),
                ('325 UC', 4.99, 2),
                ('660 UC', 9.99, 3),
                ('1800 UC', 24.99, 4),
                ('3850 UC', 49.99, 5)
            ]

            for nombre, precio, orden in pubg_packages:
                conn.execute(text('''
                    INSERT INTO paquetes (juego_id, nombre, precio, orden) 
                    VALUES (:juego_id, :nombre, :precio, :orden)
                '''), {'juego_id': pubg_id, 'nombre': nombre, 'precio': precio, 'orden': orden})

            # Call of Duty Mobile
            conn.execute(text('''
                INSERT INTO juegos (nombre, descripcion, imagen, categoria) 
                VALUES (:nombre, :descripcion, :imagen, :categoria)
            '''), {
                'nombre': 'Call of Duty Mobile',
                'descripcion': 'FPS de acciÃ³n con multijugador competitivo y battle royale',
                'imagen': '/static/images/default-product.jpg',
                'categoria': 'juegos'
            })
            result = conn.execute(text('SELECT last_insert_rowid()'))
            cod_id = result.scalar()

            # Paquetes de COD
            cod_packages = [
                ('80 CP', 0.99, 1),
                ('400 CP', 4.99, 2),
                ('800 CP', 9.99, 3),
                ('2000 CP', 19.99, 4),
                ('5000 CP', 49.99, 5)
            ]

            for nombre, precio, orden in cod_packages:
                conn.execute(text('''
                    INSERT INTO paquetes (juego_id, nombre, precio, orden) 
                    VALUES (:juego_id, :nombre, :precio, :orden)
                '''), {'juego_id': cod_id, 'nombre': nombre, 'precio': precio, 'orden': orden})

        # Insertar configuraciÃ³n bÃ¡sica si no existe
        result = conn.execute(text('SELECT COUNT(*) FROM configuracion'))
        config_count = result.fetchone()[0]

        if config_count == 0:
            configs = [
                ('tasa_usd_ves', '36.50'),
                ('pago_movil', 'Banco: Banesco\nTelefono: 0412-1234567\nCÃ©dula: V-12345678\nNombre: Store Admin'),
                ('binance', 'Email: admin@inefablestore.com\nID Binance: 123456789'),
                ('carousel1', 'https://via.placeholder.com/800x300/007bff/ffffff?text=ðŸŽ®+Ofertas+Especiales+Free+Fire'),
                ('carousel2', 'https://via.placeholder.com/800x300/28a745/ffffff?text=ðŸ”¥+Mejores+Precios+PUBG'),
                ('carousel3', 'https://via.placeholder.com/800x300/dc3545/ffffff?text=âš¡+Entrega+Inmediata+COD')
            ]

            for campo, valor in configs:
                conn.execute(text('''
                    INSERT INTO configuracion (campo, valor) 
                    VALUES (:campo, :valor)
                '''), {'campo': campo, 'valor': valor})

        # Crear usuario administrador por defecto si no existe
        admin_email = os.environ.get('ADMIN_EMAIL')
        admin_password = os.environ.get('ADMIN_PASSWORD')

        if admin_email and admin_password:
            # Verificar si ya existe un admin con ese email
            result = conn.execute(text('SELECT id FROM usuarios WHERE email = :email'), 
                                 {'email': admin_email})

            if not result.fetchone():
                # Crear usuario administrador
                password_hash = generate_password_hash(admin_password)
                conn.execute(text('''
                    INSERT INTO usuarios (nombre, email, password_hash, es_admin)
                    VALUES (:nombre, :email, :password_hash, 1)
                '''), {
                    'nombre': 'Administrador',
                    'email': admin_email,
                    'password_hash': password_hash
                })
                print(f"âœ… Usuario administrador creado: {admin_email}")
            else:
                # Actualizar usuario existente para que sea admin
                password_hash = generate_password_hash(admin_password)
                conn.execute(text('''
                    UPDATE usuarios SET es_admin = 1, password_hash = :password_hash WHERE email = :email
                '''), {'email': admin_email, 'password_hash': password_hash})
                print(f"âœ… Usuario actualizado como administrador: {admin_email}")

        conn.commit()

    except Exception as e:
        print(f"Error en init_db: {e}")
        conn.rollback()
    finally:
        conn.close()

# =====================
# Email / Notificaciones
# =====================

def _smtp_config():
    """Obtiene configuraciÃ³n SMTP desde variables de entorno.
    Para Gmail: smtp.gmail.com:587 TLS. Variables esperadas:
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_USE_TLS (1/0)
    """
    host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    port = int(os.getenv('SMTP_PORT', '587'))
    user = os.getenv('SMTP_USER')
    password = os.getenv('SMTP_PASSWORD')
    sender = os.getenv('SMTP_FROM', user or '')
    use_tls = os.getenv('SMTP_USE_TLS', '1') not in ('0', 'false', 'False')
    use_ssl = os.getenv('SMTP_USE_SSL', '0') not in ('0', 'false', 'False')
    return host, port, user, password, sender, use_tls, use_ssl

def _send_email_safe(to_email: str, subject: str, html_body: str, text_body: str = None):
    host, port, user, password, sender, use_tls, use_ssl = _smtp_config()
    if not (host and port and sender and user and password and to_email):
        missing = []
        if not host: missing.append('SMTP_HOST')
        if not port: missing.append('SMTP_PORT')
        if not user: missing.append('SMTP_USER')
        if not sender: missing.append('SMTP_FROM (o SMTP_USER)')
        if not password: missing.append('SMTP_PASSWORD')
        if not to_email: missing.append('DESTINATARIO (to_email)')
        print('âœ‰ï¸ Aviso: SMTP no configurado completamente. Saltando envÃ­o de correo.')
        print(f"Faltan: {', '.join(missing) if missing else 'campos desconocidos'}")
        print(f'Subject: {subject} | To: {to_email}')
        return False

    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = sender
        msg['To'] = to_email
        if text_body:
            msg.set_content(text_body)
        msg.add_alternative(html_body, subtype='html')
        # Elegir modo de conexiÃ³n: SSL puro (465) o STARTTLS (587) o plano
        if use_ssl or port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=30) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as server:
                if use_tls:
                    server.starttls()
                server.login(user, password)
                server.send_message(msg)
        print(f'âœ… Correo enviado a {to_email}: {subject}')
        return True
    except Exception as e:
        print(f'âŒ Error enviando correo a {to_email}: {e}')
        return False

def enviar_correo_recarga_completada(orden: dict):
    # Asunto con marca Tindo Store
    asunto = f"Tu recarga estÃ¡ lista - Orden #{orden.get('id','')} - Tindo Store"
    to = orden.get('usuario_email')
    # Formateo de fecha en espaÃ±ol sin depender del locale del sistema
    meses_es = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ]
    ahora = datetime.now()
    fecha_es = f"{ahora.day} de {meses_es[ahora.month - 1]} de {ahora.year}"
    # Datos dinÃ¡micos
    juego = orden.get('juego_nombre', 'N/A')
    usuario_id = orden.get('usuario_id', 'No especificado')
    paquete = orden.get('paquete', 'N/A')
    monto = orden.get('monto', '0.00')
    # Cuerpo HTML con la plantilla solicitada
    html = f"""
    <p>Hola,</p>
    <p>Gracias por tu compra. Nos complace informarte que tu pedido ha sido procesado con Ã©xito.</p>
    <p><strong>Detalles de la orden:</strong><br/>
    ðŸ“… Fecha: {fecha_es}<br/>
    ðŸŽ® Producto: {juego}<br/>
    ðŸ†” ID de jugador: {usuario_id}<br/>
    ðŸ’Ž Paquete adquirido: {paquete}<br/>
    ðŸ’° Costo: ${monto} USD</p>
    <p>Si necesitas asistencia o tienes alguna consulta, estamos aquÃ­ para ayudarte.</p>
    <p>Atentamente,<br/>
    <strong>Equipo de Tindo Store</strong></p>
    """
    text = (
        "Hola,\n\n"
        "Gracias por tu compra. Nos complace informarte que tu pedido ha sido procesado con Ã©xito.\n\n"
        "Detalles de la orden:\n"
        f"- Fecha: {fecha_es}\n"
        f"- Producto: {juego}\n"
        f"- ID de jugador: {usuario_id}\n"
        f"- Paquete adquirido: {paquete}\n"
        f"- Costo: ${monto} USD\n\n"
        "Si necesitas asistencia o tienes alguna consulta, estamos aquÃ­ para ayudarte.\n\n"
        "Atentamente,\nEquipo de Tindo Store"
    )
    _send_email_safe(to, asunto, html, text)

def enviar_correo_gift_card_completada(orden: dict):
    asunto = f"Tu Gift Card de {orden.get('juego_nombre','Gift Card')} fue entregada"
    to = orden.get('usuario_email')
    codigo = orden.get('codigo_producto')
    html = f"""
    <h2>Â¡Tu Gift Card estÃ¡ lista! ðŸŽ</h2>
    <p>Producto: <b>{orden.get('juego_nombre','Gift Card')}</b></p>
    <p>CÃ³digo: <b style='font-size:18px'>{codigo}</b></p>
    <p>Gracias por comprar en tindostore.</p>
    """
    _send_email_safe(to, asunto, html, f"Gift Card lista. CÃ³digo: {codigo}")

def enviar_correo_orden_rechazada(orden: dict):
    asunto = f"Tu orden fue rechazada"
    to = orden.get('usuario_email')
    ref = orden.get('referencia_pago')
    html = f"""
    <h2>Tu orden fue rechazada âš ï¸</h2>
    <p>Juego: <b>{orden.get('juego_nombre','')}</b></p>
    <p>Paquete: <b>{orden.get('paquete','')}</b></p>
    <p>Referencia: <b>{ref}</b></p>
    <p>Si crees que es un error, contÃ¡ctanos respondiendo este correo.</p>
    """
    _send_email_safe(to, asunto, html, f"Orden rechazada. Ref: {ref}")

def enviar_notificacion_orden(orden: dict):
    """Notifica creaciÃ³n de orden:
    - EnvÃ­a un correo de confirmaciÃ³n al comprador (usuario_email).
    - EnvÃ­a una copia resumida al correo de la tienda (SMTP_FROM/SMTP_USER).
    """
    try:
        # Correo al comprador
        asunto_user = "Hemos recibido tu orden"
        html_user = f"""
        <h2>Â¡Gracias por tu compra! ðŸ§¾</h2>
        <p>Hemos recibido tu orden y estÃ¡ en estado <b>{orden.get('estado')}</b>.</p>
        <ul>
          <li>Orden: <b>#{orden.get('id')}</b></li>
          <li>Juego: <b>{orden.get('juego_nombre','')}</b></li>
          <li>Paquete: <b>{orden.get('paquete','')}</b></li>
          <li>Monto: <b>{orden.get('monto')}</b></li>
          <li>MÃ©todo de pago: <b>{orden.get('metodo_pago')}</b></li>
          <li>Referencia: <b>{orden.get('referencia_pago')}</b></li>
        </ul>
        <p>Te avisaremos cuando estÃ© procesada.</p>
        """
        # Enviar al comprador si tiene email vÃ¡lido
        to_user = (orden.get('usuario_email') or '').strip()
        if to_user:
            _send_email_safe(to_user, asunto_user, html_user)
        else:
            print('âœ‰ï¸ Aviso: correo del comprador vacÃ­o o invÃ¡lido, se omite envÃ­o al comprador.')

        # Correo a la tienda
        host, port, user, password, sender, use_tls, use_ssl = _smtp_config()
        admin_mail = (sender or user or '').strip()
        if admin_mail:
            asunto_admin = f"Nueva orden #{orden.get('id')}"
            html_admin = f"""
            <h3>Nueva orden recibida</h3>
            <ul>
              <li>Orden: <b>#{orden.get('id')}</b></li>
              <li>Cliente: <b>{orden.get('usuario_email')}</b></li>
              <li>TelÃ©fono: <b>{orden.get('usuario_telefono') or ''}</b></li>
              <li>Juego: <b>{orden.get('juego_nombre','')}</b></li>
              <li>Paquete: <b>{orden.get('paquete','')}</b></li>
              <li>Monto: <b>{orden.get('monto')}</b></li>
              <li>MÃ©todo de pago: <b>{orden.get('metodo_pago')}</b></li>
              <li>Referencia: <b>{orden.get('referencia_pago')}</b></li>
              <li>Fecha: <b>{orden.get('fecha')}</b></li>
            </ul>
            """
            _send_email_safe(admin_mail, asunto_admin, html_admin)
        else:
            print('âœ‰ï¸ Aviso: no se encontrÃ³ SMTP_FROM ni SMTP_USER para notificar a la tienda. Se omite envÃ­o de copia a la tienda.')
    except Exception as e:
        print(f"âŒ Error en enviar_notificacion_orden: {e}")

def limpiar_ordenes_antiguas(usuario_email):
    """Mantiene solo las Ãºltimas 40 Ã³rdenes del usuario para evitar acumulaciÃ³n."""
    try:
        conn = get_db_connection()
        try:
            conn.execute(text('''
                DELETE FROM ordenes 
                WHERE usuario_email = :email 
                AND id NOT IN (
                    SELECT id FROM ordenes 
                    WHERE usuario_email = :email 
                    ORDER BY fecha DESC 
                    LIMIT 40
                )
            '''), {'email': usuario_email})
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        print(f"âš ï¸ Error limpiando Ã³rdenes antiguas: {e}")

@app.route('/')
def index():
    return render_template('index.html')

# Manejador catch-all para rutas SPA - debe devolver siempre index.html
@app.route('/<path:path>')
def catch_all(path):
    # Si es una ruta de API/administración/estática u otros endpoints del backend, no interceptar
    protected_prefixes = (
        'api/', 'admin/', 'static/', 'images/', 'valoracion', 'valoraciones', 'health'
    )
    protected_exact = {
        'productos', 'config', 'usuario', 'usuario/historial',
        'orden', 'login', 'logout', 'registro'
    }
    if path.startswith(protected_prefixes) or path in protected_exact:
        return "Not Found", 404
    # Para cualquier otra ruta, devolver la página principal (SPA)
    return render_template('index.html')

@app.route('/admin')
def admin():
    # Cache busting para admin tambiÃ©n
    cache_bust = str(int(time.time()))
    return render_template('admin.html', cache_bust=cache_bust)

# ENDPOINT PARA CREAR Ã“RDENES DESDE EL FRONTEND
@app.route('/orden', methods=['POST'])
def create_orden():
    # Verificar si el usuario estÃ¡ logueado
    if 'user_id' not in session:
        return jsonify({'error': 'Debes iniciar sesiÃ³n para realizar una compra'}), 401

    data = request.get_json()
    juego_id = data.get('juego_id')
    paquete = data.get('paquete')
    monto = data.get('monto')
    usuario_id = data.get('usuario_id')  # ID del usuario en el juego
    metodo_pago = data.get('metodo_pago')
    referencia_pago = data.get('referencia_pago')

    # Usar el email del usuario logueado
    usuario_email = session['user_email']

    conn = get_db_connection()

    try:
        # Obtener el telÃ©fono del usuario desde la base de datos
        result_user = conn.execute(text('''
            SELECT telefono FROM usuarios WHERE email = :email
        '''), {'email': usuario_email})

        usuario_data = result_user.fetchone()
        usuario_telefono = usuario_data[0] if usuario_data else None

        conn.execute(text('''
            INSERT INTO ordenes (juego_id, paquete, monto, usuario_email, usuario_id, usuario_telefono, metodo_pago, referencia_pago, estado, fecha)
            VALUES (:juego_id, :paquete, :monto, :usuario_email, :usuario_id, :usuario_telefono, :metodo_pago, :referencia_pago, 'procesando', datetime('now'))
        '''), {
            'juego_id': juego_id,
            'paquete': paquete,
            'monto': monto,
            'usuario_email': usuario_email,
            'usuario_id': usuario_id,
            'usuario_telefono': usuario_telefono,
            'metodo_pago': metodo_pago,
            'referencia_pago': referencia_pago
        })

        # Obtener ID insertado en SQLite de forma confiable
        result = conn.execute(text('SELECT last_insert_rowid()'))
        orden_id = result.scalar()

        # Obtener datos completos de la orden para la notificaciÃ³n
        result = conn.execute(text('''
            SELECT o.*, j.nombre as juego_nombre 
            FROM ordenes o 
            LEFT JOIN juegos j ON o.juego_id = COALESCE(j.id, j.rowid)
            WHERE o.id = :orden_id
        '''), {'orden_id': orden_id})

        orden_completa = result.fetchone()
        conn.commit()

        # Debug: mostrar datos de la orden creada
        print(f"ðŸ” Orden creada - ID: {orden_id}")
        if orden_completa:
            print(f"ðŸ” Datos orden completa: {dict(orden_completa._mapping)}")
        else:
            print("âš ï¸ No se pudo obtener orden_completa tras INSERT")

        # Limpiar Ã³rdenes antiguas del usuario (mantener solo las Ãºltimas 40)
        limpiar_ordenes_antiguas(usuario_email)

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

    # Enviar notificaciÃ³n por correo en un hilo separado para no bloquear la respuesta
    if orden_completa:
        print("ðŸ“§ Preparando envÃ­o de notificaciÃ³n por correo...")
        orden_data = {
            'id': orden_completa[0],
            'juego_id': orden_completa[1],
            'paquete': orden_completa[2],
            'monto': orden_completa[3],
            'usuario_email': orden_completa[4],
            'usuario_id': orden_completa[5],
            'usuario_telefono': orden_completa[6],
            'metodo_pago': orden_completa[7],
            'referencia_pago': orden_completa[8],
            'estado': orden_completa[9],
            'fecha': orden_completa[10],
            'juego_nombre': orden_completa[11]
        }
        print(f"ðŸ“§ Datos para correo: {orden_data}")

        # Enviar notificaciÃ³n en hilo separado
        print("ðŸ“§ Iniciando hilo de envÃ­o de correo...")
        threading.Thread(target=enviar_notificacion_orden, args=(orden_data,)).start()
    else:
        print("âŒ No se enviarÃ¡ correo: orden_completa es None")

    return jsonify({'message': 'Orden creada correctamente', 'id': orden_id})

# Decorador para proteger endpoints de admin
def admin_required(f):
    def decorated_function(*args, **kwargs):
        # Verificar si el usuario estÃ¡ logueado
        if 'user_id' not in session:
            return jsonify({'error': 'Debes iniciar sesiÃ³n'}), 401

        # Verificar si el usuario es administrador
        conn = get_db_connection()
        try:
            result = conn.execute(text('SELECT es_admin FROM usuarios WHERE id = :user_id'), 
                                 {'user_id': session['user_id']})
            usuario = result.fetchone()

            # usuario[0] puede ser 0/1; convertir a bool
            if not usuario or not bool(usuario[0]):  # es_admin es False
                return jsonify({'error': 'Acceso denegado. No tienes permisos de administrador.'}), 403

        finally:
            conn.close()

        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# Endpoint ligero para verificar sesiÃ³n de admin y conectividad a la DB
@app.route('/admin/ping', methods=['GET'])
@admin_required
def admin_ping():
    conn = get_db_connection()
    try:
        # SELECT 1 para validar conexiÃ³n
        conn.execute(text('SELECT 1'))
        return jsonify({
            'ok': True,
            'db': 'ok',
            'engine': 'sqlite',
            'user_id': session.get('user_id'),
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500
    finally:
        conn.close()

# Probar envÃ­o de correo desde el panel admin
@app.route('/admin/test-email', methods=['POST'])
@admin_required
def admin_test_email():
    try:
        data = request.get_json(silent=True) or {}
        to = data.get('to')
        host, port, user, password, sender, use_tls, use_ssl = _smtp_config()
        destino = to or sender or user
        if not destino:
            return jsonify({'ok': False, 'error': 'No se pudo determinar un destinatario. Configure SMTP_FROM o envÃ­e {"to": "correo@destino"}.',
                            'host': host, 'port': port, 'use_tls': use_tls, 'use_ssl': use_ssl}), 400

        asunto = 'Prueba SMTP tindostore'
        html = '<h3>Correo de prueba</h3><p>Este es un correo de prueba desde el panel admin.</p>'
        ok = _send_email_safe(destino, asunto, html, 'Correo de prueba desde admin')
        status = 200 if ok else 500
        return jsonify({
            'ok': bool(ok),
            'to': destino,
            'from': sender or user,
            'host': host,
            'port': port,
            'use_tls': use_tls,
            'use_ssl': use_ssl,
        }), status
    except Exception as e:
        # Asegurar respuesta JSON ante errores inesperados
        try:
            host, port, user, password, sender, use_tls, use_ssl = _smtp_config()
        except Exception:
            host = port = user = sender = None
            use_tls = use_ssl = None
        return jsonify({'ok': False, 'error': f'Error inesperado en test-email: {str(e)}',
                        'host': host, 'port': port, 'use_tls': use_tls, 'use_ssl': use_ssl}), 500

# ENDPOINTS PARA Ã“RDENES
@app.route('/admin/ordenes', methods=['GET'])
@admin_required
def get_ordenes():
    conn = get_db_connection()
    try:
        result = conn.execute(text('''
            SELECT o.*, j.nombre as juego_nombre, j.categoria 
            FROM ordenes o 
            LEFT JOIN juegos j ON o.juego_id = COALESCE(j.id, j.rowid)
            ORDER BY o.fecha DESC
        '''))
        ordenes = result.fetchall()

        # Convertir a lista de diccionarios
        ordenes_dict = []
        for orden in ordenes:
            orden_dict = dict(orden._mapping)
            ordenes_dict.append(orden_dict)

        return jsonify(ordenes_dict)
    finally:
        conn.close()

@app.route('/admin/orden/<int:orden_id>', methods=['PATCH'])
@admin_required
def update_orden(orden_id):
    data = request.get_json()
    nuevo_estado = data.get('estado')
    codigo_producto = data.get('codigo_producto')

    conn = get_db_connection()

    try:
        # Obtener informaciÃ³n completa de la orden antes de actualizar
        result = conn.execute(text('''
            SELECT o.*, j.nombre as juego_nombre, j.categoria 
            FROM ordenes o 
            LEFT JOIN juegos j ON o.juego_id = COALESCE(j.id, j.rowid) 
            WHERE o.id = :orden_id
        '''), {'orden_id': orden_id})
        orden_info = result.fetchone()

        if not orden_info:
            return jsonify({'error': 'Orden no encontrada'}), 404

        # Preparar la consulta de actualizaciÃ³n
        if codigo_producto is not None:
            # Actualizar estado y cÃ³digo
            conn.execute(text('UPDATE ordenes SET estado = :estado, codigo_producto = :codigo WHERE id = :orden_id'), 
                        {'estado': nuevo_estado, 'codigo': codigo_producto, 'orden_id': orden_id})
        else:
            # Solo actualizar estado
            conn.execute(text('UPDATE ordenes SET estado = :estado WHERE id = :orden_id'), 
                        {'estado': nuevo_estado, 'orden_id': orden_id})

        conn.commit()

        # Convertir orden_info a diccionario para envÃ­o de correo
        orden_dict = dict(orden_info._mapping)
        if codigo_producto:
            orden_dict['codigo_producto'] = codigo_producto

        # Si el nuevo estado es "procesado", enviar correo de confirmaciÃ³n al usuario
        if nuevo_estado == 'procesado':
            # Verificar si es Gift Card para enviar correo especÃ­fico
            es_gift_card = (orden_dict.get('categoria') == 'gift-cards' or 
                           'gift' in (orden_dict.get('juego_nombre', '')).lower() or
                           'steam' in (orden_dict.get('juego_nombre', '')).lower())

            if es_gift_card and codigo_producto:
                threading.Thread(target=enviar_correo_gift_card_completada, args=(orden_dict,)).start()
            else:
                threading.Thread(target=enviar_correo_recarga_completada, args=(orden_dict,)).start()

        return jsonify({'message': 'Estado actualizado correctamente'})

    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Error al actualizar orden: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/admin/orden/<int:orden_id>/rechazar', methods=['PATCH'])
@admin_required
def rechazar_orden(orden_id):
    conn = get_db_connection()

    try:
        # Obtener informaciÃ³n completa de la orden antes de rechazar
        result = conn.execute(text('''
            SELECT o.*, j.nombre as juego_nombre, j.categoria 
            FROM ordenes o 
            LEFT JOIN juegos j ON o.juego_id = COALESCE(j.id, j.rowid) 
            WHERE o.id = :orden_id
        '''), {'orden_id': orden_id})
        orden_info = result.fetchone()

        if not orden_info:
            return jsonify({'error': 'Orden no encontrada'}), 404

        # Actualizar estado a rechazado
        conn.execute(text('UPDATE ordenes SET estado = :estado WHERE id = :orden_id'), 
                    {'estado': 'rechazado', 'orden_id': orden_id})
        
        conn.commit()

        # Convertir orden_info a diccionario para envÃ­o de correo
        orden_dict = dict(orden_info._mapping)

        # Enviar correo de notificaciÃ³n de rechazo al usuario
        threading.Thread(target=enviar_correo_orden_rechazada, args=(orden_dict,)).start()

        return jsonify({'message': 'Orden rechazada y correo de notificaciÃ³n enviado al usuario'})

    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Error al rechazar orden: {str(e)}'}), 500
    finally:
        conn.close()

# ENDPOINTS PARA PRODUCTOS
@app.route('/admin/productos', methods=['GET'])
@admin_required
def get_productos():
    conn = get_db_connection()
    try:
        # In SQLite, ensure we can fallback to rowid if an older table has a NULL id due to legacy
        result = conn.execute(text('SELECT rowid as _rowid, * FROM juegos ORDER BY orden ASC, id ASC'))
        productos = result.fetchall()

        # Convertir a lista de diccionarios y obtener paquetes para cada producto
        productos_list = []
        for producto in productos:
            producto_dict = dict(producto._mapping)
            # Asegurar id vÃ¡lido (fallback a rowid si fuese None por alguna DB antigua)
            if producto_dict.get('id') is None and producto_dict.get('_rowid') is not None:
                producto_dict['id'] = producto_dict['_rowid']
            # Remover helper interno
            producto_dict.pop('_rowid', None)

            # Obtener paquetes para este producto
            paquetes_result = conn.execute(text('SELECT * FROM paquetes WHERE juego_id = :juego_id ORDER BY orden ASC, id ASC'), 
                                         {'juego_id': producto_dict['id']})
            paquetes = paquetes_result.fetchall()
            producto_dict['paquetes'] = [dict(paq._mapping) for paq in paquetes]

            productos_list.append(producto_dict)

        return jsonify(productos_list)
    finally:
        conn.close()

@app.route('/admin/producto', methods=['POST'])
@admin_required
def create_producto():
    data = request.get_json()
    nombre = data.get('nombre')
    descripcion = data.get('descripcion')
    imagen = data.get('imagen', '')
    categoria = data.get('categoria', 'juegos')
    orden = data.get('orden', 0)
    etiquetas = data.get('etiquetas', '')
    paquetes = data.get('paquetes', [])

    # Debug: Imprimir los datos recibidos
    print(f"ðŸ” Creando producto con categorÃ­a: {categoria}")
    print(f"ðŸ” Datos completos: {data}")

    conn = get_db_connection()
    try:
        # Insertar producto
        conn.execute(text('''
            INSERT INTO juegos (nombre, descripcion, imagen, categoria, orden, etiquetas) 
            VALUES (:nombre, :descripcion, :imagen, :categoria, :orden, :etiquetas)
        '''), {
            'nombre': nombre, 
            'descripcion': descripcion, 
            'imagen': imagen, 
            'categoria': categoria, 
            'orden': orden, 
            'etiquetas': etiquetas
        })

        # Obtener ID insertado en SQLite de forma confiable
        result = conn.execute(text('SELECT last_insert_rowid()'))
        producto_id = result.scalar()

        print(f"âœ… Producto creado con ID: {producto_id}, categorÃ­a: {categoria}")

        # Insertar paquetes
        for index, paquete in enumerate(paquetes):
            conn.execute(text('''
                INSERT INTO paquetes (juego_id, nombre, precio, orden, imagen) 
                VALUES (:juego_id, :nombre, :precio, :orden, :imagen)
            '''), {
                'juego_id': producto_id, 
                'nombre': paquete['nombre'], 
                'precio': paquete['precio'],
                'orden': paquete.get('orden', 1),
                'imagen': paquete.get('imagen')
            })

        conn.commit()
        return jsonify({'message': 'Producto creado correctamente', 'id': producto_id})
    except Exception as e:
        print(f"âŒ Error al crear producto: {str(e)}")
        conn.rollback()
        return jsonify({'error': f'Error al crear producto: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/admin/producto/<int:producto_id>', methods=['PUT'])
@admin_required
def update_producto(producto_id):
    data = request.get_json()
    nombre = data.get('nombre')
    descripcion = data.get('descripcion')
    imagen = data.get('imagen', '')
    categoria = data.get('categoria', 'juegos')
    orden = data.get('orden', 0)
    etiquetas = data.get('etiquetas', '')
    paquetes = data.get('paquetes', [])

    conn = get_db_connection()
    try:
        # Resolver clave del producto (id o rowid para legados)
        res = conn.execute(text('SELECT rowid as _rowid, id FROM juegos WHERE id = :pid OR rowid = :pid'), {'pid': producto_id}).fetchone()
        if not res:
            return jsonify({'error': 'Producto no encontrado'}), 404
        rowid = res._mapping.get('_rowid')
        real_id = res._mapping.get('id') if res._mapping.get('id') is not None else rowid

        # Actualizar producto por rowid si id es NULL
        if res._mapping.get('id') is None:
            conn.execute(text('''
                UPDATE juegos SET nombre = :nombre, descripcion = :descripcion, imagen = :imagen, categoria = :categoria, orden = :orden, etiquetas = :etiquetas 
                WHERE rowid = :rid
            '''), {
                'nombre': nombre,
                'descripcion': descripcion,
                'imagen': imagen,
                'categoria': categoria,
                'orden': orden,
                'etiquetas': etiquetas,
                'rid': rowid
            })
        else:
            conn.execute(text('''
                UPDATE juegos SET nombre = :nombre, descripcion = :descripcion, imagen = :imagen, categoria = :categoria, orden = :orden, etiquetas = :etiquetas 
                WHERE id = :pid
            '''), {
                'nombre': nombre,
                'descripcion': descripcion,
                'imagen': imagen,
                'categoria': categoria,
                'orden': orden,
                'etiquetas': etiquetas,
                'pid': producto_id
            })

        # Eliminar paquetes existentes por juego_id resuelto y crear nuevos
        conn.execute(text('DELETE FROM paquetes WHERE juego_id = :jid'), {'jid': real_id})

        # Insertar nuevos paquetes
        for paquete in paquetes:
            conn.execute(text('''
                INSERT INTO paquetes (juego_id, nombre, precio, orden, imagen) 
                VALUES (:juego_id, :nombre, :precio, :orden, :imagen)
            '''), {
                'juego_id': real_id,
                'nombre': paquete['nombre'],
                'precio': paquete['precio'],
                'orden': paquete.get('orden', 1),
                'imagen': paquete.get('imagen')
            })

        conn.commit()
        return jsonify({'message': 'Producto actualizado correctamente'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Error al actualizar producto: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/admin/producto/<int:producto_id>', methods=['DELETE'])
@admin_required
def delete_producto(producto_id):
    conn = get_db_connection()
    try:
        # Resolver la clave del producto (id o rowid)
        res = conn.execute(text('SELECT rowid as _rowid, id FROM juegos WHERE id = :pid OR rowid = :pid'), {'pid': producto_id}).fetchone()
        if not res:
            return jsonify({'error': 'Producto no encontrado'}), 404
        rowid = res._mapping.get('_rowid')
        real_id = res._mapping.get('id') if res._mapping.get('id') is not None else rowid

        # Eliminar Ã³rdenes y paquetes asociados usando la clave resuelta
        conn.execute(text('DELETE FROM ordenes WHERE juego_id = :jid'), {'jid': real_id})
        conn.execute(text('DELETE FROM paquetes WHERE juego_id = :jid'), {'jid': real_id})

        # Eliminar producto por id o rowid segÃºn corresponda
        if res._mapping.get('id') is None:
            conn.execute(text('DELETE FROM juegos WHERE rowid = :rid'), {'rid': rowid})
        else:
            conn.execute(text('DELETE FROM juegos WHERE id = :pid'), {'pid': producto_id})

        conn.commit()
        return jsonify({'message': 'Producto eliminado correctamente'})

    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Error al eliminar producto: {str(e)}'}), 500
    finally:
        conn.close()

# ENDPOINT PÃšBLICO PARA PRODUCTOS (FRONTEND DE USUARIOS)
@app.route('/productos', methods=['GET'])
def get_productos_publico():
    conn = get_db_connection()
    try:
        # OptimizaciÃ³n: Una sola consulta con JOIN para obtener productos, paquetes y valoraciones
        result = conn.execute(text('''
            SELECT 
                j.rowid as _rowid,
                j.id, j.nombre, j.descripcion, j.imagen, j.categoria, j.orden, j.etiquetas,
                p.id as paquete_id, p.nombre as paquete_nombre, p.precio, p.orden as paquete_orden, p.imagen as paquete_imagen,
                v.promedio_valoracion, v.total_valoraciones
            FROM juegos j
            LEFT JOIN paquetes p ON (p.juego_id = COALESCE(j.id, j.rowid))
            LEFT JOIN (
                SELECT 
                    juego_id,
                    ROUND(AVG(calificacion), 1) as promedio_valoracion,
                    COUNT(*) as total_valoraciones
                FROM valoraciones 
                GROUP BY juego_id
            ) v ON COALESCE(j.id, j.rowid) = v.juego_id
            ORDER BY j.orden ASC, COALESCE(j.id, j.rowid) ASC, p.orden ASC, p.precio ASC
        '''))

        rows = result.fetchall()

        # Agrupar productos con sus paquetes
        productos_dict = {}
        for row in rows:
            row_dict = dict(row._mapping)
            # Fallback a rowid si id es NULL (bases antiguas)
            producto_id = row_dict['id'] if row_dict.get('id') is not None else row_dict.get('_rowid')

            if producto_id not in productos_dict:
                # Asegurar que la categorÃ­a no sea None
                categoria = row_dict.get('categoria') or 'juegos'

                productos_dict[producto_id] = {
                    'id': producto_id,
                    'nombre': row_dict['nombre'],
                    'descripcion': row_dict['descripcion'],
                    'imagen': row_dict['imagen'],
                    'categoria': categoria,
                    'orden': row_dict['orden'],
                    'etiquetas': row_dict['etiquetas'],
                    'promedio_valoracion': row_dict['promedio_valoracion'],
                    'total_valoraciones': row_dict['total_valoraciones'],
                    'paquetes': []
                }

                # Debug: imprimir categorÃ­a de cada producto
                print(f"ðŸ“¦ Producto: {row_dict['nombre']} | CategorÃ­a: {categoria}")

            # Agregar paquete si existe
            if row_dict['paquete_id'] is not None:
                productos_dict[producto_id]['paquetes'].append({
                    'id': row_dict['paquete_id'],
                    'nombre': row_dict['paquete_nombre'],
                    'precio': row_dict['precio'],
                    'orden': row_dict['paquete_orden'],
                    'imagen': row_dict['paquete_imagen']
                })

        # Convertir a lista
        productos_list = list(productos_dict.values())

        # Debug: contar productos por categorÃ­a
        categorias_count = {}
        for producto in productos_list:
            cat = producto['categoria']
            categorias_count[cat] = categorias_count.get(cat, 0) + 1

        print(f"ðŸ“Š Productos por categorÃ­a: {categorias_count}")

        return jsonify(productos_list)
    finally:
        conn.close()

# ENDPOINT PÃšBLICO PARA CONFIGURACIÃ“N (FRONTEND DE USUARIOS)
@app.route('/config', methods=['GET'])
def get_config_publico():
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT campo, valor FROM configuracion'))
        configs = result.fetchall()

        # Convertir a diccionario usando Ã­ndices numÃ©ricos
        config_dict = {}
        for config in configs:
            config_dict[config[0]] = config[1]  # campo, valor

        return jsonify(config_dict)
    finally:
        conn.close()

# ENDPOINTS PARA VALORACIONES
@app.route('/valoracion', methods=['POST'])
def crear_valoracion():
    # Verificar si el usuario estÃ¡ logueado
    if 'user_id' not in session:
        return jsonify({'error': 'Debes iniciar sesiÃ³n para valorar'}), 401

    data = request.get_json()
    juego_id = data.get('juego_id')
    calificacion = data.get('calificacion')
    comentario = data.get('comentario', '').strip()

    # Validaciones
    if not juego_id or not calificacion:
        return jsonify({'error': 'Juego y calificaciÃ³n son requeridos'}), 400

    if calificacion < 1 or calificacion > 5:
        return jsonify({'error': 'La calificaciÃ³n debe ser entre 1 y 5 estrellas'}), 400

    usuario_email = session['user_email']

    conn = get_db_connection()
    try:
        # Verificar que el usuario haya comprado este juego
        result = conn.execute(text('''
            SELECT COUNT(*) FROM ordenes 
            WHERE juego_id = :juego_id AND usuario_email = :usuario_email AND estado = 'procesado'
        '''), {'juego_id': juego_id, 'usuario_email': usuario_email})

        compras = result.fetchone()[0]

        if compras == 0:
            return jsonify({'error': 'Solo puedes valorar productos que hayas comprado'}), 403

        # Insertar o actualizar valoraciÃ³n
        conn.execute(text('''
            INSERT INTO valoraciones (juego_id, usuario_email, calificacion, comentario)
            VALUES (:juego_id, :usuario_email, :calificacion, :comentario)
            ON CONFLICT (juego_id, usuario_email) 
            DO UPDATE SET calificacion = EXCLUDED.calificacion, comentario = EXCLUDED.comentario, fecha = CURRENT_TIMESTAMP
        '''), {
            'juego_id': juego_id,
            'usuario_email': usuario_email,
            'calificacion': calificacion,
            'comentario': comentario
        })

        conn.commit()
        return jsonify({'message': 'ValoraciÃ³n guardada correctamente'})

    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Error al guardar valoraciÃ³n: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/valoraciones/<int:juego_id>', methods=['GET'])
def get_valoraciones_producto(juego_id):
    conn = get_db_connection()
    try:
        # Obtener valoraciones del producto
        result = conn.execute(text('''
            SELECT v.*, u.nombre as usuario_nombre
            FROM valoraciones v
            LEFT JOIN usuarios u ON v.usuario_email = u.email
            WHERE v.juego_id = :juego_id
            ORDER BY v.fecha DESC
        '''), {'juego_id': juego_id})

        valoraciones = result.fetchall()

        # Obtener estadÃ­sticas
        stats_result = conn.execute(text('''
            SELECT 
                AVG(calificacion) as promedio,
                COUNT(*) as total,
                COUNT(CASE WHEN calificacion = 5 THEN 1 END) as estrellas_5,
                COUNT(CASE WHEN calificacion = 4 THEN 1 END) as estrellas_4,
                COUNT(CASE WHEN calificacion = 3 THEN 1 END) as estrellas_3,
                COUNT(CASE WHEN calificacion = 2 THEN 1 END) as estrellas_2,
                COUNT(CASE WHEN calificacion = 1 THEN 1 END) as estrellas_1
            FROM valoraciones 
            WHERE juego_id = :juego_id
        '''), {'juego_id': juego_id})

        stats = stats_result.fetchone()

        # Convertir a diccionarios
        valoraciones_list = []
        for val in valoraciones:
            val_dict = dict(val._mapping)
            # Ocultar email completo por privacidad
            email = val_dict['usuario_email']
            if email:
                email_parts = email.split('@')
                if len(email_parts) == 2:
                    val_dict['usuario_email_oculto'] = email_parts[0][:2] + '***@' + email_parts[1]
                else:
                    val_dict['usuario_email_oculto'] = '***'
            valoraciones_list.append(val_dict)

        # Preparar estadÃ­sticas
        stats_dict = dict(stats._mapping) if stats else {}
        if stats_dict.get('promedio'):
            stats_dict['promedio'] = round(float(stats_dict['promedio']), 1)

        return jsonify({
            'valoraciones': valoraciones_list,
            'estadisticas': stats_dict
        })

    finally:
        conn.close()

@app.route('/valoracion/usuario/<int:juego_id>', methods=['GET'])
def get_valoracion_usuario(juego_id):
    # Verificar si el usuario estÃ¡ logueado
    if 'user_id' not in session:
        return jsonify({'error': 'Debes iniciar sesiÃ³n'}), 401

    usuario_email = session['user_email']

    conn = get_db_connection()
    try:
        # Verificar si el usuario puede valorar (ha comprado el producto)
        result = conn.execute(text('''
            SELECT COUNT(*) FROM ordenes 
            WHERE juego_id = :juego_id AND usuario_email = :usuario_email AND estado = 'procesado'
        '''), {'juego_id': juego_id, 'usuario_email': usuario_email})

        puede_valorar = result.fetchone()[0] > 0

        # Obtener valoraciÃ³n existente del usuario
        result = conn.execute(text('''
            SELECT * FROM valoraciones 
            WHERE juego_id = :juego_id AND usuario_email = :usuario_email
        '''), {'juego_id': juego_id, 'usuario_email': usuario_email})

        valoracion = result.fetchone()
        valoracion_dict = dict(valoracion._mapping) if valoracion else None

        return jsonify({
            'puede_valorar': puede_valorar,
            'valoracion': valoracion_dict
        })

    finally:
        conn.close()

# ENDPOINTS PARA IMÃGENES
@app.route('/admin/imagenes', methods=['GET'])
@admin_required
def get_imagenes():
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT * FROM imagenes ORDER BY tipo, id'))
        imagenes = result.fetchall()

        # Convertir a lista de diccionarios
        imagenes_list = []
        for imagen in imagenes:
            imagen_dict = dict(imagen._mapping)
            # Normalizar ruta: quitar prefijo '/static/' si existe
            ruta = imagen_dict.get('ruta') or ''
            if ruta.startswith('/static/'):
                ruta = ruta[len('/static/'):]
            imagen_dict['ruta'] = ruta
            imagenes_list.append(imagen_dict)

        return jsonify(imagenes_list)
    finally:
        conn.close()

@app.route('/admin/imagenes', methods=['POST'])
@admin_required
def upload_imagen():
    if 'imagen' not in request.files:
        return jsonify({'error': 'No se seleccionÃ³ archivo'}), 400

    file = request.files['imagen']
    tipo = request.form.get('tipo', 'producto')

    if file.filename == '':
        return jsonify({'error': 'No se seleccionÃ³ archivo'}), 400

    if file:
        # Validar que sea una imagen
        if not file.content_type.startswith('image/'):
            return jsonify({'error': 'El archivo debe ser una imagen'}), 400

        # Validar tamaÃ±o (mÃ¡ximo 10MB)
        file.seek(0, 2)  # Ir al final del archivo
        file_size = file.tell()
        file.seek(0)  # Volver al inicio

        max_size = 10 * 1024 * 1024  # 10MB
        if file_size > max_size:
            return jsonify({'error': 'La imagen es muy grande (mÃ¡ximo 10MB)'}), 400

        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        filename = timestamp + filename

        # Crear directorio si no existe
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        try:
            file.save(file_path)
        except Exception as e:
            return jsonify({'error': f'Error al guardar el archivo: {str(e)}'}), 500

        # Guardar en base de datos
        conn = get_db_connection()
        try:
            # Guardar ruta normalizada sin prefijo '/static/'
            result = conn.execute(text('''
                INSERT INTO imagenes (tipo, ruta) 
                VALUES (:tipo, :ruta)
            '''), {'tipo': tipo, 'ruta': f'images/{filename}'})
            imagen_id = result.lastrowid
            conn.commit()

            return jsonify({
                'message': 'Imagen subida correctamente',
                'id': imagen_id,
                'ruta': f'images/{filename}'
            })
        except Exception as e:
            # Si hay error en BD, eliminar archivo
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': f'Error al guardar en base de datos: {str(e)}'}), 500
        finally:
            conn.close()

@app.route('/admin/imagenes/bulk', methods=['POST'])
@admin_required
def upload_imagenes_bulk():
    """Endpoint para subida masiva de imÃ¡genes"""
    if 'imagenes' not in request.files:
        return jsonify({'error': 'No se seleccionaron archivos'}), 400

    files = request.files.getlist('imagenes')
    tipo = request.form.get('tipo', 'producto')

    if not files:
        return jsonify({'error': 'No se seleccionaron archivos'}), 400

    resultados = []
    errores = []

    # Crear directorio si no existe
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    conn = get_db_connection()

    try:
        for file in files:
            if file.filename == '':
                continue

            # Validar que sea una imagen
            if not file.content_type.startswith('image/'):
                errores.append(f'{file.filename}: No es una imagen vÃ¡lida')
                continue

            # Validar tamaÃ±o (mÃ¡ximo 10MB)
            file.seek(0, 2)
            file_size = file.tell()
            file.seek(0)

            max_size = 10 * 1024 * 1024  # 10MB
            if file_size > max_size:
                errores.append(f'{file.filename}: Archivo muy grande (mÃ¡ximo 10MB)')
                continue

            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
            # Agregar un contador para evitar nombres duplicados
            filename = f"{timestamp}{len(resultados):03d}_{filename}"

            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

            try:
                file.save(file_path)

                # Guardar en base de datos
                # Guardar ruta normalizada sin prefijo '/static/'
                result = conn.execute(text('''
                    INSERT INTO imagenes (tipo, ruta) 
                    VALUES (:tipo, :ruta)
                '''), {'tipo': tipo, 'ruta': f'images/{filename}'})
                imagen_id = result.lastrowid

                resultados.append({
                    'id': imagen_id,
                    'nombre_original': file.filename,
                    'ruta': f'images/{filename}',
                    'exito': True
                })

            except Exception as e:
                # Si hay error, eliminar archivo si se creÃ³
                if os.path.exists(file_path):
                    os.remove(file_path)
                errores.append(f'{file.filename}: Error al procesar - {str(e)}')

        conn.commit()

        return jsonify({
            'message': f'Proceso completado. {len(resultados)} imÃ¡genes subidas, {len(errores)} errores.',
            'subidas': len(resultados),
            'errores': len(errores),
            'detalles_errores': errores,
            'resultados': resultados
        })

    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Error general: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/admin/imagen/<int:imagen_id>', methods=['DELETE'])
@admin_required
def delete_imagen(imagen_id):
    conn = get_db_connection()
    try:
        # Obtener informaciÃ³n de la imagen antes de eliminarla
        result = conn.execute(text('SELECT * FROM imagenes WHERE id = :imagen_id'), 
                             {'imagen_id': imagen_id})
        imagen = result.fetchone()

        if not imagen:
            return jsonify({'error': 'Imagen no encontrada'}), 404

        # Eliminar archivo fÃ­sico
        imagen_dict = dict(imagen._mapping)
        # Soportar rutas antiguas con prefijo '/static/' y nuevas 'images/...'
        ruta_db = imagen_dict['ruta'] or ''
        if ruta_db.startswith('/static/'):
            file_path = ruta_db.lstrip('/')  # 'static/images/...'
        else:
            file_path = os.path.join('static', ruta_db)  # 'static/images/...'
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Error al eliminar archivo: {e}")

        # Eliminar de la base de datos
        conn.execute(text('DELETE FROM imagenes WHERE id = :imagen_id'), 
                    {'imagen_id': imagen_id})
        conn.commit()

        return jsonify({'message': 'Imagen eliminada correctamente'})
    finally:
        conn.close()

# ENDPOINTS PARA CONFIGURACIÃ“N
@app.route('/admin/config', methods=['GET'])
@admin_required
def get_config():
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT campo, valor FROM configuracion'))
        configs = result.fetchall()

        # Convertir a diccionario usando Ã­ndices numÃ©ricos
        config_dict = {}
        for config in configs:
            config_dict[config[0]] = config[1]  # campo, valor

        return jsonify(config_dict)
    finally:
        conn.close()

@app.route('/config', methods=['PUT'])
@admin_required
def update_config():
    data = request.get_json()

    conn = get_db_connection()
    try:
        for campo, valor in data.items():
            # Usar UPSERT con SQLAlchemy
            conn.execute(text('''
                INSERT INTO configuracion (campo, valor) VALUES (:campo, :valor) 
                ON CONFLICT (campo) DO UPDATE SET valor = EXCLUDED.valor
            '''), {'campo': campo, 'valor': valor})

        conn.commit()
        return jsonify({'message': 'ConfiguraciÃ³n actualizada correctamente'})
    finally:
        conn.close()

# ENDPOINTS DE AUTENTICACIÃ“N
@app.route('/registro', methods=['POST'])
def registro():
    data = request.get_json()
    nombre = data.get('nombre')
    email = data.get('email')
    telefono = data.get('telefono')
    password = data.get('password')

    if not nombre or not email or not telefono or not password:
        return jsonify({'error': 'Todos los campos son requeridos'}), 400

    # Verificar si el email ya existe
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT id FROM usuarios WHERE email = :email'), 
                             {'email': email})
        if result.fetchone():
            return jsonify({'error': 'El email ya estÃ¡ registrado'}), 400

        # Crear nuevo usuario
        password_hash = generate_password_hash(password)

        result = conn.execute(text('''
            INSERT INTO usuarios (nombre, email, telefono, password_hash, fecha_registro)
            VALUES (:nombre, :email, :telefono, :password_hash, datetime('now'))
        '''), {'nombre': nombre, 'email': email, 'telefono': telefono, 'password_hash': password_hash})

        user_id = result.lastrowid
        conn.commit()

        return jsonify({'message': 'Usuario registrado correctamente', 'user_id': user_id})

    except Exception as e:
        conn.rollback()
        return jsonify({'error': 'Error al registrar usuario'}), 500
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email y contraseÃ±a son requeridos'}), 400

    conn = get_db_connection()
    try:
        result = conn.execute(text("SELECT id, nombre, email, password_hash, es_admin, fecha_registro FROM usuarios WHERE email = :email"), { 'email': email })
        row = result.fetchone()

        if row:
            # Mapear fila a dict
            user = dict(row._mapping)
            pwd_hash = user.get('password_hash')
            if pwd_hash and check_password_hash(pwd_hash, password):
                # Guardar sesiÃ³n permanente con tiempo de expiraciÃ³n
                session.permanent = True
                session['user_id'] = user['id']
                session['user_email'] = user['email']
                session['user_name'] = user['nombre']
                session['es_admin'] = bool(user.get('es_admin', 0))

                # fecha_registro puede ser str en SQLite
                fecha_registro = user.get('fecha_registro')
                fecha_registro_out = None
                if fecha_registro:
                    try:
                        # Intentar parsear a ISO si viene como datetime
                        fecha_registro_out = fecha_registro.isoformat()
                    except AttributeError:
                        # Si ya es str, devolverla tal cual
                        fecha_registro_out = str(fecha_registro)

                return jsonify({
                    'message': 'SesiÃ³n iniciada correctamente',
                    'usuario': {
                        'id': user['id'],
                        'nombre': user['nombre'],
                        'email': user['email'],
                        'fecha_registro': fecha_registro_out,
                        'es_admin': bool(user.get('es_admin', 0))
                    }
                })

        return jsonify({'error': 'Email o contraseÃ±a incorrectos'}), 401
    finally:
        conn.close()

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'SesiÃ³n cerrada correctamente'})



@app.route('/usuario')
def obtener_usuario():
    if 'user_id' not in session:
        return jsonify({'error': 'No hay sesiÃ³n activa'}), 401

    conn = get_db_connection()
    try:
        result = conn.execute(text("""
            SELECT id, nombre, email, fecha_registro, es_admin 
            FROM usuarios 
            WHERE id = :user_id
        """), {'user_id': session['user_id']})

        usuario = result.fetchone()

        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        # Manejar fecha_registro que puede venir como datetime o como string (SQLite)
        fecha_val = usuario[3]
        try:
            fecha_out = fecha_val.isoformat() if fecha_val else None
        except AttributeError:
            fecha_out = str(fecha_val) if fecha_val else None

        # es_admin entero 0/1 -> booleano
        es_admin_val = bool(usuario[4]) if usuario[4] is not None else False

        return jsonify({
            'usuario': {
                'id': usuario[0],
                'nombre': usuario[1],
                'email': usuario[2],
                'fecha_registro': fecha_out,
                'es_admin': es_admin_val
            }
        })

    except Exception as e:
        print(f"Error al obtener usuario: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500
    finally:
        conn.close()

@app.route('/usuario/historial', methods=['GET'])
def get_historial_compras():
    if 'user_id' not in session:
        return jsonify({'error': 'No hay sesiÃ³n activa'}), 401

    conn = get_db_connection()
    try:
        # Obtener historial de compras del usuario logueado
        result = conn.execute(text('''
            SELECT o.*, j.nombre as juego_nombre, j.imagen as juego_imagen
            FROM ordenes o 
            LEFT JOIN juegos j ON o.juego_id = j.id 
            LEFT JOIN usuarios u ON o.usuario_email = u.email
            WHERE u.id = :user_id
            ORDER BY o.fecha DESC
        '''), {'user_id': session['user_id']})

        historial = result.fetchall()

        # Convertir a lista de diccionarios
        historial_list = []
        for compra in historial:
            compra_dict = dict(compra._mapping)
            historial_list.append(compra_dict)

        return jsonify(historial_list)
    finally:
        conn.close()

@app.route('/images/<path:filename>')
def serve_image(filename):
    """Endpoint para servir imÃ¡genes desde la base de datos"""
    # Limpiar el nombre del archivo para evitar problemas de seguridad
    filename = secure_filename(filename)

    # Buscar la imagen en la base de datos
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT ruta FROM imagenes WHERE ruta LIKE :filename'), 
                             {'filename': f'%{filename}%'})
        imagen = result.fetchone()

        if imagen:
            # La ruta ya incluye /static/, asÃ­ que redirigir directamente
            return redirect(imagen[0])
        else:
            # Si no se encuentra, devolver imagen por defecto disponible
            return redirect('/static/images/20250706_020025_20250705_163435_Recurso-40.png')
    except Exception as e:
        print(f"Error al servir imagen {filename}: {e}")
        # En caso de error, devolver imagen por defecto
        return redirect('/static/images/20250706_020025_20250705_163435_Recurso-40.png')
    finally:
        conn.close()

# Configurar headers para evitar cachÃ© en desarrollo
@app.after_request
def after_request(response):
    # Solo en modo debug/desarrollo
    if app.debug:
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

if __name__ == '__main__':
    # Crear directorio para imÃ¡genes
    os.makedirs('static/images', exist_ok=True)

    # Inicializar base de datos
    try:
        init_db()
        print("Base de datos inicializada correctamente")
    except Exception as e:
        print(f"Error al inicializar la base de datos: {e}")

    port = int(os.environ.get('PORT', 5000))
    print(f'ðŸš€ Iniciando servidor en puerto {port}')
    app.run(host='0.0.0.0', port=port, debug=True)


