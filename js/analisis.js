// ============================================
// ANÁLISIS DE CARTERA — analisis.js
// ============================================

let todasLasPolizasAnalisis = [];
let polizasFiltradas        = [];
let operadorSeleccionado    = 'todos';
let filtroNivelActivo       = 'todos';
let graficasInstancias      = {};
let scoringCache            = {};
let esOperadorSimple        = false;
let planesGenerados         = {};
let filtroSSNOscarActivo = false;
let filtrosAvanzados = {
    pagosPendientes: [],
    docsPorVencer: [],
    contactoSinResuesta: false,
    imposibleContactar: false,
    sinContacto: [],
    sinSeguimientos: false,
    senalAbandono: false
};
let todaLaRevisionMercado = [];

function cumpleFiltrosAvanzados(poliza) {
    const m = scoringCache[poliza.id]?.metricas;
    if (!m) return true;

    if (filtrosAvanzados.pagosPendientes.length > 0) {
        const n = m.mesesPagoPendiente;
        const coincide = filtrosAvanzados.pagosPendientes.some(v => v === '4+' ? n >= 4 : n === Number(v));
        if (!coincide) return false;
    }

    if (filtrosAvanzados.docsPorVencer.length > 0) {
        const d = m.docDiasParaVencer;
        if (d === null) return false;
        const coincide = filtrosAvanzados.docsPorVencer.some(v => {
            if (v === '1') return d <= 1;
            if (v === '2-7') return d >= 2 && d <= 7;
            if (v === '8-30') return d >= 8 && d <= 30;
            return false
        });
        if (!coincide) return false;
    }

    if (filtrosAvanzados.contactoSinResuesta && !m.contactoSinResuesta) return false;
    if (filtrosAvanzados.imposibleContactar && !m.imposibleContactar) return false;

    if (filtrosAvanzados.sinContacto.length > 0) {
        const d = m.diasSinContacto;
        if (d === null) return false;
        const coincide = filtrosAvanzados.sinContacto.some(v => {
            if (v === '<=29') return d <= 29;
            if (v === '30-59') return d >=30 && d <= 59;
            if (v === '>=60') return d >= 60;
            return false; 
        });
        if (!coincide) return false;
    }
    if (filtrosAvanzados.sinSeguimientos && !m.sinSeguimientos) return false;
    if (filtrosAvanzados.senalAbandono && !m.senalAbandono) return false;

    return true;
}

function toggleFiltroAvanzadoMulti(grupo, valor, btn) {
    const idx = filtrosAvanzados[grupo].indexOf(valor);
    if (idx === -1) {
        filtrosAvanzados[grupo].push(valor);
        btn.classList.add('active');
    } else {
        filtrosAvanzados[grupo].splice(idx, 1);
        btn.classList.remove('active');
    }
    renderizarTabla();
}

function limpiarFiltrosAvanzados() {
    filtrosAvanzados = {
        pagosPendientes: [],
        docsPorVencer: [],
        contactoSinResuesta: false,
        imposibleContactar: false,
        sinContacto: [],
        sinSeguimientos: false,
        senalAbandono: false
    };
    document.querySelectorAll('.analisis-chip-filtro.active')
        .forEach(b => b.classList.remove('active'));
    renderizarTabla();
}

function toggleFiltrosPanel(){
    const panel = document.getElementById('analisisFiltrosAvanzados');
    const btn = document.getElementById('btnFiltrosAvanzados');
    const abierto = panel.classList.toggle('open');
    if (btn) btn.classList.toggle('active', abierto);
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();

    if (!datosUsuario) {
        window.location.href = '../index.html';
        return;
    }

    esOperadorSimple = !['admin', 'admin_general'].includes(datosUsuario.rol) && !datosUsuario.es_supervisor;

    if (esOperadorSimple) {
        const wrap = document.getElementById('wrapSelectOperador');
        if (wrap) wrap.style.display = 'none';
    }

    cambiarVistaAnalisis('general');
    await cargarDatosAnalisis();
});

// ============================================
// CARGA DE DATOS
// ============================================

async function cargarDatosAnalisis() {
    mostrarCargando();

    try {
        let query = supabaseClient
            .from('polizas')
            .select(`
                id,
                numero_poliza,
                estado_compania,
                estado_mercado,
                estado_documentos,
                fecha_plazo_documentos,
                operador_nombre,
                compania,
                prima,
                fecha_efectividad,
                clientes (
                    id,
                    nombres,
                    apellidos,
                    fecha_nacimiento,
                    estado_migratorio,
                    ocupacion,
                    telefono1,
                    archivado,
                    ssn,
                    pagos_mensuales_cliente (
                        anio,
                        enero,
                        febrero,
                        marzo,
                        abril,
                        mayo,
                        junio,
                        julio,
                        agosto,
                        septiembre,
                        octubre,
                        noviembre,
                        diciembre
                    )
                ),
                seguimientos (
                    id,
                    fecha_seguimiento,
                    seguimiento_efectivo,
                    observacion
                )
                
            `)
        if (esOperadorSimple) {
            query = query.eq('operador_nombre', datosUsuario.nombre);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Filtrar archivados
        todasLasPolizasAnalisis = (data || []).filter(p =>
            p.clientes && !p.clientes.archivado && p.operador_nombre !== 'Jostyn Aragón' &&
            p.operador_nombre !== 'Jostyn Aragon' && p.estado_mercado !== "Cancelado a P.C"
        );

        let { data: revisionData, error: revisionError } = await supabaseClient
            .from('revision_mercado')
            .select('estado_mercado, recuperado, fecha_ingreso, fecha_recuperacion, operador_nombre');
        if (revisionError) {
            // Si la tabla no tiene operador_nombre, carga sin esa columna
            ({ data: revisionData, error: revisionError } = await supabaseClient
                .from('revision_mercado')
                .select('estado_mercado, recuperado, fecha_ingreso, fecha_recuperacion'));
        }

        if (revisionError) {
            console.error('Error cargando revision_mercado:', revisionError);
        } else {
            todaLaRevisionMercado = revisionData || [];
        }

        // Pre-calcular scoring para todos
        scoringCache = {};
        todasLasPolizasAnalisis.forEach(p => calcularScoring(p));

        poblarSelectOperadores();
        aplicarFiltroOperador();

    } catch (err) {
        console.error('Error cargando análisis:', err);
        document.getElementById('analisisTbody').innerHTML = `
            <tr>
                <td colspan="9" class="analisis-tabla-vacia">
                    <span class="material-symbols-rounded">error</span>
                    Error al cargar datos: ${err.message}
                </td>
            </tr>
        `;
    }
}

function mostrarCargando() {
    document.getElementById('analisisTbody').innerHTML = `
        <tr>
            <td colspan="9" class="analisis-tabla-vacia">
                <span class="material-symbols-rounded">hourglass_empty</span>
                Cargando datos...
            </td>
        </tr>
    `;
}

// ============================================
// SELECTOR DE OPERADORES
// ============================================

function poblarSelectOperadores() {
    const select = document.getElementById('selectOperador');
    if (!select || esOperadorSimple) return;

    const operadores = [...new Set(
        todasLasPolizasAnalisis.map(p => p.operador_nombre).filter(Boolean)
    )].sort();

    select.innerHTML = '<option value="todos">Todos los operadores</option>';
    operadores.forEach(op => {
        const opt = document.createElement('option');
        opt.value = op;
        opt.textContent = op;
        select.appendChild(opt);
    });
}

function cambiarOperador() {
    operadorSeleccionado = document.getElementById('selectOperador').value;
    filtroNivelActivo    = 'todos';
    filtroSSNOscarActivo = false;

    document.querySelectorAll('.analisis-filtro-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filtro === 'todos');
    });

    aplicarFiltroOperador();
}

