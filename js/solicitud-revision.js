// ============================================
// VARIABLES GLOBALES
// ============================================
let todosLosSR = [];
let srFiltrados = [];
let filtrosSR = {};
let modalTextoSRId = null;
let modalTextoSRCampo = null;
let paginaActualSR = 1;
let srPorPagina = 10;
let srClienteSeleccionado = null;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();
    await cargarRegistrosSR();
    configurarBuscadorSR();
    configurarPaginacionSR();
    suscribirRealTimeSR();

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        const nombre = user.user_metadata?.nombre || user.email.split('@')[0];
        const el = document.querySelector('.nombre-usuario');
        if (el) el.textContent = nombre;
    }
});

// ============================================
// CARGA DE DATOS
// ============================================
async function cargarRegistrosSR() {
    try {
        mostrarCargaSR(true);

        const { data, error } = await supabaseClient
            .from('solicitud_revision')
            .select('*')
            .order('fecha_solicitud', { ascending: false });

        if (error) throw error;

        todosLosSR = data || [];
        aplicarFiltrosSR();

    } catch (error) {
        console.error('❌ Error al cargar solicitudes:', error);
        mostrarMensajeVacioSR('Error al cargar datos. Intenta recargar la página.');
    } finally {
        mostrarCargaSR(false);
    }
}

