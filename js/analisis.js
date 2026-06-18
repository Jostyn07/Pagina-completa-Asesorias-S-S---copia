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

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();

    if (!datosUsuario) {
        window.location.href = '../index.html';
        return;
    }

    esOperadorSimple = datosUsuario.rol !== 'admin' && !datosUsuario.es_supervisor;

    if (esOperadorSimple) {
        const wrap = document.querySelector('.analisis-operador-wrap');
        if (wrap) wrap.style.display = 'none';
    }

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
                clientes (
                    id,
                    nombres,
                    apellidos,
                    fecha_nacimiento,
                    estado_migratorio,
                    ocupacion,
                    telefono1,
                    archivado,
                    metodos_pago (
                        pago_enero,
                        pago_febrero,
                        pago_marzo,
                        pago_abril,
                        pago_mayo,
                        pago_junio,
                        pago_julio,
                        pago_agosto,
                        pago_septiembre,
                        pago_octubre,
                        pago_noviembre,
                        pago_diciembre
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

        // Pre-calcular scoring para todos
        scoringCache = {};
        todasLasPolizasAnalisis.forEach(p => calcularScoring(p));

        poblarSelectOperadores();
        aplicarFiltroOperador();

    } catch (err) {
        console.error('Error cargando análisis:', err);
        document.getElementById('analisisTbody').innerHTML = `
            <tr>
                <td colspan="8" class="analisis-tabla-vacia">
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
            <td colspan="8" class="analisis-tabla-vacia">
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

    document.querySelectorAll('.analisis-filtro-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filtro === 'todos');
    });

    aplicarFiltroOperador();
}

function aplicarFiltroOperador() {
    if (operadorSeleccionado === 'todos') {
        polizasFiltradas = [...todasLasPolizasAnalisis];
        document.getElementById('seccionGraficasTodos').style.display    = 'grid';
        document.getElementById('seccionGraficasOperador').style.display = 'none';
    } else {
        polizasFiltradas = todasLasPolizasAnalisis.filter(
            p => p.operador_nombre === operadorSeleccionado
        );
        document.getElementById('seccionGraficasTodos').style.display    = 'none';
        document.getElementById('seccionGraficasOperador').style.display = 'grid';
    }

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

    let score = 0;
    const factores = [];

    const cliente      = poliza.clientes || {};
    const seguimientos = (poliza.seguimientos || [])
        .sort((a, b) => new Date(b.fecha_seguimiento) - new Date(a.fecha_seguimiento));

    // Factor 1: Documentos pendientes / vencidos
    const docStatus = (poliza.estado_documentos || '').toLowerCase();
    const docPlazo  = poliza.fecha_plazo_documentos;

    if (docStatus.includes('incompleto') || docStatus.includes('pendiente')) {
        if (docPlazo) {
            const dias = Math.ceil((new Date(docPlazo) - new Date()) / 86400000);
            if (dias < 0) {
                score += 35;
                factores.push('Documentos vencidos');
            } else if (dias < 15) {
                score += 30;
                factores.push(`Docs. vencen en ${dias} días`);
            } else if (dias < 30) {
                score += 20;
                factores.push(`Docs. vencen en ${dias} días`);
            } else {
                score += 10;
                factores.push('Documentos pendientes');
            }
        } else {
            score += 10;
            factores.push('Documentos incompletos');
        }
    }

    // Factor 2: Pago del mes actual
    const metodosPagoCliente = Array.isArray(poliza.clientes?.metodos_pago)
        ? (poliza.clientes.metodos_pago[0] || {})
        : (poliza.clientes?.metodos_pago || {});

    const primaMensual = parseFloat(poliza?.prima || 0);
    const campoPago    = obtenerCampoPagoMesActual();
    const estadoPago   = (metodosPagoCliente[campoPago] || '').toLowerCase();

    if (primaMensual > 0) {
        if (!estadoPago || estadoPago.includes('no') ||
            estadoPago.includes('pendiente') || estadoPago.includes('atrasa')) {
            score += 20;
            factores.push('Pago del mes pendiente');
        }
    }

    // Factor 3: Imposible de contactar
    if (seguimientos.length >= 3) {
        const ultimos3 = seguimientos.slice(0, 3);
        if (ultimos3.every(s => s.seguimiento_efectivo === 'No')) {
            score += 25;
            factores.push('Imposible contactar (3 intentos)');
        }
    } else if (seguimientos.length > 0 && seguimientos[0].seguimiento_efectivo === 'No') {
        score += 10;
        factores.push('Último contacto sin respuesta');
    }

    // Factor 4: Días sin contacto
    if (seguimientos.length > 0) {
        const dias = Math.floor(
            (new Date() - new Date(seguimientos[0].fecha_seguimiento)) / 86400000
        );
        if (dias > 60) {
            score += 20;
            factores.push(`Sin contacto ${dias} días`);
        } else if (dias > 30) {
            score += 10;
            factores.push(`Sin contacto ${dias} días`);
        }
    } else {
        score += 25;
        factores.push('Sin seguimientos registrados');
    }

    // Factor 5: Palabras clave en notas (riesgo básico, antes de IA)
    const notas = seguimientos.map(s => s.observacion || '').join(' ').toLowerCase();
    if (/cancelar|cambiar|competencia|caro|costoso|otra agencia|no quiere|no puede pagar|quiere salir/.test(notas)) {
        score += 25;
        factores.push('Señales de abandono en notas');
    }

    // Factor 6: Próximo a los 65 años (Medicare)
    if (cliente.fecha_nacimiento) {
        const edad = calcularEdad(cliente.fecha_nacimiento);
        if (edad >= 64.5) {
            score += 30;
            factores.push('Próximo a Medicare (≥64.5 años)');
        }
    }

    // Factor 7: Estatus migratorio temporal
    const migStatus = (cliente.estado_migratorio || '').toLowerCase();
    if (/temporal|asilo|daca|tps|ead|otro|I-94/.test(migStatus)) {
        score += 15;
        factores.push('Estatus migratorio temporal');
    }

    // Factor 8: Ingresos inestables
    const ocupacion = (cliente.ocupacion || '').toLowerCase();
    if (/independiente|1099|temporal|desempleado|freelance/.test(ocupacion)) {
        score += 10;
        factores.push('Ingresos inestables');
    }

    const finalScore = Math.min(100, score);
    let nivel = 'verde';
    if (finalScore >= 61)      nivel = 'rojo';
    else if (finalScore >= 26) nivel = 'amarillo';

    const resultado = { score: finalScore, nivel, factores, iaResumen: null, iaAccion: null };
    scoringCache[poliza.id] = resultado;
    return resultado;
}

function calcularEdad(fechaNacimiento) {
    const hoy  = new Date();
    const nac  = new Date(fechaNacimiento);
    const años = hoy.getFullYear() - nac.getFullYear();
    const mes  = hoy.getMonth() - nac.getMonth();
    return mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())
        ? años - 1 + (12 + mes) / 12
        : años + mes / 12;
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
    operadorSeleccionado === 'todos'
        ? renderizarGraficasTodos()
        : renderizarGraficasOperador();
}

function renderizarGraficasTodos() {
    const conteoCompania = {};
    const conteoMercado  = {};
    const conteoOperador = {};
    const riesgoOpMap    = {};
    const conteoFactores = {};

    polizasFiltradas.forEach(p => {
        const sc = scoringCache[p.id];
        const op = p.operador_nombre || 'Sin asignar';

        const ec = p.estado_compania || 'Sin estado';
        conteoCompania[ec] = (conteoCompania[ec] || 0) + 1;

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
                    y: { stacked: true, ticks: { stepSize: 1 } }
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
                    x: { ticks: { stepSize: 1 } },
                    y: { ticks: { font: { size: 10 } } }
                }
            }
        }
    );
}

function renderizarGraficasOperador() {
    const conteoCompania = {};
    const conteoMercado  = {};
    let rojo = 0, amarillo = 0, verde = 0;
    let docsVencidos = 0, docsMenos15 = 0, docsMenos30 = 0, docsBien = 0;
    const hoy = new Date();

    polizasFiltradas.forEach(p => {
        const sc = scoringCache[p.id];

        const ec = p.estado_compania || 'Sin estado';
        conteoCompania[ec] = (conteoCompania[ec] || 0) + 1;

        const em = p.estado_mercado || 'Sin estado';
        conteoMercado[em] = (conteoMercado[em] || 0) + 1;

        if (sc) {
            if (sc.nivel === 'rojo')          rojo++;
            else if (sc.nivel === 'amarillo') amarillo++;
            else                              verde++;
        }

        const docStatus = (p.estado_documentos || '').toLowerCase();
        if (docStatus.includes('incompleto') || docStatus.includes('pendiente')) {
            if (p.fecha_plazo_documentos) {
                const dias = Math.ceil((new Date(p.fecha_plazo_documentos) - hoy) / 86400000);
                if (dias < 0)       docsVencidos++;
                else if (dias < 15) docsMenos15++;
                else if (dias < 30) docsMenos30++;
                else                docsBien++;
            } else { docsBien++; }
        } else { docsBien++; }
    });

    const coloresEstado = {
        'Activo': '#22c55e', 'Cancelado': '#ef4444', 'Suspendido': '#f59e0b',
        'Pendiente': '#6366f1', 'Sin estado': '#94a3b8'
    };

    // Gráfica 1 — Estado compañía
    destruirGrafica('graficaCompaniaOp');
    graficasInstancias['graficaCompaniaOp'] = new Chart(
        document.getElementById('graficaCompaniaOp').getContext('2d'), {
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
    destruirGrafica('graficaMercadoOp');
    graficasInstancias['graficaMercadoOp'] = new Chart(
        document.getElementById('graficaMercadoOp').getContext('2d'), {
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

    // Gráfica 3 — Distribución de riesgo
    destruirGrafica('graficaRiesgoOp');
    graficasInstancias['graficaRiesgoOp'] = new Chart(
        document.getElementById('graficaRiesgoOp').getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Rojo', 'Amarillo', 'Verde'],
                datasets: [{
                    data: [rojo, amarillo, verde],
                    backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
                    borderWidth: 2, borderColor: '#fff'
                }]
            },
            options: opcionesDonut()
        }
    );

    // Gráfica 4 — Documentos por urgencia
    destruirGrafica('graficaDocsOp');
    graficasInstancias['graficaDocsOp'] = new Chart(
        document.getElementById('graficaDocsOp').getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Vencidos', 'Vencen <15d', 'Vencen <30d', 'Al día'],
                datasets: [{
                    data: [docsVencidos, docsMenos15, docsMenos30, docsBien],
                    backgroundColor: ['#ef4444', '#f59e0b', '#fcd34d', '#22c55e'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        }
    );
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
    document.querySelectorAll('.analisis-filtro-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderizarTabla();
}

function renderizarTabla() {
    const tbody   = document.getElementById('analisisTbody');
    const countEl = document.getElementById('tablaCount');

    let lista = polizasFiltradas;
    if (filtroNivelActivo !== 'todos') {
        lista = lista.filter(p => scoringCache[p.id]?.nivel === filtroNivelActivo);
    }

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
                    <div style="font-weight:600">${escapeHtml(nombre)}</div>
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