function aplicarFiltroOperador() {
    if (operadorSeleccionado === 'todos') {
        polizasFiltradas = [...todasLasPolizasAnalisis];
    } else {
        polizasFiltradas = todasLasPolizasAnalisis.filter(
            p => p.operador_nombre === operadorSeleccionado
        );
    }

    // Ya no hay dos secciones — siempre la misma, con la data ya filtrada arriba
    document.getElementById('seccionGraficasTodos').style.display = 'flex';
    inicializarCarrusel('todos');

    renderizarResumen();
    renderizarGraficas();
    renderizarTabla();
    renderizarPlanes();
}

// ============================================
// SCORING — 8 FACTORES
// ============================================

function calcularScoring(poliza) {
    if (scoringCache[poliza.id]) return scoringCache[poliza.id];

    const base = calcularScoringCartera(poliza);

    const resultado = {
        ...base,
        iaResumen: null,
        iaAccion: null
    };
    scoringCache[poliza.id] = resultado;
    return resultado;
}

function obtenerCampoPagoMesActual() {
    const meses = [
        'enero','febrero','marzo','abril','mayo','junio',
        'julio','agosto','septiembre','octubre','noviembre','diciembre'
    ];
    return `pago_${meses[new Date().getMonth()]}`;
}

// ============================================
// RESUMEN
// ============================================

function renderizarResumen() {
    let rojo = 0, amarillo = 0, verde = 0;

    polizasFiltradas.forEach(p => {
        const s = scoringCache[p.id];
        if (!s) return;
        if (s.nivel === 'rojo')          rojo++;
        else if (s.nivel === 'amarillo') amarillo++;
        else                             verde++;
    });

    document.getElementById('countRojo').textContent     = rojo;
    document.getElementById('countAmarillo').textContent = amarillo;
    document.getElementById('countVerde').textContent    = verde;
}

// ============================================
// GRÁFICAS
// ============================================

function destruirGrafica(id) {
    if (graficasInstancias[id]) {
        graficasInstancias[id].destroy();
        delete graficasInstancias[id];
    }
}

function renderizarGraficas() {
    renderizarGraficasTodos();
}

