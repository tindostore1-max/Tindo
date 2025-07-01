from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from werkzeug.utils import secure_filename
from datetime import datetime
import json
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'tu_clave_secreta_aqui'
app.config['UPLOAD_FOLDER'] = 'static/images'

# Configuración de la base de datos usando variables de entorno de Replit
def get_db_config():
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        # Usar la URL de la base de datos de Replit
        return {'dsn': database_url}
    else:
        # Fallback a configuración manual
        return {
            'host': os.environ.get('DB_HOST', 'localhost'),
            'database': os.environ.get('DB_NAME', 'inefablestore'),
            'user': os.environ.get('DB_USER', 'postgres'),
            'password': os.environ.get('DB_PASSWORD', 'password'),
            'port': os.environ.get('DB_PORT', '5432')
        }

def get_db_connection():
    config = get_db_config()
    if 'dsn' in config:
        conn = psycopg2.connect(config['dsn'])
    else:
        conn = psycopg2.connect(**config)
    return conn

def init_db():
    """Inicializa las tablas de la base de datos"""
    conn = get_db_connection()
    cur = conn.cursor()

    # Crear tablas
    cur.execute('''
        CREATE TABLE IF NOT EXISTS juegos (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100),
            descripcion TEXT,
            imagen VARCHAR(255)
        );
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS paquetes (
            id SERIAL PRIMARY KEY,
            juego_id INTEGER REFERENCES juegos(id),
            nombre VARCHAR(100),
            precio NUMERIC(10,2)
        );
    ''')

    cur.execute('''
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
    ''')

    # Agregar columna usuario_id si no existe (migración)
    cur.execute('''
        ALTER TABLE ordenes 
        ADD COLUMN IF NOT EXISTS usuario_id VARCHAR(100);
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS imagenes (
            id SERIAL PRIMARY KEY,
            tipo VARCHAR(50),
            ruta VARCHAR(255)
        );
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS configuracion (
            id SERIAL PRIMARY KEY,
            campo VARCHAR(50) UNIQUE,
            valor TEXT
        );
    ''')
    
    # Crear tabla de usuarios
    cur.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')


    # Verificar si ya hay productos
    cur.execute('SELECT COUNT(*) FROM juegos')
    product_count = cur.fetchone()[0]

    # Insertar productos de ejemplo si no existen
    if product_count == 0:
        # Free Fire
        cur.execute('''
            INSERT INTO juegos (nombre, descripcion, imagen) 
            VALUES (%s, %s, %s) RETURNING id
        ''', ('Free Fire', 'Juego de batalla real con acción intensa y gráficos increíbles', '/static/images/20250701_212818_free_fire.webp'))

        ff_id = cur.fetchone()[0]

        # Paquetes de Free Fire
        ff_packages = [
            ('100 Diamantes', 2.99),
            ('310 Diamantes', 9.99),
            ('520 Diamantes', 14.99),
            ('1080 Diamantes', 29.99),
            ('2200 Diamantes', 59.99)
        ]

        for nombre, precio in ff_packages:
            cur.execute('''
                INSERT INTO paquetes (juego_id, nombre, precio) 
                VALUES (%s, %s, %s)
            ''', (ff_id, nombre, precio))

        # PUBG Mobile
        cur.execute('''
            INSERT INTO juegos (nombre, descripcion, imagen) 
            VALUES (%s, %s, %s) RETURNING id
        ''', ('PUBG Mobile', 'Battle royale de última generación con mecánicas realistas', '/static/images/default-product.jpg'))

        pubg_id = cur.fetchone()[0]

        # Paquetes de PUBG
        pubg_packages = [
            ('60 UC', 0.99),
            ('325 UC', 4.99),
            ('660 UC', 9.99),
            ('1800 UC', 24.99),
            ('3850 UC', 49.99)
        ]

        for nombre, precio in pubg_packages:
            cur.execute('''
                INSERT INTO paquetes (juego_id, nombre, precio) 
                VALUES (%s, %s, %s)
            ''', (pubg_id, nombre, precio))

        # Call of Duty Mobile
        cur.execute('''
            INSERT INTO juegos (nombre, descripcion, imagen) 
            VALUES (%s, %s, %s) RETURNING id
        ''', ('Call of Duty Mobile', 'FPS de acción con multijugador competitivo y battle royale', '/static/images/default-product.jpg'))

        cod_id = cur.fetchone()[0]

        # Paquetes de COD
        cod_packages = [
            ('80 CP', 0.99),
            ('400 CP', 4.99),
            ('800 CP', 9.99),
            ('2000 CP', 19.99),
            ('5000 CP', 49.99)
        ]

        for nombre, precio in cod_packages:
            cur.execute('''
                INSERT INTO paquetes (juego_id, nombre, precio) 
                VALUES (%s, %s, %s)
            ''', (cod_id, nombre, precio))

    # Insertar configuración básica si no existe
    cur.execute('SELECT COUNT(*) FROM configuracion')
    config_count = cur.fetchone()[0]

    if config_count == 0:
        configs = [
            ('tasa_usd_ves', '36.50'),
            ('pago_movil', 'Banco: Banesco\nTelefono: 0412-1234567\nCédula: V-12345678\nNombre: Store Admin'),
            ('binance', 'Email: admin@inefablestore.com\nID Binance: 123456789')
        ]

        for campo, valor in configs:
            cur.execute('''
                INSERT INTO configuracion (campo, valor) 
                VALUES (%s, %s)
            ''', (campo, valor))

    conn.commit()
    cur.close()
    conn.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

