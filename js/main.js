// ============================================
// SISTEMA DE AUTENTICACIÓN COMPLETO CON SUPABASE
// Reemplaza las líneas 1-70 en main.js
// ============================================

// ============================================
// LOGIN CON SUPABASE
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Verificar autenticación en páginas protegidas
    verificarAutenticacion();
});

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btnLogin = event.target.querySelector('button[type="submit"]');
    
    if (!email || !password) {
        alert('Por favor, completa todos los campos');
        return;
    }
    
    if (!validarEmail(email)) {
        alert('Por favor, ingresa un correo electrónico válido');
        return;
    }
    
    // Deshabilitar botón mientras procesa
    btnLogin.disabled = true;
    btnLogin.textContent = 'Iniciando sesión...';
    
    try {
        console.log('🔐 Intentando login con Supabase...');
        
        // ==========================================
        // AUTENTICACIÓN REAL CON SUPABASE
        // ==========================================
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (authError) {
            console.error('❌ Error de autenticación:', authError);
            throw new Error('Credenciales incorrectas');
        }
        
        console.log('✅ Autenticación exitosa:', authData);
        
        // ==========================================
        // OBTENER DATOS DEL USUARIO DE LA BD
        // ==========================================
        const { data: userData, error: userError } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .single();
        
        if (userError || !userData) {
            console.error('❌ Usuario no encontrado en BD:', userError);
            throw new Error('Usuario no encontrado en el sistema');
        }
        
        console.log('✅ Datos del usuario obtenidos:', userData);
        
        // ==========================================
        // GUARDAR SESIÓN EN LOCALSTORAGE
        // ==========================================
        const sessionData = {
            id: userData.id,
            nombre: userData.nombre,
            email: userData.email,
            rol: userData.rol,  // ⭐ IMPORTANTE: Guardamos el ROL
            activo: userData.activo,
            loginTime: new Date().toISOString(),
            // También guardamos el token de Supabase
            accessToken: authData.session.access_token,
            refreshToken: authData.session.refresh_token,
            expiresAt: authData.session.expires_at
        };
        
        localStorage.setItem('usuario', JSON.stringify(sessionData));
        localStorage.setItem('supabase.auth.token', JSON.stringify(authData.session));
        
        console.log('✅ Sesión guardada en localStorage');
        console.log('👤 Usuario:', sessionData.nombre);
        console.log('🎭 Rol:', sessionData.rol);
        
        // ==========================================
        // REDIRIGIR AL HOME
        // ==========================================
        setTimeout(() => {
            window.location.href = './home.html';
        }, 500);
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        alert(`Error al iniciar sesión: ${error.message}`);
        
        // Rehabilitar botón
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar Sesión';
    }
}

function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// ============================================
// VERIFICAR AUTENTICACIÓN
// ============================================

async function verificarAutenticacion() {
    const paginasProtegidas = [
        'polizas.html', 
        'home.html', 
        'para-revisar.html',
        'cliente.html',
        'control_calidad.html',
        'historial_evaluacion.html'
    ];
    
    const paginaActual = window.location.pathname.split('/').pop();
    
    // Si no es una página protegida, no hacer nada
    if (!paginasProtegidas.includes(paginaActual)) {
        return;
    }
    
    try {
        // Verificar sesión en localStorage
        const usuarioData = localStorage.getItem('usuario');
        
        if (!usuarioData) {
            console.log('❌ No hay sesión en localStorage');
            redirigirALogin();
            return;
        }
        
        const usuario = JSON.parse(usuarioData);
        
        // Verificar sesión en Supabase
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error || !session) {
            console.log('❌ Sesión de Supabase expirada o inválida');
            redirigirALogin();
            return;
        }
        
        // Verificar si el token está por expirar (menos de 5 minutos)
        const ahora = Math.floor(Date.now() / 1000);
        const expiraEn = session.expires_at - ahora;
        
        if (expiraEn < 300) { // 5 minutos
            console.log('⚠️ Token por expirar, refrescando...');
            await refrescarToken();
        }
        
        console.log('✅ Sesión válida');
        console.log('👤 Usuario:', usuario.nombre);
        console.log('🎭 Rol:', usuario.rol);
        console.log('ID:', usuario.id)
        
    } catch (error) {
        console.error('❌ Error al verificar autenticación:', error);
        redirigirALogin();
    }
}