function renderizarGraficasTodos() {
    const conteoCompania = {};
    const conteoMercado  = {};
    const conteoOperador = {};
    const riesgoOpMap    = {};
    const conteoFactores = {};
    let oscarConSSN = 0; 
    let oscarSinSSN = 0;


    polizasFiltradas.forEach(p => {
        const sc = scoringCache[p.id];
        const op = p.operador_nombre || 'Sin asignar';

        const ec = p.estado_compania || 'Sin estado';
        conteoCompania[ec] = (conteoCompania[ec] || 0) + 1;

        const cliente = p.clientes || {};
        const ssnCompleto = !!(cliente.ssn && cliente.ssn.replace(/\D/g, '').length === 9);
        if (op === 'Oscar') {
            ssnCompleto ? oscarConSSN++ : oscarSinSSN++;
        }

        const em = p.estado_mercado || 'Sin estado';
        conteoMercado[em] = (conteoMercado[em] || 0) + 1;

        conteoOperador[op] = (conteoOperador[op] || 0) + 1;

        if (!riesgoOpMap[op]) riesgoOpMap[op] = { rojo: 0, amarillo: 0, verde: 0 };
        if (sc) riesgoOpMap[op][sc.nivel]++;

        if (sc) {
            sc.factores.forEach(f => {
                const key = f.replace(/\d+/g, 'N');
                conteoFactores[key] = (conteoFactores[key] || 0) + 1;
            });
        }
    });

    const coloresEstado = {
        'Activo': '#22c55e', 'Cancelado': '#ef4444', 'Suspendido': '#f59e0b',
        'Pendiente': '#6366f1', 'Sin estado': '#94a3b8'
    };

    // Gráfica 1 — Estado compañía
    destruirGrafica('graficaCompania');
    graficasInstancias['graficaCompania'] = new Chart(
        document.getElementById('graficaCompania').getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(conteoCompania),
                datasets: [{
                    data: Object.values(conteoCompania),
                    backgroundColor: Object.keys(conteoCompania).map(k => coloresEstado[k] || '#94a3b8'),
                    borderWidth: 2, borderColor: '#fff'
                }]
            },
            options: opcionesDonut()
        }
    );

    // Gráfica 2 — Estado mercado
    destruirGrafica('graficaMercado');
    graficasInstancias['graficaMercado'] = new Chart(
        document.getElementById('graficaMercado').getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(conteoMercado),
                datasets: [{
                    data: Object.values(conteoMercado),
                    backgroundColor: Object.keys(conteoMercado).map(k => coloresEstado[k] || '#6366f1'),
                    borderWidth: 2, borderColor: '#fff'
                }]
            },
            options: opcionesDonut()
        }
    );

    // Gráfica 3 — Clientes por operador
    const opsLabels = Object.keys(conteoOperador);
    destruirGrafica('graficaOperadores');
    graficasInstancias['graficaOperadores'] = new Chart(
        document.getElementById('graficaOperadores').getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: opsLabels,
                datasets: [{
                    data: opsLabels.map(k => conteoOperador[k]),
                    backgroundColor: generarColores(opsLabels.length),
                    borderWidth: 2, borderColor: '#fff'
                }]
            },
            options: opcionesDonut()
        }
    );

    // Gráfica 4 — Riesgo por operador (barras apiladas)
    const opsRiesgo = Object.keys(riesgoOpMap);
    destruirGrafica('graficaRiesgoOperador');
    graficasInstancias['graficaRiesgoOperador'] = new Chart(
        document.getElementById('graficaRiesgoOperador').getContext('2d'), {
            type: 'bar',
            data: {
                labels: opsRiesgo,
                datasets: [
                    { label: 'Rojo',     data: opsRiesgo.map(op => riesgoOpMap[op].rojo),     backgroundColor: '#ef4444' },
                    { label: 'Amarillo', data: opsRiesgo.map(op => riesgoOpMap[op].amarillo), backgroundColor: '#f59e0b' },
                    { label: 'Verde',    data: opsRiesgo.map(op => riesgoOpMap[op].verde),    backgroundColor: '#22c55e' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, ticks: { font: { size: 10 } } },
                    y: { stacked: true, ticks: { precision: 0 } }
                },
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }
            }
        }
    );

    // Gráfica 5 — Factores más frecuentes (horizontal)
    const factoresTop = Object.entries(conteoFactores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);

    destruirGrafica('graficaFactores');
    graficasInstancias['graficaFactores'] = new Chart(
        document.getElementById('graficaFactores').getContext('2d'), {
            type: 'bar',
            data: {
                labels: factoresTop.map(([k]) => k),
                datasets: [{
                    data: factoresTop.map(([, v]) => v),
                    backgroundColor: '#6366f1',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { precision: 0 } },
                    y: { ticks: { font: { size: 10 } } }
                }
            }
        }
    );

    // Grafica 6 - Pendiente SSN (Oscar)
    destruirGrafica('graficaPendienteSSn');
    graficasInstancias['graficaPendienteSSn'] = new Chart(
        document.getElementById('graficaPendienteSSn').getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['Sin SSN', 'Con SSN'],
                datasets: [{
                    data: [oscarSinSSN, oscarConSSN],
                    backgroundColor: ['#ef4444', '#22c55e'],
                    borderWidth: 2, borderColor: '#fff'
                }]
            },
            options: {
                ...opcionesDonut(),
                onClick: (evt, elementos) => {
                    if (!elementos.length) return;
                    if (elementos[0].index === 0) toggleFiltroSSNOscar();
                }
            }
        }
    );

    renderizarGraficasMercadoMensual();
}

function ultimosNMeses(n) {
    const meses = [];
    const hoy = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        meses.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
        });
    }
    return meses;
}

function contarPorMes(registros, campoFecha, filtroFn) {
    const meses = ultimosNMeses(6);
    const conteo = {};
    meses.forEach(m => conteo[m.key] = 0);

    registros.forEach(r => {
        if (!filtroFn(r) || !r[campoFecha]) return;
        const d = new Date(r[campoFecha]);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
        if (key in conteo) conteo[key]++;
    });

    return { labels: meses.map(m => m.label), data: meses.map(m => conteo[m.key]) };
}

function opcionesBarraMensual() {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { precision: 0 } }, x: { ticks: { font: { size: 10 } } } }
    };
}

function renderizarGraficasMercadoMensual() {
    const datosFiltrados = operadorSeleccionado === 'todos'
        ? todaLaRevisionMercado
        : todaLaRevisionMercado.filter(r =>
            (r.operador_nombre || '').trim().toLowerCase() === operadorSeleccionado.trim().toLowerCase()
        );

    // Compara sin tildes ni mayúsculas ("Triple póliza" = "triple poliza")
    const norm = (v) => (v || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const config = [
        { id: 'graficaRecuperadosMes',  campo: 'fecha_recuperacion', color: '#22c55e', filtro: r => ['si', 'sí', 'true'].includes(norm(r.recuperado)) },
        { id: 'graficaCanceladosMesPc', campo: 'fecha_ingreso',      color: '#b91c1c', filtro: r => norm(r.estado_mercado) === 'cancelado a p.c' },
        { id: 'graficaCanceladosMes',   campo: 'fecha_ingreso',      color: '#ef4444', filtro: r => ['cancelado', 'cancelados'].includes(norm(r.estado_mercado)) },
        { id: 'graficaRobadosMes',      campo: 'fecha_ingreso',      color: '#f97316', filtro: r => norm(r.estado_mercado) === 'robado' },
        { id: 'graficaDoblesMes',       campo: 'fecha_ingreso',      color: '#8b5cf6', filtro: r => norm(r.estado_mercado) === 'doble poliza' },
        { id: 'graficaTriplesMes',      campo: 'fecha_ingreso',      color: '#f59e0b', filtro: r => norm(r.estado_mercado) === 'triple poliza' },
    ];

    config.forEach(c => {
        const canvas = document.getElementById(c.id);
        if (!canvas) return;

        const { labels, data } = contarPorMes(datosFiltrados, c.campo, c.filtro);

        destruirGrafica(c.id);
        graficasInstancias[c.id] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels, datasets: [{ data, backgroundColor: c.color, borderRadius: 4 }] },
            options: opcionesBarraMensual()
        });
    });
}

const estadoCarrusel = {};

