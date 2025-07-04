// Variables globales
let productos = [];
let carrito = [];
let monedaActual = 'USD';
let tasaUSDVES = 36.50;
let configuracion = {};
let productoSeleccionado = null;

// Variables globales para los carruseles
let gamesCarouselIndex = 0;
let gamesCarouselItems = [];
let giftCardsCarouselIndex = 0;
let giftCardsCarouselItems = [];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, iniciando aplicación...');

    cargarConfiguracion();
    cargarProductos();
    inicializarEventos();
    verificarSesion();
    inicializarCarrusel();

    // Manejar la ruta actual del navegador después de un pequeño delay
    setTimeout(() => {
        manejarRutaActual();

        // Activar automáticamente la pestaña de Todos al cargar
        filtrarProductos('todos');
    }, 200);
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

// Función para manejar la ruta actual del navegador
function manejarRutaActual() {
    const path = window.location.pathname;
    const hash = window.location.hash.replace('#', '');

    console.log('Manejando ruta actual:', { path, hash });

    // Mapear rutas a pestañas
    const rutasPestanas = {
        '/': 'catalogo',
        '/catalogo': 'catalogo',
        '/carrito': 'carrito',
        '/pago': 'pago',
        '/login': 'login',
        '/cuenta': 'login',
        '/admin': 'admin'
    };

    // Determinar qué pestaña mostrar
    let pestanaActiva = 'catalogo'; // Por defecto
    let productoId = null;

    // Verificar si es un hash de detalles con ID de producto
    if (hash && hash.startsWith('detalles-')) {
        const id = hash.replace('detalles-', '');
        if (id && !isNaN(id)) {
            pestanaActiva = 'detalles';
            productoId = parseInt(id);
        }
    }
    // Si hay hash válido, usarlo como pestaña
    else if (hash && ['catalogo', 'carrito', 'pago', 'login', 'detalles'].includes(hash)) {
        pestanaActiva = hash;
    } else if (rutasPestanas[path]) {
        pestanaActiva = rutasPestanas[path];
    }

    console.log('Pestaña activa determinada:', pestanaActiva, 'Producto ID:', productoId);

    // Si es detalles con ID de producto, cargar el producto
    if (pestanaActiva === 'detalles' && productoId) {
        // Esperar a que los productos se carguen
        const cargarProductoDesdeURL = () => {
            if (productos.length === 0) {
                // Si aún no se han cargado los productos, esperar un poco más
                setTimeout(cargarProductoDesdeURL, 100);
                return;
            }

            const producto = productos.find(p => p.id === productoId);
            if (producto) {
                console.log('Producto encontrado en URL:', producto.nombre);
                // Cargar el producto directamente sin llamar a verDetalleProducto
                // para evitar recursión
                productoSeleccionado = producto;
                mostrarDetalleProductoDesdeURL(producto);
            } else {
                console.log('Producto no encontrado, redirigiendo al catálogo');
                mostrarTab('catalogo');
            }
        };

        cargarProductoDesdeURL();
        return;
    }

    // Verificar que la pestaña existe antes de mostrarla
    const elementoPestana = document.getElementById(pestanaActiva);
    if (elementoPestana) {
        // Si es la pestaña de detalles pero no hay producto seleccionado, ir al catálogo
        if (pestanaActiva === 'detalles' && !productoSeleccionado) {
            console.log('Redirigiendo a catálogo porque no hay producto seleccionado');
            mostrarTab('catalogo');
            return;
        }
        mostrarTab(pestanaActiva);
    } else {
        console.warn('Pestaña no encontrada:', pestanaActiva);
        // Fallback a catálogo si la pestaña no existe
        mostrarTab('catalogo');
    }
}

// Función para actualizar la URL sin recargar
function actualizarURL(tabName) {
    if (tabName === 'catalogo') {
        window.history.replaceState({}, '', '/');
    } else if (tabName === 'detalles' && productoSeleccionado) {
        window.history.replaceState({}, '', `#detalles-${productoSeleccionado.id}`);
    } else {
        window.history.replaceState({}, '', `#${tabName}`);
    }
}

// Manejar el botón atrás del navegador
window.addEventListener('popstate', function(event) {
    manejarRutaActual();
});

