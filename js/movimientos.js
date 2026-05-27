let todosLosMovimientos   = [];
let movimientosFiltrados  = [];
let observacionesCache    = {};
let periodoActual         = 'mes';
let esSupervisorOAdmin    = false;

// ── Tipos de movimiento ───────────────────────
const TIPOS_MOV = {
    nueva:          { label: 'Nueva póliza',      color: '#22c55e', icon: 'add_circle' },
    renovacion:     { label: 'Renovación',         color: '#3b82f6', icon: 'autorenew' },
    venta_registro: { label: 'Venta con registro', color: '#8b5cf6', icon: 'point_of_sale' },
    recuperada:     { label: 'Recuperada',         color: '#f59e0b', icon: 'published_with_changes' },
    cambio_vida:    { label: 'Cambio de vida',     color: '#06b6d4', icon: 'family_restroom' },
    modificacion:   { label: 'Modificación',       color: '#94a3b8', icon: 'edit_note' },
    seguimiento:    { label: 'Seguimiento',        color: '#ec4899', icon: 'phone_in_talk' },
};

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();
    esSupervisorOAdmin = esAdministrador() || datosUsuario?.es_supervisor;

    // Mostrar columna de obs. supervisor si aplica
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
                longhand:  ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
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
    document.querySelectorAll('.mov-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('movFechasCustom').style.display =
        periodo === 'custom' ? 'flex' : 'none';
    if (periodo !== 'custom') cargarMovimientos();
}

// ── Calcular rango de fechas ──────────────────
function obtenerRangoFechas() {
    const hoy   = new Date();
    const fISO  = d => d.toISOString().split('T')[0];

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

// ── Cargar operadores en dropdown ─────────────
async function cargarOperadoresDropdown() {
    const { data } = await supabaseClient
        .from('usuarios')
        .select('nombre')
        .eq('activo', true)
        .order('nombre');

    const sel = document.getElementById('filtroOperador');
    (data || []).forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.nombre;
        opt.textContent = u.nombre;
        sel.appendChild(opt);
    });
}

// ── Cargar todos los movimientos ──────────────
async function cargarMovimientos() {
    mostrarCargando(true);

    const { desde, hasta } = obtenerRangoFechas();
    const hastaFin = hasta + 'T23:59:59';

    try {
        const [polizas, historial, seguimientos, observaciones] = await Promise.all([
            cargarPolizasMovimientos(desde, hastaFin),
            cargarHistorialMovimientos(desde, hastaFin),
            cargarSeguimientosMovimientos(desde, hastaFin),
            cargarObservaciones()
        ]);

        // Construir cache de observaciones
        observacionesCache = {};
        (observaciones || []).forEach(o => {
            observacionesCache[`${o.referencia_id}_${o.tipo_ref}`] = o;
        });

        // Normalizar y unificar
        const movPolizas   = normalizarPolizas(polizas || []);
        const movHistorial = normalizarHistorial(historial || []);
        const movSeg       = normalizarSeguimientos(seguimientos || []);

        todosLosMovimientos = [...movPolizas, ...movHistorial, ...movSeg]
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        // Poblar dropdown compañías
        poblarDropdownCompanias();

        aplicarFiltros();

    } catch (e) {
        console.error('❌ Error cargando movimientos:', e);
        mostrarCargando(false);
    }
}

// ── Queries a Supabase ────────────────────────
async function cargarPolizasMovimientos(desde, hasta) {
    // Filtro por rol
    let query = supabaseClient
        .from('polizas')
        .select(`
            id,
            operador_nombre,
            compania,
            created_at,
            cliente:clientes (
                id,
                nombres,
                apellidos,
                telefono1,
                tipo_registro,
                tipo_modificacion,
                venta_realizada_por
            )
        `)
        .gte('created_at', desde)
        .lte('created_at', hasta)
        .in('cliente.tipo_registro', ['Nuevo', 'Venta con registro', 'Renovacion'])
        .order('created_at', { ascending: false });

    if (!esAdministrador() && !datosUsuario?.es_supervisor) {
        query = query.eq('operador_nombre', datosUsuario?.nombre);
    }

    const { data } = await query;

    // También recuperadas y cambios de vida (por fecha de updated_at)
    let query2 = supabaseClient
        .from('polizas')
        .select(`
            id,
            operador_nombre,
            compania,
            updated_at,
            cliente:clientes (
                id,
                nombres,
                apellidos,
                telefono1,
                tipo_registro,
                tipo_modificacion,
                venta_realizada_por
            )
        `)
        .gte('updated_at', desde)
        .lte('updated_at', hasta)
        .not('cliente.tipo_modificacion', 'is', null)
        .order('updated_at', { ascending: false });

    if (!esAdministrador() && !datosUsuario?.es_supervisor) {
        query2 = query2.eq('operador_nombre', datosUsuario?.nombre);
    }

    const { data: data2 } = await query2;

    return [...(data || []), ...(data2 || [])];
}