function inicializarCarrusel(grupo) {
    const contenedor = document.getElementById(`carruselPages-${grupo}`);
    if(!contenedor) return;
    const totalPaginas = contenedor.querySelectorAll('.carousel-page').length;
    
    estadoCarrusel[grupo] = 0;

    const nav = document.getElementById(`carruselNav-${grupo}`);
    if (nav) nav.style.display = totalPaginas > 1 ? 'flex' : 'none';

    actualizarCarrusel(grupo)
}

function actualizarCarrusel(grupo) {
    const contenedor = document.getElementById(`carruselPages-${grupo}`);
    if (!contenedor) return;
    const paginas = contenedor.querySelectorAll('.carousel-page');
    const idx = estadoCarrusel[grupo] || 0;

    paginas.forEach((p, i) => p.classList.toggle('active', i === idx));

    const prev = document.getElementById(`carruselPrev-${grupo}`);
    const next = document.getElementById(`carruselNext-${grupo}`);
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === paginas.length - 1;
}

function carruselAnterior(grupo) {
    if (estadoCarrusel[grupo] > 0) {
        estadoCarrusel[grupo]--;
        actualizarCarrusel(grupo);
    }
}

function carruselSiguiente(grupo) {
    const contenedor = document.getElementById(`carruselPages-${grupo}`);
    const totalPaginas = contenedor.querySelectorAll('.carousel-page').length;
    if (estadoCarrusel[grupo] < totalPaginas - 1) {
        estadoCarrusel[grupo]++;
        actualizarCarrusel(grupo);
    }
}

function toggleFiltroSSNOscar() {
    filtroSSNOscarActivo = !filtroSSNOscarActivo;
    filtroNivelActivo = 'todos';
    document.querySelectorAll('.analisis-filtro-btn').forEach(b => b.classList.toggle('active', b.dataset.filtro === 'todos'));
    renderizarTabla()
}

function opcionesDonut() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }
        }
    };
}

function generarColores(n) {
    const base = [
        '#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b',
        '#ef4444','#ec4899','#0284c7','#84cc16','#f97316'
    ];
    return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

// ============================================
// TABLA
// ============================================

function filtrarTabla(nivel, btn) {
    filtroNivelActivo = nivel;
    filtroSSNOscarActivo = false;
    document.querySelectorAll('.analisis-filtro-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderizarTabla();
}

function renderizarTabla() {
    const tbody   = document.getElementById('analisisTbody');
    const countEl = document.getElementById('tablaCount');

    let lista = polizasFiltradas;

    if (filtroSSNOscarActivo) {
        lista = lista.filter(p => {
            const cliente = p.clientes || {};
            const ssnCompleto = !!(cliente.ssn && cliente.ssn.replace(/\D/g, '').length === 9);
            return p.operador_nombre === 'Oscar' && !ssnCompleto;
        });
    } else if (filtroNivelActivo !== 'todos') {
        lista = lista.filter(p => scoringCache[p.id]?.nivel === filtroNivelActivo);
    }

    lista = lista.filter(cumpleFiltrosAvanzados)

    // Ordenar: rojos primero → mayor score primero
    const orden = { rojo: 0, amarillo: 1, verde: 2 };
    lista.sort((a, b) =>
        (orden[scoringCache[a.id]?.nivel] ?? 3) - (orden[scoringCache[b.id]?.nivel] ?? 3)
        || (scoringCache[b.id]?.score ?? 0) - (scoringCache[a.id]?.score ?? 0)
    );

    countEl.textContent = lista.length;

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="analisis-tabla-vacia">
                    <span class="material-symbols-rounded">search_off</span>
                    No hay clientes en este nivel de riesgo
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const sc     = scoringCache[p.id] || { score: 0, nivel: 'verde', factores: [] };
        const cl     = p.clientes || {};
        const nombre = `${cl.nombres || ''} ${cl.apellidos || ''}`.trim();

        const segs          = (p.seguimientos || [])
            .sort((a, b) => new Date(b.fecha_seguimiento) - new Date(a.fecha_seguimiento));
        const ultimoContacto = segs.length > 0
            ? formatearFechaCorta(segs[0].fecha_seguimiento)
            : '—';

        const iconNivel = sc.nivel === 'rojo' ? 'warning'
                        : sc.nivel === 'amarillo' ? 'info'
                        : 'check_circle';

        const iaHTML = sc.iaResumen
            ? `<span class="ia-celda-resultado">${escapeHtml(sc.iaResumen)}</span>`
            : `<span class="ia-celda-pendiente">Pendiente de escaneo IA</span>`;

        const btnAccion = sc.nivel === 'rojo'
            ? `<button class="btn-plan-ia" onclick="scrollAPlanes()">
                   <span class="material-symbols-rounded">auto_awesome</span>
                   Ver plan
               </button>`
            : `<span style="color:var(--text-secondary,#94a3b8); font-size:0.75rem">—</span>`;

        return `
            <tr>
                <td>
                    <div style="font-weight:600">
                        <a href="./cliente_editar.html?id=${cl.id || ''}" onclick="event.stopPropagation()" target="_blank">
                        ${escapeHtml(nombre)}
                    </a>
                    </div>
                    <div style="font-size:0.72rem;color:var(--text-secondary,#64748b)">
                        ${escapeHtml(p.compania || '')}
                    </div>
                </td>
                <td>${p.estado_mercado || "Pendiente revisión"}</td>
                <td style="font-size:0.82rem">${escapeHtml(p.operador_nombre || '—')}</td>
                <td><span class="score-badge ${sc.nivel}">${sc.score}</span></td>
                <td>
                    <span class="nivel-badge ${sc.nivel}">
                        <span class="material-symbols-rounded">${iconNivel}</span>
                        ${sc.nivel.charAt(0).toUpperCase() + sc.nivel.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="factores-lista">
                        ${sc.factores.map(f =>
                            `<span class="factor-chip">${escapeHtml(f)}</span>`
                        ).join('')}
                    </div>
                </td>
                <td style="font-size:0.82rem">${ultimoContacto}</td>
                <td>${iaHTML}</td>
                <td>${btnAccion}</td>
            </tr>`;
    }).join('');
}

// ============================================
// PLANES DE ACCIÓN
// ============================================