# ENDPOINT PARA CREAR ÓRDENES DESDE EL FRONTEND
@app.route('/orden', methods=['POST'])
def create_orden():
    data = request.get_json()
    juego_id = data.get('juego_id')
    paquete = data.get('paquete')
    monto = data.get('monto')
    usuario_email = data.get('usuario_email')
    usuario_id = data.get('usuario_id')  # ID del usuario en el juego
    metodo_pago = data.get('metodo_pago')
    referencia_pago = data.get('referencia_pago')

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute('''
        INSERT INTO ordenes (juego_id, paquete, monto, usuario_email, usuario_id, metodo_pago, referencia_pago, estado, fecha)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'procesando', CURRENT_TIMESTAMP)
        RETURNING id
    ''', (juego_id, paquete, monto, usuario_email, usuario_id, metodo_pago, referencia_pago))

    orden_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({'message': 'Orden creada correctamente', 'id': orden_id})

# ENDPOINTS PARA ÓRDENES
@app.route('/admin/ordenes', methods=['GET'])
def get_ordenes():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('''
        SELECT o.*, j.nombre as juego_nombre 
        FROM ordenes o 
        LEFT JOIN juegos j ON o.juego_id = j.id 
        ORDER BY o.fecha DESC
    ''')
    ordenes = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([dict(orden) for orden in ordenes])

@app.route('/admin/orden/<int:orden_id>', methods=['PATCH'])
def update_orden(orden_id):
    data = request.get_json()
    nuevo_estado = data.get('estado')

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('UPDATE ordenes SET estado = %s WHERE id = %s', (nuevo_estado, orden_id))
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({'message': 'Estado actualizado correctamente'})

# ENDPOINTS PARA PRODUCTOS
@app.route('/admin/productos', methods=['GET'])
def get_productos():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM juegos ORDER BY id DESC')
    productos = cur.fetchall()

    # Obtener paquetes para cada producto
    for producto in productos:
        cur.execute('SELECT * FROM paquetes WHERE juego_id = %s', (producto['id'],))
        producto['paquetes'] = cur.fetchall()

    cur.close()
    conn.close()
    return jsonify([dict(producto) for producto in productos])

