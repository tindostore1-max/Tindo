// Forzar envÃ­o de cookies de sesiÃ³n en todas las peticiones same-origin
(() => {
  try {
    const originalFetch = window.fetch;
    window.fetch = (input, init = {}) => {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const sameOrigin = !/^https?:\/\//i.test(url) || url.startsWith(window.location.origin);
        if (sameOrigin) {
          init = { credentials: 'include', ...init };
        }
      } catch (e) {
        // ignorar errores y continuar
      }
      return originalFetch(input, init);
    };
  } catch (e) {
    console.warn('No se pudo envolver fetch para incluir credenciales:', e);
  }
})();

// ---- Utilidad para corregir "mojibake" (símbolos raros por mala codificación) ----
// Convierte textos tipo "aÃºn" -> "aún" y corrige emojis que aparecen como "ðŸ¤–".
// Técnica: interpreta el string actual como bytes Latin-1 y los decodifica como UTF-8.
function fixMojibake(str) {
  try {
    if (typeof str !== 'string') return str;
    // Evitar trabajo cuando no hay patrones típicos de mojibake
    if (!/[ÂÃðâ]/.test(str)) return str;
    // escape() transforma cada char <256 en %xx y decodeURIComponent lo interpreta como UTF-8
    const fixed = decodeURIComponent(escape(str));
    return fixed;
  } catch (_) {
    return str;
  }
}

// Recorre el DOM y corrige nodos de texto visibles
function fixMojibakeInDOM(root = document.body) {
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    const candidates = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node && node.nodeValue && /[ÂÃðâ]/.test(node.nodeValue)) {
        candidates.push(node);
      }
    }
    for (const node of candidates) {
      node.nodeValue = fixMojibake(node.nodeValue);
    }
  } catch (e) {
    // silencioso
  }
}

// Variables globales
let productos = [];
let carrito = cargarCarritoDesdeStorage();
let monedaActual = 'VES';
let tasaUSDVES = 142.00; // Inicializar con tasa conocida actual
let configuracion = {};
let productoSeleccionado = null;

// Variables globales para los carruseles
let gamesCarouselIndex = 0;
let gamesCarouselItems = [];
let giftCardsCarouselIndex = 0;
let giftCardsCarouselItems = [];

// Normalizar texto de descripciÃ³n: quitar sangrÃ­as y espacios iniciales por lÃ­nea
function normalizeDescripcion(texto) {
    try {
        if (!texto) return '';
        let t = String(texto)
            .replace(/\r\n/g, '\n')
            .replace(/\t/g, ' ');
        // Quitar espacios al inicio de cada lÃ­nea
        t = t.replace(/^\s+/gm, '');
        return t.trim();
    } catch (e) {
        return texto || '';
    }
}

// Funciones para persistencia del carrito
function guardarCarritoEnStorage() {
    try {
        localStorage.setItem('inefablestore_carrito', JSON.stringify(carrito));
    } catch (error) {
        console.warn('No se pudo guardar el carrito en localStorage:', error);
    }
}

// Mostrar mÃ¡s/menos paquetes en la secciÃ³n de detalles
function toggleMostrarMasPaquetes(productoId) {
    try {
        const list = document.getElementById(`package-list-${productoId}`);
        const btn = document.getElementById(`btn-mostrar-mas-${productoId}`);
        if (!list || !btn) return;

        const expanded = list.getAttribute('data-expanded') === 'true';
        const LIMITE_INICIAL_PAQUETES = 8;

        // Determinar la fuente de datos de paquetes
        let producto = productoSeleccionado && productoSeleccionado.id === productoId ? productoSeleccionado : null;
        if (!producto) {
            producto = productos.find(p => p.id === productoId);
        }
        if (!producto || !producto.paquetes) return;

        const data = expanded ? producto.paquetes.slice(0, LIMITE_INICIAL_PAQUETES) : producto.paquetes;

        // Generar HTML reutilizando el mismo estilo de item
        const html = data.map(paquete => {
            const precio = parseFloat(paquete.precio) || 0;
            return `
                <div class=\"pkg-card pkg-selectable\" onclick=\"seleccionarPaquete(this)\" 
                     data-package-id=\"${paquete.id}\" 
                     data-package-name=\"${paquete.nombre}\" 
                     data-package-price=\"${precio}\"
                     style=\"position:relative; background:#1b1b1b; border:2px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px; cursor:pointer; transition:border-color 0.15s ease, box-shadow 0.15s ease; min-height:90px; height:90px; width:160px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; overflow:visible;\">
                    <div class=\"pkg-title\" style=\"font-weight:700; font-size:14px; color:#ffffff; text-align:center; max-width:90%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; position:relative; z-index:2;\">${paquete.nombre}</div>
                    <div class=\"pkg-price\" style=\"position:relative; z-index:2; font-weight:800; color:#ffffff; background:transparent; border:none; padding:4px 10px; border-radius:10px;\">${convertirPrecio(precio)}</div>
                </div>
            `;
        }).join('');

        list.innerHTML = html;
        list.setAttribute('data-expanded', expanded ? 'false' : 'true');
        btn.textContent = expanded ? 'Mostrar más' : 'Mostrar menos';

        // Mantener una selecciÃ³n vÃ¡lida: seleccionar el primero si no hay ninguno
        setTimeout(() => {
            const seleccionado = document.querySelector(`#package-list-${productoId} .package-item.selected`);
            if (!seleccionado) {
                const primero = document.querySelector(`#package-list-${productoId} .package-item`);
                if (primero) primero.click();
            }
        }, 50);

    } catch (e) {
        console.warn('toggleMostrarMasPaquetes error:', e);
    }
}

function cargarCarritoDesdeStorage() {
    try {
        const carritoGuardado = localStorage.getItem('inefablestore_carrito');
        if (carritoGuardado) {
            return JSON.parse(carritoGuardado);
        }
    } catch (error) {
        console.warn('No se pudo cargar el carrito desde localStorage:', error);
    }
    return [];
}

function limpiarCarritoStorage() {
    try {
        localStorage.removeItem('inefablestore_carrito');
    } catch (error) {
        console.warn('No se pudo limpiar el carrito del localStorage:', error);
    }
}

// Variables para control de carga optimizada
let configuracionCargada = false;
let productosCargados = false;
let sesionVerificada = false;
let interfazLista = false;

// Cache para optimizar cargas con timestamp
let configCache = null;
let productosCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Flag para evitar mÃºltiples cargas simultÃ¡neas
let cargandoDatos = false;

// FunciÃ³n para verificar si todo estÃ¡ cargado
function verificarCargaCompleta() {
    if (configuracionCargada && productosCargados && sesionVerificada && interfazLista) {
        console.log('âœ… Carga completa - todos los recursos listos');

        // Mostrar todo el contenido de forma suave
        setTimeout(() => {
            const mainContainer = document.querySelector('.container');
            const logoImg = document.getElementById('logo-img');
            const carousel = document.querySelector('.carousel-container');
            const grid = document.getElementById('productos-grid');

            if (mainContainer) {
                mainContainer.style.opacity = '1';
            }
            if (logoImg) {
                logoImg.style.opacity = '1';
            }
            if (carousel) {
                carousel.style.opacity = '1';
            }
            if (grid) {
                grid.style.opacity = '1';
            }
        }, 100);
    }
}

// FunciÃ³n para cargar elementos crÃ­ticos primero
function cargarElementosCriticos() {
    // Mostrar contenido inmediatamente sin desvanecimientos
    const mainContainer = document.querySelector('.container');
    if (mainContainer) {
        mainContainer.style.opacity = '1';
        mainContainer.style.transition = 'none';
    }

    // Precargar logo desde cache si estÃ¡ disponible
    cargarCacheDesdeStorage();
    
    // Mostrar logo inmediatamente - usar cache si estÃ¡ disponible
    const logoImg = document.getElementById('logo-img');
    if (logoImg) {
        logoImg.style.display = 'block';
        logoImg.style.opacity = '1';
        
        // Si hay cache con logo, usarlo inmediatamente
        if (configCache && configCache.logo && configCache.logo.trim() !== '') {
            let logoUrl = configCache.logo;
            if (!logoUrl.startsWith('http') && !logoUrl.startsWith('/static/')) {
                logoUrl = `/static/${logoUrl}`;
            }
            
            // Precargar imagen del logo
            const img = new Image();
            img.onload = function() {
                logoImg.src = logoUrl;
                console.log('Logo del cache cargado inmediatamente:', logoUrl);
            };
            img.onerror = function() {
                logoImg.src = '/static/images/20250706_015933_Captura_de_pantalla_5-7-2025_182440_www.inefablestor.png';
            };
            img.src = logoUrl;
        } else {
            logoImg.src = 'https://via.placeholder.com/200x60/007bff/ffffff?text=INEFABLESTORE';
        }
        console.log('Logo inicial mostrado');
    }

    // Precargar carrusel desde cache si estÃ¡ disponible
    precargarCarruselDesdeCache();

    // Mostrar carrusel inmediatamente
    const carousel = document.querySelector('.carousel-container');
    if (carousel) {
        carousel.style.opacity = '1';
    }

    // Mostrar grid de productos inmediatamente
    const grid = document.getElementById('productos-grid');
    if (grid) {
        grid.style.opacity = '1';
        grid.innerHTML = '';
    }
}

// InicializaciÃ³n optimizada
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando carga optimizada...');

    // Corregir posibles textos ya renderizados con mojibake al cargar
    fixMojibakeInDOM();

    // Verificar si hay mensaje de Google OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_login') === 'success') {
        setTimeout(() => {
            mostrarAlerta('✅ Sesión iniciada con Google correctamente', 'success');
            // Limpiar URL
            window.history.replaceState({}, document.title, window.location.pathname);
            // Recargar datos del usuario
            verificarSesion();
        }, 1000);
    } else if (urlParams.get('google_login') === 'error') {
        setTimeout(() => {
            mostrarAlerta('❌ Error al iniciar sesión con Google', 'error');
            // Limpiar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 1000);
    }

    // 1. Cargar elementos crÃ­ticos inmediatamente (incluye precarga de logo y carrusel)
    cargarElementosCriticos();

    // 3. Inicializar eventos bÃ¡sicos
    inicializarEventos();

    // 4. Cargar datos en paralelo SIEMPRE para mantener actualizada la informaciÃ³n
    if (!cargandoDatos) {
        cargandoDatos = true;
        
        // Si hay cache vÃ¡lido, usar para mostrar contenido inmediato
        if (cacheValido()) {
            console.log('📦 Usando datos del cache para mostrar contenido inmediato');
            configuracion = configCache;
            productos = productosCache;
            configuracionCargada = true;
            productosCargados = true;
            mostrarProductos();
        }
        
        // Cargar datos frescos del servidor en paralelo (especialmente para tasa de cambio)
        Promise.all([
            cargarConfiguracionOptimizada(),
            cargarProductosOptimizado(),
            verificarSesionOptimizada()
        ]).then(() => {
            console.log('✅ Carga de datos completada');
            interfazLista = true;
            verificarCargaCompleta();
            cargandoDatos = false;
            
            // Solo actualizar logo y carrusel si cambiÃ³ la configuraciÃ³n
            if (configuracion) {
                actualizarLogo();
                actualizarImagenesCarrusel();
            }
        }).catch(error => {
            console.error('❌ Error en carga:', error);
            interfazLista = true;
            cargandoDatos = false;
        });
    }
    
    // 4. Tareas no crÃ­ticas despuÃ©s del render
    setTimeout(() => {
        // Inicializar carrusel automÃ¡tico
        inicializarCarrusel();
        // Actualizar contador del carrito
        actualizarContadorCarrito();

        // Crear tooltip del carrito para desktop
        if (window.innerWidth > 768) {
            crearTooltipCarrito();
        }

        // Configurar eventos de resize
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                const existingTooltip = document.getElementById('cart-tooltip');
                if (!existingTooltip) {
                    crearTooltipCarrito();
                } else {
                    configurarEventosTooltip();
                }
            } else {
                const tooltip = document.getElementById('cart-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            }
        });

        // Establecer VES como moneda por defecto
        const selectorMoneda = document.getElementById('selector-moneda');
        if (selectorMoneda) {
            selectorMoneda.value = 'VES';
            monedaActual = 'VES';
            console.log('Moneda inicial establecida:', monedaActual);
        }

        // Inicializar eventos tÃ¡ctiles
        inicializarSwipeCarruseles();

        // Inicializar notificaciones de ayuda
        inicializarNotificacionesAyuda();

        // Manejar la ruta actual
        manejarRutaActual();

        // Activar categorÃ­a desde URL o por defecto
        if (window.categoriaDesdeURL) {
            filtrarProductos(window.categoriaDesdeURL);
            window.categoriaDesdeURL = null;
        } else if (!filtroActual) {
            filtrarProductos('todos');
        }

        // Corregir nuevamente cualquier texto inyectado tras el primer render
        fixMojibakeInDOM();

        // Mostrar footer
        mostrarFooterCopyright();
    }, 50);
});

// Funciones del carrusel
let slideIndex = 1;

