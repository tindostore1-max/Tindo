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
    inicializarCarrusel();
});

// Funciones del carrusel
let slideIndex = 1;

function inicializarCarrusel() {
    // Cambiar slide automáticamente cada 5 segundos
    setInterval(function() {
        slideIndex++;
        if (slideIndex > 3) slideIndex = 1;
        currentSlide(slideIndex);
    }, 5000);
}

function currentSlide(n) {
    slideIndex = n;
    showSlide(slideIndex);
}

function showSlide(n) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');

    if (n > slides.length) slideIndex = 1;
    if (n < 1) slideIndex = slides.length;

    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    if (slides[slideIndex - 1]) {
        slides[slideIndex - 1].classList.add('active');
    }
    if (dots[slideIndex - 1]) {
        dots[slideIndex - 1].classList.add('active');
    }
}

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

    // Quitar clase active de todos los botones (mobile y desktop)
    const navBtns = document.querySelectorAll('.nav-btn');
    const desktopNavBtns = document.querySelectorAll('.desktop-nav-btn');

    navBtns.forEach(btn => {
        btn.classList.remove('active');
    });

    desktopNavBtns.forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar sección seleccionada
    const targetSection = document.getElementById(tabName);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Activar botón correspondiente en ambas navegaciones
    if (typeof event !== 'undefined' && event.target) {
        event.target.classList.add('active');
    }

    // Sincronizar botones por nombre de pestaña
    const allNavBtns = [...navBtns, ...desktopNavBtns];
    allNavBtns.forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes(tabName)) {
            btn.classList.add('active');
        }
    });

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
        const logoImg = document.getElementById('logo-img');
        if (logoImg) {
            if (configuracion.logo && configuracion.logo.trim() !== '') {
                logoImg.src = configuracion.logo;
                logoImg.onerror = function() {
                    this.src = 'https://via.placeholder.com/150x60/007bff/ffffff?text=INEFABLESTORE';
                };
            } else {
                logoImg.src = 'https://via.placeholder.com/150x60/007bff/ffffff?text=INEFABLESTORE';
            }
        }

        // Actualizar tasa de cambio
        if (configuracion.tasa_usd_ves) {
            tasaUSDVES = parseFloat(configuracion.tasa_usd_ves);
        }

        // Actualizar imágenes del carrusel
        actualizarImagenesCarrusel();
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