// Funciones de navegación
function mostrarTab(tabName, element) {
    console.log('Mostrando tab:', tabName);

    // Verificar que la pestaña existe
    const targetSection = document.getElementById(tabName);
    if (!targetSection) {
        console.error('Pestaña no encontrada:', tabName);
        return;
    }

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
    targetSection.classList.add('active');

    // Activar botón correspondiente si se proporciona
    if (element) {
        element.classList.add('active');
    }

    // Sincronizar botones por nombre de pestaña
    const allNavBtns = [...navBtns, ...desktopNavBtns];
    allNavBtns.forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes(tabName)) {
            btn.classList.add('active');
        }
    });

    // Activar botones específicos según la pestaña
    if (tabName === 'catalogo') {
        document.querySelectorAll('.nav-btn[onclick*="catalogo"], .desktop-nav-btn[onclick*="catalogo"]').forEach(btn => {
            btn.classList.add('active');
        });
    } else if (tabName === 'carrito') {
        document.querySelectorAll('.nav-btn[onclick*="carrito"], .desktop-nav-btn[onclick*="carrito"]').forEach(btn => {
            btn.classList.add('active');
        });
    } else if (tabName === 'login') {
        document.querySelectorAll('.nav-btn[onclick*="login"], .desktop-nav-btn[onclick*="login"]').forEach(btn => {
            btn.classList.add('active');
        });
    }

    // Actualizar URL del navegador
    actualizarURL(tabName);

    // Cargar datos específicos según la pestaña
    if (tabName === 'carrito') {
        mostrarCarrito();
    } else if (tabName === 'pago') {
        prepararPago();
    } else if (tabName === 'detalles') {
        // Si estamos en detalles pero no hay producto seleccionado, ir al catálogo
        if (!productoSeleccionado) {
            console.log('No hay producto seleccionado, redirigiendo al catálogo');
            setTimeout(() => {
                mostrarTab('catalogo');
            }, 100);
            return;
        }
    }

    console.log('Tab mostrada exitosamente:', tabName);
}

