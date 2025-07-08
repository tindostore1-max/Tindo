from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
import os
from werkzeug.utils import secure_filename
from datetime import datetime
import json
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import threading
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'tu_clave_secreta_aqui'
app.config['UPLOAD_FOLDER'] = 'static/images'

# Configuración de sesión
from datetime import timedelta
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)  # 1 hora
app.config['SESSION_COOKIE_SECURE'] = False  # True en producción con HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Previene acceso via JavaScript
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Protección CSRF

# Configuración de SQLAlchemy con DATABASE_URL
def create_db_engine():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        # Fallback para desarrollo local usando variables de entorno individuales
        db_user = os.environ.get('DB_USER', 'postgres')
        db_password = os.environ.get('DB_PASSWORD', '')
        db_host = os.environ.get('DB_HOST', 'localhost')
        db_port = os.environ.get('DB_PORT', '5432')
        db_name = os.environ.get('DB_NAME', 'inefablestore')
        database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    else:
        # Limpiar la URL si viene con formato psql
        if database_url.startswith("psql '") and database_url.endswith("'"):
            database_url = database_url[6:-1]  # Remover "psql '" del inicio y "'" del final
        elif database_url.startswith("psql "):
            database_url = database_url[5:]  # Remover "psql " del inicio

    # Crear versión censurada para logging
    try:
        if '://' in database_url and '@' in database_url:
            masked_url = database_url.replace(database_url.split('://')[1].split('@')[0], '***:***')
        else:
            masked_url = database_url
        print(f"🔗 Intentando conectar con: {masked_url}")
    except:
        print(f"🔗 Intentando conectar con base de datos...")

    try:
        # Crear engine de SQLAlchemy
        engine = create_engine(
            database_url,
            poolclass=NullPool,  # Para evitar problemas de conexión en Replit
            pool_pre_ping=True,  # Para verificar conexiones antes de usarlas
            echo=False  # Cambiar a True para debug SQL
        )

        # Probar la conexión
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))

        print("✅ Conexión a la base de datos exitosa")
        return engine
    except Exception as e:
        print(f"❌ Error conectando a PostgreSQL: {e}")
        print("💡 Asegúrate de tener configurada la variable DATABASE_URL o las variables de entorno individuales")
        raise e

# Engine global
db_engine = None

def get_db_connection():
    """Obtener conexión a la base de datos usando SQLAlchemy"""
    global db_engine
    if db_engine is None:
        db_engine = create_db_engine()
    return db_engine.connect()