function redirigirALogin() {
    localStorage.removeItem('usuario');
    localStorage.removeItem('supabase.auth.token');
    window.location.href = './login.html';
}

// ============================================
// REFRESCAR TOKEN
// ============================================

async function refrescarToken() {
    try {
        const { data, error } = await supabaseClient.auth.refreshSession();
        
        if (error) throw error;
        
        if (data.session) {
            // Actualizar localStorage con nuevo token
            const usuarioActual = JSON.parse(localStorage.getItem('usuario'));
            usuarioActual.accessToken = data.session.access_token;
            usuarioActual.refreshToken = data.session.refresh_token;
            usuarioActual.expiresAt = data.session.expires_at;
            
            localStorage.setItem('usuario', JSON.stringify(usuarioActual));
            localStorage.setItem('supabase.auth.token', JSON.stringify(data.session));
            
            console.log('✅ Token refrescado exitosamente');
        }
        
    } catch (error) {
        console.error('❌ Error al refrescar token:', error);
        redirigirALogin();
    }
}

// ============================================
// CERRAR SESIÓN
// ============================================

async function cerrarSesion() {
    try {
        // Cerrar sesión en Supabase
        await supabaseClient.auth.signOut();
        
        // Limpiar localStorage
        localStorage.removeItem('usuario');
        localStorage.removeItem('supabase.auth.token');
        
        console.log('✅ Sesión cerrada');
        
        // Redirigir a login
        window.location.href = './login.html';
        
    } catch (error) {
        console.error('❌ Error al cerrar sesión:', error);
        // Limpiar de todas formas
        localStorage.clear();
        window.location.href = './login.html';
    }
}

// ============================================
// OBTENER USUARIO ACTUAL
// ============================================

function obtenerUsuario() {
    const usuarioData = localStorage.getItem('usuario');
    return usuarioData ? JSON.parse(usuarioData) : null;
}

function obtenerRolUsuario() {
    const usuario = obtenerUsuario();
    return usuario ? usuario.rol : null;
}

function esAdmin() {
    const rol = obtenerRolUsuario();
    return rol === 'admin' || rol === 'administrador';
}

function esEvaluador() {
    const rol = obtenerRolUsuario();
    return rol === 'evaluador' || rol === 'admin' || rol === 'administrador';
}


function mostrarNombreUsuario() {
    const usuario = obtenerUsuario();
    const nombreElements = document.querySelectorAll('.nombre-usuario');
    
    if (usuario && nombreElements.length > 0) {
        nombreElements.forEach(element => {
            element.textContent = usuario.nombre;
        });
    }
}

verificarAutenticacion();
mostrarNombreUsuario();

// ============================================
// SIDEBAR
// ============================================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }
}

function toggleDarkMode() {
    const darkModeSwitch = document.getElementById('darkModeSwitch');
    if (darkModeSwitch) {
        darkModeSwitch.classList.toggle('active');
        const isDark = darkModeSwitch.classList.contains('active');
        localStorage.setItem('darkMode', isDark);
        
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }
}

window.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const darkModeSwitch = document.getElementById('darkModeSwitch');
    
    if (sidebar) {
        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        }
    }
    
    if (darkModeSwitch) {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            darkModeSwitch.classList.add('active');
            document.body.classList.add('dark-mode');
        }
    }
});

// ============================================
// NAVEGACIÓN
// ============================================

function navigateTo(url) {
    window.location.href = url;
}

// ============================================
// BÚSQUEDA EN TABLAS
// ============================================