// Función para mostrar alertas
function mostrarAlerta(mensaje, tipo = 'success') {
    // En dispositivos móviles, usar notificación flotante
    if (window.innerWidth <= 768) {
        mostrarNotificacionFlotante(mensaje, tipo);
        return;
    }

    // En desktop, usar alerta normal
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo}`;
    alertDiv.textContent = mensaje;

    const contenido = document.querySelector('.content');
    contenido.insertBefore(alertDiv, contenido.firstChild);

    setTimeout(() => {
        alertDiv.remove();
    }, 4000);
}

// Función para mostrar notificación flotante en móviles
function mostrarNotificacionFlotante(mensaje, tipo = 'success') {
    // Remover notificación anterior si existe
    const existingNotification = document.querySelector('.mobile-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Crear nueva notificación
    const notification = document.createElement('div');
    notification.className = `mobile-notification ${tipo}`;

    // Seleccionar icono según el tipo
    let icon = '✓';
    if (tipo === 'error') {
        icon = '✕';
    } else if (tipo === 'success') {
        icon = '✓';
    }

    // Limpiar mensaje para que sea más conciso
    let mensajeLimpio = mensaje;
    if (mensaje.includes('🎉') || mensaje.includes('✨') || mensaje.includes('🛒')) {
        // Simplificar mensajes largos
        if (mensaje.includes('se agregó exitosamente')) {
            mensajeLimpio = 'Producto agregado al carrito';
        } else if (mensaje.includes('cantidad aumentada')) {
            mensajeLimpio = 'Cantidad actualizada';
        } else if (mensaje.includes('eliminado del carrito')) {
            mensajeLimpio = 'Producto eliminado';
        } else {
            // Remover emojis y simplificar
            mensajeLimpio = mensaje.replace(/[🎉✨🛒⚠️✅📉🗑️💱]/g, '').trim();
        }
    }

    notification.innerHTML = `
        <span class="mobile-notification-icon">${icon}</span>
        <span class="mobile-notification-text">${mensajeLimpio}</span>
    `;

    // Agregar al DOM
    document.body.appendChild(notification);

    // Mostrar con animación
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Ocultar después de 2.5 segundos
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 400);
    }, 2500);

    // Permitir cerrar tocando la notificación
    notification.addEventListener('click', () => {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 400);
    });
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

// Variable para almacenar el filtro actual
let filtroActual = 'todos';

// Función para filtrar productos por categoría
function filtrarProductos(categoria, element) {
    filtroActual = categoria;

    // Actualizar pestañas activas
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Activar pestaña seleccionada
    if (element) {
        element.classList.add('active');
    }

    // Mostrar productos filtrados
    mostrarProductos();
}

// Mostrar productos en el catálogo
function mostrarProductos() {
    const grid = document.getElementById('productos-grid');
    grid.className = 'product-grid';

    if (!productos || productos.length === 0) {
        grid.innerHTML = '<p>No hay productos disponibles</p>';
        return;
    }

    // Si es la categoría "todos", mostrar carrusel horizontal de juegos
    if (!filtroActual || filtroActual === 'todos') {
        const juegos = productos.filter(producto => producto.categoria === 'juegos');
        
        if (juegos.length === 0) {
            grid.innerHTML = `
                <div class="no-products" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #cccccc;">
                    <h3>🎮 No hay juegos disponibles</h3>
                    <p>Próximamente agregaremos más juegos para ti</p>
                </div>
            `;
            return;
        }

        // Cambiar clase del contenedor para el carrusel
        grid.className = 'todos-carousel-container';
        
        // Generar carrusel horizontal de juegos
        let cardsHtml = '';
        juegos.forEach(juego => {
            // Corregir ruta de imagen
            let imagenUrl = juego.imagen || '';
            if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
                imagenUrl = `/static/${imagenUrl}`;
            }
            if (!imagenUrl) {
                imagenUrl = 'https://via.placeholder.com/300x200/007bff/ffffff?text=Producto';
            }

            // Calcular precio mínimo y máximo
            let precioMinimo = 0;
            let precioMaximo = 0;
            if (juego.paquetes && Array.isArray(juego.paquetes) && juego.paquetes.length > 0) {
                const precios = juego.paquetes.map(p => parseFloat(p.precio) || 0);
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

            cardsHtml += `
                <div class="todos-carousel-card" onclick="verDetalleProducto(${juego.id})">
                    <img src="${imagenUrl}" alt="${juego.nombre || 'Producto'}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200/007bff/ffffff?text=Producto'">
                    <div class="product-name">${juego.nombre || 'Producto sin nombre'}</div>
                    <div class="price-desde">${rangoPrecio}</div>
                </div>
            `;
        });

        grid.innerHTML = `
            <div class="section-header">
                <h3 class="section-title">🎮 Recarga de juegos</h3>
            </div>
            <div class="todos-carousel-wrapper">
                <div class="todos-carousel-track" id="todos-carousel-track">
                    ${cardsHtml}
                </div>
                ${juegos.length > 3 ? `
                    <button class="todos-carousel-nav prev" onclick="moverCarruselTodos(-1)">‹</button>
                    <button class="todos-carousel-nav next" onclick="moverCarruselTodos(1)">›</button>
                ` : ''}
            </div>
        `;
        
        // Inicializar índice del carrusel
        window.todosCarouselIndex = 0;
        window.todosCarouselItems = juegos;
        
        return;
    }

    // Filtrar productos según la categoría seleccionada
    let productosFiltrados = productos;
    if (filtroActual === 'gift-cards') {
        productosFiltrados = productos.filter(producto => 
            producto.categoria === 'gift-cards'
        );
    } else if (filtroActual === 'juegos') {
        productosFiltrados = productos.filter(producto => 
            producto.categoria === 'juegos'
        );
    }

    if (productosFiltrados.length === 0) {
        grid.innerHTML = `
            <div class="no-products" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #cccccc;">
                <h3>🎁 No hay Gift Cards disponibles</h3>
                <p>Próximamente agregaremos más Gift Cards para ti</p>
            </div>
        `;
        return;
    }

    let html = '';
    productosFiltrados.forEach(producto => {
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

// Función para mostrar detalles del producto desde la URL (sin redirección)
function mostrarDetalleProductoDesdeURL(producto) {
    // Generar el mismo HTML que verDetalleProducto pero sin cambiar la pestaña
    const detalleHTML = generarHTMLDetalleProducto(producto);
    document.getElementById('producto-detalle').innerHTML = detalleHTML;

    // Mostrar la pestaña de detalles
    mostrarTab('detalles');
}

// Función para generar HTML de detalles de producto (reutilizable)
function generarHTMLDetalleProducto(producto) {
    // Corregir ruta de imagen
    let imagenUrl = producto.imagen || '';
    if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
        imagenUrl = `/static/${imagenUrl}`;
    }
    if (!imagenUrl) {
        imagenUrl = 'https://via.placeholder.com/400x300/007bff/ffffff?text=Producto';
    }

    // Determinar si mostrar el formulario de ID según la categoría
    const mostrarFormularioId = producto.categoria !== 'gift-cards';

    // Generar HTML para los paquetes
    let paquetesHtml = '';
    if (producto.paquetes && Array.isArray(producto.paquetes) && producto.paquetes.length > 0) {
        paquetesHtml = producto.paquetes.map(paquete => {
            const precio = parseFloat(paquete.precio) || 0;
            return `
                <div class="package-item package-selectable" onclick="seleccionarPaquete(this)" 
                     data-package-id="${paquete.id}" 
                     data-package-name="${paquete.nombre}" 
                     data-package-price="${precio}">
                    <div class="package-info">
                        <div class="package-name">
                            <span class="package-radio">⚪</span>
                            ${paquete.nombre}
                        </div>
                        <div class="package-price">${convertirPrecio(precio)}</div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        paquetesHtml = '<p style="color: #cccccc; text-align: center; grid-column: 1 / -1;">No hay paquetes disponibles para este producto</p>';
    }

    return `
        <div style="margin-top: 15px;">
            <div class="details-container" style="display: flex; gap: 20px; margin-bottom: 20px; align-items: flex-start;">
                <div class="details-image-container" style="flex: 0 0 400px;">
                    <img src="${imagenUrl}" alt="${producto.nombre || 'Producto'}" class="selected-product-image" style="width: 100%; height: 300px; object-fit: cover; border-radius: 12px;" onerror="this.src='https://via.placeholder.com/400x300/007bff/ffffff?text=Producto'">

                    <!-- Título del juego debajo de la imagen -->
                    <h1 style="color: #ffffff; font-size: 28px; margin: 15px 0 12px 0; font-weight: 700; text-align: center;">${producto.nombre || 'Producto'}</h1>

                    ${mostrarFormularioId ? `
                    <!-- Campo para ID de usuario debajo del título -->
                    <div style="margin-top: 15px;">
                        <label for="usuario-id-juego" style="display: block; margin-bottom: 6px; font-weight: 600; color: #ffffff; font-size: 14px;">ID de Usuario en el Juego:</label>
                        <input type="text" id="usuario-id-juego" class="form-control" placeholder="Ingresa tu ID de usuario" style="width: 100%; padding: 12px 15px; border: 2px solid rgba(255,255,255,0.1); border-radius: 10px; font-size: 14px; background: rgba(255,255,255,0.05); color: #ffffff; transition: all 0.3s ease; backdrop-filter: blur(10px);" required>
                    </div>
                    ` : ''}

                    </div>

                <div class="details-info-container" style="flex: 1;">

                    <div class="package-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">
                        ${paquetesHtml}
                    </div>

                    <!-- Información del paquete seleccionado -->
                    <div id="paquete-seleccionado" style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); display: none;">
                        <!-- Se llenará dinámicamente -->
                    </div>

                    <div style="margin-top: 20px; display: flex; gap: 12px;">
                        <button id="btn-agregar-carrito" onclick="agregarPaqueteSeleccionado()" class="btn btn-success" style="flex: 1; padding: 15px 20px; font-size: 16px; font-weight: 700; background: linear-gradient(135deg, #28a745, #20c997); border: none; border-radius: 10px; color: white; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(40, 167, 69, 0.3); opacity: 0.6;" disabled>
                            🛒 Agregar al Carrito
                        </button>
                        <button onclick="mostrarTab('catalogo')" class="btn btn-secondary" style="padding: 15px 20px; font-size: 14px; font-weight: 600; background: #6c757d; border: none; border-radius: 10px; color: white; cursor: pointer; transition: all 0.3s ease;">
                            ← Volver
                        </button>
                    </div>

                    <!-- Descripción del producto después del botón agregar al carrito - solo visible en móvil -->
                    <div style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); display: block;">
                        <p style="color: #cccccc; font-size: 16px; line-height: 1.5; margin: 0; white-space: pre-wrap; word-wrap: break-word;">${producto.descripcion || 'Descripción del producto'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Ver detalles de un producto
function verDetalleProducto(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    productoSeleccionado = producto;

    // Usar la función reutilizable para generar el HTML
    const html = generarHTMLDetalleProducto(producto);
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
        infoDiv.style.display = 'block';

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

    // Verificar que se haya ingresado el ID de usuario solo si no es gift card
    let usuarioId = '';
    if (productoSeleccionado.categoria !== 'gift-cards') {
        const usuarioIdInput = document.getElementById('usuario-id-juego');
        if (!usuarioIdInput) {
            mostrarAlerta('Error: No se encontró el campo de ID de usuario', 'error');
            return;
        }

        usuarioId = usuarioIdInput.value.trim();
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
    } else {
        // Para gift cards, usar un valor por defecto o el email del usuario
        usuarioId = 'gift-card';
    }

    const producto = productoSeleccionado;
    if (!producto){
        mostrarAlerta('Error:Producto no encontrado', 'error');
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
                <div class="cart-item-header">
                    <img src="${imagenUrl}" alt="${item.productoNombre}" class="cart-item-image" onerror="this.src='https://via.placeholder.com/80x80/007bff/ffffff?text=Juego'">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.productoNombre}</div>
                        <div class="cart-item-package">${item.paqueteNombre}</div>
                        <div class="cart-item-price">${convertirPrecio(item.precio)}</div>
                    </div>
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

    // Actualizar métodos de pago según la moneda
    actualizarMetodosPagoSegunMoneda();

    // Auto-rellenar email del usuario logueado
    if (window.session && window.session.user_email) {
        const emailInput = document.getElementById('pago-email');
        if (emailInput) {
            emailInput.value = window.session.user_email;
            emailInput.readOnly = true; // Hacer el campo de solo lectura
            emailInput.style.backgroundColor = 'rgba(255,255,255,0.1)';
            emailInput.style.cursor = 'not-allowed';
        }
    }
}

// Función para actualizar métodos de pago según la moneda seleccionada
function actualizarMetodosPagoSegunMoneda() {
    const btnPagoMovil = document.getElementById('btn-pago-movil');
    const btnBinance = document.getElementById('btn-binance');
    const infoPago = document.getElementById('info-pago');
    const metodoPagoInput = document.getElementById('metodo-pago');

    // Limpiar selección anterior
    if (btnPagoMovil) btnPagoMovil.classList.remove('selected');
    if (btnBinance) btnBinance.classList.remove('selected');
    if (infoPago) infoPago.style.display = 'none';
    if (metodoPagoInput) metodoPagoInput.value = '';

    if (monedaActual === 'VES') {
        // Mostrar solo Pago Móvil para VES
        if (btnPagoMovil) {
            btnPagoMovil.style.display = 'flex';
            btnPagoMovil.style.gridColumn = '1 / -1'; // Ocupar todo el ancho
        }
        if (btnBinance) {
            btnBinance.style.display = 'none';
        }
    } else if (monedaActual === 'USD') {
        // Mostrar solo Binance para USD
        if (btnBinance) {
            btnBinance.style.display = 'flex';
            btnBinance.style.gridColumn = '1 / -1'; // Ocupar todo el ancho
        }
        if (btnPagoMovil) {
            btnPagoMovil.style.display = 'none';
        }
    }
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

// Actualizar precios en la página de detalles cuando cambia la moneda
function actualizarPreciosDetalles() {
    if (!productoSeleccionado) return;

    // Actualizar precios de los paquetes
    const packageItems = document.querySelectorAll('.package-item');
    packageItems.forEach((item, index) => {
        if (productoSeleccionado.paquetes && productoSeleccionado.paquetes[index]) {
            const paquete = productoSeleccionado.paquetes[index];
            const priceElement = item.querySelector('.package-price');
            if (priceElement) {
                priceElement.textContent = convertirPrecio(parseFloat(paquete.precio) || 0);
            }
        }
    });

    // Actualizar información del paquete seleccionado si hay uno
    if (paqueteSeleccionado) {
        const infoDiv = document.getElementById('paquete-seleccionado');
        if (infoDiv && infoDiv.innerHTML.includes('Paquete seleccionado:')) {
            infoDiv.innerHTML = `
                <div style="color: #28a745; font-weight: 700; font-size: 18px;">
                    🎮 Paquete seleccionado: <span style="color: #28a745;">${paqueteSeleccionado.nombre}</span>
                </div>
                <div style="color: #6c757d; font-size: 14px; margin-top: 5px;">
                    Precio: ${convertirPrecio(paqueteSeleccionado.precio)}
                </div>
            `;
        }
    }
}

// Inicializar eventos
function inicializarEventos() {
    // Selector de moneda
    document.getElementById('selector-moneda').addEventListener('change', function() {
        monedaActual = this.value;
        mostrarProductos();
        mostrarCarrito();

        // Actualizar precios en página de detalles si está visible
        const detallesSection = document.getElementById('detalles');
        if (detallesSection && detallesSection.classList.contains('active') && productoSeleccionado) {
            actualizarPreciosDetalles();
        }

        // Actualizar total en página de pago si está visible
        const pagoSection = document.getElementById('pago');
        if (pagoSection && pagoSection.classList.contains('active')) {
            const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
            mostrarTotalPago(total);
            // Actualizar métodos de pago según la nueva moneda
            actualizarMetodosPagoSegunMoneda();
        }

        mostrarAlerta(`💱 Moneda cambiada a ${monedaActual}`, 'success');
    });

    // Event listener para el checkbox de términos y condiciones
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'terminos-checkbox') {
            const submitBtn = document.getElementById('submit-payment-btn');
            if (submitBtn) {
                submitBtn.disabled = !e.target.checked;
            }
        }
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
    const mensajePago = document.getElementById('mensaje-pago');
    const submitBtn = document.querySelector('.submit-payment-btn');

    // Limpiar mensaje anterior
    if (mensajePago) {
        mensajePago.style.display = 'none';
        mensajePago.className = 'payment-message';
    }

    if (carrito.length === 0) {
        mostrarMensajePago('Tu carrito está vacío', 'error');
        return;
    }

    if (!email || !metodoPago || !referencia) {
        mostrarMensajePago('Por favor completa todos los campos', 'error');
        return;
    }

    try {
        // Mostrar mensaje de carga
        mostrarMensajePago('⏳ Procesando tu pago, por favor espera...', 'loading');

        // Deshabilitar botón mientras procesa
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
        }

        // Verificar si el usuario está logueado
        const sessionResponse = await fetch('/usuario');
        if (!sessionResponse.ok) {
            mostrarMensajePago('Debes iniciar sesión para realizar una compra. Ve a la pestaña "Mi Cuenta" para entrar.', 'error');
            setTimeout(() => mostrarTab('login'), 2000);
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
                    mostrarMensajePago('Tu sesión ha expirado. Por favor inicia sesión nuevamente.', 'error');
                    setTimeout(() => mostrarTab('login'), 2000);
                    return;
                }

                throw new Error(errorMessage);
            }
        }

        // Limpiar carrito y mostrar éxito
        carrito = [];
        actualizarContadorCarrito();
        document.getElementById('form-pago').reset();

        // Mostrar mensaje de éxito con duración extendida
        mostrarMensajePago('✅ ¡Pago procesado exitosamente! Te contactaremos pronto para confirmar tu pedido.', 'success');

        // Redirigir al catálogo después de unos segundos
        setTimeout(() => {
            mostrarTab('catalogo');
        }, 6000);

    } catch (error) {
        console.error('Error al procesar pago:', error);
        mostrarMensajePago(`❌ Error al procesar el pago: ${error.message || 'Error desconocido'}`, 'error');
    } finally {
        // Reactivar botón
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    }
}

// Función para mostrar mensajes de pago debajo del botón
function mostrarMensajePago(mensaje, tipo) {
    const mensajePago = document.getElementById('mensaje-pago');

    if (!mensajePago) return;

    mensajePago.innerHTML = mensaje;
    mensajePago.className = `payment-message ${tipo}`;
    mensajePago.style.display = 'block';

    // Auto-ocultar mensajes de error después de 5 segundos
    // Los mensajes de éxito se mantienen visibles hasta la redirección
    if (tipo === 'error') {
        setTimeout(() => {
            mensajePago.style.display = 'none';
        }, 5000);
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
    // Guardar información del usuario en una variable global para usar en otras partes
    window.session = {
        user_id: usuario.id,
        user_email: usuario.email,
        user_name: usuario.nombre
    };

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

    // Si estamos en la página de pago, actualizar el email automáticamente
    const pagoSection = document.getElementById('pago');
    if (pagoSection && pagoSection.classList.contains('active')) {
        const emailInput = document.getElementById('pago-email');
        if (emailInput) {
            emailInput.value = usuario.email;
            emailInput.readOnly = true;
            emailInput.style.backgroundColor = 'rgba(255,255,255,0.1)';
            emailInput.style.cursor = 'not-allowed';
        }
    }
}

// Cerrar sesión
async function cerrarSesion() {
    try {
        const response = await fetch('/logout', {
            method: 'POST'
        });

        if (response.ok) {
            // Limpiar información de sesión
            window.session = null;
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

            // Verificar si es Gift Card y tiene código
            const esGiftCard = compra.categoria === 'gift-cards' || 
                              (compra.juego_nombre && compra.juego_nombre.toLowerCase().includes('gift'));

            let codigoHtml = '';
            if (esGiftCard && compra.codigo_producto && compra.estado === 'procesado') {
                codigoHtml = `
                    <div class="purchase-code">
                        <strong>🎁 Código de Gift Card:</strong>
                        <div class="code-display">
                            <span class="code-text">${compra.codigo_producto}</span>
                            <button onclick="copiarCodigo('${compra.codigo_producto}')" class="copy-code-btn" title="Copiar código">
                                📋
                            </button>
                        </div>
                    </div>
                `;
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
                    ${codigoHtml}
                    <div class="purchase-payment">
                        <small><strong>Método:</strong> ${compra.metodo_pago}</small>
                        <small><strong>Referencia:</strong> ${compra.referencia_pago}</small>
                    </div>
                </div>
            `;
        });

        listaCompras.innerHTML = html;

    } catch (error) {
        console.error('Error al cargar historial:', error);
        listaCompras.innerHTML = '<p style="color: #dc3545;">Error al cargar el historial de compras</p>';
    }
}

