// ============================================
// MOVIMIENTOS.JS — Lee directamente de la tabla movimientos
// ============================================

let todosLosMovimientos  = [];
let movimientosFiltrados = [];
let periodoActual        = 'mes';
let esSupervisorOAdmin   = false;
let modoUnico            = false;

// ── Configuración de tipos ────────────────────
// Las claves deben coincidir EXACTAMENTE con lo que se guarda en movimientos.tipo
const TIPOS_MOV = {
    'Nueva':              { label: 'Nueva',              color: '#22c55e', icon: 'add_circle' },
    'Renovación':         { label: 'Renovación',         color: '#3b82f6', icon: 'autorenew' },
    'Venta con registro': { label: 'Venta con registro', color: '#8b5cf6', icon: 'point_of_sale' },
    'Recuperada':         { label: 'Recuperada',         color: '#f59e0b', icon: 'published_with_changes' },
    'Cambio de vida':     { label: 'Cambio de vida',     color: '#06b6d4', icon: 'family_restroom' },
    'Editado':            { label: 'Editado',            color: '#94a3b8', icon: 'edit_note' },
    'Seguimiento':        { label: 'Seguimiento',        color: '#ec4899', icon: 'phone_in_talk' },
};

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();

    const { data: usuario } = await supabaseClient
        .from('usuarios')
        .select('puede_ver_monitoreo, es_supervisor, rol')
        .eq('id', datosUsuario?.id || '')
        .single();
    
    const tieneAcceso = usuario?.rol === 'admin' || usuario?.es_supervisor || usuario?.puede_ver_monitoreo;

    if (!tieneAcceso) {
        alert('No tienes permiso para ver esta página.');
        window.location.href = './index.html';
        return;
    }

    esSupervisorOAdmin = esAdministrador() || datosUsuario?.es_supervisor;

    if (esSupervisorOAdmin) {
        document.getElementById('thObsSup').style.display = '';
    }

    inicializarFlatpickr();
    await cargarOperadoresDropdown();
    await cargarMovimientos();
});

// ── Flatpickr ─────────────────────────────────
function inicializarFlatpickr() {
    const cfg = {
        dateFormat: 'm/d/Y',
        locale: {
            months: {
                shorthand: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
                longhand:  ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
                            'Septiembre','Octubre','Noviembre','Diciembre']
            },
            weekdays: {
                shorthand: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
                longhand:  ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
            }
        },
        onChange: () => { if (periodoActual === 'custom') cargarMovimientos(); }
    };
    flatpickr('#movFechaDesde', cfg);
    flatpickr('#movFechaHasta', cfg);
}