async function cargarHistorialMovimientos(desde, hasta) {
    let query = supabaseClient
        .from('historial_cambios')
        .select(`
            id,
            cliente_id,
            tipo_cambio,
            seccion,
            campo_modificado,
            valor_anterior,
            valor_nuevo,
            usuario_nombre,
            created_at,
            cliente:clientes (
                id,
                nombres,
                apellidos,
                telefono1
            ),
            poliza:polizas (
                id,
                compania,
                operador_nombre
            )
        `)
        .gte('created_at', desde)
        .lte('created_at', hasta)
        .order('created_at', { ascending: false });

    if (!esAdministrador() && !datosUsuario?.es_supervisor) {
        query = query.eq('usuario_nombre', datosUsuario?.nombre);
    }

    const { data } = await query;

    // Agrupar por cliente + tipo_cambio + día para no mostrar 40 filas por una edición
    const grupos = new Map();
    (data || []).forEach(h => {
        const dia  = h.created_at.split('T')[0];
        const key  = `${h.cliente_id}_${h.tipo_cambio}_${dia}_${h.usuario_nombre}`;
        if (!grupos.has(key)) {
            grupos.set(key, { ...h, campos: [] });
        }
        grupos.get(key).campos.push(h.campo_modificado);
    });

    return Array.from(grupos.values());
}

async function cargarSeguimientosMovimientos(desde, hasta) {
    let query = supabaseClient
        .from('seguimientos')
        .select(`
            id,
            fecha_seguimiento,
            medio_comunicacion,
            observacion,
            seguimiento_efectivo,
            poliza:polizas (
                id,
                operador_nombre,
                compania,
                cliente:clientes (
                    id,
                    nombres,
                    apellidos,
                    telefono1
                )
            )
        `)
        .gte('fecha_seguimiento', desde)
        .lte('fecha_seguimiento', hasta)
        .order('fecha_seguimiento', { ascending: false });

    const { data } = await query;
    return data || [];
}

async function cargarObservaciones() {
    const { data } = await supabaseClient
        .from('movimientos_observaciones')
        .select('*');
    return data || [];
}

// ── Normalizar fuentes ────────────────────────
function normalizarPolizas(polizas) {
    const vistos = new Set();
    return polizas
        .filter(p => p.cliente)
        .map(p => {
            const c        = p.cliente;
            const tipoMod  = (c.tipo_modificacion || '').toLowerCase();
            const tipoReg  = (c.tipo_registro || '').toLowerCase();
            const esRecup  = tipoMod === 'recuperada';
            const esCambio = tipoMod === 'cambio de vida';

            let tipo;
            if (esRecup)               tipo = 'recuperada';
            else if (esCambio)         tipo = 'cambio_vida';
            else if (tipoReg === 'nuevo') tipo = 'nueva';
            else if (tipoReg === 'renovacion') tipo = 'renovacion';
            else if (tipoReg.includes('venta')) tipo = 'venta_registro';
            else return null;

            const fecha = esRecup || esCambio ? p.updated_at : p.created_at;
            const uid   = `poliza_${p.id}_${tipo}`;
            if (vistos.has(uid)) return null;
            vistos.add(uid);

            return {
                uid,
                ref_id:    p.id,
                tipo_ref:  'poliza',
                fecha,
                operador:  p.operador_nombre || c.venta_realizada_por || '—',
                cliente:   `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
                cliente_id: c.id,
                telefono:  c.telefono1 || '—',
                compania:  p.compania || '—',
                tipo,
                detalle:   TIPOS_MOV[tipo]?.label || tipo,
                observacion: '',
            };
        })
        .filter(Boolean);
}

function normalizarHistorial(grupos) {
    return grupos
        .filter(h => h.cliente)
        .map(h => {
            const c = h.cliente;
            const p = h.poliza;
            return {
                uid:       `historial_${h.id}`,
                ref_id:    h.id,
                tipo_ref:  'historial',
                fecha:     h.created_at,
                operador:  h.usuario_nombre || '—',
                cliente:   `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
                cliente_id: c.id,
                telefono:  c.telefono1 || '—',
                compania:  p?.compania || '—',
                tipo:      'modificacion',
                detalle:   h.campos?.length
                    ? `${h.tipo_cambio}: ${h.campos.slice(0,3).join(', ')}${h.campos.length > 3 ? ` +${h.campos.length - 3} más` : ''}`
                    : h.tipo_cambio,
                observacion: '',
            };
        });
}