// Función para actualizar las imágenes del carrusel
function actualizarImagenesCarrusel() {
    const slides = document.querySelectorAll('.carousel-slide img');

    // Definir imágenes predeterminadas mejoradas
    const defaultImages = [
        'https://via.placeholder.com/800x300/007bff/ffffff?text=🎮+Ofertas+Especiales+Free+Fire',
        'https://via.placeholder.com/800x300/28a745/ffffff?text=🔥+Mejores+Precios+PUBG',
        'https://via.placeholder.com/800x300/dc3545/ffffff?text=⚡+Entrega+Inmediata+COD'
    ];

    function prepararUrlImagen(url) {
        if (!url || url.trim() === '') return null;

        // Si es una URL completa (http/https), usarla tal como está
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // Si es una ruta que empieza con 'images/', agregar '/static/'
        if (url.startsWith('images/')) {
            return `/static/${url}`;
        }

        // Si ya tiene '/static/', usarla tal como está
        if (url.startsWith('/static/')) {
            return url;
        }

        // Para cualquier otra ruta, asumir que necesita /static/
        return `/static/${url}`;
    }

    // Configurar imagen 1 del carrusel
    if (slides[0]) {
        const url1 = prepararUrlImagen(configuracion.carousel1);
        if (url1 && !defaultImages.includes(configuracion.carousel1)) {
            slides[0].src = url1;
            slides[0].onerror = function() {
                this.src = defaultImages[0];
            };
        } else {
            slides[0].src = defaultImages[0];
        }
    }

    // Configurar imagen 2 del carrusel
    if (slides[1]) {
        const url2 = prepararUrlImagen(configuracion.carousel2);
        if (url2 && !defaultImages.includes(configuracion.carousel2)) {
            slides[1].src = url2;
            slides[1].onerror = function() {
                this.src = defaultImages[1];
            };
        } else {
            slides[1].src = defaultImages[1];
        }
    }

    // Configurar imagen 3 del carrusel
    if (slides[2]) {
        const url3 = prepararUrlImagen(configuracion.carousel3);
        if (url3 && !defaultImages.includes(configuracion.carousel3)) {
            slides[2].src = url3;
            slides[2].onerror = function() {
                this.src = defaultImages[2];
            };
        } else {
            slides[2].src = defaultImages[2];
        }
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

        // Calcular precio mínimo y máximo
        let precioMinimo = 0;
        let precioMaximo = 0;
        if (producto.paquetes && Array.isArray(producto.paquetes) && producto.paquetes.length > 0) {
            const precios = producto.paquetes.map(p => parseFloat(p.precio) || 0);
            precioMinimo = Math.min(...precios);
            precioMaximo = Math.max(...precios);
        }

        // Mostrar rango de precios según la moneda
        let rangoPrecio = '';
        if (precioMinimo === precioMaximo) {
            // Si solo hay un precio
            if (monedaActual === 'VES') {
                rangoPrecio = `Bs. ${(precioMinimo * tasaUSDVES).toFixed(2)}`;
            } else {
                rangoPrecio = `$${precioMinimo.toFixed(2)}`;
            }
        } else {
            // Si hay rango de precios
            if (monedaActual === 'VES') {
                rangoPrecio = `Bs. ${(precioMinimo * tasaUSDVES).toFixed(2)} - Bs. ${(precioMaximo * tasaUSDVES).toFixed(2)}`;
            } else {
                rangoPrecio = `$${precioMinimo.toFixed(2)} - $${precioMaximo.toFixed(2)}`;
            }
        }

        html += `
            <div class="product-card" onclick="verDetalleProducto(${producto.id})">
                <img src="${imagenUrl}" alt="${producto.nombre || 'Producto'}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200/007bff/ffffff?text=Producto'">
                <div class="product-name">${producto.nombre || 'Producto sin nombre'}</div>
                <div class="product-description">${producto.descripcion || 'Sin descripción'}</div>
                <div class="price-desde">${rangoPrecio}</div>
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
            <div style="display: flex; gap: 30px; margin-bottom: 30px; align-items: flex-start;">
                <div style="flex: 0 0 400px;">
                    <img src="${imagenUrl}" alt="${producto.nombre || 'Producto'}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 15px;" onerror="this.src='https://via.placeholder.com/400x300/007bff/ffffff?text=Producto'">

                    <!-- Campo para ID de usuario debajo de la imagen -->
                    <div class="form-group" style="margin: 15px 0;">
                        <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block;">🎮 ID de Usuario en el Juego <span style="color: #dc3545;">*</span></label>
                        <input type="text" id="usuario-id-juego" class="form-control" placeholder="Escribe tu ID de usuario aquí..." required>
                        <small style="color: #6c757d; margin-top: 5px; display: block;">Este ID será usado para entregar los recursos a tu cuenta del juego</small>
                    </div>
                </div>
                <div style="flex: 1;">
                    <h2 style="margin: 0 0 15px 0; color: #ffffff !important; font-size: 28px;">${producto.nombre || 'Producto sin nombre'}</h2>
                    <p style="margin: 0; color: #6c757d; font-size: 16px; line-height: 1.6;">${producto.descripcion || 'Sin descripción disponible'}</p>
                </div>
            </div>
            <h3 style="color: #28a745;">Paquetes Disponibles</h3>
            <div class="package-list" style="margin-top: 20px;">
    `;

    if (producto.paquetes && Array.isArray(producto.paquetes) && producto.paquetes.length > 0) {
        producto.paquetes.forEach((paquete, index) => {
            try {
                const precio = convertirPrecio(parseFloat(paquete.precio) || 0);
                html += `
                    <div class="package-item package-selectable" data-package-id="${paquete.id}" data-package-name="${paquete.nombre}" data-package-price="${paquete.precio}" onclick="seleccionarPaquete(this)" style="margin-bottom: 15px; cursor: pointer; transition: all 0.3s ease; height: 120px; min-height: 120px; max-height: 120px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        <div class="package-info" style="text-align: center; width: 100%;">
                            <div class="package-name" style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                                <span class="package-radio">⚪</span>
                                ${paquete.nombre || 'Paquete'}
                            </div>
                            <div class="package-price">${precio}</div>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Error al procesar paquete en detalles:', error, paquete);
            }
        });

        // Agregar botón único de agregar al carrito
        html += `
            <div style="margin-top: 30px; text-align: center; padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 15px; border: 2px dashed #28a745;">
                <div id="paquete-seleccionado" style="margin-bottom: 15px; font-size: 16px; color: #6c757d; font-weight: 600;">
                    🎯 Selecciona un paquete arriba para continuar
                </div>
                <button id="btn-agregar-carrito" class="btn btn-success" onclick="agregarPaqueteSeleccionado()" disabled style="padding: 15px 35px; font-size: 18px; font-weight: 700; border-radius: 30px; background: linear-gradient(135deg, #28a745, #20c997); border: none; box-shadow: 0 6px 20px rgba(40, 167, 69, 0.3); transition: all 0.3s ease; opacity: 0.5;">
                    ✨ Agregar al Carrito
                </button>
            </div>
        `;
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

// Variables para el paquete seleccionado
let paqueteSeleccionado = null;

// Función para seleccionar un paquete
function seleccionarPaquete(elemento) {
    // Remover selección anterior
    document.querySelectorAll('.package-selectable').forEach(pkg => {
        pkg.classList.remove('selected');
        pkg.querySelector('.package-radio').textContent = '⚪';
        pkg.style.background = '';
        pkg.style.borderColor = '';
        pkg.style.transform = '';
    });

    // Seleccionar el paquete actual
    elemento.classList.add('selected');
    elemento.querySelector('.package-radio').textContent = '🟢';
    elemento.style.background = '#2a2a2a';
    elemento.style.borderColor = '#28a745';
    elemento.style.transform = 'translateY(-3px)';
    elemento.style.boxShadow = '0 8px 25px rgba(40, 167, 69, 0.3)';

    // Guardar información del paquete seleccionado
    paqueteSeleccionado = {
        id: elemento.getAttribute('data-package-id'),
        nombre: elemento.getAttribute('data-package-name'),
        precio: parseFloat(elemento.getAttribute('data-package-price'))
    };

    // Actualizar información del paquete seleccionado
    const infoDiv = document.getElementById('paquete-seleccionado');
    const botonAgregar = document.getElementById('btn-agregar-carrito');

    if (infoDiv && botonAgregar) {
        infoDiv.innerHTML = `
            <div style="color: #28a745; font-weight: 700; font-size: 18px;">
                🎮 Paquete seleccionado: <span style="color: #28a745;">${paqueteSeleccionado.nombre}</span>
            </div>
            <div style="color: #6c757d; font-size: 14px; margin-top: 5px;">
                Precio: ${convertirPrecio(paqueteSeleccionado.precio)}
            </div>
        `;

        botonAgregar.disabled = false;
        botonAgregar.style.opacity = '1';
        botonAgregar.style.cursor = 'pointer';
    }
}

// Función para agregar el paquete seleccionado al carrito
function agregarPaqueteSeleccionado() {
    if (!paqueteSeleccionado) {
        mostrarAlerta('⚠️ Por favor selecciona un paquete primero', 'error');
        return;
    }

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
        usuarioIdInput.style.borderColor = '#28a745';
        usuarioIdInput.style.boxShadow = 'inset 0 2px 8px rgba(40, 167, 69, 0.1)';

        // Quitar el estilo de error después de 3 segundos
        setTimeout(() => {
            usuarioIdInput.style.borderColor = '#28a745';
            usuarioIdInput.style.boxShadow = 'inset 0 2px 8px rgba(40, 167, 69, 0.1)';
        }, 3000);
        return;
    }

    const producto = productoSeleccionado;
    if (!producto) {
        mostrarAlerta('Error: Producto no encontrado', 'error');
        return;
    }

    const item = {
        id: Date.now(), // ID único para el item del carrito
        productoId: producto.id,
        productoNombre: producto.nombre,
        paqueteNombre: paqueteSeleccionado.nombre,
        precio: paqueteSeleccionado.precio,
        cantidad: 1,
        usuarioId: usuarioId, // Guardar el ID del usuario
        imagen: producto.imagen // Agregar imagen del producto
    };

    // Verificar si ya existe el mismo item con el mismo ID de usuario
    const existeItem = carrito.find(item => 
        item.productoId === producto.id && 
        item.paqueteNombre === paqueteSeleccionado.nombre && 
        item.usuarioId === usuarioId
    );

    if (existeItem) {
        existeItem.cantidad += 1;
        mostrarAlerta(`✨ Se aumentó la cantidad de ${paqueteSeleccionado.nombre} en tu carrito (${existeItem.cantidad} unidades)`, 'success');
    } else {
        carrito.push(item);
        mostrarAlerta(`🎉 ¡Perfecto! ${paqueteSeleccionado.nombre} se agregó exitosamente a tu carrito. ¡Continúa comprando o procede al pago! 🛒✨`, 'success');
    }

    actualizarContadorCarrito();

    // Efecto visual en el botón único
    const btnAgregar = document.getElementById('btn-agregar-carrito');
    if (btnAgregar) {
        const originalText = btnAgregar.innerHTML;
        const originalBackground = btnAgregar.style.background;

        btnAgregar.innerHTML = '✅ ¡Agregado al Carrito!';
        btnAgregar.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        btnAgregar.disabled = true;
        btnAgregar.style.opacity = '0.8';

        setTimeout(() => {
            btnAgregar.innerHTML = originalText;
            btnAgregar.style.background = originalBackground;
            btnAgregar.disabled = false;
            btnAgregar.style.opacity = '1';
        }, 2000);
    }
}

// Actualizar contador del carrito
function actualizarContadorCarrito() {
    const total = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('cart-count').textContent = total;

    // Actualizar también el contador desktop
    const desktopCounter = document.getElementById('cart-count-desktop');
    if (desktopCounter) {
        desktopCounter.textContent = total;
    }
}

// Mostrar carrito
function mostrarCarrito() {
    const carritoItems = document.getElementById('carrito-items');

    if (carrito.length === 0) {
        carritoItems.innerHTML = `
            <div class="cart-empty">
                <i>🛒</i>
                <h3>Tu carrito está vacío</h3>
                <p>Agrega algunos productos para comenzar</p>
            </div>
        `;
        document.getElementById('carrito-total').textContent = 'Total: $0.00';
        return;
    }

    let html = '<div class="cart-items-container">';
    let total = 0;

    carrito.forEach(item => {
        const subtotal = parseFloat(item.precio) * item.cantidad;
        total += subtotal;

        // Corregir ruta de imagen del item
        let imagenUrl = item.imagen || '';
        if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
            imagenUrl = `/static/${imagenUrl}`;
        }
        if (!imagenUrl) {
            imagenUrl = 'https://via.placeholder.com/80x80/007bff/ffffff?text=Juego';
        }

        html += `
            <div class="cart-item">
                <img src="${imagenUrl}" alt="${item.productoNombre}" class="cart-item-image" onerror="this.src='https://via.placeholder.com/80x80/007bff/ffffff?text=Juego'">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.productoNombre}</div>
                    <div class="cart-item-package">${item.paqueteNombre}</div>
                    <div class="cart-item-price">${convertirPrecio(item.precio)}</div>
                </div>
                <div class="cart-item-controls">
                    <div class="quantity-control">
                        <button onclick="cambiarCantidad(${item.id}, -1)" class="quantity-btn" title="Reducir cantidad">-</button>
                        <span class="quantity-display">${item.cantidad}</span>
                        <button onclick="cambiarCantidad(${item.id}, 1)" class="quantity-btn" title="Aumentar cantidad">+</button>
                    </div>
                    <button onclick="eliminarDelCarrito(${item.id})" class="remove-btn" title="Eliminar del carrito">🗑️</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    carritoItems.innerHTML = html;
    document.getElementById('carrito-total').textContent = `Total: ${convertirPrecio(total)}`;
}

// Cambiar cantidad de un item
function cambiarCantidad(itemId, cambio) {
    // Convertir itemId a número para comparar correctamente
    const numericItemId = parseInt(itemId);
    const item = carrito.find(i => parseInt(i.id) === numericItemId);

    if (!item) {
        console.log('Item no encontrado:', itemId, 'en carrito:', carrito);
        return;
    }

    item.cantidad += cambio;

    if (item.cantidad <= 0) {
        eliminarDelCarrito(itemId);
    } else {
        mostrarCarrito();
        actualizarContadorCarrito();

        // Mostrar mensaje de actualización
        if (cambio > 0) {
            mostrarAlerta(`✅ Cantidad aumentada a ${item.cantidad}`, 'success');
        } else {
            mostrarAlerta(`📉 Cantidad reducida a ${item.cantidad}`, 'success');
        }
    }
}

// Eliminar item del carrito
function eliminarDelCarrito(itemId) {
    // Convertir itemId a número para comparar correctamente
    const numericItemId = parseInt(itemId);
    const itemAEliminar = carrito.find(item => parseInt(item.id) === numericItemId);

    if (!itemAEliminar) {
        console.log('Item no encontrado para eliminar:', itemId);
        return;
    }

    carrito = carrito.filter(item => parseInt(item.id) !== numericItemId);
    mostrarCarrito();
    actualizarContadorCarrito();

    // Mostrar mensaje de confirmación
    mostrarAlerta(`🗑️ ${itemAEliminar.paqueteNombre} eliminado del carrito`, 'success');
}

// Proceder al pago
async function procederAlPago() {
    if (carrito.length === 0) {
        mostrarAlerta('Tu carrito está vacío', 'error');
        return;
    }

    // Verificar si el usuario está logueado antes de proceder al pago
    try {
        const response = await fetch('/usuario');
        if (!response.ok) {
            mostrarAlerta('Debes iniciar sesión para realizar una compra. Ve a la pestaña "Mi Cuenta" para entrar.', 'error');
            mostrarTab('login');
            return;
        }
        // Si está logueado, proceder al pago
        mostrarTab('pago');
    } catch (error) {
        mostrarAlerta('Debes iniciar sesión para realizar una compra', 'error');
        mostrarTab('login');
    }
}

// Preparar información de pago
function prepararPago() {
    // Cargar total del carrito
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    // Mostrar el total en la página de pago
    mostrarTotalPago(total);

        // Mostrar información según método seleccionado
    const metodoSelect = document.getElementById('metodo-pago');
    metodoSelect.addEventListener('change', function() {
        const infoPago = document.getElementById('info-pago');
        const metodo = this.value;
    // Mostrar información del método de pago
    if (metodo === 'Pago Móvil') {
        // Procesar datos de pago móvil
        const pagoMovilData = configuracion.pago_movil || 'Información no disponible';
        const lineasPagoMovil = pagoMovilData.split('\n');

        let banco = 'No especificado';
        let telefono = 'No especificado';
        let cedula = 'No especificado';
        let nombre = 'No especificado';

        // Extraer información de cada línea
        lineasPagoMovil.forEach(linea => {
            if (linea.includes('Banco:')) {
                banco = linea.replace('Banco:', '').trim();
            } else if (linea.includes('Telefono:')) {
                telefono = linea.replace('Telefono:', '').trim();
            } else if (linea.includes('Cédula:')) {
                cedula = linea.replace('Cédula:', '').trim();
            } else if (linea.includes('Nombre:')) {
                nombre = linea.replace('Nombre:', '').trim();
            }
        });

        infoPago.innerHTML = `
            <h4>📱 Datos para Pago Móvil:</h4>
            <p><strong>🏦 Banco:</strong> ${banco}</p>
            <p><strong>📞 Teléfono:</strong> ${telefono}</p>
            <p><strong>🆔 Cédula:</strong> ${cedula}</p>
            <p><strong>👤 Nombre:</strong> ${nombre}</p>
            <p style="margin-top: 15px; color: #20c997; font-weight: 600;">
                💡 Realiza el pago y coloca la referencia en el campo de abajo
            </p>
        `;
        infoPago.style.display = 'block';
    } else if (metodo === 'Binance') {
        // Procesar datos de Binance
        const binanceData = configuracion.binance || 'Información no disponible';
        const lineasBinance = binanceData.split('\n');

        let email = 'No especificado';
        let idBinance = 'No especificado';

        // Extraer información de cada línea
        lineasBinance.forEach(linea => {
            if (linea.includes('Email:')) {
                email = linea.replace('Email:', '').trim();
            } else if (linea.includes('ID Binance:')) {
                idBinance = linea.replace('ID Binance:', '').trim();
            }
        });

        infoPago.innerHTML = `
            <h4>🟡 Datos para Binance:</h4>
            <p><strong>📧 Email:</strong> ${email}</p>
            <p><strong>🆔 ID Binance:</strong> ${idBinance}</p>
            <p style="margin-top: 15px; color: #20c997; font-weight: 600;">
                💡 Realiza la transferencia y coloca el ID de transacción en el campo de abajo
            </p>
        `;
        infoPago.style.display = 'block';
    } else {
        infoPago.style.display = 'none';
    }
    });
}

// Función para seleccionar método de pago
function seleccionarMetodoPago(metodo) {
    // Remover selección anterior
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Seleccionar botón actual
    const btnId = metodo === 'Pago Móvil' ? 'btn-pago-movil' : 'btn-binance';
    document.getElementById(btnId).classList.add('selected');

    // Actualizar campo oculto
    document.getElementById('metodo-pago').value = metodo;

    // Mostrar información del método de pago
    const infoPago = document.getElementById('info-pago');

    if (metodo === 'Pago Móvil') {
        // Procesar datos de pago móvil
        const pagoMovilData = configuracion.pago_movil || 'Información no disponible';
        const lineasPagoMovil = pagoMovilData.split('\n');

        let banco = 'No especificado';
        let telefono = 'No especificado';
        let cedula = 'No especificado';
        let nombre = 'No especificado';

        // Extraer información de cada línea
        lineasPagoMovil.forEach(linea => {
            if (linea.includes('Banco:')) {
                banco = linea.replace('Banco:', '').trim();
            } else if (linea.includes('Telefono:')) {
                telefono = linea.replace('Telefono:', '').trim();
            } else if (linea.includes('Cédula:')) {
                cedula = linea.replace('Cédula:', '').trim();
            } else if (linea.includes('Nombre:')) {
                nombre = linea.replace('Nombre:', '').trim();
            }
        });

        infoPago.innerHTML = `
            <h4>📱 Datos para Pago Móvil:</h4>
            <p><strong>🏦 Banco:</strong> ${banco}</p>
            <p><strong>📞 Teléfono:</strong> ${telefono}</p>
            <p><strong>🆔 Cédula:</strong> ${cedula}</p>
            <p><strong>👤 Nombre:</strong> ${nombre}</p>
            <p style="margin-top: 15px; color: #20c997; font-weight: 600;">
                💡 Realiza el pago y coloca la referencia en el campo de abajo
            </p>
        `;
        infoPago.style.display = 'block';
    } else if (metodo === 'Binance') {
        // Procesar datos de Binance
        const binanceData = configuracion.binance || 'Información no disponible';
        const lineasBinance = binanceData.split('\n');

        let email = 'No especificado';
        let idBinance = 'No especificado';

        // Extraer información de cada línea
        lineasBinance.forEach(linea => {
            if (linea.includes('Email:')) {
                email = linea.replace('Email:', '').trim();
            } else if (linea.includes('ID Binance:')) {
                idBinance = linea.replace('ID Binance:', '').trim();
            }
        });

        infoPago.innerHTML = `
            <h4>🟡 Datos para Binance:</h4>
            <p><strong>📧 Email:</strong> ${email}</p>
            <p><strong>🆔 ID Binance:</strong> ${idBinance}</p>
            <p style="margin-top: 15px; color: #20c997; font-weight: 600;">
                💡 Realiza la transferencia y coloca el ID de transacción en el campo de abajo
            </p>
        `;
        infoPago.style.display = 'block';
    }
}

// Mostrar total del pago
function mostrarTotalPago(total) {
    const totalPagoElement = document.getElementById('total-pago');
    if (totalPagoElement) {
        totalPagoElement.textContent = `Total a pagar: ${convertirPrecio(total)}`;
    }
}

// Inicializar eventos
function inicializarEventos() {
    // Selector de moneda
    document.getElementById('selector-moneda').addEventListener('change', function() {
        monedaActual = this.value;
        mostrarProductos();
        mostrarCarrito();

        // Actualizar total en página de pago si está visible
        const pagoSection = document.getElementById('pago');
        if (pagoSection && pagoSection.classList.contains('active')) {
            const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
            mostrarTotalPago(total);
        }

        mostrarAlerta(`💱 Moneda cambiada a ${monedaActual}`, 'success');
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

    if (!email || !metodoPago || !referencia) {
        mostrarAlerta('Por favor completa todos los campos', 'error');
        return;
    }

    try {
        // Verificar si el usuario está logueado
        const sessionResponse = await fetch('/usuario');
        if (!sessionResponse.ok) {
            mostrarAlerta('Debes iniciar sesión para realizar una compra. Ve a la pestaña "Mi Cuenta" para entrar.', 'error');
            mostrarTab('login');
            return;
        }

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
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || `Error del servidor: ${response.status}`;

                if (response.status === 401) {
                    mostrarAlerta('Tu sesión ha expirado. Por favor inicia sesión nuevamente.', 'error');
                    mostrarTab('login');
                    return;
                }

                throw new Error(errorMessage);
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
        mostrarAlerta(`Error al procesar el pago: ${error.message || 'Error desconocido'}`, 'error');
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

// Procesarregistro
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
        <div class="auth-section">
            <h2 style="color: #ffffff; text-align: center; font-size: 28px; margin-bottom: 30px;">👤 Mi Cuenta</h2>

            <div class="user-profile-card">
                <h3>🌟 Bienvenido, ${usuario.nombre}</h3>
                <p><strong>Email:</strong> ${usuario.email}</p>
                <p><strong>Miembro desde:</strong> ${new Date(usuario.fecha_registro).toLocaleDateString()}</p>
            </div>

            <div class="account-actions">
                <button class="account-btn account-btn-primary" onclick="mostrarHistorialCompras()">
                    📋 Ver Historial de Compras
                </button>
                <button class="account-btn account-btn-danger" onclick="cerrarSesion()">
                    🚪 Cerrar Sesión
                </button>
            </div>

            <div id="historial-compras" class="purchase-history" style="display: none;">
                <h3>📋 Historial de Compras</h3>
                <div id="lista-compras">
                    <div class="loading">Cargando historial...</div>
                </div>
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