function inicializarCarrusel() {
    // Cambiar slide automÃ¡ticamente cada 5 segundos
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

// VersiÃ³n optimizada de verificar sesiÃ³n
async function verificarSesionOptimizada() {
    try {
        const response = await fetch('/usuario');
        if (response.ok) {
            const data = await response.json();
            console.log('Usuario logueado encontrado:', data.usuario);
            // Actualizar interfaz inmediatamente para evitar problemas de sincronizaciÃ³n
            actualizarInterfazUsuario(data.usuario);
        } else {
            console.log('No hay sesiÃ³n activa, cÃ³digo:', response.status);
        }
        sesionVerificada = true;
    } catch (error) {
        console.log('Error al verificar sesiÃ³n:', error);
        sesionVerificada = true;
    }
}

// Verificar si hay sesiÃ³n activa (mantener para compatibilidad)
async function verificarSesion() {
    return verificarSesionOptimizada();
}

// FunciÃ³n para manejar la ruta actual del navegador
function manejarRutaActual() {
    const path = window.location.pathname;
    const hash = window.location.hash.replace('#', '');

    console.log('Manejando ruta actual:', { path, hash });

    // Mapear rutas a pestaÃ±as
    const rutasPestanas = {
        '/': 'catalogo',
        '/catalogo': 'catalogo',
        '/carrito': 'carrito',
        '/pago': 'pago',
        '/login': 'login',
        '/cuenta': 'login',
        '/admin': 'admin'
    };

    // Determinar quÃ© pestaÃ±a mostrar
    let pestanaActiva = 'catalogo'; // Por defecto
    let productoId = null;
    let categoriaSeleccionada = null;

    // Verificar si es un hash de detalles con ID de producto
    if (hash && hash.startsWith('detalles-')) {
        const id = hash.replace('detalles-', '');
        if (id && !isNaN(id)) {
            pestanaActiva = 'detalles';
            productoId = parseInt(id);
        }
    }
    // Verificar si es una categorÃ­a vÃ¡lida
    else if (hash && ['todos', 'juegos', 'gift-cards'].includes(hash)) {
        pestanaActiva = 'catalogo';
        categoriaSeleccionada = hash;
    }
    // Si hay hash vÃ¡lido, usarlo como pestaÃ±a
    else if (hash && ['catalogo', 'carrito', 'pago', 'login', 'detalles'].includes(hash)) {
        pestanaActiva = hash;
    } else if (rutasPestanas[path]) {
        pestanaActiva = rutasPestanas[path];
    }

    console.log('PestaÃ±a activa determinada:', pestanaActiva, 'Producto ID:', productoId);

    // Si es detalles con ID de producto, cargar el producto
    if (pestanaActiva === 'detalles' && productoId) {
        // Esperar a que los productos se carguen
        const cargarProductoDesdeURL = () => {
            if (productos.length === 0) {
                // Si aÃºn no se han cargado los productos, esperar un poco mÃ¡s
                setTimeout(cargarProductoDesdeURL, 100);
                return;
            }

            const producto = productos.find(p => p.id === productoId);
            if (producto) {
                console.log('Producto encontrado en URL:', producto.nombre);
                // Cargar el producto directamente sin llamar a verDetalleProducto
                // para evitar recursiÃ³n
                productoSeleccionado = producto;
                mostrarDetalleProductoDesdeURL(producto);
            } else {
                console.log('Producto no encontrado, redirigiendo al catÃ¡logo');
                mostrarTab('catalogo');
            }
        };

        cargarProductoDesdeURL();
        return;
    }

    // Si hay una categorÃ­a seleccionada en la URL, activarla
    if (categoriaSeleccionada && pestanaActiva === 'catalogo') {
        // Guardar la categorÃ­a para usar despuÃ©s de cargar los productos
        window.categoriaDesdeURL = categoriaSeleccionada;
        console.log('CategorÃ­a desde URL:', categoriaSeleccionada);
    }

    // Verificar que la pestaÃ±a existe antes de mostrarla
    const elementoPestana = document.getElementById(pestanaActiva);
    if (elementoPestana) {
        // Si es la pestaÃ±a de detalles pero no hay producto seleccionado, ir al catÃ¡logo
        if (pestanaActiva === 'detalles' && !productoSeleccionado) {
            console.log('Redirigiendo a catÃ¡logo porque no hay producto seleccionado');
            mostrarTab('catalogo');
            return;
        }
        mostrarTab(pestanaActiva);
    } else {
        console.warn('PestaÃ±a no encontrada:', pestanaActiva);
        // Fallback a catÃ¡logo si la pestaÃ±a no existe
        mostrarTab('catalogo');
    }
}

// FunciÃ³n para actualizar la URL sin recargar
function actualizarURL(tabName) {
    if (tabName === 'catalogo') {
        // Si estamos en catÃ¡logo, usar la categorÃ­a actual en lugar de la raÃ­z
        if (filtroActual && filtroActual !== 'todos') {
            window.history.replaceState({}, '', `#${filtroActual}`);
        } else {
            window.history.replaceState({}, '', '#todos');
        }
    } else if (tabName === 'detalles' && productoSeleccionado) {
        window.history.replaceState({}, '', `#detalles-${productoSeleccionado.id}`);
    } else {
        window.history.replaceState({}, '', `#${tabName}`);
    }
}

// Manejar el botÃ³n atrÃ¡s del navegador
window.addEventListener('popstate', function(event) {
    manejarRutaActual();
});

// Funciones de navegaciÃ³n
function mostrarTab(tabName, element) {
    console.log('Mostrando tab:', tabName);

    // Si es carrito en mÃ³vil, abrir sidebar lateral
    if (tabName === 'carrito' && window.innerWidth <= 768) {
        abrirCarritoLateral();
        return;
    }

    // En desktop, ignorar clicks en carrito ya que se maneja solo por tooltip
    if (tabName === 'carrito' && window.innerWidth > 768) {
        return;
    }

    // Verificar que la pestaÃ±a existe
    const targetSection = document.getElementById(tabName);
    if (!targetSection) {
        console.error('PestaÃ±a no encontrada:', tabName);
        return;
    }

    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.tab-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Quitar clase active SOLO de los botones de navegaciÃ³n (no de categorÃ­as)
    const navBtns = document.querySelectorAll('.nav-btn');
    const desktopNavBtns = document.querySelectorAll('.desktop-nav-btn');

    navBtns.forEach(btn => {
        btn.classList.remove('active');
    });

    desktopNavBtns.forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar secciÃ³n seleccionada
    targetSection.classList.add('active');

    // Activar botones especÃ­ficos segÃºn la pestaÃ±a
    if (tabName === 'catalogo') {
        document.querySelectorAll('.nav-btn[onclick*="catalogo"], .desktop-nav-btn[onclick*="catalogo"]').forEach(btn => {
            btn.classList.add('active');
        });

        // Siempre activar el filtro "Todos" cuando se hace clic en el botÃ³n CatÃ¡logo
        setTimeout(() => {
            filtrarProductos('todos');
        }, 50);

    } else if (tabName === 'carrito') {
        // Solo activar botÃ³n mÃ³vil del carrito, no el desktop
        document.querySelectorAll('.nav-btn[onclick*="carrito"]').forEach(btn => {
            btn.classList.add('active');
        });
    } else if (tabName === 'login') {
        document.querySelectorAll('.nav-btn[onclick*="login"], .desktop-nav-btn[onclick*="login"]').forEach(btn => {
            btn.classList.add('active');
        });
    }

    // Actualizar URL del navegador
    actualizarURL(tabName);

    // Cargar datos especÃ­ficos segÃºn la pestaÃ±a
    if (tabName === 'carrito') {
        mostrarCarrito();
    } else if (tabName === 'pago') {
        prepararPago();
    } else if (tabName === 'detalles') {
        // Si estamos en detalles pero no hay producto seleccionado, ir al catÃ¡logo
        if (!productoSeleccionado) {
            console.log('No hay producto seleccionado, redirigiendo al catÃ¡logo');
            setTimeout(() => {
                mostrarTab('catalogo');
            }, 100);
            return;
        }
    }

    console.log('Tab mostrada exitosamente:', tabName);
}

// FunciÃ³n para mostrar alertas
function mostrarAlerta(mensaje, tipo = 'success') {
    // En dispositivos mÃ³viles, usar notificaciÃ³n flotante
    if (window.innerWidth <= 768) {
        mostrarNotificacionFlotante(mensaje, tipo);
        return;
    }

    // En desktop, usar alerta normal
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo}`;
    alertDiv.textContent = fixMojibake(mensaje);

    const contenido = document.querySelector('.content');
    contenido.insertBefore(alertDiv, contenido.firstChild);

    setTimeout(() => {
        alertDiv.remove();
    }, 4000);
}

// FunciÃ³n para mostrar notificaciÃ³n flotante en mÃ³viles
function mostrarNotificacionFlotante(mensaje, tipo = 'success') {
    // Intentar corregir mojibake del mensaje desde la fuente
    mensaje = fixMojibake(mensaje);
    // Remover notificaciÃ³n anterior si existe
    const existingNotification = document.querySelector('.mobile-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Crear nueva notificaciÃ³n
    const notification = document.createElement('div');
    notification.className = `mobile-notification ${tipo}`;

    // Seleccionar icono según el tipo
    let icon = '✔';
    if (tipo === 'error') {
        icon = '✖';
    } else if (tipo === 'success') {
        icon = '✔';
    }

    // Limpiar mensaje para que sea mÃ¡s conciso
    let mensajeLimpio = fixMojibake(mensaje);
    if (mensaje.includes('🎉') || mensaje.includes('✨') || mensaje.includes('🏷️')) {
        // Simplificar mensajes largos
        if (mensaje.includes('se agregó exitosamente') || mensaje.includes('se agregÃ³ exitosamente')) {
            mensajeLimpio = 'Producto agregado al carrito';
        } else if (mensaje.includes('cantidad aumentada')) {
            mensajeLimpio = 'Cantidad actualizada';
        } else if (mensaje.includes('eliminado del carrito')) {
            mensajeLimpio = 'Producto eliminado';
        } else {
            // Remover emojis y simplificar
            mensajeLimpio = mensaje.replace(/[🎉✨🏷️⚠️✅📦🗑️💱]/g, '').trim();
        }
    }

    notification.innerHTML = `
        <span class="mobile-notification-icon">${icon}</span>
        <span class="mobile-notification-text">${mensajeLimpio}</span>
    `;

    // Agregar al DOM
    document.body.appendChild(notification);

    // Mostrar con animaciÃ³n
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Ocultar despuÃ©s de 2.5 segundos
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 400);
    }, 2500);

    // Permitir cerrar tocando la notificaciÃ³n
    notification.addEventListener('click', () => {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 400);
    });
}

// VersiÃ³n optimizada de cargar configuraciÃ³n
async function cargarConfiguracionOptimizada() {
    try {
        // Siempre cargar la tasa de cambio desde el servidor (sin cache)
        const response = await fetch('/config');

        if (!response.ok) {
            console.warn('No se pudo cargar la configuraciÃ³n del servidor');
            // Si hay cache para otros elementos, usarlo pero sin la tasa
            if (configCache && cacheValido()) {
                configuracion = { ...configCache };
                // NO usar la tasa del cache, mantener la por defecto
                actualizarLogo();
                setTimeout(() => actualizarImagenesCarrusel(), 500);
            } else {
                // ConfiguraciÃ³n por defecto sin cambiar la tasa
                configuracion = {
                    tasa_usd_ves: tasaUSDVES.toString(),
                    pago_movil: 'InformaciÃ³n no disponible',
                    binance: 'InformaciÃ³n no disponible',
                    logo: '',
                    carousel1: '',
                    carousel2: '',
                    carousel3: ''
                };
            }
            configuracionCargada = true;
            return;
        }

        const nuevaConfiguracion = await response.json();

        console.log('ConfiguraciÃ³n cargada desde servidor (tasa en tiempo real):', nuevaConfiguracion);

        // SIEMPRE actualizar la tasa desde el servidor (tiempo real)
        if (nuevaConfiguracion.tasa_usd_ves && parseFloat(nuevaConfiguracion.tasa_usd_ves) > 0) {
            const nuevaTasa = parseFloat(nuevaConfiguracion.tasa_usd_ves);
            tasaUSDVES = nuevaTasa;
            console.log('âœ… Tasa de cambio actualizada desde el servidor:', tasaUSDVES);
            console.log('âœ… VerificaciÃ³n: 10 USD = Bs.', (10 * nuevaTasa).toFixed(2));
        } else {
            console.warn('Tasa invÃ¡lida en configuraciÃ³n del servidor, manteniendo tasa actual:', tasaUSDVES);
        }

        configuracion = nuevaConfiguracion;

        // Actualizar logo inmediatamente
        actualizarLogo();

        // Actualizar imÃ¡genes del carrusel inmediatamente
        actualizarImagenesCarrusel();

        // Verificar cÃ¡lculos despuÃ©s de cargar configuraciÃ³n
        setTimeout(() => {
            verificarCalculos();
        }, 500);

        // Guardar en cache OTROS elementos pero NO la tasa (para que siempre sea tiempo real)
        if (productos && productos.length > 0) {
            const configParaCache = { ...configuracion };
            delete configParaCache.tasa_usd_ves; // NO cachear la tasa
            guardarEnCache(configParaCache, productos);
        }

        configuracionCargada = true;
    } catch (error) {
        console.warn('Error al cargar configuraciÃ³n:', error.message || 'Error desconocido');
        // No resetear la tasa en caso de error, solo mantener la actual
        if (!configuracion) {
            configuracion = {
                tasa_usd_ves: tasaUSDVES.toString(),
                pago_movil: 'InformaciÃ³n no disponible',
                binance: 'InformaciÃ³n no disponible',
                logo: '',
                carousel1: '',
                carousel2: '',
                carousel3: ''
            };
        }
        configuracionCargada = true;
    }
}

// Cargar configuraciÃ³n del sistema (mantener para compatibilidad)
async function cargarConfiguracion() {
    return cargarConfiguracionOptimizada();
}

// FunciÃ³n separada para actualizar el logo
function actualizarLogo() {
    const logoImg = document.getElementById('logo-img');
    if (!logoImg) {
        console.log('Elemento logo-img no encontrado');
        return;
    }

    console.log('Actualizando logo con configuraciÃ³n:', configuracion);

    // Siempre mostrar el elemento primero
    logoImg.style.display = 'block';

    if (configuracion && configuracion.logo && configuracion.logo.trim() !== '') {
        let logoUrl = configuracion.logo;
        if (!logoUrl.startsWith('http') && !logoUrl.startsWith('/static/')) {
            logoUrl = `/static/${logoUrl}`;
        }
        
        // Solo actualizar si la URL es diferente para evitar parpadeos
        if (logoImg.src !== logoUrl && !logoImg.src.includes(logoUrl)) {
            // Precargar la imagen antes de mostrarla
            const img = new Image();
            img.onload = function() {
                logoImg.src = logoUrl;
                logoImg.style.opacity = '1';
                console.log('Logo personalizado cargado exitosamente:', logoUrl);
            };
            img.onerror = function() {
                // Si la imagen falla al cargar, mostrar logo por defecto
                logoImg.src = '/static/images/20250706_015933_Captura_de_pantalla_5-7-2025_182440_www.inefablestor.png';
            };
            img.src = logoUrl;
        }
    } else {
        // Solo cambiar si no estÃ¡ ya el logo por defecto
        if (!logoImg.src.includes('placeholder.com')) {
            logoImg.src = 'https://via.placeholder.com/200x60/007bff/ffffff?text=INEFABLESTORE';
            logoImg.style.opacity = '1';
            console.log('No hay logo configurado, usando logo por defecto');
        }
    }
}

// FunciÃ³n para aplicar configuraciÃ³n por defecto (manteniendo tasa actual)
function aplicarConfiguracionPorDefecto() {
    // No resetear la tasa, mantener la actual o usar la del servidor
    const tasaActual = tasaUSDVES || 142.00;
    
    configuracion = {
        tasa_usd_ves: tasaActual.toString(),
        pago_movil: 'InformaciÃ³n no disponible',
        binance: 'InformaciÃ³n no disponible',
        logo: '', // Logo vacÃ­o para activar el placeholder
        carousel1: '',
        carousel2: '',
        carousel3: ''
    };
    
    // Solo actualizar la tasa si no estaba establecida
    if (!tasaUSDVES || tasaUSDVES <= 0) {
        tasaUSDVES = tasaActual;
    }
    
    console.log('ConfiguraciÃ³n por defecto aplicada, manteniendo tasa:', tasaUSDVES);
    actualizarLogo();
    actualizarImagenesCarrusel();
}

// FunciÃ³n para actualizar las imÃ¡genes del carrusel
function actualizarImagenesCarrusel() {
    const slides = document.querySelectorAll('.carousel-slide img');

    if (!slides.length || !configuracion) {
        console.log('No hay slides o configuraciÃ³n para actualizar carrusel');
        return;
    }

    console.log('Actualizando carrusel con configuraciÃ³n:', {
        carousel1: configuracion.carousel1,
        carousel2: configuracion.carousel2,
        carousel3: configuracion.carousel3
    });

    function prepararUrlImagen(url) {
        if (!url || url.trim() === '') return null;

        // Si es una URL completa (http/https), usarla tal como estÃ¡
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // Si es una ruta que empieza con 'images/', agregar '/static/'
        if (url.startsWith('images/')) {
            return `/static/${url}`;
        }

        // Si ya tiene '/static/', usarla tal como estÃ¡
        if (url.startsWith('/static/')) {
            return url;
        }

        // Para cualquier otra ruta, asumir que necesita /static/
        return `/static/${url}`;
    }

    // FunciÃ³n para cargar imagen de forma suave
    function cargarImagenCarrusel(slide, url, index) {
        if (!slide) return;

        const urlFinal = url || `/static/images/20250701_212818_free_fire.webp`;
        
        // Solo cargar si la URL es diferente para evitar recargas innecesarias
        if (slide.src !== urlFinal && !slide.src.includes(urlFinal.split('/').pop())) {
            if (url) {
                // Precargar la imagen
                const img = new Image();
                img.onload = function() {
                    slide.src = urlFinal;
                    slide.style.display = 'block';
                    slide.style.opacity = '1';
                    console.log(`Imagen del carrusel ${index + 1} cargada:`, urlFinal);
                };
                img.onerror = function() {
                    console.warn(`Error al cargar imagen del carrusel ${index + 1}:`, urlFinal);
                    // Usar imagen placeholder si falla
                    slide.src = `/static/images/20250701_212818_free_fire.webp`;
                    slide.style.display = 'block';
                    slide.style.opacity = '1';
                };
                img.src = urlFinal;
            } else {
                // Si no hay URL, usar placeholder
                slide.src = urlFinal;
                slide.style.display = 'block';
                slide.style.opacity = '1';
                console.log(`Usando placeholder para carrusel ${index + 1}`);
            }
        }
    }

    // Configurar imÃ¡genes del carrusel
    cargarImagenCarrusel(slides[0], prepararUrlImagen(configuracion.carousel1), 0);
    cargarImagenCarrusel(slides[1], prepararUrlImagen(configuracion.carousel2), 1);
    cargarImagenCarrusel(slides[2], prepararUrlImagen(configuracion.carousel3), 2);

    // Asegurar que el carrusel estÃ© visible
    const carouselContainer = document.querySelector('.carousel-container');
    if (carouselContainer) {
        carouselContainer.style.opacity = '1';
        console.log('Carrusel visible');
    }
}

// VersiÃ³n optimizada de cargar productos
async function cargarProductosOptimizado() {
    try {
        // Si hay cache vÃ¡lido, mostrarlo de inmediato para una carga rÃ¡pida,
        // pero NO regresar: siempre vamos a buscar datos frescos para reflejar
        // productos nuevos o cambios desde el panel admin.
        if (productosCache && cacheValido()) {
            productos = productosCache;
            setTimeout(() => mostrarProductos(), 50);
            productosCargados = true;
            // Continuar para obtener datos frescos
        }

        const response = await fetch('/productos', { credentials: 'include' });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        productos = await response.json();

        console.log('Productos cargados desde servidor:', productos.length, 'productos');

        // Guardar en cache junto con configuraciÃ³n
        if (configuracion) {
            guardarEnCache(configuracion, productos);
        }

        // Mostrar productos de forma optimizada
        mostrarProductos();
        productosCargados = true;

    } catch (error) {
        console.error('Error al cargar productos:', error.message || 'Error desconocido');
        const productosGrid = document.getElementById('productos-grid');
        if (productosGrid) {
            productosGrid.innerHTML = `
                <div class="no-products">
                    <h3>Error al cargar productos</h3>
                    <p>No se pudieron cargar los productos. Verifica la conexiÃ³n e intenta recargar la pÃ¡gina.</p>
                    <button class="btn btn-primary" onclick="location.reload()">🔄 Recargar Página</button>
                </div>
            `;
        }
        productosCargados = true;
    }
}

// FunciÃ³n para cargar configuraciÃ³n inicial
async function cargarConfiguracion() {
    try {
        const response = await fetch('/config');
        if (response.ok) {
            const config = await response.json();
            configCache = config;
            console.log('ConfiguraciÃ³n cargada:', config);
        }
    } catch (error) {
        console.error('Error al cargar configuraciÃ³n:', error);
    }
}

// FunciÃ³n para mostrar productos en el grid
function mostrarProductos() {
    const productosGrid = document.getElementById('productos-grid');
    if (!productosCache || productosCache.length === 0) {
        return;
    }

    let html = '';
    productosCache.forEach(producto => {
        if (producto.paquetes && producto.paquetes.length > 0) {
            html += `
                <div class="product-card" data-categoria="${producto.categoria}">
                    <div class="product-image">
                        <img src="${producto.imagen}" alt="${producto.nombre}" onerror="this.src='https://via.placeholder.com/300x200/007bff/ffffff?text=${encodeURIComponent(producto.nombre)}'">
                    </div>
                    <div class="product-info">
                        <h3>${producto.nombre}</h3>
                        <p>${producto.descripcion || ''}</p>
                        <div class="product-packages">
                            ${producto.paquetes.map(paquete => `
                                <div class="package-option">
                                    <span>${paquete.nombre}</span>
                                    <span class="price">$${paquete.precio}</span>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-primary" onclick="seleccionarProducto(${producto.id})">
                            Comprar
                        </button>
                    </div>
                </div>
            `;
        }
    });

    productosGrid.innerHTML = html;
}

// FunciÃ³n para seleccionar producto
function seleccionarProducto(productoId) {
    const producto = productosCache.find(p => p.id === productoId);
    if (producto) {
        // Mostrar modal de compra o redirigir
        console.log('Producto seleccionado:', producto);
        // AquÃ­ puedes agregar la lÃ³gica para mostrar el modal de compra
    }
}

// Cargar datos iniciales productos del backend (mantener para compatibilidad)
async function cargarProductos() {
    return cargarProductosOptimizado();
}

// Variable para almacenar el filtro actual
let filtroActual = 'todos';

// Funciones para manejar el menÃº hamburguesa de categorÃ­as mÃ³vil
function toggleMobileCategoryMenu() {
    const menu = document.getElementById('mobile-category-menu');
    const hamburger = document.querySelector('.mobile-category-hamburger');

    if (menu.classList.contains('show')) {
        closeMobileCategoryMenu();
    } else {
        menu.style.display = 'block';
        menu.classList.add('show');
        hamburger.classList.add('active');
        // Mejorar control del scroll en mÃ³viles
        if (window.innerWidth <= 768) {
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.height = '100%';
        } else {
            document.body.style.overflow = 'hidden';
        }
    }
}

function closeMobileCategoryMenu() {
    const menu = document.getElementById('mobile-category-menu');
    const hamburger = document.querySelector('.mobile-category-hamburger');

    menu.classList.remove('show');
    hamburger.classList.remove('active');

    // Restaurar scroll natural
    if (window.innerWidth <= 768) {
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
    }
    document.body.style.overflow = '';

    setTimeout(() => {
        menu.style.display = 'none';
    }, 300);
}

// Variables para la notificaciÃ³n de ayuda
let ayudaNotificationInterval = null;
let ayudaNotificationVisible = false;

// FunciÃ³n para toggle del dropdown de redes sociales
function toggleMobileSocial() {
    const toggle = document.querySelector('.mobile-social-toggle');
    const dropdown = document.getElementById('mobile-social-dropdown');
    
    if (!toggle || !dropdown) return;
    
    const isOpen = dropdown.classList.contains('show');
    
    if (isOpen) {
        // Cerrar
        toggle.classList.remove('active');
        dropdown.classList.remove('show');
    } else {
        // Abrir
        toggle.classList.add('active');
        dropdown.classList.add('show');
    }
}

