// ============================================
// VARIABLES GLOBALES
// ============================================
let chartActual = null;
let polizasGlobales = null;
let todasLasPolizas = []; // ✅ NUEVO: Todas las pólizas sin filtrar
let filtrosActivos = {    // ✅ NUEVO: Estado de los filtros
    estadoCompania: '',
    operador: '',
    documentos: '',
    fechaDesde: '2026-01-01',
    fechaHasta: '2026-12-31'
};

// ============================================
// CARGA DE DATOS
// ============================================

/**
 * Carga TODAS las pólizas de la base de datos (sin filtros hardcodeados)
 */
async function cargarPolizasParaGrafico() {
    try {
        ;
        
        // ✅ CARGAR TODAS las pólizas (sin filtros hardcodeados)
        const { data, error } = await supabaseClient
            .from('polizas')
            .select(`
                *,
                cliente:clientes (*)
            `)
            .not('fecha_efectividad', 'is', null);
        
        if (error) throw error;
        
        ;
        
        // Guardar TODAS las pólizas
        todasLasPolizas = data || [];
        
        // Aplicar filtros iniciales
        return aplicarFiltros();
        
    } catch (error) {
        console.error('❌ Error:', error);
        return [];
    }
}

/**
 * Aplica los filtros seleccionados a todas las pólizas
 */
function aplicarFiltros() {
    ;
    
    let polizasFiltradas = [...todasLasPolizas];
    
    // Filtro por estado de compañía
    if (filtrosActivos.estadoCompania) {
        polizasFiltradas = polizasFiltradas.filter(p => 
            p.estado_compania === filtrosActivos.estadoCompania
        );
    }
    
    // Filtro por operador
    if (filtrosActivos.operador) {
        polizasFiltradas = polizasFiltradas.filter(p => 
            p.operador_nombre === filtrosActivos.operador
        );
    }
    
    // Filtro por documentos
    if (filtrosActivos.documentos) {
        polizasFiltradas = polizasFiltradas.filter(p => 
            p.estado_documentos === filtrosActivos.documentos
        );
    }
    
    // Filtro por rango de fechas
    polizasFiltradas = polizasFiltradas.filter(p => {
        if (!p.fecha_efectividad) return false;
        
        const fechaEfectividad = p.fecha_efectividad.split('T')[0]; // yyyy-mm-dd
        return fechaEfectividad >= filtrosActivos.fechaDesde && 
               fechaEfectividad <= filtrosActivos.fechaHasta;
    });
    
    // Filtrar también por fecha_final_cobertura dentro del rango
    polizasFiltradas = polizasFiltradas.filter(p => {
        if (!p.fecha_final_cobertura) return false;
        
        const fechaFinal = p.fecha_final_cobertura.split('T')[0];
        return fechaFinal >= filtrosActivos.fechaDesde && 
               fechaFinal <= filtrosActivos.fechaHasta;
    });
    
    ;
    
    return polizasFiltradas;
}

/**
 * Función llamada por el botón "Filtros"
 * Captura los valores de los selectores y actualiza el gráfico
 */
function applyFilters() {
    ;
    
    // Capturar valores de los selectores
    filtrosActivos.estadoCompania = document.getElementById('filtroEstadoCompania')?.value || '';
    filtrosActivos.operador = document.getElementById('filterTypeOperador')?.value || '';
    filtrosActivos.documentos = document.getElementById('filtroDocumentos')?.value || '';
    
    // Aplicar filtros
    polizasGlobales = aplicarFiltros();
    
    // Actualizar estadísticas
    const { totalPolizas, totalAplicantes } = calcularTotales(polizasGlobales);
    actualizarEstadisticas(totalPolizas, totalAplicantes);
    
    // Actualizar gráfico
    actualizarGrafico();
    
    // Actualizar clasificación de agentes con los nuevos filtros
    renderizarClasificacion(tabClasificacionActual);

    // Mostrar notificación
    mostrarNotificacion(`Filtros aplicados: ${polizasGlobales.length} pólizas encontradas`);
}