// ── Cambiar período ───────────────────────────
function cambiarPeriodo(periodo, btn) {
    periodoActual = periodo;
    todosLosMovimientos = [];
    document.querySelectorAll('.mov-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('movFechasCustom').style.display =
        periodo === 'custom' ? 'flex' : 'none';
    if (periodo !== 'custom') cargarMovimientos();
}

// ── Calcular rango de fechas ──────────────────
function obtenerRangoFechas() {
    const hoy  = new Date();
    const fISO = d => d.toISOString().split('T')[0];

    switch (periodoActual) {
        case 'hoy':
            return { desde: fISO(hoy), hasta: fISO(hoy) };

        case 'semana': {
            const lunes = new Date(hoy);
            const dia   = hoy.getDay() || 7;
            lunes.setDate(hoy.getDate() - dia + 1);
            return { desde: fISO(lunes), hasta: fISO(hoy) };
        }

        case 'mes':
            return {
                desde: `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`,
                hasta: fISO(hoy)
            };

        case 'anio':
            return { desde: `${hoy.getFullYear()}-01-01`, hasta: fISO(hoy) };

        case 'custom': {
            const fp1 = document.getElementById('movFechaDesde')._flatpickr;
            const fp2 = document.getElementById('movFechaHasta')._flatpickr;
            const d1  = fp1?.selectedDates[0];
            const d2  = fp2?.selectedDates[0];
            return {
                desde: d1 ? fISO(d1) : '2000-01-01',
                hasta: d2 ? fISO(d2) : fISO(hoy)
            };
        }
        default:
            return { desde: '2000-01-01', hasta: fISO(hoy) };
    }
}

// ── Dropdown operadores ───────────────────────
async function cargarOperadoresDropdown() {
    const { data } = await supabaseClient
        .from('usuarios')
        .select('nombre')
        .eq('activo', true)
        .order('nombre');

    const lista = document.getElementById('listaOperadores');
    (data || []).forEach(u => {
        const label = document.createElement('label');
        label.className = 'mov-chk-item';
        label.innerHTML = `
            <input type="checkbox" value="${u.nombre}">
            ${u.nombre}
        `;

        label.querySelector('input').addEventListener('change', () => {
            actualizarTextoFiltro('operador');
            aplicarFiltros();
        });
        lista.appendChild(label)
    });

    document.querySelectorAll('#panelFiltroTipo input[type="checkbox"]')
        .forEach(cb => cb.addEventListener('change', () => {
            actualizarTextoFiltro('tipo');
            aplicarFiltros()
        }))
}

// ── Carga principal — directo de movimientos ──
async function cargarMovimientos() {
    mostrarCargando(true);

    const { desde, hasta } = obtenerRangoFechas();
    const hastaFin = hasta + 'T23:59:59';

    try {
        let query = supabaseClient
            .from('movimientos')
            .select('*')
            .gte('fecha', desde)
            .lte('fecha', hastaFin)
            .order('fecha', { ascending: false })

        // Filtro por rol: operador solo ve los suyos
        if (!esAdministrador() && !datosUsuario?.es_supervisor) {
            query = query.eq('operador_nombre', datosUsuario?.nombre);
        }

        const { data, error } = await query;
        if (error) throw error;

        todosLosMovimientos = (data || []).map(m => ({
            uid:           m.id,
            fecha:         m.fecha || m.created_at,
            operador:      m.operador_nombre  || '—',
            cliente:       m.cliente_nombre   || '—',
            cliente_id:    m.cliente_id,
            telefono:      m.cliente_telefono || '—',
            compania:      m.compania         || '—',
            tipo:          m.tipo             || 'Editado',
            detalle:       m.detalle          || '',
            observacion:   m.observacion_operador   || '',
            obs_supervisor: m.observacion_supervisor || '',
        }));

        const clienteIds = [...new Set(
            todosLosMovimientos.map(m => m.cliente_id).filter(Boolean)
        )];

        if (clienteIds.length > 0 ) {
            const { data: polizasData, error: polizasError } = await supabaseClient
                .from('polizas')
                .select('cliente_id, agente35_estado')
        
            const mapaAgente35 = {};
            (polizasData || []).forEach(p => {
                mapaAgente35[p.cliente_id] = p.agente35_estado || '-';
            });

            todosLosMovimientos = todosLosMovimientos.map(m => ({
                ...m,
                agente35: mapaAgente35[m.cliente_id] || '-'
            }));
        }

        poblarDropdownCompanias();
        aplicarFiltros();

    } catch (e) {
        console.error('❌ Error cargando movimientos:', e);
        mostrarError('No se pudieron cargar los movimientos. Intenta recargar la página.');
        mostrarCargando(false);
    }
}
function recargarMovimientos() {
    todosLosMovimientos = [];
    cargarMovimientos();
}

function mostrarError(mensaje) {
    const tbody = document.getElementById('movTbody');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="10" style="text-align:center; padding: 60px 20px; color: #ef4444;">
                <span class="material-symbols-rounded" style="font-size:2rem; display:block; margin-bottom:8px;">
                    error_outline
                </span>
                ${mensaje}
                <br><br>
                <button onclick="recargarMovimientos()" style="
                    padding: 8px 20px; border-radius: 8px;
                    background: #6366f1; color: white;
                    border: none; cursor: pointer;
                    font-size: 0.84rem; font-weight: 600;
                ">Reintentar</button>
            </td>
        </tr>`;
}

// ── Filtros ───────────────────────────────────
function aplicarFiltros() {
    const operadoresSeleccionados = Array.from(
        document.querySelectorAll('#panelFiltroOperador input:checked')
    ).map(cb => cb.value);
    // NOTA: el HTML tiene un typo "filroTipo" — corregir en movimientos.html también
    const tiposSeleccionados = Array.from(
        document.querySelectorAll('#panelFiltroTipo input:checked')
    ).map(cb => cb.value)

    const compania = document.getElementById('filtroCompania')?.value || '';
    const busqueda = (document.getElementById('movBusqueda')?.value || '').toLowerCase();

    movimientosFiltrados = todosLosMovimientos.filter(m => {
        if (operadoresSeleccionados.length > 0 && !operadoresSeleccionados.includes(m.operador))     return false;
        if (tiposSeleccionados.length > 0 && !tiposSeleccionados.includes(m.tipo))          return false;
        if (compania && m.compania !== compania)     return false;
        if (busqueda &&
            !m.cliente.toLowerCase().includes(busqueda) &&
            !m.telefono.includes(busqueda))          return false;
        return true;
    });

    // Filtros unicos, 1 cliente por día (para ver cuántos clientes únicos se movieron)
    if (modoUnico) {
        const vistos = new Set();
        movimientosFiltrados = movimientosFiltrados.filter(m => {
            const dia = (m.fecha || '').split('T')[0]; // YYYY-MM-DD
            const clave = `${dia}_${m.cliente_id}`;
            if (vistos.has(clave)) return false;
            vistos.add(clave);
            return true;
        })
    }

    actualizarCards();
    renderizarRanking();
    renderizarTabla();
}

function toggleMovDropdown(cual) {
    const panel = document.getElementById(
        cual === 'operador' ? 'panelFiltroOperador' : 'panelFiltroTipo'
    );

    const btn = panel?.previousElementSibling;
    const abierto = panel?.style.display !== 'none';
    // Cerrar todos primero
    ['panelFiltroOperador', 'panelFiltroTipo'].forEach(id => {
        const p = document.getElementById(id);
        if (p) p.style.display= 'none';
        if (p?.previousElementSibling) p.previousElementSibling.classList.remove('activo');
    });
    if (!abierto) {
        panel.style.display = 'block';
        btn?.classList.add('activo');
    }
}

function limpiarFiltroMultiple(cual) {
    const panelId = cual === 'operador' ? 'panelFiltroOperador' : 'panelFiltroTipo';
    document.querySelectorAll(`#${panelId} input[type="checkbox"]`)
        .forEach(cb => cb.checked = false);
    actualizarTextoFiltro(cual);
    acplicarFiltros();
}

function actualizarTextoFiltro(cual) {
    const panelId = cual === 'operador' ? 'panelFiltroOperador' : 'panelFiltroTipo'
    const textoId = cual === 'operador' ? 'textoFiltroOperador' : 'textoFiltroTipo'
    const defecto = cual === 'operador' ? 'Todos los operadores' : 'Todos los tipos'
    const checked = document.querySelectorAll(`#${panelId} input:checked`);
    const el = document.getElementById(textoId);
    if (!el) return;
    if (checked.length === 0) el.textContent = defecto;
    else if (checked.length === 1) el.textContent = checked[0].value;
    else el.textContent = `${checked.length} seleccionados`;
}

document.addEventListener('click', e => {
    if (!e.target.closest('.mov-dropdown-wrap')) {
        ['panelFiltroOperador', 'panelFiltroTipo'].forEach(id => {
            const p = document.getElementById(id);
            if (p) p.style.display = 'none';
            if (p?.previousElementSibling) p.previousElementSibling.classList.remove('activo');
        })
    }
})

// ── Poblar dropdown compañías ─────────────────
function poblarDropdownCompanias() {
    const companias = [...new Set(
        todosLosMovimientos.map(m => m.compania).filter(Boolean)
    )].sort();

    const sel = document.getElementById('filtroCompania');
    sel.innerHTML = '<option value="">Todas las compañías</option>';
    companias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
    });
}