// FunciÃ³n para mostrar notificaciÃ³n de ayuda
function mostrarNotificacionAyuda() {
    // No mostrar si ya hay una visible o si el dropdown estÃ¡ abierto
    const dropdown = document.getElementById('mobile-social-dropdown');
    if (ayudaNotificationVisible || (dropdown && dropdown.classList.contains('show'))) {
        return;
    }

    const toggle = document.querySelector('.mobile-social-toggle');
    if (!toggle) return;

    // Crear notificaciÃ³n
    const notification = document.createElement('div');
    notification.className = 'ayuda-notification';
    notification.innerHTML = `
        <div class="ayuda-notification-content">
            <span class="ayuda-icon">💬</span>
            <span class="ayuda-text">¿Necesitas ayuda para realizar una recarga? Escríbenos</span>
            <button class="ayuda-close" onclick="cerrarNotificacionAyuda()">✖</button>
        </div>
    `;

    // Insertar despuÃ©s del botÃ³n de redes
    toggle.parentNode.insertBefore(notification, toggle.nextSibling);

    ayudaNotificationVisible = true;

    // Mostrar con animaciÃ³n
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Auto-ocultar despuÃ©s de 8 segundos
    setTimeout(() => {
        cerrarNotificacionAyuda();
    }, 8000);
}

// FunciÃ³n para cerrar notificaciÃ³n de ayuda
function cerrarNotificacionAyuda() {
    const notification = document.querySelector('.ayuda-notification');
    if (notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
            ayudaNotificationVisible = false;
        }, 300);
    }
}

// FunciÃ³n para inicializar notificaciones periÃ³dicas de ayuda
function inicializarNotificacionesAyuda() {
    // Solo en mÃ³viles
    if (window.innerWidth > 768) return;

    // Mostrar primera notificaciÃ³n despuÃ©s de 30 segundos
    setTimeout(() => {
        mostrarNotificacionAyuda();
    }, 30000);

    // Luego cada 2-3 minutos aleatoriamente
    ayudaNotificationInterval = setInterval(() => {
        // Probabilidad del 60% de mostrar la notificaciÃ³n
        if (Math.random() < 0.6) {
            mostrarNotificacionAyuda();
        }
    }, 120000 + Math.random() * 60000); // Entre 2 y 3 minutos
}

// Cerrar dropdown de redes sociales al hacer clic fuera
function closeMobileSocial() {
    const toggle = document.querySelector('.mobile-social-toggle');
    const dropdown = document.getElementById('mobile-social-dropdown');
    
    if (toggle && dropdown) {
        toggle.classList.remove('active');
        dropdown.classList.remove('show');
    }
}

// Cerrar menÃºs si se hace clic fuera del contenido
document.addEventListener('click', function(e) {
    // MenÃº de categorÃ­as
    const menu = document.getElementById('mobile-category-menu');
    const hamburger = document.querySelector('.mobile-category-hamburger');
    const menuContent = document.querySelector('.mobile-category-menu-content');

    if (menu && menu.classList.contains('show')) {
        if (!menuContent.contains(e.target) && !hamburger.contains(e.target)) {
            closeMobileCategoryMenu();
        }
    }
    
    // Dropdown de redes sociales
    const socialToggle = document.querySelector('.mobile-social-toggle');
    const socialDropdown = document.getElementById('mobile-social-dropdown');
    
    if (socialDropdown && socialDropdown.classList.contains('show')) {
        if (!socialToggle.contains(e.target) && !socialDropdown.contains(e.target)) {
            closeMobileSocial();
        }
    }
});

// FunciÃ³n para filtrar productos por categorÃ­a
function filtrarProductos(categoria, element) {
    // Si ya estamos en la misma categorÃ­a y no hay elemento especÃ­fico, no hacer nada
    if (filtroActual === categoria && !element) {
        return;
    }

    filtroActual = categoria;

    // Actualizar URL con la categorÃ­a seleccionada
    window.history.replaceState({}, '', `#${categoria}`);

    // Si no estamos en la pestaÃ±a de catÃ¡logo, cambiar a ella primero
    const catalogoSection = document.getElementById('catalogo');
    if (!catalogoSection || !catalogoSection.classList.contains('active')) {
        // Asegurar que el botÃ³n de catÃ¡logo estÃ© activo
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.nav-btn[onclick*="catalogo"]').forEach(btn => {
            btn.classList.add('active');
        });

        // Mostrar secciÃ³n catÃ¡logo
        document.querySelectorAll('.tab-section').forEach(section => {
            section.classList.remove('active');
        });
        catalogoSection.classList.add('active');
    }

    // Actualizar categorÃ­as del header (desktop)
    document.querySelectorAll('.desktop-category-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Actualizar items mÃ³viles activos
    document.querySelectorAll('.mobile-category-item').forEach(item => {
        item.classList.remove('active');
    });

    // Activar pestaÃ±a/item seleccionado
    if (element) {
        element.classList.add('active');
    } else {
        // Si no se pasÃ³ un elemento especÃ­fico, activar el botÃ³n correspondiente a la categorÃ­a
        const btnDesktop = document.querySelector(`.desktop-category-btn[onclick*="${categoria}"]`);
        if (btnDesktop) {
            btnDesktop.classList.add('active');
        }

        const btnMobile = document.querySelector(`.mobile-category-item[onclick*="${categoria}"]`);
        if (btnMobile) {
            btnMobile.classList.add('active');
        }
    }

    // Mostrar productos filtrados
    mostrarProductos();
}

