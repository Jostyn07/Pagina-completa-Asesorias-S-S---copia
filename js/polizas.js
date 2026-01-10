// ============================================
// VARIABLES GLOBALES
// ============================================
let todasLasPolizas = [];
let polizasFiltradas = [];
let paginaActual = 1;
let polizasPorPagina = 25;
let ordenColumna = 'created_at';
let ordenDireccion = 'desc';
let polizaSeleccionada = null;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📋 Iniciando módulo de pólizas mejorado...');
    
    // Configurar búsqueda
    configurarBusqueda();
    
    // Configurar paginación
    configurarPaginacion();
    
    // Configurar ordenamiento
    configurarOrdenamiento();
    
    // Configurar modal
    configurarModal();
    
    console.log('✅ Módulo de pólizas mejorado cargado');
});

function esAdministrador() {
    return rolUsuario === 'admin';
}

// Mostrar menú de archivados solo para admins
if (esAdministrador()) {
    document.getElementById('menuArchivados').style.display = 'flex';
}

// ============================================
// CARGAR PÓLIZAS DESDE SUPABASE
// ============================================
async function cargarPolizas() {
    try {
        mostrarIndicadorCarga(true);
        
        console.log('📡 Cargando pólizas desde Supabase...');
        
        // Obtener usuario actual
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        const { data: usuarioData } = await supabaseClient
            .from('usuarios')
            .select('id, nombre, rol, email')
            .eq('email', user.email)
            .single();
        
        const esAdmin = usuarioData?.rol === 'admin';
        const nombreOperador = usuarioData?.nombre;
        
        console.log('👤 Usuario:', nombreOperador);
        console.log('🔐 Rol:', usuarioData?.rol, '| Admin:', esAdmin);
        
        // ✅ Query con filtro directo por operador_nombre
        let query = supabaseClient
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
            .order('updated_at', { ascending: false });
        
        // ✅ Filtrar directamente en la query por operador_nombre
        if (!esAdmin && nombreOperador) {
            query = query.eq('operador_nombre', nombreOperador);
            console.log('🔒 Operador - Filtrando por nombre:', nombreOperador);
        } else {
            console.log('✅ Admin - Todas las pólizas');
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error:', error);
            throw error;
        }
        
        console.log(`✅ ${data?.length || 0} pólizas cargadas`);
        
        todasLasPolizas = data || [];
        polizasFiltradas = data || [];
        paginaActual = 1;
        
        renderizarTabla();
        actualizarEstadisticas(data);
        actualizarPaginacion();
        
        mostrarIndicadorCarga(false);
        
    } catch (error) {
        console.error('❌ Error al cargar pólizas:', error);
        mostrarIndicadorCarga(false);
        mostrarError('Error al cargar las pólizas: ' + error.message);
    }
}


// async function cargarPolizasDesdeSupabase() {
//     try {
//         console.log('📥 Cargando pólizas desde Supabase...');
        
//         // ✅ Cargar rol del usuario
//         await cargarRolUsuario();
        
//         // ✅ Query base
//         let query = supabaseClient
//             .from('clientes')
//             .select(`
//                 id,
//                 nombres,
//                 apellido,
//                 telefono1,
//                 email,
//                 operador_id,
//                 created_at,
//                 updated_at,
//                 polizas!inner (
//                     id,
//                     numero_poliza,
//                     compania,
//                     tipo_plan,
//                     nombre_plan,
//                     prima,
//                     credito_fiscal,
//                     fecha_efectividad,
//                     estado_mercado,
//                     estado_compania,
//                     operador_nombre,
//                     agente_nombre
//                 )
//             `)
//             .order('created_at', { ascending: false });
        
//         // ✅ Si NO es admin, filtrar solo sus clientes
//         if (!esAdministrador()) {
//             const userId = obtenerUsuarioId();
//             query = query.eq('operador_id', userId);
//             console.log('🔒 Operador - Mostrando solo mis clientes');
//         } else {
//             console.log('✅ Admin - Mostrando todos los clientes');
//         }
        
//         const { data, error } = await query;
        
//         if (error) {
//             console.error('❌ Error al cargar desde Supabase:', error);
//             throw error;
//         }
        
//         console.log(`✅ ${data?.length || 0} clientes cargados desde Supabase`);
        
//         // Guardar en variable global
//         todasLasPolizas = data || [];
        
//         // Renderizar
//         renderizarPolizas(todasLasPolizas);
//         actualizarContadores();
        
//     } catch (error) {
//         console.error('❌ Error crítico:', error);
//         mostrarMensajeError('Error al cargar las pólizas');
//     }
// }

