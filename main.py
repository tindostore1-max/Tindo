# Actualizar endpoint público para ordenar productos por campo orden
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
                categoria VARCHAR(50) DEFAULT 'juegos',
                orden INTEGER DEFAULT 0
            );
        '''))

        # Agregar columna categoria si no existe (migración)
        conn.execute(text('''
            ALTER TABLE juegos 
            ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'juegos';
        '''))

        # Agregar columna orden si no existe (migración)
        conn.execute(text('''
            ALTER TABLE juegos 
            ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;
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

        # Agregar columna orden si no existe (migración)
        conn.execute(text('''
            ALTER TABLE paquetes 
            ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;
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

        # Verificar si ya hay productos
        result = conn.execute(text('SELECT COUNT(*) FROM juegos'))
        product_count = result.fetchone()[0]

    # Insertar productos de ejemplo si no existen
        if product_count == 0:
            # Free Fire
            result = conn.execute(text('''
                INSERT INTO juegos (nombre, descripcion, imagen, categoria, orden) 
                VALUES (:nombre, :descripcion, :imagen, :categoria, :orden) RETURNING id
            '''), {
                'nombre': 'Free Fire',
                'descripcion': 'Juego de batalla real con acción intensa y gráficos increíbles',
                'imagen': '/static/images/20250701_212818_free_fire.webp',
                'categoria': 'juegos',
                'orden': 1
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
                INSERT INTO juegos (nombre, descripcion, imagen, categoria, orden) 
                VALUES (:nombre, :descripcion, :imagen, :categoria, :orden) RETURNING id
            '''), {
                'nombre': 'PUBG Mobile',
                'descripcion': 'Battle royale de última generación con mecánicas realistas',
                'imagen': '/static/images/default-product.jpg',
                'categoria': 'juegos',
                'orden': 2
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
                INSERT INTO juegos (nombre, descripcion, imagen, categoria, orden) 
                VALUES (:nombre, :descripcion, :imagen, :categoria, :orden) RETURNING id
            '''), {
                'nombre': 'Call of Duty Mobile',
                'descripcion': 'FPS de acción con multijugador competitivo y battle royale',
                'imagen': '/static/images/default-product.jpg',
                'categoria': 'juegos',
                'orden': 3
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
        result = conn.execute(text('''
            INSERT INTO ordenes (juego_id, paquete, monto, usuario_email, usuario_id, metodo_pago, referencia_pago, estado, fecha)
            VALUES (:juego_id, :paquete, :monto, :usuario_email, :usuario_id, :metodo_pago, :referencia_pago, 'procesando', CURRENT_TIMESTAMP)
            RETURNING id
        '''), {
            'juego_id': juego_id,
            'paquete': paquete,
            'monto': monto,
            'usuario_email': usuario_email,
            'usuario_id': usuario_id,
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
            'metodo_pago': orden_completa[6],
            'referencia_pago': orden_completa[7],
            'estado': orden_completa[8],
            'fecha': orden_completa[9],
            'juego_nombre': orden_completa[10]
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
        result = conn.execute(text('SELECT * FROM juegos ORDER BY id DESC'))
        productos = result.fetchall()

        # Convertir a lista de diccionarios y obtener paquetes para cada producto
        productos_list = []
        for producto in productos:
            producto_dict = dict(producto._mapping)

            # Obtener paquetes para este producto
            paquetes_result = conn.execute(text('SELECT * FROM paquetes WHERE juego_id = :juego_id ORDER BY orden ASC,