function normalizarSeguimientos(seguimientos) {
    return seguimientos
        .filter(s => s.poliza?.cliente)
        .map(s => {
            const p = s.poliza;
            const c = p.cliente;
            return {
                uid:       `seg_${s.id}`,
                ref_id:    s.id,
                tipo_ref:  'seguimiento',
                fecha:     s.fecha_seguimiento,
                operador:  p.operador_nombre || '—',
                cliente:   `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
                cliente_id: c.id,
                telefono:  c.telefono1 || '—',
                compania:  p.compania || '—',
                tipo:      'seguimiento',
                detalle:   `${s.medio_comunicacion || 'Seguimiento'}${s.seguimiento_efectivo === 'Si' ? ' ✅' : ''}`,
                observacion: s.observacion || '',
            };
        });
}

// ── Filtros ───────────────────────────────────
function aplicarFiltros() {
    const operador = document.getElementById('filtroOperador')?.value || '';
    const tipo     = document.getElementById('filtroTipo')?.value || '';
    const compania = document.getElementById('filtroCompania')?.value || '';
    const busqueda = (document.getElementById('movBusqueda')?.value || '').toLowerCase();

    movimientosFiltrados = todosLosMovimientos.filter(m => {
        if (operador && m.operador !== operador) return false;
        if (tipo     && m.tipo     !== tipo)     return false;
        if (compania && m.compania !== compania) return false;
        if (busqueda && !m.cliente.toLowerCase().includes(busqueda) &&
                        !m.telefono.includes(busqueda))              return false;
        return true;
    });

    actualizarCards();
    renderizarRanking();
    renderizarTabla();
}

// ── Dropdown compañías ────────────────────────
function poblarDropdownCompanias() {
    const companias = [...new Set(todosLosMovimientos.map(m => m.compania).filter(Boolean))].sort();
    const sel = document.getElementById('filtroCompania');
    sel.innerHTML = '<option value="">Todas las compañías</option>';
    companias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
    });
}

// ── Cards ─────────────────────────────────────
function actualizarCards() {
    const m = movimientosFiltrados;
    document.getElementById('cardTotal').textContent      = m.length;
    document.getElementById('cardNuevas').textContent     = m.filter(x => x.tipo === 'nueva' || x.tipo === 'venta_registro' || x.tipo === 'renovacion').length;
    document.getElementById('cardRecuperadas').textContent = m.filter(x => x.tipo === 'recuperada').length;
    document.getElementById('cardCambios').textContent    = m.filter(x => x.tipo === 'cambio_vida').length;
    document.getElementById('cardMods').textContent       = m.filter(x => x.tipo === 'modificacion' || x.tipo === 'seguimiento').length;
}

// ── Ranking ───────────────────────────────────
function renderizarRanking() {
    if (!esSupervisorOAdmin) return;
    const ranking = document.getElementById('movRanking');
    const lista   = document.getElementById('movRankingLista');
    if (!lista) return;

    const conteo = {};
    movimientosFiltrados.forEach(m => {
        const op = m.operador || '—';
        conteo[op] = (conteo[op] || 0) + 1;
    });

    const ordenado = Object.entries(conteo).sort((a,b) => b[1]-a[1]);
    if (ordenado.length === 0) { ranking.style.display = 'none'; return; }

    const max = ordenado[0][1];
    lista.innerHTML = ordenado.map(([op, n], i) => `
        <div class="mov-rank-item">
            <span class="mov-rank-pos">${i+1}</span>
            <div class="mov-rank-info">
                <span class="mov-rank-nombre">${op}</span>
                <div class="mov-rank-bar">
                    <div class="mov-rank-fill" style="width:${(n/max*100).toFixed(0)}%"></div>
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
                <td colspan="9" class="mov-empty">
                    <span class="material-symbols-rounded">search_off</span>
                    <p>No hay movimientos en este período</p>
                </td>
            </tr>`;
        mostrarCargando(false);
        return;
    }

    tbody.innerHTML = movimientosFiltrados.map(m => {
        const conf  = TIPOS_MOV[m.tipo] || TIPOS_MOV.modificacion;
        const fecha = formatearFechaCorta(m.fecha);
        const obsKey = `${m.ref_id}_${m.tipo_ref}`;
        const obsSup = observacionesCache[obsKey]?.observacion || '';

        const celdaObs = esSupervisorOAdmin
            ? `<td class="mov-td-obs">
                <div class="mov-obs-wrap" data-uid="${m.uid}" data-ref="${m.ref_id}" data-tipo="${m.tipo_ref}">
                    <span class="mov-obs-texto ${obsSup ? '' : 'mov-obs-vacia'}" onclick="editarObservacion(this)">
                        ${obsSup || '+ Agregar nota'}
                    </span>
                    <div class="mov-obs-editor" style="display:none">
                        <textarea class="mov-obs-input" rows="2">${obsSup}</textarea>
                        <div class="mov-obs-btns">
                            <button onclick="guardarObservacion(this)" class="mov-obs-guardar">Guardar</button>
                            <button onclick="cancelarObservacion(this)" class="mov-obs-cancelar">Cancelar</button>
                        </div>
                    </div>
                </div>
               </td>`
            : '';

        return `
            <tr class="mov-tr mov-tr-${m.tipo}">
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
                    <span class="mov-badge" style="background:${conf.color}20;color:${conf.color};border-color:${conf.color}40">
                        <span class="material-symbols-rounded" style="font-size:0.9rem">${conf.icon}</span>
                        ${conf.label}
                    </span>
                </td>
                <td class="mov-td-detalle">${m.detalle}</td>
                <td class="mov-td-obs-op">${m.observacion || '—'}</td>
                ${celdaObs}
            </tr>
        `;
    }).join('');

    // Mostrar/ocultar columna supervisor
    document.getElementById('thObsSup').style.display = esSupervisorOAdmin ? '' : 'none';
    mostrarCargando(false);
}

// ── Observaciones supervisor ──────────────────
function editarObservacion(spanEl) {
    const wrap   = spanEl.closest('.mov-obs-wrap');
    spanEl.style.display = 'none';
    wrap.querySelector('.mov-obs-editor').style.display = 'block';
    wrap.querySelector('.mov-obs-input').focus();
}

function cancelarObservacion(btnEl) {
    const wrap   = btnEl.closest('.mov-obs-wrap');
    const span   = wrap.querySelector('.mov-obs-texto');
    wrap.querySelector('.mov-obs-editor').style.display = 'none';
    span.style.display = '';
}

async function guardarObservacion(btnEl) {
    const wrap   = btnEl.closest('.mov-obs-wrap');
    const texto  = wrap.querySelector('.mov-obs-input').value.trim();
    const refId  = wrap.dataset.ref;
    const tipoRef = wrap.dataset.tipo;
    const obsKey = `${refId}_${tipoRef}`;

    try {
        const existente = observacionesCache[obsKey];

        if (existente) {
            await supabaseClient
                .from('movimientos_observaciones')
                .update({ observacion: texto, updated_at: new Date().toISOString() })
                .eq('id', existente.id);
            observacionesCache[obsKey].observacion = texto;
        } else {
            const { data } = await supabaseClient
                .from('movimientos_observaciones')
                .insert({
                    referencia_id:     refId,
                    tipo_ref:          tipoRef,
                    observacion:       texto,
                    supervisor_id:     datosUsuario?.id,
                    supervisor_nombre: datosUsuario?.nombre
                })
                .select()
                .single();
            if (data) observacionesCache[obsKey] = data;
        }

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

    const filas = movimientosFiltrados.map(m => {
        const conf   = TIPOS_MOV[m.tipo];
        const obsKey = `${m.ref_id}_${m.tipo_ref}`;
        return {
            'Fecha':            formatearFechaCorta(m.fecha),
            'Operador':         m.operador,
            'Cliente':          m.cliente,
            'Teléfono':         m.telefono,
            'Compañía':         m.compania,
            'Tipo':             conf?.label || m.tipo,
            'Detalle':          m.detalle,
            'Observación':      m.observacion,
            'Obs. Supervisor':  observacionesCache[obsKey]?.observacion || '',
        };
    });

    const wb  = XLSX.utils.book_new();
    const ws  = XLSX.utils.json_to_sheet(filas);

    // Ancho de columnas
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
    return d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
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

function puedeVerMovimientos() {
    if (!datosUsuario) return false;
    if (datosUsuario.rol === 'admin') return true;
    return datosUsuario.puede_ver_movimientos === true;
}