// ============================================
// VARIABLES GLOBALES
// ============================================
let todosLosRegistros = [];
let registrosFiltrados = [];
let filtroTipoActivo = null;       // 'robadas' | 'canceladas' | 'dobles' | 'no-registran' | 'triples' | null
let mostrarRecuperados = false;    // Por defecto oculta los "Sí"
let filtrosAvanzados = {};
let esAdmin = false;
let paginaActualRev = 1;
let registrosPorPaginaRev = 10;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();
    esAdmin = esAdministrador();
    await cargarRegistros();
    configurarBuscador();
    configurarPaginacionRev();

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
        inicializarFiltrosMultiselectRev(); 
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
    const recuperados = todosLosRegistros.filter(r => r.recuperado === 'Si').length;
    
    document.getElementById('polizas-recuperados').textContent = recuperados;  
    document.getElementById('polizas-robadas').textContent      = robadas;
    document.getElementById('polizas-canceladas-revision').textContent = canceladas;
    document.getElementById('polizas-dobles').textContent       = dobles;
    document.getElementById('polizas-triples').textContent      = triples;
}

// ============================================
// FILTRO POR TIPO (click en tarjetas)
// ============================================
function filtrarPorTipo(tipo) {
    const idx = {robadas: 0, canceladas: 1, dobles: 2, triple: 3, 'no-registran': 4, recuperados: 5 };
    // Si ya está activo ese tipo, desactivar (toggle)
    if (filtroTipoActivo === tipo) {
        filtroTipoActivo = null;
        document.querySelectorAll('.inf__cuadro').forEach(c => c.classList.remove('inf__cuadro--activo'));
    } else {
        filtroTipoActivo = tipo;
        document.querySelectorAll('.inf__cuadro').forEach(c => c.classList.remove('inf__cuadro--activo'));
        const idx = { robadas: 0, canceladas: 1, dobles: 2, triples: 3, 'no-registran': 4, recuperados: 5 };
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

    // 👇 EL FIX: esto nunca se aplicaba, por eso el botón no hacía nada
    if (!mostrarRecuperados) {
        resultado = resultado.filter(r => r.recuperado !== 'Si');
    }

    if (filtroTipoActivo) {
        if (filtroTipoActivo === 'recuperados') {
            resultado = resultado.filter(r => r.recuperado === 'Si');
        } else {
            const mapaTipo = {
                robadas: 'Robado', canceladas: 'Cancelado a P.C',
                dobles: 'Doble poliza', triples: 'Triple poliza', 'no-registran': 'No registra',
            };
            resultado = resultado.filter(r => r.estado_mercado === mapaTipo[filtroTipoActivo]);
        }
    }

    const termino = (document.getElementById('searchInputRevisar')?.value || '').toLowerCase().trim();
    if (termino) {
        resultado = resultado.filter(r =>
            (r.nombre_cliente || '').toLowerCase().includes(termino) ||
            (r.telefono || '').includes(termino) ||
            (r.operador_nombre || '').toLowerCase().includes(termino)
        );
    }

    const f = filtrosAvanzados;

    if (f.operador && f.operador.length > 0) {
        resultado = resultado.filter(r => f.operador.includes(r.operador_nombre));
    }
    if (f.nombre) {
        resultado = resultado.filter(r => (r.nombre_cliente || '').toLowerCase().includes(f.nombre.toLowerCase()));
    }
    if (f.telefono) {
        resultado = resultado.filter(r => (r.telefono || '').includes(f.telefono));
    }
    if (f.revisionPor && f.revisionPor.length > 0) {
        resultado = resultado.filter(r => f.revisionPor.includes(r.revision_realizada_por));
    }
    if (f.npn1 && f.npn1.length > 0) {
        resultado = resultado.filter(r => f.npn1.includes(r.npn1));
    }
    if (f.npn2 && f.npn2.length > 0) {
        resultado = resultado.filter(r => f.npn2.includes(r.npn2));
    }
    if (f.recuperada) {
        resultado = resultado.filter(r => r.recuperado === f.recuperada);
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

    paginaActualRev = 1;
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
            actualizarPaginacionRev();
        return;
    }

    const inicio = (paginaActualRev - 1) * registrosPorPaginaRev;
    const fin = inicio + registrosPorPaginaRev;
    const pagina = registrosFiltrados.slice(inicio, fin);

    tbody.innerHTML = pagina.map(r => buildFila(r)).join('');
    actualizarPaginacionRev();
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

    const avisoPendiente = r.sr_pendiente
        ? `<span class="badge-sr-pendiente" title="Se enviará a Solicitud de Revisión si no cambia en 5 minutos">⏳ Pendiente de envío</span>`
        : '';   
    const fechaIngreso   = formatearFecha(r.fecha_ingreso);
    const fechaRecup     = r.fecha_recuperacion ? formatearFechaCorta(r.fecha_recuperacion) : '<span class="text-muted">—</span>';

    // NPN1 y NPN2: ya no se editan desde la tabla (solo lectura)
    const npn1 = r.npn1 || '<span class="text-muted">—</span>';
    const npn2 = r.npn2 || '<span class="text-muted">—</span>';

    // Notas: ya no se editan desde la tabla (solo lectura)
    const notaTexto = r.notas ? stripHtml(r.notas) : '';
    const notaDisplay = notaTexto
        ? `<span class="nota-preview">${notaTexto.substring(0, 60)}${notaTexto.length > 60 ? '…' : ''}</span>`
        : '<em class="text-muted">Sin nota</em>';

    // Observación: editable para todos (esto no cambia)
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
            <td data-label="Notas" class="celda-notas">${notaDisplay}</td>
            <td data-label="Observación" class="celda-observacion">
                <span class="celda-editable celda-obs-inner"
                    data-id="${r.id}"
                    onclick="abrirModalTextoDesdeEl(this, 'observacion_operador')"
                    title="Click para agregar observación">
                    ${obsDisplay}
                </span>
            </td>
            <td data-label="Recuperado" class="celda-recuperado">${btnRecuperado}${avisoPendiente}</td>
            <td data-label="Fecha Recuperación" class="celda-fecha">${fechaRecup}</td>
            <td data-label="Recuperado por / Cancelado por">${r.recuperado_por || '<span class="text-muted">—</span>'}</td>
            <td data-label="Revisión por" class="celda-revision-por">${r.revision_realizada_por || '—'}</td>
            <td data-label="Observación de cambio de estado" class="celda-observacion">
                ${r.observacion_cambio_estado
                    ? `<span class="obs-preview">${r.observacion_cambio_estado.substring(0, 60)}${r.observacion_cambio_estado.length > 60 ? '…' : ''}</span>`
                    : '<em class="text-muted">—</em>'}
            </td>
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
            updateData.recuperado_por = datosUsuario?.nombre || 'Desconocido';
        } else {
            updateData.sr_pendiente = false;
            updateData.sr_pendiente_desde = null;
            updateData.sr_pendiente_valor = null;
            updateData.recuperado_por = null;
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

    document.getElementById('filtroRevNombre').value       = filtrosAvanzados.nombre || '';
    document.getElementById('filtroRevTelefono').value     = filtrosAvanzados.telefono || '';
    document.getElementById('filtroRevRecuperada').value   = filtrosAvanzados.recuperada || '';
    document.getElementById('filtroRevIngresoDesde').value = filtrosAvanzados.fechaIngresoDesde || '';
    document.getElementById('filtroRevIngresoHasta').value = filtrosAvanzados.fechaIngresoHasta || '';
    document.getElementById('filtroRevRecupDesde').value   = filtrosAvanzados.fechaRecupDesde || '';
    document.getElementById('filtroRevRecupHasta').value   = filtrosAvanzados.fechaRecupHasta || '';

    filtroRevOperador.setSeleccionados(filtrosAvanzados.operador || []);
    filtroRevNpn1.setSeleccionados(filtrosAvanzados.npn1 || []);
    filtroRevNpn2.setSeleccionados(filtrosAvanzados.npn2 || []);
    filtroRevRevisionPor.setSeleccionados(filtrosAvanzados.revisionPor || []);
}

function cerrarModalFiltros() {
    document.getElementById('modalFiltrosOverlay').classList.remove('show');
}

function aplicarFiltrosAvanzados() {
    filtrosAvanzados = {
        operador:          filtroRevOperador.getSeleccionados(),
        nombre:            document.getElementById('filtroRevNombre').value.trim(),
        telefono:          document.getElementById('filtroRevTelefono').value.trim(),
        npn1:              filtroRevNpn1.getSeleccionados(),
        npn2:              filtroRevNpn2.getSeleccionados(),
        revisionPor:       filtroRevRevisionPor.getSeleccionados(),
        recuperada:        document.getElementById('filtroRevRecuperada').value,
        fechaIngresoDesde: document.getElementById('filtroRevIngresoDesde').value,
        fechaIngresoHasta: document.getElementById('filtroRevIngresoHasta').value,
        fechaRecupDesde:   document.getElementById('filtroRevRecupDesde').value,
        fechaRecupHasta:   document.getElementById('filtroRevRecupHasta').value,
    };

    cerrarModalFiltros();
    aplicarFiltros();
    actualizarIndicadorFiltros();
}

function limpiarFiltrosAvanzados() {
    filtrosAvanzados = {};
    document.querySelectorAll('#modalFiltrosOverlay input, #modalFiltrosOverlay select').forEach(i => i.value = '');
    filtroRevOperador.limpiar();
    filtroRevNpn1.limpiar();
    filtroRevNpn2.limpiar();
    filtroRevRevisionPor.limpiar();
    cerrarModalFiltros();
    aplicarFiltros();
    actualizarIndicadorFiltros();
}

function actualizarIndicadorFiltros() {
    const activos = Object.values(filtrosAvanzados).filter(v => Array.isArray(v) ? v.length > 0 : (v && v !== '')).length;
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

function configurarPaginacionRev() {
    const selector = document.getElementById('revPorPagina');
    if (selector) {
        selector.addEventListener('change', function () {
            registrosPorPaginaRev = parseInt(this.value, 10);
            paginaActualRev = 1;
            renderTabla();
        });
    }
}

function actualizarPaginacionRev() {
    const total = registrosFiltrados.length
    const totalPaginas = Math.ceil(total / registrosPorPaginaRev);
    const inicio = total === 0 ? 0 : (paginaActualRev - 1) * registrosPorPaginaRev + 1;
    const fin = Math.min(paginaActualRev * registrosPorPaginaRev, total);

    const info = document.getElementById('infoPaginacionRev');
    if (info) info.textContent = `Mostrando ${inicio}-${fin} de ${total}`;

    const btnAnterior = document.getElementById('btnPaginaAnteriorRev');
    const btnSiguiente = document.getElementById('btnPaginaSiguienteRev');
    if (btnAnterior) btnAnterior.disabled = paginaActualRev === 1;
    if (btnSiguiente) btnSiguiente.disabled = paginaActualRev === totalPaginas || total === 0;
}

function btnPaginaAnteriorRev() {
    if (paginaActualRev > 1) {
        paginaActualRev--;
        renderTabla();
    }
}

function btnPaginaSiguienteRev() {
    const totalPaginas = Math.ceil(registrosFiltrados.length / registrosPorPaginaRev);
    if (paginaActualRev < totalPaginas) {
        paginaActualRev++;
        renderTabla();
    }
}

function exportarExcelRevisar() {
    if (registrosFiltrados.length === 0) {
        alert('No hay registros para exportar.');
        return;
    }

    const filas = registrosFiltrados.map(r => ({
        'Fecha Ingreso': r.fecha_ingreso ? new Date(r.fecha_ingreso).toLocaleDateString('es-CO') : '',
        'Operador': r.operador_nombre || '',
        'Cliente': r.nombre_cliente || '',
        'Teléfono': r.telefono || '',
        'Compañia': r.compania || '',
        'Estado Mercado': r.estado_mercado || '',
        'NPN 1': r.npn1 || '',
        'NPN 2': r.npn2 || '',
        'Notas': limitarTextoExcel(r.notas) || '',
        'Observación Operador': limitarTextoExcel(r.observacion_operador) || '',
        'Recuperado': r.recuperado || 'Pendiente',
        'Fecha Recuperación / Cancelación': r.fecha_recuperacion ? new Date(r.fecha_recuperacion).toLocaleDateString('es-CO') : '',
        'Revisión realizada por': r.revision_realizada_por || '',
        'Observación de cambio de estado': limitarTextoExcel(r.observacion_cambio_estado) || ''
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, 'Para Revisar');

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `para_revisar_${fecha}.xlsx`)
}

function limitarTextoExcel(valor) {
    if (valor === null || valor === undefined) return '';
    const texto = String(valor);
    const LIMITE = 32000;
    return texto.length > LIMITE ? texto.substring(0, LIMITE) + ' […texto truncado]' : texto;
}

// ============================================
// COMPONENTE GENÉRICO DE MULTISELECT (copiado de filtro_multiselect.js)
// ============================================
function crearFiltroMultiSelect(config) {
    const {
        contenedorId, label, idBase, opciones = null, fetchOpciones = null,
        conBuscador = false, textoVacio = 'Seleccionar...', textoUno = null, onCambio = () => {}
    } = config;

    const idPanel = `panel${idBase}`;
    const idTrigger = `trigger${idBase}`;
    const idTexto = `texto${idBase}`;
    const idBuscador = `buscar${idBase}`;

    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) {
        console.error(`crearFiltroMultiSelect: no existe #${contenedorId}`);
        return null;
    }

    function normalizar(lista) {
        return (lista || []).map(o => typeof o === 'string' ? { value: o, label: o } : o);
    }

    let opcionesActuales = normalizar(opciones);

    function renderOpciones() {
        return opcionesActuales.map(o =>
            `<label class="checkbox-item"><input type="checkbox" value="${o.value}">${o.label}</label>`
        ).join('');
    }

    contenedor.innerHTML = `
        <label>${label}</label>
        <div class="dropdown-filter">
            <button type="button" class="dropdown-trigger" id="${idTrigger}">
                <span id="${idTexto}">${textoVacio}</span>
                <span class="material-symbols-rounded">expand_more</span>
            </button>
            <div class="dropdown-panel" id="${idPanel}">
                ${conBuscador ? `<div class="dropdown-search"><input type="text" id="${idBuscador}" placeholder="Buscar..."></div>` : ''}
                <div class="checkbox-list-scroll" id="lista${idBase}">${renderOpciones()}</div>
                <div class="dropdown-actions">
                    <button type="button" class="btn-dropdown-clear">Limpiar</button>
                    <button type="button" class="btn-dropdown-close">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    const elPanel = document.getElementById(idPanel);
    const elTrigger = document.getElementById(idTrigger);
    const elTexto = document.getElementById(idTexto);
    const elLista = document.getElementById(`lista${idBase}`);

    function toggle(event) { event.stopPropagation(); elPanel.classList.toggle('active'); elTrigger.classList.toggle('active'); }
    function cerrar() { elPanel.classList.remove('active'); elTrigger.classList.remove('active'); }

    function actualizarTexto() {
        const checked = Array.from(elLista.querySelectorAll('input:checked'));
        if (checked.length === 0) {
            elTexto.textContent = textoVacio; elTexto.style.color = '#94a3b8';
        } else if (checked.length === 1) {
            const opcion = opcionesActuales.find(o => o.value === checked[0].value);
            elTexto.textContent = textoUno ? textoUno(checked[0].value) : (opcion ? opcion.label : checked[0].value);
            elTexto.style.color = '#1e293b';
        } else {
            elTexto.textContent = `${checked.length} seleccionados`; elTexto.style.color = '#6366f1';
        }
    }

    function limpiar() {
        elLista.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        actualizarTexto(); onCambio(getSeleccionados());
    }

    function filtrarOpcionesVisibles() {
        if (!conBuscador) return;
        const busqueda = document.getElementById(idBuscador).value.toLowerCase();
        elLista.querySelectorAll('.checkbox-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(busqueda) ? 'flex' : 'none';
        });
    }

    function getSeleccionados() {
        return Array.from(elLista.querySelectorAll('input:checked')).map(cb => cb.value);
    }

    function setSeleccionados(valores) {
        elLista.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = valores.includes(cb.value); });
        actualizarTexto();
    }

    async function recargarOpciones() {
        if (!fetchOpciones) return;
        const nuevas = await fetchOpciones();
        opcionesActuales = normalizar(nuevas);
        const seleccionaPrevia = getSeleccionados();
        elLista.innerHTML = renderOpciones();
        setSeleccionados(seleccionaPrevia.filter(v => opcionesActuales.some(o => o.value === v)));
        engancharCheckboxes();
    }

    function engancharCheckboxes() {
        elLista.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => { actualizarTexto(); onCambio(getSeleccionados()); });
        });
    }

    elTrigger.addEventListener('click', toggle);
    elPanel.querySelector('.btn-dropdown-clear').addEventListener('click', limpiar);
    elPanel.querySelector('.btn-dropdown-close').addEventListener('click', cerrar);
    if (conBuscador) document.getElementById(idBuscador).addEventListener('keyup', filtrarOpcionesVisibles);
    document.addEventListener('click', (e) => { if (!elPanel.contains(e.target) && !elTrigger.contains(e.target)) cerrar(); });

    engancharCheckboxes();
    actualizarTexto();
    if (fetchOpciones) recargarOpciones();

    return { getSeleccionados, setSeleccionados, limpiar, recargarOpciones, cerrar };
}

let filtroRevOperador, filtroRevNpn1, filtroRevNpn2, filtroRevRevisionPor;

function inicializarFiltrosMultiselectRev() {
    filtroRevOperador = crearFiltroMultiSelect({
        contenedorId: 'filtroRevOperadorGroup',
        label: 'Operador',
        idBase: 'filtroRevOperador',
        conBuscador: true,
        fetchOpciones: () => [...new Set(todosLosRegistros.map(r => r.operador_nombre).filter(Boolean))].sort(),
        textoVacio: 'Todos los operadores...',
        onCambio: () => { aplicarFiltros(); actualizarIndicadorFiltros(); }
    });

    filtroRevRevisionPor = crearFiltroMultiSelect({
        contenedorId: 'filtroRevRevisionPorGroup',
        label: 'Revisión realizada por',
        idBase: 'filtroRevRevisionPor',
        conBuscador: true,
        fetchOpciones: () => [...new Set(todosLosRegistros.map(r => r.revision_realizada_por).filter(Boolean))].sort(),
        textoVacio: 'Todos...',
        onCambio: () => { aplicarFiltros(); actualizarIndicadorFiltros(); }
    });

    filtroRevNpn1 = crearFiltroMultiSelect({
        contenedorId: 'filtroRevNpn1Group',
        label: 'Agente / NPN 1',
        idBase: 'filtroRevNpn1',
        conBuscador: true,
        fetchOpciones: () => [...new Set(todosLosRegistros.map(r => r.npn1).filter(Boolean))].sort(),
        textoVacio: 'Todos...',
        onCambio: () => { aplicarFiltros(); actualizarIndicadorFiltros(); }
    });

    filtroRevNpn2 = crearFiltroMultiSelect({
        contenedorId: 'filtroRevNpn2Group',
        label: 'Agente / NPN 2',
        idBase: 'filtroRevNpn2',
        conBuscador: true,
        fetchOpciones: () => [...new Set(todosLosRegistros.map(r => r.npn2).filter(Boolean))].sort(),
        textoVacio: 'Todos...',
        onCambio: () => { aplicarFiltros(); actualizarIndicadorFiltros(); }
    });
}

let debounceFiltroRevCliente;

function buscarClientesFiltroRev(valor) {
    clearTimeout(debounceFiltroRevCliente);
    const lista = document.getElementById('filtroRevAutocompleteLista');

    if (!valor || valor.trim().length < 3) {
        if (lista) lista.style.display = 'none';
        return;
    }

    debounceFiltroRevCliente = setTimeout(async () => {
        try {
            const resultados = await buscarClientes(valor.trim());
            renderAutocompleteFiltroRev(resultados || []);
        } catch (error) {
            console.error('Error buscando clientes:', error);
        }
    }, 300);
}

function renderAutocompleteFiltroRev(clientes) {
    const lista = document.getElementById('filtroRevAutocompleteLista');
    if (!lista) return;

    if (clientes.length === 0) {
        lista.style.display = 'none';
        return;
    }

    lista.innerHTML = clientes.slice(0, 8).map(c => `
        <div class="sr-autocomplete-item" onclick='seleccionarClienteFiltroRev(${JSON.stringify(c.nombres + " " + c.apellidos)}, ${JSON.stringify(c.telefono1 || "")})'>
            ${c.nombres} ${c.apellidos}
            <small>${c.telefono1 || 'Sin teléfono'}</small>
        </div>
    `).join('');
    lista.style.display = 'block';
}

function seleccionarClienteFiltroRev(nombre, telefono) {
    document.getElementById('filtroRevNombre').value = nombre;
    document.getElementById('filtroRevTelefono').value = telefono;
    document.getElementById('filtroRevAutocompleteLista').style.display = 'none';
}