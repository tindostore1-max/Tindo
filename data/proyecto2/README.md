Coloca aquí una copia de tu base SQLite con las tablas ya creadas.

Archivo esperado:
- inefablestore.db

Cómo funciona en Render:
- En el arranque, la app llamará a ensure_storage_paths().
- Si no existe el archivo en la ruta DATABASE_PATH del entorno, intentará copiar este archivo seed:
  - data/proyecto2/inefablestore.db
  - (o la ruta indicada por la variable SEED_DB_PATH si la defines)
- Después ejecutará init_db() para asegurar columnas y datos base.

Notas:
- No incluyas datos sensibles en esta base si el repositorio es público.
- Si prefieres no versionar el .db, sube el archivo localmente y haz commit privado o usa SEED_DB_PATH para apuntar a otra ubicación dentro del contenedor.