function buscarEnTabla() {
    const input = document.getElementById('searchInput');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('tabla-polizas');
    const tr = table.getElementsByTagName('tr');
    
    for (let i = 0; i < tr.length; i++) {
        let found = false;
        const td = tr[i].getElementsByTagName('td');
        
        for (let j = 0; j < td.length; j++) {
            if (td[j]) {
                const txtValue = td[j].textContent || td[j].innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                    found = true;
                    break;
                }
            }
        }
        
        if (found) {
            tr[i].style.display = '';
        } else {
            tr[i].style.display = 'none';
        }
    }
}

function buscarEnTablaRevisar() {
    const input = document.getElementById('searchInputRevisar');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('tabla-polizas-revisar');
    const tr = table.getElementsByTagName('tr');
    
    for (let i = 0; i < tr.length; i++) {
        let found = false;
        const td = tr[i].getElementsByTagName('td');
        
        for (let j = 0; j < td.length; j++) {
            if (td[j]) {
                const txtValue = td[j].textContent || td[j].innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                    found = true;
                    break;
                }
            }
        }
        
        if (found) {
            tr[i].style.display = '';
        } else {
            tr[i].style.display = 'none';
        }
    }
}

// ============================================
// FILTROS
// ============================================

function aplicarFiltros() {
    const year2025 = document.getElementById('2025');
    const year2026 = document.getElementById('2026');
    

    
    // Aquí irá la lógica de filtrado por año
    alert('Filtros aplicados correctamente');
}

function filtrarPorEstado(estado) {
    const table = document.getElementById('tabla-polizas');
    if (!table) return;
    
    const tr = table.getElementsByTagName('tr');
    
    for (let i = 0; i < tr.length; i++) {
        const td = tr[i].getElementsByTagName('td')[4]; // Columna de Estado
        if (td) {
            const badge = td.querySelector('.badge-estado');
            if (badge) {
                const estadoRow = badge.className.includes('activo') ? 'activas' : 
                                 badge.className.includes('cancelado') ? 'canceladas' : 'proximas';
                
                if (estado === estadoRow) {
                    tr[i].style.display = '';
                } else {
                    tr[i].style.display = 'none';
                }
            }
        }
    }
}

function filtrarPorTipo(tipo) {
    // Lógica específica para para-revisar.html
    alert(`Mostrando pólizas: ${tipo}`);
}

function applyFilters() {
    const filterType = document.getElementById('filterType');
    if (filterType) {
        alert(`Filtro aplicado: ${filterType.value}`);
    }
}

function openDatePicker() {
    alert('Selector de fecha - En desarrollo');
}

// ============================================
// CREAR NUEVA PÓLIZA
// ============================================

function crearNuevaPoliza() {
    window.location.href = './cliente_crear.html';
}

// ============================================
// UTILIDADES
// ============================================

function formatearFecha(fecha) {
    const opciones = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(fecha).toLocaleDateString('es-ES', opciones);
}

function formatearMoneda(cantidad) {
    return new Intl.NumberFormat('es-US', {
        style: 'currency',
        currency: 'USD'
    }).format(cantidad);
}

// ============================================
// NOTIFICACIONES (Para futura implementación)
// ============================================

function mostrarNotificacion(mensaje, tipo = 'info') {
    // tipo puede ser: 'success', 'error', 'warning', 'info'
    
    // Por ahora usamos alert, luego se implementará un sistema de notificaciones propio
    if (tipo === 'error') {
        alert('❌ ' + mensaje);
    } else if (tipo === 'success') {
        alert('✅ ' + mensaje);
    } else if (tipo === 'warning') {
        alert('⚠️ ' + mensaje);
    } else {
        alert('ℹ️ ' + mensaje);
    }
}

// ============================================
// ESTADÍSTICAS DEL DASHBOARD
// ============================================

function actualizarEstadisticas() {
    // Esta función se llamará cuando se conecte con la base de datos
    // Por ahora solo actualiza los valores de ejemplo
    
    const totalPolizas = document.getElementById('totalPolizas');
    const totalAplicantes = document.getElementById('totalAplicantes');
    
    if (totalPolizas) {
        totalPolizas.textContent = '1 Póliza';
    }
    
    if (totalAplicantes) {
        totalAplicantes.textContent = '1 Aplicante';
    }
}