// ============================================
// PROCESAMIENTO DE DATOS
// ============================================

function procesarDatosGraficos(polizas, tiposSeleccionados, soloProximoMes) {
    const datosPorMes = {};
    const meses = ['Enero','Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const datosPorOperador = {};
    let mesProximo = null;

    if (soloProximoMes) {
        const ahora = new Date();
        mesProximo = (ahora.getMonth() + 1) % 12;
    }

    polizas.forEach(poliza => {
        const cliente = poliza.cliente;

        if (!tiposSeleccionados.includes(cliente?.tipo_registro)) {
            return;
        }

        const fecha = new Date(formatoUS(poliza.fecha_efectividad));
        const mes = meses[fecha.getMonth()];
        const operador = poliza.operador_nombre;

        if (soloProximoMes && fecha.getMonth() !== mesProximo) {
            return;
        }

        if (!datosPorMes[operador]) {
            datosPorMes[operador] = {};
            meses.forEach(m => {
                datosPorMes[operador][m] = 0;
            });
        }

        datosPorMes[operador][mes]++;

        if (!datosPorOperador[operador]) {
            datosPorOperador[operador] = 0;
        }
        datosPorOperador[operador]++;
    });

    ;
    ;

    return { datosPorMes, datosPorOperador };
}

// ============================================
// GRÁFICOS
// ============================================

function crearGraficoLineas(datosPorMes) {
    if (chartActual) {
        chartActual.destroy();
    }

    const meses = ['Enero','Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const series = [];
    const operadores = Object.keys(datosPorMes);

    for (const operador of operadores) {
        const valores = [];
        for (const mes of meses) {
            valores.push(datosPorMes[operador][mes]);
        }
        series.push({
            name: operador,
            data: valores
        });
    }

    ;

    const options = {
        series: series,
        chart: {
            type: 'line',
            height: 500,
            width: 1000,
            toolbar: {
                show: true
            }
        },
        xaxis: {
            categories: meses
        },
        yaxis: {
            title: {
                text: 'Cantidad de pólizas'
            }
        },
        title: {
            text: 'Pólizas procesadas por mes (2026)',
            width: 10
        }
    };

    const chart = new ApexCharts(document.querySelector("#chartLineas"), options);
    chartActual = chart;
    chartActual.render();
}

function crearGraficoTorta(datosPorOperador) {
    if (chartActual) {
        chartActual.destroy();
    }

    const labels = [];
    const data = [];

    for (const [operador, total] of Object.entries(datosPorOperador)) {
        labels.push(operador);
        data.push(total);
    }

    ;
    ;

    const options = {
        series: data,
        chart: {
            type: 'pie',
            height: 500,
            width: 1000
        },
        labels: labels,
        title: {
            text: 'Pólizas realizadas por Operador (2026)',
            align: 'center'
        },
        legend: {
            position: 'bottom'
        }
    };

    const chart = new ApexCharts(document.querySelector("#chartLineas"), options);
    chartActual = chart;
    chartActual.render();
}

// ============================================
// ACTUALIZACIÓN DE GRÁFICOS
// ============================================

function obtenerTiposSeleccionados() {
    const checkboxes = document.querySelectorAll('input[name="tipoRegistro"]:checked');
    const tipos = Array.from(checkboxes).map(cb => cb.value);
    ;
    return tipos;
}

function actualizarGrafico() {
    const tiposSeleccionados = obtenerTiposSeleccionados();

    if (tiposSeleccionados.length === 0) {
        ;
        return;
    }

    const soloProximoMes = document.getElementById('soloProximoMes')?.checked || false;
    const { datosPorMes, datosPorOperador } = procesarDatosGraficos(polizasGlobales, tiposSeleccionados, soloProximoMes);
    const tipoGrafico = document.querySelector('input[name="tipoGrafico"]:checked')?.value || 'lineas';

    if (tipoGrafico === 'lineas') {
        crearGraficoLineas(datosPorMes);
    } else {
        crearGraficoTorta(datosPorOperador);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function inicializarEventListeners() {
    const checkboxes = document.querySelectorAll('input[name="tipoRegistro"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', actualizarGrafico);
    });

    const radios = document.querySelectorAll('input[name="tipoGrafico"]');
    radios.forEach(radio => {
        radio.addEventListener('change', actualizarGrafico);
    });

    const checkboxProximoMes = document.getElementById('soloProximoMes');
    if (checkboxProximoMes) {
        checkboxProximoMes.addEventListener('change', actualizarGrafico);
    }
}

// ============================================
// ESTADÍSTICAS
// ============================================

function calcularTotales(polizas) {
    const totalPolizas = polizas.length;
    const totalAplicantes = polizas.reduce((suma, poliza) => {
        const aplicantes = parseInt(poliza.aplicantes) || 0;
        return suma + aplicantes;
    }, 0);
    return { totalPolizas, totalAplicantes };
}

function actualizarEstadisticas(totalPolizas, totalAplicantes) {
    const elementoPolizas = document.getElementById('totalPolizas');
    if (elementoPolizas) {
        const textoPolizas = totalPolizas === 1 ? 'Póliza' : 'Pólizas';
        elementoPolizas.textContent = `${totalPolizas} ${textoPolizas}`;
    }

    const elementoAplicantes = document.getElementById('totalAplicantes');
    if (elementoAplicantes) {
        const textoAplicantes = totalAplicantes === 1 ? 'Aplicante' : 'Aplicantes';
        elementoAplicantes.textContent = `${totalAplicantes} ${textoAplicantes}`;
    }
    ;
    ;
}

// ============================================
// UTILIDADES
// ============================================

function formatoUS(fecha) {
    if (!fecha) return '';
    
    try {
        if (typeof fecha === 'string' && fecha.includes('-')) {
            const soloFecha = fecha.split('T')[0];
            const [anio, mes, dia] = soloFecha.split('-');
            return `${mes}/${dia}/${anio}`;
        }
        
        if (typeof fecha === 'string' && fecha.includes('/')) {
            return fecha;
        }
        
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

function formatoISO(fecha) {
    if (!fecha) return '';
    
    try {
        if (typeof fecha === 'string' && fecha.includes('-')) {
            return fecha.split('T')[0];
        }
        
        if (typeof fecha === 'string' && fecha.includes('/')) {
            const [mes, dia, anio] = fecha.split('/');
            return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        }
        
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

/**
 * Muestra una notificación temporal
 */
function mostrarNotificacion(mensaje) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #6366f1;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        z-index: 10000;
        font-size: 0.9rem;
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
// CLASIFICACIÓN DE AGENTES - TABS
// ============================================

let tabClasificacionActual = 'ventas';

function cambiarTabClasificacion(tab, btn) {
    // Actualizar botones
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    tabClasificacionActual = tab;
    renderizarClasificacion(tab);
}

function calcularClasificacionVentas() {
    const tiposVenta = ['Nuevo', 'Nueva con registro'];
    const conteo = {};

    // Usa todasLasPolizas y aplica solo filtro de fecha_efectividad
    (todasLasPolizas || []).forEach(poliza => {
        // Filtrar por rango de fechas usando solo fecha_efectividad
        if (poliza.fecha_efectividad) {
            const fecha = poliza.fecha_efectividad.split('T')[0];
            if (fecha < filtrosActivos.fechaDesde || fecha > filtrosActivos.fechaHasta) return;
        }

        const tipo = (poliza.tipo_venta || '').toLowerCase().trim();
        if (!tiposVenta.includes(tipo)) return;

        const operador = poliza.operador_nombre || 'Sin asignar';
        conteo[operador] = (conteo[operador] || 0) + 1;
    });

    return Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, total]) => ({ nombre, total }));
}

function calcularClasificacionRecuperadas() {
    const conteo = {};

    // Usa todasLasPolizas y aplica solo filtro de fecha_efectividad
    (todasLasPolizas || []).forEach(poliza => {
        // Filtrar por rango de fechas usando solo fecha_efectividad
        if (poliza.fecha_efectividad) {
            const fecha = poliza.fecha_efectividad.split('T')[0];
            if (fecha < filtrosActivos.fechaDesde || fecha > filtrosActivos.fechaHasta) return;
        }

        const tipo = (poliza.tipo_venta || '').toLowerCase().trim();
        if (tipo !== 'Recuperada') return;

        const operador = poliza.operador_nombre || 'Sin asignar';
        conteo[operador] = (conteo[operador] || 0) + 1;
    });

    return Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, total]) => ({ nombre, total }));
}