function renderizarPlanes() {
    const seccion    = document.getElementById('analisisPlanes');
    const contenedor = document.getElementById('planesContenedor');
    const countEl    = document.getElementById('planesCount');

    const rojos = polizasFiltradas.filter(p => scoringCache[p.id]?.nivel === 'rojo');
    countEl.textContent = `${rojos.length} caso${rojos.length !== 1 ? 's' : ''} crítico${rojos.length !== 1 ? 's' : ''}`;

    if (rojos.length === 0) {
        seccion.style.display = 'none';
        return;
    }

    seccion.style.display = 'flex';

    contenedor.innerHTML = rojos.map(p => {
        const sc    = scoringCache[p.id];
        const cl    = p.clientes || {};
        const nom   = `${cl.nombres || ''} ${cl.apellidos || ''}`.trim();
        const id    = p.id;
        const plan  = planesGenerados[id];

        return `
            <div class="plan-card" id="planCard-${id}">
                <div class="plan-card-header">
                    <div>
                        <div class="plan-card-nombre">${escapeHtml(nom)}</div>
                        <div class="plan-card-meta">
                            ${escapeHtml(p.operador_nombre || '')} · ${escapeHtml(p.compania || '')}
                        </div>
                    </div>
                    <span class="plan-card-score">
                        <span class="material-symbols-rounded">warning</span>
                        ${sc.score} pts
                    </span>
                </div>
                <div class="plan-card-body" id="planBody-${id}">
                    <div class="plan-factores">
                        <div class="plan-factores-titulo">Factores de riesgo detectados</div>
                        <div class="plan-factores-lista">
                            ${sc.factores.map(f =>
                                `<div class="plan-factor-item">${escapeHtml(f)}</div>`
                            ).join('')}
                        </div>
                    </div>
                    ${plan
                        ? renderizarPlanGenerado(id, p, plan)
                        : `<div class="plan-generar-wrap">
                               <div class="plan-loader" id="planLoader-${id}">
                                   <div class="spinner"></div>
                                   Generando plan con IA...
                               </div>
                               <button class="btn-generar-plan" id="btnPlan-${id}"
                                       onclick="generarPlan('${id}')">
                                   <span class="material-symbols-rounded">auto_awesome</span>
                                   Generar plan con IA
                               </button>
                           </div>`
                    }
                </div>
            </div>`;
    }).join('');
}

function renderizarPlanGenerado(polizaId, poliza, plan) {
    const cl     = poliza.clientes || {};
    const tel    = cl.telefono1 || poliza.telefono1 || '';
    const script = plan.script || '';
    const waLink = `https://api.whatsapp.com/send?phone=1${tel.replace(/\D/g,'')}` +
                   `&text=${encodeURIComponent(script)}`;

    return `
        <div class="plan-pasos">
            <div class="plan-paso">
                <div class="plan-paso-titulo">Paso 1 — Contacto</div>
                <div class="plan-paso-texto">${escapeHtml(plan.paso1 || '')}</div>
            </div>
            <div class="plan-paso">
                <div class="plan-paso-titulo">Paso 2 — Propuesta</div>
                <div class="plan-paso-texto">${escapeHtml(plan.paso2 || '')}</div>
            </div>
            <div class="plan-paso">
                <div class="plan-paso-titulo">Paso 3 — Cierre</div>
                <div class="plan-paso-texto">${escapeHtml(plan.paso3 || '')}</div>
            </div>
        </div>
        <div class="plan-script">
            <div class="plan-script-titulo">
                <span class="material-symbols-rounded">chat</span>
                Script de WhatsApp
            </div>
            <div class="plan-script-texto">${escapeHtml(script)}</div>
            <div class="plan-script-acciones">
                <button class="btn-copiar-script"
                        onclick="copiarAlPortapapeles(\`${script.replace(/`/g,'\\`')}\`)">
                    Copiar
                </button>
                <a class="btn-whatsapp" href="${waLink}" target="_blank">
                    <span class="material-symbols-rounded">chat</span>
                    WhatsApp
                </a>
            </div>
        </div>`;
}

async function generarPlan(polizaId) {
    const btn    = document.getElementById(`btnPlan-${polizaId}`);
    const loader = document.getElementById(`planLoader-${polizaId}`);
    if (btn)    btn.style.display    = 'none';
    if (loader) loader.style.display = 'flex';

    const poliza = todasLasPolizasAnalisis.find(p => p.id === polizaId);
    if (!poliza) return;

    const sc     = scoringCache[polizaId];
    const cl     = poliza.clientes || {};
    const nombre = `${cl.nombres || ''} ${cl.apellidos || ''}`.trim();
    const segs   = (poliza.seguimientos || [])
        .sort((a, b) => new Date(b.fecha_seguimiento) - new Date(a.fecha_seguimiento))
        .slice(0, 5)
        .map(s => s.observacion || '')
        .filter(Boolean)
        .join('\n');

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1000,
                system: `Eres un Director de Retención de Clientes de una agencia de seguros médicos ACA en EE.UU.
Genera un plan de retención personalizado y conciso.
Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional:
{
    "paso1": "Acción de contacto inmediato y empático",
    "paso2": "Propuesta de valor o solución al problema principal",
    "paso3": "Protocolo de cierre o seguimiento si no responde",
    "script": "Mensaje de WhatsApp persuasivo y cálido (máximo 5 líneas)"
}`,
                messages: [{
                    role: 'user',
                    content: `Cliente: ${nombre}
Compañía: ${poliza.compania || 'N/A'}
Factores de riesgo: ${sc?.factores?.join(', ') || 'No detectados'}
Notas recientes del agente:
${segs || 'Sin notas disponibles'}`
                }]
            })
        });

        const data  = await response.json();
        const texto = data.content?.[0]?.text || '{}';
        const plan  = JSON.parse(texto.replace(/```json|```/g, '').trim());

        planesGenerados[polizaId] = plan;

        // Re-renderizar solo el cuerpo de esta tarjeta
        const body = document.getElementById(`planBody-${polizaId}`);
        if (body) {
            const factoresHTML = body.querySelector('.plan-factores').outerHTML;
            body.innerHTML = factoresHTML + renderizarPlanGenerado(polizaId, poliza, plan);
        }

    } catch (err) {
        console.error('Error generando plan:', err);
        if (btn)    btn.style.display    = 'flex';
        if (loader) loader.style.display = 'none';
    }
}

