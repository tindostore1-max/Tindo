
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
});

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
        const response = await fetch('/admin/config');
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
        const response = await fetch('/admin/productos');
        productos = await response.json();
        mostrarProductos();
    } catch (error) {
        document.getElementById('productos-grid').innerHTML = '<p>Error al cargar productos</p>';
    }
}

// Mostrar productos en el catálogo
function mostrarProductos() {
    const grid = document.getElementById('productos-grid');
    grid.className = 'product-grid';
    
    if (productos.length === 0) {
        grid.innerHTML = '<p>No hay productos disponibles</p>';
        return;
    }
    
    let html = '';
    productos.forEach(producto => {
        html += `
            <div class="product-card" onclick="verDetalleProducto(${producto.id})">
                <img src="${producto.imagen || '/static/images/default-product.jpg'}" alt="${producto.nombre}" class="product-image">
                <div class="product-name">${producto.nombre}</div>
                <div class="product-description">${producto.descripcion || 'Sin descripción'}</div>
                <div class="package-list">
        `;
        
        if (producto.paquetes && producto.paquetes.length > 0) {
            producto.paquetes.slice(0, 3).forEach(paquete => {
                const precio = convertirPrecio(paquete.precio);
                html += `
                    <div class="package-item">
                        <span>${paquete.nombre}</span>
                        <span class="package-price">${precio}</span>
                    </div>
                `;
            });
        }
        
        html += `
                </div>
                <button class="btn btn-primary" style="width: 100%; margin-top: 15px;">
                    Ver detalles
                </button>
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
    
    let html = `
        <div style="margin-top: 20px;">
            <img src="${producto.imagen || '/static/images/default-product.jpg'}" alt="${producto.nombre}" style="width: 100%; max-width: 400px; height: 300px; object-fit: cover; border-radius: 15px; margin-bottom: 20px;">
            <h2>${producto.nombre}</h2>
            <p style="margin: 15px 0; color: #6c757d; font-size: 16px;">${producto.descripcion || 'Sin descripción disponible'}</p>
            <h3>📦 Paquetes Disponibles</h3>
            <div class="package-list" style="margin-top: 20px;">
    `;
    
    if (producto.paquetes && producto.paquetes.length > 0) {
        producto.paquetes.forEach(paquete => {
            const precio = convertirPrecio(paquete.precio);
            html += `
                <div class="package-item" style="margin-bottom: 15px; padding: 15px;">
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">${paquete.nombre}</div>
                        <div style="color: #28a745; font-weight: 700; font-size: 18px;">${precio}</div>
                    </div>
                    <button class="btn btn-success" onclick="agregarAlCarrito(${producto.id}, '${paquete.nombre}', ${paquete.precio})">
                        🛒 Agregar al carrito
                    </button>
                </div>
            `;
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
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;
    
    const item = {
        id: Date.now(), // ID único para el item del carrito
        productoId,
        productoNombre: producto.nombre,
        paqueteNombre,
        precio: precio,
        cantidad: 1
    };
    
    // Verificar si ya existe el mismo item
    const existeItem = carrito.find(item => 
        item.productoId === productoId && item.paqueteNombre === paqueteNombre
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
    const total = carrito.reduce((sum, item) => sum.precio * item.cantidad, 0);
    
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

// Procesar login (funcionalidad básica)
async function procesarLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    // Aquí puedes implementar la lógica de autenticación real
    mostrarAlerta('Función de login en desarrollo');
    document.getElementById('form-login').reset();
}

// Procesar registro (funcionalidad básica)
async function procesarRegistro() {
    const nombre = document.getElementById('registro-nombre').value;
    const email = document.getElementById('registro-email').value;
    const password = document.getElementById('registro-password').value;
    
    // Aquí puedes implementar la lógica de registro real
    mostrarAlerta('Función de registro en desarrollo');
    document.getElementById('form-registro').reset();
}