// ============================================
// RENDER TABLA
// ============================================
function renderTablaSR() {
    const tbody = document.getElementById('tabla-sr-body');
    if (!tbody) return;

    if (srFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align:center;padding:40px;color:var(--color-text-placeholder)">
                    <span class="material-symbols-rounded" style="font-size:2.5rem;display:block;margin-bottom:8px">search_off</span>
                    No hay registros que mostrar
                </td>
            </tr>`;
        actualizarPaginacionSR();
        return;
    }

    const inicio = (paginaActualSR - 1) * srPorPagina;
    const fin = inicio + srPorPagina;
    const pagina = srFiltrados.slice(inicio, fin);

    tbody.innerHTML = pagina.map(r => buildFilaSR(r)).join('');
    actualizarPaginacionSR();
}

function buildFilaSR(r) {
    const claseAct = r.actualizado === 'Si'
        ? 'fila-sr-actualizado-si'
        : r.actualizado === 'No'
            ? 'fila-sr-actualizado-no'
            : '';

    const puedeEditar = esRevisorMercado();

    const btnActualizado = puedeEditar
        ? `<button class="btn-actualizado btn-act-${(r.actualizado || 'null').toLowerCase()}"
                   data-id="${r.id}"
                   onclick="ciclarActualizadoDesdeBtn(this)"
                   title="Click para cambiar estado">
               ${r.actualizado === 'Si' ? '✅ Sí' : r.actualizado === 'No' ? '❌ No' : '— Pendiente'}
           </button>`
        : `<span class="btn-actualizado btn-act-${(r.actualizado || 'null').toLowerCase()}" title="Solo el equipo de mercado puede modificar esto">
               ${r.actualizado === 'Si' ? '✅ Sí' : r.actualizado === 'No' ? '❌ No' : '— Pendiente'}
           </span>`;

    const notaActDisplay = celdaTextoExpandible(r.nota_actualizacion, `nota-${r.id}`)
    const obsDisplay = celdaTextoExpandible(r.observacion, `obs-${r.id}`);

    const fechaSolicitud = formatearFechaSR(r.fecha_solicitud);
    const fechaActualizacion = r.fecha_actualizacion ? formatearFechaSR(r.fecha_actualizacion) : '<em class="text-muted">—</em>';
    const badgeMercadoSR = r.estado_mercado ? getBadgeMercadoSR(r.estado_mercado) : '<span class="text-muted">—</span>';

    const celdaEstadoMercado = puedeEditar
        ? `<span class="celda-editable" onclick="abrirModalEstadoMercadoSR('${r.id}')" title="Click para editar Estado Mercado">${badgeMercadoSR}</span>`
        : badgeMercadoSR;

    const badgeOrigen = r.origen === 'automatico'
        ? '<span class="badge-origen-auto" title="Generada automáticamente por el sistema">🤖 Auto</span>'
        : '<span class="badge-origen-manual" title="Agregada manualmente">✋ Manual</span>';

    const accion = r.cliente_id
        ? `<a class="btn-ir-poliza" href="./cliente_editar.html?id=${r.cliente_id}&abrir=estado-mercado" target="_blank">
               <span class="material-symbols-rounded" style="font-size:14px">open_in_new</span> Ir a la póliza
           </a>`
        : '<span class="text-muted">—</span>';

    return `
        <tr class="fila-sr ${claseAct}" data-id="${r.id}">
            <td data-label="Fecha Solicitud" class="celda-fecha">${fechaSolicitud}${badgeOrigen}</td>
            <td data-label="Nombre">${r.nombre || '—'}</td>
            <td data-label="Operador">${r.operador_nombre || '<em class="text-muted">—</em>'}</td>
            <td data-label="Teléfono">${formatearTelefonoSR(r.telefono)}</td>
            <td data-label="Compañía">${r.compania || '—'}</td>
            <td data-label="Estado Mercado">${celdaEstadoMercado}</td>
            <td data-label="Actualizado" class="celda-actualizado">${btnActualizado}</td>
            <td data-label="Nota actualización" class="celda-nota-act">
                ${puedeEditar
                    ? `<span class="celda-editable" data-id="${r.id}" onclick="abrirModalTextoSRDesdeEl(this, 'nota_actualizacion')" title="Click para editar nota">${notaActDisplay}</span>`
                    : `<span title="Solo el equipo de mercado puede editar esto">${notaActDisplay}</span>`}
            </td>
            <td data-label="Fecha actualización" class="celda-fecha">${fechaActualizacion}</td>
            <td data-label="Observación" class="celda-obs-sr">
                <span title="La observación solo se define al crear la solicitud">${obsDisplay}</span>
            </td>
            <td data-label="Revisión realizada por">${r.revision_realizada_por || '<em class="text-muted">—</em>'}</td>
            <td data-label="Acción" class="celda-accion-sr">${accion}</td>
        </tr>`;
}

function getBadgeMercadoSR(estado) {
    const mapa = {
        'Robado':         ['badge-mercado badge-robado',    'gpp_bad',    'Robado'],
        'Cancelado a P.C':['badge-mercado badge-cancelado', 'cancel',     'Cancelado'],
        'Doble poliza':   ['badge-mercado badge-doble',     'file_copy',  'Doble Póliza'],
        'Triple poliza':  ['badge-mercado badge-triple',    'library_books','Triple Póliza'],
        'No registra':    ['badge-mercado badge-noregistra','help_outline','No Registra'],
        'Recuperado':     ['badge-mercado badge-recuperado','check_circle','Recuperado']
    };
    const [cls, icon, label] = mapa[estado] || ['badge-mercado', 'info', estado || '—'];
    return `<span class="${cls}"><span class="material-symbols-rounded">${icon}</span>${label}</span>`;
}

// ============================================
// CICLO BOTÓN "ACTUALIZADO"
// ============================================
async function ciclarActualizadoDesdeBtn(btn) {
    if (!esRevisorMercado()) {
        alert('Solo el equipo de mercado puede modificar este campo.');
        return;
    }

    const id = btn.dataset.id;
    const registro = todosLosSR.find(r => r.id === id);
    if (!registro) return;

    const secuencia = { 'null': 'Si', 'Si': 'No', 'No': null };
    const actual = registro.actualizado || 'null';
    const siguiente = secuencia[actual];

    const updateData = {
        actualizado: siguiente,
        revision_realizada_por: datosUsuario?.nombre || 'Desconocido',
        fecha_actualizacion: new Date().toISOString(),
    };

    if (siguiente === 'Si') {
        updateData.notif_creador_pendiente = true;
        updateData.notif_creador_pendiente_desde = new Date().toISOString();
    } else {
        updateData.notif_creador_pendiente = false;
        updateData.notif_creador_pendiente_desde = null;
    }

    try {
        const { error } = await supabaseClient
            .from('solicitud_revision')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;

        Object.assign(registro, updateData);
        renderTablaSR();

    } catch (error) {
        console.error('❌ Error actualizando:', error);
        alert('Error al actualizar.');
    }
}

async function ciclarActualizado(id, valorActual) {
    const siguiente = valorActual === null ? 'Si'
                    : valorActual === 'Si'  ? 'No'
                    : null;

    try {
        const { error } = await supabaseClient
            .from('solicitud_revision')
            .update({ actualizado: siguiente })
            .eq('id', id);

        if (error) throw error;

        // Actualizar en memoria
        const idx = todosLosSR.findIndex(r => r.id === id);
        if (idx !== -1) {
            todosLosSR[idx].actualizado = siguiente;
            // La fecha_actualizacion la pone el trigger en BD
            // Recargamos ese registro para obtener la fecha real
            if (siguiente === 'Si') {
                await recargarRegistroSR(id);
            } else {
                todosLosSR[idx].fecha_actualizacion = null;
            }
        }

        aplicarFiltrosSR();

    } catch (error) {
        console.error('❌ Error al actualizar estado:', error);
        alert('No se pudo actualizar el estado. Intenta de nuevo.');
    }
}

async function recargarRegistroSR(id) {
    const { data, error } = await supabaseClient
        .from('solicitud_revision')
        .select('*')
        .eq('id', id)
        .single();

    if (!error && data) {
        const idx = todosLosSR.findIndex(r => r.id === id);
        if (idx !== -1) todosLosSR[idx] = data;
    }
}

function esRevisorMercado() {
    const autorizados = ['erica de oro', 'jose martinez', 'tony foresta', 'lean barrios', 'juan ospino'];
    const nombre = (datosUsuario?.nombre || '').trim().toLowerCase();
    return autorizados.includes(nombre);
}

// ============================================
// MODAL AGREGAR MANUALMENTE
// ============================================
async function abrirModalAgregar() {
    ['srNombre', 'srTelefono', 'srCompania', 'srObservacion'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('srEstadoMercado').value = '';
    srClienteSeleccionado = null;
    document.getElementById('srClienteVinculado').style.display = 'none';
    document.getElementById('srAutocompleteLista').style.display = 'none';

    await poblarSelectRevisorAsignado();

    document.getElementById('modalAgregarSR').classList.add('show');
    document.getElementById('srNombre').focus();
}

async function guardarNuevoSR() {
    const nombre = document.getElementById('srNombre').value.trim();
    if (!nombre) {
        alert('El campo Nombre es obligatorio.');
        document.getElementById('srNombre').focus();
        return;
    }

    const btn = document.getElementById('btnGuardarSR');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Guardando...';

    try {
        const revisorSeleccionado = document.getElementById('srRevisorAsignado')?.value || null;

        const nuevo = {
            nombre,
            telefono:            document.getElementById('srTelefono').value.trim() || null,
            compania:            document.getElementById('srCompania').value.trim() || null,
            estado_mercado:      document.getElementById('srEstadoMercado').value || null,
            actualizado:         null,
            nota_actualizacion:  null,
            observacion:         document.getElementById('srObservacion').value.trim() || null,
            cliente_id:          srClienteSeleccionado?.id || null,
            poliza_id:           srClienteSeleccionado?.poliza_id || null,
            origen:              'manual',
            operador_nombre:     datosUsuario?.nombre || 'Desconocido',
            revisor_asignado_id: revisorSeleccionado || null,
        };

        const { data, error } = await supabaseClient
            .from('solicitud_revision')
            .insert(nuevo)
            .select()
            .single();

        if (error) throw error;

        todosLosSR.unshift(data);
        cerrarModalAgregar();
        aplicarFiltrosSR();

    } catch (error) {
        console.error('❌ Error al guardar solicitud:', error);
        alert('Error al guardar. Intenta de nuevo.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">save</span> Guardar';
    }
}

function cerrarModalAgregar() {
    document.getElementById('modalAgregarSR').classList.remove('show');
}

// Autocompletar información del cliente
let debounceBuscarClienteSR;

function buscarClientesSR(valor) {
    clearTimeout(debounceBuscarClienteSR);
    const lista = document.getElementById('srAutocompleteLista');
    const vinculado = document.getElementById('srClienteVinculado');

    srClienteSeleccionado = null;
    if (vinculado) vinculado.style.display = 'none';

    if (!valor || valor.trim().length < 3) {
        if (lista) lista.style.display = 'none';
        return
    }

    debounceBuscarClienteSR = setTimeout(async () => {
        try {
            const resultados = await buscarClientes(valor.trim());
            renderAutocompleteSR(resultados || []);
        } catch (error) {
            console.error('Error buscando clientes:', error);
        }
    }, 300);
}

function renderAutocompleteSR(clientes) {
    const lista = document.getElementById('srAutocompleteLista');
    if(!lista) return;

    if (clientes.length === 0) {
        lista.style.display = 'none';
        return;
    }

    lista.innerHTML = clientes.slice(0, 8).map(c => {
        const poliza = (c.polizas && c.polizas[0]) || null;
        return `
            <div class="sr-autocomplete-item"
                 onclick='seleccionarClienteSR(${JSON.stringify(c.id)}, ${JSON.stringify(poliza?.id || null)}, ${JSON.stringify(c.nombres + " " + c.apellidos)}, ${JSON.stringify(c.telefono1 || "")}, ${JSON.stringify(poliza?.compania || "")}, ${JSON.stringify(poliza?.estado_mercado || "")})'>
                ${c.nombres} ${c.apellidos}
                <small>${c.telefono1 || 'Sin teléfono'} ${poliza?.compania ? '· ' + poliza.compania : ''}</small>
            </div>`;
    }).join('');
    lista.style.display = 'block';
}

function seleccionarClienteSR(clienteId, polizaId, nombre, telefono, compania, estadoMercado) {
    srClienteSeleccionado = { id: clienteId, poliza_id: polizaId };

    document.getElementById('srNombre').value = nombre;
    if (telefono) document.getElementById('srTelefono').value = telefono;
    if (compania) document.getElementById('srCompania').value = compania;

    const selectEstado = document.getElementById('srEstadoMercado');
    if (selectEstado) selectEstado.value = estadoMercado || '';

    const lista = document.getElementById('srAutocompleteLista');
    if (lista) lista.style.display = 'none';

    const vinculado = document.getElementById('srClienteVinculado');
    if (vinculado) vinculado.style.display = 'inline-flex';
}
// ============================================
// MODAL EDICIÓN TEXTO LARGO
// ============================================
function abrirModalTextoSRDesdeEl(el, campo) {
    const id = el.dataset.id;
    const reg = todosLosSR.find(r => r.id === id);
    const valor = reg ? (reg[campo] || '') : '';
    abrirModalTextoSR(id, campo, valor);
}

function abrirModalTextoSR(id, campo, valorActual) {
    modalTextoSRId    = id;
    modalTextoSRCampo = campo;

    const titulos = {
        nota_actualizacion: 'Nota de actualización',
        observacion:        'Observación',
    };

    document.getElementById('modalTextoSRTitulo').textContent = titulos[campo] || 'Editar';
    document.getElementById('modalTextoSRArea').value = valorActual || '';
    document.getElementById('modalTextoSROverlay').classList.add('show');
    document.getElementById('modalTextoSRArea').focus();
}

function cerrarModalTextoSR() {
    document.getElementById('modalTextoSROverlay').classList.remove('show');
    modalTextoSRId    = null;
    modalTextoSRCampo = null;
}

async function guardarModalTextoSR() {
    if (!modalTextoSRId || !modalTextoSRCampo) return;

    const valor = document.getElementById('modalTextoSRArea').value.trim() || null;
    const btn   = document.getElementById('btnGuardarTextoSR');
    btn.disabled    = true;
    btn.textContent = 'Guardando...';

    try {
        const { error } = await supabaseClient
            .from('solicitud_revision')
            .update({ [modalTextoSRCampo]: valor, updated_at: new Date().toISOString() })
            .eq('id', modalTextoSRId);

        if (error) throw error;

        const idx = todosLosSR.findIndex(r => r.id === modalTextoSRId);
        if (idx !== -1) todosLosSR[idx][modalTextoSRCampo] = valor;

        cerrarModalTextoSR();
        aplicarFiltrosSR();

    } catch (error) {
        console.error('❌ Error al guardar texto:', error);
        alert('Error al guardar. Intenta de nuevo.');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Guardar';
    }
}

// ============================================
// MODAL FILTROS AVANZADOS
// ============================================
function abrirModalFiltrosSR() {
    document.getElementById('filtroSRNombre').value        = filtrosSR.nombre || '';
    document.getElementById('filtroSRTelefono').value      = filtrosSR.telefono || '';
    document.getElementById('filtroSRCompania').value      = filtrosSR.compania || '';
    document.getElementById('filtroSRActualizado').value   = filtrosSR.actualizado || '';
    document.getElementById('filtroSRSolicitudDesde').value= filtrosSR.solicitudDesde || '';
    document.getElementById('filtroSRSolicitudHasta').value= filtrosSR.solicitudHasta || '';
    document.getElementById('filtroSRActDesde').value      = filtrosSR.actDesde || '';
    document.getElementById('filtroSRActHasta').value      = filtrosSR.actHasta || '';
    document.getElementById('modalFiltrosSROverlay').classList.add('show');
}

function cerrarModalFiltrosSR() {
    document.getElementById('modalFiltrosSROverlay').classList.remove('show');
}

function aplicarFiltrosSR_modal() {
    filtrosSR = {
        nombre:         document.getElementById('filtroSRNombre').value.trim(),
        telefono:       document.getElementById('filtroSRTelefono').value.trim(),
        compania:       document.getElementById('filtroSRCompania').value.trim(),
        actualizado:    document.getElementById('filtroSRActualizado').value,
        solicitudDesde: document.getElementById('filtroSRSolicitudDesde').value,
        solicitudHasta: document.getElementById('filtroSRSolicitudHasta').value,
        actDesde:       document.getElementById('filtroSRActDesde').value,
        actHasta:       document.getElementById('filtroSRActHasta').value,
    };

    cerrarModalFiltrosSR();
    aplicarFiltrosSR();
    actualizarBadgeFiltrosSR();
}

// Renombrar para que el botón del modal llame a esta
function aplicarFiltrosSR() {
    // Si se llama desde el botón del modal, los filtros ya están en filtrosSR
    // Si se llama desde el buscador, filtrosSR ya tiene lo anterior
    let resultado = [...todosLosSR];

    const termino = (document.getElementById('searchInputSR')?.value || '').toLowerCase().trim();
    if (termino) {
        resultado = resultado.filter(r =>
            (r.nombre || '').toLowerCase().includes(termino) ||
            (r.telefono || '').includes(termino) ||
            (r.compania || '').toLowerCase().includes(termino) ||
            (r.observacion || '').toLowerCase().includes(termino)
        );
    }

    const f = filtrosSR;
    if (f.nombre)    resultado = resultado.filter(r => (r.nombre    || '').toLowerCase().includes(f.nombre.toLowerCase()));
    if (f.telefono)  resultado = resultado.filter(r => (r.telefono  || '').includes(f.telefono));
    if (f.compania)  resultado = resultado.filter(r => (r.compania  || '').toLowerCase().includes(f.compania.toLowerCase()));

    if (f.actualizado === 'pendiente') {
        resultado = resultado.filter(r => r.actualizado === null);
    } else if (f.actualizado) {
        resultado = resultado.filter(r => r.actualizado === f.actualizado);
    }

    if (f.solicitudDesde) resultado = resultado.filter(r => r.fecha_solicitud    && new Date(r.fecha_solicitud)    >= new Date(f.solicitudDesde));
    if (f.solicitudHasta) resultado = resultado.filter(r => r.fecha_solicitud    && new Date(r.fecha_solicitud)    <= new Date(f.solicitudHasta + 'T23:59:59'));
    if (f.actDesde)       resultado = resultado.filter(r => r.fecha_actualizacion && new Date(r.fecha_actualizacion) >= new Date(f.actDesde));
    if (f.actHasta)       resultado = resultado.filter(r => r.fecha_actualizacion && new Date(r.fecha_actualizacion) <= new Date(f.actHasta + 'T23:59:59'));

    paginaActualSR = 1;
    srFiltrados = resultado;
    renderTablaSR();
    actualizarContadorSR();
}

function limpiarFiltrosSR() {
    filtrosSR = {};
    document.querySelectorAll('#modalFiltrosSROverlay input, #modalFiltrosSROverlay select')
        .forEach(el => el.value = '');
    cerrarModalFiltrosSR();
    aplicarFiltrosSR();
    actualizarBadgeFiltrosSR();
}

function actualizarBadgeFiltrosSR() {
    const activos = Object.values(filtrosSR).filter(v => v && v !== '').length;
    const badge = document.getElementById('badgeFiltrosSR');
    if (badge) {
        badge.textContent    = activos;
        badge.style.display  = activos > 0 ? 'inline-flex' : 'none';
    }
}

// ============================================
// BUSCADOR RÁPIDO
// ============================================
function configurarBuscadorSR() {
    const input = document.getElementById('searchInputSR');
    if (!input) return;
    let debounce;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(aplicarFiltrosSR, 280);
    });
}

// ============================================
// CONTADOR DE RESULTADOS
// ============================================
function actualizarContadorSR() {
    const el = document.getElementById('contadorResultadosSR');
    if (el) el.textContent = `${srFiltrados.length} registro${srFiltrados.length !== 1 ? 's' : ''}`;
}

// ============================================
// INDICADOR DE CARGA
// ============================================
function mostrarCargaSR(visible) {
    const el     = document.getElementById('loadingSR');
    const tabla  = document.getElementById('tablaSRWrapper');
    if (el)    el.style.display    = visible ? 'flex' : 'none';
    if (tabla) tabla.style.opacity = visible ? '0.4'  : '1';
}

function mostrarMensajeVacioSR(msg) {
    const tbody = document.getElementById('tabla-sr-body');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--color-text-placeholder)">${msg}</td></tr>`;
    }
}