// Función para copiar código de Gift Card
function copiarCodigo(codigo) {
    navigator.clipboard.writeText(codigo).then(() => {
        mostrarAlerta('Código copiado al portapapeles', 'success');
    }).catch(() => {
        // Fallback para navegadores que no soportan clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = codigo;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        mostrarAlerta('Código copiado al portapapeles', 'success');
    });
}

// Funciones del carrusel de juegos
function crearCarruselJuegos() {
    const juegos = productos.filter(producto => producto.categoria === 'juegos');
    if (juegos.length === 0) return '';

    gamesCarouselItems = juegos;
    gamesCarouselIndex = 0;

    let cardsHtml = '';
    juegos.forEach(juego => {
        // Corregir ruta de imagen
        let imagenUrl = juego.imagen || '';
        if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
            imagenUrl = `/static/${imagenUrl}`;
        }
        if (!imagenUrl) {
            imagenUrl = 'https://via.placeholder.com/300x200/007bff/ffffff?text=Producto';
        }

        // Calcular precio mínimo y máximo
        let precioMinimo = 0;
        let precioMaximo = 0;
        if (juego.paquetes && Array.isArray(juego.paquetes) && juego.paquetes.length > 0) {
            const precios = juego.paquetes.map(p => parseFloat(p.precio) || 0);
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

        cardsHtml += `
            <div class="games-carousel-card" onclick="verDetalleProducto(${juego.id})">
                <img src="${imagenUrl}" alt="${juego.nombre || 'Producto'}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200/007bff/ffffff?text=Producto'">
                <div class="product-name">${juego.nombre || 'Producto sin nombre'}</div>
                <div class="price-desde">${rangoPrecio}</div>
            </div>
        `;
    });

    return `
        <div class="section-header">
            <h3 class="section-title">🎮 Juegos Destacados</h3>
            <button class="section-more-btn" onclick="mostrarTodosLosJuegos()">Ver más</button>
        </div>
        <div class="games-section">
            <div class="games-carousel-container">
                <div class="games-carousel-track" id="games-carousel-track">
                    ${cardsHtml}
                </div>
                ${juegos.length > 3 ? `
                    <button class="games-carousel-nav prev" onclick="moverCarruselJuegos(-1)">‹</button>
                    <button class="games-carousel-nav next" onclick="moverCarruselJuegos(1)">›</button>
                ` : ''}
            </div>
        </div>
    `;
}

