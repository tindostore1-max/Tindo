
// Variables globales
let productos = [];
let carrito = [];
let monedaActual = 'USD';
let tasaUSDVES = 36.50;
let configuracion = {};
let productoSeleccionado = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    cargarConfiguracion();
    cargarProductos();
    inicializarEventos();
    verificarSesion();
});

// Verificar si hay sesión activa
async function verificarSesion() {
    try {
        const response = await fetch('/usuario');
        if (response.ok) {
            const data = await response.json();
            actualizarInterfazUsuario(data.usuario);
        }
    } catch (error) {
        console.log('No hay sesión activa');
    }
}

// Funciones de navegación
function mostrarTab(tabName) {
    // Ocultar todas las secciones
    document.querySelectorAll('.tab-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Quitar clase active de todos los botones
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar sección seleccionada
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Cargar datos específicos según la pestaña
    if (tabName === 'carrito') {
        mostrarCarrito();
    } else if (tabName === 'pago') {
        prepararPago();
    }
}

// Función para mostrar alertas
function mostrarAlerta(mensaje, tipo = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo}`;
    alertDiv.textContent = mensaje;
    
    const contenido = document.querySelector('.content');
    contenido.insertBefore(alertDiv, contenido.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 4000);
}

// Cargar configuración del sistema
async function cargarConfiguracion() {
    try {
        const response = await fetch('/config');
        configuracion = await response.json();
        
        // Actualizar logo si existe
        if (configuracion.logo) {
            document.getElementById('logo-img').src = configuracion.logo;
        }
        
        // Actualizar tasa de cambio
        if (configuracion.tasa_usd_ves) {
            tasaUSDVES = parseFloat(configuracion.tasa_usd_ves);
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
}

// Cargar productos del backend
async function cargarProductos() {
    try {
        const response = await fetch('/productos');
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        productos = await response.json();
        console.log('Productos cargados:', productos);
        mostrarProductos();
    } catch (error) {
        console.error('Error al cargar productos:', error);
        document.getElementById('productos-grid').innerHTML = '<p>Error al cargar productos. Verifica la conexión.</p>';
    }
}

// Mostrar productos en el catálogo
function mostrarProductos() {
    const grid = document.getElementById('productos-grid');
    grid.className = 'product-grid';
    
    if (!productos || productos.length === 0) {
        grid.innerHTML = '<p>No hay productos disponibles</p>';
        return;
    }
    
    let html = '';
    productos.forEach(producto => {
        // Corregir ruta de imagen
        let imagenUrl = producto.imagen || '';
        if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
            imagenUrl = `/static/${imagenUrl}`;
        }
        if (!imagenUrl) {
            imagenUrl = 'https://via.placeholder.com/300x200/007bff/ffffff?text=Producto';
        }
        
        // Calcular precio más bajo
        let precioMinimo = 0;
        if (producto.paquetes && Array.isArray(producto.paquetes) && producto.paquetes.length > 0) {
            precioMinimo = Math.min(...producto.paquetes.map(p => parseFloat(p.precio) || 0));
        }
        
        html += `
            <div class="product-card">
                <img src="${imagenUrl}" alt="${producto.nombre || 'Producto'}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200/007bff/ffffff?text=Producto'">
                <div class="product-name">${producto.nombre || 'Producto sin nombre'}</div>
                <div class="product-description">${producto.descripcion || 'Sin descripción'}</div>
                <div class="price-desde">Desde $${precioMinimo.toFixed(2)} = Bs. ${(precioMinimo * tasaUSDVES).toFixed(2)}</div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// Ver detalles de un producto
function verDetalleProducto(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;
    
    productoSeleccionado = producto;
    
    // Corregir ruta de imagen
    let imagenUrl = producto.imagen || '';
    if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
        imagenUrl = `/static/${imagenUrl}`;
    }
    if (!imagenUrl) {
        imagenUrl = 'https://via.placeholder.com/400x300/007bff/ffffff?text=Producto';
    }
    
    let html = `
        <div style="margin-top: 20px;">
            <img src="${imagenUrl}" alt="${producto.nombre || 'Producto'}" style="width: 100%; max-width: 400px; height: 300px; object-fit: cover; border-radius: 15px; margin-bottom: 20px;" onerror="this.src='https://via.placeholder.com/400x300/007bff/ffffff?text=Producto'">
            <h2>${producto.nombre || 'Producto sin nombre'}</h2>
            <p style="margin: 15px 0; color: #6c757d; font-size: 16px;">${producto.descripcion || 'Sin descripción disponible'}</p>
            <h3>📦 Paquetes Disponibles</h3>
            <div class="package-list" style="margin-top: 20px;">
    `;
    
    if (producto.paquetes && Array.isArray(producto.paquetes) && producto.paquetes.length > 0) {
        producto.paquetes.forEach(paquete => {
            try {
                const precio = convertirPrecio(parseFloat(paquete.precio) || 0);
                const nombrePaquete = (paquete.nombre || 'Paquete').replace(/'/g, "\\'");
                html += `
                    <div class="package-item" style="margin-bottom: 15px; padding: 15px;">
                        <div>
                            <div style="font-weight: 600; font-size: 16px;">${paquete.nombre || 'Paquete'}</div>
                            <div style="color: #28a745; font-weight: 700; font-size: 18px;">${precio}</div>
                        </div>
                        <button class="btn btn-success" onclick="agregarAlCarrito(${producto.id}, '${nombrePaquete}', ${parseFloat(paquete.precio) || 0})">
                            🛒 Agregar al carrito
                        </button>
                    </div>
                `;
            } catch (error) {
                console.error('Error al procesar paquete en detalles:', error, paquete);
            }
        });
    } else {
        html += '<p>No hay paquetes disponibles para este producto.</p>';
    }
    
    html += '</div></div>';
    
    document.getElementById('producto-detalle').innerHTML = html;
    mostrarTab('detalles');
    
    // Actualizar botón activo manualmente
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
}

// Convertir precio según moneda seleccionada
function convertirPrecio(precioUSD) {
    if (monedaActual === 'VES') {
        const precioVES = (precioUSD * tasaUSDVES).toFixed(2);
        return `Bs. ${precioVES}`;
    }
    return `$${precioUSD.toFixed(2)}`;
}

// Agregar producto al carrito
function agregarAlCarrito(productoId, paqueteNombre, precio) {
    // Verificar que se haya ingresado el ID de usuario
    const usuarioId = document.getElementById('usuario-id-juego').value.trim();
    if (!usuarioId) {
        mostrarAlerta('Por favor ingresa tu ID de usuario del juego antes de agregar al carrito', 'error');
        document.getElementById('usuario-id-juego').focus();
        return;
    }
    
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;
    
    const item = {
        id: Date.now(), // ID único para el item del carrito
        productoId,
        productoNombre: producto.nombre,
        paqueteNombre,
        precio: precio,
        cantidad: 1,
        usuarioId: usuarioId // Guardar el ID del usuario
    };
    
    // Verificar si ya existe el mismo item con el mismo ID de usuario
    const existeItem = carrito.find(item => 
        item.productoId === productoId && 
        item.paqueteNombre === paqueteNombre && 
        item.usuarioId === usuarioId
    );
    
    if (existeItem) {
        existeItem.cantidad += 1;
    } else {
        carrito.push(item);
    }
    
    actualizarContadorCarrito();
    mostrarAlerta(`${paqueteNombre} agregado al carrito`);
}

// Actualizar contador del carrito
function actualizarContadorCarrito() {
    const total = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('cart-count').textContent = total;
}

// Mostrar carrito
function mostrarCarrito() {
    const container = document.getElementById('carrito-items');
    
    if (carrito.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 40px;">Tu carrito está vacío</p>';
        document.getElementById('carrito-total').textContent = 'Total: $0.00';
        return;
    }
    
    let html = '';
    let total = 0;
    
    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        
        html += `
            <div class="cart-item">
                <div>
                    <div style="font-weight: 600;">${item.productoNombre}</div>
                    <div style="color: #6c757d;">${item.paqueteNombre}</div>
                    <div style="color: #007bff; font-size: 14px; font-weight: 500;">🎮 ID: ${item.usuarioId || 'No especificado'}</div>
                    <div style="color: #28a745; font-weight: 600;">${convertirPrecio(item.precio)} x ${item.cantidad}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn btn-primary" onclick="cambiarCantidad(${item.id}, -1)">-</button>
                    <span style="font-weight: 600; min-width: 30px; text-align: center;">${item.cantidad}</span>
                    <button class="btn btn-primary" onclick="cambiarCantidad(${item.id}, 1)">+</button>
                    <button class="btn btn-danger" onclick="eliminarDelCarrito(${item.id})">🗑️</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('carrito-total').textContent = `Total: ${convertirPrecio(total)}`;
}

// Cambiar cantidad de un item
function cambiarCantidad(itemId, cambio) {
    const item = carrito.find(i => i.id === itemId);
    if (!item) return;
    
    item.cantidad += cambio;
    
    if (item.cantidad <= 0) {
        eliminarDelCarrito(itemId);
    } else {
        mostrarCarrito();
        actualizarContadorCarrito();
    }
}

// Eliminar item del carrito
function eliminarDelCarrito(itemId) {
    carrito = carrito.filter(item => item.id !== itemId);
    mostrarCarrito();
    actualizarContadorCarrito();
}

// Proceder al pago
function procederAlPago() {
    if (carrito.length === 0) {
        mostrarAlerta('Tu carrito está vacío', 'error');
        return;
    }
    mostrarTab('pago');
    // Actualizar botón activo manualmente
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[onclick="mostrarTab(\'pago\')"]').classList.add('active');
}

// Preparar información de pago
function prepararPago() {
    // Cargar total del carrito
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    // Mostrar información según método seleccionado
    const metodoSelect = document.getElementById('metodo-pago');
    metodoSelect.addEventListener('change', function() {
        const infoPago = document.getElementById('info-pago');
        
        if (this.value === 'Pago Móvil' && configuracion.pago_movil) {
            infoPago.innerHTML = `
                <h4>📱 Información de Pago Móvil</h4>
                <pre style="white-space: pre-wrap; font-family: inherit;">${configuracion.pago_movil}</pre>
                <p><strong>Monto a pagar:</strong> ${convertirPrecio(total)}</p>
            `;
            infoPago.style.display = 'block';
        } else if (this.value === 'Binance' && configuracion.binance) {
            infoPago.innerHTML = `
                <h4>💰 Información de Binance</h4>
                <pre style="white-space: pre-wrap; font-family: inherit;">${configuracion.binance}</pre>
                <p><strong>Monto a pagar:</strong> $${total.toFixed(2)} USD</p>
            `;
            infoPago.style.display = 'block';
        } else {
            infoPago.style.display = 'none';
        }
    });
}

// Inicializar eventos
function inicializarEventos() {
    // Selector de moneda
    document.getElementById('selector-moneda').addEventListener('change', function() {
        monedaActual = this.value;
        mostrarProductos();
        mostrarCarrito();
    });
    
    // Formulario de pago
    document.getElementById('form-pago').addEventListener('submit', async function(e) {
        e.preventDefault();
        await procesarPago();
    });
    
    // Formulario de login
    document.getElementById('form-login').addEventListener('submit', async function(e) {
        e.preventDefault();
        await procesarLogin();
    });
    
    // Formulario de registro
    document.getElementById('form-registro').addEventListener('submit', async function(e) {
        e.preventDefault();
        await procesarRegistro();
    });
}

// Procesar pago
async function procesarPago() {
    const email = document.getElementById('pago-email').value;
    const metodoPago = document.getElementById('metodo-pago').value;
    const referencia = document.getElementById('referencia-pago').value;
    
    if (carrito.length === 0) {
        mostrarAlerta('Tu carrito está vacío', 'error');
        return;
    }
    
    try {
        // Crear una orden por cada item del carrito
        for (const item of carrito) {
            const orden = {
                juego_id: item.productoId,
                paquete: item.paqueteNombre,
                monto: item.precio * item.cantidad,
                usuario_email: email,
                usuario_id: item.usuarioId, // Incluir el ID del usuario del juego
                metodo_pago: metodoPago,
                referencia_pago: referencia
            };
            
            const response = await fetch('/orden', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orden)
            });
            
            if (!response.ok) {
                throw new Error('Error al procesar la orden');
            }
        }
        
        // Limpiar carrito y mostrar éxito
        carrito = [];
        actualizarContadorCarrito();
        document.getElementById('form-pago').reset();
        mostrarAlerta('¡Pago procesado correctamente! Te contactaremos pronto.');
        mostrarTab('catalogo');
        
    } catch (error) {
        console.error('Error al procesar pago:', error);
        mostrarAlerta('Error al procesar el pago. Inténtalo de nuevo.', 'error');
    }
}

// Procesar login
async function procesarLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarAlerta('Sesión iniciada correctamente');
            document.getElementById('form-login').reset();
            // Actualizar interfaz para usuario logueado
            actualizarInterfazUsuario(data.usuario);
        } else {
            mostrarAlerta(data.error || 'Error al iniciar sesión', 'error');
        }
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        mostrarAlerta('Error de conexión', 'error');
    }
}

// Procesar registro
async function procesarRegistro() {
    const nombre = document.getElementById('registro-nombre').value;
    const email = document.getElementById('registro-email').value;
    const password = document.getElementById('registro-password').value;
    
    try {
        const response = await fetch('/registro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nombre, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarAlerta('Usuario registrado correctamente');
            document.getElementById('form-registro').reset();
            // Cambiar a pestaña de login
            mostrarAuthTab('login-form');
        } else {
            mostrarAlerta(data.error || 'Error al registrarse', 'error');
        }
    } catch (error) {
        console.error('Error al registrarse:', error);
        mostrarAlerta('Error de conexión', 'error');
    }
}

// Actualizar interfaz para usuario logueado
function actualizarInterfazUsuario(usuario) {
    // Cambiar contenido de la pestaña de cuenta
    const loginSection = document.getElementById('login');
    loginSection.innerHTML = `
        <h2>👤 Mi Cuenta</h2>
        <div style="background: #e8f5e8; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h3>Bienvenido, ${usuario.nombre}</h3>
            <p><strong>Email:</strong> ${usuario.email}</p>
            <p><strong>Miembro desde:</strong> ${new Date(usuario.fecha_registro).toLocaleDateString()}</p>
        </div>
        <button class="btn btn-danger" onclick="cerrarSesion()" style="width: 100%; padding: 15px;">
            🚪 Cerrar Sesión
        </button>
    `;
}

// Cerrar sesión
async function cerrarSesion() {
    try {
        const response = await fetch('/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            mostrarAlerta('Sesión cerrada correctamente');
            location.reload(); // Recargar página
        }
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        mostrarAlerta('Error al cerrar sesión', 'error');
    }
}

// Función para manejar tabs de autenticación
function mostrarAuthTab(tabName) {
    // Ocultar todos los contenidos
    document.querySelectorAll('.auth-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Quitar clase active de todos los tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar contenido seleccionado
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}