// ── Cards de resumen ──────────────────────────
function actualizarCards() {
    const m = movimientosFiltrados;
    document.getElementById('cardTotal').textContent =
        m.length;
    document.getElementById('cardNuevas').textContent =
        m.filter(x => x.tipo === 'Nueva' || x.tipo === 'Renovación' || x.tipo === 'Venta con registro').length;
    document.getElementById('cardRecuperadas').textContent =
        m.filter(x => x.tipo === 'Recuperada').length;
    document.getElementById('cardCambios').textContent =
        m.filter(x => x.tipo === 'Cambio de vida').length;
    document.getElementById('cardMods').textContent =
        m.filter(x => x.tipo === 'Editado').length;
}

// ── Ranking de operadores ─────────────────────
function renderizarRanking() {
    if (!esSupervisorOAdmin) return;

    const ranking = document.getElementById('movRanking');
    const lista   = document.getElementById('movRankingLista');
    if (!lista) return;

    // Agrupar por operador — solo tipos productivos
    const TIPOS_PRODUCTIVOS = ['Nueva', 'Venta con registro'];
    const conteo = {};
    movimientosFiltrados
        .filter(m => TIPOS_PRODUCTIVOS.includes(m.tipo))
        .forEach(m => {
            const op = m.operador || '—';
            conteo[op] = (conteo[op] || 0) + 1;
        });

    const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

    if (ordenado.length === 0) {
        ranking.style.display = 'none';
        return;
    }

    const max = ordenado[0][1];
    lista.innerHTML = ordenado.map(([op, n], i) => `
        <div class="mov-rank-item">
            <span class="mov-rank-pos">${i + 1}</span>
            <div class="mov-rank-info">
                <span class="mov-rank-nombre">${op}</span>
                <div class="mov-rank-bar">
                    <div class="mov-rank-fill" style="width:${(n / max * 100).toFixed(0)}%"></div>
                </div>
            </div>
            <span class="mov-rank-total">${n}</span>
        </div>
    `).join('');

    ranking.style.display = 'block';
}