// Función para crear sección de Gift Cards
function crearSeccionGiftCards() {
    const giftCards = productos.filter(producto => producto.categoria === 'gift-cards');
    if (giftCards.length === 0) return '';

    let cardsHtml = '';
    giftCards.forEach(giftCard => {
        // Corregir ruta de imagen
        let imagenUrl = giftCard.imagen || '';
        if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
            imagenUrl = `/static/${imagenUrl}`;
        }
        if (!imagenUrl) {
            imagenUrl = 'https://via.placeholder.com/300x200/007bff/ffffff?text=Producto';
        }

        // Calcular precio mínimo y máximo
        let precioMinimo = 0;
        let precioMaximo = 0;
        if (giftCard.paquetes && Array.isArray(giftCard.paquetes) && giftCard.paquetes.length > 0) {
            const precios = giftCard.paquetes.map(p => parseFloat(p.precio) || 0);
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

        cardsHtml += `
            <div class="games-carousel-card" onclick="verDetalleProducto(${giftCard.id})">
                <img src="${imagenUrl}" alt="${giftCard.nombre || 'Producto'}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200/007bff/ffffff?text=Producto'">
                <div class="product-name">${giftCard.nombre || 'Producto sin nombre'}</div>
                <div class="price-desde">${rangoPrecio}</div>
            </div>
        `;
    });

    return `
        <div class="section-header">
            <h3 class="section-title">🎁 Gift Cards</h3>
            <button class="section-more-btn" onclick="mostrarTodasLasGiftCards()">Ver Todos</button>
        </div>
        <div class="games-section">
            <div class="games-carousel-container">
                <div class="games-carousel-track" id="giftcards-carousel-track">
                    ${cardsHtml}
                </div>
                ${giftCards.length > 3 ? `
                    <button class="games-carousel-nav prev" onclick="moverCarruselGiftCards(-1)">‹</button>
                    <button class="games-carousel-nav next" onclick="moverCarruselGiftCards(1)">›</button>
                ` : ''}
            </div>
        </div>
    `;
}

