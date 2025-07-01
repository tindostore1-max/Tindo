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
    const sections = document.querySelectorAll('.tab-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Quitar clase active de todos los botones
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar sección seleccionada
    const targetSection = document.getElementById(tabName);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Activar botón correspondiente - verificar que event existe
    if (typeof event !== 'undefined' && event.target) {
        event.target.classList.add('active');
    } else {
        // Buscar el botón correspondiente por el texto o atributo
        const correspondingBtn = Array.from(navBtns).find(btn => 
            btn.onclick && btn.onclick.toString().includes(tabName)
        );
        if (correspondingBtn) {
            correspondingBtn.classList.add('active');
        }
    }

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
        
        if (!response.ok) {
            console.warn('No se pudo cargar la configuración del servidor');
            return;
        }
        
        configuracion = await response.json();

        // Actualizar logo si existe
        if (configuracion.logo) {
            const logoImg = document.getElementById('logo-img');
            if (logoImg) {
                logoImg.src = configuracion.logo;
            }
        }

        // Actualizar tasa de cambio
        if (configuracion.tasa_usd_ves) {
            tasaUSDVES = parseFloat(configuracion.tasa_usd_ves);
        }
    } catch (error) {
        console.warn('Error al cargar configuración:', error.message || 'Error desconocido');
        // Usar configuración por defecto
        configuracion = {
            tasa_usd_ves: '36.50',
            pago_movil: 'Información no disponible',
            binance: 'Información no disponible'
        };
        tasaUSDVES = 36.50;
    }
}