// ── Tabla ─────────────────────────────────────
function renderizarTabla() {
    const tbody = document.getElementById('movTbody');
    document.getElementById('movContador').textContent =
        `${movimientosFiltrados.length} movimiento${movimientosFiltrados.length !== 1 ? 's' : ''}`;

    if (movimientosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="mov-empty">
                    <span class="material-symbols-rounded">search_off</span>
                    <p>No hay movimientos en este período</p>
                </td>
            </tr>`;
        mostrarCargando(false);
        return;
    }

    tbody.innerHTML = movimientosFiltrados.map(m => {
        const conf = TIPOS_MOV[m.tipo] || { label: m.tipo, color: '#94a3b8', icon: 'edit_note' };
        const fecha = formatearFechaCorta(m.fecha);

        // Celda de observación para supervisor/admin
        const celdaObsSup = esSupervisorOAdmin
            ? `<td class="mov-td-obs">
                <div class="mov-obs-wrap" data-uid="${m.uid}">
                    <span class="mov-obs-texto ${m.obs_supervisor ? '' : 'mov-obs-vacia'}"
                          onclick="editarObservacion(this)">
                        ${m.obs_supervisor || '+ Agregar nota'}
                    </span>
                    <div class="mov-obs-editor" style="display:none">
                        <textarea class="mov-obs-input" rows="2">${m.obs_supervisor}</textarea>
                        <div class="mov-obs-btns">
                            <button onclick="guardarObservacion(this)" class="mov-obs-guardar">Guardar</button>
                            <button onclick="cancelarObservacion(this)" class="mov-obs-cancelar">Cancelar</button>
                        </div>
                    </div>
                </div>
               </td>`
            : '';

        return `
            <tr>
                <td class="mov-td-fecha">${fecha}</td>
                <td class="mov-td-op">${m.operador}</td>
                <td class="mov-td-cliente">
                    <a href="./cliente_editar.html?id=${m.cliente_id}" target="_blank">
                        ${m.cliente}
                    </a>
                </td>
                <td>${m.telefono}</td>
                <td>${m.compania}</td>
                <td>
                    <span style="padding: 3px 10px; border-radius: 20px; font-size: 0.76; font-weight: 600; text-wrap: nowrap; background: ${m.agente35 === 'Procesado' ? '#dcfce7' : m.agente35 === 'Pendiente' ? '#d97706' : m.agente35 === 'Cambio necesario' ? '#943b8' : '#94a3b8' };
                    color: ${m.agente35 === 'Procesado' ? '#16a34a' : m.agente35 === 'Pendiente' ? '#d97706' : m.agente35 === 'Cambio necesario' ? '#dc2626' : '#fff'};"
                    >${m.agente35 || '-'}
                    </span>
                </td>
                <td>
                    <span class="mov-badge"
                          style="background:${conf.color}20;color:${conf.color};border-color:${conf.color}40">
                        <span class="material-symbols-rounded" style="font-size:0.9rem">${conf.icon}</span>
                        ${conf.label}
                    </span>
                </td>
                <td class="mov-td-detalle">${m.detalle}</td>
                <td class="mov-td-obs-op">${m.observacion || '—'}</td>
                ${celdaObsSup}
            </tr>
        `;
    }).join('');

    document.getElementById('thObsSup').style.display = esSupervisorOAdmin ? '' : 'none';
    mostrarCargando(false);
}

// ── Observaciones supervisor ──────────────────
function editarObservacion(spanEl) {
    const wrap = spanEl.closest('.mov-obs-wrap');
    spanEl.style.display = 'none';
    wrap.querySelector('.mov-obs-editor').style.display = 'block';
    wrap.querySelector('.mov-obs-input').focus();
}

function cancelarObservacion(btnEl) {
    const wrap = btnEl.closest('.mov-obs-wrap');
    wrap.querySelector('.mov-obs-editor').style.display = 'none';
    wrap.querySelector('.mov-obs-texto').style.display = '';
}

async function guardarObservacion(btnEl) {
    const wrap  = btnEl.closest('.mov-obs-wrap');
    const texto = wrap.querySelector('.mov-obs-input').value.trim();
    const movId = wrap.dataset.uid;

    try {
        const { error } = await supabaseClient
            .from('movimientos')
            .update({ observacion_supervisor: texto })
            .eq('id', movId);

        if (error) throw error;

        // Actualizar en memoria para no recargar toda la lista
        const mov = todosLosMovimientos.find(m => m.uid === movId);
        if (mov) mov.obs_supervisor = texto;

        const span = wrap.querySelector('.mov-obs-texto');
        span.textContent = texto || '+ Agregar nota';
        span.classList.toggle('mov-obs-vacia', !texto);
        cancelarObservacion(btnEl);

    } catch (e) {
        console.error('❌ Error guardando observación:', e);
        alert('Error al guardar la observación');
    }
}

// ── Exportar Excel ────────────────────────────
function exportarExcel() {
    const { desde, hasta } = obtenerRangoFechas();

    const filas = movimientosFiltrados.map(m => ({
        'Fecha':           formatearFechaCorta(m.fecha),
        'Operador':        m.operador,
        'Cliente':         m.cliente,
        'Teléfono':        m.telefono,
        'Compañía':        m.compania,
        'Tipo':            TIPOS_MOV[m.tipo]?.label || m.tipo,
        'Detalle':         m.detalle,
        'Observación':     m.observacion,
        'Obs. Supervisor': m.obs_supervisor,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);

    ws['!cols'] = [
        { wch: 12 }, { wch: 20 }, { wch: 28 },
        { wch: 14 }, { wch: 18 }, { wch: 18 },
        { wch: 35 }, { wch: 30 }, { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, `movimientos_${desde}_${hasta}.xlsx`);
}

// ── Helpers ───────────────────────────────────
function formatearFechaCorta(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

function mostrarCargando(show) {
    if (!show) return;
    document.getElementById('movTbody').innerHTML = `
        <tr>
            <td colspan="9" class="mov-loading">
                <div class="mov-spinner"></div>
                Cargando movimientos...
            </td>
        </tr>`;
}

function toggleModoUnico() {
    modoUnico = !modoUnico;
    const btn = document.getElementById('btnUnicos');
    btn.classList.toggle('activo', modoUnico);
    // Actualizar texto para reflejar el estado
    btn.innerHTML = modoUnico
        ? `<span class="material-symbols-rounded">person</span> Únicos <span class="material-symbols-rounded" style="font-size: 0.8rem;">check</span>`
        : `<span class="material-symbols-rounded">person</span> Únicos`;
    aplicarFiltros(); 
}