// ============================================
// VARIABLES GLOBALES
// ============================================
let todasLasPolizas = [];
let polizasFiltradas = [];
let paginaActual = 1;
let polizasPorPagina = 10;
let ordenColumna = 'created_at';
let ordenDireccion = 'desc';
let polizaSeleccionada = null;
let filtrosActivos= null;
let hayFiltrosActivos = false;
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


async function cargarPolizas() {
    try {
        mostrarIndicadorCarga(true);
        console.log('📡 Cargando pólizas desde Supabase...');
        
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        const { data: usuarioData } = await supabaseClient
            .from('usuarios')
            .select('id, nombre, rol, email')
            .ilike('email', user.email)
            .single();
        
        usuarioActual = usuarioData;
        rolUsuario = usuarioData?.rol || 'operador';
        const nombreOperador = usuarioData?.nombre;
        
        const esAdmin = esAdministrador();
        
        console.log('👤 Usuario:', nombreOperador);
        console.log('🔐 Rol:', usuarioData?.rol, '| Admin:', esAdmin);
        
        let query = supabaseClient
            .from('polizas')
            .select(`
                id,
                numero_poliza,
                operador_nombre,
                estado_mercado,
                fecha_revision_mercado,
                documentos_pendientes,
                agente35_estado,
                compania,
                fecha_revision_compania,
                plan,
                prima,
                agente_nombre,
                fecha_efectividad,
                fecha_inicial_cobertura,
                fecha_final_cobertura,
                created_at,
                updated_at,
                estado_documentos,
                tipo_venta,
                estado_compania,
                fecha_revision_mercado,
                fecha_revision_compania,
                cliente:clientes (
                    id,
                    nombres,
                    apellidos,
                    telefono1,
                    telefono2,
                    email,
                    direccion,
                    ciudad,
                    estado,
                    codigo_postal,
                    estado_migratorio,
                    ssn,
                    tipo_registro,
                    operador_nombre,
                    tiene_social
                ),
                seguimientos (
                    fecha_seguimiento,
                    seguimiento_efectivo,
                    medio_comunicacion
                )
            `)
            .order('updated_at', { ascending: false });
        
        if (!esAdmin && nombreOperador) {
            query = query.ilike('operador_nombre', nombreOperador);
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

        const estadisticas = calcularEstadisticas(todasLasPolizas);
        actualizarTarjetas(estadisticas);
        actualizarIndicadoresRol();
        
        renderizarTabla();
        actualizarPaginacion();
        
        mostrarIndicadorCarga(false);
        
    } catch (error) {
        console.error('❌ Error al cargar pólizas:', error);
        mostrarIndicadorCarga(false);
        mostrarError('Error al cargar las pólizas: ' + error.message);
    }
}

function renderizarTabla() {
    const tbody = document.getElementById('tabla-polizas');
    
    if (!tbody) {
        console.error('❌ No se encontró el elemento tabla-polizas');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (polizasFiltradas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="17" style="text-align: center; padding: 40px; color: #94a3b8;">
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

    const inicio = (paginaActual - 1) * polizasPorPagina;
    const fin = inicio + polizasPorPagina;
    const polizasPagina = polizasFiltradas.slice(inicio, fin);

    polizasPagina.forEach(poliza => {
        const cliente = poliza.cliente;
        const seguimiento = poliza.seguimiento;
        const metodos_pago = poliza.metodos_pago;

        let ultimoSeguimiento = '';
        let seguimientoEfectivo = '-';

        if (poliza.seguimientos && poliza.seguimientos.length > 0) {
            // Calcular último seguimiento (fecha más reciente)
            const fechas = poliza.seguimientos.map(seg => new Date(formatoUS(seg.fecha_seguimiento)));
            const fechaMayor = new Date(Math.max(...fechas));
            ultimoSeguimiento = formatoUS(fechaMayor);
            
            // Obtener el seguimiento efectivo del último seguimiento
            const ultimoSeg = poliza.seguimientos.find(seg => {
                const fechaSeg = new Date(formatoUS(seg.fecha_seguimiento));
                return fechaSeg.getTime() === fechaMayor.getTime();
            });
            
            if (ultimoSeg) {
                seguimientoEfectivo = ultimoSeg.seguimiento_efectivo || '-';
            }
        }

        const tr = document.createElement('tr');
        tr.onclick = () => abrirDetalles(poliza.id);
        tr.style.cursor = 'pointer';
        
        tr.innerHTML = `
            <td data-label="Póliza">${poliza.numero_poliza || '-'} </td>
            <td data-label="Tipo de registro">${cliente?.tipo_registro || '-'}</td>
            <td data-label="Operador">${cliente?.operador_nombre || poliza?.operador_nombre || '-'}</td>
            <td class="td1" data-label="Cliente">
                <div class="td1__flex">
                    <a href="./cliente_editar.html?id=${cliente?.id || ''}" onclick="event.stopPropagation()">
                        ${cliente?.nombres || ''} ${cliente?.apellidos || ''}
                    </a>
                </div>
            </td>
            <td data-label="Teléfono">${cliente?.telefono1 || '-'}</td>
            <td data-label="Estado migratorio">${cliente?.estado_migratorio || '-'}</td>
            <td data-label="Estado migratorio">${cliente?.ssn || 'No'}</td>
            <td data-label="Estado (Mercado)">  
                <span class="badge-estado ${poliza.estado_mercado || 'pendiente'}">
                    ${poliza.estado_mercado || 'Pendiente'}
                </span>
            </td>
            <td data-label="Fecha de revisión (Mercado)">${formatoUS(poliza.fecha_revision_mercado)}</td>
            <td data-label="Documentos">${poliza.documentos_pendientes}</td>
            <td data-label="Estado documentos">${poliza.estado_documentos || 'Pendiente información'} </td>
            <td data-label="Agente 3.5">${obtenerBadgeAgente35(poliza.agente35_estado)}</td>
            <td data-label="Compañía">${poliza.compania || '-'}</td>
            <td data-label="Compañía">${formatoUS(poliza.fecha_revision_compania) || '-'}</td>
            <td data-label="Plan">${poliza.plan || '-'}</td>
            <td data-label="Prima">$${poliza.prima || '0.00'}</td>
            <td data-label="Prima">${metodos_pago?.tiene_metodo_pago || '-'}</td>
            <td data-label="Agente">${poliza.agente_nombre || '-'}</td>
            <td data-label="Efectividad">${formatoUS(poliza.fecha_efectividad)}</td>
            <td data-label="Creación">${formatoUS(poliza.created_at)}</td>
            <td data-label="Modificación">${formatearFechaHora(poliza.updated_at)}</td>
            <td data-label="Último seguimiento">${ultimoSeguimiento}</td>
            <td data-label="Seguimiento efectivo">${seguimientoEfectivo}</td>
        `;
        
        tbody.appendChild(tr);
    });
}

function formatearSSN(valor) {
    const numeros = valor.replace(/\D/g, '').slice(0, 9);
    if (numeros.length === 0) return '';
    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 5) return `${numeros.slice(0, 3)}-${numeros.slice(3)}`;
    return `${numeros.slice(0, 3)}-${numeros.slice(3, 5)}-${numeros.slice(5, 9)}`;
}

// Calcular rango de paginación
// const inicio = (paginaActual - 1) * polizasPorPagina;
// const fin = inicio + polizasPorPagina;
// const polizasPagina = polizasFiltradas.slice(inicio, fin);

// // Generar filas
// polizasPagina.forEach(poliza => {
//     const fila = crearFilaPoliza(poliza);
//     tbody.innerHTML += fila;
// });


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
    const estadoBadge = obtenerBadgeEstado(poliza.estado_mercado);
    
    return `
        <tr data-poliza-id="${poliza.id}" onclick="abrirDetalles(${poliza.id})" style="cursor: pointer;">
            <td data-label="Póliza">${poliza.numero_poliza || 'N/A'}</td>
            <td data-label="Póliza">${cliente.tipo_registro || 'N/A'}</td>
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
        const seguimiento = poliza.seguimientos || {};
        
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

                <!-- Medio de Comunicación -->
                <div class="detalle-seccion" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #10b981;">
                    <h3><span class="material-symbols-rounded">chat</span> Comunicación</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Medio de contacto preferido</label>
                            <p><strong style="color: #10b981; font-size: 1.1rem;">${seguimiento?.medio_comunicacion || 'No especificado'}</strong></p>
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
                            <label>Estado en mercado</label>
                            <p>${obtenerBadgeEstado(poliza.estado_mercado || 'pendiente')}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Estado en compania</label>
                            <p>${obtenerBadgeEstado(poliza.estado_compania || 'pendiente')}</p>
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
                            <p>${poliza.tipo_registro || 'N/A'}</p>
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
                            <p>${poliza .observaciones}</p>
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
                'Número Póliza': cliente.tipo_registro || '',
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
            const tipoRegistro = cliente.tipo_registro || '';
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
                   agente35Estado.toLowerCase().includes(termino) ||
                   tipoRegistro.toLowerCase().includes(termino);
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
    
    if (estado === 'Activas') {
        polizasFiltradas = todasLasPolizas.filter(p => p.estado_mercado === 'Activo');
    } else if (estado === 'Canceladas') {
        polizasFiltradas = todasLasPolizas.filter(p => p.estado_mercado === 'Cancelado');
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
    const activas = polizas.filter(p => p.estado_mercado === 'Activo').length;
    const canceladas = polizas.filter(p => p.estado_mercado === 'cancelado').length;
    const proximas = polizas.filter(p => {
        if (!p.fecha_efectividad) return false;
        const hoy = new Date();
        const fechaEfectividad = new Date(p.fecha_efectividad);
        const diasDiferencia = Math.ceil((fechaEfectividad - hoy) / (1000 * 60 * 60 * 24));
        return diasDiferencia > 0 && diasDiferencia <= 30;
    }).length;
    
    const elementoActivas = document.getElementById('polizasActivas');
    const elementoCanceladas = document.getElementById('polizasCanceladas');
    const elementoProximas = document.getElementById('polizasProximas');
    
    if (elementoActivas) elementoActivas.textContent = activas;
    if (elementoCanceladas) elementoCanceladas.textContent = canceladas;
    if (elementoProximas) elementoProximas.textContent = proximas;
}

function calcularTotales(polizas) {
    const totalPolizas = polizas.length;
    
    // Inicializamos contadores
    let activas = 0;
    let canceladas = 0;

    polizas.forEach(poliza => {
        // Contar por estado (ajusta los nombres 'Procesado' o 'Cancelado' según tu BD)
        const estado = poliza.agente35_estado ? poliza.agente35_estado.toLowerCase() : '';
        
        if (estado === 'procesado') {
            activas++;
        } else if (estado === 'cancelado' || estado === 'terminated') {
            canceladas++;
        }
    });

    return { totalPolizas, totalAplicantes, activas, canceladas };
}

function actualizarEstadisticas(totales) {
    const elementoActivas = document.getElementById('polizas-activas');
    if (elementoActivas) {
        elementoActivas.textContent = `${totales.activas} ${totales.activas === 1 ? 'Póliza' : 'Pólizas'}`;
    }

    const elementoCanceladas = document.getElementById('polizas-canceladas');
    if (elementoCanceladas) {
        elementoCanceladas.textContent = `${totales.canceladas} ${totales.canceladas === 1 ? 'Póliza' : 'Pólizas'}`;
    }
}

function actualizarContadoresEstados(polizas) {
    let activas = 0;
    let canceladas = 0;

    polizas.forEach(poliza => {
        // Normalizamos el texto para evitar errores de mayúsculas
        const estado = (poliza.estado_mercado || "").toLowerCase();
        
        if (estado === 'activo') {
            activas++;
        } else if (estado === 'cancelado' || estado === 'robado' || estado === 'Cancelado a P.C') {
            canceladas++;
        }
    });

    // Actualizar el DOM
    const elActivas = document.getElementById('polizasActivas');
    const elCanceladas = document.getElementById('polizasCanceladas');

    if (elActivas) elActivas.textContent = `${activas}`;
    if (elCanceladas) elCanceladas.textContent = `${canceladas}`;
}

function actualizarIndicadoresRol() {
    const tarjetas = document.querySelectorAll('.inf__cuadro');

    tarjetas.forEach(tarjeta => {
        // Buscar si ya tiene indicador
        let indicador = tarjeta.querySelector('.indicador-rol');

        // Si no es admin, adgregar indicador
        if (!esAdministrador()) {
            if (!indicador) {
                indicador = document.createElement('small');
                indicador.className = 'indicador-rol';
                indicador.style.cssText = `
                    display: block;
                    font-size: 0.75rem;
                    color: #64748b;
                    margin-top: 4px;
                    font-style: italic;
                `;
                indicador.textContent = `(Solo tus pólizas)`

                // Ìnsertar despues del <p>
                const p = tarjeta.querySelector('p');
                if (p) {
                    p.after(indicador)
                }
            }
        } else {
            if (indicador) {
                indicador.remove()
            }
        }
    })
}

function calcularEstadisticas(polizas) {
    let activas = 0;
    let canceladas = 0;
    let proximas = 0;
    
    const hoy = new Date();
    
    polizas.forEach(poliza => {
        const estadoMercado = (poliza.estado_mercado || '').toLowerCase();
        
        if (estadoMercado === 'activo') {
            activas++;
        }
        
        if (estadoMercado === 'cancelado' || 
            estadoMercado === 'robado' || 
            estadoMercado === 'cancelado a p.c') {
            canceladas++;
        }
        
        if (poliza.fecha_efectividad) {
            const fechaEfectividad = new Date(poliza.fecha_efectividad);
            const diasDiferencia = Math.ceil((fechaEfectividad - hoy) / (1000 * 60 * 60 * 24));
            
            if (diasDiferencia > 0 && diasDiferencia <= 30) {
                proximas++;
            }
        }
    });
    
    return { activas, canceladas, proximas };
}

function actualizarTarjetas(estadisticas) {
    const elActivas = document.getElementById('polizasActivas');
    if (elActivas) {
        elActivas.textContent = estadisticas.activas;
    } else {
        console.warn('⚠️ Elemento polizasActivas no encontrado');
    }
    
    const elCanceladas = document.getElementById('polizasCanceladas');
    if (elCanceladas) {
        elCanceladas.textContent = estadisticas.canceladas;
    } else {
        console.warn('⚠️ Elemento polizasCanceladas no encontrado');
    }
    
    const elProximas = document.getElementById('polizasProximas');
    if (elProximas) {
        elProximas.textContent = estadisticas.proximas;
    } else {
        console.warn('⚠️ Elemento polizasProximas no encontrado');
    }
    
    console.log('📊 Estadísticas:', estadisticas);
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
        'proxima': '<span class="badge-estado proxima">Próxima</span>',
    };
    
    return estados[estado.toLowerCase()] || '<span class="badge-estado">Sin estado</span>';
}

function mostrarIndicadorCarga(mostrar) {
    const tbody = document.getElementById('tabla-polizas');
    if (!tbody) return;
    
    if (mostrar) {
        tbody.innerHTML = `
            <tr>
                <td colspan="23" style="text-align: center; padding: 40px;">
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
            <td colspan="23" style="text-align: center; padding: 40px;">
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

    .badge-estado.robado {
        background: #7336;
        color: #333;
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

        @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    #indicadorFiltrosActivos button:hover {
        background: rgba(255,255,255,0.3);
    }
`;
document.head.appendChild(style);

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
        
        // // Ocultar filtro de operador si no es admin
        // const filtroOperadorGroup = document.getElementById('filtroOperadorGroup');
        // if (esAdministrador()) {
        //     filtroOperadorGroup.style.display = 'none';
        // } else {
        //     filtroOperadorGroup.style.display = 'block';
        // }
    }
}

function cerrarModalFiltros() {
    const modal = document.getElementById('modalFiltros');
    if (modal) {
        modal.style.display = 'none';
    }
}

function limpiarFiltros() {
    console.log('🧹 Limpiando filtros...');
    
    // ✅ Resetear estado de filtros
    filtrosActivos = null;
    hayFiltrosActivos = false;
    
    // Limpiar todos los campos
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroApellido').value = '';
    document.getElementById('filtroTelefono').value = '';
    document.getElementById('filtroEstadoMigratorio').value = '';
    document.getElementById('filtroTieneSsn').value = '';
    document.getElementById('filtroCompania').value = '';
    document.getElementById('filtroTipoVenta').value = '';
    document.getElementById('filtroOperador').value = '';
    document.getElementById('filtroEstadoMercado').value = '';
    document.getElementById('filtroEstadoCompania').value = '';
    document.getElementById('estadoAgente35').value = '';
    document.getElementById('filtroPrima').value = '';
    document.getElementById('filtroDocumentos').value = '';
    
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
    document.getElementById('filtroSeguimientoDesde').value = '';
    document.getElementById('filtroSeguimientoHasta').value = '';
    document.getElementById('filtroSeguimientoEfectivo').value = '';
    
    // ✅ Restaurar todas las pólizas
    polizasFiltradas = todasLasPolizas;
    paginaActual = 1;
    
    renderizarTabla();
    actualizarPaginacion();
    
    // ✅ Actualizar indicador visual
    actualizarIndicadorFiltros();
    
    console.log('✅ Filtros limpiados');
}

function actualizarIndicadorFiltros() {
    // Buscar o crear indicador
    let indicador = document.getElementById('indicadorFiltrosActivos');
    
    if (!indicador) {
        // Crear indicador si no existe
        indicador = document.createElement('div');
        indicador.id = 'indicadorFiltrosActivos';
        indicador.style.cssText = `
            display: none;
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: #6366f1;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            z-index: 1000;
            font-size: 0.9rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideInRight 0.3s ease;
        `;
        
        indicador.innerHTML = `
            <span class="material-symbols-rounded" style="font-size: 20px;">filter_alt</span>
            <span>Filtros activos: <strong id="contadorResultados">0</strong></span>
            <button onclick="limpiarFiltros()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.85rem;
                margin-left: 8px;
            ">
                Limpiar
            </button>
        `;
        
        document.body.appendChild(indicador);
    }
    
    const contadorResultados = document.getElementById('contadorResultados');
    
    if (hayFiltrosActivos) {
        indicador.style.display = 'flex';
        if (contadorResultados) {
            contadorResultados.textContent = `${polizasFiltradas.length}/${todasLasPolizas.length}`;
        }
    } else {
        indicador.style.display = 'none';
    }
}

function aplicarFiltrosAvanzados() {
    console.log('🔍 Aplicando filtros avanzados...');
    
    // ✅ Obtener y GUARDAR valores de filtros
    filtrosActivos = {
        nombre: document.getElementById('filtroNombre').value.toLowerCase(),
        apellido: document.getElementById('filtroApellido').value.toLowerCase(),
        telefono: document.getElementById('filtroTelefono').value.toLowerCase(),
        estadoMigratorio: document.getElementById('filtroEstadoMigratorio').value,
        tieneSsn: document.getElementById('filtroTieneSsn').value,
        compania: document.getElementById('filtroCompania').value,
        prima: document.getElementById('filtroPrima').value,
        tipoVenta: document.getElementById('filtroTipoVenta').value,
        operador: document.getElementById('filtroOperador').value,
        documentos: document.getElementById('filtroDocumentos').value,
        estadoMercado: document.getElementById('filtroEstadoMercado').value,
        estadoCompania: document.getElementById('filtroEstadoCompania').value,
        estadoAgente35: document.getElementById('estadoAgente35').value,
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
        fechaSeguimientoDesde: document.getElementById('filtroSeguimientoDesde').value,
        fechaSeguimientoHasta: document.getElementById('filtroSeguimientoHasta').value,
        seguimientoEfectivo: document.getElementById('filtroSeguimientoEfectivo').value
    };
    
    // ✅ Verificar si hay algún filtro activo
    hayFiltrosActivos = Object.values(filtrosActivos).some(valor => valor !== '' && valor !== null);
    
    // Filtrar pólizas
    polizasFiltradas = todasLasPolizas.filter(poliza => {
        const cliente = poliza.cliente || {};
        
        // Filtro por nombre
        if (filtrosActivos.nombre && !cliente.nombres?.toLowerCase().includes(filtrosActivos.nombre)) {
            return false;
        }
        
        // Filtro por apellido
        if (filtrosActivos.apellido && !cliente.apellidos?.toLowerCase().includes(filtrosActivos.apellido)) {
            return false;
        }
        
        // Filtro por teléfono
        if (filtrosActivos.telefono && !cliente.telefono1?.toLowerCase().includes(filtrosActivos.telefono)) {
            return false;
        }
        
        // Filtro por estado migratorio
        if (filtrosActivos.estadoMigratorio && cliente.estado_migratorio !== filtrosActivos.estadoMigratorio) {
            return false;
        }
        
        // Filtro ssn
        if (filtrosActivos.tieneSsn && cliente.tiene_social !== filtrosActivos.tieneSsn) {
            return false;
        }

        // Filtro por compañía
        if (filtrosActivos.compania && poliza.compania !== filtrosActivos.compania) {
            return false;
        }

        if (filtrosActivos.documentos) {
            const estadoDoc = (poliza.estado_documentos || '').toLowerCase().trim();
            const filtroDoc = filtrosActivos.documentos.toLowerCase().trim();
            
            console.log('🔍 Comparando documentos:', {
                'BD': `"${poliza.estado_documentos}"`,
                'BD (limpio)': `"${estadoDoc}"`,
                'Filtro': `"${filtroDoc}"`,
                'Match': estadoDoc === filtroDoc
            });
            
            if (estadoDoc !== filtroDoc) {
                return false;
            }
        }

        // Filtro por seguimiento efectivo
        if (filtrosActivos.seguimientoEfectivo) {
            if (!poliza.seguimientos || poliza.seguimientos.length === 0) {
                return false;
            }

            const seguimientoOrdenado = [...poliza.seguimientos].sort((a, b) => 
                new Date(b.fecha_seguimiento) - new Date(a.fecha_seguimiento)
            );
            
            const ultimoSeg = seguimientoOrdenado[0];
            const seguimientoEfectivoPoliza = ultimoSeg?.seguimiento_efectivo || '';

            if (seguimientoEfectivoPoliza !== filtrosActivos.seguimientoEfectivo) {
                return false;
            }
        }

        if (filtrosActivos.prima) {
            const prima = parseFloat(poliza.prima) || 0;
            
            switch (filtrosActivos.prima) {
                case 'cero':
                    if (prima !== 0) return false;
                    break;
                case 'conPrima':
                    if (prima <= 0) return false;
                    break;
                case 'alta':
                    if (prima <= 1500) return false;
                    break;
                case 'sinAsignar':
                    if (poliza.prima !== null && poliza.prima !== '' && poliza.prima !== undefined) return false;
                    break;
            }
        }
        
        // Filtro por tipo de venta
        if (filtrosActivos.tipoVenta && poliza.tipo_venta !== filtrosActivos.tipoVenta) {
            return false;
        }
        
        // Filtro por operador (solo para admins)
        if (filtrosActivos.operador && poliza.operador_nombre !== filtrosActivos.operador) {
            return false;
        }
        
        // Filtro por estado mercado
        if (filtrosActivos.estadoMercado && poliza.estado_mercado !== filtrosActivos.estadoMercado) {
            return false;
        }
        
        // Filtro por estado compañía
        if (filtrosActivos.estadoCompania && poliza.estado_compania !== filtrosActivos.estadoCompania) {
            return false;
        }

        // Filtro por estado en agente35
        if (filtrosActivos.estadoAgente35 && poliza.agente35_estado !== filtrosActivos.estadoAgente35) {
            return false;
        }
        
        // Filtros de fechas
        if (!filtrarPorRangoFecha(poliza.created_at, filtrosActivos.fechaRegistroDesde, filtrosActivos.fechaRegistroHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_efectividad, filtrosActivos.fechaEfectividadDesde, filtrosActivos.fechaEfectividadHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_inicial_cobertura, filtrosActivos.fechaCoberturaInicialDesde, filtrosActivos.fechaCoberturaInicialHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_revision_mercado, filtrosActivos.fechaRevisionMercadoDesde, filtrosActivos.fechaRevisionMercadoHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_revision_compania, filtrosActivos.fechaRevisionCompaniaDesde, filtrosActivos.fechaRevisionCompaniaHasta)) return false;
        if (filtrosActivos.fechaSeguimientoDesde || filtrosActivos.fechaSeguimientoHasta) {

            if (!poliza.seguimientos || poliza.seguimientos.length === 0) {
                return false;
            }

            const fechas = poliza.seguimientos.map(seg => new Date(seg.fecha_seguimiento));
            const fechaMasReciente = new Date(Math.max(...fechas));

            if(!filtrarPorRangoFecha(fechaMasReciente, filtrosActivos.fechaSeguimientoDesde, filtrosActivos.fechaSeguimientoHasta)) {
                return false;
            }
        }       
        return true;
    });
    
    // Resetear paginación
    paginaActual = 1;
    
    // Renderizar
    renderizarTabla();
    actualizarPaginacion();
    
    // ✅ Actualizar indicador visual
    actualizarIndicadorFiltros();
    
    // Cerrar modal
    cerrarModalFiltros();
    
    console.log(`✅ Filtros aplicados. Resultados: ${polizasFiltradas.length}/${todasLasPolizas.length}`);
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