// Cargar productos del backend
async function cargarProductos() {
    const productosGrid = document.getElementById('productos-grid');
    
    try {
        const response = await fetch('/productos');
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        productos = await response.json();
        console.log('Productos cargados:', productos);
        mostrarProductos();
    } catch (error) {
        console.error('Error al cargar productos:', error.message || 'Error desconocido');
        if (productosGrid) {
            productosGrid.innerHTML = `
                <div class="no-products">
                    <h3>Error al cargar productos</h3>
                    <p>No se pudieron cargar los productos. Verifica la conexión e intenta recargar la página.</p>
                    <button class="btn btn-primary" onclick="cargarProductos()">🔄 Reintentar</button>
                </div>
            `;
        }
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
            <div class="product-card" onclick="verDetalleProducto(${producto.id})">
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
                    <div class="package-item" style="margin-bottom: 20px;">
                        <div class="package-info">
                            <div class="package-name">${paquete.nombre || 'Paquete'}</div>
                            <div class="package-price">${precio}</div>
                        </div>
                        <button class="btn btn-success" onclick="agregarAlCarrito(${producto.id}, '${nombrePaquete}', ${parseFloat(paquete.precio) || 0})" style="padding: 12px 25px; font-size: 16px; font-weight: 600; border-radius: 25px; background: linear-gradient(135deg, #28a745, #20c997); border: none; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3); transition: all 0.3s ease;">
                            ✨ Agregar al carrito
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
    const usuarioIdInput = document.getElementById('usuario-id-juego');
    if (!usuarioIdInput) {
        mostrarAlerta('Error: No se encontró el campo de ID de usuario', 'error');
        return;
    }

    const usuarioId = usuarioIdInput.value.trim();
    if (!usuarioId) {
        mostrarAlerta('⚠️ Por favor ingresa tu ID de usuario del juego antes de agregar al carrito', 'error');
        usuarioIdInput.focus();
        usuarioIdInput.style.borderColor = '#dc3545';
        usuarioIdInput.style.boxShadow = '0 0 15px rgba(220, 53, 69, 0.3)';
        
        // Quitar el estilo de error después de 3 segundos
        setTimeout(() => {
            usuarioIdInput.style.borderColor = '#2196f3';
            usuarioIdInput.style.boxShadow = 'inset 0 2px 8px rgba(33, 150, 243, 0.1)';
        }, 3000);
        return;
    }

    const producto = productos.find(p => p.id === productoId);
    if (!producto) {
        mostrarAlerta('Error: Producto no encontrado', 'error');
        return;
    }

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
        mostrarAlerta(`✨ Se aumentó la cantidad de ${paqueteNombre} en tu carrito (${existeItem.cantidad} unidades)`, 'success');
    } else {
        carrito.push(item);
        mostrarAlerta(`🎉 ¡Perfecto! ${paqueteNombre} se agregó exitosamente a tu carrito. ¡Continúa comprando o procede al pago! 🛒✨`, 'success');
    }

    actualizarContadorCarrito();
    
    // Efecto visual en el botón
    const btn = event.target;
    if (btn) {
        btn.innerHTML = '✅ ¡Agregado!';
        btn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        setTimeout(() => {
            btn.innerHTML = '✨ Agregar al carrito';
            btn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        }, 2000);
    }
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
    const emailElement = document.getElementById('login-email');
    const passwordElement = document.getElementById('login-password');
    
    if (!emailElement || !passwordElement) {
        mostrarAlerta('Error en el formulario de login', 'error');
        return;
    }

    const email = emailElement.value;
    const password = passwordElement.value;

    if (!email || !password) {
        mostrarAlerta('Por favor completa todos los campos', 'error');
        return;
    }

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
            const formElement = document.getElementById('form-login');
            if (formElement) {
                formElement.reset();
            }
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
    const nombreElement = document.getElementById('registro-nombre');
    const emailElement = document.getElementById('registro-email');
    const passwordElement = document.getElementById('registro-password');
    
    if (!nombreElement || !emailElement || !passwordElement) {
        mostrarAlerta('Error en el formulario de registro', 'error');
        return;
    }

    const nombre = nombreElement.value;
    const email = emailElement.value;
    const password = passwordElement.value;

    if (!nombre || !email || !password) {
        mostrarAlerta('Por favor completa todos los campos', 'error');
        return;
    }

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
            const formElement = document.getElementById('form-registro');
            if (formElement) {
                formElement.reset();
            }
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
        
        <div style="margin-bottom: 20px;">
            <button class="btn btn-primary" onclick="mostrarHistorialCompras()" style="width: 100%; padding: 15px; margin-bottom: 10px;">
                📋 Ver Historial de Compras
            </button>
            <button class="btn btn-danger" onclick="cerrarSesion()" style="width: 100%; padding: 15px;">
                🚪 Cerrar Sesión
            </button>
        </div>
        
        <div id="historial-compras" style="display: none;">
            <h3>📋 Historial de Compras</h3>
            <div id="lista-compras">
                <div class="loading">Cargando historial...</div>
            </div>
        </div>
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

// Mostrar historial de compras
async function mostrarHistorialCompras() {
    const historialDiv = document.getElementById('historial-compras');
    const listaCompras = document.getElementById('lista-compras');
    
    if (!historialDiv) return;
    
    // Mostrar el contenedor del historial
    historialDiv.style.display = 'block';
    listaCompras.innerHTML = '<div class="loading">Cargando historial...</div>';

    try {
        const response = await fetch('/usuario/historial');
        
        if (!response.ok) {
            throw new Error('Error al cargar historial');
        }

        const historial = await response.json();
        
        if (historial.length === 0) {
            listaCompras.innerHTML = `
                <div class="no-purchases">
                    <i>🛒</i>
                    <h3>No tienes compras aún</h3>
                    <p>Cuando realices tu primera compra, aparecerá aquí.</p>
                </div>
            `;
            return;
        }

        let html = '';
        historial.forEach(compra => {
            const fecha = new Date(compra.fecha).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let imagenUrl = compra.juego_imagen || '';
            if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
                imagenUrl = `/static/${imagenUrl}`;
            }
            if (!imagenUrl) {
                imagenUrl = 'https://via.placeholder.com/60x60/007bff/ffffff?text=Juego';
            }

            html += `
                <div class="purchase-card">
                    <div class="purchase-header">
                        <img src="${imagenUrl}" alt="${compra.juego_nombre || 'Juego'}" class="purchase-game-image" onerror="this.src='https://via.placeholder.com/60x60/007bff/ffffff?text=Juego'">
                        <div class="purchase-info">
                            <h4>${compra.juego_nombre || 'Juego'}</h4>
                            <p class="purchase-package">${compra.paquete}</p>
                            <p class="purchase-date">${fecha}</p>
                        </div>
                    </div>
                    <div class="purchase-details">
                        <span class="purchase-amount">$${parseFloat(compra.monto).toFixed(2)}</span>
                        <span class="purchase-status ${compra.estado}">${compra.estado.toUpperCase()}</span>
                    </div>
                    <div class="purchase-payment">
                        <small><strong>Método:</strong> ${compra.metodo_pago}</small>
                        <small><strong>Referencia:</strong> ${compra.referencia_pago}</small>
                    </div>
                    ${compra.usuario_id ? `<div style="margin-top: 10px;"><small><strong>ID Usuario:</strong> ${compra.usuario_id}</small></div>` : ''}
                </div>
            `;
        });

        listaCompras.innerHTML = html;

    } catch (error) {
        console.error('Error al cargar historial:', error);
        listaCompras.innerHTML = '<p style="color: #dc3545;">Error al cargar el historial de compras</p>';
    }
}

// Función para manejar tabs de autenticación
function mostrarAuthTab(tabName) {
    // Verificar que los elementos existen antes de manipularlos
    const authContents = document.querySelectorAll('.auth-content');
    const authTabs = document.querySelectorAll('.auth-tab');
    const targetContent = document.getElementById(tabName);
    
    if (!authContents.length || !authTabs.length || !targetContent) {
        console.error('Elementos de autenticación no encontrados');
        return;
    }

    // Ocultar todos los contenidos
    authContents.forEach(content => {
        content.classList.remove('active');
    });

    // Quitar clase active de todos los tabs
    authTabs.forEach(tab => {
        tab.classList.remove('active');
    });

    // Mostrar contenido seleccionado
    targetContent.classList.add('active');
    
    // Verificar que event y event.target existen
    if (typeof event !== 'undefined' && event.target) {
        event.target.classList.add('active');
    }
}