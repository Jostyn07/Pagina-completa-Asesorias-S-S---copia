// ============================================
// PARA REVISAR — para-revisar.js
// ============================================

// ============================================
// VARIABLES GLOBALES
// ============================================
let todosLosRegistros = [];
let registrosFiltrados = [];
let filtroTipoActivo = null;       // 'robadas' | 'canceladas' | 'dobles' | 'no-registran' | 'triples' | null
let mostrarRecuperados = false;    // Por defecto oculta los "Sí"
let filtrosAvanzados = {};
let esAdmin = false;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();
    esAdmin = esAdministrador();
    await cargarRegistros();
    configurarBuscador();

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
async function cargarRegistros() {
    try {
        mostrarCarga(true);

        const { data, error } = await supabaseClient
            .from('revision_mercado')
            .select('*')
            .order('fecha_ingreso', { ascending: false });

        if (error) throw error;

        todosLosRegistros = data || [];
        aplicarFiltros();
        actualizarContadores();

    } catch (error) {
        console.error('❌ Error al cargar registros:', error);
        mostrarMensajeVacio('Error al cargar datos. Intenta recargar la página.');
    } finally {
        mostrarCarga(false);
    }
}

// ============================================
// CONTADORES DE TARJETAS
// ============================================
function actualizarContadores() {
    // Contamos solo los NO recuperados (null o 'No') para los totales de alerta
    const activos = todosLosRegistros.filter(r => r.recuperado !== 'Si');

    const robadas    = activos.filter(r => r.estado_mercado === 'Robado').length;
    const canceladas = activos.filter(r => r.estado_mercado === 'Cancelado a P.C').length;
    const dobles     = activos.filter(r => r.estado_mercado === 'Doble poliza').length;
    const triples    = activos.filter(r => r.estado_mercado === 'Triple poliza').length;
    const noRegistran= activos.filter(r => r.estado_mercado === 'No registra').length;

    document.getElementById('polizas-robadas').textContent      = robadas;
    document.getElementById('polizas-canceladas-revision').textContent = canceladas;
    document.getElementById('polizas-dobles').textContent       = dobles;
    document.getElementById('polizas-triples').textContent      = triples;
    document.getElementById('polizas-no-registran').textContent = noRegistran;
}

// ============================================
// FILTRO POR TIPO (click en tarjetas)
// ============================================
function filtrarPorTipo(tipo) {
    // Si ya está activo ese tipo, desactivar (toggle)
    if (filtroTipoActivo === tipo) {
        filtroTipoActivo = null;
        document.querySelectorAll('.inf__cuadro').forEach(c => c.classList.remove('inf__cuadro--activo'));
    } else {
        filtroTipoActivo = tipo;
        document.querySelectorAll('.inf__cuadro').forEach(c => c.classList.remove('inf__cuadro--activo'));
        const idx = { robadas: 0, canceladas: 1, dobles: 2, triples: 3, 'no-registran': 4 };
        const cuadros = document.querySelectorAll('.inf__cuadro');
        if (cuadros[idx[tipo]]) cuadros[idx[tipo]].classList.add('inf__cuadro--activo');
    }
    aplicarFiltros();
}