// Mostrar productos en el catÃ¡logo
function mostrarProductos() {
    const grid = document.getElementById('productos-grid');
    grid.className = 'product-grid';

    if (!productos || productos.length === 0) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        return;
    }

    // Mostrar el grid cuando hay productos
    grid.style.display = 'grid';
    grid.style.opacity = '1';

    // Si es la categorÃ­a "todos", mostrar carrusel horizontal de juegos
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

            // Calcular precio mÃ­nimo y mÃ¡ximo
            let precioMinimo = 0;
            let precioMaximo = 0;
            if (juego.paquetes && Array.isArray(juego.paquetes) && juego.paquetes.length > 0) {
                const precios = juego.paquetes.map(p => parseFloat(p.precio) || 0);
                precioMinimo = Math.min(...precios);
                precioMaximo = Math.max(...precios);
            }

            // Mostrar solo precio inicial con "Desde"
            let rangoPrecio = '';
            if (monedaActual === 'VES') {
                rangoPrecio = `Desde ${convertirPrecio(precioMinimo)}`;
            } else {
                rangoPrecio = `Desde $${precioMinimo.toFixed(2)}`;
            }

            // Procesar etiquetas del juego
            let etiquetasHtml = '';
            if (juego.etiquetas && juego.etiquetas.trim()) {
                const etiquetasArray = juego.etiquetas.split(',').map(e => e.trim()).filter(e => e);
                etiquetasHtml = etiquetasArray.map(etiqueta => {
                    let clase = 'default';
                    if (etiqueta.includes('%') || etiqueta.toLowerCase().includes('descuento') || etiqueta.toLowerCase().includes('oferta')) {
                        clase = 'descuento';
                    } else if (etiqueta.toLowerCase().includes('hot')) {
                        clase = 'hot';
                    } else if (etiqueta.toLowerCase().includes('nuevo')) {
                        clase = 'nuevo';
                    } else if (etiqueta.toLowerCase().includes('popular')) {
                        clase = 'popular';
                    }
                    return `<span class="product-tag ${clase}">${etiqueta}</span>`;
                }).join('');
            }

            cardsHtml += `
                <div class="todos-carousel-card" onclick="verDetalleProducto(${juego.id})">
                    ${etiquetasHtml ? `<div class="product-tags">${etiquetasHtml}</div>` : ''}
                    <img src="${imagenUrl}" alt="${juego.nombre || 'Producto'}" class="product-image" onerror="this.src='/static/images/20250706_020025_20250705_163435_Recurso-40.png'; this.onerror=null;">
                    <div class="product-name">${juego.nombre || 'Producto sin nombre'}</div>
                    ${mostrarValoracionEnTarjeta(juego)}
                    <div class="price-desde">${rangoPrecio}</div>
                </div>
            `;
        });

        // Mostrar todas las tarjetas tanto en mÃ³vil como en desktop
        const esMobil = window.innerWidth <= 768;
        const juegosParaMostrar = juegos; // Mostrar todos los juegos
        // Poblar gift cards disponibles desde la lista completa de productos
        const giftCardsParaMostrar = (Array.isArray(productos) ? productos : []).filter(p => p && p.categoria === 'gift-cards');

        // Regenerar HTML con todas las tarjetas
        let cardsHtmlLimitado = '';
        juegosParaMostrar.forEach(juego => {
            // Corregir ruta de imagen
            let imagenUrl = juego.imagen || '';
            if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
                imagenUrl = `/static/${imagenUrl}`;
            }
            if (!imagenUrl) {
                imagenUrl = 'https://via.placeholder.com/300x200/007bff/ffffff?text=Producto';
            }

            // Calcular precio mÃ­nimo y mÃ¡ximo
            let precioMinimo = 0;
            let precioMaximo = 0;
            if (juego.paquetes && Array.isArray(juego.paquetes) && juego.paquetes.length > 0) {
                const precios = juego.paquetes.map(p => parseFloat(p.precio) || 0);
                precioMinimo = Math.min(...precios);
                precioMaximo = Math.max(...precios);
            }

            // Mostrar solo precio inicial con "Desde"
            let rangoPrecio = '';
            if (monedaActual === 'VES') {
                rangoPrecio = `Desde Bs. ${(precioMinimo * tasaUSDVES).toFixed(2)}`;
            } else {
                rangoPrecio = `Desde $${precioMinimo.toFixed(2)}`;
            }

            // Procesar etiquetas del juego
            let etiquetasHtml = '';
            if (juego.etiquetas && juego.etiquetas.trim()) {
                const etiquetasArray = juego.etiquetas.split(',').map(e => e.trim()).filter(e => e);
                etiquetasHtml = etiquetasArray.map(etiqueta => {
                    let clase = 'default';
                    if (etiqueta.includes('%') || etiqueta.toLowerCase().includes('descuento') || etiqueta.toLowerCase().includes('oferta')) {
                        clase = 'descuento';
                    } else if (etiqueta.toLowerCase().includes('hot')) {
                        clase = 'hot';
                    } else if (etiqueta.toLowerCase().includes('nuevo')) {
                        clase = 'nuevo';
                    } else if (etiqueta.toLowerCase().includes('popular')) {
                        clase = 'popular';
                    }
                    return `<span class="product-tag ${clase}">${etiqueta}</span>`;
                }).join('');
            }

            cardsHtmlLimitado += `
                <div class="todos-carousel-card" onclick="verDetalleProducto(${juego.id})">
                    ${etiquetasHtml ? `<div class="product-tags">${etiquetasHtml}</div>` : ''}
                    <img src="${imagenUrl}" alt="${juego.nombre || 'Producto'}" class="product-image" onerror="this.src='/static/images/20250706_020025_20250705_163435_Recurso-40.png'; this.onerror=null;">
                    <div class="product-name">${juego.nombre || 'Producto sin nombre'}</div>
                    ${mostrarValoracionEnTarjeta(juego)}
                    <div class="price-desde">${rangoPrecio}</div>
                </div>
            `;
        });

        let giftCardsHtmlLimitado = '';
        if (giftCardsParaMostrar.length > 0) {
            giftCardsParaMostrar.forEach(giftCard => {
                // Corregir ruta de imagen
                let imagenUrl = giftCard.imagen || '';
                if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
                    imagenUrl = `/static/${imagenUrl}`;
                }
                if (!imagenUrl) {
                    imagenUrl = 'https://via.placeholder.com/300x200/007bff/ffffff?text=Producto';
                }

                // Calcular precio mÃ­nimo y mÃ¡ximo
                let precioMinimo = 0;
                let precioMaximo = 0;
                if (giftCard.paquetes && Array.isArray(giftCard.paquetes) && giftCard.paquetes.length > 0) {
                    const precios = giftCard.paquetes.map(p => parseFloat(p.precio) || 0);
                    precioMinimo = Math.min(...precios);
                    precioMaximo = Math.max(...precios);
                }

                // Mostrar solo precio inicial con "Desde"
                let rangoPrecio = '';
                if (monedaActual === 'VES') {
                    rangoPrecio = `Desde ${convertirPrecio(precioMinimo)}`;
                } else {
                    rangoPrecio = `Desde $${precioMinimo.toFixed(2)}`;
                }

                // Procesar etiquetas para gift cards
                let etiquetasHtml = '';
                if (giftCard.etiquetas && giftCard.etiquetas.trim()) {
                    const etiquetasArray = giftCard.etiquetas.split(',').map(e => e.trim()).filter(e => e);
                    etiquetasHtml = etiquetasArray.map(etiqueta => {
                        const clase = etiqueta.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return `<span class="product-tag ${clase}">${etiqueta}</span>`;
                    }).join('');
                }

                giftCardsHtmlLimitado += `
                    <div class="todos-carousel-card" onclick="verDetalleProducto(${giftCard.id})">
                        ${etiquetasHtml ? `<div class="product-tags">${etiquetasHtml}</div>` : ''}
                        <img src="${imagenUrl}" alt="${giftCard.nombre || 'Producto'}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200/007bff/ffffff?text=Producto'">
                        <div class="product-name">${giftCard.nombre || 'Producto sin nombre'}</div>
                        ${mostrarValoracionEnTarjeta(giftCard)}
                        <div class="price-desde">${rangoPrecio}</div>
                    </div>
                `;
            });
        }

        grid.innerHTML = `
            <div class="section-header">
                <h3 class="section-title">Recarga de juegos</h3>
                ${juegos.length > 2 ? `<button class="section-more-btn" onclick="mostrarTodosLosJuegos()">Ver más</button>` : ''}
            </div>
            <div class="todos-carousel-wrapper">
                <div class="todos-carousel-track" id="todos-carousel-track">
                    ${cardsHtmlLimitado}
                </div>
                ${!esMobil && juegos.length > 2 ? `
                    <button class="todos-carousel-nav prev" onclick="moverCarruselTodos(-1)">‹</button>
                    <button class="todos-carousel-nav next" onclick="moverCarruselTodos(1)">›</button>
                ` : ''}
            </div>

            ${giftCardsHtmlLimitado ? `
            <div class="section-header" style="margin-top: 40px;">
                <h3 class="section-title">Gift Cards</h3>
                ${giftCardsParaMostrar.length > 2 ? `<button class="section-more-btn" onclick="mostrarTodasLasGiftCards()">Ver más</button>` : ''}
            </div>
            <div class="todos-carousel-wrapper">
                <div class="todos-carousel-track" id="giftcards-todos-carousel-track">
                    ${giftCardsHtmlLimitado}
                </div>
                ${!esMobil && giftCardsParaMostrar.length > 2 ? `
                    <button class="todos-carousel-nav prev" onclick="moverCarruselGiftCardsTodos(-1)">‹</button>
                    <button class="todos-carousel-nav next" onclick="moverCarruselGiftCardsTodos(1)">›</button>
                ` : ''}
            </div>
            ` : ''}
        `;

        // Inicializar Ã­ndice del carrusel solo en desktop
        if (!esMobil) {
            window.todosCarouselIndex = 0;
            window.todosCarouselItems = juegos;

            // Inicializar eventos tÃ¡ctiles despuÃ©s de crear el HTML
            setTimeout(() => {
                inicializarSwipeCarruseles();
            }, 100);
        }

        return;
    }

    // Filtrar productos segÃºn la categorÃ­a seleccionada
    let productosFiltrados = productos;
    if (filtroActual === 'gift-cards') {
        productosFiltrados = productos.filter(producto => {
            console.log('ðŸ” Producto:', producto.nombre, 'CategorÃ­a:', producto.categoria);
            return producto.categoria === 'gift-cards';
        });
        console.log('ðŸŽ Gift Cards filtradas:', productosFiltrados.length);
    } else if (filtroActual === 'juegos') {
        productosFiltrados = productos.filter(producto => {
            return producto.categoria === 'juegos' || !producto.categoria || producto.categoria === '';
        });
        console.log('ðŸŽ® Juegos filtrados:', productosFiltrados.length);
    }
    
    console.log('ðŸ“Š Total productos filtrados:', productosFiltrados.length, 'para categorÃ­a:', filtroActual);

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

        // Calcular precio mÃ­nimo y mÃ¡ximo
        let precioMinimo = 0;
        let precioMaximo = 0;
        if (producto.paquetes && Array.isArray(producto.paquetes) && producto.paquetes.length > 0) {
            const precios = producto.paquetes.map(p => parseFloat(p.precio) || 0);
            precioMinimo = Math.min(...precios);
            precioMaximo = Math.max(...precios);
        }

        // Mostrar solo precio inicial con "Desde"
        let rangoPrecio = '';
        if (monedaActual === 'VES') {
            rangoPrecio = `Desde ${convertirPrecio(precioMinimo)}`;
        } else {
            rangoPrecio = `Desde $${precioMinimo.toFixed(2)}`;
        }

        // Procesando etiquetas
        let etiquetasHtml = '';
        if (producto.etiquetas && producto.etiquetas.trim()) {
            const etiquetasArray = producto.etiquetas.split(',').map(e => e.trim()).filter(e => e);
            etiquetasHtml = etiquetasArray.map(etiqueta => {
                let clase = 'default';
                if (etiqueta.includes('%') || etiqueta.toLowerCase().includes('descuento') || etiqueta.toLowerCase().includes('oferta')) {
                    clase = 'descuento';
                } else if (etiqueta.toLowerCase().includes('hot')) {
                    clase = 'hot';
                } else if (etiqueta.toLowerCase().includes('nuevo')) {
                    clase = 'nuevo';
                } else if (etiqueta.toLowerCase().includes('popular')) {
                    clase = 'popular';
                }
                return `<span class="product-tag ${clase}">${etiqueta}</span>`;
            }).join('');
        }

        // No mostrar preview de paquetes en el grid de productos
        let paquetesPreviewHtml = '';

        html += `
            <div class="product-card" onclick="verDetalleProducto(${producto.id})">
                ${etiquetasHtml ? `<div class="product-tags">${etiquetasHtml}</div>` : ''}
                <img src="${imagenUrl}" alt="${producto.nombre || 'Producto'}" class="product-image" onerror="this.src='/static/images/20250706_020025_20250705_163435_Recurso-40.png'; this.onerror=null;">
                <div class="product-name">${producto.nombre || 'Producto sin nombre'}</div>
                <div class="product-description">${producto.descripcion || 'Sin descripciÃ³n'}</div>
                ${paquetesPreviewHtml}
                ${mostrarValoracionEnTarjeta(producto)}
                <div class="price-desde">${rangoPrecio}</div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

// FunciÃ³n para mostrar detalles del producto desde la URL (sin redirecciÃ³n)
function mostrarDetalleProductoDesdeURL(producto) {
    // Generar el mismo HTML que verDetalleProducto pero sin cambiar la pestaÃ±a
    const detalleHTML = generarHTMLDetalleProducto(producto);
    document.getElementById('producto-detalle').innerHTML = detalleHTML;

    // Mostrar la pestaÃ±a de detalles
    mostrarTab('detalles');

    // Auto-seleccionar el primer paquete disponible
    setTimeout(() => {
        const primerPaquete = document.querySelector('.pkg-selectable') || document.querySelector('.package-selectable');
        if (primerPaquete) {
            primerPaquete.click();
        }
    }, 100);

    // Cargar valoraciones despuÃ©s de mostrar el producto
    cargarValoracionesProducto(producto.id);
}

// FunciÃ³n para mostrar valoraciones en tarjetas de productos
function mostrarValoracionEnTarjeta(producto) {
    if (!producto.promedio_valoracion || !producto.total_valoraciones) {
        return '';
    }

    const promedio = parseFloat(producto.promedio_valoracion);
    const total = parseInt(producto.total_valoraciones);
    
    if (promedio <= 0 || total <= 0) {
        return '';
    }

    // Generar estrellas
    let estrellasHtml = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= promedio) {
            estrellasHtml += '<span class="star full">★</span>';
        } else if (i - promedio < 1) {
            estrellasHtml += '<span class="star half">★</span>';
        } else {
            estrellasHtml += '<span class="star empty">★</span>';
        }
    }

    return `
        <div class="product-rating">
            <div class="stars-display">
                ${estrellasHtml}
            </div>
            <span class="rating-text">${promedio} (${total})</span>
        </div>
    `;
}

// FunciÃ³n para generar HTML de detalles de producto (reutilizable)
function generarHTMLDetalleProducto(producto) {
    // Corregir ruta de imagen
    let imagenUrl = producto.imagen || '';
    if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
        imagenUrl = `/static/${imagenUrl}`;
    }
    if (!imagenUrl) {
        imagenUrl = 'https://via.placeholder.com/400x300/007bff/ffffff?text=Producto';
    }

    // Determinar si mostrar el formulario de ID segÃºn la categorÃ­a
    const mostrarFormularioId = producto.categoria !== 'gift-cards';

    // Generar HTML para los paquetes (sin iconos, solo tÃ­tulo y precio)
    const LIMITE_INICIAL_PAQUETES = 8;
    let paquetesHtml = '';
    if (producto.paquetes && Array.isArray(producto.paquetes) && producto.paquetes.length > 0) {
        const visibles = producto.paquetes.slice(0, LIMITE_INICIAL_PAQUETES);
        paquetesHtml = producto.paquetes.map(paquete => {
            const precio = parseFloat(paquete.precio) || 0;
            return `
                <div class="pkg-card pkg-selectable" onclick="seleccionarPaquete(this)" 
                     data-package-id="${paquete.id}" 
                     data-package-name="${paquete.nombre}" 
                     data-package-price="${precio}"
                     style="position:relative; background:#1b1b1b; border:2px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px; cursor:pointer; transition:border-color 0.15s ease, box-shadow 0.15s ease; min-height:90px; height:90px; width:160px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; overflow:visible;">
                    <div class="pkg-title" style="font-weight:700; font-size:14px; color:#ffffff; text-align:center; max-width:90%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; position:relative; z-index:2;">${paquete.nombre}</div>
                    <div class="pkg-price" style="position:relative; z-index:2; font-weight:800; color:#ffffff; background:transparent; border:none; padding:4px 10px; border-radius:10px;">${convertirPrecio(precio)}</div>
                </div>
            `;
        }).join('');
    } else {
        paquetesHtml = '<p style="color: #cccccc; text-align: center; grid-column: 1 / -1;">No hay paquetes disponibles para este producto</p>';
    }

    // Generar valoraciones para mostrar debajo del tÃ­tulo
    let valoracionesDetalleHtml = '';
    if (producto.promedio_valoracion && producto.total_valoraciones) {
        const promedio = parseFloat(producto.promedio_valoracion);
        const total = parseInt(producto.total_valoraciones);
        
        if (promedio > 0 && total > 0) {
            let estrellasHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= promedio) {
                    estrellasHtml += '<span class="star full">★</span>';
                } else if (i - promedio < 1) {
                    estrellasHtml += '<span class="star half">★</span>';
                } else {
                    estrellasHtml += '<span class="star empty">★</span>';
                }
            }

            valoracionesDetalleHtml = `
                <div class="product-rating" onclick="mostrarTabReview('valoraciones', ${producto.id})" style="cursor: pointer; transition: all 0.3s ease; padding: 8px; border-radius: 8px; margin: 10px 0;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    <div class="stars-display">
                        ${estrellasHtml}
                    </div>
                    <span class="rating-text">${promedio} (${total} reseñas) - Haz clic para ver</span>
                </div>
            `;
        }
    }

    return `
        <div class="details-panel" style="margin-top: 15px;">
            <div class="details-container" style="display: flex; gap: 20px; margin-bottom: 20px; align-items: flex-start;">
                <div class="details-image-container" style="flex: 0 0 400px;">
                    <img src="${imagenUrl}" alt="${producto.nombre || 'Producto'}" class="selected-product-image" style="width: 100%; height: 300px; object-fit: cover; border-radius: 12px;" onerror="this.src='https://via.placeholder.com/400x300/007bff/ffffff?text=Producto'">

                    <!-- TÃ­tulo del juego debajo de la imagen -->
                    <h1 style="color: #ffffff; font-size: 28px; margin: 15px 0 8px 0; font-weight: 700; text-align: center;">${producto.nombre || 'Producto'}</h1>

                    <!-- Valoraciones debajo del tÃ­tulo -->
                    ${valoracionesDetalleHtml}

                </div>

                <div class="details-info-container" style="flex: 1;">
                    <div style="background:#1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                        ${mostrarFormularioId ? `
                        <div style="margin-bottom: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 15px;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                                <div style="background:#dc3545; color:#fff; font-weight:800; border-radius:6px; padding:2px 8px;">1</div>
                                <div style="font-weight:700; color:#fff;">Ingresa tus datos</div>
                            </div>
                            <label for="usuario-id-juego" style="display: block; margin-bottom: 6px; font-weight: 600; color: #ffffff; font-size: 14px;">ID de Usuario en el Juego:</label>
                            <input type="text" id="usuario-id-juego" class="form-control" placeholder="Ingresa tu ID de usuario" style="width: 100%; padding: 12px 15px; border: 2px solid rgba(255,255,255,0.1); border-radius: 10px; font-size: 14px; background: rgba(255,255,255,0.05); color: #ffffff; transition: all 0.3s ease; backdrop-filter: blur(10px);" required>
                        </div>
                        ` : ''}

                        <div style="margin: 10px 0 8px 0; display:flex; align-items:center; gap:8px;">
                            <div style="background:#dc3545; color:#fff; font-weight:800; border-radius:6px; padding:2px 8px;">2</div>
                            <div style="font-weight:700; color:#fff;">Selecciona tu producto</div>
                        </div>

                        <div id="package-list-${producto.id}" data-expanded="false" class="pkg-grid">
                            ${paquetesHtml}
                        </div>

                        ${producto.paquetes && producto.paquetes.length > LIMITE_INICIAL_PAQUETES ? `
                        <div style="text-align:center; margin-top:10px;">
                            <button id="btn-mostrar-mas-${producto.id}" class="btn btn-warning" style="padding:8px 16px; font-weight:700; border-radius:8px;" onclick="toggleMostrarMasPaquetes(${producto.id})">Mostrar más</button>
                        </div>
                        ` : ''}

                        <div style="margin-top: 16px;">
                            <button id="btn-agregar-carrito" onclick="agregarPaqueteSeleccionado()" class="btn btn-success" style="width: 100%; padding: 15px 20px; font-size: 16px; font-weight: 700; background: linear-gradient(135deg, #dc3545, #c82333); border: none; border-radius: 10px; color: white; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(220, 53, 69, 0.3); opacity: 0.6;" disabled>
                                🛒 Agregar al Carrito
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sistema de PestaÃ±as para DescripciÃ³n y Valoraciones -->
            <div class="reviews-section" style="margin-top: 25px;">
                <!-- Pestañas de navegación -->
                <div class="review-tabs">
                    <button class="review-tab active" onclick="mostrarTabReview('descripcion', ${producto.id})">
                        📋 Descripción
                    </button>
                    <button class="review-tab" onclick="mostrarTabReview('valoraciones', ${producto.id})">
                        ⭐ Valoraciones
                    </button>
                </div>

                <!-- Contenido de la pestaña Descripción -->
                <div id="descripcion-tab-${producto.id}" class="review-tab-content active">
                    <div style="padding: 20px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                        <h4 style="color: #ffffff; margin-bottom: 15px; font-size: 18px;">📝 Descripción del Producto</h4>
                        <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-line; word-wrap: break-word;">
                            ${producto.descripcion || 'Este producto no tiene descripción disponible.'}
                        </p>
                    </div>
                </div>

                <!-- Contenido de la pestaña Valoraciones -->
                <div id="valoraciones-tab-${producto.id}" class="review-tab-content">
                    <div class="reviews-header">
                        <h3 class="reviews-title">⭐ Valoraciones y Reseñas</h3>
                        <div class="reviews-stats" id="reviews-stats-${producto.id}">
                            <!-- Las estadÃ­sticas se cargarÃ¡n dinÃ¡micamente -->
                        </div>
                    </div>

                    <!-- Formulario de valoraciÃ³n o mensaje de login -->
                    <div id="rating-form-container-${producto.id}">
                        <!-- Se cargarÃ¡ dinÃ¡micamente segÃºn el estado de sesiÃ³n -->
                    </div>

                    <!-- Lista de valoraciones -->
                    <div class="reviews-list" id="reviews-list-${producto.id}">
                        <div style="text-align: center; padding: 20px; color: #999;">
                            <div style="font-size: 18px; margin-bottom: 10px;">⏳</div>
                            <p>Cargando valoraciones...</p>
                        </div>
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

    // Usar la funciÃ³n reutilizable para generar el HTML
    const html = generarHTMLDetalleProducto(producto);
    document.getElementById('producto-detalle').innerHTML = html;
    mostrarTab('detalles');

    // Auto-seleccionar el primer paquete disponible
    setTimeout(() => {
        const primerPaquete = document.querySelector('.package-selectable');
        if (primerPaquete) {
            primerPaquete.click();
        }
    }, 100);

    // Cargar valoraciones despuÃ©s de mostrar el producto
    cargarValoracionesProducto(producto.id);

    // Actualizar botÃ³n activo manualmente
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
}

// Convertir precio segÃºn moneda seleccionada (siempre usa tasa tiempo real)
function convertirPrecio(precioUSD) {
    const precio = parseFloat(precioUSD) || 0;
    
    if (monedaActual === 'VES') {
        // SIEMPRE usar la tasa de la configuraciÃ³n como fuente principal
        let tasaActual = 142; // Valor por defecto
        
        if (configuracion && configuracion.tasa_usd_ves) {
            const tasaConfig = parseFloat(configuracion.tasa_usd_ves);
            if (tasaConfig > 0) {
                tasaActual = tasaConfig;
                console.log(`Usando tasa de configuración: ${tasaActual}`);
            }
        } else if (tasaUSDVES && tasaUSDVES > 0) {
            tasaActual = tasaUSDVES;
            console.log(`Usando tasa global: ${tasaActual}`);
        }
        
        const precioVESNum = Math.round(precio * tasaActual);
        const precioVES = new Intl.NumberFormat('es-VE').format(precioVESNum);
        console.log(`Conversion FINAL: $${precio} USD x ${tasaActual} = Bs. ${precioVES} VES (redondeado)`);
        return `Bs. ${precioVES}`;
    }
    return `$${precio.toFixed(2)}`;
}

// Variables para el paquete seleccionado
let paqueteSeleccionado = null;

// FunciÃ³n para seleccionar un paquete
function seleccionarPaquete(elemento) {
    // Remover selecciÃ³n anterior
    document.querySelectorAll('.pkg-selectable, .package-selectable').forEach(pkg => {
        pkg.classList.remove('selected');
        // Resetear estilos compactos base
        pkg.style.background = '#1b1b1b';
        pkg.style.borderColor = 'rgba(255,255,255,0.08)';
        pkg.style.transform = '';
        pkg.style.boxShadow = '';
        pkg.style.outline = '';
        pkg.style.outlineOffset = '';
        // No modificar alturas para no encoger las tarjetas
        pkg.style.minHeight = '';
        pkg.style.height = '';
    });

    // Seleccionar el paquete actual
    elemento.classList.add('selected');
    // Estilos seleccionados (rojo, MUY visible)
    elemento.style.background = '#1b1b1b';
    elemento.style.borderColor = '#dc3545';
    elemento.style.borderWidth = '2px';
    elemento.style.transform = '';
    elemento.style.boxShadow = '0 6px 20px rgba(220,53,69,0.25)';
    elemento.style.outline = '3px solid #dc3545';
    elemento.style.outlineOffset = '3px';
    // Mantener altura original de la tarjeta
    elemento.style.minHeight = '';
    elemento.style.height = '';

    // Guardar informaciÃ³n del paquete seleccionado
    paqueteSeleccionado = {
        id: elemento.getAttribute('data-package-id'),
        nombre: elemento.getAttribute('data-package-name'),
        precio: parseFloat(elemento.getAttribute('data-package-price'))
    };

    // Habilitar botÃ³n de agregar al carrito
    const botonAgregar = document.getElementById('btn-agregar-carrito');

    if (botonAgregar) {
        botonAgregar.disabled = false;
        botonAgregar.style.opacity = '1';
        botonAgregar.style.cursor = 'pointer';
    }
}

// FunciÃ³n para agregar el paquete seleccionado al carrito
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
            usuarioIdInput.style.borderColor = '#dc3545';
            usuarioIdInput.style.boxShadow = 'inset 0 2px 8px rgba(220, 53, 69, 0.15)';

            // Quitar el estilo de error despuÃ©s de 3 segundos
            setTimeout(() => {
                usuarioIdInput.style.borderColor = '#dc3545';
                usuarioIdInput.style.boxShadow = 'inset 0 2px 8px rgba(220, 53, 69, 0.15)';
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
        id: Date.now(), // ID Ãºnico para el item del carrito
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
        mostrarAlerta(`🎉 ¡Perfecto! ${paqueteSeleccionado.nombre} se agregó exitosamente a tu carrito. ¡Continúa comprando o procede al pago! 🏷️✨`, 'success');
    }

    guardarCarritoEnStorage();
    actualizarContadorCarrito();

    // Efecto visual en el botÃ³n Ãºnico
    const btnAgregar = document.getElementById('btn-agregar-carrito');
    if (btnAgregar) {
        const originalText = btnAgregar.innerHTML;
        const originalBackground = btnAgregar.style.background;

        btnAgregar.innerHTML = '✅ ¡Agregado al Carrito!';
        btnAgregar.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
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
    const mobileCounter = document.getElementById('cart-count');
    if (mobileCounter) {
        mobileCounter.textContent = total;
    }

    // Actualizar tambiÃ©n el contador desktop
    const desktopCounter = document.getElementById('cart-count-desktop');
    if (desktopCounter) {
        desktopCounter.textContent = total;
    }

    console.log('Actualizando contador del carrito. Total items:', total, 'Carrito:', carrito);

    // Actualizar tooltip del carrito si existe en desktop
    if (window.innerWidth > 768) {
        const tooltip = document.getElementById('cart-tooltip');
        if (!tooltip) {
            // Crear tooltip si no existe
            setTimeout(() => {
                crearTooltipCarrito();
            }, 100);
        } else {
            // Forzar actualizaciÃ³n del contenido
            setTimeout(() => {
                actualizarTooltipCarrito();
            }, 50);
        }
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
    // Convertir itemId a nÃºmero para comparar correctamente
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
        guardarCarritoEnStorage();
        mostrarCarrito();
        actualizarContadorCarrito();

        // Actualizar carrito lateral si estÃ¡ abierto
        const overlay = document.getElementById('mobile-cart-overlay');
        if (overlay && overlay.classList.contains('show')) {
            mostrarCarritoLateral();
        }

        // Mostrar mensaje de actualizaciÃ³n
        if (cambio > 0) {
            mostrarAlerta(`✅ Cantidad aumentada a ${item.cantidad}`, 'success');
        } else {
            mostrarAlerta(`📦 Cantidad reducida a ${item.cantidad}`, 'success');
        }
    }
}

// Eliminar item del carrito
function eliminarDelCarrito(itemId) {
    // Convertir itemId a nÃºmero para comparar correctamente
    const numericItemId = parseInt(itemId);
    const itemAEliminar = carrito.find(item => parseInt(item.id) === numericItemId);

    if (!itemAEliminar) {
        console.log('Item no encontrado para eliminar:', itemId);
        return;
    }

    carrito = carrito.filter(item => parseInt(item.id) !== numericItemId);
    guardarCarritoEnStorage();
    mostrarCarrito();
    actualizarContadorCarrito();

    // Actualizar carrito lateral si estÃ¡ abierto
    const overlay = document.getElementById('mobile-cart-overlay');
    if (overlay && overlay.classList.contains('show')) {
        mostrarCarritoLateral();
    }

    // Mostrar mensaje de confirmaciÃ³n
    mostrarAlerta(`🗑️ ${itemAEliminar.paqueteNombre} eliminado del carrito`, 'success');
}

// Proceder al pago
async function procederAlPago() {
    if (carrito.length === 0) {
        mostrarAlerta('Tu carrito está vacío', 'error');
        return;
    }

    // Verificar si el usuario estÃ¡ logueado antes de proceder al pago
    try {
        const response = await fetch('/usuario');
        if (!response.ok) {
            mostrarAlerta('Debes iniciar sesión para realizar una compra. Ve a la pestaña "Mi Cuenta" para entrar.', 'error');
            mostrarTab('login');
            return;
        }
        // Si estÃ¡ logueado, proceder al pago
        mostrarTab('pago');
    } catch (error) {
        mostrarAlerta('Debes iniciar sesiÃ³n para realizar una compra', 'error');
        mostrarTab('login');
    }
}

// Preparar informaciÃ³n de pago
function prepararPago() {
    // Cargar total del carrito
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    // Mostrar el total en la pÃ¡gina de pago
    mostrarTotalPago(total);

    // Actualizar mÃ©todos de pago segÃºn la moneda
    actualizarMetodosPagoSegunMoneda();

    // Auto-seleccionar mÃ©todo de pago segÃºn la moneda despuÃ©s de un pequeÃ±o delay
    setTimeout(() => {
        if (monedaActual === 'VES') {
            seleccionarMetodoPago('Pago Móvil');
        } else if (monedaActual === 'USD') {
            seleccionarMetodoPago('Binance');
        }
    }, 100);

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

// FunciÃ³n para actualizar mÃ©todos de pago segÃºn la moneda seleccionada
function actualizarMetodosPagoSegunMoneda() {
    const btnPagoMovil = document.getElementById('btn-pago-movil');
    const btnBinance = document.getElementById('btn-binance');
    const infoPago = document.getElementById('info-pago');
    const metodoPagoInput = document.getElementById('metodo-pago');

    // Limpiar selecciÃ³n anterior
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
        // Auto-seleccionar Pago Móvil si estamos en la página de pago
        const pagoSection = document.getElementById('pago');
        if (pagoSection && pagoSection.classList.contains('active')) {
            setTimeout(() => seleccionarMetodoPago('Pago Móvil'), 50);
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
        // Auto-seleccionar Binance si estamos en la pÃ¡gina de pago
        const pagoSection = document.getElementById('pago');
        if (pagoSection && pagoSection.classList.contains('active')) {
            setTimeout(() => seleccionarMetodoPago('Binance'), 50);
        }
    }
}

// Variables globales para el temporizador
let timerInterval = null;
let tiempoRestante = 50 * 60; // 50 minutos en segundos

// FunciÃ³n para seleccionar mÃ©todo de pago
function seleccionarMetodoPago(metodo) {
    // Remover selecciÃ³n anterior
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Seleccionar botón actual
    const btnId = metodo === 'Pago Móvil' ? 'btn-pago-movil' : 'btn-binance';
    document.getElementById(btnId).classList.add('selected');

    // Actualizar campo oculto
    document.getElementById('metodo-pago').value = metodo;

    // Mostrar informaciÃ³n del mÃ©todo de pago
    const infoPago = document.getElementById('info-pago');

    if (metodo === 'Pago Móvil') {
        // Procesar datos de pago móvil
        const pagoMovilData = configuracion.pago_movil || 'Información no disponible';
        const lineasPagoMovil = pagoMovilData.split('\n');

        let banco = 'No especificado';
        let telefono = 'No especificado';
        let cedula = 'No especificado';
        let nombre = 'No especificado';

        // Extraer informaciÃ³n de cada lÃ­nea
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
            <h4 style="color:#ffffff;">Datos para Pago Móvil:</h4>
            <p><strong>Banco:</strong> ${banco}</p>
            <p><strong>Teléfono:</strong> ${telefono}</p>
            <p><strong>Cédula:</strong> ${cedula}</p>
            <p><strong>Nombre:</strong> ${nombre}</p>
            <p style="margin-top: 15px; color: #ffffff; font-weight: 600;">
                Realiza el pago y coloca la referencia en el campo de abajo
            </p>
        `;
        infoPago.style.display = 'block';
        
        // Iniciar temporizador
        iniciarTemporizadorPago();
    } else if (metodo === 'Binance') {
        // Procesar datos de Binance```javascript
        const binanceData = configuracion.binance || 'InformaciÃ³n no disponible';
        const lineasBinance = binanceData.split('\n');

        let email = 'No especificado';
        let idBinance = 'No especificado';

        // Extraer informaciÃ³n de cada lÃ­nea
        lineasBinance.forEach(linea => {
            if (linea.includes('Email:')) {
                email = linea.replace('Email:', '').trim();
            } else if (linea.includes('ID Binance:')) {
                idBinance = linea.replace('ID Binance:', '').trim();
            }
        });

        infoPago.innerHTML = `
            <h4 style="color:#ffffff;">Datos para Binance:</h4>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>ID Binance:</strong> ${idBinance}</p>
            <p style="margin-top: 15px; color: #ffffff; font-weight: 600;">
                <span style="color: #ffffff;">Realiza la transferencia y coloca el ID de transacción en el campo de abajo</span>
            </p>
        `;
        infoPago.style.display = 'block';
        
        // Iniciar temporizador
        iniciarTemporizadorPago();
    }
}

