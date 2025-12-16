// ============================================
// POLIZAS.JS - GESTIÓN DE PÓLIZAS
// ============================================

// ============================================
// VARIABLES GLOBALES
// ============================================
let todasLasPolizas = [];
let polizasFiltradas = [];

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    
    // Cargar pólizas desde Supabase
    await cargarPolizas();
    
    // Configurar búsqueda
    configurarBusqueda();
    
});

// ============================================
// CARGAR PÓLIZAS DESDE SUPABASE
// ============================================
async function cargarPolizas() {
    try {
        mostrarIndicadorCarga(true);
        
        
        // Obtener pólizas con datos relacionados
        const { data, error } = await supabaseClient
            .from('polizas')
            .select(`
                *,
                cliente:clientes (
                    id,
                    nombres,
                    apellidos,
                    telefono1,
                    email
                )
            `)
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        
        todasLasPolizas = data;
        polizasFiltradas = data;
        
        // Renderizar tabla
        renderizarTabla(data);
        
        // Actualizar estadísticas
        actualizarEstadisticas(data);
        
        mostrarIndicadorCarga(false);
        
    } catch (error) {
        console.error('❌ Error al cargar pólizas:', error);
        mostrarIndicadorCarga(false);
        mostrarError('Error al cargar las pólizas: ' + error.message);
    }
}