// ============================================
// ESCANEO SEMÁNTICO MASIVO (IA)
// ============================================

async function ejecutarEscaneoIA() {
    const btn      = document.getElementById('btnEscaneoIA');
    const progreso = document.getElementById('iaProgreso');
    const textoEl  = document.getElementById('iaProgresoTexto');
    const pctEl    = document.getElementById('iaProgresoPct');
    const barraEl  = document.getElementById('iaProgresoBarra');

    btn.disabled           = true;
    progreso.style.display = 'flex';

    const pendientes = polizasFiltradas.filter(p => !scoringCache[p.id]?.iaResumen);
    const total      = pendientes.length;

    if (total === 0) {
        textoEl.textContent  = 'Todos los clientes ya fueron analizados.';
        pctEl.textContent    = '100%';
        barraEl.style.width  = '100%';
        setTimeout(() => { progreso.style.display = 'none'; btn.disabled = false; }, 2000);
        return;
    }

    let completados = 0;
    const cola      = [...pendientes];

    const worker = async () => {
        while (cola.length > 0) {
            const poliza = cola.shift();
            if (!poliza) break;

            const cl     = poliza.clientes || {};
            const nombre = `${cl.nombres || ''} ${cl.apellidos || ''}`.trim();
            const notas  = (poliza.seguimientos || [])
                .sort((a, b) => new Date(b.fecha_seguimiento) - new Date(a.fecha_seguimiento))
                .slice(0, 5)
                .map(s => s.observacion || '')
                .filter(Boolean)
                .join('\n');

            textoEl.textContent = `Analizando: ${nombre}...`;

            try {
                const resultado = await analizarNotaConIA(notas, nombre);
                if (scoringCache[poliza.id]) {
                    scoringCache[poliza.id].iaResumen = resultado.resumen || null;
                    scoringCache[poliza.id].iaAccion  = resultado.accion  || null;

                    const extra = Math.min(resultado.riesgo_adicional || 0, 20);
                    scoringCache[poliza.id].score = Math.min(100,
                        scoringCache[poliza.id].score + extra
                    );
                    const s = scoringCache[poliza.id].score;
                    scoringCache[poliza.id].nivel = s >= 61 ? 'rojo' : s >= 26 ? 'amarillo' : 'verde';
                }
            } catch (e) {
                console.warn(`Error IA ${nombre}:`, e);
            }

            completados++;
            const porcentaje    = Math.round((completados / total) * 100);
            pctEl.textContent   = `${porcentaje}%`;
            barraEl.style.width = `${porcentaje}%`;
        }
    };

    await Promise.all(Array.from({ length: Math.min(3, total) }, worker));

    textoEl.textContent  = '¡Análisis semántico completado!';
    pctEl.textContent    = '100%';
    barraEl.style.width  = '100%';

    renderizarResumen();
    renderizarGraficas();
    renderizarTabla();
    renderizarPlanes();

    setTimeout(() => {
        progreso.style.display = 'none';
        btn.disabled = false;
    }, 2500);
}

async function analizarNotaConIA(notas, nombreCliente) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1000,
            system: `Eres un analista experto en retención de clientes de seguros médicos ACA.
Analiza las notas del agente y determina señales de riesgo de cancelación.
Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional:
{
    "resumen": "Una sola frase con el riesgo o situación principal detectada",
    "riesgo_adicional": 0,
    "accion": "Acción concreta y específica a tomar con este cliente"
}
riesgo_adicional: número entre 0 y 20.
Si hay señales claras de querer cancelar, cambiar o comparar: entre 10 y 20.
Si no hay señales de riesgo en el texto: 0.`,
            messages: [{
                role: 'user',
                content: `Cliente: ${nombreCliente}\nNotas del agente:\n${notas || 'Sin notas disponibles'}`
            }]
        })
    });

    const data  = await response.json();
    const texto = data.content?.[0]?.text || '{}';
    try {
        return JSON.parse(texto.replace(/```json|```/g, '').trim());
    } catch {
        return { resumen: null, riesgo_adicional: 0, accion: null };
    }
}

// ============================================
// UTILIDADES
// ============================================

function scrollAPlanes() {
    document.getElementById('analisisPlanes')?.scrollIntoView({ behavior: 'smooth' });
}

function copiarAlPortapapeles(texto) {
    const el = document.createElement('textarea');
    el.value = texto;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
}

function formatearFechaCorta(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

function toggleFiltroAvanzadoCheck(clave, btn) {
    filtrosAvanzados[clave] = !filtrosAvanzados[clave];
    btn.classList.toggle('active', filtrosAvanzados[clave]);
    renderizarTabla();
}

// ============================================
// ANÁLISIS ESPECÍFICO — RENDIMIENTO DE VENDEDORES
// ============================================
// Venta = póliza cuyo cliente tiene tipo_registro "Nuevo" o "Venta con registro",
// contada por clientes.venta_realizada_por y fechada por polizas.created_at
// (mismo criterio que la clasificación de ventas de home.js).

const NOMBRES_MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TIPOS_VENTA = ['nuevo', 'venta con registro'];
const EXCLUIR_VENDEDORES = ['Jostyn Aragón', 'Jostyn Aragon'];

let vistaAnalisisActual = 'general';
let vistaEspecificaInicializada = false;
let usuariosEspecifico = [];
let rendimientoActual = { vendedores: [], desde: null, hasta: null };

let chartVentasDiarias = null;
let seriesVentasDiarias = null;
let chartVentasSemanales = null;
let seriesVentasSemanales = null;

function puedeVerTodosRendimiento() {
    if (!datosUsuario) return false;
    if (['admin', 'admin_general'].includes(datosUsuario.rol)) return true;
    if (typeof esAdministrador === 'function' && esAdministrador()) return true;
    return !!datosUsuario.es_supervisor;
}

function cambiarVistaAnalisis(vista) {
    vistaAnalisisActual = vista;

    document.querySelectorAll('.analisis-nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.vista === vista);
    });

    document.getElementById('vistaAnalisisGeneral').style.display    = vista === 'general'    ? 'flex' : 'none';
    document.getElementById('vistaAnalisisEspecifico').style.display = vista === 'especifico' ? 'flex' : 'none';

    // El selector de operador y el Escaneo IA solo aplican a la vista general
    const acciones = document.getElementById('accionesGeneral');
    if (acciones) acciones.style.display = vista === 'general' ? 'flex' : 'none';

    if (vista === 'especifico' && !vistaEspecificaInicializada) {
        vistaEspecificaInicializada = true;
        inicializarVistaEspecifica();
    }
}