function calcularClasificacionCompania() {
    // Activos por operador según revisión en compañía
    // Sin restricción de fechas ni de rol — todos ven a todos
    const conteo = {};

    (todasLasPolizas || []).forEach(poliza => {
        const estadoCompania = (poliza.estado_compania || '').toLowerCase().trim();
        if (estadoCompania !== 'Activo') return;

        const operador = poliza.operador_nombre || 'Sin asignar';
        conteo[operador] = (conteo[operador] || 0) + 1;
    });

    return Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, total]) => ({ nombre, total }));
}

function renderizarClasificacion(tab) {
    const contenedor = document.getElementById('clasificacion-contenido');
    if (!contenedor) return;

    let filas = [];
    let columnaLabel = '';

    if (tab === 'ventas') {
        filas = calcularClasificacionVentas();
        columnaLabel = 'Operador';
    } else if (tab === 'recuperadas') {
        filas = calcularClasificacionRecuperadas();
        columnaLabel = 'Operador';
    } else if (tab === 'compania') {
        filas = calcularClasificacionCompania();
        columnaLabel = 'Operador';
    }

    if (filas.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #94a3b8;">
                <span class="material-symbols-rounded" style="font-size: 40px; opacity: 0.3;">search_off</span>
                <p style="margin-top: 10px;">Sin datos para este período</p>
            </div>
        `;
        return;
    }

    // Calcular total general para mostrar porcentaje
    const totalGeneral = filas.reduce((sum, f) => sum + f.total, 0);

    const rankClass = (i) => {
        if (i === 0) return 'rank-1';
        if (i === 1) return 'rank-2';
        if (i === 2) return 'rank-3';
        return 'rank-other';
    };

    const hilasHTML = filas.map((fila, i) => `
        <tr>
            <td>
                <span class="rank-badge ${rankClass(i)}">${i + 1}</span>
                <span class="agente-nombre">${fila.nombre}</span>
            </td>
            <td>
                <span class="total-badge">${fila.total}</span>
            </td>
            <td style="color: #94a3b8; font-size: 0.85rem;">
                ${Math.round((fila.total / totalGeneral) * 100)}%
            </td>
        </tr>
    `).join('');

    contenedor.innerHTML = `
        <table class="clasificacion-table">
            <thead>
                <tr>
                    <th>${columnaLabel}</th>
                    <th>Pólizas</th>
                    <th>% del total</th>
                </tr>
            </thead>
            <tbody>
                ${hilasHTML}
            </tbody>
        </table>
        <p style="text-align: right; font-size: 0.8rem; color: #94a3b8; margin-top: 10px; padding-right: 12px;">
            Total: <strong>${totalGeneral}</strong>
        </p>
    `;
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Cargar todas las pólizas
    polizasGlobales = await cargarPolizasParaGrafico();
    
    // Calcular y actualizar estadísticas
    const { totalPolizas, totalAplicantes } = calcularTotales(polizasGlobales);
    actualizarEstadisticas(totalPolizas, totalAplicantes);
    
    // Inicializar listeners
    inicializarEventListeners();
    actualizarGrafico();

    // Renderizar tab inicial de clasificación
    renderizarClasificacion(tabClasificacionActual);
    
    // Agregar listeners a los filtros (opcional: para debug)
    document.getElementById('filtroEstadoCompania')?.addEventListener('change', () => {
        ;
    });
    
    document.getElementById('filterTypeOperador')?.addEventListener('change', () => {
        ;
    });
    
    document.getElementById('filtroDocumentos')?.addEventListener('change', () => {
        ;
    });
});