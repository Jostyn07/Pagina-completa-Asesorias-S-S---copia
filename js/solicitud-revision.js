// ============================================
// SOLICITUD DE REVISIÓN — solicitud-revision.js
// ============================================

// ============================================
// VARIABLES GLOBALES
// ============================================
let todosLosSR = [];
let srFiltrados = [];
let filtrosSR = {};
let modalTextoSRId = null;
let modalTextoSRCampo = null;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();
    await cargarRegistrosSR();
    configurarBuscadorSR();

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
// APLICAR FILTROS
// ============================================
function aplicarFiltrosSR() {
    let resultado = [...todosLosSR];

    // Buscador rápido
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

    if (f.nombre) {
        resultado = resultado.filter(r => (r.nombre || '').toLowerCase().includes(f.nombre.toLowerCase()));
    }
    if (f.telefono) {
        resultado = resultado.filter(r => (r.telefono || '').includes(f.telefono));
    }
    if (f.compania) {
        resultado = resultado.filter(r => (r.compania || '').toLowerCase().includes(f.compania.toLowerCase()));
    }
    if (f.actualizado === 'pendiente') {
        resultado = resultado.filter(r => r.actualizado === null);
    } else if (f.actualizado) {
        resultado = resultado.filter(r => r.actualizado === f.actualizado);
    }
    if (f.solicitudDesde) {
        resultado = resultado.filter(r => r.fecha_solicitud && new Date(r.fecha_solicitud) >= new Date(f.solicitudDesde));
    }
    if (f.solicitudHasta) {
        resultado = resultado.filter(r => r.fecha_solicitud && new Date(r.fecha_solicitud) <= new Date(f.solicitudHasta + 'T23:59:59'));
    }
    if (f.actDesde) {
        resultado = resultado.filter(r => r.fecha_actualizacion && new Date(r.fecha_actualizacion) >= new Date(f.actDesde));
    }
    if (f.actHasta) {
        resultado = resultado.filter(r => r.fecha_actualizacion && new Date(r.fecha_actualizacion) <= new Date(f.actHasta + 'T23:59:59'));
    }

    srFiltrados = resultado;
    renderTablaSR();
    actualizarContadorSR();
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
                <td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-placeholder)">
                    <span class="material-symbols-rounded" style="font-size:2.5rem;display:block;margin-bottom:8px">search_off</span>
                    No hay registros que mostrar
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = srFiltrados.map(r => buildFilaSR(r)).join('');
}

function buildFilaSR(r) {
    // Badge Actualizado
    const claseAct = r.actualizado === 'Si'
        ? 'fila-sr-actualizado-si'
        : r.actualizado === 'No'
            ? 'fila-sr-actualizado-no'
            : '';

    const btnActualizado = `
        <button class="btn-actualizado btn-act-${(r.actualizado || 'null').toLowerCase()}"
                data-id="${r.id}"
                onclick="ciclarActualizadoDesdeBtn(this)"
                title="Click para cambiar estado">
            ${r.actualizado === 'Si' ? '✅ Sí' : r.actualizado === 'No' ? '❌ No' : '— Pendiente'}
        </button>`;

    // Nota de actualización — editable para todos
    const notaActDisplay = r.nota_actualizacion
        ? `<span class="nota-preview">${r.nota_actualizacion.substring(0, 60)}${r.nota_actualizacion.length > 60 ? '…' : ''}</span>`
        : '<em class="text-muted">Sin nota</em>';

    // Observación — editable para todos
    const obsDisplay = r.observacion
        ? `<span class="obs-preview">${r.observacion.substring(0, 60)}${r.observacion.length > 60 ? '…' : ''}</span>`
        : '<em class="text-muted">Agregar...</em>';

    const fechaSolicitud   = formatearFechaSR(r.fecha_solicitud);
    const fechaActualizacion = r.fecha_actualizacion ? formatearFechaSR(r.fecha_actualizacion) : '<em class="text-muted">—</em>';

    return `
        <tr class="fila-sr ${claseAct}" data-id="${r.id}">
            <td data-label="Fecha Solicitud" class="celda-fecha">${fechaSolicitud}</td>
            <td data-label="Nombre">${r.nombre || '—'}</td>
            <td data-label="Teléfono">${formatearTelefonoSR(r.telefono)}</td>
            <td data-label="Compañía">${r.compania || '—'}</td>
            <td data-label="Actualizado" class="celda-actualizado">${btnActualizado}</td>
            <td data-label="Nota actualización" class="celda-nota-act">
                <span class="celda-editable"
                      data-id="${r.id}"
                      onclick="abrirModalTextoSRDesdeEl(this, 'nota_actualizacion')"
                      title="Click para editar nota">
                    ${notaActDisplay}
                </span>
            </td>
            <td data-label="Fecha actualización" class="celda-fecha">${fechaActualizacion}</td>
            <td data-label="Observación" class="celda-obs-sr">
                <span class="celda-editable"
                      data-id="${r.id}"
                      onclick="abrirModalTextoSRDesdeEl(this, 'observacion')"
                      title="Click para editar observación">
                    ${obsDisplay}
                </span>
            </td>
        </tr>`;
}

// ============================================
// CICLO BOTÓN "ACTUALIZADO"
// ============================================
function ciclarActualizadoDesdeBtn(btn) {
    const id = btn.dataset.id;
    const reg = todosLosSR.find(r => r.id === id);
    const valorActual = reg ? reg.actualizado : null;
    ciclarActualizado(id, valorActual);
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

// ============================================
// MODAL AGREGAR MANUALMENTE
// ============================================
function abrirModalAgregar() {
    // Limpiar campos
    ['srNombre','srTelefono','srCompania','srNotaActualizacion','srObservacion'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('srActualizado').value = '';
    document.getElementById('modalAgregarSR').classList.add('show');
    document.getElementById('srNombre').focus();
}

function cerrarModalAgregar() {
    document.getElementById('modalAgregarSR').classList.remove('show');
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
        const nuevo = {
            nombre,
            telefono:           document.getElementById('srTelefono').value.trim() || null,
            compania:           document.getElementById('srCompania').value.trim() || null,
            actualizado:        document.getElementById('srActualizado').value || null,
            nota_actualizacion: document.getElementById('srNotaActualizacion').value.trim() || null,
            observacion:        document.getElementById('srObservacion').value.trim() || null,
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
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-placeholder)">${msg}</td></tr>`;
    }
}

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