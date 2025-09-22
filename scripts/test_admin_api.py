import json
import requests

BASE = 'http://127.0.0.1:5000'
ADMIN_EMAIL = 'admin@inefablestore.com'
ADMIN_PASSWORD = 'admin123'

s = requests.Session()

print('== Login admin ==')
r = s.post(f'{BASE}/login', json={'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD})
print('login status:', r.status_code)
print('login body:', r.text)

print('\n== /admin/ping ==')
r = s.get(f'{BASE}/admin/ping')
print('ping status:', r.status_code)
print('ping body:', r.text)

print('\n== Crear producto de prueba ==')
producto = {
    'nombre': 'Producto Prueba SQLite',
    'descripcion': 'Producto creado por test_admin_api',
    'imagen': '',
    'categoria': 'juegos',
    'orden': 99,
    'etiquetas': 'test,sqlite',
    'paquetes': [
        {'nombre': 'Paquete Básico', 'precio': 1.99, 'orden': 1},
        {'nombre': 'Paquete Pro', 'precio': 4.99, 'orden': 2}
    ]
}
r = s.post(f'{BASE}/admin/producto', json=producto)
print('create status:', r.status_code)
print('create body:', r.text)

print('\n== Listar productos ==')
r = s.get(f'{BASE}/admin/productos')
print('productos status:', r.status_code)
if r.ok:
    data = r.json()
    print('total productos:', len(data))
    # mostrar ultimo
    if data:
        print('ultimo:', json.dumps(data[-1], ensure_ascii=False)[:500])
else:
    print('productos body:', r.text)