// Mostrar total del pago
function mostrarTotalPago(total) {
    const totalPagoElement = document.getElementById('total-pago');
    if (totalPagoElement) {
        totalPagoElement.textContent = `Total a pagar: ${convertirPrecio(total)}`;
    }
}

// Actualizar precios en la pÃ¡gina de detalles cuando cambia la moneda
function actualizarPreciosDetalles() {
    if (!productoSeleccionado) return;

    // Actualizar precios de los paquetes
    const packageItems = document.querySelectorAll('.pkg-card, .package-item');
    packageItems.forEach((item, index) => {
        if (productoSeleccionado.paquetes && productoSeleccionado.paquetes[index]) {
            const paquete = productoSeleccionado.paquetes[index];
            const priceElement = item.querySelector('.pkg-price, .package-price');
            if (priceElement) {
                priceElement.textContent = convertirPrecio(parseFloat(paquete.precio) || 0);
            }
        }
    });

    // La informaciÃ³n del paquete seleccionado ya no se muestra
}

// FunciÃ³n de verificaciÃ³n de cÃ¡lculos
function verificarCalculos() {
    console.log('🔍 VERIFICACIÓN DE CÁLCULOS:');
    console.log('- Moneda actual:', monedaActual);
    console.log('- Tasa global tasaUSDVES:', tasaUSDVES);
    console.log('- Tasa en configuraciÃ³n:', configuracion?.tasa_usd_ves);
    
    // Prueba con 10 USD
    const resultadoPrueba = convertirPrecio(10);
    console.log('- Resultado de 10 USD:', resultadoPrueba);
    
    // CÃ¡lculo manual para verificar
    const tasaParaCalculo = configuracion?.tasa_usd_ves ? parseFloat(configuracion.tasa_usd_ves) : tasaUSDVES;
    const calculoManual = (10 * tasaParaCalculo).toFixed(2);
    console.log('- CÃ¡lculo manual 10 USD Ã— ' + tasaParaCalculo + ':', calculoManual);
}



// Inicializar eventos
function inicializarEventos() {
    
    // Selector de moneda
    document.getElementById('selector-moneda').addEventListener('change', function() {
        monedaActual = this.value;
        
        console.log('Moneda cambiada a:', monedaActual, 'Usando tasa de configuraciÃ³n:', configuracion.tasa_usd_ves);
        
        // Forzar actualizaciÃ³n inmediata de la vista
        setTimeout(() => {
            mostrarProductos();
            mostrarCarrito();

            // Actualizar precios en pÃ¡gina de detalles si estÃ¡ visible
            const detallesSection = document.getElementById('detalles');
            if (detallesSection && detallesSection.classList.contains('active') && productoSeleccionado) {
                actualizarPreciosDetalles();
            }

            // Actualizar total en la pÃ¡gina de pago si estÃ¡ visible
            const pagoSection = document.getElementById('pago');
            if (pagoSection && pagoSection.classList.contains('active')) {
                const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
                mostrarTotalPago(total);
                // Actualizar mÃ©todos de pago segÃºn la nueva moneda
                actualizarMetodosPagoSegunMoneda();
            }

            // Actualizar tooltip del carrito si existe
            if (window.innerWidth > 768) {
                actualizarTooltipCarrito();
            }
        }, 50);

        const tasaActual = configuracion && configuracion.tasa_usd_ves ? configuracion.tasa_usd_ves : tasaUSDVES;
        mostrarAlerta(`💱 Moneda cambiada a ${monedaActual} (Tasa: ${tasaActual})`, 'success');
    });

    // Event listener para el checkbox de tÃ©rminos y condiciones
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
        mostrarMensajePago('â³ Procesando tu pago, por favor espera...', 'loading');

        // Deshabilitar botÃ³n mientras procesa
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
        }

        // Verificar si el usuario estÃ¡ logueado
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
                    mostrarMensajePago('Tu sesiÃ³n ha expirado. Por favor inicia sesiÃ³n nuevamente.', 'error');
                    setTimeout(() => mostrarTab('login'), 2000);
                    return;
                }

                throw new Error(errorMessage);
            }
        }

        // Detener temporizador
        detenerTemporizador();

        // Limpiar carrito y mostrar Ã©xito
        carrito = [];
        limpiarCarritoStorage();
        actualizarContadorCarrito();
        document.getElementById('form-pago').reset();

        // Mostrar mensaje de Ã©xito con duraciÃ³n extendida
        mostrarMensajePago('âœ… Â¡Pago procesado exitosamente! Te contactaremos pronto para confirmar tu pedido.', 'success');

        // Redirigir al catÃ¡logo despuÃ©s de unos segundos
        setTimeout(() => {
            mostrarTab('catalogo');
        }, 6000);

    } catch (error) {
        console.error('Error al procesar pago:', error);
        mostrarMensajePago(`âŒ Error al procesar el pago: ${error.message || 'Error desconocido'}`, 'error');
    } finally {
        // Reactivar botÃ³n
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    }
}

// FunciÃ³n para mostrar mensajes de pago debajo del botÃ³n
function mostrarMensajePago(mensaje, tipo) {
    const mensajePago = document.getElementById('mensaje-pago');

    if (!mensajePago) return;

    mensajePago.innerHTML = mensaje;
    mensajePago.className = `payment-message ${tipo}`;
    mensajePago.style.display = 'block';

    // Auto-ocultar mensajes de error despuÃ©s de 5 segundos
    // Los mensajes de Ã©xito se mantienen visibles hasta la redirecciÃ³n
    if (tipo === 'error') {
        setTimeout(() => {
            mensajePago.style.display = 'none';
        }, 5000);
    }
}

// Procesar login con Google
function loginConGoogle() {
    window.location.href = '/auth/google';
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
            mostrarAlerta('SesiÃ³n iniciada correctamente');
            const formElement = document.getElementById('form-login');
            if (formElement) {
                formElement.reset();
            }
            // Actualizar interfaz para usuario logueado
            actualizarInterfazUsuario(data.usuario);
        } else {
            mostrarAlerta(data.error || 'Error al iniciar sesiÃ³n', 'error');
        }
    } catch (error) {
        console.error('Error al iniciar sesiÃ³n:', error);
        mostrarAlerta('Error de conexiÃ³n', 'error');
    }
}

// Procesar registro
async function procesarRegistro() {
    const nombreElement = document.getElementById('registro-nombre');
    const emailElement = document.getElementById('registro-email');
    const telefonoElement = document.getElementById('registro-telefono');
    const passwordElement = document.getElementById('registro-password');

    if (!nombreElement || !emailElement || !telefonoElement || !passwordElement) {
        mostrarAlerta('Error en el formulario de registro', 'error');
        return;
    }

    const nombre = nombreElement.value;
    const email = emailElement.value;
    const telefono = telefonoElement.value;
    const password = passwordElement.value;

    if (!nombre || !email || !telefono || !password) {
        mostrarAlerta('Por favor completa todos los campos', 'error');
        return;
    }

    try {
        const response = await fetch('/registro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nombre, email, telefono, password })
        });

        const data = await response.json();

        if (response.ok) {
            mostrarAlerta('Usuario registrado correctamente');
            const formElement = document.getElementById('form-registro');
            if (formElement) {
                formElement.reset();
            }
            // Cambiar a pestaÃ±a de login
            mostrarAuthTab('login-form');
        } else {
            mostrarAlerta(data.error || 'Error al registrarse', 'error');
        }
    } catch (error) {
        console.error('Error al registrarse:', error);
        mostrarAlerta('Error de conexiÃ³n', 'error');
    }
}

// Actualizar interfaz para usuario logueado
function actualizarInterfazUsuario(usuario) {
    // Guardar informaciÃ³n del usuario en una variable global para usar en otras partes
    window.session = {
        user_id: usuario.id,
        user_email: usuario.email,
        user_name: usuario.nombre,
        es_admin: usuario.es_admin
    };

    // Asegurar que el elemento existe antes de modificarlo
    const loginSection = document.getElementById('login');
    if (!loginSection) {
        console.error('Elemento login no encontrado');
        return;
    }

    // Crear botÃ³n de administrador si el usuario es admin
    let botonAdminHtml = '';
    if (usuario.es_admin) {
        botonAdminHtml = `
            <button class="account-btn" onclick="window.location.href='/admin'" style="width: 100%; margin-bottom: 15px; background: linear-gradient(135deg, #dc3545, #c82333); color: white; box-shadow: 0 8px 25px rgba(220, 53, 69, 0.3);">
                🛡️ Panel de Administración
            </button>
        `;
    }

    // Cambiar contenido de la pestaÃ±a de cuenta inmediatamente
    loginSection.innerHTML = `
        <div class="auth-section">
            <h2 style="color: #ffffff; text-align: center; font-size: 28px; margin-bottom: 30px;">👤 Mi Cuenta</h2>

            <div class="user-profile-card">
                <h3>🌟 Bienvenido, ${usuario.nombre}</h3>
                <p><strong>Email:</strong> ${usuario.email}</p>
                <p><strong>Miembro desde:</strong> ${new Date(usuario.fecha_registro).toLocaleDateString()}</p>
                ${usuario.es_admin ? '<p style="color: #dc3545; font-weight: 700; margin-top: 10px;">🛡️ Administrador del Sistema</p>' : ''}
            </div>

            <div class="account-actions">
                ${botonAdminHtml}
                <button class="account-btn account-btn-primary" onclick="mostrarHistorialCompras()">
                    &#128203; Ver Historial de Compras
                </button>
                <button class="account-btn account-btn-danger" onclick="cerrarSesion()">
                    🚪 Cerrar Sesión
                </button>
            </div>

            <div id="historial-compras" class="purchase-history" style="display: none;">
                <h3>&#128203; Historial de Compras</h3>
                <div id="lista-compras">
                    <div class="loading">Cargando historial...</div>
                </div>
            </div>
        </div>
    `;

    // Si estamos en la pÃ¡gina de pago, actualizar el email automÃ¡ticamente
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

    console.log('Interfaz de usuario actualizada para:', usuario.nombre, 'Es admin:', usuario.es_admin);
}

// Cerrar sesiÃ³n
async function cerrarSesion() {
    try {
        const response = await fetch('/logout', {
            method: 'POST'
        });

        if (response.ok) {
            // Limpiar informaciÃ³n de sesiÃ³n
            window.session = null;
            mostrarAlerta('SesiÃ³n cerrada correctamente');
            location.reload(); // Recargar pÃ¡gina
        }
    } catch (error) {
        console.error('Error al cerrar sesiÃ³n:', error);
        mostrarAlerta('Error al cerrar sesiÃ³n', 'error');
    }
}

// Variables para paginaciÃ³n del historial
let historialCurrentPage = 1;
let historialItemsPerPage = 5;
let historialTotalItems = 0;
let historialData = [];

// Mostrar historial de compras con paginaciÃ³n
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

        historialData = await response.json();
        historialTotalItems = historialData.length;

        if (historialData.length === 0) {
            listaCompras.innerHTML = `
                <div class="no-purchases">
                    <i>🛒</i>
                    <h3>No tienes compras aún</h3>
                    <p>Cuando realices tu primera compra, aparecerá aquí.</p>
                </div>
            `;
            return;
        }

        // Crear controles de paginaciÃ³n
        const paginationControls = `
            <div class="historial-pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="font-size: 14px; color: #ffffff;">Compras por página:</span>
                    <select id="historial-per-page" onchange="changeHistorialPerPage()" style="padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(255,255,255,0.1); color: #ffffff; font-size: 14px;">
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="20">20</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button id="historial-prev-page" class="btn btn-sm" onclick="previousHistorialPage()" disabled style="padding: 8px 15px; font-size: 12px; background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;">◀ Anterior</button>
                    <span id="historial-page-info" style="margin: 0 10px; font-size: 14px; color: #ffffff;">Página 1 de 1</span>
                    <button id="historial-next-page" class="btn btn-sm" onclick="nextHistorialPage()" disabled style="padding: 8px 15px; font-size: 12px; background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;">Siguiente ▶</button>
                </div>
            </div>
            <div id="historial-items-container">
                <!-- AquÃ­ se cargarÃ¡n las compras paginadas -->
            </div>
        `;

        listaCompras.innerHTML = paginationControls;

        // Cargar la primera pÃ¡gina
        loadHistorialPage();

    } catch (error) {
        console.error('Error al cargar historial:', error);
        listaCompras.innerHTML = '<p style="color: #dc3545;">Error al cargar el historial de compras</p>';
    }
}