function moverCarruselJuegos(direccion) {
    const track = document.getElementById('games-carousel-track');
    if (!track || gamesCarouselItems.length === 0) return;

    const cardWidth = 220 + 15; // ancho de tarjeta + gap
    const containerWidth = track.parentElement.offsetWidth;
    const visibleCards = Math.floor(containerWidth / cardWidth);
    const maxIndex = Math.max(0, gamesCarouselItems.length - visibleCards);

    gamesCarouselIndex += direccion;

    if (gamesCarouselIndex < 0) {
        gamesCarouselIndex = 0;
    }
    if (gamesCarouselIndex > maxIndex) {
        gamesCarouselIndex = maxIndex;
    }

    const translateX = -gamesCarouselIndex * cardWidth;
    track.style.transform = `translateX(${translateX}px)`;
}

function moverCarruselGiftCards(direccion) {
    const track = document.getElementById('giftcards-carousel-track');
    if (!track || giftCardsCarouselItems.length === 0) return;

    const cardWidth = 220 + 15; // ancho de tarjeta + gap
    const containerWidth = track.parentElement.offsetWidth;
    const visibleCards = Math.floor(containerWidth / cardWidth);
    const maxIndex = Math.max(0, giftCardsCarouselItems.length - visibleCards);

    giftCardsCarouselIndex += direccion;

    if (giftCardsCarouselIndex < 0) {
        giftCardsCarouselIndex = 0;
    }
    if (giftCardsCarouselIndex > maxIndex) {
        giftCardsCarouselIndex = maxIndex;
    }

    const translateX = -giftCardsCarouselIndex * cardWidth;
    track.style.transform = `translateX(${translateX}px)`;
}