function inicializarSelectoresEspecifico() {
    const selectMes  = document.getElementById('selectMesEspecifico');
    const selectAnio = document.getElementById('selectAnioEspecifico');
    const hoy = new Date();

    selectMes.innerHTML = NOMBRES_MESES_ES
        .map((nombre, idx) => `<option value="${idx + 1}">${nombre}</option>`).join('');
    selectMes.value = hoy.getMonth() + 1;

    const anioActual = hoy.getFullYear();
    selectAnio.innerHTML = [anioActual - 1, anioActual]
        .map(a => `<option value="${a}">${a}</option>`).join('');
    selectAnio.value = anioActual;
}

async function inicializarVistaEspecifica() {
    inicializarSelectoresEspecifico();

    if (puedeVerTodosRendimiento()) {
        document.getElementById('wrapSelectDepartamentoEspecifico').style.display = 'flex';
        document.getElementById('wrapSelectOperadorEspecifico').style.display = 'flex';
        await cargarDepartamentosEspecifico();
        cargarOperadoresEspecifico();
    } else if (!datosUsuario.departamento) {
        // Operador sin departamento: no se puede calcular su meta
        document.getElementById('rendimientoSinDepartamento').style.display = 'block';
        document.getElementById('rendimientoContenido').style.display = 'none';
        return;
    }

    await cargarRendimientoEspecifico();
}

async function cargarDepartamentosEspecifico() {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('id, nombre, departamento, activo')
        .eq('activo', true)
        .order('nombre');

    if (error) {
        console.error('Error cargando usuarios:', error);
        usuariosEspecifico = [];
    } else {
        usuariosEspecifico = (data || []).filter(u => !EXCLUIR_VENDEDORES.includes(u.nombre));
    }

    const departamentos = [...new Set(usuariosEspecifico.map(u => u.departamento).filter(Boolean))].sort();
    const select = document.getElementById('selectDepartamentoEspecifico');
    select.innerHTML = '<option value="">Todos los departamentos</option>' +
        departamentos.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
}

function cargarOperadoresEspecifico() {
    const depto = document.getElementById('selectDepartamentoEspecifico').value;
    const lista = usuariosEspecifico.filter(u => !depto || u.departamento === depto);

    const select = document.getElementById('selectOperadorEspecifico');
    select.innerHTML = '<option value="">Todos los operadores</option>' +
        lista.map(u => `<option value="${escapeHtml(u.nombre)}">${escapeHtml(u.nombre)}</option>`).join('');
}

async function cambiarDepartamentoEspecifico() {
    cargarOperadoresEspecifico();
    await cargarRendimientoEspecifico();
}

async function cambiarOperadorEspecifico() {
    await cargarRendimientoEspecifico();
}

// Vendedores que entran en el cálculo según los selectores
function vendedoresSeleccionados() {
    if (!puedeVerTodosRendimiento()) return [datosUsuario.nombre];

    const operador = document.getElementById('selectOperadorEspecifico').value;
    if (operador) return [operador];

    const depto = document.getElementById('selectDepartamentoEspecifico').value;
    if (depto) return usuariosEspecifico.filter(u => u.departamento === depto).map(u => u.nombre);

    return null; // null = todos
}

function fechaLocalISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function cargarRendimientoEspecifico() {
    const anio = Number(document.getElementById('selectAnioEspecifico').value);
    const mes  = Number(document.getElementById('selectMesEspecifico').value);

    const inicioMes     = new Date(anio, mes - 1, 1);
    const inicioSig     = new Date(anio, mes, 1);
    const inicioAnterior = new Date(anio, mes - 2, 1);
    const diasDelMes    = new Date(anio, mes, 0).getDate();

    document.getElementById('rendPeriodoTexto').textContent = `${NOMBRES_MESES_ES[mes - 1]} ${anio}`;
    document.getElementById('rendVentasRealizadas').textContent = '…';

    // Trae el mes anterior y el actual en una sola consulta
    const { data, error } = await supabaseClient
        .from('polizas')
        .select('id, created_at, clientes!inner ( tipo_registro, venta_realizada_por, archivado )')
        .gte('created_at', inicioAnterior.toISOString())
        .lt('created_at', inicioSig.toISOString());

    if (error) {
        console.error('Error cargando rendimiento:', error);
        document.getElementById('rendVentasRealizadas').textContent = '—';
        return;
    }

    const vendedores = vendedoresSeleccionados();
    const ventas = (data || []).filter(p => {
        const c = p.clientes || {};
        if (c.archivado) return false;
        if (!TIPOS_VENTA.includes((c.tipo_registro || '').toLowerCase().trim())) return false;
        const v = c.venta_realizada_por;
        if (!v || EXCLUIR_VENDEDORES.includes(v)) return false;
        return !vendedores || vendedores.includes(v);
    });

    const delMes      = ventas.filter(p => new Date(p.created_at) >= inicioMes);
    const delAnterior = ventas.filter(p => new Date(p.created_at) <  inicioMes);

    // Conteo por día y por semana del mes (semana 1 = días 1-7, etc.)
    const porDia = {};
    for (let d = 1; d <= diasDelMes; d++) porDia[d] = 0;
    delMes.forEach(p => { porDia[new Date(p.created_at).getDate()]++; });

    const porSemana = {};
    Object.entries(porDia).forEach(([dia, n]) => {
        const sem = Math.floor((Number(dia) - 1) / 7) + 1;
        porSemana[sem] = (porSemana[sem] || 0) + n;
    });

    rendimientoActual = {
        vendedores,
        desde: fechaLocalISO(inicioMes),
        hasta: fechaLocalISO(new Date(anio, mes, 0))
    };

    // ---- KPIs
    const total = delMes.length;
    document.getElementById('rendVentasRealizadas').textContent = total;

    const meta = await obtenerMetaVentas(vendedores, anio, mes);
    document.getElementById('rendMeta').textContent = meta ?? 'Sin meta';
    document.getElementById('rendCumplimiento').textContent =
        meta ? `${Math.round((total / meta) * 100)}%` : '—';

    const prev = delAnterior.length;
    const evo  = document.getElementById('rendEvolucion');
    if (prev === 0) {
        evo.textContent = total > 0 ? `+${total}` : '—';
    } else {
        const pct = Math.round(((total - prev) / prev) * 100);
        evo.textContent = `${pct > 0 ? '+' : ''}${pct}%`;
    }
    evo.style.color = total >= prev ? '#16a34a' : '#dc2626';

    const hoy = new Date();
    const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
    const diasTranscurridos = esMesActual ? hoy.getDate() : diasDelMes;
    document.getElementById('rendPromedioDiario').textContent = (total / diasTranscurridos).toFixed(1);

    const mejor = Object.entries(porSemana).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('rendMejorSemana').textContent =
        mejor && mejor[1] > 0 ? `Sem. ${mejor[0]} (${mejor[1]})` : '—';

    // ---- Gráficas
    renderizarGraficaVentasDiarias(
        Object.entries(porDia).map(([dia, cantidad]) => ({
            dia: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
            cantidad
        }))
    );
    renderizarGraficaVentasSemanales(
        Object.entries(porSemana).map(([semana, cantidad]) => ({ semana: Number(semana), cantidad })),
        anio, mes
    );
}