// Cargar pÃ¡gina especÃ­fica del historial
function loadHistorialPage() {
    const container = document.getElementById('historial-items-container');
    if (!container) return;

    const startIndex = (historialCurrentPage - 1) * historialItemsPerPage;
    const endIndex = startIndex + historialItemsPerPage;
    const pageItems = historialData.slice(startIndex, endIndex);

    let html = '';
    pageItems.forEach(compra => {
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

        // Verificar si es Gift Card y tiene cÃ³digo
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

    container.innerHTML = html;
    updateHistorialPaginationControls();
}

// Actualizar controles de paginaciÃ³n del historial
function updateHistorialPaginationControls() {
    const totalPages = Math.ceil(historialTotalItems / historialItemsPerPage);
    
    // Actualizar informaciÃ³n de pÃ¡gina
    const pageInfo = document.getElementById('historial-page-info');
    if (pageInfo) {
        pageInfo.textContent = `Página ${historialCurrentPage} de ${totalPages}`;
    }

    // Actualizar botones
    const prevBtn = document.getElementById('historial-prev-page');
    const nextBtn = document.getElementById('historial-next-page');
    
    if (prevBtn) {
        prevBtn.disabled = historialCurrentPage <= 1;
        prevBtn.style.opacity = historialCurrentPage <= 1 ? '0.5' : '1';
    }
    
    if (nextBtn) {
        nextBtn.disabled = historialCurrentPage >= totalPages;
        nextBtn.style.opacity = historialCurrentPage >= totalPages ? '0.5' : '1';
    }

    // Actualizar selector de items por pÃ¡gina
    const perPageSelect = document.getElementById('historial-per-page');
    if (perPageSelect) {
        perPageSelect.value = historialItemsPerPage;
    }
}

// Cambiar nÃºmero de items por pÃ¡gina en el historial
function changeHistorialPerPage() {
    const select = document.getElementById('historial-per-page');
    if (select) {
        historialItemsPerPage = parseInt(select.value);
        historialCurrentPage = 1; // Volver a la primera pÃ¡gina
        loadHistorialPage();
    }
}

// Ir a la pÃ¡gina anterior del historial
function previousHistorialPage() {
    if (historialCurrentPage > 1) {
        historialCurrentPage--;
        loadHistorialPage();
    }
}

// Ir a la siguiente pÃ¡gina del historial
function nextHistorialPage() {
    const totalPages = Math.ceil(historialTotalItems / historialItemsPerPage);
    if (historialCurrentPage < totalPages) {
        historialCurrentPage++;
        loadHistorialPage();
    }
}

// FunciÃ³n para copiar cÃ³digo de Gift Card
function copiarCodigo(codigo) {
    navigator.clipboard.writeText(codigo).then(() => {
        mostrarAlerta('CÃ³digo copiado al portapapeles', 'success');
    }).catch(() => {
        // Fallback para navegadores que no soportan clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = codigo;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        mostrarAlerta('CÃ³digo copiado al portapapeles', 'success');
    });
}

// FunciÃ³n para copiar texto genÃ©rico
function copiarTexto(texto) {
    navigator.clipboard.writeText(texto).then(() => {
        mostrarAlerta('Texto copiado al portapapeles', 'success');
    }).catch(() => {
        // Fallback para navegadores que no soportan clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = texto;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        mostrarAlerta('Texto copiado al portapapeles', 'success');
    });
}

// FunciÃ³n para cambiar entre pestaÃ±as de descripciÃ³n y valoraciones
function mostrarTabReview(tab, productoId) {
    // Remover clase active de todas las pestaÃ±as
    const tabs = document.querySelectorAll('.review-tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    // Ocultar todo el contenido de pestaÃ±as
    const contents = document.querySelectorAll(`#descripcion-tab-${productoId}, #valoraciones-tab-${productoId}`);
    contents.forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
    });
    
    // Activar pestaÃ±a seleccionada
    const selectedTab = document.querySelector(`.review-tab[onclick*="${tab}"][onclick*="${productoId}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Mostrar contenido correspondiente
    const selectedContent = document.getElementById(`${tab}-tab-${productoId}`);
    if (selectedContent) {
        selectedContent.classList.add('active');
        selectedContent.style.display = 'block';
    }
    
    // Si es la pestaÃ±a de valoraciones y aÃºn no se han cargado, cargarlas
    if (tab === 'valoraciones') {
        const reviewsList = document.getElementById(`reviews-list-${productoId}`);
        if (reviewsList && reviewsList.innerHTML.includes('Cargando valoraciones...')) {
            cargarValoracionesProducto(productoId);
        }
    }
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

        // Calcular precio mÃ­nimo y mÃ¡ximo
        let precioMinimo = 0;
        let precioMaximo = 0;
        if (juego.paquetes && Array.isArray(juego.paquetes) && juego.paquetes.length > 0) {
            const precios = juego.paquetes.map(p => parseFloat(p.precio) || 0);
            precioMinimo = Math.min(...precios);
            precioMaximo = Math.max(...precios);
        }

        // Mostrar solo precio inicial con "Desde"
        let rangoPrecio = '';
        if (monedaActual === 'VES') {
            rangoPrecio = `Desde Bs. ${(precioMinimo * tasaUSDVES).toFixed(2)}`;
        } else {
            rangoPrecio = `Desde $${precioMinimo.toFixed(2)}`;
        }

        // Procesar etiquetas del juego
        let etiquetasHtml = '';
        if (juego.etiquetas && juego.etiquetas.trim()) {
            const etiquetasArray = juego.etiquetas.split(',').map(e => e.trim()).filter(e => e);
            etiquetasHtml = etiquetasArray.map(etiqueta => {
                let clase = 'default';
                if (etiqueta.includes('%') || etiqueta.toLowerCase().includes('descuento') || etiqueta.toLowerCase().includes('oferta')) {
                    clase = 'descuento';
                } else if (etiqueta.toLowerCase().includes('hot')) {
                    clase = 'hot';
                } else if (etiqueta.toLowerCase().includes('nuevo')) {
                    clase = 'nuevo';
                } else if (etiqueta.toLowerCase().includes('popular')) {
                    clase = 'popular';
                }
                return `<span class="product-tag ${clase}">${etiqueta}</span>`;
            }).join('');
        }

        cardsHtml += `
            <div class="games-carousel-card" onclick="verDetalleProducto(${juego.id})">
                ${etiquetasHtml ? `<div class="product-tags">${etiquetasHtml}</div>` : ''}
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
                    <button class="games-carousel-nav prev" onclick="moverCarruselJuegos(-1)">â€¹</button>
                    <button class="games-carousel-nav next" onclick="moverCarruselJuegos(1)">â€º</button>
                ` : ''}
            </div>
        </div>
    `;
}

// FunciÃ³n para crear secciÃ³n de Gift Cards
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

        // Calcular precio mÃ­nimo y mÃ¡ximo
        let precioMinimo = 0;
        let precioMaximo = 0;
        if (giftCard.paquetes && Array.isArray(giftCard.paquetes) && giftCard.paquetes.length > 0) {
            const precios = giftCard.paquetes.map(p => parseFloat(p.precio) || 0);
            precioMinimo = Math.min(...precios);
            precioMaximo = Math.max(...precios);
        }

        // Mostrar solo precio inicial con "Desde"
        let rangoPrecio = '';
        if (monedaActual === 'VES') {
            rangoPrecio = `Desde Bs. ${(precioMinimo * tasaUSDVES).toFixed(2)}`;
        } else {
            rangoPrecio = `Desde $${precioMinimo.toFixed(2)}`;
        }

        // Procesar etiquetas de la gift card
        let etiquetasHtml = '';
        if (giftCard.etiquetas && giftCard.etiquetas.trim()) {
            const etiquetasArray = giftCard.etiquetas.split(',').map(e => e.trim()).filter(e => e);
            etiquetasHtml = etiquetasArray.map(etiqueta => {
                const clase = etiqueta.toLowerCase().replace(/[^a-z0-9]/g, '');
                return `<span class="product-tag ${clase}">${etiqueta}</span>`;
            }).join('');
        }

        cardsHtml += `
            <div class="games-carousel-card" onclick="verDetalleProducto(${giftCard.id})">
                ${etiquetasHtml ? `<div class="product-tags">${etiquetasHtml}</div>` : ''}
                <img src="${imagenUrl}" alt="${giftCard.nombre || 'Producto'}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200/007bff/ffffff?text=Producto'">
                <div class="product-name">${giftCard.nombre || 'Producto sin nombre'}</div>
                <div class="price-desde">${rangoPrecio}</div>
            </div>
        `;
    });

    return `
        <div class="section-header">
            <h3 class="section-title">ðŸŽ Gift Cards</h3>
            <button class="section-more-btn" onclick="mostrarTodasLasGiftCards()">Ver Todos</button>
        </div>
        <div class="games-section">
            <div class="games-carousel-container">
                <div class="games-carousel-track" id="giftcards-carousel-track">
                    ${cardsHtml}
                </div>
                ${giftCards.length > 3 ? `
                    <button class="games-carousel-nav prev" onclick="moverCarruselGiftCards(-1)">â€¹</button>
                    <button class="games-carousel-nav next" onclick="moverCarruselGiftCards(1)">â€º</button>
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
    
    // En mÃ³vil, usar todas las tarjetas pero limitar el movimiento
    const totalCards = gamesCarouselItems.length;
    
    // Si hay menos tarjetas que las visibles, no permitir movimiento
    if (totalCards <= visibleCards) {
        gamesCarouselIndex = 0;
        track.style.transform = `translateX(0px)`;
        return;
    }

    gamesCarouselIndex += direccion;

    // Calcular el mÃ¡ximo Ã­ndice sin limitaciÃ³n artificial
    const maxIndex = Math.max(0, totalCards - visibleCards);

    if (gamesCarouselIndex < 0) {
        gamesCarouselIndex = 0;
    }
    if (gamesCarouselIndex > maxIndex) {
        gamesCarouselIndex = maxIndex;
    }

    // Calcular translaciÃ³n normal
    const translateX = -gamesCarouselIndex * cardWidth;
    track.style.transform = `translateX(${translateX}px)`;
}

function moverCarruselGiftCards(direccion) {
    const track = document.getElementById('giftcards-carousel-track');
    if (!track || giftCardsCarouselItems.length === 0) return;

    const cardWidth = 220 + 15; // ancho de tarjeta + gap
    const containerWidth = track.parentElement.offsetWidth;
    const visibleCards = Math.floor(containerWidth / cardWidth);
    
    // Si hay menos tarjetas que las visibles, no permitir movimiento
    if (giftCardsCarouselItems.length <= visibleCards) {
        giftCardsCarouselIndex = 0;
        track.style.transform = `translateX(0px)`;
        return;
    }

    const maxIndex = giftCardsCarouselItems.length - visibleCards;

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
    
    // En mÃ³vil, usar todas las tarjetas pero limitar el movimiento
    const totalCards = window.todosCarouselItems.length;
    
    // Si hay menos tarjetas que las visibles, no permitir movimiento
    if (totalCards <= visibleCards) {
        window.todosCarouselIndex = 0;
        track.style.transform = `translateX(0px)`;
        return;
    }

    window.todosCarouselIndex += direccion;

    // Calcular el mÃ¡ximo Ã­ndice para que la Ãºltima tarjeta quede perfectamente alineada
    const maxIndex = totalCards - visibleCards;

    if (window.todosCarouselIndex < 0) {
        window.todosCarouselIndex = 0;
    }
    if (window.todosCarouselIndex > maxIndex) {
        window.todosCarouselIndex = maxIndex;
    }

    // Calcular translaciÃ³n normal
    const translateX = -window.todosCarouselIndex * cardWidth;
    track.style.transform = `translateX(${translateX}px)`;

    // Verificar si mostrar botÃ³n "Ver mÃ¡s"
    verificarBotonVerMas('todos');
}

function moverCarruselGiftCardsTodos(direccion) {
    const track = document.getElementById('giftcards-todos-carousel-track');
    if (!track) return;

    const giftCards = productos.filter(producto => producto.categoria === 'gift-cards');
    if (giftCards.length === 0) return;

    // Inicializar Ã­ndice si no existe
    if (typeof window.giftCardsTodosCarouselIndex === 'undefined') {
        window.giftCardsTodosCarouselIndex = 0;
    }

    const cardWidth = 220 + 15; // ancho de tarjeta + gap
    const containerWidth = track.parentElement.offsetWidth;
    const visibleCards = Math.floor(containerWidth / cardWidth);
    
    // En mÃ³vil, usar todas las tarjetas pero limitar el movimiento
    const totalCards = giftCards.length;
    
    // Si hay menos tarjetas que las visibles, no permitir movimiento
    if (totalCards <= visibleCards) {
        window.giftCardsTodosCarouselIndex = 0;
        track.style.transform = `translateX(0px)`;
        return;
    }

    window.giftCardsTodosCarouselIndex += direccion;

    // Calcular el mÃ¡ximo Ã­ndice para que la Ãºltima tarjeta quede perfectamente alineada
    const maxIndex = totalCards - visibleCards;

    if (window.giftCardsTodosCarouselIndex < 0) {
        window.giftCardsTodosCarouselIndex = 0;
    }
    if (window.giftCardsTodosCarouselIndex > maxIndex) {
        window.giftCardsTodosCarouselIndex = maxIndex;
    }

    // Calcular translaciÃ³n normal
    const translateX = -window.giftCardsTodosCarouselIndex * cardWidth;
    track.style.transform = `translateX(${translateX}px)`;

    // Verificar si mostrar botÃ³n "Ver mÃ¡s"
    verificarBotonVerMas('giftcards-todos');
}

// FunciÃ³n para verificar y mostrar el botÃ³n "Ver mÃ¡s" (ya no necesaria, botÃ³n siempre en header)
function verificarBotonVerMas(tipo) {
    // Esta funciÃ³n ya no es necesaria porque el botÃ³n "Ver mÃ¡s" 
    // ahora siempre estÃ¡ en la esquina superior del section-header
    return;
}