function moverCarruselTodos(direccion) {
    const track = document.getElementById('todos-carousel-track');
    if (!track || !window.todosCarouselItems || window.todosCarouselItems.length === 0) return;

    const cardWidth = 220 + 15; // ancho de tarjeta + gap
    const containerWidth = track.parentElement.offsetWidth;
    const visibleCards = Math.floor(containerWidth / cardWidth);
    const maxIndex = Math.max(0, window.todosCarouselItems.length - visibleCards);

    window.todosCarouselIndex += direccion;

    if (window.todosCarouselIndex < 0) {
        window.todosCarouselIndex = 0;
    }
    if (window.todosCarouselIndex > maxIndex) {
        window.todosCarouselIndex = maxIndex;
    }

    const translateX = -window.todosCarouselIndex * cardWidth;
    track.style.transform = `translateX(${translateX}px)`;
}

function mostrarTodosLosJuegos() {
    // Activar pestaña de juegos y mostrar catálogo
    filtrarProductos('juegos');
    mostrarTab('catalogo');

    // Hacer scroll hacia los productos
    setTimeout(() => {
        const productosGrid = document.getElementById('productos-grid');
        if (productosGrid) {
            productosGrid.scrollIntoView({ behavior: 'smooth' });
        }
    }, 300);
}

