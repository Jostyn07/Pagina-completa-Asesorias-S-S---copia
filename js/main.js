// ============================================
// FUNCIONALIDAD DE LOGIN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Por favor, completa todos los campos');
        return;
    }
    
    if (!validarEmail(email)) {
        alert('Por favor, ingresa un correo electrónico válido');
        return;
    }
    
    const usuario = {
        nombre: 'Jostyn',
        email: "prueba@asesoriasth.com",
        password: 123456,
        loginTime: new Date().toISOString()
    };
    
    localStorage.setItem('usuario', JSON.stringify(usuario));
    
    setTimeout(() => {
        window.location.href = './home.html';
    }, 500);
}

function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// ============================================
// AUTENTICACIÓN
// ============================================

function verificarAutenticacion() {
    const usuario = localStorage.getItem('usuario');
    const paginasProtegidas = ['polizas.html', 'home.html', 'para-revisar.html'];
    const paginaActual = window.location.pathname.split('/').pop();
    
    if (paginasProtegidas.includes(paginaActual) && !usuario) {
        window.location.href = './login.html';
    }
}

function cerrarSesion() {
    localStorage.removeItem('usuario');
    window.location.href = './login.html';
}

function obtenerUsuario() {
    const usuarioData = localStorage.getItem('usuario');
    return usuarioData ? JSON.parse(usuarioData) : null;
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
    
    console.log('Filtros aplicados:');
    console.log('2025:', year2025 ? year2025.checked : false);
    console.log('2026:', year2026 ? year2026.checked : false);
    
    // Aquí irá la lógica de filtrado por año
    alert('Filtros aplicados correctamente');
}

function filtrarPorEstado(estado) {
    console.log('Filtrando por estado:', estado);
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
    console.log('Filtrando por tipo:', tipo);
    // Lógica específica para para-revisar.html
    alert(`Mostrando pólizas: ${tipo}`);
}

function applyFilters() {
    const filterType = document.getElementById('filterType');
    if (filterType) {
        console.log('Aplicando filtro:', filterType.value);
        alert(`Filtro aplicado: ${filterType.value}`);
    }
}

function openDatePicker() {
    alert('Selector de fecha - En desarrollo');
}

function abrirModalFiltros() {
    alert('Modal de filtros avanzados - En desarrollo\n\nPróximamente podrás filtrar por:\n- Compañía\n- Agente\n- Rango de fechas\n- Estado\n- Y más...');
}

// ============================================
// CREAR NUEVA PÓLIZA
// ============================================

function crearNuevaPoliza() {
    const confirmar = confirm('¿Deseas crear una nueva póliza?\n\nSerás redirigido al formulario de creación.');
    
    if (confirmar) {
        window.location.href = './cliente.html';
    }
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
    console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
    
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
// LOG DE DESARROLLO
// ============================================

console.log('%c🚀 Sistema S&S Asesorías cargado correctamente', 'color: #00a76f; font-size: 14px; font-weight: bold');
console.log('%c📋 Funcionalidades activas:', 'color: #0066cc; font-weight: bold');
console.log('  ✓ Autenticación');
console.log('  ✓ Búsqueda en tablas');
console.log('  ✓ Filtros básicos');
console.log('  ✓ Navegación entre páginas');
console.log('  ✓ Sidebar colapsable');
console.log('  ✓ Modo oscuro (UI solamente)');
console.log('%c⚙️ En desarrollo:', 'color: #ff9800; font-weight: bold');
console.log('  → CRUD completo de pólizas');
console.log('  → Conexión con base de datos');
console.log('  → Gráficos interactivos');
console.log('  → Sistema de notificaciones');
console.log('  → Exportar a Excel/PDF');