// ============================================
// APLICAR TODOS LOS FILTROS
// ============================================
function aplicarFiltros() {
    let resultado = [...todosLosRegistros];

    // Filtro por tipo (tarjetas)
    if (filtroTipoActivo) {
        const mapaTipo = {
            robadas: 'Robado',
            canceladas: 'Cancelado a P.C',
            dobles: 'Doble poliza',
            triples: 'Triple poliza',
            'no-registran': 'No registra',
        };
        resultado = resultado.filter(r => r.estado_mercado === mapaTipo[filtroTipoActivo]);
    }

    // Buscador rápido
    const termino = (document.getElementById('searchInputRevisar')?.value || '').toLowerCase().trim();
    if (termino) {
        resultado = resultado.filter(r =>
            (r.nombre_cliente || '').toLowerCase().includes(termino) ||
            (r.telefono || '').includes(termino) ||
            (r.operador_nombre || '').toLowerCase().includes(termino)
        );
    }

    // Filtros avanzados
    const f = filtrosAvanzados;

    if (f.operador) {
        resultado = resultado.filter(r => (r.operador_nombre || '').toLowerCase().includes(f.operador.toLowerCase()));
    }
    if (f.nombre) {
        resultado = resultado.filter(r => (r.nombre_cliente || '').toLowerCase().includes(f.nombre.toLowerCase()));
    }
    if (f.telefono) {
        resultado = resultado.filter(r => (r.telefono || '').includes(f.telefono));
    }
    if (f.revisionPor) {
        resultado = resultado.filter(r => (r.revision_realizada_por || '').toLowerCase().includes(f.revisionPor.toLowerCase()));
    }
    if (f.npn1) {
        resultado = resultado.filter(r => (r.npn1 || '').toLowerCase().includes(f.npn1.toLowerCase()));
    }
    if (f.npn2) {
        resultado = resultado.filter(r => (r.npn2 || '').toLowerCase().includes(f.npn2.toLowerCase()));
    }
    if (f.fechaIngresoDesde) {
        resultado = resultado.filter(r => r.fecha_ingreso && new Date(r.fecha_ingreso) >= new Date(f.fechaIngresoDesde));
    }
    if (f.fechaIngresoHasta) {
        resultado = resultado.filter(r => r.fecha_ingreso && new Date(r.fecha_ingreso) <= new Date(f.fechaIngresoHasta + 'T23:59:59'));
    }
    if (f.fechaRecupDesde) {
        resultado = resultado.filter(r => r.fecha_recuperacion && new Date(r.fecha_recuperacion) >= new Date(f.fechaRecupDesde));
    }
    if (f.fechaRecupHasta) {
        resultado = resultado.filter(r => r.fecha_recuperacion && new Date(r.fecha_recuperacion) <= new Date(f.fechaRecupHasta));
    }

    registrosFiltrados = resultado;
    renderTabla();
    actualizarContadorResultados();
}