// REALTIME
let canalRealtimeSR = null;

function suscribirRealTimeSR() {
    canalRealtimeSR = supabaseClient
        .channel('solicitud_revision_realtime')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'solicitud_revision'
        }, (payload) => {
            const existe = todosLosSR.some(r => r.id === payload.new.id);
            if (!existe) {
                todosLosSR.unshift(payload.new);
                aplicarFiltrosSR();
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'solicitud_revision'
        }, (payload) => {
            const idx = todosLosSR.findIndex(r => r.id === payload.new.id);
            if (idx !== -1) {
                todosLosSR[idx] = payload.new;
            } else {
                todosLosSR.unshift(payload.new)
            }
            aplicarFiltrosSR();
        })
        .subscribe()
}

function desuscribirRealtimeSR() {
    if (canalRealtimeSR) {
        supabaseClient.removeChannel(canalRealtimeSR);
        canalRealtimeSR = null;
    }
}

window.addEventListener('beforeunload', desuscribirRealtimeSR);

// ============================================
// HELPERS
// ============================================
function formatearFechaSR(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
        + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatearTelefonoSR(tel) {
    if (!tel) return '—';
    const d = tel.replace(/\D/g, '');
    if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
    return tel;
}

function configurarPaginacionSR() {
    const selector = document.getElementById('srPorPaginaSelect');
    if (selector) {
        selector.addEventListener('change', function() {
            srPorPagina = parseInt(this.value, 10);
            paginaActualSR = 1;
            renderTablaSR();
        });
    }
}

function actualizarPaginacionSR() {
    const total = srFiltrados.length;
    const totalPaginas = Math.ceil(total / srPorPagina);
    const inicio = total === 0 ? 0 : (paginaActualSR - 1) * srPorPagina + 1;
    const fin = Math.min(paginaActualSR * srPorPagina, total);

    const info = document.getElementById('infoPaginacionSR');
    if (info) info.textContent = `Mostrando ${inicio}-${fin} de ${total}`;

    const btnAnterior = document.getElementById('btnPaginaAnteriorSR');
    const btnSiguiente = document.getElementById('btnPaginaSiguienteSR');
    if (btnAnterior) btnAnterior.disabled = paginaActualSR === 1;
    if (btnSiguiente) btnSiguiente.disabled = paginaActualSR === totalPaginas || total === 0;
}

function paginaAnteriorSR() {
    if (paginaActualSR > 1) {
        paginaActualSR--;
        renderTablaSR();
    }
}

function paginaSiguienteSR() {
    const totalPaginas = Math.ceil(srFiltrados.length / srPorPagina);
    if (paginaActualSR < totalPaginas) {
        paginaActualSR++;
        renderTablaSR();
    }
}

// Asignar quien reviso la poliza
async function poblarSelectRevisorAsignado() {
    const select = document.getElementById('srRevisorAsignado');
    if (!select) return;

    select.innerHTML = '<option value="">— Sin asignar (va al equipo del portal) —</option>';

    try {
        const { data, error } = await supabaseClient
            .from('permisos_usuario')
            .select('usuario_id, usuarios!usuario_id(id, nombre, portales, activo)')
            .eq('permiso_clave', 'notificar_solicitud_revision')
            .eq('valor', true)
            .eq('usuarios.activo', true);

        if (error) throw error;

        const misPortales = datosUsuario?.portales || [];
        const candidatos = (data || [])
            .map(d => d.usuarios)
            .filter(u => u.portales?.some(p => misPortales.includes(p)));

        candidatos.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.nombre;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error cargando revisores:', error);
    }
}

function celdaTextoExpandible(texto, idUnico) {
    if (!texto) return '<em class="text-muted">-</em>'

    const LIMITE = 60;
    if (texto.length <= LIMITE) {
        return `<span class="texto-completo">${texto}</span>`
    }

    const preview = texto.substring(0, LIMITE) + '...';

    return `<div class="celda-texto-expandible">
        <span class="texto-preview" id="preview-${idUnico}">${preview}</span>
        <span class="text-completo" id="completo-${idUnico}" style="display:none;">${texto}</span>
        <button type="button" class="btn-mostrar-mas" onclick="toggleTextoExpandido('${idUnico}')">Mostrar más</button>
    </div>`;
}

function toggleTextoExpandido(idUnico) {
    const preview = document.getElementById(`preview-${idUnico}`);
    const completo = document.getElementById(`completo-${idUnico}`);
    const btn = completo.parentElement.querySelector('.btn-mostrar-mas');

    const expandido = completo.style.display !== 'none';

    if (expandido) {
        preview.style.display = 'inline';
        completo.style.display = 'none';
        btn.textContent = 'Mostrar más';
    } else {
        preview.style.display = 'none';
        completo.style.display = 'inline';
        btn.textContent = 'Ver menos'
    }
}