// ============================================
// RENDERIZAR TABLA
// ============================================
function renderizarTabla(polizas) {
    const tbody = document.getElementById('tabla-polizas');
    
    if (!tbody) {
        console.error('❌ No se encontró el elemento tabla-polizas');
        return;
    }
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    if (polizas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 40px; color: #94a3b8;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.3;">search_off</span>
                        <p style="font-size: 1.1rem; margin: 0;">No se encontraron pólizas</p>
                        <small>Intenta cambiar los filtros o crear una nueva póliza</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Generar filas
    polizas.forEach(poliza => {
        const fila = crearFilaPoliza(poliza);
        tbody.innerHTML += fila;
    });
}

// ============================================
// CREAR FILA DE PÓLIZA
// ============================================
function crearFilaPoliza(poliza) {
    const cliente = poliza.cliente || {};
    const nombreCompleto = `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim();
    
    // Formatear fechas
    const fechaEfectividad = poliza.fecha_efectividad ? formatearFecha(poliza.fecha_efectividad) : '--/--/----';
    const fechaCreacion = poliza.created_at ? formatearFecha(poliza.created_at) : '--/--/----';
    const fechaModificacion = poliza.updated_at ? formatearFecha(poliza.updated_at) : '--/--/----';
    
    // Formatear prima
    const prima = poliza.prima ? `$${parseFloat(poliza.prima).toFixed(2)}` : '$0.00';
    
    // Badge de estado
    const estadoBadge = obtenerBadgeEstado(poliza.estado_mercado || 'pendiente');
    
    return `
        <tr>
            <td data-label="Póliza">${poliza.numero_poliza || 'N/A'}</td>
            <td data-label="Operador">${poliza.operador_nombre || 'N/A'}</td>
            <td class="td1" data-label="Cliente">
                <div class="td1__flex">
                    <a href="./cliente.html?id=${cliente.id || ''}" style="color: #6366f1; text-decoration: none; font-weight: 500;">
                        ${nombreCompleto || 'Sin nombre'}
                    </a>
                </div>
            </td>
            <td data-label="Teléfono">${cliente.telefono1 || 'N/A'}</td>
            <td data-label="Estado">${estadoBadge}</td>
            <td data-label="Compañía">${poliza.compania || 'N/A'}</td>
            <td data-label="Plan">${poliza.plan || 'N/A'}</td>
            <td data-label="Prima">${prima}</td>
            <td data-label="Agente">${poliza.agente_nombre || 'N/A'}</td>
            <td data-label="Efectividad">${fechaEfectividad}</td>
            <td data-label="Creación">${fechaCreacion}</td>
            <td data-label="Modificación">${fechaModificacion}</td>
        </tr>
    `;
}

// ============================================
// BADGE DE ESTADO
// ============================================
function obtenerBadgeEstado(estado) {
    const estados = {
        'activo': '<span class="badge-estado activo">Activo</span>',
        'cancelado': '<span class="badge-estado cancelado">Cancelado</span>',
        'pendiente': '<span class="badge-estado pendiente">Pendiente</span>',
        'proxima': '<span class="badge-estado proxima">Próxima</span>'
    };
    
    return estados[estado.toLowerCase()] || '<span class="badge-estado">Sin estado</span>';
}

// ============================================
// ACTUALIZAR ESTADÍSTICAS
// ============================================
function actualizarEstadisticas(polizas) {
    // Contar por estado
    const activas = polizas.filter(p => p.estado_mercado === 'activo').length;
    const canceladas = polizas.filter(p => p.estado_mercado === 'cancelado').length;
    const proximas = polizas.filter(p => {
        if (!p.fecha_efectividad) return false;
        const hoy = new Date();
        const fechaEfectividad = new Date(p.fecha_efectividad);
        const diasDiferencia = Math.ceil((fechaEfectividad - hoy) / (1000 * 60 * 60 * 24));
        return diasDiferencia > 0 && diasDiferencia <= 30; // Próximos 30 días
    }).length;
    
    // Actualizar UI
    const elementoActivas = document.getElementById('polizas-activas');
    const elementoCanceladas = document.getElementById('polizas-canceladas');
    const elementoProximas = document.getElementById('polizas-proximas');
    
    if (elementoActivas) elementoActivas.textContent = activas;
    if (elementoCanceladas) elementoCanceladas.textContent = canceladas;
    if (elementoProximas) elementoProximas.textContent = proximas;
}

// ============================================
// BÚSQUEDA
// ============================================
function configurarBusqueda() {
    const inputBusqueda = document.getElementById('searchInput');
    
    if (!inputBusqueda) {
        console.warn('⚠️ Input de búsqueda no encontrado');
        return;
    }
    
    inputBusqueda.addEventListener('input', function(e) {
        const termino = e.target.value.toLowerCase().trim();
        buscarPolizas(termino);
    });
}

function buscarPolizas(termino) {
    if (termino === '') {
        polizasFiltradas = todasLasPolizas;
        renderizarTabla(polizasFiltradas);
        return;
    }
    
    polizasFiltradas = todasLasPolizas.filter(poliza => {
        const cliente = poliza.cliente || {};
        const nombreCompleto = `${cliente.nombres || ''} ${cliente.apellidos || ''}`.toLowerCase();
        const telefono = cliente.telefono1 || '';
        const numeroPoliza = poliza.numero_poliza || '';
        const compania = poliza.compania || '';
        const plan = poliza.plan || '';
        
        return nombreCompleto.includes(termino) ||
               telefono.includes(termino) ||
               numeroPoliza.toLowerCase().includes(termino) ||
               compania.toLowerCase().includes(termino) ||
               plan.toLowerCase().includes(termino);
    });
    
    renderizarTabla(polizasFiltradas);
}

// ============================================
// FILTRAR POR ESTADO (Desde tarjetas)
// ============================================
function filtrarPorEstado(estado) {
    
    if (estado === 'activas') {
        polizasFiltradas = todasLasPolizas.filter(p => p.estado_mercado === 'activo');
    } else if (estado === 'canceladas') {
        polizasFiltradas = todasLasPolizas.filter(p => p.estado_mercado === 'cancelado');
    } else if (estado === 'proximas') {
        polizasFiltradas = todasLasPolizas.filter(p => {
            if (!p.fecha_efectividad) return false;
            const hoy = new Date();
            const fechaEfectividad = new Date(p.fecha_efectividad);
            const diasDiferencia = Math.ceil((fechaEfectividad - hoy) / (1000 * 60 * 60 * 24));
            return diasDiferencia > 0 && diasDiferencia <= 30;
        });
    }
    
    renderizarTabla(polizasFiltradas);
}

// ============================================
// APLICAR FILTROS (Checkbox de años)
// ============================================
function aplicarFiltros() {
    const checkbox2025 = document.getElementById('2025');
    const checkbox2026 = document.getElementById('2026');
    
    if (!checkbox2025 || !checkbox2026) {
        console.warn('⚠️ Checkboxes de filtro no encontrados');
        return;
    }
    
    const años = [];
    if (checkbox2025.checked) años.push('2025');
    if (checkbox2026.checked) años.push('2026');
    
    if (años.length === 0) {
        // Si no hay años seleccionados, mostrar todas
        polizasFiltradas = todasLasPolizas;
    } else {
        polizasFiltradas = todasLasPolizas.filter(poliza => {
            if (!poliza.fecha_efectividad) return false;
            const año = new Date(poliza.fecha_efectividad).getFullYear().toString();
            return años.includes(año);
        });
    }
    
    renderizarTabla(polizasFiltradas);
}

// ============================================
// UTILIDADES
// ============================================
function formatearFecha(fechaISO) {
    const fecha = new Date(fechaISO);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const año = fecha.getFullYear();
    return `${dia}/${mes}/${año}`;
}

function mostrarIndicadorCarga(mostrar) {
    const tbody = document.getElementById('tabla-polizas');
    if (!tbody) return;
    
    if (mostrar) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 40px;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <div style="width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p style="color: #64748b; margin: 0;">Cargando pólizas...</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

function mostrarError(mensaje) {
    const tbody = document.getElementById('tabla-polizas');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="12" style="text-align: center; padding: 40px;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; color: #ef4444;">
                    <span class="material-symbols-rounded" style="font-size: 48px;">error</span>
                    <p style="font-size: 1.1rem; margin: 0;">${mensaje}</p>
                    <button onclick="cargarPolizas()" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Reintentar
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// ============================================
// ESTILOS ADICIONALES (Animación loading)
// ============================================
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .badge-estado {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    
    .badge-estado.activo {
        background: rgba(76, 175, 80, 0.1);
        color: #4caf50;
    }
    
    .badge-estado.cancelado {
        background: rgba(244, 67, 54, 0.1);
        color: #f44336;
    }
    
    .badge-estado.pendiente {
        background: rgba(255, 152, 0, 0.1);
        color: #ff9800;
    }
    
    .badge-estado.proxima {
        background: rgba(33, 150, 243, 0.1);
        color: #2196f3;
    }
`;
document.head.appendChild(style);

// ============================================
// LOG DE DESARROLLO
// ============================================