function mostrarTodosLosJuegos() {
    // Si ya estamos en la categorÃ­a juegos, solo hacer scroll
    if (filtroActual === 'juegos') {
        setTimeout(() => {
            const productosGrid = document.getElementById('productos-grid');
            if (productosGrid) {
                productosGrid.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
        return;
    }

    // Activar pestaÃ±a de juegos y mostrar catÃ¡logo
    filtrarProductos('juegos');

    // Asegurar que estamos en la pestaÃ±a de catÃ¡logo
    if (!document.getElementById('catalogo').classList.contains('active')) {
        mostrarTab('catalogo');
    }

    // Hacer scroll hacia los productos
    setTimeout(() => {
        const productosGrid = document.getElementById('productos-grid');
        if (productosGrid) {
            productosGrid.scrollIntoView({ behavior: 'smooth' });
        }
    }, 300);
}

function mostrarTodasLasGiftCards() {
    // Si ya estamos en la categorÃ­a gift-cards, solo hacer scroll
    if (filtroActual === 'gift-cards') {
        setTimeout(() => {
            const productosGrid = document.getElementById('productos-grid');
            if (productosGrid) {
                productosGrid.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
        return;
    }

    // Activar pestaÃ±a de gift cards y mostrar catÃ¡logo
    filtrarProductos('gift-cards');

    // Asegurar que estamos en la pestaÃ±a de catÃ¡logo
    if (!document.getElementById('catalogo').classList.contains('active')) {
        mostrarTab('catalogo');
    }

    // Hacer scroll hacia los productos
    setTimeout(() => {
        const productosGrid = document.getElementById('productos-grid');
        if (productosGrid) {
            productosGrid.scrollIntoView({ behavior: 'smooth' });
        }
    }, 300);
}

// FunciÃ³n para manejar tabs de autenticaciÃ³n
function mostrarAuthTab(tabName, element) {
    // Verificar que los elementos existen antes de manipularlos
    const authContents = document.querySelectorAll('.auth-content');
    const authTabs = document.querySelectorAll('.auth-content');
    const targetContent = document.getElementById(tabName);

    if (!authContents.length || !authTabs.length || !targetContent) {
        console.error('Elementos de autenticaciÃ³n no encontrados');
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

// FunciÃ³n para cerrar notificaciÃ³n programÃ¡ticamente
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

// FunciÃ³n para cambiar slides del carrusel (plusSlides para flechas)
function plusSlides(n) {
    slideIndex += n;
    if (slideIndex > 3) slideIndex = 1;
    if (slideIndex < 1) slideIndex = 3;
    showSlide(slideIndex);
}

// Variables para control tÃ¡ctil de carruseles
let touchStartX = 0;
let touchEndX = 0;
let currentCarousel = null;

// FunciÃ³n para inicializar eventos tÃ¡ctiles en carruseles
function inicializarSwipeCarruseles() {
    // Carrusel principal (imÃ¡genes)
    const carouselMain = document.querySelector('.carousel');
    if (carouselMain) {
        setupCarouselSwipe(carouselMain, 'main');
    }

    // Carrusel de juegos
    const carouselJuegos = document.querySelector('.games-carousel-container');
    if (carouselJuegos) {
        setupCarouselSwipe(carouselJuegos, 'games');
    }

    // Carrusel de gift cards
    const carouselGiftCards = document.querySelector('#giftcards-carousel-track');
    if (carouselGiftCards && carouselGiftCards.parentElement) {
        setupCarouselSwipe(carouselGiftCards.parentElement, 'giftcards');
    }

    // Carrusel de "todos"
    const carouselTodos = document.querySelector('.todos-carousel-wrapper');
    if (carouselTodos) {
        setupCarouselSwipe(carouselTodos, 'todos');
    }

    // Carrusel de gift cards en "todos"
    const carouselGiftCardsTodos = document.querySelector('#giftcards-todos-carousel-track');
    if (carouselGiftCardsTodos && carouselGiftCardsTodos.parentElement) {
        setupCarouselSwipe(carouselGiftCardsTodos.parentElement, 'giftcards-todos');
    }
}

// FunciÃ³n para configurar swipe en un carrusel especÃ­fico
function setupCarouselSwipe(element, type) {
    element.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        currentCarousel = type;
    }, { passive: true });

    element.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
}

// FunciÃ³n para manejar el swipe
function handleSwipe() {
    const swipeThreshold = 50; // MÃ­nimo de pÃ­xeles para considerar un swipe
    const swipeDistance = touchStartX - touchEndX;

    if (Math.abs(swipeDistance) < swipeThreshold) return;

    const direction = swipeDistance > 0 ? 1 : -1; // 1 = izquierda, -1 = derecha

    switch(currentCarousel) {
        case 'main':
            if (direction > 0) {
                plusSlides(1);
            } else {
                plusSlides(-1);
            }
            break;
        case 'games':
            moverCarruselJuegos(direction);
            break;
        case 'giftcards':
            moverCarruselGiftCards(direction);
            break;
        case 'todos':
            moverCarruselTodos(direction);
            break;
        case 'giftcards-todos':
            moverCarruselGiftCardsTodos(direction);
            break;
    }

    // Reset
    touchStartX = 0;
    touchEndX = 0;
    currentCarousel = null;
}

// FunciÃ³n para iniciar el temporizador de pago
function iniciarTemporizadorPago() {
    // Limpiar temporizador existente si hay uno
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    // Resetear tiempo
    tiempoRestante = 50 * 60; // 50 minutos

    // Crear elemento del temporizador si no existe
    let timerElement = document.getElementById('payment-timer');
    if (!timerElement) {
        timerElement = document.createElement('div');
        timerElement.id = 'payment-timer';
        timerElement.className = 'payment-timer';
        
        // Insertar despuÃ©s de la informaciÃ³n de pago
        const infoPago = document.getElementById('info-pago');
        if (infoPago && infoPago.parentNode) {
            infoPago.parentNode.insertBefore(timerElement, infoPago.nextSibling);
        }
    }

    // Actualizar contenido inicial
    actualizarTemporizador();

    // Iniciar intervalo
    timerInterval = setInterval(() => {
        tiempoRestante--;
        
        if (tiempoRestante <= 0) {
            clearInterval(timerInterval);
            tiempoAgotado();
        } else {
            actualizarTemporizador();
        }
    }, 1000);
}

// FunciÃ³n para actualizar la visualizaciÃ³n del temporizador
function actualizarTemporizador() {
    const timerElement = document.getElementById('payment-timer');
    if (!timerElement) return;

    const minutos = Math.floor(tiempoRestante / 60);
    const segundos = tiempoRestante % 60;

    // Determinar clases de estado
    let estadoClase = '';
    let warningText = '';

    if (tiempoRestante <= 120) { // 2 minutos
        estadoClase = 'timer-critical';
        warningText = 'âš ï¸ Â¡Tiempo crÃ­tico! Completa tu pago ahora';
    } else if (tiempoRestante <= 300) { // 5 minutos
        estadoClase = 'timer-warning-active';
        warningText = '⏰ Tiempo limitado - No olvides completar tu pago';
    } else {
        warningText = '💡 Tienes tiempo suficiente para completar tu pago';
    }

    timerElement.innerHTML = `
        <div class="timer-header">
            <span class="timer-icon">⏳</span>
            <span class="timer-title">Tiempo restante para completar el pago</span>
        </div>
        <div class="timer-display ${estadoClase}">
            <span class="timer-minutes">${minutos.toString().padStart(2, '0')}</span>
            :
            <span class="timer-seconds">${segundos.toString().padStart(2, '0')}</span>
        </div>
        <div class="timer-warning">${warningText}</div>
    `;

    // Aplicar clase de estado al contenedor
    timerElement.className = `payment-timer ${tiempoRestante <= 0 ? 'timer-expired-state' : ''}`;
}

// FunciÃ³n cuando se agota el tiempo
function tiempoAgotado() {
    const timerElement = document.getElementById('payment-timer');
    const submitBtn = document.getElementById('submit-payment-btn');
    
    if (timerElement) {
        timerElement.className = 'payment-timer timer-expired-state';
        timerElement.innerHTML = `
            <div class="timer-header">
                <span class="timer-icon">â°</span>
                <span class="timer-title">Tiempo agotado</span>
            </div>
            <div class="timer-expired">
                â° TIEMPO AGOTADO
            </div>
            <div class="timer-warning">
                El tiempo para completar el pago ha expirado. 
                <button onclick="reiniciarTemporizador()" style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 8px; margin-left: 10px; cursor: pointer;">
                    ðŸ”„ Reiniciar
                </button>
                <button onclick="mostrarTab('carrito')" style="background: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 8px; margin-left: 5px; cursor: pointer;">
                    ðŸ›’ Volver al Carrito
                </button>
            </div>
        `;
    }

    // Deshabilitar botÃ³n de pago
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.textContent = 'â° Tiempo Agotado';
    }

    // Mostrar alerta
    mostrarAlerta('â° El tiempo para completar el pago ha expirado. Puedes reiniciar el temporizador si aÃºn deseas continuar.', 'error');
}

// FunciÃ³n para reiniciar el temporizador
function reiniciarTemporizador() {
    const submitBtn = document.getElementById('submit-payment-btn');
    
    // Reactivar botÃ³n de pago
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.textContent = 'âœ… Confirmar Pago';
    }

    // Reiniciar temporizador
    iniciarTemporizadorPago();
    
    mostrarAlerta('ðŸ”„ Temporizador reiniciado. Tienes 50 minutos para completar el pago.', 'success');
}

// FunciÃ³n para detener el temporizador (cuando el pago es exitoso)
function detenerTemporizador() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    const timerElement = document.getElementById('payment-timer');
    if (timerElement) {
        timerElement.remove();
    }
}

// FunciÃ³n para mostrar tÃ©rminos y condiciones
function mostrarTerminos() {
    const terminos = `
    ðŸ“‹ TÃ‰RMINOS Y CONDICIONES - INEFABLESTORE

    1. ACEPTACIÃ“N DE TÃ‰RMINOS
    Al realizar una compra en Inefablestore, aceptas estos tÃ©rminos y condiciones.

    2. PRODUCTOS Y SERVICIOS
    â€¢ Ofrecemos recargas de juegos mÃ³viles y gift cards digitales
    â€¢ Los productos son entregados digitalmente
    • Las entregas se realizan en un plazo de 5 a 30 minutos

    3. PAGOS
    • Aceptamos Pago Móvil (VES) y Binance (USD)
    • Todos los pagos deben ser verificados antes de la entrega
    • No se aceptan devoluciones una vez entregado el producto

    4. POLÃTICA DE REEMBOLSOS
    â€¢ Solo se procesan reembolsos por errores de nuestra parte
    â€¢ Los cÃ³digos ya entregados no son reembolsables
    â€¢ Las disputas deben reportarse dentro de 24 horas

    5. RESPONSABILIDADES
    â€¢ El cliente debe proporcionar informaciÃ³n correcta
    â€¢ Inefablestore no se hace responsable por cuentas suspendidas
    â€¢ El uso de nuestros servicios es bajo tu propio riesgo

    6. PRIVACIDAD
    â€¢ Protegemos tu informaciÃ³n personal
    â€¢ No compartimos datos con terceros
    â€¢ Solo usamos tu informaciÃ³n para procesar Ã³rdenes

    7. CONTACTO
    Para consultas o soporte, contÃ¡ctanos a travÃ©s de nuestros canales oficiales.

    Al marcar la casilla, confirmas que has leÃ­do y aceptas estos tÃ©rminos.
    `;

    // Mostrar en una alerta personalizada o modal
    if (window.innerWidth <= 768) {
        // En mÃ³viles, usar un alert simple
        alert(terminos);
    } else {
        // En desktop, crear un modal personalizado
        const modal = document.createElement('div');
        modal.className = 'terms-modal';
        modal.innerHTML = `
            <div class="terms-modal-content">
                <div class="terms-modal-header">
                    <h3>ðŸ“‹ TÃ©rminos y Condiciones</h3>
                    <button onclick="cerrarModalTerminos()" class="close-modal">âœ•</button>
                </div>
                <div class="terms-modal-body">
                    <pre style="white-space: pre-line; color: #ffffff; line-height: 1.6; font-family: inherit;">${terminos}</pre>
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

// FunciÃ³n para cerrar el modal de tÃ©rminos
function cerrarModalTerminos() {
    const modal = document.querySelector('.terms-modal');
    if (modal) {
        modal.remove();
    }
}

// Funciones para el carrito lateral en mÃ³viles
function abrirCarritoLateral() {
    // Crear overlay del carrito si no existe
    let overlay = document.getElementById('mobile-cart-overlay');
    if (!overlay) {
        crearCarritoLateral();
        overlay = document.getElementById('mobile-cart-overlay');
    }

    // Actualizar contenido del carrito
    mostrarCarritoLateral();

    // Mostrar overlay
    overlay.style.display = 'block';
    setTimeout(() => {
        overlay.classList.add('show');
    }, 10);

    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
}

function cerrarCarritoLateral() {
    const overlay = document.getElementById('mobile-cart-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }

    // Restaurar scroll del body
    document.body.style.overflow = '';
}

function crearCarritoLateral() {
    const overlay = document.createElement('div');
    overlay.id = 'mobile-cart-overlay';
    overlay.className = 'mobile-cart-overlay';

    overlay.innerHTML = `
        <div class="mobile-cart-sidebar">
            <div class="mobile-cart-header">
                <h3>🛒 Tu Carrito</h3>
                <button class="close-mobile-cart" onclick="cerrarCarritoLateral()">✖</button>
            </div>
            <div class="mobile-cart-content">
                <div class="mobile-cart-items" id="mobile-cart-items">
                    <!-- Contenido del carrito -->
                </div>
                <div class="mobile-cart-summary">
                    <div class="mobile-cart-total" id="mobile-cart-total">Total: $0.00</div>
                    <button class="mobile-checkout-btn" onclick="procederAlPagoDesdeCarritoLateral()">
                        💳 Proceder al Pago
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cerrar al hacer clic fuera del sidebar
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            cerrarCarritoLateral();
        }
    });
}

function mostrarCarritoLateral() {
    const carritoItems = document.getElementById('mobile-cart-items');
    const carritoTotal = document.getElementById('mobile-cart-total');

    if (!carritoItems || !carritoTotal) return;

    if (carrito.length === 0) {
        carritoItems.innerHTML = `
            <div class="cart-empty" style="text-align: center; padding: 40px 20px; color: #cccccc;">
                <div style="font-size: 48px; margin-bottom: 15px;">🛒</div>
                <h3 style="color: #888; margin-bottom: 10px; font-size: 18px;">Tu carrito está vacío</h3>
                <p style="color: #666; font-size: 14px;">Agrega productos para comenzar</p>
            </div>
        `;
        carritoTotal.textContent = 'Total: $0.00';
        return;
    }

    let html = '';
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
            imagenUrl = 'https://via.placeholder.com/60x60/007bff/ffffff?text=Juego';
        }

        html += `
            <div class="cart-item" style="margin-bottom: 15px;">
                <div class="cart-item-header">
                    <img src="${imagenUrl}" alt="${item.productoNombre}" class="cart-item-image" style="width: 50px; height: 50px;" onerror="this.src='https://via.placeholder.com/50x50/007bff/ffffff?text=Juego'">
                    <div class="cart-item-info">
                        <div class="cart-item-name" style="font-size: 14px;">${item.productoNombre}</div>
                        <div class="cart-item-package" style="font-size: 12px;">${item.paqueteNombre}</div>
                        <div class="cart-item-price" style="font-size: 13px;">${convertirPrecio(item.precio)}</div>
                    </div>
                </div>
                <div class="cart-item-controls" style="margin-top: 10px;">
                    <div class="quantity-control">
                        <button onclick="cambiarCantidad(${item.id}, -1)" class="quantity-btn" style="width: 28px; height: 28px; font-size: 12px;">-</button>
                        <span class="quantity-display" style="font-size: 14px;">${item.cantidad}</span>
                        <button onclick="cambiarCantidad(${item.id}, 1)" class="quantity-btn" style="width: 28px; height: 28px; font-size: 12px;">+</button>
                    </div>
                    <button onclick="eliminarDelCarrito(${item.id})" class="remove-btn" style="width: 28px; height: 28px; font-size: 12px;">🗑️</button>
                </div>
            </div>
        `;
    });

    carritoItems.innerHTML = html;
    carritoTotal.textContent = `Total: ${convertirPrecio(total)}`;
}

function procederAlPagoDesdeCarritoLateral() {
    if (carrito.length === 0) {
        mostrarAlerta('Tu carrito estÃ¡ vacÃ­o', 'error');
        return;
    }

    // Cerrar carrito lateral
    cerrarCarritoLateral();

    // Proceder al pago normal
    procederAlPago();
}

// FunciÃ³n para mostrar el footer con animaciÃ³n
function mostrarFooterCopyright() {
    const footer = document.querySelector('.copyright-footer');
    if (footer) {
        // Mostrar inmediatamente con animaciÃ³n suave
        footer.style.opacity = '0';
        footer.style.transform = 'translateY(20px)';
        footer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        // Aplicar animaciÃ³n inmediatamente
        requestAnimationFrame(() => {
            footer.style.opacity = '1';
            footer.style.transform = 'translateY(0)';
        });
    }
}

// Funciones para el tooltip del carrito en desktop
function crearTooltipCarrito() {
    // Solo en desktop
    if (window.innerWidth <= 768) return;

    // Verificar si ya existe - no recrear si ya estÃ¡ presente
    const existingTooltip = document.getElementById('cart-tooltip');
    if (existingTooltip) {
        console.log('Tooltip ya existe, actualizando contenido...');
        actualizarTooltipCarrito();
        return;
    }

    console.log('Creando nuevo tooltip del carrito...');

    const tooltip = document.createElement('div');
    tooltip.id = 'cart-tooltip';
    tooltip.className = 'cart-tooltip';

    tooltip.innerHTML = `
        <div class="cart-tooltip-header">
            <h4>🛒 Tu Carrito (${carrito.reduce((sum, item) => sum + item.cantidad, 0)} items)</h4>
            <div class="cart-tooltip-actions">
                <button onclick="limpiarCarritoCompleto()" class="cart-tooltip-clear" title="Limpiar carrito">🗑️</button>
                <button onclick="cerrarTooltipCarrito()" class="cart-tooltip-close" title="Cerrar">✖</button>
            </div>
        </div>
        <div class="cart-tooltip-content" id="cart-tooltip-content">
            <!-- Contenido del carrito -->
        </div>
        <div class="cart-tooltip-footer">
            <div class="cart-tooltip-summary">
                <div class="cart-tooltip-total" id="cart-tooltip-total">Total: $0.00</div>
                <div class="cart-tooltip-items-count" id="cart-tooltip-items">0 productos</div>
            </div>
            <div class="cart-tooltip-buttons">
                <button class="cart-tooltip-checkout" onclick="procederAlPagoDesdeTooltip()">
                    💳 Proceder al Pago
                </button>
            </div>
        </div>
    `;

    // Agregar el tooltip al botÃ³n del carrito desktop
    const cartButton = document.querySelector('.desktop-nav-btn[title="Carrito"]');
    if (cartButton) {
        cartButton.appendChild(tooltip);
        configurarEventosTooltip();
        actualizarTooltipCarrito();
        console.log('Tooltip del carrito creado exitosamente con', carrito.length, 'items');
    } else {
        console.error('No se encontrÃ³ el botÃ³n del carrito desktop, buscando alternativas...');
        // Buscar de manera mÃ¡s amplia
        const allDesktopBtns = document.querySelectorAll('.desktop-nav-btn');
        let cartBtn = null;

        allDesktopBtns.forEach(btn => {
            if (btn.innerHTML.includes('cart') || btn.title === 'Carrito' || btn.querySelector('svg')) {
                cartBtn = btn;
            }
        });

        if (cartBtn) {
            cartBtn.appendChild(tooltip);
            configurarEventosTooltip();
            actualizarTooltipCarrito();
            console.log('Tooltip del carrito creado en botÃ³n alternativo');
        } else {
            console.error('No se pudo encontrar ningÃºn botÃ³n de carrito desktop');
        }
    }
}

// FunciÃ³n separada para configurar eventos del tooltip
function configurarEventosTooltip() {
    const cartButton = document.querySelector('.desktop-nav-btn[title="Carrito"]');
    const tooltip = document.getElementById('cart-tooltip');

    if (!cartButton || !tooltip) return;

    // Verificar si ya tienen los eventos configurados para evitar duplicados
    if (cartButton.dataset.tooltipConfigured === 'true') {
        return;
    }

    // Marcar como configurado
    cartButton.dataset.tooltipConfigured = 'true';

    // Agregar eventos al botÃ³n
    cartButton.addEventListener('mouseenter', mostrarTooltipCarrito);
    cartButton.addEventListener('mouseleave', iniciarOcultarTooltip);

    // Agregar eventos al tooltip
    if (tooltip) {
        tooltip.addEventListener('mouseenter', cancelarOcultarTooltip);
        tooltip.addEventListener('mouseleave', iniciarOcultarTooltip);
    }
}

// Variable para controlar el timeout del tooltip
let tooltipTimeout = null;

function mostrarTooltipCarrito() {
    // Solo en desktop
    if (window.innerWidth <= 768) return;

    const tooltip = document.getElementById('cart-tooltip');
    if (!tooltip) {
        console.log('Tooltip no encontrado, creando...');
        crearTooltipCarrito();
        return;
    }

    // Cancelar cualquier timeout pendiente
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }

    // Actualizar contenido del tooltip
    actualizarTooltipCarrito();

    // Mostrar tooltip
    setTimeout(() => {
        tooltip.classList.add('show');
    }, 50);
}

function iniciarOcultarTooltip() {
    // Cancelar timeout previo
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
    }

    // Crear nuevo timeout para ocultar
    tooltipTimeout = setTimeout(() => {
        const tooltip = document.getElementById('cart-tooltip');
        if (tooltip && !tooltip.matches(':hover')) {
            tooltip.classList.remove('show');
        }
    }, 200);
}

function cancelarOcultarTooltip() {
    // Cancelar el timeout de ocultar
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
}

function actualizarTooltipCarrito() {
    const content = document.getElementById('cart-tooltip-content');
    const total = document.getElementById('cart-tooltip-total');

    if (!content || !total) {
        console.log('Elementos del tooltip no encontrados');
        return;
    }

    console.log('Actualizando tooltip con carrito:', carrito);

    if (carrito.length === 0) {
        content.innerHTML = `
            <div class="cart-tooltip-empty">
                <span class="cart-tooltip-empty-icon">🛒</span>
                <div style="color: #888; font-size: 14px; font-weight: 600;">Tu carrito está vacío</div>
                <div style="color: #666; font-size: 12px; margin-top: 4px;">Agrega productos para comenzar</div>
            </div>
        `;
        total.textContent = 'Total: $0.00';
        actualizarHeaderTooltip();
        return;
    }

    let html = '';
    let totalAmount = 0;

    carrito.forEach((item, index) => {
        const subtotal = parseFloat(item.precio) * item.cantidad;
        totalAmount += subtotal;

        // Corregir ruta de imagen del item
        let imagenUrl = item.imagen || '';
        if (imagenUrl && !imagenUrl.startsWith('http') && !imagenUrl.startsWith('/static/')) {
            imagenUrl = `/static/${imagenUrl}`;
        }
        if (!imagenUrl) {
            imagenUrl = 'https://via.placeholder.com/45x45/007bff/ffffff?text=J';
        }

        html += `
            <div class="cart-tooltip-item" data-item-id="${item.id}">
                <div class="cart-tooltip-item-header">
                    <img src="${imagenUrl}" alt="${item.productoNombre}" class="cart-tooltip-image" onerror="this.src='https://via.placeholder.com/45x45/007bff/ffffff?text=J'">
                    <div class="cart-tooltip-info">
                        <div class="cart-tooltip-name">${item.productoNombre}</div>
                        <div class="cart-tooltip-package">${item.paqueteNombre}</div>
                        <div class="cart-tooltip-price">${convertirPrecio(item.precio)} × ${item.cantidad}</div>
                        ${item.usuarioId && item.usuarioId !== 'gift-card' ? `<div class="cart-tooltip-userid">ID: ${item.usuarioId}</div>` : ''}
                        <div class="cart-tooltip-subtotal">Subtotal: ${convertirPrecio(subtotal)}</div>
                    </div>
                </div>
                <div class="cart-tooltip-controls">
                    <div class="cart-tooltip-quantity-control">
                        <button onclick="cambiarCantidadTooltip(${item.id}, -1)" class="cart-tooltip-qty-btn" title="Reducir cantidad" type="button">-</button>
                        <span class="cart-tooltip-qty">${item.cantidad}</span>
                        <button onclick="cambiarCantidadTooltip(${item.id}, 1)" class="cart-tooltip-qty-btn" title="Aumentar cantidad" type="button">+</button>
                    </div>
                    <button onclick="eliminarDelCarritoTooltip(${item.id})" class="cart-tooltip-remove" title="Eliminar del carrito" type="button">🗑️</button>
                </div>
            </div>
        `;
    });

    // Actualizar contenido
    content.innerHTML = html;
    total.textContent = `Total: ${convertirPrecio(totalAmount)}`;

    // Actualizar header con contador de items
    actualizarHeaderTooltip();

    console.log('Tooltip actualizado con', carrito.length, 'items, HTML:', html.substring(0, 100));
}

function cambiarCantidadTooltip(itemId, cambio) {
    // Prevenir mÃºltiples clicks rÃ¡pidos
    const btnElement = event?.target;
    if (btnElement) {
        btnElement.disabled = true;
        setTimeout(() => {
            btnElement.disabled = false;
        }, 100);
    }

    // Convertir itemId a nÃºmero para comparar correctamente
    const numericItemId = parseInt(itemId);
    const item = carrito.find(i => parseInt(i.id) === numericItemId);

    if (!item) {
        console.log('Item no encontrado:', itemId, 'en carrito:', carrito);
        return;
    }

    // Aplicar el cambio
    item.cantidad += cambio;

    if (item.cantidad <= 0) {
        eliminarDelCarritoTooltip(itemId);
        return;
    }

    // Guardar cambios
    guardarCarritoEnStorage();
    actualizarContadorCarrito();

    // Actualizar tooltip inmediatamente
    actualizarTooltipCarrito();

    // Mostrar mensaje de actualizaciÃ³n
    if (cambio > 0) {
        mostrarAlerta(`âœ… Cantidad aumentada a ${item.cantidad}`, 'success');
    } else {
        mostrarAlerta(`ðŸ“‰ Cantidad reducida a ${item.cantidad}`, 'success');
    }
}