function mostrarTodasLasGiftCards() {
    // Activar pestaña de gift cards y mostrar catálogo
    filtrarProductos('gift-cards');
    mostrarTab('catalogo');

    // Hacer scroll hacia los productos
    setTimeout(() => {
        const productosGrid = document.getElementById('productos-grid');
        if (productosGrid) {
            productosGrid.scrollIntoView({ behavior: 'smooth' });
        }
    }, 300);
}

// Función para manejar tabs de autenticación
function mostrarAuthTab(tabName, element) {
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

    // Activar el tab seleccionado si se proporciona el elemento
    if (element) {
        element.classList.add('active');
    }
}

// Función para cerrar notificación programáticamente
function cerrarNotificacion() {
    const notification = document.querySelector('.mobile-notification.show');
    if (notification) {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 400);
    }
}

// Función para cambiar slides del carrusel (plusSlides para flechas)
function plusSlides(n) {
    slideIndex += n;
    if (slideIndex > 3) slideIndex = 1;
    if (slideIndex < 1) slideIndex = 3;
    showSlide(slideIndex);
}

// Función para mostrar términos y condiciones
function mostrarTerminos() {
    const terminos = `
    📋 TÉRMINOS Y CONDICIONES - INEFABLESTORE

    1. ACEPTACIÓN DE TÉRMINOS
    Al realizar una compra en Inefablestore, aceptas estos términos y condiciones.

    2. PRODUCTOS Y SERVICIOS
    • Ofrecemos recargas de juegos móviles y gift cards digitales
    • Los productos son entregados digitalmente
    • Las entregas se realizan en un plazo de 5 a 30 minutos

    3. PAGOS
    • Aceptamos Pago Móvil (VES) y Binance (USD)
    • Todos los pagos deben ser verificados antes de la entrega
    • No se aceptan devoluciones una vez entregado el producto

    4. POLÍTICA DE REEMBOLSOS
    • Solo se procesan reembolsos por errores de nuestra parte
    • Los códigos ya entregados no son reembolsables
    • Las disputas deben reportarse dentro de 24 horas

    5. RESPONSABILIDADES
    • El cliente debe proporcionar información correcta
    • Inefablestore no se hace responsable por cuentas suspendidas
    • El uso de nuestros servicios es bajo tu propio riesgo

    6. PRIVACIDAD
    • Protegemos tu información personal
    • No compartimos datos con terceros
    • Solo usamos tu información para procesar órdenes

    7. CONTACTO
    Para consultas o soporte, contáctanos a través de nuestros canales oficiales.

    Al marcar la casilla, confirmas que has leído y aceptas estos términos.
    `;

    // Mostrar en una alerta personalizada o modal
    if (window.innerWidth <= 768) {
        // En móviles, usar un alert simple
        alert(terminos);
    } else {
        // En desktop, crear un modal personalizado
        const modal = document.createElement('div');
        modal.className = 'terms-modal';
        modal.innerHTML = `
            <div class="terms-modal-content">
                <div class="terms-modal-header">
                    <h3>📋 Términos y Condiciones</h3>
                    <button onclick="cerrarModalTerminos()" class="close-modal">✕</button>
                </div>
                <div class="terms-modal-body">
                    <pre style="white-space: pre-wrap; color: #ffffff; line-height: 1.6; font-family: inherit;">${terminos}</pre>
                </div>
                <div class="terms-modal-footer">
                    <button onclick="cerrarModalTerminos()" class="btn btn-primary">Cerrar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Agregar estilos del modal
        if (!document.getElementById('terms-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'terms-modal-styles';
            styles.textContent = `
                .terms-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    backdrop-filter: blur(5px);
                }
                .terms-modal-content {
                    background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                    border-radius: 20px;
                    max-width: 90%;
                    max-height: 90%;
                    border: 1px solid #444;
                    overflow: hidden;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }
                .terms-modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #444;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .terms-modal-header h3 {
                    color: #ffffff;
                    margin: 0;
                }
                .close-modal {
                    background: none;
                    border: none;
                    color: #ffffff;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 5px;
                }
                .terms-modal-body {
                    padding: 20px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                .terms-modal-footer {
                    padding: 20px;
                    border-top: 1px solid #444;
                    text-align: center;
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// Función para cerrar el modal de términos
function cerrarModalTerminos() {
    const modal = document.querySelector('.terms-modal');
    if (modal) {
        modal.remove();
    }
}