// Meta de ventas: tabla metas_ventas (operador_nombre, anio, mes, meta).
// Si la tabla no existe o no hay metas cargadas, devuelve null.
async function obtenerMetaVentas(vendedores, anio, mes) {
    try {
        let q = supabaseClient.from('metas_ventas').select('operador_nombre, meta').eq('anio', anio).eq('mes', mes);
        if (vendedores) q = q.in('operador_nombre', vendedores);
        const { data, error } = await q;
        if (error || !data || data.length === 0) return null;
        return data.reduce((s, m) => s + (Number(m.meta) || 0), 0) || null;
    } catch {
        return null;
    }
}

// ---- Gráficas (Lightweight Charts)

function fechaLW(fechaStr) {
    const [anio, mes, dia] = fechaStr.split('-').map(Number);
    return { year: anio, month: mes, day: dia };
}

function opcionesGraficaLW() {
    const oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
    const linea = oscuro ? '#2e2e3e' : '#e2e8f0';
    return {
        layout: { textColor: oscuro ? '#9ca3b4' : '#64748b', background: { type: 'solid', color: 'transparent' } },
        grid: { vertLines: { visible: false }, horzLines: { color: linea } },
        timeScale: { borderColor: linea },
        rightPriceScale: { borderColor: linea },
        autoSize: true
    };
}

function crearGraficaVentasDiarias() {
    const contenedor = document.getElementById('graficaVentasDiarias');
    if (!contenedor || chartVentasDiarias) return;

    chartVentasDiarias = LightweightCharts.createChart(contenedor, opcionesGraficaLW());
    seriesVentasDiarias = chartVentasDiarias.addHistogramSeries({
        color: '#6366f1',
        priceFormat: { type: 'volume' }
    });

    chartVentasDiarias.subscribeClick((param) => {
        if (!param.time) return;
        const { year, month, day } = param.time;
        const fecha = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        irAPolizasDesdeRendimiento('dia', fecha, fecha);
    });
}

function renderizarGraficaVentasDiarias(ventasPorDia) {
    crearGraficaVentasDiarias();
    if (!seriesVentasDiarias) return;
    seriesVentasDiarias.setData((ventasPorDia || []).map(v => ({ time: fechaLW(v.dia), value: v.cantidad })));
    chartVentasDiarias.timeScale().fitContent();
}

function crearGraficaVentasSemanales() {
    const contenedor = document.getElementById('graficaVentasSemanales');
    if (!contenedor || chartVentasSemanales) return;

    chartVentasSemanales = LightweightCharts.createChart(contenedor, opcionesGraficaLW());
    seriesVentasSemanales = chartVentasSemanales.addHistogramSeries({
        color: '#f59e0b',
        priceFormat: { type: 'volume' }
    });

    chartVentasSemanales.subscribeClick((param) => {
        if (!param.time) return;
        const { year, month, day } = param.time;
        const inicioSemana = new Date(year, month - 1, day);
        const finMes = new Date(year, month, 0);
        let finSemana = new Date(year, month - 1, day + 6);
        if (finSemana > finMes) finSemana = finMes;
        irAPolizasDesdeRendimiento('semana', fechaLocalISO(inicioSemana), fechaLocalISO(finSemana));
    });
}

function renderizarGraficaVentasSemanales(ventasPorSemana, anio, mes) {
    crearGraficaVentasSemanales();
    if (!seriesVentasSemanales) return;
    seriesVentasSemanales.setData((ventasPorSemana || []).map(v => ({
        time: { year: anio, month: mes, day: (v.semana - 1) * 7 + 1 },
        value: v.cantidad
    })));
    chartVentasSemanales.timeScale().fitContent();
}

// Abre Pólizas filtrado por vendedor y rango de fechas (mes, semana o día)
function irAPolizasDesdeRendimiento(tipo, desde, hasta) {
    if (tipo === 'mes' || !desde) {
        desde = rendimientoActual.desde;
        hasta = rendimientoActual.hasta;
    }
    if (!desde) return;

    const params = new URLSearchParams({ desde, hasta, tipo: 'venta' });
    const v = rendimientoActual.vendedores;
    if (v && v.length === 1) params.set('vendedor', v[0]);

    window.open(`./polizas.html?${params.toString()}`, '_blank');
}