function eliminarDelCarritoTooltip(itemId) {
    // Convertir itemId a nÃºmero para comparar correctamente
    const numericItemId = parseInt(itemId);
    const itemAEliminar = carrito.find(item => parseInt(item.id) === numericItemId);

    if (!itemAEliminar) {
        console.log('Item no encontrado para eliminar:', itemId);
        return;
    }

    // Guardar nombre del item antes de eliminarlo
    const nombreItem = itemAEliminar.paqueteNombre;

    // Eliminar del carrito
    carrito = carrito.filter(item => parseInt(item.id) !== numericItemId);
    guardarCarritoEnStorage();
    actualizarContadorCarrito();

    // Actualizar tooltip con un pequeÃ±o delay
    setTimeout(() => {
        actualizarTooltipCarrito();
    }, 50);

    // Mostrar mensaje de confirmaciÃ³n
    mostrarAlerta(`🗑️ ${nombreItem} eliminado del carrito`, 'success');
}

function procederAlPagoDesdeTooltip() {
    // Ocultar tooltip
    const tooltip = document.getElementById('cart-tooltip');
    if (tooltip) {
        tooltip.classList.remove('show');
    }

    // Proceder al pago
    procederAlPago();
}

// FunciÃ³n para limpiar todo el carrito desde el tooltip
function limpiarCarritoCompleto() {
    if (carrito.length === 0) return;

    if (confirm('Â¿EstÃ¡s seguro de que quieres limpiar todo el carrito?')) {
        carrito = [];
        limpiarCarritoStorage();
        actualizarContadorCarrito();
        actualizarTooltipCarrito();
        mostrarAlerta('🗑️ Carrito limpiado completamente', 'success');
    }
}

// FunciÃ³n para cerrar el tooltip manualmente
function cerrarTooltipCarrito() {
    const tooltip = document.getElementById('cart-tooltip');
    if (tooltip) {
        tooltip.classList.remove('show');
    }

    // Cancelar cualquier timeout pendiente
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
}

// FunciÃ³n para abrir el carrito completo desde el tooltip
function abrirCarritoCompleto() {
    // Ocultar tooltip
    cerrarTooltipCarrito();

    // Ir a la pestaÃ±a del carrito
    mostrarTab('carrito');
}

// Actualizar contador de items en el header del tooltip
function actualizarHeaderTooltip() {
    const header = document.querySelector('.cart-tooltip-header h4');
    const itemsCount = document.getElementById('cart-tooltip-items');

    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

    if (header) {
        header.textContent = `🛒 Tu Carrito (${totalItems} items)`;
    }

    if (itemsCount) {
        itemsCount.textContent = `${totalItems} producto${totalItems !== 1 ? 's' : ''}`;
    }
}

// FunciÃ³n para validar cache (excluye tasa de cambio para que siempre sea tiempo real)
function cacheValido() {
    if (!configCache || !productosCache || !cacheTimestamp) {
        return false;
    }

    // NO validar la tasa de cambio porque siempre se obtiene en tiempo real del servidor
    // Solo validar que el cache tenga estructura bÃ¡sica
    const tiempoActual = Date.now();
    const esValido = (tiempoActual - cacheTimestamp) < CACHE_DURATION;
    
    if (!esValido) {
        console.log('Cache expirado, serÃ¡ renovado (tasa siempre tiempo real)');
    }
    
    return esValido;
}

// FunciÃ³n para guardar en cache con timestamp
function guardarEnCache(config, productos) {
    configCache = config;
    productosCache = productos;
    cacheTimestamp = Date.now();

    // Guardar tambiÃ©n en localStorage para persistencia entre sesiones
    try {
        localStorage.setItem('inefablestore_cache', JSON.stringify({
            config: config,
            productos: productos,
            timestamp: cacheTimestamp
        }));
    } catch (error) {
        console.warn('No se pudo guardar cache en localStorage:', error);
    }
}

// FunciÃ³n para cargar cache desde localStorage
function cargarCacheDesdeStorage() {
    try {
        const cacheData = localStorage.getItem('inefablestore_cache');
        if (cacheData) {
            const parsed = JSON.parse(cacheData);
            configCache = parsed.config;
            productosCache = parsed.productos;
            cacheTimestamp = parsed.timestamp;
            return cacheValido();
        }
    } catch (error) {
        console.warn('No se pudo cargar cache desde localStorage:', error);
    }
    return false;
}

// FunciÃ³n para precargar carrusel desde cache inmediatamente
function precargarCarruselDesdeCache() {
    if (!configCache) return;
    
    const slides = document.querySelectorAll('.carousel-slide img');
    if (!slides.length) return;
    
    console.log('Precargando carrusel desde cache:', {
        carousel1: configCache.carousel1,
        carousel2: configCache.carousel2,
        carousel3: configCache.carousel3
    });
    
    function prepararUrlImagen(url) {
        if (!url || url.trim() === '') return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('images/')) return `/static/${url}`;
        if (url.startsWith('/static/')) return url;
        return `/static/${url}`;
    }
    
    function cargarImagenCarruselCache(slide, url, index) {
        if (!slide) return;
        
        if (url) {
            const img = new Image();
            img.onload = function() {
                slide.src = url;
                slide.style.display = 'block';
                slide.style.opacity = '1';
                console.log(`Imagen del carrusel ${index + 1} precargada desde cache:`, url);
            };
            img.onerror = function() {
                slide.src = `https://via.placeholder.com/800x300/007bff/ffffff?text=Oferta+${index + 1}`;
                slide.style.display = 'block';
                slide.style.opacity = '1';
            };
            img.src = url;
        } else {
            slide.src = `https://via.placeholder.com/800x300/007bff/ffffff?text=Oferta+${index + 1}`;
            slide.style.display = 'block';
            slide.style.opacity = '1';
        }
    }
    
    // Precargar imÃ¡genes del carrusel desde cache
    cargarImagenCarruselCache(slides[0], prepararUrlImagen(configCache.carousel1), 0);
    cargarImagenCarruselCache(slides[1], prepararUrlImagen(configCache.carousel2), 1);
    cargarImagenCarruselCache(slides[2], prepararUrlImagen(configCache.carousel3), 2);
}

// Cargar cache al inicio
if (cargarCacheDesdeStorage()) {
    console.log('ðŸ’¾ Cache cargado desde localStorage');
}



// Funciones de placeholder removidas para evitar parpadeo visual
// El contenido se carga directamente cuando los datos estÃ¡n listos

// FunciÃ³n para ordenar productos en el panel de administraciÃ³n
async function ordenarProductosAdmin() {
    try {
        // Obtener productos del admin
        const response = await fetch('/admin/productos');
        
        if (!response.ok) {
            throw new Error('No se pudieron obtener los productos ordenados');
        }

        const productos = await response.json();

        // Verificar si hay productos ordenados
        if (!productos || !Array.isArray(productos)) {
            throw new Error('No se recibieron productos ordenados vÃ¡lidos');
        }

        // Actualizar variable global de productos
        window.productosAdmin = productos;
        
        console.log('Productos ordenados:', productos);
        return productos;
    } catch (error) {
        console.error('Error al ordenar productos:', error);
        return [];
    }
}


// ============================================================
// SISTEMA DE VALORACIONES
// ============================================================

// Variables globales para valoraciones
let valoracionSeleccionada = 0;

// FunciÃ³n para cargar valoraciones de un producto
async function cargarValoracionesProducto(juego_id) {
    try {
        // Cargar valoraciones del producto
        const response = await fetch(`/valoraciones/${juego_id}`);
        const data = await response.json();

        // Actualizar estadÃ­sticas
        actualizarEstadisticasValoraciones(juego_id, data.estadisticas);

        // Cargar formulario o mensaje de login
        await cargarFormularioValoracion(juego_id);

        // Mostrar lista de valoraciones
        mostrarListaValoraciones(juego_id, data.valoraciones);

    } catch (error) {
        console.error('Error al cargar valoraciones:', error);
        const reviewsList = document.getElementById(`reviews-list-${juego_id}`);
        if (reviewsList) {
            reviewsList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #dc3545;">
                    <p>Error al cargar las valoraciones</p>
                </div>
            `;
        }
    }
}

// FunciÃ³n para generar estrellas con relleno gradual
function generarEstrellas(promedio, tamano = 'normal') {
    let estrellas = '';
    for (let i = 1; i <= 5; i++) {
        let claseEstrella = 'star empty';
        
        if (i <= Math.floor(promedio)) {
            claseEstrella = 'star full';
        } else if (i - 0.5 <= promedio) {
            claseEstrella = 'star half';
        }
        
        estrellas += `<span class="${claseEstrella}">★</span>`;
    }
    return estrellas;
}

// FunciÃ³n para actualizar estadÃ­sticas de valoraciones
function actualizarEstadisticasValoraciones(juego_id, estadisticas) {
    const statsContainer = document.getElementById(`reviews-stats-${juego_id}`);
    if (!statsContainer) return;

    if (!estadisticas || !estadisticas.total || estadisticas.total === 0) {
        statsContainer.innerHTML = `
            <div class="overall-rating">
                <div class="overall-stars">${generarEstrellas(0)}</div>
                <p class="overall-number">0.0</p>
                <p class="total-reviews">Sin valoraciones</p>
            </div>
        `;
        return;
    }

    const promedio = estadisticas.promedio || 0;
    const total = estadisticas.total || 0;

    if (total === 0) {
        statsContainer.innerHTML = `
            <div class="overall-rating">
                <div class="overall-stars">${generarEstrellas(0)}</div>
                <p class="overall-number">-</p>
                <p class="total-reviews">Sin valoraciones</p>
            </div>
        `;
        return;
    }

    // LÃ³gica para mostrar estrellas progresivamente segÃºn nÃºmero de reseÃ±as
    let estrellasAMostrar = 0;
    let numeroMostrar = promedio.toFixed(1);
    let textoConfiabilidad = '';

    if (total === 1) {
        estrellasAMostrar = Math.min(1, promedio); // MÃ¡ximo 1 estrella
        textoConfiabilidad = ' (1 valoraciÃ³n)';
    } else if (total === 2) {
        estrellasAMostrar = Math.min(2, promedio); // MÃ¡ximo 2 estrellas
        textoConfiabilidad = ' (2 valoraciones)';
    } else if (total === 3) {
        estrellasAMostrar = Math.min(3, promedio); // MÃ¡ximo 3 estrellas
        textoConfiabilidad = ' (3 valoraciones)';
    } else if (total === 4) {
        estrellasAMostrar = Math.min(4, promedio); // MÃ¡ximo 4 estrellas
        textoConfiabilidad = ' (4 valoraciones)';
    } else if (total === 5) {
        estrellasAMostrar = Math.min(4.5, promedio); // MÃ¡ximo 4.5 estrellas
        textoConfiabilidad = ' (5 valoraciones)';
    } else if (total >= 6) {
        estrellasAMostrar = promedio; // Estrellas completas sin restricciÃ³n
        textoConfiabilidad = ` (${total} valoraciones)`;
    }

    statsContainer.innerHTML = `
        <div class="overall-rating">
            <div class="overall-stars">${generarEstrellas(estrellasAMostrar)}</div>
            <p class="overall-number">${numeroMostrar}</p>
            <p class="total-reviews">${total} valoraciÃ³n${total !== 1 ? 'es' : ''}${textoConfiabilidad}</p>
        </div>
    `;
}

// FunciÃ³n para cargar el formulario de valoraciÃ³n
async function cargarFormularioValoracion(juego_id) {
    const formContainer = document.getElementById(`rating-form-container-${juego_id}`);
    if (!formContainer) return;

    try {
        // Verificar si el usuario puede valorar
        const response = await fetch(`/valoracion/usuario/${juego_id}`);
        
        if (response.status === 401) {
            // Usuario no logueado
            formContainer.innerHTML = `
                <div class="login-to-review">
                    <p class="login-to-review-text">Inicia sesión para valorar este producto</p>
                    <button class="login-to-review-btn" onclick="mostrarTab('login')">
                        🔑 Iniciar Sesión
                    </button>
                </div>
            `;
            return;
        }

        const data = await response.json();

        if (!data.puede_valorar) {
            // Usuario no ha comprado el producto
            formContainer.innerHTML = `
                <div class="login-to-review">
                    <p class="login-to-review-text">Solo puedes valorar productos que hayas comprado</p>
                </div>
            `;
            return;
        }

        // Usuario puede valorar - mostrar formulario
        const valoracionExistente = data.valoracion;
        const calificacionActual = valoracionExistente ? valoracionExistente.calificacion : 0;
        const comentarioActual = valoracionExistente ? valoracionExistente.comentario : '';

        formContainer.innerHTML = `
            <div class="rating-form">
                <h4>${valoracionExistente ? '✏️ Editar tu valoración' : '⭐ Valorar este producto'}</h4>
                
                <div class="star-rating" data-juego-id="${juego_id}">
                    ${[1, 2, 3, 4, 5].map(star => `
                        <span class="star-input ${star <= calificacionActual ? 'active' : ''}" 
                              data-rating="${star}" 
                              onclick="seleccionarEstrella(${star}, ${juego_id})">★</span>
                    `).join('')}
                </div>
                
                <textarea 
                    class="rating-textarea" 
                    id="rating-comment-${juego_id}"
                    placeholder="Comparte tu experiencia con este producto..."
                    maxlength="500">${comentarioActual}</textarea>
                
                <button 
                    class="submit-rating-btn" 
                    id="submit-rating-${juego_id}"
                    onclick="enviarValoracion(${juego_id})"
                    ${calificacionActual === 0 ? 'disabled' : ''}>
                    ${valoracionExistente ? '💾 Actualizar Valoración' : '📩 Enviar Valoración'}
                </button>
            </div>
        `;

        // Establecer valoraciÃ³n seleccionada
        valoracionSeleccionada = calificacionActual;

    } catch (error) {
        console.error('Error al cargar formulario de valoraciÃ³n:', error);
        formContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #dc3545;">
                <p>Error al cargar el formulario de valoraciÃ³n</p>
            </div>
        `;
    }
}

// FunciÃ³n para seleccionar estrella
function seleccionarEstrella(rating, juego_id) {
    valoracionSeleccionada = rating;
    
    // Actualizar visualizaciÃ³n de estrellas
    const starContainer = document.querySelector(`.star-rating[data-juego-id="${juego_id}"]`);
    if (starContainer) {
        const stars = starContainer.querySelectorAll('.star-input');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    // Habilitar botÃ³n de envÃ­o
    const submitBtn = document.getElementById(`submit-rating-${juego_id}`);
    if (submitBtn) {
        submitBtn.disabled = false;
    }
}

// FunciÃ³n para enviar valoraciÃ³n
async function enviarValoracion(juego_id) {
    const comentario = document.getElementById(`rating-comment-${juego_id}`)?.value.trim() || '';
    
    if (valoracionSeleccionada === 0) {
        mostrarAlerta('Por favor selecciona una calificaciÃ³n', 'error');
        return;
    }

    const submitBtn = document.getElementById(`submit-rating-${juego_id}`);
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'â³ Enviando...';
    }

    try {
        const response = await fetch('/valoracion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                juego_id: juego_id,
                calificacion: valoracionSeleccionada,
                comentario: comentario
            })
        });

        const data = await response.json();

        if (response.ok) {
            mostrarAlerta('✅ Valoración guardada correctamente', 'success');
            // Recargar las valoraciones
            cargarValoracionesProducto(juego_id);
        } else {
            mostrarAlerta(data.error || 'Error al guardar valoraciÃ³n', 'error');
        }

    } catch (error) {
        console.error('Error al enviar valoraciÃ³n:', error);
        mostrarAlerta('Error de conexiÃ³n', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '📩 Enviar Valoración';
        }
    }
}

// FunciÃ³n para mostrar lista de valoraciones
function mostrarListaValoraciones(juego_id, valoraciones) {
    const reviewsList = document.getElementById(`reviews-list-${juego_id}`);
    if (!reviewsList) return;

    if (!valoraciones || valoraciones.length === 0) {
        reviewsList.innerHTML = `
            <div class="no-reviews">
                <div style="font-size: 48px; margin-bottom: 15px;">💭</div>
                <h3>Sin valoraciones aún</h3>
                <p>Sé el primero en valorar este producto</p>
            </div>
        `;
        return;
    }

    let html = '';
    valoraciones.forEach(valoracion => {
        // Formatear fecha
        const fecha = new Date(valoracion.fecha).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Nombre del usuario (usar nombre completo si estÃ¡ disponible, sino email oculto)
        const nombreUsuario = valoracion.usuario_nombre || valoracion.usuario_email_oculto || 'Usuario';

        html += `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-user">${nombreUsuario}</span>
                    <span class="review-date">${fecha}</span>
                </div>
                <div class="review-stars">${generarEstrellas(valoracion.calificacion)}</div>
                ${valoracion.comentario ? `
                    <div class="review-comment">${valoracion.comentario}</div>
                ` : ''}
            </div>
        `;
    });

    reviewsList.innerHTML = html;
}

// FunciÃ³n para mostrar promedio de valoraciones en las tarjetas de producto
function mostrarValoracionEnTarjeta(producto) {
    // Si no hay valoraciones, mostrar solo estrellas vacÃ­as
    if (!producto.promedio_valoracion || producto.total_valoraciones === 0) {
        return `
            <div class="product-rating">
                <div class="stars-display">${generarEstrellas(0)}</div>
            </div>
        `;
    }

    const promedio = parseFloat(producto.promedio_valoracion);
    const total = parseInt(producto.total_valoraciones);

    // Aplicar lÃ³gica progresiva para tarjetas tambiÃ©n
    let estrellasAMostrar = 0;

    if (total === 0) {
        estrellasAMostrar = 0;
    } else if (total === 1) {
        estrellasAMostrar = Math.min(1, promedio);
    } else if (total === 2) {
        estrellasAMostrar = Math.min(2, promedio);
    } else if (total === 3) {
        estrellasAMostrar = Math.min(3, promedio);
    } else if (total === 4) {
        estrellasAMostrar = Math.min(4, promedio);
    } else if (total === 5) {
        estrellasAMostrar = Math.min(4.5, promedio);
    } else if (total >= 6) {
        estrellasAMostrar = promedio;
    }

    return `
        <div class="product-rating">
            <div class="stars-display">${generarEstrellas(estrellasAMostrar)}</div>
        </div>
    `;
}