// ============================================
// RENDER DE TABLA
// ============================================
function renderTabla() {
    const tbody = document.getElementById('tabla-revisar-body');
    if (!tbody) return;

    if (registrosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align:center; padding: 40px; color: var(--color-text-placeholder);">
                    <span class="material-symbols-rounded" style="font-size:2.5rem; display:block; margin-bottom:8px;">search_off</span>
                    No hay registros que mostrar
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = registrosFiltrados.map(r => buildFila(r)).join('');
}

function buildFila(r) {
    const claseRecuperado = r.recuperado === 'Si'
        ? 'fila-recuperada-si'
        : r.recuperado === 'No'
            ? 'fila-recuperada-no'
            : '';

    const badgeMercado = getBadgeMercado(r.estado_mercado);

    const btnRecuperado = `
        <button class="btn-recuperado btn-rec-${(r.recuperado || 'null').toLowerCase()}"
                data-id="${r.id}"
                onclick="ciclarRecuperadoDesdeBtn(this)"
                title="Click para cambiar estado">
            ${r.recuperado === 'Si' ? '✅ Sí' : r.recuperado === 'No' ? '❌ No' : '— Pendiente'}
        </button>`;

    const fechaIngreso   = formatearFecha(r.fecha_ingreso);
    const fechaRecup     = r.fecha_recuperacion ? formatearFechaCorta(r.fecha_recuperacion) : '<span class="text-muted">—</span>';

    // NPN1 y NPN2: editable solo para admin
    const npn1 = esAdmin
        ? `<span class="celda-editable" onclick="iniciarEdicion(this, '${r.id}', 'npn1')">${r.npn1 || '<em class="text-muted">—</em>'}</span>`
        : (r.npn1 || '<span class="text-muted">—</span>');

    const npn2 = esAdmin
        ? `<span class="celda-editable" onclick="iniciarEdicion(this, '${r.id}', 'npn2')">${r.npn2 || '<em class="text-muted">—</em>'}</span>`
        : (r.npn2 || '<span class="text-muted">—</span>');

    // Notas: editable para todos
    const notaTexto = r.notas ? stripHtml(r.notas) : '';
    const notaDisplay = notaTexto
        ? `<span class="nota-preview">${notaTexto.substring(0, 60)}${notaTexto.length > 60 ? '…' : ''}</span>`
        : '<em class="text-muted">Sin nota</em>';

    // Observación: editable para todos
    const obsDisplay = r.observacion_operador
        ? `<span class="obs-preview">${r.observacion_operador.substring(0, 60)}${r.observacion_operador.length > 60 ? '…' : ''}</span>`
        : '<em class="text-muted">Agregar...</em>';

    const linkCliente = r.cliente_id
        ? `<a href="./cliente_editar.html?id=${r.cliente_id}" class="link-cliente" target="_blank">${r.nombre_cliente || '—'}</a>`
        : (r.nombre_cliente || '—');

    return `
        <tr class="fila-revisar ${claseRecuperado}" data-id="${r.id}">
            <td data-label="Fecha Ingreso" class="celda-fecha">${fechaIngreso}</td>
            <td data-label="Operador">${r.operador_nombre || '—'}</td>
            <td data-label="Cliente" class="td1">
                <div class="td1__flex">${linkCliente}</div>
            </td>
            <td data-label="Teléfono">${formatearTelefono(r.telefono)}</td>
            <td data-label="Compañía">${r.compania || '—'}</td>
            <td data-label="Estado Mercado">${badgeMercado}</td>
            <td data-label="NPN 1" class="celda-npn">${npn1}</td>
            <td data-label="NPN 2" class="celda-npn">${npn2}</td>
            <td data-label="Notas" class="celda-notas">
                <span class="celda-editable celda-notas-inner"
                    data-id="${r.id}"
                    onclick="abrirModalTextoDesdeEl(this, 'notas')"
                    title="Click para editar nota">
                    ${notaDisplay}
                </span>
            </td>
            <td data-label="Observación" class="celda-observacion">
                <span class="celda-editable celda-obs-inner"
                    data-id="${r.id}"
                    onclick="abrirModalTextoDesdeEl(this, 'observacion_operador')"
                    title="Click para agregar observación">
                    ${obsDisplay}
                </span>
            </td>
            <td data-label="Recuperado" class="celda-recuperado">${btnRecuperado}</td>
            <td data-label="Fecha Recuperación" class="celda-fecha">${fechaRecup}</td>
            <td data-label="Revisión por" class="celda-revision-por">${r.revision_realizada_por || '—'}</td>
        </tr>`;
}

// ============================================
// CICLO DEL BOTÓN "RECUPERADO"
// ============================================
async function ciclarRecuperado(id, valorActual) {
    const siguiente = valorActual === null ? 'Si'
                    : valorActual === 'Si'  ? 'No'
                    : null;

    try {
        const updateData = { recuperado: siguiente };

        // Si se marca "Sí" → sellar fecha_recuperacion
        if (siguiente === 'Si') {
            updateData.fecha_recuperacion = new Date().toISOString().split('T')[0];
        }

        // Activar o cancelar el flag
        if (siguiente === "Si" || siguiente === 'No') {
            updateData.sr_pendiente = true;
            updateData.sr_pendiente_desde = new Date().toISOString();
            updateData.sr_pendiente_valor = siguiente;
        } else {
            updateData.sr_pendiente = false;
            updateData.sr_pendiente_desde = null;
            updateData.sr_pendiente_valor = null;
        }

        const { error } = await supabaseClient
            .from('revision_mercado')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;

        // Actualizar en memoria local
        const idx = todosLosRegistros.findIndex(r => r.id === id);
        if (idx !== -1) {
            todosLosRegistros[idx].recuperado = siguiente;
            if (siguiente === 'Si') {
                todosLosRegistros[idx].fecha_recuperacion = updateData.fecha_recuperacion;
            }
        }

        aplicarFiltros();
        actualizarContadores();

    } catch (error) {
        console.error('❌ Error al actualizar recuperado:', error);
        alert('No se pudo actualizar el estado. Intenta de nuevo.');
    }
}

function ciclarRecuperadoDesdeBtn(btn) {
    const id = btn.dataset.id;
    const reg = todosLosRegistros.find(r => r.id === id);
    ciclarRecuperado(id, reg ? reg.recuperado : null);
}

function abrirModalTextoDesdeEl(el, campo) {
    const id = el.dataset.id;
    const reg = todosLosRegistros.find(r => r.id === id);
    const valor = reg ? (reg[campo] || '') : '';
    abrirModalTexto(id, campo, valor);
}

// ============================================
// EDICIÓN INLINE — NPN1 / NPN2 (campos cortos)
// ============================================
function iniciarEdicion(span, id, campo) {
    if (!esAdmin) return;
    if (span.querySelector('input')) return; // Ya está en edición

    const valorActual = span.dataset.valor || span.textContent.trim().replace('—', '');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = valorActual === '—' ? '' : valorActual;
    input.className = 'input-inline-edit';
    input.dataset.id = id;
    input.dataset.campo = campo;

    span.innerHTML = '';
    span.appendChild(input);
    input.focus();

    const guardar = async () => {
        const nuevoValor = input.value.trim() || null;
        try {
            await guardarCampoSimple(id, campo, nuevoValor);
            span.innerHTML = nuevoValor || '<em class="text-muted">—</em>';
            span.dataset.valor = nuevoValor || '';
            const idx = todosLosRegistros.findIndex(r => r.id === id);
            if (idx !== -1) todosLosRegistros[idx][campo] = nuevoValor;
        } catch (e) {
            alert('Error al guardar. El valor no se actualizó.');
            span.innerHTML = valorActual || '<em class="text-muted">—</em>'; // revertir
        }
    };

    input.addEventListener('blur', guardar);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { span.innerHTML = valorActual || '<em class="text-muted">—</em>'; }
    });
}

