
-- Script para inicializar la base de datos PostgreSQL de Inefablestore

-- Crear base de datos (ejecutar como superusuario)
-- CREATE DATABASE inefablestore;

-- Conectar a la base de datos inefablestore antes de ejecutar el resto

-- Crear tablas
CREATE TABLE IF NOT EXISTS juegos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    imagen VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS paquetes (
    id SERIAL PRIMARY KEY,
    juego_id INTEGER REFERENCES juegos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS ordenes (
    id SERIAL PRIMARY KEY,
    juego_id INTEGER REFERENCES juegos(id),
    paquete VARCHAR(100) NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    usuario_email VARCHAR(100) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    referencia_pago VARCHAR(100) NOT NULL,
    estado VARCHAR(20) DEFAULT 'procesando',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS imagenes (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- logo, carrusel, producto
    ruta VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS configuracion (
    id SERIAL PRIMARY KEY,
    campo VARCHAR(50) UNIQUE NOT NULL,
    valor TEXT
);

-- Insertar datos de ejemplo

-- Juegos de ejemplo
INSERT INTO juegos (nombre, descripcion, imagen) VALUES
('Free Fire', 'Battle Royale móvil más popular del mundo', 'freefire.jpg'),
('Mobile Legends', 'MOBA 5v5 para dispositivos móviles', 'mobilelegends.jpg'),
('PUBG Mobile', 'Battle Royale realista para móviles', 'pubgmobile.jpg'),
('Fortnite', 'Battle Royale con construcción', 'fortnite.jpg');

-- Paquetes para Free Fire
INSERT INTO paquetes (juego_id, nombre, precio) VALUES
(1, '110 + 10 Diamantes', 1.00),
(1, '310 + 31 Diamantes', 3.00),
(1, '520 + 52 Diamantes', 5.00),
(1, '1080 + 108 Diamantes', 10.00),
(1, '2180 + 218 Diamantes', 20.00);

-- Paquetes para Mobile Legends
INSERT INTO paquetes (juego_id, nombre, precio) VALUES
(2, '86 + 8 Diamantes', 1.00),
(2, '172 + 17 Diamantes', 2.00),
(2, '344 + 34 Diamantes', 4.00),
(2, '706 + 70 Diamantes', 8.00),
(2, '1412 + 141 Diamantes', 16.00);

-- Paquetes para PUBG Mobile
INSERT INTO paquetes (juego_id, nombre, precio) VALUES
(3, '60 + 6 UC', 1.00),
(3, '325 + 32 UC', 5.00),
(3, '660 + 66 UC', 10.00),
(3, '1800 + 180 UC', 25.00),
(3, '3850 + 385 UC', 50.00);

-- Paquetes para Fortnite
INSERT INTO paquetes (juego_id, nombre, precio) VALUES
(4, '1000 V-Bucks', 8.00),
(4, '2800 V-Bucks', 20.00),
(4, '5000 V-Bucks', 32.00),
(4, '13500 V-Bucks', 80.00);

-- Órdenes de ejemplo
INSERT INTO ordenes (juego_id, paquete, monto, usuario_email, metodo_pago, referencia_pago, estado, fecha) VALUES
(1, '110 + 10 Diamantes', 1.00, 'usuario1@email.com', 'Pago Móvil', 'PM001234567', 'procesando', NOW() - INTERVAL '2 hours'),
(2, '86 + 8 Diamantes', 1.00, 'usuario2@email.com', 'Binance', 'BIN789456123', 'procesado', NOW() - INTERVAL '1 day'),
(1, '520 + 52 Diamantes', 5.00, 'usuario3@email.com', 'Pago Móvil', 'PM987654321', 'procesando', NOW() - INTERVAL '30 minutes'),
(3, '325 + 32 UC', 5.00, 'usuario4@email.com', 'Binance', 'BIN456789123', 'procesado', NOW() - INTERVAL '3 hours');

-- Configuración inicial
INSERT INTO configuracion (campo, valor) VALUES
('logo', '/static/images/logo.png'),
('tasa_usd_ves', '36.50'),
('pago_movil', 'Número: 0424-1234567\nTitular: Juan Pérez\nBanco: Banesco\nC.I: 12.345.678'),
('binance', 'Email: pagos@inefablestore.com\nID: 123456789\nUsuario: InefableStore');

-- Imágenes de ejemplo
INSERT INTO imagenes (tipo, ruta) VALUES
('logo', 'images/logo_principal.png'),
('carrusel', 'images/banner_freefire.jpg'),
('carrusel', 'images/banner_mobilelegends.jpg'),
('producto', 'images/freefire_product.jpg'),
('producto', 'images/mobilelegends_product.jpg');

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_ordenes_fecha ON ordenes(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_paquetes_juego ON paquetes(juego_id);
CREATE INDEX IF NOT EXISTS idx_imagenes_tipo ON imagenes(tipo);
CREATE INDEX IF NOT EXISTS idx_configuracion_campo ON configuracion(campo);

-- Comentarios en las tablas
COMMENT ON TABLE juegos IS 'Tabla que almacena los juegos disponibles en la tienda';
COMMENT ON TABLE paquetes IS 'Tabla que almacena los paquetes de cada juego con sus precios';
COMMENT ON TABLE ordenes IS 'Tabla que almacena todas las órdenes realizadas por los usuarios';
COMMENT ON TABLE imagenes IS 'Tabla que almacena las rutas de las imágenes del sistema';
COMMENT ON TABLE configuracion IS 'Tabla que almacena la configuración global del sistema';
