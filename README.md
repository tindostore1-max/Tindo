
# 🛡️ Panel Administrador Inefablestore

Panel web administrativo para gestionar el contenido y configuración del sitio Inefablestore. Desarrollado en Python Flask con PostgreSQL.

## 🚀 Características

- **Gestión de Órdenes**: Visualizar y actualizar el estado de órdenes
- **Gestión de Productos**: Crear, editar y eliminar juegos y paquetes
- **Gestión de Imágenes**: Subir y organizar imágenes del sistema
- **Configuración**: Ajustar configuraciones globales del sitio
- **Interfaz responsiva** con pestañas tipo Suis
- **API RESTful** para todas las operaciones

## 🛠️ Requisitos

- Python 3.11+
- PostgreSQL
- Dependencias de Python (se instalan automáticamente)

## 📦 Instalación

### 1. Configurar PostgreSQL

Primero, necesitas tener PostgreSQL instalado y crear la base de datos:

```bash
# Conectar a PostgreSQL como superusuario
sudo -u postgres psql

# Crear base de datos
CREATE DATABASE inefablestore;

# Crear usuario (opcional)
CREATE USER inefable_admin WITH PASSWORD 'tu_password_segura';
GRANT ALL PRIVILEGES ON DATABASE inefablestore TO inefable_admin;

\q
```

### 2. Configurar la aplicación

1. Edita el archivo `.env` con tus credenciales de PostgreSQL:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inefablestore
DB_USER=postgres
DB_PASSWORD=tu_password
```

2. (Opcional) Inicializar con datos de ejemplo:
```bash
psql -U postgres -d inefablestore -f init_db.sql
```

### 3. Ejecutar la aplicación

La aplicación se iniciará automáticamente cuando ejecutes:

```bash
python main.py
```

O simplemente haz clic en el botón **Run** en Replit.

## 🌐 Uso

1. Abre tu navegador en `http://localhost:5000` (o la URL de tu Repl)
2. Navega entre las pestañas del panel:
   - **📦 Órdenes**: Gestiona las órdenes de los usuarios
   - **🎮 Productos**: Administra juegos y paquetes
   - **🖼️ Imágenes**: Sube y organiza imágenes
   - **⚙️ Configuración**: Ajusta configuraciones del sistema

## 📋 Estructura de Pestañas

### 🔹 Órdenes
- Visualizar todas las órdenes con detalles completos
- Cambiar estado entre "procesando" y "procesado"
- Filtrar y buscar órdenes

### 🔹 Productos
- Crear nuevos juegos con múltiples paquetes
- Editar productos existentes
- Eliminar productos (elimina también sus paquetes)
- Gestionar precios por paquete

### 🔹 Imágenes
- Subir imágenes por categoría (logo, carrusel, producto)
- Visualizar galería de imágenes subidas
- Organización automática por tipo

### 🔹 Configuración
- Logo principal del sitio
- Tasa de conversión USD ↔ VES
- Datos de métodos de pago
- Configuraciones globales

## 🔧 API Endpoints

### Órdenes
- `GET /admin/ordenes` - Listar todas las órdenes
- `PATCH /admin/orden/:id` - Actualizar estado de orden

### Productos
- `GET /admin/productos` - Listar productos con paquetes
- `POST /admin/producto` - Crear nuevo producto
- `PUT /admin/producto/:id` - Actualizar producto
- `DELETE /admin/producto/:id` - Eliminar producto

### Imágenes
- `GET /admin/imagenes` - Listar imágenes
- `POST /admin/imagenes` - Subir nueva imagen

### Configuración
- `GET /admin/config` - Obtener configuración
- `PUT /admin/config` - Actualizar configuración

## 🗂️ Estructura de Base de Datos

```sql
juegos (id, nombre, descripcion, imagen)
├── paquetes (id, juego_id, nombre, precio)

ordenes (id, juego_id, paquete, monto, usuario_email, metodo_pago, referencia_pago, estado, fecha)

imagenes (id, tipo, ruta)

configuracion (id, campo, valor)
```

## 🔒 Seguridad

- Validación de formularios
- Sanitización de nombres de archivos
- Control de tipos de archivo para imágenes
- Transacciones de base de datos seguras

## 🎨 Personalización

El diseño utiliza CSS moderno con:
- Gradientes y sombras
- Diseño responsivo
- Animaciones suaves
- Tema tipo Suis con pestañas

## 🐛 Solución de Problemas

### Error de conexión a la base de datos
1. Verifica que PostgreSQL esté ejecutándose
2. Confirma las credenciales en `.env`
3. Asegúrate de que la base de datos `inefablestore` exista

### Error al subir imágenes
1. Verifica que el directorio `static/images` exista
2. Confirma permisos de escritura
3. Revisa el tamaño del archivo (máximo 5MB)

### Puerto ocupado
Si el puerto 5000 está ocupado, cambia la variable `PORT` en `.env`

## 📝 Notas Adicionales

- El sistema crea automáticamente las tablas necesarias al inicio
- Las imágenes se almacenan en `static/images/`
- Los datos de configuración se persisten en la base de datos
- La aplicación es completamente funcional y lista para producción

## 🤝 Contribuciones

Este panel fue desarrollado específicamente para Inefablestore según las especificaciones proporcionadas.

---

¡Listo para gestionar tu tienda de juegos! 🎮✨