// ============================================
// MODAL DE TEXTO LARGO (Notas / Observación)
// ============================================
let modalTextoId = null;
let modalTextoCampo = null;

function abrirModalTexto(id, campo, valorActual) {
    modalTextoId = id;
    modalTextoCampo = campo;

    const titulo = campo === 'notas' ? 'Editar Nota' : 'Observación del Operador';
    const textoLimpio = campo === 'notas' ? stripHtml(valorActual) : valorActual;

    document.getElementById('modalTextoTitulo').textContent = titulo;
    document.getElementById('modalTextoArea').value = textoLimpio || '';
    document.getElementById('modalTextoOverlay').classList.add('show');
    document.getElementById('modalTextoArea').focus();
}

function cerrarModalTexto() {
    document.getElementById('modalTextoOverlay').classList.remove('show');
    modalTextoId = null;
    modalTextoCampo = null;
}

async function guardarModalTexto() {
    if (!modalTextoId || !modalTextoCampo) return;

    const valor = document.getElementById('modalTextoArea').value.trim() || null;
    const btn = document.getElementById('btnGuardarTexto');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        await guardarCampoSimple(modalTextoId, modalTextoCampo, valor);

        const idx = todosLosRegistros.findIndex(r => r.id === modalTextoId);
        if (idx !== -1) todosLosRegistros[idx][modalTextoCampo] = valor;

        cerrarModalTexto();
        aplicarFiltros();

    } catch (error) {
        alert('Error al guardar. Intenta de nuevo.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
    }
}

