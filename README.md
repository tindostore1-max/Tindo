
# 🛡️ Panel Administrador Inefablestore

Panel web administrativo para gestionar el contenido y configuración del sitio Inefablestore. Desarrollado en Python Flask con SQLite (migrado desde PostgreSQL).

## 🚀 Características

- **Gestión de Órdenes**: Visualizar y actualizar el estado de órdenes
- **Gestión de Productos**: Crear, editar y eliminar juegos y paquetes
- **Gestión de Imágenes**: Subir y organizar imágenes del sistema
- **Configuración**: Ajustar configuraciones globales del sitio
- **Interfaz responsiva** con pestañas tipo Suis
- **API RESTful** para todas las operaciones

## 🛠️ Requisitos

- Python 3.11+
- Dependencias de Python (se instalan automáticamente)

## 📦 Instalación

### 1) Configurar variables de entorno

Crea o edita el archivo `.env` en la raíz del proyecto con estas claves mínimas:

```
# SQLite
DATABASE_PATH=inefablestore.db

# App
SECRET_KEY=una_clave_segura

# (Opcional) Crear/actualizar admin automáticamente al iniciar
ADMIN_EMAIL=admin@inefablestore.com
ADMIN_PASSWORD=admin123
```

### 2) Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3) Ejecutar la aplicación

```bash
# En Windows se recomienda forzar UTF-8 para evitar errores con emojis en logs
python -X utf8 main.py
```

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

## 🗂️ Estructura de Base de Datos (SQLite)

```sql
juegos (id, nombre, descripcion, imagen, categoria, orden, etiquetas)
├── paquetes (id, juego_id, nombre, precio, orden, imagen)

ordenes (id, juego_id, paquete, monto, usuario_email, usuario_id, usuario_telefono, metodo_pago, referencia_pago, codigo_producto, estado, fecha)

imagenes (id, tipo, ruta)

configuracion (id, campo, valor)

usuarios (id, nombre, email, telefono, password_hash, es_admin, fecha_registro)
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
1. Verifica permisos de escritura en el directorio del proyecto
2. Revisa que `DATABASE_PATH` apunte a una ruta válida
3. Ejecuta con UTF-8 en Windows: `python -X utf8 main.py`

### Error al subir imágenes
1. Verifica que el directorio `static/images` exista
2. Confirma permisos de escritura
3. Revisa el tamaño del archivo (máximo 5MB)

### Puerto ocupado
Si el puerto 5000 está ocupado, cambia la variable `PORT` en `.env`

## 📝 Notas Adicionales

- El sistema crea automáticamente las tablas necesarias al inicio (SQLite)
- Las imágenes se almacenan en `static/images/`
- Los datos de configuración se persisten en la base de datos
- La aplicación es completamente funcional y lista para producción

## 🧪 Verificación rápida de admin

- Inicia sesión con `POST /login` enviando `{ "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD }`.
- Verifica sesión y DB con `GET /admin/ping` (requiere haber iniciado sesión).

## 📁 Carpeta legacy/

- `legacy/init_db.postgres.sql`: script histórico de PostgreSQL (no usado con SQLite).
- `legacy/sqlite_fallback.py`: legado; la inicialización actual se hace en `main.py:init_db()`.

## 🧰 Script CLI para crear/actualizar Admin

Puedes crear/actualizar un admin desde consola con:

```bash
python scripts/seed_admin.py --email admin@inefablestore.com --password admin123
```

Opcionalmente, puedes definir variables de entorno `ADMIN_EMAIL` y `ADMIN_PASSWORD` y ejecutar sin flags.

## ☁️ Despliegue en Render

- **Blueprint**: El archivo `render.yaml` en la raíz define el servicio web.
- **Disco persistente**: Se crea y monta automáticamente en `/var/data` (ver `render.yaml` → `disk`). La app usa `DATABASE_PATH=/var/data/inefablestore.db` para que SQLite persista entre despliegues.
- **Comando de inicio**: `gunicorn main:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`.

### Variables de entorno en Render

- En producción (Render) NO se usa tu archivo `.env`. Debes configurar variables desde el panel o como Secrets.
- Ya están declaradas en `render.yaml`:
  - `DATABASE_PATH=/var/data/inefablestore.db`
  - `SECRET_KEY` (autogenerada)
  - `ADMIN_EMAIL` y `ADMIN_PASSWORD` (con `fromSecret`)

### Configurar Secrets en el panel de Render

1. Ve a tu servicio → `Settings` → `Secrets` → `Add Secret`.
2. Crea los siguientes secrets:
   - `ADMIN_EMAIL` → tu correo de administrador
   - `ADMIN_PASSWORD` → tu contraseña segura
3. Redeploy del servicio.

Al iniciar, `init_db()` en `main.py` creará o actualizará el usuario admin con esas credenciales.

### Comprobación en Render

- La ruta `/` es el `healthCheckPath` y debería responder tras la inicialización.
- Si algo falla, revisa `Logs` del servicio en el panel de Render.

### Desarrollo local vs Producción

- Local: usa `.env` (copia desde `.env.example`) y ejecuta `python -X utf8 main.py`.
- Producción (Render): usa variables del panel/Secrets. El `.env` del repo no se lee en Render.

## 🤝 Contribuciones

Este panel fue desarrollado específicamente para Inefablestore según las especificaciones proporcionadas.

---

¡Listo para gestionar tu tienda de juegos! 🎮✨
# Tindostore