// Llamar al cargar la página
if (window.location.pathname.includes('home.html')) {
    actualizarEstadisticas();
}


// ============================================
// MENÚ DE USUARIO
// ============================================

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('active');
}

// Cerrar menú al hacer click fuera
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');
    
    if (dropdown && userMenu && !userMenu.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

async function cerrarSesion() {
    const confirmacion = confirm('¿Estás seguro de que deseas cerrar sesión?');
    
    if (!confirmacion) return;
    
    try {
        // Cerrar sesión en Supabase
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) throw error;
        
        // Limpiar localStorage
        localStorage.clear();
        
        // Redirigir al login
        window.location.href = '../index.html';
        
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert('Error al cerrar sesión: ' + error.message);
    }
}

// Cargar información del usuario
async function cargarInfoUsuario() {
    try {
        // Obtener usuario autenticado
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error) throw error;
        
        if (!user) {
            console.warn('⚠️ No hay usuario autenticado');
            // Redirigir al login si no hay usuario
            window.location.href = '../index.html';
            return;
        }
        
        console.log('✅ Usuario cargado:', user);
        
        // Extraer información del usuario
        const email = user.email || 'usuario@ejemplo.com';
        const metadata = user.user_metadata || {};
        
        // Intentar obtener el nombre de diferentes fuentes
        let nombreCompleto = metadata.full_name || 
                            metadata.name || 
                            metadata.display_name ||
                            email.split('@')[0];
        
        // Si el nombre tiene formato "nombre apellido", tomar solo el primer nombre
        const primerNombre = nombreCompleto.split(' ')[0];
        
        // Actualizar elementos del DOM
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.querySelector('.user-avatar');
        
        if (userName) {
            userName.textContent = primerNombre;
        }
        
        if (userEmail) {
            userEmail.textContent = email;
        }
        
        // Actualizar avatar
        if (userAvatar) {
            // Si el usuario tiene foto de perfil en metadata
            if (metadata.avatar_url || metadata.picture) {
                userAvatar.src = metadata.avatar_url || metadata.picture;
            } else {
                // Generar avatar con iniciales
                const iniciales = obtenerIniciales(nombreCompleto);
                const colorFondo = generarColorDesdeTexto(email);
                userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(iniciales)}&background=${colorFondo}&color=fff&size=80&bold=true`;
            }
            
            userAvatar.alt = nombreCompleto;
        }
        
        console.log('✅ Información de usuario actualizada');
        
    } catch (error) {
        console.error('❌ Error al cargar info de usuario:', error);
        // No redirigir si es solo un error de carga
    }
}

// Obtener iniciales del nombre
function obtenerIniciales(nombre) {
    if (!nombre) return 'U';
    
    const palabras = nombre.trim().split(' ').filter(p => p.length > 0);
    
    if (palabras.length === 0) return 'U';
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    
    // Tomar primera letra de primer y último nombre
    return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

// Generar color consistente desde un texto (para el avatar)
function generarColorDesdeTexto(texto) {
    if (!texto) return '667eea';
    
    // Lista de colores agradables
    const colores = [
        '667eea', // Morado
        '764ba2', // Morado oscuro
        'f093fb', // Rosa
        '4facfe', // Azul claro
        '43e97b', // Verde
        'fa709a', // Rosa fuerte
        'fee140', // Amarillo
        '30cfd0', // Turquesa
        'a8edea', // Menta
        'ff6b6b'  // Rojo suave
    ];
    
    // Generar hash simple del texto
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
        hash = texto.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Seleccionar color basado en el hash
    const index = Math.abs(hash) % colores.length;
    return colores[index];
}

// Llamar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    cargarInfoUsuario();
});

// ============================================
// LOG DE DESARROLLO
// ============================================