// ============================================
// GUARDAR CAMPO EN SUPABASE
// ============================================
async function guardarCampoSimple(id, campo, valor) {
    const { error } = await supabaseClient
        .from('revision_mercado')
        .update({ [campo]: valor, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}

// ============================================
// MODAL DE FILTROS AVANZADOS
// ============================================
function abrirModalFiltros() {
    document.getElementById('modalFiltrosOverlay').classList.add('show');
    // Pre-cargar valores actuales
    document.getElementById('filtroRevOperador').value    = filtrosAvanzados.operador || '';
    document.getElementById('filtroRevNombre').value      = filtrosAvanzados.nombre || '';
    document.getElementById('filtroRevTelefono').value    = filtrosAvanzados.telefono || '';
    document.getElementById('filtroRevNpn1').value        = filtrosAvanzados.npn1 || '';
    document.getElementById('filtroRevNpn2').value        = filtrosAvanzados.npn2 || '';
    document.getElementById('filtroRevRevisionPor').value = filtrosAvanzados.revisionPor || '';
    document.getElementById('filtroRevIngresoDesde').value= filtrosAvanzados.fechaIngresoDesde || '';
    document.getElementById('filtroRevIngresoHasta').value= filtrosAvanzados.fechaIngresoHasta || '';
    document.getElementById('filtroRevRecupDesde').value  = filtrosAvanzados.fechaRecupDesde || '';
    document.getElementById('filtroRevRecupHasta').value  = filtrosAvanzados.fechaRecupHasta || '';
}

function cerrarModalFiltros() {
    document.getElementById('modalFiltrosOverlay').classList.remove('show');
}

function aplicarFiltrosAvanzados() {
    filtrosAvanzados = {
        operador:         document.getElementById('filtroRevOperador').value.trim(),
        nombre:           document.getElementById('filtroRevNombre').value.trim(),
        telefono:         document.getElementById('filtroRevTelefono').value.trim(),
        npn1:             document.getElementById('filtroRevNpn1').value.trim(),
        npn2:             document.getElementById('filtroRevNpn2').value.trim(),
        revisionPor:      document.getElementById('filtroRevRevisionPor').value.trim(),
        fechaIngresoDesde:document.getElementById('filtroRevIngresoDesde').value,
        fechaIngresoHasta:document.getElementById('filtroRevIngresoHasta').value,
        fechaRecupDesde:  document.getElementById('filtroRevRecupDesde').value,
        fechaRecupHasta:  document.getElementById('filtroRevRecupHasta').value,
    };

    cerrarModalFiltros();
    aplicarFiltros();
    actualizarIndicadorFiltros();
}

function limpiarFiltrosAvanzados() {
    filtrosAvanzados = {};
    document.querySelectorAll('#modalFiltrosOverlay input').forEach(i => i.value = '');
    cerrarModalFiltros();
    aplicarFiltros();
    actualizarIndicadorFiltros();
}

function actualizarIndicadorFiltros() {
    const activos = Object.values(filtrosAvanzados).filter(v => v && v !== '').length;
    const badge = document.getElementById('badgeFiltrosRev');
    if (badge) {
        badge.textContent = activos;
        badge.style.display = activos > 0 ? 'inline-flex' : 'none';
    }
}

// ============================================
// TOGGLE "VER RECUPERADOS"
// ============================================
function toggleVerRecuperados() {
    mostrarRecuperados = !mostrarRecuperados;
    const btn = document.getElementById('btnToggleRecuperados');
    if (btn) {
        btn.innerHTML = mostrarRecuperados
            ? '<span class="material-symbols-rounded">visibility_off</span> Ocultar recuperados'
            : '<span class="material-symbols-rounded">visibility</span> Ver recuperados';
    }
    aplicarFiltros();
}

// ============================================
// BUSCADOR RÁPIDO
// ============================================
function configurarBuscador() {
    const input = document.getElementById('searchInputRevisar');
    if (!input) return;
    let debounce;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(aplicarFiltros, 280);
    });
}

function buscarEnTablaRevisar() {
    aplicarFiltros();
}

// ============================================
// CONTADOR DE RESULTADOS
// ============================================
function actualizarContadorResultados() {
    const el = document.getElementById('contadorResultadosRev');
    if (el) el.textContent = `${registrosFiltrados.length} registro${registrosFiltrados.length !== 1 ? 's' : ''}`;
}

// ============================================
// INDICADOR DE CARGA
// ============================================
function mostrarCarga(visible) {
    const el = document.getElementById('loadingRevisar');
    if (el) el.style.display = visible ? 'flex' : 'none';
    const tabla = document.getElementById('tablaRevisarWrapper');
    if (tabla) tabla.style.opacity = visible ? '0.4' : '1';
}

function mostrarMensajeVacio(msg) {
    const tbody = document.getElementById('tabla-revisar-body');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:40px;color:var(--color-text-placeholder)">${msg}</td></tr>`;
    }
}

// ============================================
// HELPERS
// ============================================
function formatearFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
        + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatearFechaCorta(str) {
    if (!str) return '—';
    // str puede ser 'YYYY-MM-DD'
    const [y, m, d] = str.split('-');
    return `${m}/${d}/${y}`;
}

function formatearTelefono(tel) {
    if (!tel) return '—';
    const d = tel.replace(/\D/g, '');
    if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
    return tel;
}

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function getBadgeMercado(estado) {
    const mapa = {
        'Robado':         ['badge-mercado badge-robado',    'gpp_bad',    'Robado'],
        'Cancelado a P.C':['badge-mercado badge-cancelado', 'cancel',     'Cancelado'],
        'Doble poliza':   ['badge-mercado badge-doble',     'file_copy',  'Doble Póliza'],
        'Triple poliza':  ['badge-mercado badge-triple',    'library_books','Triple Póliza'],
        'No registra':    ['badge-mercado badge-noregistra','help_outline','No Registra'],
    };
    const [cls, icon, label] = mapa[estado] || ['badge-mercado', 'info', estado || '—'];
    return `<span class="${cls}"><span class="material-symbols-rounded">${icon}</span>${label}</span>`;
}