@app.route('/admin/producto', methods=['POST'])
def create_producto():
    data = request.get_json()
    nombre = data.get('nombre')
    descripcion = data.get('descripcion')
    imagen = data.get('imagen', '')
    paquetes = data.get('paquetes', [])

    conn = get_db_connection()
    cur = conn.cursor()

    # Insertar producto
    cur.execute(
        'INSERT INTO juegos (nombre, descripcion, imagen) VALUES (%s, %s, %s) RETURNING id',
        (nombre, descripcion, imagen)
    )
    producto_id = cur.fetchone()[0]

    # Insertar paquetes
    for paquete in paquetes:
        cur.execute(
            'INSERT INTO paquetes (juego_id, nombre, precio) VALUES (%s, %s, %s)',
            (producto_id, paquete['nombre'], paquete['precio'])
        )

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({'message': 'Producto creado correctamente', 'id': producto_id})

@app.route('/admin/producto/<int:producto_id>', methods=['PUT'])
def update_producto(producto_id):
    data = request.get_json()
    nombre = data.get('nombre')
    descripcion = data.get('descripcion')
    imagen = data.get('imagen', '')
    paquetes = data.get('paquetes', [])

    conn = get_db_connection()
    cur = conn.cursor()

    # Actualizar producto
    cur.execute(
        'UPDATE juegos SET nombre = %s, descripcion = %s, imagen = %s WHERE id = %s',
        (nombre, descripcion, imagen, producto_id)
    )

    # Eliminar paquetes existentes y crear nuevos
    cur.execute('DELETE FROM paquetes WHERE juego_id = %s', (producto_id,))

    for paquete in paquetes:
        cur.execute(
            'INSERT INTO paquetes (juego_id, nombre, precio) VALUES (%s, %s, %s)',
            (producto_id, paquete['nombre'], paquete['precio'])
        )

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({'message': 'Producto actualizado correctamente'})

@app.route('/admin/producto/<int:producto_id>', methods=['DELETE'])
def delete_producto(producto_id):
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Eliminar órdenes relacionadas primero
        cur.execute('DELETE FROM ordenes WHERE juego_id = %s', (producto_id,))
        # Eliminar paquetes
        cur.execute('DELETE FROM paquetes WHERE juego_id = %s', (producto_id,))
        # Eliminar producto
        cur.execute('DELETE FROM juegos WHERE id = %s', (producto_id,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'message': 'Producto eliminado correctamente'})

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': f'Error al eliminar producto: {str(e)}'}), 500

# ENDPOINT PÚBLICO PARA PRODUCTOS (FRONTEND DE USUARIOS)
@app.route('/productos', methods=['GET'])
def get_productos_publico():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM juegos ORDER BY id DESC')
    productos = cur.fetchall()

    # Obtener paquetes para cada producto
    for producto in productos:
        cur.execute('SELECT * FROM paquetes WHERE juego_id = %s ORDER BY precio ASC', (producto['id'],))
        producto['paquetes'] = cur.fetchall()

    cur.close()
    conn.close()
    return jsonify([dict(producto) for producto in productos])

# ENDPOINT PÚBLICO PARA CONFIGURACIÓN (FRONTEND DE USUARIOS)
@app.route('/config', methods=['GET'])
def get_config_publico():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM configuracion')
    configs = cur.fetchall()
    cur.close()
    conn.close()

    # Convertir a diccionario
    config_dict = {}
    for config in configs:
        config_dict[config['campo']] = config['valor']

    return jsonify(config_dict)

# ENDPOINTS PARA IMÁGENES
@app.route('/admin/imagenes', methods=['GET'])
def get_imagenes():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM imagenes ORDER BY tipo, id')
    imagenes = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([dict(imagen) for imagen in imagenes])

@app.route('/admin/imagenes', methods=['POST'])
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
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO imagenes (tipo, ruta) VALUES (%s, %s) RETURNING id',
            (tipo, f'images/{filename}')
        )
        imagen_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            'message': 'Imagen subida correctamente',
            'id': imagen_id,
            'ruta': f'images/{filename}'
        })