def get_psycopg2_connection():
    """Obtener conexión directa con psycopg2 para funciones que lo requieren"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        db_user = os.environ.get('DB_USER', 'postgres')
        db_password = os.environ.get('DB_PASSWORD', '')
        db_host = os.environ.get('DB_HOST', 'localhost')
        db_port = os.environ.get('DB_PORT', '5432')
        db_name = os.environ.get('DB_NAME', 'inefablestore')
        database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    else:
        # Limpiar la URL si viene con formato psql
        if database_url.startswith("psql '") and database_url.endswith("'"):
            database_url = database_url[6:-1]  # Remover "psql '" del inicio y "'" del final
        elif database_url.startswith("psql "):
            database_url = database_url[5:]  # Remover "psql " del inicio

    return psycopg2.connect(database_url)

def enviar_correo_gift_card_completada(orden_info):
    """Envía correo al usuario con el código de la Gift Card"""
    try:
        # Configuración del correo
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        email_usuario = "1yorbi1@gmail.com"
        email_password = os.environ.get('GMAIL_APP_PASSWORD')

        print(f"🎁 Enviando Gift Card completada para orden #{orden_info['id']}")
        print(f"📧 Destinatario: {orden_info['usuario_email']}")

        if not email_password:
            print("❌ ERROR: No se encontró la contraseña de Gmail")
            return False

        # Crear mensaje
        mensaje = MIMEMultipart()
        mensaje['From'] = email_usuario
        mensaje['To'] = orden_info['usuario_email']
        mensaje['Subject'] = f"🎁 ¡Tu Gift Card está lista! - Orden #{orden_info['id']} - Inefable Store"

        # Cuerpo del mensaje específico para Gift Cards
        cuerpo = f"""
        ¡Hola! 🎁

        ¡Excelentes noticias! Tu Gift Card ha sido procesada exitosamente.

        📋 Detalles de tu orden:
        • Orden #: {orden_info['id']}
        • Producto: {orden_info.get('juego_nombre', 'Gift Card')}
        • Paquete: {orden_info['paquete']}
        • Monto: ${orden_info['monto']}
        • Estado: ✅ COMPLETADA
        • Fecha de procesamiento: {datetime.now().strftime('%d/%m/%Y a las %H:%M')}

        🎯 CÓDIGO DE TU GIFT CARD:
        ════════════════════════════════════
        🔑 {orden_info.get('codigo_producto', 'CÓDIGO NO DISPONIBLE')}
        ════════════════════════════════════

        📝 Instrucciones de uso:
        • Guarda este código en un lugar seguro
        • Utiliza este código en la plataforma correspondiente
        • El código es de un solo uso
        • Si tienes problemas para canjearlo, contáctanos

        ⚠️ IMPORTANTE: Este código es personal e intransferible.
        No lo compartas con nadie para evitar fraudes.

        ¡Gracias por confiar en Inefable Store! 🚀

        ---
        Equipo de Inefable Store
        """

        mensaje.attach(MIMEText(cuerpo, 'plain'))

        print("📤 Enviando Gift Card con código al usuario...")
        # Enviar correo
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(email_usuario, email_password)
        texto = mensaje.as_string()
        server.sendmail(email_usuario, orden_info['usuario_email'], texto)
        server.quit()

        print(f"✅ Gift Card enviada exitosamente a: {orden_info['usuario_email']}")
        return True

    except Exception as e:
        print(f"❌ Error al enviar Gift Card: {str(e)}")
        return False

def enviar_correo_recarga_completada(orden_info):
    """Envía correo al usuario confirmando que su recarga ha sido completada"""
    try:
        # Configuración del correo
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        email_usuario = "1yorbi1@gmail.com"
        email_password = os.environ.get('GMAIL_APP_PASSWORD')

        print(f"📨 Enviando confirmación de recarga completada para orden #{orden_info['id']}")
        print(f"📧 Destinatario: {orden_info['usuario_email']}")

        if not email_password:
            print("❌ ERROR: No se encontró la contraseña de Gmail")
            return False

        # Crear mensaje
        mensaje = MIMEMultipart()
        mensaje['From'] = email_usuario
        mensaje['To'] = orden_info['usuario_email']
        mensaje['Subject'] = f"🎉 ¡Tu recarga está lista! - Orden #{orden_info['id']} - Inefable Store"

        # Cuerpo del mensaje personalizado para el usuario
        cuerpo = f"""
        ¡Hola! 🎮

        ¡Excelentes noticias! Tu recarga ha sido procesada exitosamente.

        📋 Detalles de tu orden:
        • Orden #: {orden_info['id']}
        • Juego: {orden_info.get('juego_nombre', 'N/A')}
        • Paquete: {orden_info['paquete']}
        • Monto: ${orden_info['monto']}
        • Tu ID en el juego: {orden_info.get('usuario_id', 'No especificado')}
        • Estado: ✅ COMPLETADA
        • Fecha de procesamiento: {datetime.now().strftime('%d/%m/%Y a las %H:%M')}

        🎯 Tu recarga ya está disponible en tu cuenta del juego.
        Si tienes algún problema, no dudes en contactarnos.

        ¡Gracias por confiar en Inefable Store! 🚀

        ---
        Equipo de Inefable Store
        """

        mensaje.attach(MIMEText(cuerpo, 'plain'))

        print("📤 Enviando correo de confirmación al usuario...")
        # Enviar correo
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(email_usuario, email_password)
        texto = mensaje.as_string()
        server.sendmail(email_usuario, orden_info['usuario_email'], texto)
        server.quit()

        print(f"✅ Correo de confirmación enviado exitosamente a: {orden_info['usuario_email']}")
        return True

    except Exception as e:
        print(f"❌ Error al enviar correo de confirmación: {str(e)}")
        return False

def limpiar_ordenes_antiguas(usuario_email):
    """Mantiene solo las últimas 40 órdenes por usuario, eliminando las más antiguas"""
    conn = get_db_connection()
    try:
        # Contar órdenes del usuario
        result = conn.execute(text('''
            SELECT COUNT(*) FROM ordenes WHERE usuario_email = :email
        '''), {'email': usuario_email})
        
        total_ordenes = result.fetchone()[0]
        
        # Si tiene más de 40 órdenes, eliminar las más antiguas
        if total_ordenes > 40:
            ordenes_a_eliminar = total_ordenes - 40
            
            # Obtener IDs de las órdenes más antiguas
            result = conn.execute(text('''
                SELECT id FROM ordenes 
                WHERE usuario_email = :email 
                ORDER BY fecha ASC 
                LIMIT :limit
            '''), {'email': usuario_email, 'limit': ordenes_a_eliminar})
            
            ids_a_eliminar = [row[0] for row in result.fetchall()]
            
            if ids_a_eliminar:
                # Eliminar las órdenes más antiguas
                for orden_id in ids_a_eliminar:
                    conn.execute(text('DELETE FROM ordenes WHERE id = :id'), {'id': orden_id})
                
                conn.commit()
                print(f"🧹 Limpieza automática: Eliminadas {len(ids_a_eliminar)} órdenes antiguas del usuario {usuario_email}")
                
    except Exception as e:
        print(f"❌ Error al limpiar órdenes antiguas: {e}")
        conn.rollback()
    finally:
        conn.close()

def enviar_notificacion_orden(orden_data):
    """Envía notificación por correo de nueva orden"""
    try:
        # Configuración del correo
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        email_usuario = "1yorbi1@gmail.com"
        email_password = os.environ.get('GMAIL_APP_PASSWORD')

        print(f"🔧 Intentando enviar notificación para orden #{orden_data['id']}")
        print(f"📧 Email configurado: {email_usuario}")

        if not email_password:
            print("❌ ERROR: No se encontró la contraseña de Gmail en los secretos")
            print("💡 Solución: Agrega el secreto 'GMAIL_APP_PASSWORD' en Replit")
            print("💡 Usa una contraseña de aplicación de Gmail, no tu contraseña normal")
            return False

        print("🔑 Contraseña de aplicación encontrada")

        # Crear mensaje
        mensaje = MIMEMultipart()
        mensaje['From'] = email_usuario
        mensaje['To'] = email_usuario  # Enviamos a nosotros mismos
        mensaje['Subject'] = f"🛒 Nueva Orden #{orden_data['id']} - Inefable Store"

        # Cuerpo del mensaje
        cuerpo = f"""
        ¡Nueva orden recibida en Inefable Store!

        📋 Detalles de la Orden:
        • ID: #{orden_data['id']}
        • Juego: {orden_data.get('juego_nombre', 'N/A')}
        • Paquete: {orden_data['paquete']}
        • Monto: ${orden_data['monto']}
        • Cliente: {orden_data['usuario_email']}
        • Teléfono: {orden_data.get('usuario_telefono', 'No especificado')}
        • ID del Usuario en el Juego: {orden_data.get('usuario_id', 'No especificado')}
        • Método de Pago: {orden_data['metodo_pago']}
        • Referencia: {orden_data['referencia_pago']}
        • Estado: {orden_data['estado']}
        • Fecha: {orden_data['fecha']}

        🎮 Accede al panel de administración para gestionar esta orden.

        ¡Saludos del equipo de Inefable Store! 🚀
        """

        mensaje.attach(MIMEText(cuerpo, 'plain'))

        print("📨 Conectando al servidor SMTP...")
        # Enviar correo
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        print("🔐 Iniciando sesión...")
        server.login(email_usuario, email_password)
        print("📤 Enviando correo...")
        texto = mensaje.as_string()
        server.sendmail(email_usuario, email_usuario, texto)
        server.quit()

        print(f"✅ Notificación enviada exitosamente para orden #{orden_data['id']}")
        print(f"📬 Revisa tu bandeja de entrada en: {email_usuario}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ ERROR DE AUTENTICACIÓN: {str(e)}")
        print("💡 Verifica que tengas una contraseña de aplicación válida")
        print("💡 Asegúrate de tener habilitada la verificación en 2 pasos")
        return False
    except smtplib.SMTPException as e:
        print(f"❌ ERROR SMTP: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Error general al enviar notificación: {str(e)}")
        print(f"🔍 Tipo de error: {type(e).__name__}")
        return False

def init_db():
    """Inicializa las tablas de la base de datos"""
    conn = get_db_connection()

    try:
        # Crear tablas usando SQLAlchemy
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS juegos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100),
                descripcion TEXT,
                imagen VARCHAR(255),
                categoria VARCHAR(50) DEFAULT 'juegos'
            );
        '''))

        # Agregar columna categoria si no existe (migración)
        conn.execute(text('''
            ALTER TABLE juegos 
            ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'juegos';
        '''))

        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS paquetes (
                id SERIAL PRIMARY KEY,
                juego_id INTEGER REFERENCES juegos(id),
                nombre VARCHAR(100),
                precio NUMERIC(10,2)
            );
        '''))

        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS ordenes (
                id SERIAL PRIMARY KEY,
                juego_id INTEGER REFERENCES juegos(id),
                paquete VARCHAR(100),
                monto NUMERIC(10,2),
                usuario_email VARCHAR(100),
                usuario_id VARCHAR(100),
                usuario_telefono VARCHAR(20),
                metodo_pago VARCHAR(50),
                referencia_pago VARCHAR(100),
                estado VARCHAR(20) DEFAULT 'procesando',
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        '''))

        # Agregar columna usuario_id si no existe (migración)
        conn.execute(text('''
            ALTER TABLE ordenes 
            ADD COLUMN IF NOT EXISTS usuario_id VARCHAR(100);
        '''))

        # Agregar columna codigo_producto si no existe (migración)
        conn.execute(text('''
            ALTER TABLE ordenes 
            ADD COLUMN IF NOT EXISTS codigo_producto VARCHAR(255);
        '''))

        # Agregar columna usuario_telefono si no existe (migración)
        conn.execute(text('''
            ALTER TABLE ordenes 
            ADD COLUMN IF NOT EXISTS usuario_telefono VARCHAR(20);
        '''))

        # Agregar columna orden si no existe (migración)
        conn.execute(text('''
            ALTER TABLE paquetes 
            ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;
        '''))

        # Agregar columna orden a juegos si no existe (migración)
        conn.execute(text('''
            ALTER TABLE juegos 
            ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;
        '''))

        # Agregar columna etiquetas si no existe (migración)
        conn.execute(text('''
            ALTER TABLE juegos 
            ADD COLUMN IF NOT EXISTS etiquetas VARCHAR(255);
        '''))

        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS imagenes (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(50),
                ruta VARCHAR(255)
            );
        '''))

        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS configuracion (
                id SERIAL PRIMARY KEY,
                campo VARCHAR(50) UNIQUE,
                valor TEXT
            );
        '''))

        # Crear tabla de usuarios
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                telefono VARCHAR(20),
                password_hash VARCHAR(255) NOT NULL,
                es_admin BOOLEAN DEFAULT FALSE,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        '''))

        # Agregar columna es_admin si no existe (migración)
        conn.execute(text('''
            ALTER TABLE usuarios 
            ADD COLUMN IF NOT EXISTS es_admin BOOLEAN DEFAULT FALSE;
        '''))

        # Agregar columna telefono si no existe (migración)
        conn.execute(text('''
            ALTER TABLE usuarios 
            ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);
        '''))

        # Verificar si ya hay productos
        result = conn.execute(text('SELECT COUNT(*) FROM juegos'))
        product_count = result.fetchone()[0]

    # Insertar productos de ejemplo si no existen
        if product_count == 0:
            # Free Fire
            result = conn.execute(text('''
                INSERT INTO juegos (nombre, descripcion, imagen, categoria) 
                VALUES (:nombre, :descripcion, :imagen, :categoria) RETURNING id
            '''), {
                'nombre': 'Free Fire',
                'descripcion': 'Juego de batalla real con acción intensa y gráficos increíbles',
                'imagen': '/static/images/20250701_212818_free_fire.webp',
                'categoria': 'juegos'
            })

            ff_id = result.fetchone()[0]

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
            result = conn.execute(text('''
                INSERT INTO juegos (nombre, descripcion, imagen, categoria) 
                VALUES (:nombre, :descripcion, :imagen, :categoria) RETURNING id
            '''), {
                'nombre': 'PUBG Mobile',
                'descripcion': 'Battle royale de última generación con mecánicas realistas',
                'imagen': '/static/images/default-product.jpg',
                'categoria': 'juegos'
            })

            pubg_id = result.fetchone()[0]

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
            result = conn.execute(text('''
                INSERT INTO juegos (nombre, descripcion, imagen, categoria) 
                VALUES (:nombre, :descripcion, :imagen, :categoria) RETURNING id
            '''), {
                'nombre': 'Call of Duty Mobile',
                'descripcion': 'FPS de acción con multijugador competitivo y battle royale',
                'imagen': '/static/images/default-product.jpg',
                'categoria': 'juegos'
            })

            cod_id = result.fetchone()[0]

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

        # Insertar configuración básica si no existe
        result = conn.execute(text('SELECT COUNT(*) FROM configuracion'))
        config_count = result.fetchone()[0]

        if config_count == 0:
            configs = [
                ('tasa_usd_ves', '36.50'),
                ('pago_movil', 'Banco: Banesco\nTelefono: 0412-1234567\nCédula: V-12345678\nNombre: Store Admin'),
                ('binance', 'Email: admin@inefablestore.com\nID Binance: 123456789'),
                ('carousel1', 'https://via.placeholder.com/800x300/007bff/ffffff?text=🎮+Ofertas+Especiales+Free+Fire'),
                ('carousel2', 'https://via.placeholder.com/800x300/28a745/ffffff?text=🔥+Mejores+Precios+PUBG'),
                ('carousel3', 'https://via.placeholder.com/800x300/dc3545/ffffff?text=⚡+Entrega+Inmediata+COD')
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
                    VALUES (:nombre, :email, :password_hash, TRUE)
                '''), {
                    'nombre': 'Administrador',
                    'email': admin_email,
                    'password_hash': password_hash
                })
                print(f"✅ Usuario administrador creado: {admin_email}")
            else:
                # Actualizar usuario existente para que sea admin
                conn.execute(text('''
                    UPDATE usuarios SET es_admin = TRUE WHERE email = :email
                '''), {'email': admin_email})
                print(f"✅ Usuario actualizado como administrador: {admin_email}")

        conn.commit()

    except Exception as e:
        print(f"Error en init_db: {e}")
        conn.rollback()
    finally:
        conn.close()

@app.route('/')
def index():
    return render_template('index.html')

# Manejador catch-all para rutas SPA - debe devolver siempre index.html
@app.route('/<path:path>')
def catch_all(path):
    # Si es una ruta de API, devolver 404
    if path.startswith('api/') or path.startswith('admin/') or path.startswith('static/'):
        return "Not Found", 404
    # Para cualquier otra ruta, devolver la página principal
    return render_template('index.html')

@app.route('/admin')
def admin():
    # Verificar si el usuario está logueado y es administrador
    if 'user_id' not in session:
        return redirect(url_for('index') + '?login_required=true&admin=true')

    # Verificar si el usuario es administrador
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT es_admin FROM usuarios WHERE id = :user_id'), 
                             {'user_id': session['user_id']})
        usuario = result.fetchone()

        if not usuario or not usuario[0]:  # es_admin es False
            return jsonify({'error': 'Acceso denegado. No tienes permisos de administrador.'}), 403

    finally:
        conn.close()

    return render_template('admin.html')

# ENDPOINT PARA CREAR ÓRDENES DESDE EL FRONTEND
@app.route('/orden', methods=['POST'])
def create_orden():
    # Verificar si el usuario está logueado
    if 'user_id' not in session:
        return jsonify({'error': 'Debes iniciar sesión para realizar una compra'}), 401

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
        # Obtener el teléfono del usuario desde la base de datos
        result_user = conn.execute(text('''
            SELECT telefono FROM usuarios WHERE email = :email
        '''), {'email': usuario_email})
        
        usuario_data = result_user.fetchone()
        usuario_telefono = usuario_data[0] if usuario_data else None

        result = conn.execute(text('''
            INSERT INTO ordenes (juego_id, paquete, monto, usuario_email, usuario_id, usuario_telefono, metodo_pago, referencia_pago, estado, fecha)
            VALUES (:juego_id, :paquete, :monto, :usuario_email, :usuario_id, :usuario_telefono, :metodo_pago, :referencia_pago, 'procesando', CURRENT_TIMESTAMP)
            RETURNING id
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

        orden_id = result.fetchone()[0]

        # Obtener datos completos de la orden para la notificación
        result = conn.execute(text('''
            SELECT o.*, j.nombre as juego_nombre 
            FROM ordenes o 
            LEFT JOIN juegos j ON o.juego_id = j.id 
            WHERE o.id = :orden_id
        '''), {'orden_id': orden_id})

        orden_completa = result.fetchone()
        conn.commit()
        
        # Limpiar órdenes antiguas del usuario (mantener solo las últimas 40)
        limpiar_ordenes_antiguas(usuario_email)

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

    # Enviar notificación por correo en un hilo separado para no bloquear la respuesta
    if orden_completa:
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

        # Enviar notificación en hilo separado
        threading.Thread(target=enviar_notificacion_orden, args=(orden_data,)).start()

    return jsonify({'message': 'Orden creada correctamente', 'id': orden_id})

# Decorador para proteger endpoints de admin
def admin_required(f):
    def decorated_function(*args, **kwargs):
        # Verificar si el usuario está logueado
        if 'user_id' not in session:
            return jsonify({'error': 'Debes iniciar sesión'}), 401

        # Verificar si el usuario es administrador
        conn = get_db_connection()
        try:
            result = conn.execute(text('SELECT es_admin FROM usuarios WHERE id = :user_id'), 
                                 {'user_id': session['user_id']})
            usuario = result.fetchone()

            if not usuario or not usuario[0]:  # es_admin es False
                return jsonify({'error': 'Acceso denegado. No tienes permisos de administrador.'}), 403

        finally:
            conn.close()

        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# ENDPOINTS PARA ÓRDENES
@app.route('/admin/ordenes', methods=['GET'])
@admin_required
def get_ordenes():
    conn = get_db_connection()
    try:
        result = conn.execute(text('''
            SELECT o.*, j.nombre as juego_nombre, j.categoria 
            FROM ordenes o 
            LEFT JOIN juegos j ON o.juego_id = j.id 
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
        # Obtener información completa de la orden antes de actualizar
        result = conn.execute(text('''
            SELECT o.*, j.nombre as juego_nombre, j.categoria 
            FROM ordenes o 
            LEFT JOIN juegos j ON o.juego_id = j.id 
            WHERE o.id = :orden_id
        '''), {'orden_id': orden_id})
        orden_info = result.fetchone()

        if not orden_info:
            return jsonify({'error': 'Orden no encontrada'}), 404

        # Preparar la consulta de actualización
        if codigo_producto is not None:
            # Actualizar estado y código
            conn.execute(text('UPDATE ordenes SET estado = :estado, codigo_producto = :codigo WHERE id = :orden_id'), 
                        {'estado': nuevo_estado, 'codigo': codigo_producto, 'orden_id': orden_id})
        else:
            # Solo actualizar estado
            conn.execute(text('UPDATE ordenes SET estado = :estado WHERE id = :orden_id'), 
                        {'estado': nuevo_estado, 'orden_id': orden_id})

        conn.commit()

        # Convertir orden_info a diccionario para envío de correo
        orden_dict = dict(orden_info._mapping)
        if codigo_producto:
            orden_dict['codigo_producto'] = codigo_producto

        # Si el nuevo estado es "procesado", enviar correo de confirmación al usuario
        if nuevo_estado == 'procesado':
            # Verificar si es Gift Card para enviar correo específico
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

# ENDPOINTS PARA PRODUCTOS
@app.route('/admin/productos', methods=['GET'])
@admin_required
def get_productos():
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT * FROM juegos ORDER BY orden ASC, id ASC'))
        productos = result.fetchall()

        # Convertir a lista de diccionarios y obtener paquetes para cada producto
        productos_list = []
        for producto in productos:
            producto_dict = dict(producto._mapping)

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

    conn = get_db_connection()
    try:
        # Insertar producto
        result = conn.execute(text('''
            INSERT INTO juegos (nombre, descripcion, imagen, categoria, orden, etiquetas) 
            VALUES (:nombre, :descripcion, :imagen, :categoria, :orden, :etiquetas) RETURNING id
        '''), {'nombre': nombre, 'descripcion': descripcion, 'imagen': imagen, 'categoria': categoria, 'orden': orden, 'etiquetas': etiquetas})

        producto_id = result.fetchone()[0]

        # Insertar paquetes
        for index, paquete in enumerate(paquetes):
            conn.execute(text('''
                INSERT INTO paquetes (juego_id, nombre, precio, orden) 
                VALUES (:juego_id, :nombre, :precio, :orden)
            '''), {
                'juego_id': producto_id, 
                'nombre': paquete['nombre'], 
                'precio': paquete['precio'],
                'orden': paquete.get('orden', 1)
            })

        conn.commit()
        return jsonify({'message': 'Producto creado correctamente', 'id': producto_id})
    except Exception as e:
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
        # Actualizar producto
        conn.execute(text('''
            UPDATE juegos SET nombre = :nombre, descripcion = :descripcion, imagen = :imagen, categoria = :categoria, orden = :orden, etiquetas = :etiquetas 
            WHERE id = :producto_id
        '''), {
            'nombre': nombre, 
            'descripcion': descripcion, 
            'imagen': imagen, 
            'categoria': categoria,
            'orden': orden,
            'etiquetas': etiquetas,
            'producto_id': producto_id
        })

        # Eliminar paquetes existentes y crear nuevos
        conn.execute(text('DELETE FROM paquetes WHERE juego_id = :producto_id'), 
                    {'producto_id': producto_id})

        # Insertar nuevos paquetes
        for paquete in paquetes:
            conn.execute(text('''
                INSERT INTO paquetes (juego_id, nombre, precio, orden) 
                VALUES (:juego_id, :nombre, :precio, :orden)
            '''), {
                'juego_id': producto_id,
                'nombre': paquete['nombre'],
                'precio': paquete['precio'],
                'orden': paquete.get('orden', 1)
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
        # Eliminar órdenes relacionadas primero
        conn.execute(text('DELETE FROM ordenes WHERE juego_id = :producto_id'), 
                    {'producto_id': producto_id})
        # Eliminar paquetes
        conn.execute(text('DELETE FROM paquetes WHERE juego_id = :producto_id'), 
                    {'producto_id': producto_id})
        # Eliminar producto
        conn.execute(text('DELETE FROM juegos WHERE id = :producto_id'), 
                    {'producto_id': producto_id})

        conn.commit()
        return jsonify({'message': 'Producto eliminado correctamente'})

    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Error al eliminar producto: {str(e)}'}), 500
    finally:
        conn.close()

# ENDPOINT PÚBLICO PARA PRODUCTOS (FRONTEND DE USUARIOS)
@app.route('/productos', methods=['GET'])
def get_productos_publico():
    conn = get_db_connection()
    try:
        # Optimización: Una sola consulta con JOIN para obtener productos y paquetes
        result = conn.execute(text('''
            SELECT 
                j.id, j.nombre, j.descripcion, j.imagen, j.categoria, j.orden, j.etiquetas,
                p.id as paquete_id, p.nombre as paquete_nombre, p.precio, p.orden as paquete_orden
            FROM juegos j
            LEFT JOIN paquetes p ON j.id = p.juego_id
            ORDER BY j.orden ASC, j.id ASC, p.orden ASC, p.precio ASC
        '''))
        
        rows = result.fetchall()
        
        # Agrupar productos con sus paquetes
        productos_dict = {}
        for row in rows:
            row_dict = dict(row._mapping)
            producto_id = row_dict['id']
            
            if producto_id not in productos_dict:
                productos_dict[producto_id] = {
                    'id': row_dict['id'],
                    'nombre': row_dict['nombre'],
                    'descripcion': row_dict['descripcion'],
                    'imagen': row_dict['imagen'],
                    'categoria': row_dict['categoria'],
                    'orden': row_dict['orden'],
                    'etiquetas': row_dict['etiquetas'],
                    'paquetes': []
                }
            
            # Agregar paquete si existe
            if row_dict['paquete_id']:
                productos_dict[producto_id]['paquetes'].append({
                    'id': row_dict['paquete_id'],
                    'nombre': row_dict['paquete_nombre'],
                    'precio': row_dict['precio'],
                    'orden': row_dict['paquete_orden']
                })
        
        # Convertir a lista
        productos_list = list(productos_dict.values())
        
        return jsonify(productos_list)
    finally:
        conn.close()

# ENDPOINT PÚBLICO PARA CONFIGURACIÓN (FRONTEND DE USUARIOS)
@app.route('/config', methods=['GET'])
def get_config_publico():
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT campo, valor FROM configuracion'))
        configs = result.fetchall()

        # Convertir a diccionario usando índices numéricos
        config_dict = {}
        for config in configs:
            config_dict[config[0]] = config[1]  # campo, valor

        return jsonify(config_dict)
    finally:
        conn.close()

# ENDPOINTS PARA IMÁGENES
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
            imagenes_list.append(imagen_dict)

        return jsonify(imagenes_list)
    finally:
        conn.close()

@app.route('/admin/imagenes', methods=['POST'])
@admin_required
def upload_imagen():
    if 'imagen' not in request.files:
        return jsonify({'error': 'No se seleccionó archivo'}), 400

    file = request.files['imagen']
    tipo = request.form.get('tipo', 'producto')

    if file.filename == '':
        return jsonify({'error': 'No se seleccionó archivo'}), 400

    if file:
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        filename = timestamp + filename

        # Crear directorio si no existe
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        # Guardar en base de datos
        conn = get_db_connection()
        try:
            result = conn.execute(text('''
                INSERT INTO imagenes (tipo, ruta) 
                VALUES (:tipo, :ruta) RETURNING id
            '''), {'tipo': tipo, 'ruta': f'images/{filename}'})
            imagen_id = result.fetchone()[0]
            conn.commit()
        finally:
            conn.close()

        return jsonify({
            'message': 'Imagen subida correctamente',
            'id': imagen_id,
            'ruta': f'images/{filename}'
        })

@app.route('/admin/imagen/<int:imagen_id>', methods=['DELETE'])
@admin_required
def delete_imagen(imagen_id):
    conn = get_db_connection()
    try:
        # Obtener información de la imagen antes de eliminarla
        result = conn.execute(text('SELECT * FROM imagenes WHERE id = :imagen_id'), 
                             {'imagen_id': imagen_id})
        imagen = result.fetchone()

        if not imagen:
            return jsonify({'error': 'Imagen no encontrada'}), 404

        # Eliminar archivo físico
        imagen_dict = dict(imagen._mapping)
        file_path = os.path.join('static', imagen_dict['ruta'])
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

# ENDPOINTS PARA CONFIGURACIÓN
@app.route('/admin/config', methods=['GET'])
@admin_required
def get_config():
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT campo, valor FROM configuracion'))
        configs = result.fetchall()

        # Convertir a diccionario usando índices numéricos
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
        return jsonify({'message': 'Configuración actualizada correctamente'})
    finally:
        conn.close()

# ENDPOINTS DE AUTENTICACIÓN
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
            return jsonify({'error': 'El email ya está registrado'}), 400

        # Crear nuevo usuario
        password_hash = generate_password_hash(password)

        result = conn.execute(text('''
            INSERT INTO usuarios (nombre, email, telefono, password_hash)
            VALUES (:nombre, :email, :telefono, :password_hash) RETURNING id
        '''), {'nombre': nombre, 'email': email, 'telefono': telefono, 'password_hash': password_hash})

        user_id = result.fetchone()[0]
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
        return jsonify({'error': 'Email y contraseña son requeridos'}), 400

    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT * FROM usuarios WHERE email = :email'), 
                             {'email': email})
        usuario = result.fetchone()

        if usuario and check_password_hash(usuario[3], password):  # password_hash es índice 3
            # Guardar sesión permanente con tiempo de expiración
            session.permanent = True
            session['user_id'] = usuario[0]      # id
            session['user_email'] = usuario[2]   # email
            session['user_name'] = usuario[1]    # nombre

            return jsonify({
                'message': 'Sesión iniciada correctamente',
                'usuario': {
                    'id': usuario[0],
                    'nombre': usuario[1],
                    'email': usuario[2],
                    'fecha_registro': usuario[4].isoformat()
                }
            })
        else:
            return jsonify({'error': 'Email o contraseña incorrectos'}), 401
    finally:
        conn.close()

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Sesión cerrada correctamente'})

@app.route('/usuario')
def obtener_usuario():
    if 'user_id' not in session:
        return jsonify({'error': 'No hay sesión activa'}), 401

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

        return jsonify({
            'usuario': {
                'id': usuario[0],
                'nombre': usuario[1],
                'email': usuario[2],
                'fecha_registro': usuario[3].isoformat() if usuario[3] else None,
                'es_admin': usuario[4] if usuario[4] is not None else False
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
        return jsonify({'error': 'No hay sesión activa'}), 401

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
    """Endpoint para servir imágenes desde la base de datos"""
    # Limpiar el nombre del archivo para evitar problemas de seguridad
    filename = secure_filename(filename)

    # Buscar la imagen en la base de datos
    conn = get_db_connection()
    try:
        result = conn.execute(text('SELECT ruta FROM imagenes WHERE ruta LIKE :filename'), 
                             {'filename': f'%{filename}%'})
        imagen = result.fetchone()

        if imagen:
            # Redirigir a la ruta real de la imagen
            return redirect(f'/static/{imagen[0]}')
        else:
            # Si no se encuentra, devolver imagen por defecto
            return redirect('/static/images/20250704_223016_Recurso-40.png')
    finally:
        conn.close()

if __name__ == '__main__':
    # Crear directorio para imágenes
    os.makedirs('static/images', exist_ok=True)

    # Inicializar base de datos
    try:
        init_db()
        print("Base de datos inicializada correctamente")
    except Exception as e:
        print(f"Error al inicializar la base de datos: {e}")

    app.run(host='0.0.0.0', port=5000, debug=True)