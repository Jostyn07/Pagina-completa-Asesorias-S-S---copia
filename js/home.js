// Inicio para la toma de información para el grafico

let chartActual = null;
let polizasGlobales = null;

async function cargarPolizasParaGrafico() {
    try {
        console.log("Cargando datos para grafico")
        /* {data, error }: Destructuración (Extraer valores de un objeto*/
        /* await: Espera a que termine una operación asicronica*/ 

        const { data, error } = await supabaseClient
            .from('polizas')
            .select(`
                *,
            cliente:clientes (*)
            `)
        // ***ILIKE*** ignora mayusculas y minusculas
        .ilike('agente35_estado', 'procesado') // La primera parte indica por cual columna se va a filtrar y la segunda indica cual sera el criterio
        .not('fecha_efectividad', 'is', null) // Inidica que de la columna "Fecha efectividad" no se va a tomar los valores que digan "null"
        // .not('tipo_registro', 'is', null)
        .gte('fecha_efectividad', '2026-01-01') // Inidica que de la columna "Fecha efectividad" se va a tomar a partir del 01/01/2026
        .lte('fecha_final_cobertura', '2026-12-31') // Inidica que de la columna "Fecha efectividad" se va a tomar hasta el 12/31/2026

        if (error) throw error;

        console.log('Pólizas cargadas:', data.length);
        console.log(data);

        return data
    } catch (error) {
        console.log('Error:', error);
        return[];
    }
}

// Aplicación del grafico
function procesarDatosGraficos(polizas, tiposSeleccionados, soloProximoMes) {
    // Preparando la estructura para el grafico de lineas
    const datosPorMes = {};
    const meses = ['Enero','Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

    // Preparando estructura para grafico de torta
    const datosPorOperador = {};

    let mesProximo = null;

    if (soloProximoMes) {
        const ahora = new Date ();
        mesProximo = (ahora.getMonth() + 1) % 12;
    }

    // Recorrer todas las polizas
    polizas.forEach(poliza => {
        const cliente = poliza.cliente

        // Saltar clientes que no tienen operador

        if (!tiposSeleccionados.includes(cliente?.tipo_registro)) {
            return;
        }

        const fecha = new Date(formatoUS(poliza.fecha_efectividad));
        const mes = meses[fecha.getMonth()];
        const operador = poliza.operador_nombre;

        // Filtar por proximo mes si esta activo
        if (soloProximoMes && fecha.getMonth() !== mesProximo) {
            return;
        }

        // Para grafico de lineas por mes

        // Si el operador no existe, se creara con todos los meses en 0
        if (!datosPorMes[operador]) {
            datosPorMes[operador] = {};
            meses.forEach(m => {
                datosPorMes[operador][m] = 0  ; //Inicializa cada mes en 0
            });
        }

        // Incrementar el contador del mes correspondiente
        datosPorMes[operador][mes]++;

        // Para el grafico de torta
        if (!datosPorOperador[operador]) {
            datosPorOperador[operador] = 0;
        }
        datosPorOperador[operador]++;
    });

    console.log("Datos por mes: ", datosPorMes)
    console.log("datos por operador:", datosPorOperador)

    return { datosPorMes, datosPorOperador }
}

function crearGraficoLineas(datosPorMes) {
if (chartActual) {
    chartActual.destroy();
}

    const meses = ['Enero','Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

    const series = [];

    // Obtener todos los nombres de operadores
    const operadores = Object.keys(datosPorMes)

    for (const operador of operadores) {

        // Extraer los valores de los 12 mesess en orden
        const valores = []

        for (const mes of meses) {
        valores.push(datosPorMes[operador][mes])
        }

        series.push({
            name: operador,
            data: valores
        });
    }
    console.log('Series para graficos: ', series)

    // Configuración de APEXCHARTS
    const options = {
        series: series,
        chart: {
            type: 'line', // Tipo de grafico de lineas
            height: 500,
            width: 1000,
            toolbar: {
                show: true // Botones para descargar, zoom, entre otros
            }
        },
        xaxis: {
                categories: meses // Los meses en el eje x
        },
        yaxis: {
            title: {
            text: 'Cantidad de polizas'
            }
        },
        title: {
            text: 'Polizas procesadas por mes (2026)',
            width: 10
        }
    };
    const chart = new ApexCharts(document.querySelector("#chartLineas"), options);
    chartActual = chart
    chartActual.render();
}

// Grafico de tortas
function crearGraficoTorta(datosPorOperador) {
    if (chartActual) {
        chartActual.destroy();
    }

    // Preparar datos para el grafico de torta
    const labels = [];
    const data = [];

    // Convertir el objeto en arrays separados
    for (const [operador, total] of Object.entries(datosPorOperador)) {
        labels.push(operador);
        data.push(total);
    } 
    
    console.log('labels: ', labels);
    console.log('Data: ', data);

    // Configuración de ApexCharts para torta
    const options = {
        series: data,
        chart: {
            type: 'pie',
            height: 500,
            width: 1000
        },
        labels: labels,
        title: {
            text:'Polizas realizadas por Operador (2026)',
            align: 'center'
        },
        legend: {
            position: 'bottom'
        }
    };

    const chart = new ApexCharts(document.querySelector("#chartLineas"), options);
    chartActual = chart
    chartActual.render();
}

function obtenerTiposSeleccionados() {
    const checkboxes = document.querySelectorAll('input[name="tipoRegistro"]:checked');
    const tipos = Array.from(checkboxes).map(cb => cb.value);
    console.log('Tipos seleccionados:', tipos);
    return tipos;
}

function actualizarGrafico() {
    const tiposSeleccionados = obtenerTiposSeleccionados();

    // Si no hay checkbox marcado, no hacer nada
    if (tiposSeleccionados.length === 0) {
        console.log("No hay tipos seleccionados");
        return;
    }

    const soloProximoMes = document.getElementById('soloProximoMes')?.checked || false;

    const { datosPorMes, datosPorOperador } = procesarDatosGraficos(polizasGlobales, tiposSeleccionados, soloProximoMes);

    // Verificar que tipo de grafico esta seleccionado
    const tipoGrafico = document.querySelector('input[name="tipoGrafico"]:checked')?.value || 'lineas';

    if (tipoGrafico === 'lineas') {
        crearGraficoLineas(datosPorMes);
    } else {
        crearGraficoTorta(datosPorOperador);
    }
}

function inicializarEventListeners() {
    // Event listener ara los checkboxes de tipo de registro
    const checkboxes = document.querySelectorAll('input[name="tipoRegistro"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', actualizarGrafico)
    });

    const radios = document.querySelectorAll('input[name="tipoGrafico"]');
    radios.forEach(radio => {
        radio.addEventListener('change', actualizarGrafico);
    })

    const checkboxProximoMes = document.getElementById('soloProximoMes');
    if (checkboxProximoMes) {
        checkboxProximoMes.addEventListener('change', actualizarGrafico)
    }
}

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
    console.log('total poizas:', totalPolizas)
    console.log('total aplicantes:', totalAplicantes)
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


// ====================================================================================
// Sumatoria de pólizas
// ====================================================================================



// Ejecutar al cargar la pagina
document.addEventListener('DOMContentLoaded', async function() {
    polizasGlobales = await cargarPolizasParaGrafico();
    
    // ✅ Calcular y actualizar estadísticas
    const { totalPolizas, totalAplicantes } = calcularTotales(polizasGlobales);
    actualizarEstadisticas(totalPolizas, totalAplicantes);
    
    inicializarEventListeners();
    actualizarGrafico();
});