@app.route('/admin/imagen/<int:imagen_id>', methods=['DELETE'])
def delete_imagen(imagen_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Obtener información de la imagen antes de eliminarla
    cur.execute('SELECT * FROM imagenes WHERE id = %s', (imagen_id,))
    imagen = cur.fetchone()

    if not imagen:
        cur.close()
        conn.close()
        return jsonify({'error': 'Imagen no encontrada'}), 404

    # Eliminar archivo físico
    file_path = os.path.join('static', imagen['ruta'])
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error al eliminar archivo: {e}")

    # Eliminar de la base de datos
    cur.execute('DELETE FROM imagenes WHERE id = %s', (imagen_id,))
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({'message': 'Imagen eliminada correctamente'})

# ENDPOINTS PARA CONFIGURACIÓN
@app.route('/admin/config', methods=['GET'])
def get_config():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM configuracion')
    configs = cur.fetchall()
    cur.close()
    conn.close()

    # Convertir a diccionario
    config_dict = {}
    for config in configs:
        config_dict[config['campo']] = config['valor']

    return jsonify(config_dict)

@app.route('/config', methods=['PUT'])
def update_config():
    data = request.get_json()

    conn = get_db_connection()
    cur = conn.cursor()

    for campo, valor in data.items():
        cur.execute('''
            INSERT INTO configuracion (campo, valor) VALUES (%s, %s) 
            ON CONFLICT (campo) DO UPDATE SET valor = EXCLUDED.valor
        ''', (campo, valor))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({'message': 'Configuración actualizada correctamente'})

# ENDPOINTS DE AUTENTICACIÓN
@app.route('/registro', methods=['POST'])
def registro():
    data = request.get_json()
    nombre = data.get('nombre')
    email = data.get('email')
    password = data.get('password')

    if not nombre or not email or not password:
        return jsonify({'error': 'Todos los campos son requeridos'}), 400

    # Verificar si el email ya existe
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute('SELECT id FROM usuarios WHERE email = %s', (email,))
    if cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({'error': 'El email ya está registrado'}), 400

    # Crear nuevo usuario
    password_hash = generate_password_hash(password)

    try:
        cur.execute('''
            INSERT INTO usuarios (nombre, email, password_hash)
            VALUES (%s, %s, %s) RETURNING id
        ''', (nombre, email, password_hash))

        user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'message': 'Usuario registrado correctamente', 'user_id': user_id})

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': 'Error al registrar usuario'}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email y contraseña son requeridos'}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute('SELECT * FROM usuarios WHERE email = %s', (email,))
    usuario = cur.fetchone()

    cur.close()
    conn.close()

    if usuario and check_password_hash(usuario['password_hash'], password):
        # Guardar sesión
        session['user_id'] = usuario['id']
        session['user_email'] = usuario['email']
        session['user_name'] = usuario['nombre']

        return jsonify({
            'message': 'Sesión iniciada correctamente',
            'usuario': {
                'id': usuario['id'],
                'nombre': usuario['nombre'],
                'email': usuario['email'],
                'fecha_registro': usuario['fecha_registro'].isoformat()
            }
        })
    else:
        return jsonify({'error': 'Email o contraseña incorrectos'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Sesión cerrada correctamente'})

@app.route('/usuario', methods=['GET'])
def get_usuario():
    if 'user_id' not in session:
        return jsonify({'error': 'No hay sesión activa'}), 401

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute('SELECT id, nombre, email, fecha_registro FROM usuarios WHERE id = %s', (session['user_id'],))
    usuario = cur.fetchone()

    cur.close()
    conn.close()

    if usuario:
        return jsonify({
            'usuario': {
                'id': usuario['id'],
                'nombre': usuario['nombre'],
                'email': usuario['email'],
                'fecha_registro': usuario['fecha_registro'].isoformat()
            }
        })
    else:
        return jsonify({'error': 'Usuario no encontrado'}), 404

@app.route('/usuario/historial', methods=['GET'])
def get_historial_usuario():
    if 'user_id' not in session:
        return jsonify({'error': 'No hay sesión activa'}), 401

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Obtener órdenes del usuario usando su email de sesión
    cur.execute('''
        SELECT o.*, j.nombre as juego_nombre 
        FROM ordenes o 
        LEFT JOIN juegos j ON o.juego_id = j.id 
        WHERE o.usuario_email = %s 
        ORDER BY o.fecha DESC
    ''', (session['user_email'],))
    
    ordenes = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify([dict(orden) for orden in ordenes])

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