// ============================================
// RENDERIZAR TABLA CON PAGINACIÓN
// ============================================
function renderizarTabla() {
    const tbody = document.getElementById('tabla-polizas');
    
    if (!tbody) {
        console.error('❌ No se encontró el elemento tabla-polizas');
        return;
    }
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    if (polizasFiltradas.length === 0) {
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

    // Calcular rango de pólizas para la página actual
    const inicio = (paginaActual - 1) * polizasPorPagina;
    const fin = inicio + polizasPorPagina;
    const polizasPagina = polizasFiltradas.slice(inicio, fin);

    // Renderizar cada póliza
    polizasPagina.forEach(poliza => {
        const cliente = poliza.cliente;
        
        const tr = document.createElement('tr');
        tr.onclick = () => mostrarDetallesPoliza(poliza);
        tr.style.cursor = 'pointer';
        
        tr.innerHTML = `
            <td data-label="Póliza">${poliza.numero_poliza || '-'}</td>
            <td data-label="Operador">${cliente?.operador_nombre || poliza?.operador_nombre || '-'}</td>
            <td class="td1" data-label="Cliente">
                <div class="td1__flex">
                    <a href="./cliente_editar.html?id=${cliente?.id || ''}" onclick="event.stopPropagation()">
                        ${cliente?.nombres || ''} ${cliente?.apellidos || ''}
                    </a>
                </div>
            </td>
            <td data-label="Teléfono">${cliente?.telefono1 || '-'}</td>
            <td data-label="Estado (Mercado)">  
                <span class="badge-estado ${poliza.estado_mercado || 'pendiente'}">
                    ${poliza.estado_mercado || 'Pendiente'}
                </span>
            </td>
            <td data-label="Agente 3.5">${obtenerBadgeAgente35(poliza.agente35_estado)}</td>
            <td data-label="Compañía">${poliza.compania || '-'}</td>
            <td data-label="Plan">${poliza.plan || '-'}</td>
            <td data-label="Prima">$${poliza.prima || '0.00'}</td>
            <td data-label="Agente">${poliza.agente_nombre || '-'}</td>
            <td data-label="Efectividad">${formatoUS(poliza.fecha_efectividad)}</td>
            <td data-label="Creación">${formatoUS(poliza.created_at)}</td>
            <td data-label="Modificación">${formatearFechaHora(poliza.updated_at)}</td>
        `;
        
        tbody.appendChild(tr);
    });
}
    
// Calcular rango de paginación
const inicio = (paginaActual - 1) * polizasPorPagina;
const fin = inicio + polizasPorPagina;
const polizasPagina = polizasFiltradas.slice(inicio, fin);

// Generar filas
polizasPagina.forEach(poliza => {
    const fila = crearFilaPoliza(poliza);
    tbody.innerHTML += fila;
});


// ============================================
// CREAR FILA DE PÓLIZA
// ============================================
function crearFilaPoliza(poliza) {
    const cliente = poliza.cliente || {};
    const nombreCompleto = `${cliente.nombres|| ''} ${cliente.apellidos || ''}`.trim();
    
    // Formatear fechas
    const fechaEfectividad = poliza.fecha_efectividad ? formatoUS(poliza.fecha_efectividad) : '--/--/----';
    const fechaCreacion = poliza.created_at ? formatearFecha(poliza.created_at) : '--/--/----';
    const fechaModificacion = poliza.updated_at ? formatearFecha(poliza.updated_at) : '--/--/----';
    
    // Formatear prima
    const prima = poliza.prima ? `$${parseFloat(poliza.prima).toFixed(2)}` : '$0.00';
    
    // Badge de estado
    const estadoBadge = obtenerBadgeEstado(poliza.estado_mercado || 'pendiente');
    
    return `
        <tr data-poliza-id="${poliza.id}" onclick="abrirDetalles(${poliza.id})" style="cursor: pointer;">
            <td data-label="Póliza">${poliza.numero_poliza || 'N/A'}</td>
            <td data-label="Operador">${poliza.operador_nombre || 'N/A'}</td>
            <td class="td1" data-label="Cliente">
                <div class="td1__flex">
                    <a href="./cliente_editar.html?id=${cliente.id || ''}" onclick="event.stopPropagation();" style="color: #6366f1; text-decoration: none; font-weight: 500;">
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
// MODAL DE DETALLES
// ============================================
function configurarModal() {
    // Cerrar modal al hacer click fuera
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('modalDetalles');
        if (e.target === modal) {
            cerrarModal();
        }
    });
}

async function abrirDetalles(polizaId) {
    try {
        // Buscar póliza en datos locales
        const poliza = todasLasPolizas.find(p => p.id === polizaId);
        if (!poliza) {
            throw new Error('Póliza no encontrada');
        }
        
        polizaSeleccionada = poliza;
        const cliente = poliza.cliente || {};
        
        // Rellenar modal
        const contenido = `
            <div class="modal-header">
                <h2>
                    <span class="material-symbols-rounded">description</span>
                    ${poliza.numero_poliza || 'N/A'}
                </h2>
                <button class="btn-close-modal" onclick="cerrarModal()">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
            
            <div class="modal-body">
                <!-- Información del Cliente -->
                <div class="detalle-seccion">
                    <h3><span class="material-symbols-rounded">person</span> Cliente</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Nombre completo</label>
                            <p>${cliente.nombres || ''} ${cliente.apellidos || ''}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Email</label>
                            <p>${cliente.email || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Teléfono 1</label>
                            <p>${cliente.telefono1 || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Teléfono 2</label>
                            <p>${cliente.telefono2 || 'N/A'}</p>
                        </div>
                        <div class="detalle-item full-width">
                            <label>Dirección</label>
                            <p>${cliente.direccion || 'N/A'}, ${cliente.ciudad || ''}, ${cliente.estado || ''} ${cliente.codigo_postal || ''}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Información de la Póliza -->
                <div class="detalle-seccion">
                    <h3><span class="material-symbols-rounded">shield</span> Póliza</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Número de póliza</label>
                            <p><strong>${poliza.numero_poliza || 'N/A'}</strong></p>
                        </div>
                        <div class="detalle-item">
                            <label>Compañía</label>
                            <p>${poliza.compania || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Plan</label>
                            <p>${poliza.plan || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Prima</label>
                            <p><strong style="color: #6366f1; font-size: 1.2rem;">$${parseFloat(poliza.prima || 0).toFixed(2)}</strong></p>
                        </div>
                        <div class="detalle-item">
                            <label>Crédito fiscal</label>
                            <p>$${parseFloat(poliza.credito_fiscal || 0).toFixed(2)}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Estado</label>
                            <p>${obtenerBadgeEstado(poliza.estado_mercado || 'pendiente')}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Estado</label>
                            <p>${obtenerBadgeEstado(poliza.estado_mercado || 'pendiente')}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Fechas -->
                <div class="detalle-seccion">
                    <h3><span class="material-symbols-rounded">calendar_today</span> Fechas Importantes</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Fecha efectividad</label>
                            <p>${poliza.fecha_efectividad ? formatoUS(poliza.fecha_efectividad) : 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Fecha inicial cobertura</label>
                            <p>${poliza.fecha_inicial_cobertura ? formatoUS(poliza.fecha_inicial_cobertura) : 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Fecha final cobertura</label>
                            <p>${poliza.fecha_final_cobertura ? formatoUS(poliza.fecha_final_cobertura) : 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Fecha creación</label>
                            <p>${poliza.created_at ? formatoUS(poliza.created_at) : 'N/A'}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Información Adicional -->
                <div class="detalle-seccion">
                    <h3><span class="material-symbols-rounded">info</span> Información Adicional</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Member ID</label>
                            <p>${poliza.member_id || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Portal NPN</label>
                            <p>${poliza.portal_npn || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Clave de seguridad</label>
                            <p>${poliza.clave_seguridad || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Tipo de venta</label>
                            <p>${poliza.tipo_venta || 'N/A'}</p>
                        </div>
                        ${poliza.enlace_poliza ? `
                        <div class="detalle-item full-width">
                            <label>Enlace de póliza</label>
                            <p><a href="${poliza.enlace_poliza}" target="_blank" style="color: #6366f1;">Ver póliza online</a></p>
                        </div>
                        ` : ''}
                        ${poliza.observaciones ? `
                        <div class="detalle-item full-width">
                            <label>Observaciones</label>
                            <p>${poliza.observaciones}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" onclick="cerrarModal()">Cerrar</button>
                <button class="btn-primary" onclick="window.location.href='./cliente_editar.html?id=${cliente.id}'">
                    <span class="material-symbols-rounded">edit</span>
                    Editar Cliente
                </button>
            </div>
        `;
        
        document.getElementById('modalContenido').innerHTML = contenido;
        document.getElementById('modalDetalles').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('❌ Error al abrir detalles:', error);
        alert('Error al cargar detalles: ' + error.message);
    }
}

function cerrarModal() {
    document.getElementById('modalDetalles').style.display = 'none';
    document.body.style.overflow = 'auto';
    polizaSeleccionada = null;
}

// ============================================
// PAGINACIÓN
// ============================================
function configurarPaginacion() {
    const selector = document.getElementById('polizasPorPagina');
    if (selector) {
        selector.addEventListener('change', function() {
            polizasPorPagina = parseInt(this.value);
            paginaActual = 1;
            renderizarTabla();
            actualizarPaginacion();
        });
    }
}

function actualizarPaginacion() {
    const totalPolizas = polizasFiltradas.length;
    const totalPaginas = Math.ceil(totalPolizas / polizasPorPagina);
    
    const inicio = (paginaActual - 1) * polizasPorPagina + 1;
    const fin = Math.min(paginaActual * polizasPorPagina, totalPolizas);
    
    // Actualizar texto
    const infoPaginacion = document.getElementById('infoPaginacion');
    if (infoPaginacion) {
        infoPaginacion.textContent = `Mostrando ${inicio}-${fin} de ${totalPolizas}`;
    }
    
    // Actualizar botones
    const btnAnterior = document.getElementById('btnPaginaAnterior');
    const btnSiguiente = document.getElementById('btnPaginaSiguiente');
    
    if (btnAnterior) {
        btnAnterior.disabled = paginaActual === 1;
    }
    
    if (btnSiguiente) {
        btnSiguiente.disabled = paginaActual === totalPaginas || totalPolizas === 0;
    }
}

function paginaAnterior() {
    if (paginaActual > 1) {
        paginaActual--;
        renderizarTabla();
        actualizarPaginacion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function paginaSiguiente() {
    const totalPaginas = Math.ceil(polizasFiltradas.length / polizasPorPagina);
    if (paginaActual < totalPaginas) {
        paginaActual++;
        renderizarTabla();
        actualizarPaginacion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ============================================
// ORDENAMIENTO
// ============================================
function configurarOrdenamiento() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        
        header.addEventListener('click', function() {
            const columna = this.dataset.column;
            ordenarPor(columna);
        });
    });
}

function ordenarPor(columna) {
    if (ordenColumna === columna) {
        // Cambiar dirección
        ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
    } else {
        // Nueva columna
        ordenColumna = columna;
        ordenDireccion = 'asc';
    }
    
    // Ordenar datos
    polizasFiltradas.sort((a, b) => {
        let valorA, valorB;
        
        if (columna === 'cliente') {
            valorA = `${a.cliente?.nombres || ''} ${a.cliente?.apellidos || ''}`.trim().toLowerCase();
            valorB = `${b.cliente?.nombres || ''} ${b.cliente?.apellidos || ''}`.trim().toLowerCase();
        } else if (columna === 'prima') {
            valorA = parseFloat(a.prima || 0);
            valorB = parseFloat(b.prima || 0);
        } else {
            valorA = (a[columna] || '').toString().toLowerCase();
            valorB = (b[columna] || '').toString().toLowerCase();
        }
        
        if (ordenDireccion === 'asc') {
            return valorA > valorB ? 1 : -1;
        } else {
            return valorA < valorB ? 1 : -1;
        }
    });
    
    // Actualizar UI
    actualizarIndicadoresOrden();
    paginaActual = 1;
    renderizarTabla();
    actualizarPaginacion();
}

function actualizarIndicadoresOrden() {
    document.querySelectorAll('.sortable').forEach(header => {
        const icono = header.querySelector('.sort-icon');
        if (icono) {
            icono.remove();
        }
    });
    
    const headerActivo = document.querySelector(`[data-column="${ordenColumna}"]`);
    if (headerActivo) {
        const icono = document.createElement('span');
        icono.className = 'material-symbols-rounded sort-icon';
        icono.textContent = ordenDireccion === 'asc' ? 'arrow_upward' : 'arrow_downward';
        icono.style.fontSize = '16px';
        icono.style.marginLeft = '4px';
        icono.style.verticalAlign = 'middle';
        headerActivo.appendChild(icono);
    }
}

// ============================================
// EXPORTAR A EXCEL
// ============================================
async function exportarExcel() {
    try {
        console.log('📥 Exportando a Excel...');
        
        // Preparar datos
        const datos = polizasFiltradas.map(poliza => {
            const cliente = poliza.cliente || {};
            return {
                'Número Póliza': poliza.numero_poliza || '',
                'Cliente': `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim(),
                'Teléfono': cliente.telefono1 || '',
                'Email': cliente.email || '',
                'Estado': poliza.estado_mercado || '',
                'Compañía': poliza.compania || '',
                'Plan': poliza.plan || '',
                'Prima': parseFloat(poliza.prima || 0).toFixed(2),
                'Crédito Fiscal': parseFloat(poliza.credito_fiscal || 0).toFixed(2),
                'Fecha Efectividad': poliza.fecha_efectividad || '',
                'Fecha Creación': poliza.created_at ? poliza.created_at.split('T')[0] : ''
            };
        });
        
        // Crear CSV
        const headers = Object.keys(datos[0]);
        let csv = headers.join(',') + '\n';
        
        datos.forEach(fila => {
            const valores = headers.map(header => {
                let valor = fila[header];
                // Escapar comas y comillas
                if (typeof valor === 'string' && (valor.includes(',') || valor.includes('"'))) {
                    valor = `"${valor.replace(/"/g, '""')}"`;
                }
                return valor;
            });
            csv += valores.join(',') + '\n';
        });
        
        // Crear blob y descargar
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const fecha = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `polizas_${fecha}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('✅ Excel exportado correctamente');
        
        // Mostrar notificación
        mostrarNotificacion('Excel exportado correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error al exportar:', error);
        mostrarNotificacion('Error al exportar: ' + error.message, 'error');
    }
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
    } else {
        polizasFiltradas = todasLasPolizas.filter(poliza => {
            const cliente = poliza.cliente || {};
            const nombreCompleto = `${cliente.nombres || ''} ${cliente.apellidos || ''}`.toLowerCase();
            const telefono = cliente.telefono1 || '';
            const numeroPoliza = poliza.numero_poliza || '';
            const compania = poliza.compania || '';
            const plan = poliza.plan || '';
            const estadoMercado = poliza.estado_mercado || '';
            const operadorNombre = poliza.operador_nombre || '';
            const agente35Estado = poliza.agente35_estado || '';
            
            return nombreCompleto.includes(termino) ||
                   telefono.includes(termino) ||
                   numeroPoliza.toLowerCase().includes(termino) ||
                   compania.toLowerCase().includes(termino) ||
                   plan.toLowerCase().includes(termino) ||
                   estadoMercado.toLowerCase().includes(termino) ||
                   operadorNombre.toLowerCase().includes(termino) ||
                   agente35Estado.toLowerCase().includes(termino);
        });
    }
    
    paginaActual = 1;
    renderizarTabla();
    actualizarPaginacion();
}

// ============================================
// FILTROS
// ============================================
function filtrarPorEstado(estado) {
    console.log('🔍 Filtrando por estado:', estado);
    
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
    
    paginaActual = 1;
    renderizarTabla();
    actualizarPaginacion();
}

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
        polizasFiltradas = todasLasPolizas;
    } else {
        polizasFiltradas = todasLasPolizas.filter(poliza => {
            if (!poliza.fecha_efectividad) return false;
            const año = new Date(poliza.fecha_efectividad).getFullYear().toString();
            return años.includes(año);
        });
    }
    
    paginaActual = 1;
    renderizarTabla();
    actualizarPaginacion();
}

// ============================================
// ESTADÍSTICAS
// ============================================
function actualizarEstadisticas(polizas) {
    const activas = polizas.filter(p => p.estado_mercado === 'activo').length;
    const canceladas = polizas.filter(p => p.estado_mercado === 'cancelado').length;
    const proximas = polizas.filter(p => {
        if (!p.fecha_efectividad) return false;
        const hoy = new Date();
        const fechaEfectividad = new Date(p.fecha_efectividad);
        const diasDiferencia = Math.ceil((fechaEfectividad - hoy) / (1000 * 60 * 60 * 24));
        return diasDiferencia > 0 && diasDiferencia <= 30;
    }).length;
    
    const elementoActivas = document.getElementById('polizas-activas');
    const elementoCanceladas = document.getElementById('polizas-canceladas');
    const elementoProximas = document.getElementById('polizas-proximas');
    
    if (elementoActivas) elementoActivas.textContent = activas;
    if (elementoCanceladas) elementoCanceladas.textContent = canceladas;
    if (elementoProximas) elementoProximas.textContent = proximas;
}

// ============================================
// FORMATEAR FECHA - FORMATO USA (MM/DD/YYYY)
// ============================================

function formatearFecha(fecha) {
    if (!fecha) return '-';
    
    // Extraer solo la parte de fecha (YYYY-MM-DD)
    const fechaStr = fecha.split('T')[0];
    const [year, month, day] = fechaStr.split('-');
    
    // Retornar en formato MM/DD/YYYY (USA)
    return `${month}/${day}/${year}`;
}

// Formatear fecha con hora - FORMATO USA (MM/DD/YYYY HH:MM)
function formatearFechaHora(fecha) {
    if (!fecha) return '-';
    
    const date = new Date(fecha);
    
    // Extraer componentes
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    const anio = date.getFullYear();
    const hora = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    
    // Formato MM/DD/YYYY HH:MM
    return `${mes}/${dia}/${anio} ${hora}:${minutos}`;
}

// Formatear fecha solo con mes y día corto (opcional)
function formatearFechaCorta(fecha) {
    if (!fecha) return '-';
    
    const date = new Date(fecha);
    const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const mes = meses[date.getMonth()];
    const dia = date.getDate();
    const anio = date.getFullYear();
    
    // Formato: Jan 5, 2026
    return `${mes} ${dia}, ${anio}`;
}

// ============================================
// UTILIDADES
// ============================================
/**
 * Convierte CUALQUIER formato de fecha a mm/dd/aaaa
 * SIN conversiones de zona horaria
 * @param {string|Date} fecha - Fecha en cualquier formato
 * @returns {string} Fecha en formato mm/dd/aaaa
 */
function formatoUS(fecha) {
    if (!fecha) return '';
    
    try {
        // Si es string en formato ISO (yyyy-mm-dd o yyyy-mm-ddTHH:MM:SS)
        if (typeof fecha === 'string' && fecha.includes('-')) {
            const soloFecha = fecha.split('T')[0]; // Quitar hora si existe
            const [anio, mes, dia] = soloFecha.split('-');
            return `${mes}/${dia}/${anio}`;
        }
        
        // Si es string en formato US (mm/dd/yyyy)
        if (typeof fecha === 'string' && fecha.includes('/')) {
            return fecha; // Ya está en formato US
        }
        
        // Si es Date object (último recurso)
        if (fecha instanceof Date) {
            const anio = fecha.getFullYear();
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const dia = String(fecha.getDate()).padStart(2, '0');
            return `${mes}/${dia}/${anio}`;
        }
        
        return '';
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '';
    }
}

/**
 * Convierte fecha a formato ISO (yyyy-mm-dd) para inputs type="date"
 * SIN conversiones de zona horaria
 * @param {string|Date} fecha - Fecha en cualquier formato
 * @returns {string} Fecha en formato yyyy-mm-dd
 */
function formatoISO(fecha) {
    if (!fecha) return '';
    
    try {
        // Si es string en formato ISO (yyyy-mm-dd o yyyy-mm-ddTHH:MM:SS)
        if (typeof fecha === 'string' && fecha.includes('-')) {
            return fecha.split('T')[0]; // Ya está en ISO, solo quitar hora
        }
        
        // Si es string en formato US (mm/dd/yyyy)
        if (typeof fecha === 'string' && fecha.includes('/')) {
            const [mes, dia, anio] = fecha.split('/');
            return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        }
        
        // Si es Date object (último recurso)
        if (fecha instanceof Date) {
            const anio = fecha.getFullYear();
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const dia = String(fecha.getDate()).padStart(2, '0');
            return `${anio}-${mes}-${dia}`;
        }
        
        return '';
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '';
    }
}

function obtenerBadgeEstado(estado) {
    const estados = {
        'activo': '<span class="badge-estado activo">Activo</span>',
        'cancelado': '<span class="badge-estado cancelado">Cancelado</span>',
        'pendiente': '<span class="badge-estado pendiente">Pendiente</span>',
        'proxima': '<span class="badge-estado proxima">Próxima</span>'
    };
    
    return estados[estado.toLowerCase()] || '<span class="badge-estado">Sin estado</span>';
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

function mostrarNotificacion(mensaje, tipo) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${tipo === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notif.textContent = mensaje;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// ============================================
// ESTILOS ADICIONALES
// ============================================
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    
    .badge-estado {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 600;
        display: inline-block;
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
    
    /* Modal */
    #modalDetalles {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.2s ease;
    }
    
    .modal-content {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 900px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px 30px;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .modal-header h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        color: #1e293b;
    }
    
    .btn-close-modal {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        transition: background 0.2s;
    }
    
    .btn-close-modal:hover {
        background: #f1f5f9;
    }
    
    .modal-body {
        padding: 30px;
    }
    
    .detalle-seccion {
        margin-bottom: 30px;
    }
    
    .detalle-seccion h3 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
        color: #1e293b;
        font-size: 1.1rem;
    }
    
    .detalle-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
    }
    
    .detalle-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    
    .detalle-item.full-width {
        grid-column: 1 / -1;
    }
    
    .detalle-item label {
        font-size: 0.85rem;
        color: #64748b;
        font-weight: 500;
    }
    
    .detalle-item p {
        margin: 0;
        color: #1e293b;
        font-size: 0.95rem;
    }
    
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 20px 30px;
        border-top: 1px solid #e5e7eb;
    }
    
    .btn-primary, .btn-secondary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    }
    
    .btn-primary {
        background: #6366f1;
        color: white;
    }
    
    .btn-primary:hover {
        background: #5558e3;
    }
    
    .btn-secondary {
        background: #f1f5f9;
        color: #475569;
    }
    
    .btn-secondary:hover {
        background: #e2e8f0;
    }
    
    @media (max-width: 768px) {
        .detalle-grid {
            grid-template-columns: 1fr;
        }
        
        .modal-content {
            width: 95%;
            max-height: 95vh;
        }
    }
`;
document.head.appendChild(style);

// ============================================
// LOG DE DESARROLLO
// ============================================
console.log('%c📋 Módulo de Pólizas Mejorado Cargado', 'color: #6366f1; font-size: 14px; font-weight: bold');
console.log('Funcionalidades activas:');
console.log('  ✓ Cargar pólizas desde Supabase');
console.log('  ✓ Búsqueda en tiempo real');
console.log('  ✓ Filtros por estado y año');
console.log('  ✓ Paginación (10/25/50 por página)');
console.log('  ✓ Ordenar por columnas');
console.log('  ✓ Modal de detalles completos');
console.log('  ✓ Exportar a Excel');

// ============================================
// NAVEGACIÓN
// ============================================
function crearNuevaPoliza() {
    window.location.href = './cliente_crear.html';
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
        const { data: { user } } = await supabaseClient.auth.getUser();
                
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
    cargarPolizas()
});

// ============================================
// MODAL DE FILTROS AVANZADOS
// ============================================

function abrirModalFiltros() {
    const modal = document.getElementById('modalFiltros');
    if (modal) {
        modal.style.display = 'flex';
        
        // Ocultar filtro de operador si no es admin
        const filtroOperadorGroup = document.getElementById('filtroOperadorGroup');
        if (filtroOperadorGroup && !esAdministrador()) {
            filtroOperadorGroup.style.display = 'none';
        }
    }
}

function cerrarModalFiltros() {
    const modal = document.getElementById('modalFiltros');
    if (modal) {
        modal.style.display = 'none';
    }
}

function limpiarFiltros() {
    // Limpiar todos los campos
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroApellido').value = '';
    document.getElementById('filtroTelefono').value = '';
    document.getElementById('filtroEstadoMigratorio').value = '';
    document.getElementById('filtroCompania').value = '';
    document.getElementById('filtroTipoVenta').value = '';
    document.getElementById('filtroOperador').value = '';
    document.getElementById('filtroEstadoMercado').value = '';
    document.getElementById('filtroEstadoCompania').value = '';
    
    // Limpiar fechas
    document.getElementById('filtroFechaRegistroDesde').value = '';
    document.getElementById('filtroFechaRegistroHasta').value = '';
    document.getElementById('filtroFechaEfectividadDesde').value = '';
    document.getElementById('filtroFechaEfectividadHasta').value = '';
    document.getElementById('filtroFechaCoberturaInicialDesde').value = '';
    document.getElementById('filtroFechaCoberturaInicialHasta').value = '';
    document.getElementById('filtroFechaRevisionMercadoDesde').value = '';
    document.getElementById('filtroFechaRevisionMercadoHasta').value = '';
    document.getElementById('filtroFechaRevisionCompaniaDesde').value = '';
    document.getElementById('filtroFechaRevisionCompaniaHasta').value = '';
    document.getElementById('filtroFechaSeguimientoDesde').value = '';
    document.getElementById('filtroFechaSeguimientoHasta').value = '';
    
    // Aplicar filtros vacíos (mostrar todo)
    aplicarFiltrosAvanzados();
}

function aplicarFiltrosAvanzados() {
    console.log('🔍 Aplicando filtros avanzados...');
    
    // Obtener valores de filtros
    const filtros = {
        nombre: document.getElementById('filtroNombre').value.toLowerCase(),
        apellido: document.getElementById('filtroApellido').value.toLowerCase(),
        telefono: document.getElementById('filtroTelefono').value.toLowerCase(),
        estadoMigratorio: document.getElementById('filtroEstadoMigratorio').value,
        compania: document.getElementById('filtroCompania').value,
        tipoVenta: document.getElementById('filtroTipoVenta').value,
        operador: document.getElementById('filtroOperador').value,
        estadoMercado: document.getElementById('filtroEstadoMercado').value,
        estadoCompania: document.getElementById('filtroEstadoCompania').value,
        fechaRegistroDesde: document.getElementById('filtroFechaRegistroDesde').value,
        fechaRegistroHasta: document.getElementById('filtroFechaRegistroHasta').value,
        fechaEfectividadDesde: document.getElementById('filtroFechaEfectividadDesde').value,
        fechaEfectividadHasta: document.getElementById('filtroFechaEfectividadHasta').value,
        fechaCoberturaInicialDesde: document.getElementById('filtroFechaCoberturaInicialDesde').value,
        fechaCoberturaInicialHasta: document.getElementById('filtroFechaCoberturaInicialHasta').value,
        fechaRevisionMercadoDesde: document.getElementById('filtroFechaRevisionMercadoDesde').value,
        fechaRevisionMercadoHasta: document.getElementById('filtroFechaRevisionMercadoHasta').value,
        fechaRevisionCompaniaDesde: document.getElementById('filtroFechaRevisionCompaniaDesde').value,
        fechaRevisionCompaniaHasta: document.getElementById('filtroFechaRevisionCompaniaHasta').value,
        fechaSeguimientoDesde: document.getElementById('filtroFechaSeguimientoDesde').value,
        fechaSeguimientoHasta: document.getElementById('filtroFechaSeguimientoHasta').value
    };
    
    // Filtrar pólizas
    polizasFiltradas = todasLasPolizas.filter(poliza => {
        const cliente = poliza.cliente || {};
        
        // Filtro por nombre
        if (filtros.nombre && !cliente.nombres?.toLowerCase().includes(filtros.nombre)) {
            return false;
        }
        
        // Filtro por apellido
        if (filtros.apellido && !cliente.apellidos?.toLowerCase().includes(filtros.apellido)) {
            return false;
        }
        
        // Filtro por teléfono
        if (filtros.telefono && !cliente.telefono1?.toLowerCase().includes(filtros.telefono)) {
            return false;
        }
        
        // Filtro por estado migratorio
        if (filtros.estadoMigratorio && cliente.estado_migratorio !== filtros.estadoMigratorio) {
            return false;
        }
        
        // Filtro por compañía
        if (filtros.compania && poliza.compania !== filtros.compania) {
            return false;
        }
        
        // Filtro por tipo de venta
        if (filtros.tipoVenta && poliza.tipo_venta !== filtros.tipoVenta) {
            return false;
        }
        
        // Filtro por operador (solo para admins)
        if (filtros.operador && poliza.operador_nombre !== filtros.operador) {
            return false;
        }
        
        // Filtro por estado mercado
        if (filtros.estadoMercado && poliza.estado_mercado !== filtros.estadoMercado) {
            return false;
        }
        
        // Filtro por estado compañía
        if (filtros.estadoCompania && poliza.estado_compania !== filtros.estadoCompania) {
            return false;
        }
        
        // Filtros de fechas
        if (!filtrarPorRangoFecha(poliza.created_at, filtros.fechaRegistroDesde, filtros.fechaRegistroHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_efectividad, filtros.fechaEfectividadDesde, filtros.fechaEfectividadHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_inicial_cobertura, filtros.fechaCoberturaInicialDesde, filtros.fechaCoberturaInicialHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_revision_mercado, filtros.fechaRevisionMercadoDesde, filtros.fechaRevisionMercadoHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_revision_compania, filtros.fechaRevisionCompaniaDesde, filtros.fechaRevisionCompaniaHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_seguimiento, filtros.fechaSeguimientoDesde, filtros.fechaSeguimientoHasta)) return false;
        
        return true;
    });
    
    console.log(`✅ Filtros aplicados: ${polizasFiltradas.length} pólizas de ${todasLasPolizas.length}`);
    
    // Resetear paginación
    paginaActual = 1;
    
    // Renderizar
    renderizarTabla();
    actualizarPaginacion();
    
    // Cerrar modal
    cerrarModalFiltros();
}

// Función auxiliar para filtrar por rango de fechas
function filtrarPorRangoFecha(fecha, desde, hasta) {
    if (!desde && !hasta) return true; // Sin filtro
    if (!fecha) return false; // No tiene fecha
    
    const fechaObj = new Date(fecha);
    
    if (desde) {
        const desdeObj = new Date(desde);
        if (fechaObj < desdeObj) return false;
    }
    
    if (hasta) {
        const hastaObj = new Date(hasta);
        if (fechaObj > hastaObj) return false;
    }
    
    return true;
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(event) {
    const modal = document.getElementById('modalFiltros');
    if (modal && event.target === modal) {
        cerrarModalFiltros();
    }
});
// ============================================
// FUNCIÓN PARA BADGE DE AGENTE 3.5
// ============================================

/**
 * Obtener badge HTML para el estado de Agente 3.5
 */
function obtenerBadgeAgente35(estado) {
    if (!estado) {
        return '<span class="badge-agente35 sin-estado">Sin estado</span>';
    }
    
    const badges = {
        'New aplication': 'New aplication',
        'Policy change': 'Policy change',
        'Procesado': '<span class="badge-agente35 procesado">✓ Procesado</span>',
        'Pendiente': '<span class="badge-agente35 pendiente">⏳ Pendiente</span>',
        'Cambio necesario': '<span class="badge-agente35 cambio">⚠ Cambio necesario</span>'
    };
    
    return badges[estado] || '<span class="badge-agente35 sin-estado">-</span>';
}