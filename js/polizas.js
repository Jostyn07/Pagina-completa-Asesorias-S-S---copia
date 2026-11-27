// ============================================
// VARIABLES GLOBALES
// ============================================
let todasLasPolizas = [];
let modoFiltroEstado = 'mercado';
let polizasFiltradas = [];
let paginaActual = 1;
let polizasPorPagina = 10;
let ordenColumna = 'created_at';
let ordenDireccion = 'desc';
let polizaSeleccionada = null;
let filtrosActivos= null;
let hayFiltrosActivos = false;
let filtroAnioActivado = false;
let factoresPolizaCache = {}
// Carga/búsqueda (ver cargarPolizas y buscarPolizas)
let cargaPolizasEnCurso = false;      // hay una descarga de pólizas en marcha
let datosPolizasListos = false;       // ya hay una lista completa (caché o red) sobre la que filtrar
let terminoServidorActivo = false;    // se está mostrando/esperando una búsqueda dirigida al servidor
let busquedaPendiente = false;        // el usuario escribió/pulsó Enter antes de que hubiera datos
let filtrosRestaurados = false;       // restaurarFiltrosDesdeStorage ya se ejecutó en esta página
let idsCumpleanosActivos = null;      // filtro de cumpleaños llegado desde el inicio (se reaplica tras refrescar)
let aplicandoSoloBusqueda = false;    // aplicarFiltrosAvanzados invocado desde el buscador (no mostrar "Ver gráfica")
// Marca para polizas_carga_completa.js: esta página ya descarga por bloques (ver cargarPolizas)
window.__polizasCargaPropia = true;


// ============================================
// PERSISTENCIA DE FILTROS EN LOCALSTORAGE
// ============================================
const FILTROS_STORAGE_KEY = 'ss_polizas_filtros';

function guardarFiltrosEnStorage() {
    try {
        const datos = {
            // Flag: solo true si el usuario interactuó con los checkboxes de año
            filtroAnioActivado: filtroAnioActivado,

            // Buscador rápido
            busqueda: document.getElementById('searchInput')?.value || '',

            // Checkboxes de año
            anio2025: document.getElementById('2025')?.checked || false,
            anio2026: document.getElementById('2026')?.checked || false,
            anio2027: document.getElementById('2027')?.checked || false,

            // Pólizas por página
            porPagina: document.getElementById('polizasPorPagina')?.value || '10',

            // Campos del modal avanzado - Se obtienen los datos
            nombre: document.getElementById('filtroNombre')?.value || '',
            apellido: document.getElementById('filtroApellido')?.value || '',
            telefono: document.getElementById('filtroTelefono')?.value || '',
            estadoMigratorio: filtroEstadoMigratorio.getSeleccionados(),
            tieneSsn: document.getElementById('filtroTieneSsn')?.value || '',
            tieneMetodoPago: document.getElementById('filtroTieneMetodoPago')?.value || '',
            tienePagoAutomatico: document.getElementById('filtroTienePagoAutomatico')?.value || '',
            companias: Array.from(document.querySelectorAll('#panelCompanias input:checked'))?.map(cb => cb.value),
            prima: document.getElementById('filtroPrima')?.value || '',
            filtroTipoModificacion: filtroTipoModificacion.getSeleccionados(),
            tiposVenta: Array.from(document.querySelectorAll('#panelTipoVentas input:checked'))?.map(cb => cb.value),
            operadores: Array.from(document.querySelectorAll('#panelOperadores input:checked')).map(cb => cb.value),
            mesPagado: filtroMesPagado.getSeleccionados(),
            ventaRealizadaPor: Array.from(document.querySelectorAll('#panelVentaRealizadaPor input:checked')).map(cb => cb.value),
            documentos: filtroDocumentos.getSeleccionados(),
            modificadoPor: filtroModificadoPor.getSeleccionados(),
            portal: filtroPortalAvanzado.getSeleccionados(),
            nacionalidad: filtroNacionalidad.getSeleccionados(),
            filtroAgenteCliente: filtroAgenteCliente.getSeleccionados(),
            seguimientoEfectivo: document.getElementById('filtroSeguimientoEfectivo')?.value || '',
            estadoRenovacion: document.getElementById('filtroEstadoRenovacion')?.value || '',
            filtroAgenteMercado: filtroAgenteMercado.getSeleccionados(),
            estadoMercado:  Array.from(document.querySelectorAll('#panelEstadoMercado input:checked')).map(cb => cb.value),
            estadoCompania: Array.from(document.querySelectorAll('#panelEstadoCompania input:checked')).map(cb => cb.value),
            estadoAgente35: filtroEstadoAgente35.getSeleccionados(),
            nullPlazoDocumentos: document.getElementById('nullPlazoDocumentos')?.checked || '',
            nullFechaEfectividad: document.getElementById('nullFechaEfectividad')?.checked || '',
            nullInicioCobertura: document.getElementById('nullInicioCobertura')?.checked || '',
            nullRevisionMercado: document.getElementById('nullRevisionMercado')?.checked || '',
            nullFechRevCompania: document.getElementById('nullFechRevCompania')?.checked || '',
            nullFechaPago: document.getElementById('nullFechaPago')?.checked || '',
            nullFechaSeguimiento: document.getElementById('nullFechaSeguimiento')?.checked || false,
            estado: filtroEstado.getSeleccionados(),

            // Fechas
            fechaEfectividadDesde: document.getElementById('filtroFechaEfectividadDesde')?.value || '',
            fechaEfectividadHasta: document.getElementById('filtroFechaEfectividadHasta')?.value || '',
            fechaCoberturaInicialDesde: document.getElementById('filtroFechaCoberturaInicialDesde')?.value || '',
            fechaCoberturaInicialHasta: document.getElementById('filtroFechaCoberturaInicialHasta')?.value || '',
            fechaRevisionMercadoDesde: document.getElementById('filtroFechaRevisionMercadoDesde')?.value || '',
            fechaRevisionMercadoHasta: document.getElementById('filtroFechaRevisionMercadoHasta')?.value || '',
            fechaRevisionCompaniaDesde: document.getElementById('filtroFechaRevisionCompaniaDesde')?.value || '',
            fechaRevisionCompaniaHasta: document.getElementById('filtroFechaRevisionCompaniaHasta')?.value || '',
            fechaSeguimientoDesde: document.getElementById('filtroSeguimientoDesde')?.value || '',
            fechaSeguimientoHasta: document.getElementById('filtroSeguimientoHasta')?.value || '',
            fechaUltimoPagoDesde: document.getElementById('filtroFechaUltimoPagoDesde')?.value || '',
            fechaUltimoPagoHasta: document.getElementById('filtroFechaUltimoPagoHasta')?.value || '',
            plazoDocumentosDesde: document.getElementById('filtroFechaPlazoDocumentosDesde')?.value || '',
            PlazoDocumentosHasta: document.getElementById('filtroFechaPlazoDocumentosHasta')?.value || '',
            fechaModificacionDesde: document.getElementById('filtroModificacionDesde')?.value || '',
            fechaModificacionHasta: document.getElementById('filtroModificacionHasta')?.value || '',
            fechaCreacionDesde: document.getElementById('filtroCreacionDesde')?.value || '',
            fechaCreacionHasta: document.getElementById('filtroCreacionHasta')?.value || '',
        };

        localStorage.setItem(FILTROS_STORAGE_KEY, JSON.stringify(datos));
    } catch (error) {
        dbg.warn('⚠️ No se pudieron guardar los filtros en localStorage:', error);
    }
}

function eliminarFiltrosDeStorage() {
    try {
        localStorage.removeItem(FILTROS_STORAGE_KEY);
    } catch (error) {
        dbg.warn('⚠️ No se pudo limpiar filtros de localStorage:', error);
    }
}

function restaurarFiltrosDesdeStorage() {
    let datos;

    // 1. Leer y parsear de forma segura
    try {
        const raw = localStorage.getItem(FILTROS_STORAGE_KEY);
        if (!raw) return; // No hay filtros guardados, nada que hacer
        datos = JSON.parse(raw);
    } catch (error) {
        // JSON corrupto: borrarlo y salir sin romper nada
        dbg.warn('⚠️ Filtros en localStorage corruptos, se borrarán:', error);
        eliminarFiltrosDeStorage();
        return;
    }

    // 2. Rellenar el DOM con los valores guardados
    const set = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.value = valor || '';
    };
    const setChecked = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!valor;
    };

    // Buscador y paginación
    // Si el usuario ya escribió en el buscador mientras cargaban las pólizas, se respeta lo escrito
    if (!busquedaPendiente) set('searchInput', datos.busqueda);
    set('polizasPorPagina', datos.porPagina);
    if (datos.porPagina) polizasPorPagina = parseInt(datos.porPagina, 10);

    // Checkboxes de año
    setChecked('2025', datos.anio2025);
    setChecked('2026', datos.anio2026);
    setChecked('2027', datos.anio2027);

    // Modal avanzado
    set('filtroNombre', datos.nombre);
    set('filtroApellido', datos.apellido);
    set('filtroTelefono', datos.telefono);
    filtroEstadoMigratorio.setSeleccionados(Array.isArray(datos.estadoMigratorio) ? datos.estadoMigratorio : []);
    set('filtroTieneSsn', datos.tieneSsn);
    if (datos.companias && Array.isArray(datos.companias)) {
        document.querySelectorAll('#panelCompanias input[type="checkbox"]').forEach(cb => {
            cb.checked = datos.companias.includes(cb.value)
        });
        actualizarTextoCompanias();
    }
    set('filtroPrima', datos.prima);
    if (datos.tiposVenta && Array.isArray(datos.tiposVenta)) {
        document.querySelectorAll('#panelTipoVentas input[type="checkbox"]').forEach(cb => {
            cb.checked = datos.tiposVenta.includes(cb.value);
        });
        actualizarTextoTipoVentas
    }
    filtroTipoModificacion.setSeleccionados(Array.isArray(datos.filtroTipoModificacion) ? datos.filtroTipoModificacion : []);
    if (datos.operadores && Array.isArray(datos.operadores) && datos.operadores.length > 0) {
        document.querySelectorAll('#panelOperadores input[type="checkbox"]').forEach(cb => {
            cb.checked = datos.operadores.includes(cb.value);
        });
        actualizarTextoOperadores();
    }

    if (datos.ventaRealizadaPor && Array.isArray(datos.ventaRealizadaPor) && datos.ventaRealizadaPor.length > 0) {
    document.querySelectorAll('#panelVentaRealizadaPor input[type="checkbox"]').forEach(cb => {
        cb.checked = datos.ventaRealizadaPor.includes(cb.value);
    });
    actualizarTextoVentaRealizadaPor();
}
    filtroDocumentos.setSeleccionados(Array.isArray(datos.documentos) ? datos.documentos : []);
    filtroMesPagado.setSeleccionados(Array.isArray(datos.mesPagado) ? datos.mesPagado : []);
    filtroModificadoPor.setSeleccionados(Array.isArray(datos.modificadoPor) ? datos.modificadoPor : []);
    filtroPortalAvanzado.setSeleccionados(Array.isArray(datos.portal) ? datos.portal : []);
    filtroNacionalidad.setSeleccionados(Array.isArray(datos.nacionalidad) ? datos.nacionalidad : []);
    filtroAgenteCliente.setSeleccionados(Array.isArray(datos.filtroAgenteCliente) ? datos.filtroAgenteCliente : []);
    set('filtroSeguimientoEfectivo', datos.seguimientoEfectivo);
    set('filtroEstadoRenovacion', datos.estadoRenovacion);
    filtroAgenteMercado.setSeleccionados(Array.isArray(datos.filtroAgenteMercado) ? datos.filtroAgenteMercado : []);
    if (datos.estadoMercado && Array.isArray(datos.estadoMercado)) {
        document.querySelectorAll('#panelEstadoMercado input[type="checkbox"]').forEach(cb => {
            cb.checked = datos.estadoMercado.includes(cb.value);
        });
        actualizarTextoEstadoMercado();
    }
    if (datos.estadoCompania && Array.isArray(datos.estadoCompania)) {
        document.querySelectorAll('#panelEstadoCompania input[type="checkbox"]').forEach(cb => {
            cb.checked = datos.estadoCompania.includes(cb.value);
        });
        actualizarTextoEstadoCompania();
    }
    filtroEstado.setSeleccionados(Array.isArray(datos.estado) ? datos.estado : []);
    filtroEstadoAgente35.setSeleccionados(Array.isArray(datos.estadoAgente35) ? datos.estadoAgente35 : []);
    setChecked('nullFechaEfectividad', datos.nullFechaEfectividad);
    setChecked('nullInicioCobertura', datos.nullInicioCobertura);
    setChecked('nullRevisionMercado', datos.nullRevisionMercado);
    setChecked('nullFechRevCompania', datos.nullFechRevCompania);
    setChecked('nullFechaPago', datos.nullFechaPago);
    setChecked('nullFechaSeguimiento', datos.nullFechaSeguimiento);
    setChecked('nullPlazoDocumentos', datos.nullPlazoDocumentos);
    set('filtroTieneMetodoPago', datos?.tieneMetodoPago)
    set('filtroTienePagoAutomatico', datos?.tienePagoAutomatico)

    // Fechas
    set('filtroFechaEfectividadDesde', datos.fechaEfectividadDesde);
    set('filtroFechaEfectividadHasta', datos.fechaEfectividadHasta);
    set('filtroFechaCoberturaInicialDesde', datos.fechaCoberturaInicialDesde);
    set('filtroFechaCoberturaInicialHasta', datos.fechaCoberturaInicialHasta);
    set('filtroFechaRevisionMercadoDesde', datos.fechaRevisionMercadoDesde);
    set('filtroFechaRevisionMercadoHasta', datos.fechaRevisionMercadoHasta);
    set('filtroFechaRevisionCompaniaDesde', datos.fechaRevisionCompaniaDesde);
    set('filtroFechaRevisionCompaniaHasta', datos.fechaRevisionCompaniaHasta);
    set('filtroFechaUltimoPagoDesde', datos.fechaUltimoPagoDesde)
    set('filtroFechaUltimoPagoHasta', datos.fechaUltimoPagoHasta)
    set('filtroSeguimientoDesde', datos.fechaSeguimientoDesde);
    set('filtroSeguimientoHasta', datos.fechaSeguimientoHasta);
    set('filtroFechaPlazoDocumentosDesde', datos.plazoDocumentosDesde);
    set('filtroFechaPlazoDocumentosHasta', datos.plazoDocumentosHasta);
    set('filtroModificacionDesde', datos.filtroModificacionDesde);
    set('filtroModificacionhasta', datos.filtroModificacionHasta);
    set('filtroCreacionDesde', datos.filtroCreacionDesde);
    set('filtroCreacionHasta', datos.filtroCreacionHasta);

    // 3. Reconstruir filtrosActivos para que el sistema sepa que hay filtros vivos
    filtrosActivos = {
        nombre: datos.nombre?.toLowerCase() || '',
        apellido: datos.apellido?.toLowerCase() || '',
        telefono: datos.telefono?.toLowerCase() || '',
        estadoMigratorio: Array.isArray(datos.estadoMigratorio) ? datos.estadoMigratorio : [],
        tieneSsn: datos.tieneSsn || '',
        tieneMetodoPago: datos?.tieneMetodoPago || '',
        tienePagoAutomatico: datos?.tienePagoAutomatico || '',
        companias: datos.companias || [],
        prima: datos.prima || '',
        filtroTipoModificacion: Array.isArray(datos.filtroTipoModificacion) ? datos.filtroTipoModificacion : [],
        tiposVenta: datos.tiposVenta || [],
        operadores: datos.operadores || [],
        ventaRealizadaPor: datos.ventaRealizadaPor || [],
        mesPagado: Array.isArray(datos.mesPagado) ? datos.mesPagado : [],
        documentos: Array.isArray(datos.documentos) ? datos.documentos : [],
        modificadoPor: Array.isArray(datos.modificadoPor) ? datos.modificadoPor : [],
        portal: Array.isArray(datos.portal) ? datos.portal : [],
        nacionalidad: Array.isArray(datos.nacionalidad) ? datos.nacionalidad : [],
        filtroAgenteCliente: Array.isArray(datos.filtroAgenteCliente) ? datos.filtroAgenteCliente : [],
        seguimientoEfectivo: datos.seguimientoEfectivo || '',
        estadoRenovacion: datos.estadoRenovacion || '',
        filtroAgenteMercado: Array.isArray(datos.filtroAgenteMercado) ? datos.filtroAgenteMercado : [],
        estadoMercado:  Array.isArray(datos.estadoMercado)  ? datos.estadoMercado  : [],
        estadoCompania: Array.isArray(datos.estadoCompania) ? datos.estadoCompania : [],
        estado: Array.isArray(datos.estado) ? datos.estado : [],
        estadoAgente35: Array.isArray(datos.estadoAgente35) ? datos.estadoAgente35 : [],
        nullPlazoDocumentos: datos.nullPlazoDocumentos || '',
        nullFechaEfectividad: datos.nullFechaEfectividad || '',
        nullInicioCobertura: datos.nullInicioCobertura || '',
        nullRevisionMercado: datos.nullRevisionMercado || '',
        nullFechRevCompania: datos.nullFechRevCompania || '',
        nullFechaPago: datos.nullFechaPago || '',
        nullFechaSeguimiento: datos.nullFechaSeguimiento || false,
        fechaRegistroDesde: datos.fechaRegistroDesde || '',
        fechaRegistroHasta: datos.fechaRegistroHasta || '',
        fechaEfectividadDesde: datos.fechaEfectividadDesde || '',
        fechaEfectividadHasta: datos.fechaEfectividadHasta || '',
        fechaCoberturaInicialDesde: datos.fechaCoberturaInicialDesde || '',
        fechaCoberturaInicialHasta: datos.fechaCoberturaInicialHasta || '',
        fechaRevisionMercadoDesde: datos.fechaRevisionMercadoDesde || '',
        fechaRevisionMercadoHasta: datos.fechaRevisionMercadoHasta || '',
        fechaRevisionCompaniaDesde: datos.fechaRevisionCompaniaDesde || '',
        fechaRevisionCompaniaHasta: datos.fechaRevisionCompaniaHasta || '',
        fechaUltimoPagoDesde: datos.fechaUltimoPagoDesde || '',
        fechaUltimoPagoHasta: datos.fechaUltimoPagoHasta || '',
        fechaSeguimientoDesde: datos.fechaSeguimientoDesde  || '',
        fechaSeguimientoHasta: datos.fechaSeguimientoHasta  || '',
    };

    // 4. Determinar si hay filtros activos realmente (para el indicador visual)
    const hayAvanzados = Object.values(filtrosActivos).some(v => v !== '');
    const hayAnios = datos.anio2025 || datos.anio2026 || datos.anio2027;
    const textoBusqueda = document.getElementById('searchInput')?.value || '';
    const hayBusqueda = !!textoBusqueda.trim();
    hayFiltrosActivos = hayAvanzados || hayBusqueda;

    let resultado = [...todasLasPolizas];

    // Filtro de buscador rápido (misma lógica que el buscador: sin acentos, teléfonos solo dígitos)
    const tokensBusqueda = prepararBusqueda(textoBusqueda);
    if (tokensBusqueda) {
        resultado = resultado.filter(poliza => {
            if (poliza.cliente?.archivado === true) return false;
            return coincideBusqueda(poliza, tokensBusqueda);
        });
    }

    // Filtro de checkboxes de año
    // Solo se aplica si el usuario interactuó explícitamente con los checkboxes
    if (datos.filtroAnioActivado && hayAnios) {
        const anios = [];
        if (datos.anio2025) anios.push('2025');
        if (datos.anio2026) anios.push('2026');
        if (datos.anio2027) anios.push('2027');
        resultado = resultado.filter(poliza => {
            if (poliza.cliente?.archivado === true) return false;
            if (!poliza.fecha_efectividad) return false;
            const anio = String(poliza.fecha_efectividad).slice(0, 4);
            return anios.includes(anio);
        });
    }

    // Filtros avanzados (si hay alguno activo)
    if (hayAvanzados) {
        resultado = resultado.filter(poliza => {
            const cliente = poliza.cliente || {};
            if (poliza.cliente?.archivado === true) return false;
            if (filtrosActivos.nombre && !cliente.nombres?.toLowerCase().includes(filtrosActivos.nombre)) return false;
            if (filtrosActivos.apellido && !cliente.apellidos?.toLowerCase().includes(filtrosActivos.apellido)) return false;
            if (filtrosActivos.telefono && !cliente.telefono1?.toLowerCase().includes(filtrosActivos.telefono)) return false;
            if (filtrosActivos.estadoMigratorio?.length > 0 && !filtrosActivos.estadoMigratorio.includes(cliente.estado_migratorio)) return false;
            if (filtrosActivos.tieneSsn && cliente.tiene_social !== filtrosActivos.tieneSsn) return false;
            if (filtrosActivos.tieneMetodoPago && cliente.tiene_metodo_pago !== filtrosActivos.tieneMetodoPago) return false;
            if (filtrosActivos.tienePagoAutomatico && obtenerMetodoPrincipal(cliente)?.tiene_pago_automatico !== filtrosActivos.tienePagoAutomatico) return false;
            if (filtrosActivos.filtroAgenteMercado?.length > 0) {
                const esNull = filtrosActivos.filtroAgenteMercado.includes('__null__');
                const estaVacio = !poliza.nombre_agente_mercado || poliza.nombre_agente_mercado === '';
                const coincide = filtrosActivos.filtroAgenteMercado.includes(poliza.nombre_agente_mercado);
                if (!(coincide || (esNull && estaVacio))) return false;
            }
            if (filtrosActivos.companias && filtrosActivos.companias.length > 0) {
                if (!filtrosActivos.companias.includes(poliza.compania)) {
                    return false
                }
            }

            if (filtrosActivos.tiposVenta && filtrosActivos.tiposVenta.length > 0) {
                if (!filtrosActivos.tiposVenta.includes(cliente.tipo_registro)) return false;
            }
            if (filtrosActivos.filtroTipoModificacion?.length > 0 && !filtrosActivos.filtroTipoModificacion.includes(cliente.tipo_modificacion)) return false;
            if (filtrosActivos.operadores?.length > 0 && !filtrosActivos.operadores.includes(poliza.operador_nombre)) return false;
            if (filtrosActivos.ventaRealizadaPor?.length > 0 && !filtrosActivos.ventaRealizadaPor.includes(poliza.cliente?.venta_realizada_por)) return false;
            if (filtrosActivos.estadoMercado?.length > 0) {
                const esNull = filtrosActivos.estadoMercado.includes('__null__');
                const estaVacio = !poliza.estado_mercado || poliza.estado_mercado === '';
                const coincide  = filtrosActivos.estadoMercado.includes(poliza.estado_mercado);
                if (!(coincide || (esNull && estaVacio))) return false;
            }
            if (filtrosActivos.estadoCompania?.length > 0) {
                const esNull = filtrosActivos.estadoCompania.includes('__null__');
                const estaVacio = !poliza.estado_compania || poliza.estado_compania === '';
                const coincide  = filtrosActivos.estadoCompania.includes(poliza.estado_compania);
                if (!(coincide || (esNull && estaVacio))) return false;
            }
            if (filtrosActivos.estado?.length > 0 && !filtrosActivos.estado.includes(cliente.estado)) return false;
            if (filtrosActivos.estadoAgente35?.length > 0 && !filtrosActivos.estadoAgente35.includes(poliza.agente35_estado)) return false;

            // Null

            if(filtrosActivos.nullPlazoDocumentos && poliza.fecha_plazo_documentos !== null) return false;
            if(filtrosActivos.nullFechaEfectividad && poliza.fecha_efectividad !== null) return false;
            if(filtrosActivos.nullInicioCobertura && poliza.fecha_inicial_cobertura !== null) return false;
            if(filtrosActivos.nullRevisionMercado && poliza.fecha_revision_mercado !== null) return false;
            if(filtrosActivos.nullFechRevCompania && poliza.fecha_revision_compania !== null) return false;
            if(filtrosActivos.nullFechaPago && poliza.pagado_hasta !== null) return false;
            if (filtrosActivos.nullFechaSeguimiento) {
                const tieneSeguimientos = poliza.seguimientos && poliza.seguimientos.length > 0
                if (tieneSeguimientos) {
                    return false
                }
            }

            if (filtrosActivos.documentos?.length > 0) {
                const estadoDoc = (poliza.estado_documentos || '');
                if (!filtrosActivos.documentos.includes(estadoDoc)) return false;
            }

            if (filtrosActivos.mesPagado?.length > 0) {
                const mesesPagados = obtenerMesesPagadosAnioActual(poliza.cliente);
                if (!mesesPagados) return false;
                const cumple = filtrosActivos.mesPagado.some(mes => mesesPagados[mes] === 'Si');
                if (!cumple) return false;
            }

            if (filtrosActivos.modificadoPor?.length > 0 && !filtrosActivos.modificadoPor.includes(poliza.modificado_por_nombre)) return false;

            if (filtrosActivos.portal?.length > 0 && !filtrosActivos.portal.includes(cliente.portal)) return false;

            if (filtrosActivos.nacionalidad?.length > 0 && !filtrosActivos.nacionalidad.includes(normalizarNacionalidad(cliente.nacionalidad))) return false;

            if (filtrosActivos.filtroAgenteCliente?.length > 0) {
                const esNull = filtrosActivos.filtroAgenteCliente.includes('__null__');
                const estaVacio = !cliente.agente_nombre || cliente.agente_nombre === '';
                const coincide = filtrosActivos.filtroAgenteCliente.includes(cliente.agente_nombre);
                if (!(coincide || (esNull && estaVacio))) return false;
            }

            if (filtrosActivos.prima) {
                const prima = parseFloat(poliza.prima) || 0;
                if (filtrosActivos.prima === 'cero' && prima !== 0) return false;
                if (filtrosActivos.prima === 'conPrima' && prima <= 0) return false;
                if (filtrosActivos.prima === 'alta' && prima <= 1500) return false;
                if (filtrosActivos.prima === 'sinAsignar' && poliza.prima !== null && poliza.prima !== '' && poliza.prima !== undefined) return false;
            }

            if (!cumpleFiltroRenovacion(poliza, filtrosActivos.estadoRenovacion)) return false;

            if (filtrosActivos.seguimientoEfectivo) {
                if (!poliza.seguimientos || poliza.seguimientos.length === 0) return false;
                if (seguimientoEfectivo120(poliza) !== filtrosActivos.seguimientoEfectivo) return false;
            }

            if (!filtrarPorRangoFecha(poliza.created_at, filtrosActivos.fechaRegistroDesde, filtrosActivos.fechaRegistroHasta)) return false;
            if (!filtrarPorRangoFecha(poliza.fecha_efectividad, filtrosActivos.fechaEfectividadDesde, filtrosActivos.fechaEfectividadHasta)) return false;
            if (!filtrarPorRangoFecha(poliza.fecha_inicial_cobertura, filtrosActivos.fechaCoberturaInicialDesde, filtrosActivos.fechaCoberturaInicialHasta)) return false;
            if (!filtrarPorRangoFecha(poliza.fecha_revision_mercado, filtrosActivos.fechaRevisionMercadoDesde, filtrosActivos.fechaRevisionMercadoHasta)) return false;
            if (!filtrarPorRangoFecha(poliza.fecha_revision_compania, filtrosActivos.fechaRevisionCompaniaDesde, filtrosActivos.fechaRevisionCompaniaHasta)) return false;
            if (!filtrarPorRangoFecha(poliza.pagado_hasta, filtrosActivos.fechaUltimoPagoDesde, filtrosActivos.fechaUltimoPagoHasta)) return false;
            if (!filtrarPorRangoFecha(poliza.fecha_plazo_documentos, filtrosActivos.plazoDocumentosDesde, filtrosActivos.plazoDocumentosHasta)) return false;
            if (!filtrarPorRangoFecha(poliza.updated_at, filtrosActivos.filtroModificacionDesde, filtrosActivos.filtroModificacionHasta)) return false;
            if (!filtrarPorRangoFecha(poliza.created_at, filtrosActivos.filtroCreacionDesde, filtrosActivos.filtroCreacionHasta)) return false;

            if (filtrosActivos.fechaSeguimientoDesde || filtrosActivos.fechaSeguimientoHasta) {
                if (!poliza.seguimientos || poliza.seguimientos.length === 0) return false;
                const fechas = poliza.seguimientos.map(s => new Date(s.fecha_seguimiento));
                const fechaMasReciente = new Date(Math.max(...fechas));
                if (!filtrarPorRangoFecha(fechaMasReciente, filtrosActivos.fechaSeguimientoDesde, filtrosActivos.fechaSeguimientoHasta)) return false;
            }

            // Filtro por método de pago
        if (filtrosActivos.metodoPago) {
            const cliente = poliza.cliente || {};
            const metodosPago = cliente.metodos_pago;
            
            const metodoPrincipal = obtenerMetodoPrincipal(cliente);

            if (filtrosActivos.metodoPago === 'con_metodo') {
                if (!metodoPrincipal || metodoPrincipal.tiene_metodo_pago !== 'Si') {
                    return false;
                }
            }
            if (filtrosActivos.metodoPago === 'sin_metodo') {
                if (metodosPago && metodosPago.length > 0) {
                    return false;
                }
            }
            if (filtrosActivos.metodoPago === 'no_confirmado') {
                if (!metodoPrincipal || metodoPrincipal.tiene_metodo_pago !== 'No') {
                    return false;
                }
            }
        }
            return true;
        });
    }

    polizasFiltradas = resultado;
    actualizarIndicadorFiltros();

    ;
}

// ============================================
// CARGA DE PÓLIZAS
// ============================================
const POLIZAS_BLOQUE = 1000;                         // filas por petición (.range)
const POLIZAS_PARALELO = 4;                          // peticiones simultáneas
const POLIZAS_CACHE_DB = 'ss_polizas_cache';         // borrada al cerrar sesión (supabase_config.js)
const POLIZAS_CACHE_STORE = 'listas';
const POLIZAS_CACHE_VERSION = 1;                     // subir si cambia la forma de los datos guardados
const POLIZAS_CACHE_MAX_EDAD_MS = 24 * 60 * 60 * 1000;   // más vieja que esto: se ignora
const POLIZAS_DELTA_MAX_EDAD_MS = 12 * 60 * 60 * 1000;   // más vieja que esto: recarga completa, no delta
const POLIZAS_DELTA_MARGEN_MS = 2 * 60 * 1000;           // margen restado a la última marca para no perder cambios

// Select mínimo de la LISTA: solo lo que usan la tabla, los filtros, la búsqueda, la ordenación,
// los factores de riesgo y la exportación a Excel. Lo que solo muestra el modal de detalle
// (dirección, ciudad, código postal, medio de comunicación y observaciones de seguimientos)
// se pide al abrir el detalle (cargarDetallePoliza).
const POLIZAS_SELECT_LISTA = `
    id, numero_poliza, operador_nombre, estado_mercado, fecha_revision_mercado, documentos_pendientes,
    agente35_estado, compania, fecha_revision_compania, plan, estado_renovacion, poliza_origen_id, prima,
    agente_nombre, fecha_efectividad, fecha_inicial_cobertura, fecha_final_cobertura, created_at, updated_at,
    estado_documentos, estado_compania, pagado_hasta, fecha_plazo_documentos, nombre_agente_mercado,
    modificado_por_nombre, clave_seguridad, member_id, aplicantes,
    cliente:clientes (
        id, nombres, apellidos, fecha_nacimiento, telefono1, telefono2, email, estado, estado_migratorio, ssn,
        tipo_registro, tipo_modificacion, operador_nombre, tiene_social, archivado, venta_realizada_por,
        portal, nacionalidad, agente_nombre,
        metodos_pago ( tiene_metodo_pago, tiene_pago_automatico, activo ),
        pagos_mensuales_cliente ( anio, enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre )
    ),
    seguimientos ( fecha_seguimiento, seguimiento_efectivo )
`;

const _pausa = (ms) => new Promise(r => setTimeout(r, ms));
const _ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const _enReposo = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 200));

let _primeraCargaPolizas = true;
let _msFactoresRender = 0;           // tiempo acumulado calculando factores en el último render
let polizasBusquedaServidor = new Map();   // resultados de la búsqueda dirigida al servidor (para abrir su detalle)
let busquedaServidorId = 0;          // identifica la búsqueda vigente; las respuestas de otras se ignoran

// ---------- Caché local (IndexedDB) ----------
function claveCachePolizas() {
    const id = (typeof datosUsuario !== 'undefined' && datosUsuario) ? datosUsuario.id : null;
    return id ? `u:${id}` : null;
}

function abrirCachePolizas() {
    return new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') return resolve(null);
            const req = indexedDB.open(POLIZAS_CACHE_DB, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(POLIZAS_CACHE_STORE, { keyPath: 'clave' });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        } catch (e) { resolve(null); }
    });
}

async function leerCachePolizas(clave) {
    const db = await abrirCachePolizas();
    if (!db) return null;
    try {
        const registro = await new Promise((resolve) => {
            const r = db.transaction(POLIZAS_CACHE_STORE, 'readonly').objectStore(POLIZAS_CACHE_STORE).get(clave);
            r.onsuccess = () => resolve(r.result || null);
            r.onerror = () => resolve(null);
        });
        if (!registro || registro.version !== POLIZAS_CACHE_VERSION || !Array.isArray(registro.filas)) return null;
        if (Date.now() - registro.guardadoEn > POLIZAS_CACHE_MAX_EDAD_MS) return null;
        return registro;
    } catch (e) { return null; }
    finally { db.close(); }
}

async function guardarCachePolizas(registro) {
    const db = await abrirCachePolizas();
    if (!db) return;
    try {
        await new Promise((resolve) => {
            const tx = db.transaction(POLIZAS_CACHE_STORE, 'readwrite');
            const st = tx.objectStore(POLIZAS_CACHE_STORE);
            st.put(registro);
            // La caché de otro usuario del mismo navegador no se conserva
            const ks = st.getAllKeys();
            ks.onsuccess = () => (ks.result || []).filter(k => k !== registro.clave).forEach(k => st.delete(k));
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();
        });
    } catch (e) { /* sin caché: todo sigue funcionando */ }
    finally { db.close(); }
}

function borrarCachePolizas() {
    try { indexedDB.deleteDatabase(POLIZAS_CACHE_DB); } catch (e) { /* nada */ }
}

// ---------- Descarga por bloques en paralelo ----------
async function pedirBloquePolizas(desde, gteUpdatedAt) {
    for (let intento = 0; ; intento++) {
        let q = supabaseClient.from('polizas').select(POLIZAS_SELECT_LISTA)
            .order('updated_at', { ascending: false })
            .order('id', { ascending: true });     // desempate estable entre bloques
        if (gteUpdatedAt) q = q.gte('updated_at', gteUpdatedAt);
        const { data, error } = await q.range(desde, desde + POLIZAS_BLOQUE - 1);
        if (!error) return data || [];
        if (intento >= 1) throw error;
        await _pausa(1500);                         // un reintento, como antes
    }
}

async function contarPolizas(gteUpdatedAt) {
    let q = supabaseClient.from('polizas').select('id', { count: 'exact', head: true });
    if (gteUpdatedAt) q = q.gte('updated_at', gteUpdatedAt);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
}

// ---------- Descarga con una sola consulta (RPC polizas_lista, sql/rendimiento/01_polizas_lista.sql) ----------
let _rpcPolizasListaNoExiste = false;    // si la función no existe en la BD, no se reintenta en esta página

function _esErrorRpcInexistente(error) {
    if (!error) return false;
    const msg = String(error.message || '');
    return error.code === 'PGRST202' || error.code === '42883' || error.status === 404 || error.statusCode === 404 ||
        /could not find the function|function .* does not exist/i.test(msg);
}

// Devuelve el array de filas, o null si la RPC no existe (usar el respaldo por bloques)
async function descargarPolizasRpc(gteUpdatedAt) {
    if (_rpcPolizasListaNoExiste) return null;
    const { data, error } = await supabaseClient.rpc('polizas_lista', { p_desde: gteUpdatedAt || null });
    if (error) {
        if (_esErrorRpcInexistente(error)) {
            _rpcPolizasListaNoExiste = true;
            dbg.info('[pólizas] RPC polizas_lista no existe; se usa la carga por bloques');
            return null;
        }
        const msg = String(error.message || '');
        const esAuth = error.status === 401 || error.status === 403 || error.code === 'PGRST301' ||
            error.code === '42501' || /jwt/i.test(msg);
        if (esAuth) throw error;
        // Timeout (57014), 5xx o red: respaldo por bloques en esta carga, sin marcar la RPC como inexistente
        dbg.warn('[pólizas] RPC polizas_lista falló (' + (error.code || error.status || 'sin código') + '); se usa la carga por bloques:', msg);
        return null;
    }
    return Array.isArray(data) ? data : [];
}

// Devuelve { filas, total, metodo }. Primero intenta la RPC; si no existe, carga por bloques.
// onBloque(filasContiguas, total) se llama cada vez que crece el tramo contiguo desde el primer
// bloque (solo en el método por bloques; con la RPC llega todo de una vez y se pinta al final).
async function descargarPolizas({ gteUpdatedAt = null, onBloque = null } = {}) {
    const filasRpc = await descargarPolizasRpc(gteUpdatedAt);
    if (filasRpc) return { filas: filasRpc, total: filasRpc.length, metodo: 'rpc' };
    const r = await descargarPolizasPorBloques({ gteUpdatedAt, onBloque });
    r.metodo = 'bloques';
    return r;
}

// Respaldo: count (head) + .range() por bloques en paralelo
async function descargarPolizasPorBloques({ gteUpdatedAt = null, onBloque = null } = {}) {
    const pTotal = contarPolizas(gteUpdatedAt);
    pTotal.catch(() => {});                          // evita "unhandled" si falla antes de esperarla
    const bloques = [];
    bloques[0] = await pedirBloquePolizas(0, gteUpdatedAt);
    if (onBloque) onBloque(bloques[0], null);
    const total = await pTotal;

    const desdes = [];
    for (let d = POLIZAS_BLOQUE; d < total; d += POLIZAS_BLOQUE) desdes.push(d);
    let siguiente = 0;
    const trabajador = async () => {
        while (siguiente < desdes.length) {
            const d = desdes[siguiente++];
            bloques[d / POLIZAS_BLOQUE] = await pedirBloquePolizas(d, gteUpdatedAt);
            if (onBloque) {
                let n = 0;
                while (bloques[n]) n++;
                onBloque([].concat(...bloques.slice(0, n)), total);
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(POLIZAS_PARALELO, desdes.length) }, trabajador));

    // Sin duplicados (si alguien editó durante la descarga un bloque pudo solaparse con otro)
    const vistos = new Map();
    for (const b of bloques) for (const p of (b || [])) if (!vistos.has(p.id)) vistos.set(p.id, p);
    return { filas: [...vistos.values()], total };
}

function _compararPolizas(a, b) {
    if (a.updated_at !== b.updated_at) return (a.updated_at || '') < (b.updated_at || '') ? 1 : -1;
    return a.id < b.id ? -1 : 1;
}

function _maxUpdatedAt(filas) {
    let max = null;
    for (const p of filas) if (p.updated_at && (!max || p.updated_at > max)) max = p.updated_at;
    return max;
}

// ---------- Instalar datos en pantalla ----------
function mostrarGiroCarga(visible) {
    let el = document.getElementById('polActualizando');
    if (!el && visible) {
        const info = document.getElementById('infoPaginacion');
        if (!info) return;
        el = document.createElement('span');
        el.id = 'polActualizando';
        el.className = 'material-symbols-rounded pol-actualizando';
        el.title = 'Actualizando…';
        el.textContent = 'sync';
        info.insertAdjacentElement('afterend', el);
    }
    if (el) el.classList.toggle('visible', !!visible);
}

// Vuelve a aplicar lo que el usuario tiene puesto (buscador, avanzados, año…) sobre datos nuevos
function reaplicarFiltrosVigentes() {
    const hayTexto = !!(document.getElementById('searchInput')?.value || '').trim();
    const hayAnios = ['2025', '2026', '2027'].some(a => document.getElementById(a)?.checked);
    if ((hayFiltrosActivos || hayTexto || hayAnios) && typeof window.aplicarFiltrosAvanzados === 'function') {
        aplicandoSoloBusqueda = true;      // no tocar el botón "Ver gráfica"
        try { window.aplicarFiltrosAvanzados(); } finally { aplicandoSoloBusqueda = false; }
    }
}

// Filtros que llegan desde el inicio (operador, cumpleaños). Se consumen una sola vez.
function aplicarFiltrosDeInicio() {
    const filtroOperadorHome = sessionStorage.getItem('filtro_operador');
    if (filtroOperadorHome) {
        sessionStorage.removeItem('filtro_operador');
        const checkbox = document.querySelector(`#panelOperadores input[value="${filtroOperadorHome}"]`);
        if (checkbox) {
            document.querySelectorAll('#panelOperadores input').forEach(cb => cb.checked = false);
            checkbox.checked = true;
            actualizarTextoOperadores();
            aplicarFiltrosAvanzados();

            requestAnimationFrame(() => {
                renderizarTabla();
                actualizarPaginacion()
            })
        }
    }

    const filtroCumpleanos = localStorage.getItem('filtro_cumpleanos');
    if (filtroCumpleanos) {
        localStorage.removeItem('filtro_cumpleanos');
        idsCumpleanosActivos = JSON.parse(filtroCumpleanos);
    }
    if (idsCumpleanosActivos) {
        polizasFiltradas = todasLasPolizas.filter(p => idsCumpleanosActivos.includes(p.cliente?.id));
        hayFiltrosActivos = true;
        renderizarTabla();
        actualizarPaginacion();
        actualizarIndicadorFiltros();
    }
}

// modo: 'parcial' (bloques que van llegando, solo primera página), 'cache' (pintado desde IndexedDB)
// o 'final' (lista completa de red). 'cache' y 'final' hacen el trabajo completo.
function instalarPolizas(crudas, modo) {
    // Los borradores de renovación no se listan: se abren desde la póliza original ("Continuar renovación")
    const lista = crudas.filter(p => !p.cliente?.archivado && p.estado_renovacion !== 'Borrador');

    if (modo === 'parcial') {
        if (!todasLasPolizas.length) paginaActual = 1;
        todasLasPolizas = lista;
        if (terminoServidorActivo) return;      // manda la búsqueda dirigida al servidor
        polizasFiltradas = lista.slice();
        renderizarTabla();
        actualizarPaginacion();
        return;
    }

    const paginaPrevia = paginaActual;
    factoresPolizaCache = {};                    // los datos cambiaron: factores a recalcular (solo la página visible)
    todasLasPolizas = lista;
    polizasFiltradas = lista.slice();
    paginaActual = 1;

    const estadisticas = calcularEstadisticas(todasLasPolizas);
    filtroModificadoPor.recargarOpciones();
    filtroPortalAvanzado.recargarOpciones();
    filtroNacionalidad.recargarOpciones();
    filtroAgenteCliente.recargarOpciones();
    actualizarTarjetas(estadisticas);
    actualizarIndicadoresRol();

    datosPolizasListos = true;
    busquedaServidorId++;                        // cualquier búsqueda al servidor en vuelo queda obsoleta
    terminoServidorActivo = false;

    if (!filtrosRestaurados) {
        // Si hay filtros guardados en localStorage, los restaura y reemplaza polizasFiltradas
        restaurarFiltrosDesdeStorage();
        filtrosRestaurados = true;
    } else {
        reaplicarFiltrosVigentes();
        // mantener la página donde estaba el usuario
        const totalPaginas = Math.max(1, Math.ceil(polizasFiltradas.length / polizasPorPagina));
        paginaActual = Math.min(paginaPrevia, totalPaginas);
    }

    if (busquedaPendiente) {
        // Búsqueda hecha antes de tener datos: se recalcula ahora con todos los datos
        busquedaPendiente = false;
        buscarPolizas(document.getElementById('searchInput')?.value || '');
    }

    renderizarTabla();
    actualizarPaginacion();
    aplicarFiltrosDeInicio();
}

/*
 * cargarPolizas — rendimiento, fase 1 (el usuario ve lo mismo que antes, más rápido).
 *
 * Qué cambió y por qué:
 *  - Instrumentación: dbg.info('[pólizas] tiempos (ms)', …) con consulta, procesado, factores y
 *    render, para comparar antes/después.
 *  - Select mínimo (POLIZAS_SELECT_LISTA): solo columnas de tabla, filtros, búsqueda, orden, factores
 *    y exportación. Dirección/ciudad/código postal y las notas de seguimiento (medio, observación)
 *    se piden al abrir el detalle (cargarDetallePoliza). Se quitaron además columnas que ya no usaba
 *    nadie (tipo_venta, modificado_por_email, ocupacion y los pago_* de metodos_pago).
 *  - Carga por bloques: count (head) + .range() de 1.000 filas, hasta 4 en paralelo; el primer
 *    bloque se pinta en cuanto llega. Orden estable (updated_at desc, id asc). Esto sustituye al
 *    envoltorio de polizas_carga_completa.js (que se desactiva con window.__polizasCargaPropia).
 *  - Caché en IndexedDB por usuario: al entrar se pinta al instante desde la caché y se refresca en
 *    segundo plano pidiendo solo las filas con updated_at >= última marca - 2 min (fusión por id; vía
 *    RPC polizas_lista, con respaldo por bloques si no existe). Si la caché
 *    tiene más de 12 h, no hay updated_at o el total no cuadra (altas/bajas), se hace recarga
 *    completa. Se borra al cerrar sesión. Las recargas posteriores (botón, carteras en tiempo
 *    real) son siempre completas.
 *  - Búsqueda prioritaria: si se busca antes de que termine la carga, se consulta el servidor
 *    (límite 50) y al terminar la carga se recalcula localmente.
 *  - Factores de riesgo: se calculan solo para las filas de la página visible (en renderizarTabla),
 *    sin repintar la tabla entera al terminar.
 *  - Render: filas en un solo innerHTML, permisos fuera del bucle, un único listener delegado en el
 *    tbody y animación de entrada solo en filas nuevas.
 *  Sigue sin haber paginación ni filtrado en servidor (fase 2).
 */
async function cargarPolizas() {
    const tiempos = {};
    const t0 = _ahora();
    cargaPolizasEnCurso = true;
    mostrarGiroCarga(true);
    let hayDatosEnPantalla = todasLasPolizas.length > 0;

    try {
        rolUsuario = datosUsuario?.rol || 'operador';
        const esAdmin = tienePermiso('ver_todos_clientes');

        const btnExportar = document.getElementById('btnExportar');
        if (btnExportar && esAdmin) {
            btnExportar.style.display = 'inline-flex';
        }

        // Fase 3: qué pólizas ve cada usuario lo decide la base de datos (RLS de carteras):
        // su cartera + su equipo + las carteras concedidas en Usuarios → Carteras.
        // Por eso ya no se filtra aquí por operador_nombre.

        const esPrimera = _primeraCargaPolizas;
        _primeraCargaPolizas = false;
        const clave = claveCachePolizas();
        // Con filtros llegados por URL (estado/atención) no se pinta la caché: evita ver la lista sin filtrar
        const urlConFiltro = /[?&](estado|atencion|condado)=/.test(location.search);

        let cache = null;
        if (esPrimera && clave && !urlConFiltro) {
            const tc = _ahora();
            cache = await leerCachePolizas(clave);
            tiempos.lecturaCache = Math.round(_ahora() - tc);
        }

        if (cache) {
            const tp = _ahora();
            instalarPolizas(cache.filas, 'cache');
            hayDatosEnPantalla = true;
            tiempos.pintadoDesdeCache = Math.round(_ahora() - tp);
        } else if (!hayDatosEnPantalla) {
            mostrarIndicadorCarga(true);
        }

        // --- Consulta ---
        const tq = _ahora();
        let crudas = null;
        let cargaCompletaEn = Date.now();
        let modoCarga = 'completa';
        let metodoCarga = null;

        if (cache && cache.ultimoUpdatedAt && (Date.now() - cache.cargaCompletaEn) < POLIZAS_DELTA_MAX_EDAD_MS) {
            try {
                const desdeDelta = new Date(new Date(cache.ultimoUpdatedAt).getTime() - POLIZAS_DELTA_MARGEN_MS).toISOString();
                const [cambios, totalActual] = await Promise.all([
                    descargarPolizas({ gteUpdatedAt: desdeDelta }),
                    contarPolizas(null)
                ]);
                const mapa = new Map(cache.filas.map(p => [p.id, p]));
                cambios.filas.forEach(p => mapa.set(p.id, p));
                const fusion = [...mapa.values()].sort(_compararPolizas);
                if (fusion.length !== totalActual) throw new Error(`el total no cuadra (${fusion.length} vs ${totalActual})`);
                crudas = fusion;
                cargaCompletaEn = cache.cargaCompletaEn;
                modoCarga = `delta (${cambios.filas.length} filas)`;
                metodoCarga = cambios.metodo;
            } catch (e) {
                dbg.info('[pólizas] delta descartado, recarga completa:', e?.message || e);
            }
        }

        if (!crudas) {
            const parcial = !hayDatosEnPantalla;
            const resultado = await descargarPolizas({
                onBloque: parcial ? (filas) => instalarPolizas(filas, 'parcial') : null
            });
            crudas = resultado.filas.sort(_compararPolizas);
            metodoCarga = resultado.metodo;
        }
        tiempos.consulta = Math.round(_ahora() - tq);
        tiempos.modo = modoCarga;
        tiempos.metodo = metodoCarga;
        tiempos.filas = crudas.length;

        // --- Procesado (filtrar, estadísticas, restaurar filtros) + render ---
        const tpr = _ahora();
        _msFactoresRender = 0;
        instalarPolizas(crudas, 'final');
        const tFin = _ahora();
        tiempos.procesadoYRender = Math.round(tFin - tpr);
        tiempos.factores = Math.round(_msFactoresRender);

        // Guardar en la caché cuando el navegador esté en reposo
        if (clave) {
            const registro = {
                clave, version: POLIZAS_CACHE_VERSION, guardadoEn: Date.now(), cargaCompletaEn,
                ultimoUpdatedAt: _maxUpdatedAt(crudas), filas: crudas
            };
            _enReposo(() => guardarCachePolizas(registro));
        }

        tiempos.total = Math.round(_ahora() - t0);
        dbg.info('[pólizas] tiempos (ms)', tiempos);

    } catch (error) {
        console.error('❌ Error al cargar pólizas:', error?.message);
        if (hayDatosEnPantalla && todasLasPolizas.length) {
            // Había algo pintado (caché): se conserva y solo se avisa en consola
            dbg.warn('[pólizas] no se pudo refrescar; se muestran los datos guardados');
            datosPolizasListos = true;
        } else {
            mostrarIndicadorCarga(false);
            mostrarError('Error al cargar las pólizas: ' + error.message);
        }
    } finally {
        cargaPolizasEnCurso = false;
        mostrarGiroCarga(false);
    }
}

// ---------- Búsqueda prioritaria en el servidor (mientras la carga completa sigue en segundo plano) ----------
// Quita lo que rompe un filtro .or de PostgREST (comas, paréntesis, comodines, comillas, barras)
function escaparTerminoOr(valor) {
    return String(valor ?? '').replace(/[,()%*_\\"'`]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function buscarPolizasEnServidor(termino) {
    const id = ++busquedaServidorId;
    const tokens = prepararBusqueda(termino);

    // Término vacío: volver a lo que hubiera cargado hasta ahora
    if (!tokens) {
        if (todasLasPolizas.length) {
            polizasFiltradas = todasLasPolizas.slice();
            paginaActual = 1;
            renderizarTabla();
            actualizarPaginacion();
        }
        return;
    }

    // Se consulta por la palabra más larga; después se exigen todas las palabras en local
    const crudo = escaparTerminoOr(termino).split(' ').filter(Boolean).sort((a, b) => b.length - a.length)[0];
    if (!crudo) return;
    const digitos = _soloDigitos(crudo);
    // Teléfonos guardados con formato: 302434 → *3*0*2*4*3*4* (se verifica después en local)
    const patronTel = digitos.length >= 3 && /^[\d()+.\-]+$/.test(crudo) ? `*${digitos.split('').join('*')}*` : null;

    const filtroPoliza = [`numero_poliza.ilike.*${crudo}*`, `member_id.ilike.*${crudo}*`].join(',');
    const filtroCliente = [
        `nombres.ilike.*${crudo}*`, `apellidos.ilike.*${crudo}*`, `email.ilike.*${crudo}*`,
        `telefono1.ilike.*${crudo}*`, `telefono2.ilike.*${crudo}*`,
        ...(patronTel ? [`telefono1.ilike.${patronTel}`, `telefono2.ilike.${patronTel}`] : [])
    ].join(',');

    const base = () => supabaseClient.from('polizas').select(POLIZAS_SELECT_LISTA)
        .order('updated_at', { ascending: false }).limit(50);

    try {
        const [porPoliza, porCliente] = await Promise.all([
            base().or(filtroPoliza),
            (async () => {
                const { data, error } = await supabaseClient.from('clientes').select('id').or(filtroCliente).limit(100);
                if (error) return { error };
                const ids = (data || []).map(c => c.id);
                return ids.length ? await base().in('cliente_id', ids) : { data: [] };
            })()
        ]);
        if (id !== busquedaServidorId || datosPolizasListos) return;     // obsoleta, o ya hay datos completos
        if (porPoliza.error || porCliente.error) {
            dbg.warn('[pólizas] búsqueda en servidor falló; se espera a la carga completa:', porPoliza.error || porCliente.error);
            return;
        }

        const anios = ['2025', '2026', '2027'].filter(a => document.getElementById(a)?.checked);
        const vistos = new Map();
        [...(porPoliza.data || []), ...(porCliente.data || [])].forEach(p => {
            if (vistos.has(p.id)) return;
            if (p.cliente?.archivado || p.estado_renovacion === 'Borrador') return;
            if (anios.length && !anios.includes(String(p.fecha_efectividad || '').slice(0, 4))) return;
            if (!coincideBusqueda(p, tokens)) return;
            vistos.set(p.id, p);
        });
        const resultados = [...vistos.values()].sort(_compararPolizas).slice(0, 50);
        resultados.forEach(p => polizasBusquedaServidor.set(String(p.id), p));

        polizasFiltradas = resultados;
        paginaActual = 1;
        renderizarTabla();
        actualizarPaginacion();
    } catch (e) {
        dbg.warn('[pólizas] búsqueda en servidor falló; se espera a la carga completa:', e);
    }
}

// ============================================
// RENOVACIÓN (fase 2)
// ============================================
// 'renovacion' = la póliza es una renovación (viene de otra); los demás
// valores son el estado de renovación de la póliza.
function cumpleFiltroRenovacion(poliza, filtro) {
    if (!filtro) return true;
    if (filtro === 'renovacion') return !!poliza.poliza_origen_id;
    return (poliza.estado_renovacion || 'Pendiente') === filtro;
}

function celdaRenovacion(poliza) {
    const estado = poliza.estado_renovacion || 'Pendiente';
    const estilos = {
        'Renovada':    'background:#dcfce7;color:#166534;',
        'No renovada': 'background:#fee2e2;color:#991b1b;',
        'Pendiente':   'background:#f1f5f9;color:#475569;',
        'En proceso':  'background:#fff7ed;color:#9b5c1c;',
    };
    const chip = `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:600;${estilos[estado] || estilos.Pendiente}">${estado}</span>`;
    const origen = poliza.poliza_origen_id
        ? ' <span title="Esta póliza es una renovación" style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:600;background:#ede9fe;color:#5b21b6;">Renovación</span>'
        : '';
    return chip + origen;
}

// Filas de la página pintada (id → póliza) y conjunto de ids, para el clic delegado y la animación
let _filasPaginaActual = new Map();
let _idsPaginaPintada = new Set();

function renderizarTabla() {
    const tbody = document.getElementById('tabla-polizas');

    if (!tbody) {
        console.error('❌ No se encontró el elemento tabla-polizas');
        return;
    }

    // Un único listener para todas las filas (antes: un onclick por fila)
    if (!tbody.__clicDelegado) {
        tbody.__clicDelegado = true;
        tbody.addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-poliza-id]');
            if (!tr || !tbody.contains(tr)) return;
            const poliza = _filasPaginaActual.get(tr.dataset.polizaId);
            if (poliza) abrirDetalles(poliza.id);
        });
    }

    if (polizasFiltradas.length === 0) {
        _filasPaginaActual = new Map();
        _idsPaginaPintada = new Set();
        tbody.innerHTML = `
            <tr>
                <td colspan="32" style="text-align: center; padding: 40px; color: #94a3b8;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.3;">search_off</span>
                        <p style="font-size: 1.1rem; margin: 0;">No se encontraron pólizas</p>
                        <small>Intenta cambiar los filtros o crear una nueva póliza</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const inicio = (paginaActual - 1) * polizasPorPagina;
    const fin = inicio + polizasPorPagina;
    const polizasPagina = polizasFiltradas.slice(inicio, fin);

    // Permiso calculado una vez, no por fila
    const puedeReasignar = tienePermiso('reasignar_operador');
    const esc = (v) => escapeHtml(v ?? '');

    // Factores de riesgo: solo para las filas visibles (se cachean por póliza)
    const tf = _ahora();
    polizasPagina.forEach(p => obtenerFactoresPoliza(p));
    _msFactoresRender += _ahora() - tf;

    const filas = polizasPagina.map(poliza => {
        const cliente = poliza.cliente;

        let ultimoSeguimiento = '';
        let seguimientoEfectivo = '-';

        if (poliza.seguimientos && poliza.seguimientos.length > 0) {
            // Calcular último seguimiento (fecha más reciente)
            const fechas = poliza.seguimientos.map(seg => new Date(formatoUS(seg.fecha_seguimiento)));
            const fechaMayor = new Date(Math.max(...fechas));
            ultimoSeguimiento = formatoUS(fechaMayor);
            seguimientoEfectivo = seguimientoEfectivo120(poliza) || '-';
        }

        const operadorTexto = esc(cliente?.operador_nombre || poliza?.operador_nombre || '-');

        return `
        <tr data-poliza-id="${esc(poliza.id)}" style="cursor: pointer;">
            <td data-label="Portal">${esc(cliente?.portal || '-')}</td>
            <td data-label="Factores">${renderCeldaFactores(poliza.id)}</td>
            <td data-label="Tipo de registro">${esc(cliente?.tipo_registro || '-')}</td>
            <td data-label="Tipo de modificación">${esc(cliente?.tipo_modificacion || '-')}</td>
            <td data-label="Agente (Mercado)">${esc(poliza.nombre_agente_mercado || '-')}</td>
            <td data-label="Operador">
                ${puedeReasignar ? `
                    <div class="operador-editable"
                        title="Click para cambiar operador"
                        onclick="abrirSelectorOperador(event, '${cliente?.id || ''}', '${cliente?.operador_nombre || ''}')"
                    >
                        <span class="operador-nombre">${operadorTexto}</span>
                        <span class="material-symbols-rounded operador-edit-icon">edit</span>
                    </div>
                ` : `
                    ${operadorTexto}
                `}
            </td>
            <td class="td1" data-label="Cliente">
                <div class="td1__flex">
                    <a href="./cliente_editar.html?id=${esc(cliente?.id || '')}" onclick="event.stopPropagation()">
                        ${esc(cliente?.nombres || '')} ${esc(cliente?.apellidos || '')}
                    </a>
                </div>
            </td>
            <td data-label="Aplicantes">${esc(poliza.aplicantes || '-')}</td>
            <td data-label="Teléfono">${esc(cliente?.telefono1 || '-')}</td>
            <td data-label="Estado migratorio">${esc(cliente?.estado_migratorio || '-')}</td>
            <td data-label="SSN">${esc(cliente?.ssn || 'No')}</td>
            <td data-label="Estado (Mercado)">
                <span class="badge-estado ${esc(poliza.estado_mercado || 'pendiente')}">
                    ${esc(poliza.estado_mercado || 'Pendiente')}
                </span>
            </td>
            <td data-label="Fecha de revisión (Mercado)">${formatoUS(poliza.fecha_revision_mercado)}</td>
            <td data-label="Documentos">${esc(poliza.documentos_pendientes)}</td>
            <td data-label="Estado documentos">${esc(poliza.estado_documentos || 'Pendiente información')} </td>
            <td data-label="Fecha del plazo de documentos">${formatoUS(poliza.fecha_plazo_documentos) || 'Pendiente información'} </td>
            <td data-label="Agente 3.5">${obtenerBadgeAgente35(poliza.agente35_estado)}</td>
            <td data-label="Compañía">${esc(poliza.compania || '-')}</td>
            <td data-label="Estado en compañia">${esc(poliza.estado_compania || '-')}</td>
            <td data-label="Fecha de revision en compañia">${formatoUS(poliza.fecha_revision_compania) || '-'}</td>
            <td data-label="Plan">${esc(poliza.plan || '-')}</td>
            <td data-label="Prima">$${esc(poliza.prima || '0.00')}</td>
            <td data-label="Pagado hasta">${formatoUS(poliza.pagado_hasta) || '-'}</td>
            <td data-label="¿Tiene metodo de pago?">${esc(obtenerMetodoPrincipal(poliza.cliente)?.tiene_metodo_pago || '-')}</td>
            <td data-label="Agente">${esc(poliza.agente_nombre || '-')}</td>
            <td data-label="Efectividad">${formatoUS(poliza.fecha_efectividad)}</td>
            <td data-label="Creación">${formatoUS(poliza.created_at)}</td>
            <td data-label="Modificación">${formatearFechaHora(poliza.updated_at)}</td>
            <td data-label="Modificación realizada por">${esc(poliza.modificado_por_nombre || '-')}</td>
            <td data-label="Último seguimiento">${ultimoSeguimiento}</td>
            <td data-label="Seguimiento efectivo">${esc(seguimientoEfectivo)}</td>
            <td data-label="Renovación">${celdaRenovacion(poliza)}</td>
        </tr>`;
    });

    // Cascada de entrada solo si la página trae filas distintas a las ya pintadas
    // (reordenar o refiltrar la misma página no repite la animación)
    const idsNuevos = new Set(polizasPagina.map(p => String(p.id)));
    let animar = idsNuevos.size !== _idsPaginaPintada.size;
    if (!animar) for (const id of idsNuevos) { if (!_idsPaginaPintada.has(id)) { animar = true; break; } }

    _filasPaginaActual = new Map(polizasPagina.map(p => [String(p.id), p]));
    _idsPaginaPintada = idsNuevos;

    tbody.innerHTML = filas.join('');

    if (animar) {
        Array.from(tbody.rows).forEach((tr, i) => {
            tr.style.setProperty('--i', Math.min(i, 15));
            tr.classList.add('fila-entra');
        });
    }
}

function formatearSSN(valor) {
    const numeros = valor.replace(/\D/g, '').slice(0, 9);
    if (numeros.length === 0) return '';
    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 5) return `${numeros.slice(0, 3)}-${numeros.slice(3)}`;
    return `${numeros.slice(0, 3)}-${numeros.slice(3, 5)}-${numeros.slice(5, 9)}`;
}

// Calcular rango de paginación
// const inicio = (paginaActual - 1) * polizasPorPagina;
// const fin = inicio + polizasPorPagina;
// const polizasPagina = polizasFiltradas.slice(inicio, fin);

// // Generar filas
// polizasPagina.forEach(poliza => {
//     const fila = crearFilaPoliza(poliza);
//     tbody.innerHTML += fila;
// });


// ============================================
// CREAR FILA DE PÓLIZA
// ============================================
function crearFilaPoliza(poliza) {
    const cliente = poliza.cliente || {};
    const nombreCompleto = `${cliente.nombres|| ''} ${cliente.apellidos || ''}`.trim();
    
    // Formatear fechas
    const fechaEfectividad = poliza.fecha_efectividad ? formatoUS(poliza.fecha_efectividad) : '--/--/----';
    const fechaCreacion = poliza.created_at ? formatearFecha(poliza.created_at) : '--/--/----';
    const fechaModificacion = poliza.updated_at ? formatearFecha(poliza.updated_at) : '--/--/----';
    
    // Formatear prima
    const prima = poliza.prima ? `$${parseFloat(poliza.prima).toFixed(2)}` : '$0.00';
    
    // Badge de estado
    const estadoBadge = obtenerBadgeEstado(poliza.estado_mercado);
    
    return `
        <tr data-poliza-id="${poliza.id}" onclick="abrirDetalles(${poliza.id})" style="cursor: pointer;">
            <td data-label="Póliza">${poliza.numero_poliza || 'N/A'}</td>
            <td data-label="Póliza">${cliente.tipo_registro || 'N/A'}</td>
            <td data-label="Operador">${poliza.operador_nombre || 'N/A'}</td>
            <td class="td1" data-label="Cliente">
                <div class="td1__flex">
                    <a href="./cliente_editar.html?id=${cliente.id || ''}" onclick="event.stopPropagation();" style="color: #6366f1; text-decoration: none; font-weight: 500;">
                        ${nombreCompleto || 'Sin nombre'}
                    </a>
                </div>
            </td>
            <td data-label="Teléfono">${cliente.telefono1 || 'N/A'}</td>
            <td data-label="Estado">${estadoBadge}</td>
            <td data-label="Compañía">${poliza.compania || 'N/A'}</td>
            <td data-label="Plan">${poliza.plan || 'N/A'}</td>
            <td data-label="Prima">${prima}</td>
            <td data-label="Agente">${poliza.agente_nombre || 'N/A'}</td>
            <td data-label="Efectividad">${fechaEfectividad}</td>
            <td data-label="Creación">${fechaCreacion}</td>
            <td data-label="Modificación">${fechaModificacion}</td>
        </tr>
    `;
}

// ============================================
// MODAL DE DETALLES
// ============================================
function configurarModal() {
    // Cerrar modal al hacer click fuera
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('modalDetalles');
        if (e.target === modal) {
            cerrarModal();
        }
    });
}

// Factores de riesgo de UNA póliza, con caché por id. Se calcula bajo demanda (filas visibles).
function obtenerFactoresPoliza(poliza) {
    let info = factoresPolizaCache[poliza.id];
    if (info) return info;
    try {
        const calculo = calcularScoringCartera(poliza);
        info = {
            ...calculo,
            principal: obtenerFactorPrincipalCartera(calculo.factores, calculo.metricas.mesesPagoPendiente)
        };
        factoresPolizaCache[poliza.id] = info;
    } catch (e) {
        dbg.warn('[pólizas] no se pudieron calcular los factores de', poliza.id, e);
    }
    return info || null;
}

// Compatibilidad (polizas_extras.js la llama tras añadir pólizas): descarta lo calculado y
// refresca SOLO las celdas de factores de la página visible, sin reconstruir la tabla.
function calcularFactoresTodasLasPolizas() {
    factoresPolizaCache = {};
    const tbody = document.getElementById('tabla-polizas');
    if (!tbody) return;
    tbody.querySelectorAll('tr[data-poliza-id]').forEach(tr => {
        const poliza = _filasPaginaActual.get(tr.dataset.polizaId);
        const celda = tr.querySelector('td[data-label="Factores"]');
        if (poliza && celda) {
            obtenerFactoresPoliza(poliza);
            celda.innerHTML = renderCeldaFactores(poliza.id);
        }
    });
}

function renderCeldaFactores(polizaId) {
    const info = factoresPolizaCache[polizaId];

    if (!info) {
        return `<span style="color:#94a3b8; font-size: 0.78rem;">Calculando...</span>`
    }
    if (!info.principal) {
        return `<span style="color:#94a3b8; font-size: 0.78rem;">Sin factores</span>`
    }

    const color = info.nivel === 'rojo' ? '#ef4444' : info.nivel === 'amarillo' ? '#f59e0b' : '#22c55e';
    return `
        <span onclick="event.stopPropagation(); abrirModalFactores('${polizaId}')"
              style="display:inline-block; cursor:pointer; font-size:0.76rem; font-weight:600;
                     padding:4px 10px; border-radius:14px; white-space:nowrap;
                     background:${color}1a; color:${color}; border:1px solid ${color}55;">
            ${escapeHtml(info.principal)}
        </span>`;
}

function renderCeldaFactores(polizaId) {
    const info = factoresPolizaCache[polizaId];

    if (!info) {
        return `<span style="color:#94a3b8; font-size:0.78rem;">Calculando…</span>`;
    }
    if (!info.principal) {
        return `<span style="color:#94a3b8; font-size:0.78rem;">Sin factores</span>`;
    }

    const color = info.nivel === 'rojo' ? '#ef4444' : info.nivel === 'amarillo' ? '#f59e0b' : '#22c55e';

    return `
        <span onclick="event.stopPropagation(); abrirModalFactores('${polizaId}')"
              style="display:inline-block; cursor:pointer; font-size:0.76rem; font-weight:600;
                     padding:4px 10px; border-radius:14px; white-space:nowrap;
                     background:${color}1a; color:${color}; border:1px solid ${color}55;">
            ${escapeHtml(info.principal)}
        </span>`;
}

function abrirModalFactores(polizaId) {
    const info = factoresPolizaCache[polizaId];
    if (!info) return;

    const poliza  = todasLasPolizas.find(p => String(p.id) === String(polizaId));
    const cliente = poliza?.cliente || {};
    const nombre  = `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim();
    const color   = info.nivel === 'rojo' ? '#ef4444' : info.nivel === 'amarillo' ? '#f59e0b' : '#22c55e';

    document.getElementById('modalFactoresContenido').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div>
                <h2 style="margin:0 0 4px; font-size:1.15rem; color:#1e293b;">${escapeHtml(nombre || 'Cliente')}</h2>
                <span style="font-size:0.8rem; color:#64748b;">${escapeHtml(poliza?.numero_poliza || '')}</span>
            </div>
            <button onclick="cerrarModalFactores()" style="background:none; border:none; cursor:pointer; color:#64748b; padding:4px;">
                <span class="material-symbols-rounded">close</span>
            </button>
        </div>
        <div style="display:inline-flex; align-items:center; gap:8px; background:${color}1a; border:1px solid ${color}55; color:${color}; font-weight:700; font-size:0.85rem; padding:5px 14px; border-radius:20px; margin-bottom:16px;">
            ${info.score} pts · ${info.nivel.charAt(0).toUpperCase() + info.nivel.slice(1)}
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
            ${info.factores.length > 0 ? info.factores.map(f => `
                <div style="display:flex; align-items:center; gap:8px; padding:9px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:0.85rem; color:#334155;">
                    <span class="material-symbols-rounded" style="font-size:16px; color:#6366f1;">flag</span>
                    ${escapeHtml(f)}
                </div>
            `).join('') : `<p style="color:#94a3b8; font-size:0.85rem; margin:0;">No se detectaron factores de riesgo.</p>`}
        </div>
    `;

    document.getElementById('modalFactores').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cerrarModalFactores() {
    document.getElementById('modalFactores').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Datos que solo usa el modal de detalle (se quitaron del select de la lista).
// Si falla, el modal se abre igualmente con lo que ya hay (esos campos saldrán como N/A).
async function cargarDetallePoliza(poliza) {
    if (poliza.__detalleCargado) return;
    try {
        const { data, error } = await supabaseClient
            .from('polizas')
            .select(`
                id,
                cliente:clientes ( id, direccion, ciudad, codigo_postal ),
                seguimientos ( fecha_seguimiento, seguimiento_efectivo, medio_comunicacion, observacion )
            `)
            .eq('id', poliza.id)
            .maybeSingle();
        if (error) throw error;
        if (!data) return;
        if (data.cliente) {
            poliza.cliente = poliza.cliente || {};
            poliza.cliente.direccion = data.cliente.direccion;
            poliza.cliente.ciudad = data.cliente.ciudad;
            poliza.cliente.codigo_postal = data.cliente.codigo_postal;
        }
        if (Array.isArray(data.seguimientos)) poliza.seguimientos = data.seguimientos;
        poliza.__detalleCargado = true;
    } catch (e) {
        dbg.warn('[pólizas] no se pudo cargar el detalle de la póliza', poliza.id, e);
    }
}

async function abrirDetalles(polizaId) {
    try {
        // Buscar póliza en datos locales
        const poliza = todasLasPolizas.find(p => p.id === polizaId) || polizasBusquedaServidor.get(String(polizaId));
        if (!poliza) {
            throw new Error('Póliza no encontrada');
        }

        // La lista ya no trae dirección ni notas de seguimiento: se piden aquí, por id
        await cargarDetallePoliza(poliza);


        
        polizaSeleccionada = poliza;
        const cliente = poliza.cliente || {};
        const seguimientos = poliza.seguimientos || [];
        const seguimiento = seguimientos.length > 0 
            ? [...seguimientos].sort((a, b) => new Date(b.fecha_seguimiento) - new Date(a.fecha_seguimiento))[0] 
            : {};        
        // Rellenar modal
        const contenido = `
            <div class="modal-header">
                <h2>
                    <span class="material-symbols-rounded">description</span>
                    ${poliza.numero_poliza || 'N/A'}
                </h2>   
                <button class="btn-close-modal" onclick="cerrarModal()">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
            
            <div class="modal-body">
                <!-- Información del Cliente -->
                <div class="detalle-seccion">
                    <h3><span class="material-symbols-rounded">person</span> Cliente</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Nombre completo</label>
                            <p>${cliente.nombres || ''} ${cliente.apellidos || ''}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Email</label>
                            <p>${cliente.email || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Teléfono 1</label>
                            <p>${cliente.telefono1 || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Teléfono 2</label>
                            <p>${cliente.telefono2 || 'N/A'}</p>
                        </div>

                        <div class="detalle-item">
                            <label>Clave de seguridad</label>
                            <p>${poliza.clave_seguridad || 'N/A'}</p>
                        </div>

                        <div class="detalle-item">
                            <label>Estado migratorio</label>
                            <p>${cliente.estado_migratorio || 'N/A'}</p>
                        </div>

                        <div class="detalle-item full-width">
                            <label>Dirección</label>
                            <p>${cliente.direccion || 'N/A'}, ${cliente.ciudad || ''}, ${cliente.estado || ''} ${cliente.codigo_postal || ''}</p>
                        </div>
                    </div>
                </div>

                <!-- Medio de Comunicación -->
                <div class="detalle-seccion" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #10b981;">
                    <h3><span class="material-symbols-rounded">chat</span> Comunicación</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Medio de contacto (último)</label>
                            <p><strong style="color: #10b981; font-size: 1.1rem;">${seguimiento?.medio_comunicacion || 'No especificado'}</strong></p>
                        </div>
                        ${(poliza.seguimientos && poliza.seguimientos.length > 0) ? `
                        <div class="detalle-item full-width">
                            <label>Notas de seguimiento (${poliza.seguimientos.length})</label>
                            ${[...poliza.seguimientos].sort((a, b) => new Date(b.fecha_seguimiento) - new Date(a.fecha_seguimiento)).slice(0,3).map(seg => `
                                <div style="padding: 8px 12px; margin-bottom: 6px; background: rgba(16,185,129,0.08); border-radius: 6px; border-left: 3px solid #10b981;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">
                                        <span>${seg.medio_comunicacion || '-'}</span>
                                        <span>${seg.fecha_seguimiento ? formatoUS(seg.fecha_seguimiento) : '-'}</span>
                                    </div>
                                    <p style="margin: 0; font-size: 0.9rem;">${seg.observacion || 'Sin nota'}</p>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Información de la Póliza -->
                <div class="detalle-seccion">
                    <h3><span class="material-symbols-rounded">shield</span> Póliza</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Número de póliza</label>
                            <p><strong>${poliza.numero_poliza || 'N/A'}</strong></p>
                        </div>
                        <div class="detalle-item">
                            <label>Compañía</label>
                            <p>${poliza.compania || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Plan</label>
                            <p>${poliza.plan || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Prima</label>
                            <p><strong style="color: #6366f1; font-size: 1.2rem;">$${parseFloat(poliza.prima || 0).toFixed(2)}</strong></p>
                        </div>
                        <div class="detalle-item">
                            <label>Crédito fiscal</label>
                            <p>$${parseFloat(poliza.credito_fiscal || 0).toFixed(2)}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Estado en mercado</label>
                            <p>${obtenerBadgeEstado(poliza.estado_mercado || 'pendiente')}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Estado en compania</label>
                            <p>${obtenerBadgeEstado(poliza.estado_compania || 'pendiente')}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Fechas -->
                <div class="detalle-seccion">
                    <h3><span class="material-symbols-rounded">calendar_today</span> Fechas Importantes</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Fecha efectividad</label>
                            <p>${poliza.fecha_efectividad ? formatoUS(poliza.fecha_efectividad) : 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Fecha inicial cobertura</label>
                            <p>${poliza.fecha_inicial_cobertura ? formatoUS(poliza.fecha_inicial_cobertura) : 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Fecha final cobertura</label>
                            <p>${poliza.fecha_final_cobertura ? formatoUS(poliza.fecha_final_cobertura) : 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Fecha creación</label>
                            <p>${poliza.created_at ? formatoUS(poliza.created_at) : 'N/A'}</p>
                        </div>

                        <div class="detalle-item">
                            <label>Pagado hasta</label>
                            <p>${poliza.pagado_hasta ? formatoUS(poliza.pagado_hasta) : 'N/A'}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Información Adicional -->
                <div class="detalle-seccion">
                    <!-- Meses Pagados -->
                    ${(() => {
                        const mesesPagados = obtenerMesesPagadosAnioActual(poliza.cliente);
                        if (!mesesPagados) return '';

                        const meses = [
                            { key: 'enero',      abr: 'Ene' },
                            { key: 'febrero',    abr: 'Feb' },
                            { key: 'marzo',      abr: 'Mar' },
                            { key: 'abril',      abr: 'Abr' },
                            { key: 'mayo',       abr: 'May' },
                            { key: 'junio',      abr: 'Jun' },
                            { key: 'julio',      abr: 'Jul' },
                            { key: 'agosto',     abr: 'Ago' },
                            { key: 'septiembre', abr: 'Sep' },
                            { key: 'octubre',    abr: 'Oct' },
                            { key: 'noviembre',  abr: 'Nov' },
                            { key: 'diciembre',  abr: 'Dic' },
                        ];

                        const badges = meses.map(({ key, abr }) => {
                            const pagado = mesesPagados[key] === 'Si';
                            return `
                                <span style="
                                    display: inline-flex;
                                    align-items: center;
                                    justify-content: center;
                                    width: 40px;
                                    height: 32px;
                                    border-radius: 6px;
                                    font-size: 12px;
                                    font-weight: 600;
                                    background: ${pagado ? '#dcfce7' : '#f1f5f9'};
                                    color: ${pagado ? '#16a34a' : '#94a3b8'};
                                    border: 1px solid ${pagado ? '#86efac' : '#e2e8f0'};
                                ">${abr}</span>
                            `;
                        }).join('');

                        return `
                            <div class="detalle-seccion">
                                <h3><span class="material-symbols-rounded">payments</span> Meses Pagados (${mesesPagados.anio})</h3>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0;">
                                    ${badges}
                                </div>
                            </div>
                        `;
                    })()}
                    <h3><span class="material-symbols-rounded">info</span> Información Adicional</h3>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <label>Member ID</label>
                            <p>${poliza.member_id || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Portal NPN</label>
                            <p>${poliza.agente_nombre || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Tipo de venta</label>
                            <p>${cliente.tipo_registro || 'N/A'}</p>
                        </div>
                        <div class="detalle-item">
                            <label>Venta realizada por</label>
                            <p>${cliente.venta_realizada_por || 'N/A'}</p>
                        </div>
                        ${poliza.enlace_poliza ? `
                        <div class="detalle-item full-width">
                            <label>Enlace de póliza</label>
                            <p><a href="${poliza.enlace_poliza}" target="_blank" style="color: #6366f1;">Ver póliza online</a></p>
                        </div>
                        ` : ''}
                        ${poliza.observaciones ? `
                        <div class="detalle-item full-width">
                            <label>Observaciones</label>
                            <p>${poliza.observaciones}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" onclick="cerrarModal()">Cerrar</button>
                <button class="btn-primary" onclick="window.location.href='./cliente_editar.html?id=${cliente.id}'">
                    <span class="material-symbols-rounded">edit</span>
                    Editar Cliente
                </button>
            </div>
        `;
        
        document.getElementById('modalContenido').innerHTML = contenido;
        document.getElementById('modalDetalles').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('❌ Error al abrir detalles:', error?.message);
        alert('Error al cargar detalles: ' + error.message);
    }
}

function cerrarModal() {
    document.getElementById('modalDetalles').style.display = 'none';
    document.body.style.overflow = 'auto';
    polizaSeleccionada = null;
}

// ============================================
// PAGINACIÓN
// ============================================
function configurarPaginacion() {
    const selector = document.getElementById('polizasPorPagina');
    if (selector) {
        selector.addEventListener('change', function() {
            polizasPorPagina = parseInt(this.value);
            paginaActual = 1;
            renderizarTabla();
            actualizarPaginacion();
            guardarFiltrosEnStorage();

        });
    }
}

function actualizarPaginacion() {
    const totalPolizas = polizasFiltradas.length;
    const totalPaginas = Math.ceil(totalPolizas / polizasPorPagina);
    
    const inicio = (paginaActual - 1) * polizasPorPagina + 1;
    const fin = Math.min(paginaActual * polizasPorPagina, totalPolizas);
    
    // Actualizar texto
    const infoPaginacion = document.getElementById('infoPaginacion');
    if (infoPaginacion) {
        infoPaginacion.textContent = `Mostrando ${inicio}-${fin} de ${totalPolizas}`;
    }
    
    // Actualizar botones
    const btnAnterior = document.getElementById('btnPaginaAnterior');
    const btnSiguiente = document.getElementById('btnPaginaSiguiente');
    
    if (btnAnterior) {
        btnAnterior.disabled = paginaActual === 1;
    }
    
    if (btnSiguiente) {
        btnSiguiente.disabled = paginaActual === totalPaginas || totalPolizas === 0;
    }
}

function paginaAnterior() {
    if (paginaActual > 1) {
        paginaActual--;
        renderizarTabla();
        actualizarPaginacion();
        window.scrollTo({ top: 200, behavior: 'smooth' });
    }
}

function paginaSiguiente() {
    const totalPaginas = Math.ceil(polizasFiltradas.length / polizasPorPagina);
    if (paginaActual < totalPaginas) {
        paginaActual++;
        renderizarTabla();
        actualizarPaginacion();
        window.scrollTo({ top: 200, behavior: 'smooth' });
    }
}

// ============================================
// ORDENAMIENTO
// ============================================
function configurarOrdenamiento() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        
        header.addEventListener('click', function() {
            const columna = this.dataset.column;
            ordenarPor(columna);
        });
    });
}

function ordenarPor(columna) {
    if (ordenColumna === columna) {
        // Cambiar dirección
        ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
    } else {
        // Nueva columna
        ordenColumna = columna;
        ordenDireccion = 'asc';
    }
    
    // Ordenar datos
    polizasFiltradas.sort((a, b) => {
        let valorA, valorB;
        
        if (columna === 'cliente') {
            valorA = `${a.cliente?.nombres || ''} ${a.cliente?.apellidos || ''}`.trim().toLowerCase();
            valorB = `${b.cliente?.nombres || ''} ${b.cliente?.apellidos || ''}`.trim().toLowerCase();
        } else if (columna === 'prima') {
            valorA = parseFloat(a.prima || 0); 
            valorB = parseFloat(b.prima || 0);
        } else if (columna === 'portal') {
            valorA = (a.cliente?.portal || '').toString().toLowerCase();
            valorB = (b.cliente?.portal || '').toString().toLowerCase();
        } else {
            valorA = (a[columna] || '').toString().toLowerCase();
            valorB = (b[columna] || '').toString().toLowerCase();
        }
        
        if (ordenDireccion === 'asc') {
            return valorA > valorB ? 1 : -1;
        } else {
            return valorA < valorB ? 1 : -1;
        }
    });
    
    // Actualizar UI
    actualizarIndicadoresOrden();
    paginaActual = 1;
    renderizarTabla();
    actualizarPaginacion();
}

function actualizarIndicadoresOrden() {
    document.querySelectorAll('.sortable').forEach(header => {
        const icono = header.querySelector('.sort-icon');
        if (icono) {
            icono.remove();
        }
    });
    
    const headerActivo = document.querySelector(`[data-column="${ordenColumna}"]`);
    if (headerActivo) {
        const icono = document.createElement('span');
        icono.className = 'material-symbols-rounded sort-icon';
        icono.textContent = ordenDireccion === 'asc' ? 'arrow_upward' : 'arrow_downward';
        icono.style.fontSize = '16px';
        icono.style.marginLeft = '4px';
        icono.style.verticalAlign = 'middle';
        headerActivo.appendChild(icono);
    }
}

// ============================================
// EXPORTAR A EXCEL
// ============================================
// Estado de EE. UU. del cliente como código de 2 letras (FL, TX, AZ...). Mismo criterio que estado_usa_codigo en SQL.
const _ESTADOS_US_VARIANTES = { arkanzas:'AR', 'carolina del sur':'SC', 'carolina del norte':'NC', pensilvania:'PA', luisiana:'LA',
    'nueva jersey':'NJ', 'nueva york':'NY', 'nuevo mexico':'NM', 'dakota del norte':'ND', 'dakota del sur':'SD',
    'virginia occidental':'WV', hawai:'HI', 'washington dc':'DC', 'district of columbia':'DC', 'distrito de columbia':'DC',
    alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',
    florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',
    louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',misisipi:'MS',
    missouri:'MO',misuri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','nuevo hampshire':'NH',
    'new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',
    oregon:'OR',pennsylvania:'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',
    utah:'UT',vermont:'VT',virginia:'VA',washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY' };
function estadoUsCodigo(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    const n = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    if (/^[a-z]{2}$/.test(n)) return n.toUpperCase();
    return _ESTADOS_US_VARIANTES[n] || texto;   // si no se reconoce, se deja como está escrito
}

async function exportarExcel() {

    try {
       if (!tienePermiso('exportar_excel')) {
            mostrarNotificacion('Solo administradores pueden exportar', 'error');
            return;
        }

        const datos = polizasFiltradas.map(poliza => {
            const cliente = poliza.cliente || {};

            let ultimoSeguimiento = '';
            if (poliza.seguimientos && poliza.seguimientos.length > 0) {
                // Calcular último seguimiento (fecha más reciente)
                const fechas = poliza.seguimientos.map(seg => new Date(formatoUS(seg.fecha_seguimiento)));
                const fechaMayor = new Date(Math.max(...fechas));
                ultimoSeguimiento = formatoUS(fechaMayor);
                
                // Obtener el seguimiento efectivo del último seguimiento
                const ultimoSeg = poliza.seguimientos.find(seg => {
                    const fechaSeg = new Date(formatoUS(seg.fecha_seguimiento));
                    return fechaSeg.getTime() === fechaMayor.getTime();
                });
                
                if (ultimoSeg) {
                    seguimientoEfectivo = ultimoSeg.seguimiento_efectivo || '-';
                }
            }
            return [
                poliza.numero_poliza || '',
                cliente.tipo_registro || '',
                cliente.tipo_modificacion || '',
                `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim(),
                cliente.telefono1 || '',
                cliente.telefono2 || '',
                cliente.email || '',
                estadoUsCodigo(cliente.estado),
                cliente.estado_migratorio || '',
                cliente.ssn || '',
                poliza.operador_nombre || '',
                poliza.compania || '',
                poliza.plan || '',
                parseFloat(poliza.prima || 0).toFixed(2),
                parseFloat(poliza.credito_fiscal || 0).toFixed(2),
                poliza.estado_mercado || '',
                poliza.estado_compania || '',
                poliza.estado_documentos || '',
                poliza.documentos_pendientes || '',
                poliza.agente35_estado || '',
                poliza.nombre_agente_mercado || '',
                poliza.member_id || '',
                poliza.agente_nombre || cliente.agente_nombre || '',
                poliza.clave_seguridad || '',
                poliza.fecha_efectividad ? formatoUS(poliza.fecha_efectividad) : '',
                poliza.fecha_inicial_cobertura ? formatoUS(poliza.fecha_inicial_cobertura) : '',
                poliza.fecha_final_cobertura ? formatoUS(poliza.fecha_final_cobertura) : '',
                poliza.pagado_hasta ? formatoUS(poliza.pagado_hasta) : '',
                poliza.fecha_revision_mercado ? formatoUS(poliza.fecha_revision_mercado) : '',
                poliza.fecha_revision_compania ? formatoUS(poliza.fecha_revision_compania) : '',
                poliza.fecha_plazo_documentos ? formatoUS(poliza.fecha_plazo_documentos) : '',
                poliza.enlace_poliza || '',
                poliza.observaciones || '',
                ultimoSeguimiento || '',
                poliza.created_at ? formatoUS(poliza.created_at) : ''
            ];
        });

        const headers = [
            'N° Póliza', 'Tipo Registro', 'Tipo Modificación', 'Cliente',
            'Teléfono 1', 'Teléfono 2', 'Email', 'Estado', 'Estado Migratorio', 'SSN',
            'Operador', 'Compañía', 'Plan', 'Prima', 'Crédito Fiscal',
            'Estado Mercado', 'Estado Compañía', 'Estado Documentos',
            'Documentos Pendientes', 'Agente 3.5', 'Agente Mercado',
            'Member ID', 'Agente', 'Clave Seguridad',
            'Fecha Efectividad', 'Fecha Inicial Cobertura', 'Fecha Final Cobertura',
            'Pagado Hasta', 'Revisión Mercado', 'Revisión Compañía',
            'Plazo Documentos', 'Enlace Póliza', 'Observaciones', 'Fecha de seguimiento', 'Fecha Creación'
        ];

        // Crear libro de Excel real (.xlsx) con ExcelJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pólizas');

        // Definir columnas (encabezado + ancho)
        worksheet.columns = headers.map(h => ({ header: h, width: 18 }));

        // Agregar filas de datos
        datos.forEach(fila => worksheet.addRow(fila));

        // Estilo del encabezado (fondo azul, texto blanco, negrita, centrado)
        const filaEncabezado = worksheet.getRow(1);
        filaEncabezado.eachCell(celda => {
            celda.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            celda.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Arial' };
            celda.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        filaEncabezado.height = 20;

        // Congelar la fila de encabezado
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        // Generar el archivo y descargarlo
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const fecha = new Date().toISOString().split('T')[0];
        link.download = `polizas_${fecha}.xlsx`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        mostrarNotificacion(`Excel exportado: ${datos.length} pólizas`, 'success');

    } catch (error) {
        console.error('❌ Error al exportar:', error?.message);
        mostrarNotificacion('Error al exportar: ' + error.message, 'error');
    }
}

// ============================================
// BÚSQUEDA
// ============================================
// --- Normalización: texto sin acentos y en minúsculas; teléfonos/números solo dígitos ---
function _normalizarTexto(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function _soloDigitos(valor) {
    return String(valor ?? '').replace(/\D/g, '');
}

// Índice de búsqueda por póliza (se calcula una sola vez y se descarta con la póliza).
// WeakMap: no se guarda dentro del objeto, así no acaba en la caché de IndexedDB.
const _indiceBusqueda = new WeakMap();
function indiceBusquedaPoliza(poliza) {
    let ix = _indiceBusqueda.get(poliza);
    if (ix) return ix;
    const c = poliza.cliente || poliza.clientes || {};
    const nombres = c.nombres || '';
    const apellidos = c.apellidos || '';
    const campos = [
        poliza.numero_poliza,
        nombres,
        apellidos,
        `${nombres} ${apellidos}`,
        c.telefono1,
        c.telefono2,
        c.email,
        poliza.member_id,
        poliza.operador_nombre,
        c.operador_nombre,
        poliza.aplicantes,
        poliza.compania,
        poliza.plan,
        poliza.estado_mercado,
        poliza.agente35_estado,
        c.tipo_registro
    ];
    ix = {
        texto: _normalizarTexto(campos.map(v => v ?? '').join(' ')),
        // Dígitos por campo (separados por espacio para no mezclar campos distintos)
        digitos: [poliza.numero_poliza, c.telefono1, c.telefono2, poliza.member_id]
            .map(_soloDigitos).filter(Boolean).join(' ')
    };
    _indiceBusqueda.set(poliza, ix);
    return ix;
}

// Devuelve null si no hay término; si no, la lista de palabras ya normalizadas.
// Una palabra "numérica" (solo dígitos y separadores de teléfono) también se compara solo con dígitos.
function prepararBusqueda(termino) {
    const t = _normalizarTexto(termino);
    if (!t) return null;
    return t.split(/\s+/).filter(Boolean).map(tok => {
        const d = _soloDigitos(tok);
        return { tok, digitos: (d && /^[\d()+.\-]+$/.test(tok)) ? d : '' };
    });
}

function coincideBusqueda(poliza, tokens) {
    if (!tokens) return true;
    const ix = indiceBusquedaPoliza(poliza);
    return tokens.every(t => ix.texto.includes(t.tok) || (t.digitos !== '' && ix.digitos.includes(t.digitos)));
}

let _temporizadorBusqueda = null;

function configurarBusqueda() {
    const inputBusqueda = document.getElementById('searchInput');

    if (!inputBusqueda) {
        dbg.warn('⚠️ Input de búsqueda no encontrado');
        return;
    }

    const ejecutar = () => {
        clearTimeout(_temporizadorBusqueda);
        _temporizadorBusqueda = null;
        // Aún no hay datos: se aplicará al terminar la carga (ver cargarPolizas)
        // Aún no hay lista completa: búsqueda prioritaria en el servidor (límite 50) y, al terminar
        // la carga, se recalcula en local (ver cargarPolizas / instalarPolizas)
        if (!datosPolizasListos) {
            busquedaPendiente = true;
            terminoServidorActivo = !!inputBusqueda.value.trim();
            buscarPolizasEnServidor(inputBusqueda.value);
            return;
        }
        buscarPolizas(inputBusqueda.value);
    };

    // Mientras se escribe: debounce de 250 ms para no refiltrar 14.000 filas por tecla
    inputBusqueda.addEventListener('input', function() {
        if (!datosPolizasListos) busquedaPendiente = true;
        clearTimeout(_temporizadorBusqueda);
        _temporizadorBusqueda = setTimeout(ejecutar, 250);
    });

    // Enter: aplica la búsqueda ya, sin esperar el debounce, y evita enviar formularios
    inputBusqueda.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (!datosPolizasListos) busquedaPendiente = true;
        ejecutar();
    });
}

// La búsqueda es un filtro más de aplicarFiltrosAvanzados: así se combina con
// los avanzados y con año/renovación/firma (polizas_filtro_renovacion.js).
// El término se lee del input (#searchInput); el parámetro se conserva por compatibilidad.
function buscarPolizas(termino) {
    paginaActual = 1;
    if (typeof window.aplicarFiltrosAvanzados === 'function') {
        aplicandoSoloBusqueda = true;
        try { window.aplicarFiltrosAvanzados(); } finally { aplicandoSoloBusqueda = false; }
    }
    guardarFiltrosEnStorage();
}


// ============================================
// FILTROS
// ============================================
function cambiarFiltroEstado(modo) {
    modoFiltroEstado = modo;

    // document.getElementById('btnFiltroMercado').classList.toggle('active', modo === 'mercado');
    document.getElementById('btnFiltroCompania').classList.toggle('active', modo === 'compania');

    // Usar el sistema real de estadísticas
    const estadisticas = calcularEstadisticas(todasLasPolizas);
    actualizarTarjetas(estadisticas);
}

function filtrarPorEstado(estado) {
    const campo = modoFiltroEstado === 'compania' ? 'estado_compania' : 'estado_mercado';

    if (estado === 'Activas') {
        polizasFiltradas = todasLasPolizas.filter(p => p[campo] === 'Activo');
    } else if (estado === 'Canceladas') {
        const estadosCancelados = ['Cancelado', 'Robado', 'Cancelado a P.C', 'Doble póliza', 'Triple póliza', 'Inactivo'];
        polizasFiltradas = todasLasPolizas.filter(p => estadosCancelados.includes(p[campo]));
    } else if (estado === 'proximas') {
        polizasFiltradas = todasLasPolizas.filter(p => {
            if (!p.fecha_efectividad) return false;
            const hoy = new Date();
            const fechaEfectividad = new Date(p.fecha_efectividad);
            const diasDiferencia = Math.ceil((fechaEfectividad - hoy) / (1000 * 60 * 60 * 24));
            return diasDiferencia > 0 && diasDiferencia <= 30;
        });
    }

    hayFiltrosActivos = true
    paginaActual = 1;
    renderizarTabla();
    actualizarPaginacion();
    actualizarIndicadorFiltros();
}

function aplicarFiltros() {
    const checkbox2025 = document.getElementById('2025');
    const checkbox2026 = document.getElementById('2026');
    
    if (!checkbox2025 || !checkbox2026) {
        dbg.warn('⚠️ Checkboxes de filtro no encontrados');
        return;
    }
    
    const años = [];
    if (checkbox2025.checked) años.push('2025');
    if (checkbox2026.checked) años.push('2026');
    if (document.getElementById('2027')?.checked) años.push('2027');
    
    if (años.length === 0) {
        polizasFiltradas = todasLasPolizas;
    } else {
        polizasFiltradas = todasLasPolizas.filter(poliza => {
            if (poliza.cliente?.archivado === true) return false;
            if (!poliza.fecha_efectividad) return false;
            const año = String(poliza.fecha_efectividad).slice(0, 4);
            return años.includes(año);
        });
    }
    
    filtroAnioActivado = true;
    paginaActual = 1;
    renderizarTabla();
    actualizarPaginacion();
    guardarFiltrosEnStorage();

}

// ============================================
// ESTADÍSTICAS
// ============================================
// function actualizarEstadisticasTarjetas(polizas) {
//     const campo = modoFiltroEstado === 'compania' ? 'estado_compania' : 'estado_mercado';
//     const activas = polizas.filter(p => p[campo] === 'Activo').length;
//     const canceladas = polizas.filter(p => {
//         const estadosCancelados = ['Cancelado', 'Robado', 'Cancelado a P.C', 'Doble póliza', 'Triple póliza', 'cancelado'];
//         return estadosCancelados.includes(p[campo]);
//     }).length;
//     const proximas = polizas.filter(p => {
//         if (!p.fecha_efectividad) return false;
//         const hoy = new Date();
//         const fechaEfectividad = new Date(p.fecha_efectividad);
//         const diasDiferencia = Math.ceil((fechaEfectividad - hoy) / (1000 * 60 * 60 * 24));
//         return diasDiferencia > 0 && diasDiferencia <= 30;
//     }).length;
    
//     const elementoActivas = document.getElementById('polizasActivas');
//     const elementoCanceladas = document.getElementById('polizasCanceladas');
//     const elementoProximas = document.getElementById('polizasProximas');
    
//     if (elementoActivas) elementoActivas.textContent = activas;
//     if (elementoCanceladas) elementoCanceladas.textContent = canceladas;
//     if (elementoProximas) elementoProximas.textContent = proximas;
// }

function calcularTotales(polizas) {
    const totalPolizas = polizas.length;
    
    // Inicializamos contadores
    let activas = 0;
    let canceladas = 0;

    polizas.forEach(poliza => {
        // Contar por estado (ajusta los nombres 'Procesado' o 'Cancelado' según tu BD)
        const estado = poliza.agente35_estado ? poliza.agente35_estado.toLowerCase() : '';
        
        if (estado === 'procesado') {
            activas++;
        } else if (estado === 'cancelado' || estado === 'terminated') {
            canceladas++;
        }
    });

    return { totalPolizas, totalAplicantes, activas, canceladas };
}

function actualizarEstadisticas(totales) {
    const elementoActivas = document.getElementById('polizas-activas');
    if (elementoActivas) {
        elementoActivas.textContent = `${totales.activas} ${totales.activas === 1 ? 'Póliza' : 'Pólizas'}`;
    }

    const elementoCanceladas = document.getElementById('polizas-canceladas');
    if (elementoCanceladas) {
        elementoCanceladas.textContent = `${totales.canceladas} ${totales.canceladas === 1 ? 'Póliza' : 'Pólizas'}`;
    }
}

function actualizarContadoresEstados(polizas) {
    let activas = 0;
    let canceladas = 0;

    polizas.forEach(poliza => {
        // Normalizamos el texto para evitar errores de mayúsculas
        const estado = (poliza.estado_mercado || "").toLowerCase();
        
        if (estado === 'activo') {
            activas++;
        } else if (estado === 'cancelado' || estado === 'robado' || estado === 'Cancelado a P.C' || estado === 'Inactivo') {
            canceladas++;
        }
    });

    // Actualizar el DOM
    const elActivas = document.getElementById('polizasActivas');
    const elCanceladas = document.getElementById('polizasCanceladas');

    if (elActivas) elActivas.textContent = `${activas}`;
    if (elCanceladas) elCanceladas.textContent = `${canceladas}`;
}

function actualizarIndicadoresRol() {
    const tarjetas = document.querySelectorAll('.inf__cuadro');

    tarjetas.forEach(tarjeta => {
        // Buscar si ya tiene indicador
        let indicador = tarjeta.querySelector('.indicador-rol');

        // Si no es admin, adgregar indicador
       if (!tienePermiso('ver_todos_clientes')) {
            if (!indicador) {
                indicador = document.createElement('small');
                indicador.className = 'indicador-rol';
                indicador.style.cssText = `
                    display: block;
                    font-size: 0.75rem;
                    color: #64748b;
                    margin-top: 4px;
                    font-style: italic;
                `;
                indicador.textContent = `(Solo tus pólizas)`

                // Ìnsertar despues del <p>
                const p = tarjeta.querySelector('p');
                if (p) {
                    p.after(indicador)
                }
            }
        } else {
            if (indicador) {
                indicador.remove()
            }
        }
    })
}

function calcularEstadisticas(polizas) {
    let activas = 0;
    let canceladas = 0;
    let proximas = 0;
    
    const hoy = new Date();

    // Usar campo según modo activo
    const campo = modoFiltroEstado === 'compania' ? 'estado_compania' : 'estado_mercado';
    
    polizas.forEach(poliza => {
        const estadoValor = (poliza[campo] || '').toLowerCase();
        
        if (estadoValor === 'activo') {
            activas++;
        }
        
        if (['cancelado', 'robado', 'cancelado a p.c', 'doble póliza', 'triple póliza', 'inactivo'].includes(estadoValor)) {
            canceladas++;
        }
        
        if (poliza.fecha_efectividad) {
            const fechaEfectividad = new Date(poliza.fecha_efectividad);
            const diasDiferencia = Math.ceil((fechaEfectividad - hoy) / (1000 * 60 * 60 * 24));
            
            if (diasDiferencia > 0 && diasDiferencia <= 30) {
                proximas++;
            }
        }
    });
    
    return { activas, canceladas, proximas };
}

function actualizarTarjetas(estadisticas) {
    const elActivas = document.getElementById('polizasActivas');
    if (elActivas) {
        elActivas.textContent = estadisticas.activas;
    } else {
        dbg.warn('⚠️ Elemento polizasActivas no encontrado');
    }
    
    const elCanceladas = document.getElementById('polizasCanceladas');
    if (elCanceladas) {
        elCanceladas.textContent = estadisticas.canceladas;
    } else {
        dbg.warn('⚠️ Elemento polizasCanceladas no encontrado');
    }
    
    const elProximas = document.getElementById('polizasProximas');
    if (elProximas) {
        elProximas.textContent = estadisticas.proximas;
    } else {
        dbg.warn('⚠️ Elemento polizasProximas no encontrado');
    }
    
    ;
}

// ============================================
// FORMATEAR FECHA - FORMATO USA (MM/DD/YYYY)
// ============================================

function formatearFecha(fecha) {
    if (!fecha) return '-';
    
    // Extraer solo la parte de fecha (YYYY-MM-DD)
    const fechaStr = fecha.split('T')[0];
    const [year, month, day] = fechaStr.split('-');
    
    // Retornar en formato MM/DD/YYYY (USA)
    return `${month}/${day}/${year}`;
}

// Formatear fecha con hora - FORMATO USA (MM/DD/YYYY HH:MM)
function formatearFechaHora(fecha) {
    if (!fecha) return '-';
    
    const date = new Date(fecha);
    
    // Extraer componentes
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    const anio = date.getFullYear();
    const hora = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    
    // Formato MM/DD/YYYY HH:MM
    return `${mes}/${dia}/${anio} ${hora}:${minutos}`;
}

// Formatear fecha solo con mes y día corto (opcional)
function formatearFechaCorta(fecha) {
    if (!fecha) return '-';
    
    const date = new Date(fecha);
    const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const mes = meses[date.getMonth()];
    const dia = date.getDate();
    const anio = date.getFullYear();
    
    // Formato: Jan 5, 2026
    return `${mes} ${dia}, ${anio}`;
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
        console.error('Error al formatear fecha:', error?.message);
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
        console.error('Error al formatear fecha:', error?.message);
        return '';
    }
}

function obtenerBadgeEstado(estado) {
    const estados = {
        'activo': '<span class="badge-estado activo">Activo</span>',
        'cancelado': '<span class="badge-estado cancelado">Cancelado</span>',
        'canceladoPc': '<span class="badge-estado cancelado a P.C">Cancelado a P.C</span>',
        'pendiente': '<span class="badge-estado pendiente">Pendiente</span>',
        'proxima': '<span class="badge-estado proxima">Próxima</span>',
    };
    
    return estados[estado.toLowerCase()] || '<span class="badge-estado">Sin estado</span>';
}

// Skeleton con onda lavanda mientras llega el primer bloque (estilos en css/polizas.css)
function mostrarIndicadorCarga(mostrar) {
    const tbody = document.getElementById('tabla-polizas');
    if (!tbody) return;
    
    if (mostrar) {
        _filasPaginaActual = new Map();
        _idsPaginaPintada = new Set();
        tbody.innerHTML = Array.from({ length: 8 }, () => `
            <tr class="skeleton-fila">
                <td colspan="32"><div class="skeleton-barra"></div></td>
            </tr>
        `).join('');
    }
}

function mostrarError(mensaje) {
    const tbody = document.getElementById('tabla-polizas');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="23" style="text-align: center; padding: 40px;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; color: #ef4444;">
                    <span class="material-symbols-rounded" style="font-size: 48px;">error</span>
                    <p style="font-size: 1.1rem; margin: 0;">${mensaje}</p>
                    <button onclick="cargarPolizas()" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Reintentar
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function mostrarNotificacion(mensaje, tipo) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${tipo === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
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
// ESTILOS ADICIONALES
// ============================================
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    
    .badge-estado {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 600;
        display: inline-block;
    }
    
    .badge-estado.activo {
        background: rgba(76, 175, 80, 0.1);
        color: #4caf50;
    }

    .badge-estado.CanceladoPc {
        background: #700;
        color: #222;
    }
    
    .badge-estado.Cancelado {
        background: rgb(255, 191, 179, 0.8);
        color: #222;
    }

    .badge-estado.pendiente {
        background: rgba(255, 152, 0, 0.1);
        color: #ff9800;
    }
    
    .badge-estado.proxima {
        background: rgba(33, 150, 243, 0.1);
        color: #2196f3;
    }

    .badge-estado.Robado {
        background: rgb(255, 191, 179, 0.8);
        color: #222;
    }
    
    .badge-estado.Doble Poliza {
        background: rgb(255, 191, 179, 0.8);
        color: #222;
    }
    
    /* Modal */
    #modalDetalles {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.2s ease;
    }
    
    .modal-content {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 900px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px 30px;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .modal-header h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        color: #1e293b;
    }
    
    .btn-close-modal {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        transition: background 0.2s;
    }
    
    .btn-close-modal:hover {
        background: #f1f5f9;
    }
    
    .modal-body {
        padding: 30px;
    }
    
    .detalle-seccion {
        margin-bottom: 30px;
    }
    
    .detalle-seccion h3 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
        color: #1e293b;
        font-size: 1.1rem;
    }
    
    .detalle-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
    }
    
    .detalle-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    
    .detalle-item.full-width {
        grid-column: 1 / -1;
    }
    
    .detalle-item label {
        font-size: 0.85rem;
        color: #64748b;
        font-weight: 500;
    }
    
    .detalle-item p {
        margin: 0;
        color: #1e293b;
        font-size: 0.95rem;
    }
    
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 20px 30px;
        border-top: 1px solid #e5e7eb;
    }
    
    .btn-primary, .btn-secondary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    }
    
    .btn-primary {
        background: #6366f1;
        color: white;
    }
    
    .btn-primary:hover {
        background: #5558e3;
    }
    
    .btn-secondary {
        background: #f1f5f9;
        color: #475569;
    }
    
    .btn-secondary:hover {
        background: #e2e8f0;
    }
    
    @media (max-width: 768px) {
        .detalle-grid {
            grid-template-columns: 1fr;
        }
        
        .modal-content {
            width: 95%;
            max-height: 95vh;
        }
    }

        @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    #indicadorFiltrosActivos button:hover {
        background: rgba(255,255,255,0.3);
    }
`;
document.head.appendChild(style);

// ============================================
// NAVEGACIÓN
// ============================================
function crearNuevaPoliza() {
    window.location.href = './cliente_crear.html';
}

// ============================================
// MENÚ DE USUARIO
// ============================================

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('active');
}

// Cerrar menú al hacer click fuera
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');
    
    if (dropdown && userMenu && !userMenu.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

async function cerrarSesion() {
    const confirmacion = confirm('¿Estás seguro de que deseas cerrar sesión?');
    
    if (!confirmacion) return;
    
    try {
        // Cerrar sesión en Supabase
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) throw error;
        
        // Invalidar la caché local de pólizas (IndexedDB)
        borrarCachePolizas();

        // Limpiar localStorage
        localStorage.clear();
        
        // Redirigir al login
        window.location.href = '../index.html';
        
    } catch (error) {
        console.error('Error al cerrar sesión:', error?.message);
        alert('Error al cerrar sesión: ' + error.message);
    }
}

// Cargar información del usuario
async function cargarInfoUsuario() {
    try {
        // Obtener usuario autenticado
        const { data: { session } } = await supabaseClient.auth.getSession();
        const user = session?.user;
                
        if (!user) {
            dbg.warn('⚠️ No hay usuario autenticado');
            // Redirigir al login si no hay usuario
            window.location.href = '../index.html';
            return;
        }
        
        ;
        
        // Extraer información del usuario
        const email = user.email || 'usuario@ejemplo.com';
        const metadata = user.user_metadata || {};
        
        // Intentar obtener el nombre de diferentes fuentes
        let nombreCompleto = metadata.full_name || 
                            metadata.name || 
                            metadata.display_name ||
                            email.split('@')[0];
        
        // Si el nombre tiene formato "nombre apellido", tomar solo el primer nombre
        const primerNombre = nombreCompleto.split(' ')[0];
        
        // Actualizar elementos del DOM
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.querySelector('.user-avatar');
        
        if (userName) {
            userName.textContent = primerNombre;
        }
        
        if (userEmail) {
            userEmail.textContent = email;
        }
        
        // Actualizar avatar
        if (userAvatar) {
            // Si el usuario tiene foto de perfil en metadata
            if (metadata.avatar_url || metadata.picture) {
                userAvatar.src = metadata.avatar_url || metadata.picture;
            } else {
                // Generar avatar con iniciales
                const iniciales = obtenerIniciales(nombreCompleto);
                const colorFondo = generarColorDesdeTexto(email);
                userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(iniciales)}&background=${colorFondo}&color=fff&size=80&bold=true`;
            }
            
            userAvatar.alt = nombreCompleto;
        }
        
        ;
        
    } catch (error) {
        console.error('❌ Error al cargar info de usuario:', error?.message);
        // No redirigir si es solo un error de carga
    }
}

// Obtener iniciales del nombre
function obtenerIniciales(nombre) {
    if (!nombre) return 'U';
    
    const palabras = nombre.trim().split(' ').filter(p => p.length > 0);
    
    if (palabras.length === 0) return 'U';
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    
    // Tomar primera letra de primer y último nombre
    return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

// Generar color consistente desde un texto (para el avatar)
function generarColorDesdeTexto(texto) {
    if (!texto) return '667eea';
    
    // Lista de colores agradables
    const colores = [
        '667eea', // Morado
        '764ba2', // Morado oscuro
        'f093fb', // Rosa
        '4facfe', // Azul claro
        '43e97b', // Verde
        'fa709a', // Rosa fuerte
        'fee140', // Amarillo
        '30cfd0', // Turquesa
        'a8edea', // Menta
        'ff6b6b'  // Rojo suave
    ];
    
    // Generar hash simple del texto
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
        hash = texto.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Seleccionar color basado en el hash
    const index = Math.abs(hash) % colores.length;
    return colores[index];
}

document.addEventListener('DOMContentLoaded', async function() {
    // Configuraciones síncronas
    configurarBusqueda();
    configurarPaginacion();
    configurarOrdenamiento();
    configurarModal();
    cargarInfoUsuario();

    // Primero poblar checkboxes, luego cargar pólizas
    await cargarRolUsuario();
    await cargarDatosOperador();
    await cargarPolizas();
});

// ============================================
// MODAL DE FILTROS AVANZADOS
// ============================================

function abrirModalFiltros() {
    const modal = document.getElementById('modalFiltros');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function cerrarModalFiltros() {
    const modal = document.getElementById('modalFiltros');
    if (modal) {
        modal.style.display = 'none';
    }
}

function limpiarFiltros() {
    ;
    
    //  Resetear estado de filtros
    filtrosActivos = null;
    hayFiltrosActivos = false;
    filtroAnioActivado = false;
    idsCumpleanosActivos = null;


    // Limpiar todos los campos
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroApellido').value = '';
    document.getElementById('filtroTelefono').value = '';
    filtroEstadoMigratorio.limpiar();
    document.getElementById('filtroTieneSsn').value = '';
    document.getElementById('filtroTieneMetodoPago').value = '';
    document.getElementById('filtroTienePagoAutomatico').value = '';
    document.querySelectorAll('#panelCompanias input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    actualizarTextoCompanias();
    document.querySelectorAll('#panelTipoVentas input[type="checkbox"]').forEach(cb => {
        cb.checked = false
    });
    actualizarTextoTipoVentas();
    document.querySelectorAll('#panelOperadores input[type="checkbox"]').forEach(cb => cb.checked = false);
    actualizarTextoOperadores();
    document.querySelectorAll('#panelVentaRealizadaPor input[type="checkbox"]').forEach(cb => cb.checked = false);
    actualizarTextoVentaRealizadaPor();
    filtroModificadoPor.limpiar();
    filtroAgenteMercado.limpiar();
    filtroPortalAvanzado.limpiar();
    filtroNacionalidad.limpiar();
    filtroAgenteCliente.limpiar();
    filtroMesPagado.limpiar();
    limpiarEstadoMercado();
    limpiarEstadoCompania();
    filtroEstado.limpiar();
    filtroEstadoAgente35.limpiar();
    document.getElementById('nullPlazoDocumentos').checked = false;
    document.getElementById('nullFechaEfectividad').checked = false;
    document.getElementById('nullInicioCobertura').checked = false;
    document.getElementById('nullRevisionMercado').checked = false;
    document.getElementById('nullFechRevCompania').checked = false;
    document.getElementById('nullFechaPago').checked = false;
    document.getElementById('nullFechaSeguimiento').checked = false;
    document.getElementById('filtroPrima').value = '';
    filtroTipoModificacion.limpiar();
    filtroDocumentos.limpiar();
    document.getElementById('searchInput').value = '';
    
    // Limpiar fechas
    document.getElementById('filtroFechaEfectividadDesde').value = '';
    document.getElementById('filtroFechaEfectividadHasta').value = '';
    document.getElementById('filtroFechaCoberturaInicialDesde').value = '';
    document.getElementById('filtroFechaCoberturaInicialHasta').value = '';
    document.getElementById('filtroFechaRevisionMercadoDesde').value = '';
    document.getElementById('filtroFechaRevisionMercadoHasta').value = '';
    document.getElementById('filtroFechaRevisionCompaniaDesde').value = '';
    document.getElementById('filtroFechaRevisionCompaniaHasta').value = '';
    document.getElementById('filtroFechaUltimoPagoDesde').value = '';
    document.getElementById('filtroFechaUltimoPagoHasta').value = '';
    document.getElementById('filtroSeguimientoDesde').value = '';
    document.getElementById('filtroSeguimientoHasta').value = '';
    document.getElementById('filtroSeguimientoEfectivo').value = '';
    const selRenovacion = document.getElementById('filtroEstadoRenovacion');
    if (selRenovacion) selRenovacion.value = '';
    document.getElementById('filtroFechaPlazoDocumentosDesde').value = '';
    document.getElementById('filtroFechaPlazoDocumentosHasta').value = '';
    document.getElementById('filtroModificacionDesde').value = '',
    document.getElementById('filtroModificacionHasta').value = '',
    document.getElementById('filtroCreacionDesde').value = '',
    document.getElementById('filtroCreacionHasta').value = '',
    
    //  Restaurar todas las pólizas
    polizasFiltradas = todasLasPolizas;
    paginaActual = 1;
    
    renderizarTabla();
    actualizarPaginacion();
    
    //  Actualizar indicador visual
    actualizarIndicadorFiltros();

    // Borrar filtros guardados en localStorage
    eliminarFiltrosDeStorage();
    
    ;
}

// ============================================
// DROPDOWN DE COMPAÑÍAS
// ============================================

function toggleDropdownCompanias(event) {
    event.stopPropagation();
    const panel = document.getElementById('panelCompanias');
    const trigger = document.getElementById('triggerCompanias');
    
    panel.classList.toggle('active');
    trigger.classList.toggle('active');
}

function cerrarDropdownCompanias() {
    const panel = document.getElementById('panelCompanias');
    const trigger = document.getElementById('triggerCompanias');
    
    panel.classList.remove('active');
    trigger.classList.remove('active');
}

function actualizarTextoCompanias() {
    const checkboxes = document.querySelectorAll('#panelCompanias input[type="checkbox"]:checked');
    const texto = document.getElementById('textoCompanias');
    
    if (checkboxes.length === 0) {
        texto.textContent = 'Seleccionar compañías...';
        texto.style.color = '#94a3b8';
    } else if (checkboxes.length === 1) {
        texto.textContent = checkboxes[0].value;
        texto.style.color = '#1e293b';
    } else {
        texto.textContent = `${checkboxes.length} compañías seleccionadas`;
        texto.style.color = '#6366f1';
    }
}

function limpiarCompanias() {
    document.querySelectorAll('#panelCompanias input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    actualizarTextoCompanias();
}

function filtrarCompanias() {
    const busqueda = document.getElementById('buscarCompania').value.toLowerCase();
    const items = document.querySelectorAll('#panelCompanias .checkbox-item');
    
    items.forEach(item => {
        const texto = item.textContent.toLowerCase();
        if (texto.includes(busqueda)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', function(event) {
    const panel = document.getElementById('panelCompanias');
    const trigger = document.getElementById('triggerCompanias');
    
    if (panel && trigger && 
        !panel.contains(event.target) && 
        !trigger.contains(event.target)) {
        cerrarDropdownCompanias();
    }
});

// Actualizar texto cuando cambia un checkbox
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que el DOM cargue
    setTimeout(() => {
        const checkboxes = document.querySelectorAll('#panelCompanias input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', actualizarTextoCompanias);
        });
        
        // Actualizar al cargar por si hay filtros guardados
        actualizarTextoCompanias();
    }, 100);
});

// ============================================
// DROPDOWN TIPO DE VENTAS
// ============================================

function toggleDropdownTipoVentas(event) {
    event.stopPropagation();
    const panel = document.getElementById('panelTipoVentas');
    const trigger = document.getElementById('triggerTipoVentas');
    
    panel.classList.toggle('active');
    trigger.classList.toggle('active');
}

function cerrarDropdownTipoVentas() {
    const panel = document.getElementById('panelTipoVentas');
    const trigger = document.getElementById('triggerTipoVentas');
    
    panel.classList.remove('active');
    trigger.classList.remove('active');
}

function actualizarTextoTipoVentas() {
    const checkboxes = document.querySelectorAll('#panelTipoVentas input[type="checkbox"]:checked');
    const texto = document.getElementById('textoTipoVentas');
    
    if (checkboxes.length === 0) {
        texto.textContent = 'Seleccionar tipo de venta...';
        texto.style.color = '#94a3b8';
    } else if (checkboxes.length === 1) {
        texto.textContent = checkboxes[0].value;
        texto.style.color = '#1e293b';
    } else {
        texto.textContent = `${checkboxes.length} tipos seleccionados`;
        texto.style.color = '#6366f1';
    }
}

function limpiarTipoVentas() {
    document.querySelectorAll('#panelTipoVentas input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    actualizarTextoTipoVentas();
}

function filtrarTipoVentas() {
    const busqueda = document.getElementById('buscarTipoVentas').value.toLowerCase();
    const items = document.querySelectorAll('#panelTipoVentas .checkbox-item');
    
    items.forEach(item => {
        const texto = item.textContent.toLowerCase();
        if (texto.includes(busqueda)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', function(event) {
    const panel = document.getElementById('panelTipoVentas');
    const trigger = document.getElementById('triggerTipoVentas');
    
    if (panel && trigger && 
        !panel.contains(event.target) && 
        !trigger.contains(event.target)) {
        cerrarDropdownTipoVentas();
    }
});

// Actualizar texto cuando cambia un checkbox
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que el DOM cargue
    setTimeout(() => {
        const checkboxes = document.querySelectorAll('#panelTipoVentas input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', actualizarTextoTipoVentas);
        });
        
        // Actualizar al cargar por si hay filtros guardados
        actualizarTextoTipoVentas();
    }, 100);
});

function actualizarIndicadorFiltros() {
    // Buscar o crear indicador
    let indicador = document.getElementById('indicadorFiltrosActivos');
    
    if (!indicador) {
        // Crear indicador si no existe
        indicador = document.createElement('div');
        indicador.id = 'indicadorFiltrosActivos';
        indicador.style.cssText = `
            display: none;
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: #6366f1;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            z-index: 2;
            font-size: 0.9rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideInRight 0.3s ease;
        `;
        
        indicador.innerHTML = `
            <span class="material-symbols-rounded" style="font-size: 20px;">filter_alt</span>
            <span>Filtros activos: <strong id="contadorResultados">0</strong></span>
            <button onclick="limpiarFiltros()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.85rem;
                margin-left: 8px;
            ">
                Limpiar
            </button>
        `;
        
        document.body.appendChild(indicador);
    }
    
    const contadorResultados = document.getElementById('contadorResultados');
    
    if (hayFiltrosActivos) {
        indicador.style.display = 'flex';
        if (contadorResultados) {
            contadorResultados.textContent = `${polizasFiltradas.length}/${todasLasPolizas.length}`;
        }
    } else {
        indicador.style.display = 'none';
    }
}

function aplicarFiltrosAvanzados() {
    ;
    
    // Obtener y GUARDAR valores de filtros
    filtrosActivos = {
        nombre: document.getElementById('filtroNombre').value.toLowerCase(),
        apellido: document.getElementById('filtroApellido').value.toLowerCase(),
        telefono: document.getElementById('filtroTelefono').value.toLowerCase(),
        estadoMigratorio: filtroEstadoMigratorio.getSeleccionados(),
        tieneSsn: document.getElementById('filtroTieneSsn').value,
        tieneMetodoPago: document.getElementById('filtroTieneMetodoPago').value,
        tienePagoAutomatico: document.getElementById('filtroTienePagoAutomatico').value,
        companias: Array.from(document.querySelectorAll('#panelCompanias input:checked')).map(cb => cb.value),
        prima: document.getElementById('filtroPrima').value,
        filtroTipoModificacion: filtroTipoModificacion.getSeleccionados(),
        tiposVenta: Array.from(document.querySelectorAll('#panelTipoVentas input:checked')).map(cb => cb.value),
        operadores: Array.from(document.querySelectorAll('#panelOperadores input:checked')).map(cb => cb.value),
        ventaRealizadaPor: Array.from(document.querySelectorAll('#panelVentaRealizadaPor input:checked')).map(cb => cb.value),
        mesPagado: filtroMesPagado.getSeleccionados(),
        modificadoPor: filtroModificadoPor.getSeleccionados(),
        documentos: filtroDocumentos.getSeleccionados(),
        filtroAgenteMercado: filtroAgenteMercado.getSeleccionados(),
        portal: filtroPortalAvanzado.getSeleccionados(),
        nacionalidad: filtroNacionalidad.getSeleccionados(),
        filtroAgenteCliente: filtroAgenteCliente.getSeleccionados(),
        estadoMercado:  Array.from(document.querySelectorAll('#panelEstadoMercado input:checked')).map(cb => cb.value),
        estadoCompania: Array.from(document.querySelectorAll('#panelEstadoCompania input:checked')).map(cb => cb.value),
        estado: filtroEstado.getSeleccionados(),
        estadoAgente35: filtroEstadoAgente35.getSeleccionados(),
        nullPlazoDocumentos: document.getElementById('nullPlazoDocumentos').checked,
        nullFechaEfectividad: document.getElementById('nullFechaEfectividad').checked,
        nullInicioCobertura: document.getElementById('nullInicioCobertura').checked,
        nullRevisionMercado: document.getElementById('nullRevisionMercado').checked,
        nullFechRevCompania: document.getElementById('nullFechRevCompania').checked,
        nullFechaPago: document.getElementById('nullFechaPago').checked,
        nullFechaSeguimiento: document.getElementById('nullFechaSeguimiento').checked,
        fechaEfectividadDesde: document.getElementById('filtroFechaEfectividadDesde').value,
        fechaEfectividadHasta: document.getElementById('filtroFechaEfectividadHasta').value,
        fechaCoberturaInicialDesde: document.getElementById('filtroFechaCoberturaInicialDesde').value,
        fechaCoberturaInicialHasta: document.getElementById('filtroFechaCoberturaInicialHasta').value,
        fechaRevisionMercadoDesde: document.getElementById('filtroFechaRevisionMercadoDesde').value,
        fechaRevisionMercadoHasta: document.getElementById('filtroFechaRevisionMercadoHasta').value,
        fechaRevisionCompaniaDesde: document.getElementById('filtroFechaRevisionCompaniaDesde').value,
        fechaRevisionCompaniaHasta: document.getElementById('filtroFechaRevisionCompaniaHasta').value,
        fechaUltimoPagoDesde: document.getElementById('filtroFechaUltimoPagoDesde').value,
        fechaUltimoPagoHasta: document.getElementById('filtroFechaUltimoPagoHasta').value,
        fechaSeguimientoDesde: document.getElementById('filtroSeguimientoDesde').value,
        fechaSeguimientoHasta: document.getElementById('filtroSeguimientoHasta').value,
        seguimientoEfectivo: document.getElementById('filtroSeguimientoEfectivo').value,
        estadoRenovacion: document.getElementById('filtroEstadoRenovacion')?.value || '',
        plazoDocumentosDesde: document.getElementById('filtroFechaPlazoDocumentosDesde').value,
        plazoDocumentosHasta: document.getElementById('filtroFechaPlazoDocumentosHasta').value,
        filtroModificacionDesde: document.getElementById('filtroModificacionDesde').value,
        filtroModificacionHasta: document.getElementById('filtroModificacionHasta').value,
        filtroCreacionDesde: document.getElementById('filtroCreacionDesde').value,
        filtroCreacionHasta: document.getElementById('filtroCreacionHasta').value,
    };
    
    //  Verificar si hay algún filtro activo
    hayFiltrosActivos = Object.values(filtrosActivos).some(valor => valor !== '' && valor !== null);
    
    // Búsqueda rápida (#searchInput): se combina con el resto de filtros
    const tokensBusqueda = prepararBusqueda(document.getElementById('searchInput')?.value);

    // Filtrar pólizas
    polizasFiltradas = todasLasPolizas.filter(poliza => {
        if (poliza.cliente?.archivado === true) return false;
        if (!coincideBusqueda(poliza, tokensBusqueda)) return false;
        const cliente = poliza.cliente || {};
        
        // Filtro por nombre
        if (filtrosActivos.nombre && !cliente.nombres?.toLowerCase().includes(filtrosActivos.nombre)) {
            return false;
        }
        
        // Filtro por apellido
        if (filtrosActivos.apellido && !cliente.apellidos?.toLowerCase().includes(filtrosActivos.apellido)) {
            return false;
        }
        
        // Filtro por teléfono
        if (filtrosActivos.telefono && !cliente.telefono1?.toLowerCase().includes(filtrosActivos.telefono)) {
            return false;
        }
        
        // Filtro por estado migratorio
        if (filtrosActivos.estadoMigratorio?.length > 0 && !filtrosActivos.estadoMigratorio.includes(cliente.estado_migratorio)) {
            return false;
        }
        
        // Filtro ssn
        if (filtrosActivos.tieneSsn && cliente.tiene_social !== filtrosActivos.tieneSsn) {
            return false;
        }

        // Filtro por método de pago
        if (filtrosActivos.tieneMetodoPago) {
            const metodosPago = cliente.metodos_pago;
            const metodoPrincipal = obtenerMetodoPrincipal(cliente);

            if (filtrosActivos.tieneMetodoPago === 'Si') {
                // Tiene método confirmado: debe tener registro Y tiene_metodo_pago = 'Si'
                if (!metodoPrincipal || metodoPrincipal.tiene_metodo_pago !== 'Si') {
                    return false;
                }
            }
            
            if (filtrosActivos.tieneMetodoPago === 'No') {
                // NO tiene método: sin registro O registro con 'No'
                const tieneRegistro = metodosPago && metodosPago.length > 0;
                const esNo = tieneRegistro && metodoPrincipal?.tiene_metodo_pago === 'No';
                const sinRegistro = !tieneRegistro;
                
                // Si NO cumple ninguna de las dos condiciones, descarta
                if (!esNo && !sinRegistro) {
                    return false;
                }
            }
        }

        if (filtrosActivos.tienePagoAutomatico) {
            const valorCliente = obtenerMetodoPrincipal(poliza.cliente)?.tiene_pago_automatico || 'No';
            if (valorCliente !== filtrosActivos.tienePagoAutomatico) return false;
        }

        // Filtro por compañía
        if (filtrosActivos.companias && filtrosActivos.companias.length > 0) {
            if (!filtrosActivos.companias.includes(poliza.compania)) {
                return false;
            }
        }

        if (filtrosActivos.documentos?.length > 0) {
            const estadoDoc = (poliza.estado_documentos || '');
            if (!filtrosActivos.documentos.includes(estadoDoc)) {
                return false;
            }
        }

        // Filtro por seguimiento efectivo
        if (filtrosActivos.seguimientoEfectivo) {
            if (!poliza.seguimientos || poliza.seguimientos.length === 0) {
                return false;
            }

            const seguimientoEfectivoPoliza = seguimientoEfectivo120(poliza);

            if (seguimientoEfectivoPoliza !== filtrosActivos.seguimientoEfectivo) {
                return false;
            }
        }

        if (!cumpleFiltroRenovacion(poliza, filtrosActivos.estadoRenovacion)) return false;

        if (filtrosActivos.filtroTipoModificacion?.length > 0 && !filtrosActivos.filtroTipoModificacion.includes(cliente.tipo_modificacion)) {
            return false
        }

        if (filtrosActivos.prima) {
            const prima = parseFloat(poliza.prima) || 0;
            
            switch (filtrosActivos.prima) {
                case 'cero':
                    if (prima !== 0) return false;
                    break;
                case 'conPrima':
                    if (prima <= 0) return false;
                    break;
                case 'menosD1Dolar':
                    if (prima <= 0 || prima >= 1) return false;
                    break;
                case 'alta':
                    if (prima <= 1) return false;
                    break;
                case 'sinAsignar':
                    if (poliza.prima !== null && poliza.prima !== '' && poliza.prima !== undefined) return false;
                    break;
            }
        }
        
        // Filtro por tipo de venta
        if (filtrosActivos.tiposVenta && filtrosActivos.tiposVenta.length > 0) {
            if (!filtrosActivos.tiposVenta.includes(cliente.tipo_registro)) {
                return false;
            }
        }
        
        // Filtro por operador (solo para admins)
        if (filtrosActivos.operadores?.length > 0 && !filtrosActivos.operadores.includes(poliza.operador_nombre)) {
            return false;
        }

        // Filtro por venta realizada por (solo para admins)
        if (filtrosActivos.ventaRealizadaPor?.length > 0 && !filtrosActivos.ventaRealizadaPor.includes(poliza.cliente?.venta_realizada_por)) {
            return false;
        }

        // Filtro por mes pagado
        if (filtrosActivos.mesPagado?.length > 0) {
            const mesesPagados = obtenerMesesPagadosAnioActual(poliza.cliente);
            if (!mesesPagados) return false;
            const cumple = filtrosActivos.mesPagado.some(mes => mesesPagados[mes] === 'Si');
            if (!cumple) return false;
        }

        // Filtro por quién modificó
        if (filtrosActivos.modificadoPor?.length > 0 && !filtrosActivos.modificadoPor.includes(poliza.modificado_por_nombre)) {
            return false;
        }

        // Filtro por portal
        if (filtrosActivos.portal?.length > 0 && !filtrosActivos.portal.includes(cliente.portal)) {
            return false;
        }

        // Filtro por nacionalidad (normalizada a país)
        if (filtrosActivos.nacionalidad?.length > 0 && !filtrosActivos.nacionalidad.includes(normalizarNacionalidad(cliente.nacionalidad))) {
            return false;
        }

        if (filtrosActivos.filtroAgenteCliente?.length > 0) {
            const esNull = filtrosActivos.filtroAgenteCliente.includes('__null__');
            const estaVacio = !cliente.agente_nombre || cliente.agente_nombre === '';
            const coincide = filtrosActivos.filtroAgenteCliente.includes(cliente.agente_nombre);
            if (!(coincide || (esNull && estaVacio))) return false;
        }
        
        // Filtro por estado mercado
        if (filtrosActivos.estadoMercado?.length > 0) {
            const esNull   = filtrosActivos.estadoMercado.includes('__null__');
            const estaVacio = !poliza.estado_mercado || poliza.estado_mercado === '';
            const coincide  = filtrosActivos.estadoMercado.includes(poliza.estado_mercado);
            if (!(coincide || (esNull && estaVacio))) return false;
        }

        if (filtrosActivos.filtroAgenteMercado?.length > 0) {
            const esNull = filtrosActivos.filtroAgenteMercado.includes('__null__');
            const estaVacio = !poliza.nombre_agente_mercado || poliza.nombre_agente_mercado === '';
            const coincide = filtrosActivos.filtroAgenteMercado.includes(poliza.nombre_agente_mercado);
            if (!(coincide || (esNull && estaVacio))) return false;
        }
        
        // Filtro por estado compañía
        if (filtrosActivos.estadoCompania?.length > 0) {
            const esNull   = filtrosActivos.estadoCompania.includes('__null__');
            const estaVacio = !poliza.estado_compania || poliza.estado_compania === '';
            const coincide  = filtrosActivos.estadoCompania.includes(poliza.estado_compania);
            if (!(coincide || (esNull && estaVacio))) return false;
        }

        // Filtro por estado
        if (filtrosActivos.estado?.length > 0 && !filtrosActivos.estado.includes(cliente.estado)) {
            return false;
        }

        // Filtro por estado en agente35
        if (filtrosActivos.estadoAgente35?.length > 0 && !filtrosActivos.estadoAgente35.includes(poliza.agente35_estado)) {
            return false;
        }
        
        // Filtros de fechas
        if (!filtrarPorRangoFecha(poliza.created_at, filtrosActivos.fechaRegistroDesde, filtrosActivos.fechaRegistroHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_efectividad, filtrosActivos.fechaEfectividadDesde, filtrosActivos.fechaEfectividadHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_inicial_cobertura, filtrosActivos.fechaCoberturaInicialDesde, filtrosActivos.fechaCoberturaInicialHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_revision_mercado, filtrosActivos.fechaRevisionMercadoDesde, filtrosActivos.fechaRevisionMercadoHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.fecha_revision_compania, filtrosActivos.fechaRevisionCompaniaDesde, filtrosActivos.fechaRevisionCompaniaHasta)) return false;
        if (!filtrarPorRangoFecha(poliza.pagado_hasta, filtrosActivos.fechaUltimoPagoDesde, filtrosActivos.fechaUltimoPagoHasta)) return false
        if (!filtrarPorRangoFecha(poliza.fecha_plazo_documentos, filtrosActivos.plazoDocumentosDesde, filtrosActivos.plazoDocumentosHasta)) return false
        if (!filtrarPorRangoFecha(poliza.updated_at, filtrosActivos.filtroModificacionDesde, filtrosActivos.filtroModificacionHasta)) return false
        if (!filtrarPorRangoFecha(poliza.created_at, filtrosActivos.filtroCreacionDesde, filtrosActivos.filtroCreacionHasta)) return false
        if (filtrosActivos.fechaSeguimientoDesde || filtrosActivos.fechaSeguimientoHasta) {

            if (!poliza.seguimientos || poliza.seguimientos.length === 0) {
                return false;
            }

            const fechas = poliza.seguimientos.map(seg => new Date(seg.fecha_seguimiento));
            const fechaMasReciente = new Date(Math.max(...fechas));

            if(!filtrarPorRangoFecha(fechaMasReciente, filtrosActivos.fechaSeguimientoDesde, filtrosActivos.fechaSeguimientoHasta)) {
                return false;
            }
        }
        
        // Filtros null
        if (filtrosActivos.nullPlazoDocumentos && poliza.fecha_plazo_documentos !== null) return false;
        if (filtrosActivos.nullFechaEfectividad && poliza.fecha_efectividad !== null) return false;
        if (filtrosActivos.nullInicioCobertura && poliza.fecha_inicial_cobertura !== null) return false;
        if (filtrosActivos.nullRevisionMercado && poliza.fecha_revision_mercado !== null) return false;
        if (filtrosActivos.nullFechRevCompania && poliza.fecha_revision_compania !== null) return false;
        if (filtrosActivos.nullFechaPago && poliza.pagado_hasta !== null) return false;
        if (filtrosActivos.nullFechaSeguimiento) {
            const tieneSeguimientos = poliza.seguimientos && poliza.seguimientos.length > 0
            if (tieneSeguimientos) {
                return false
            }
        };

        return true;
    });
    
    // Resetear paginación
    paginaActual = 1;
    
    // Renderizar
    renderizarTabla();
    actualizarPaginacion();
    
    //  Actualizar indicador visual
    actualizarIndicadorFiltros();
    
    // El modal solo se cierra con el botón "Aplicar" (ver pages/polizas.html)

    // Guardar filtros en localStorage para persistirlos
    guardarFiltrosEnStorage();

    // Guardar datos filtrados para gráficas (no al buscar: el buscador no es un filtro avanzado)
    if (!aplicandoSoloBusqueda) {
        try { sessionStorage.removeItem('graficas_data'); } catch (e) {}
        // Mostrar botón "Ver gráfica"
        document.getElementById('btnVerGrafica')?.style.setProperty('display', 'inline-flex');
    }
    
}


// Función auxiliar para filtrar por rango de fechas
function filtrarPorRangoFecha(fecha, desde, hasta) {
    if (!desde && !hasta) return true; // Sin filtro
    if (!fecha) return false; // No tiene fecha
    
    const fechaObj = new Date(fecha);
    
    if (desde) {
        const desdeObj = new Date(desde);
        if (fechaObj < desdeObj) return false;
    }
    
    if (hasta) {
        const hastaObj = new Date(hasta);
        hastaObj.setDate(hastaObj.getDate() + 1);
        if (fechaObj >= hastaObj) return false;
    }
    
    return true;
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(event) {
    const modal = document.getElementById('modalFiltros');
    if (modal && event.target === modal) {
        cerrarModalFiltros();
    }
});
// ============================================
// FUNCIÓN PARA BADGE DE AGENTE 3.5
// ============================================

/**
 * Obtener badge HTML para el estado de Agente 3.5
 */
function obtenerBadgeAgente35(estado) {
    if (!estado) {
        return '<span class="badge-agente35 sin-estado">Sin estado</span>';
    }
    
    const badges = {
        'New application': 'New application',
        'Policy change': 'Policy change',
        'Procesado': '<span class="badge-agente35 procesado">✓ Procesado</span>',
        'Pendiente': '<span class="badge-agente35 pendiente">⏳ Pendiente</span>',
        'Cambio necesario': '<span class="badge-agente35 cambio">⚠ Cambio necesario</span>',
        'Termination request': '<span class="badge-agente35 termination">Termination Request</span>',
        'Cancelado': '<span class="badge-agente35 cancelado">Cancelado</span>'
    };
    
    return badges[estado] || '<span class="badge-agente35 sin-estado">-</span>';
}

async function cargarDatosOperador() {
    const { data: operadores, error } = await supabaseClient
        .from('usuarios')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true });

    const lista = document.getElementById('listaOperadores');
    if (lista && operadores) {
        lista.innerHTML = operadores.map(op => `
            <label class="checkbox-item">
                <input type="checkbox" value="${op.nombre}" onchange="actualizarTextoOperadores();">
                <span>${op.nombre}</span>
            </label>
        `).join('');
    }

    const listaVenta = document.getElementById('listaVentaRealizadaPor');
    if (listaVenta && operadores) {
        listaVenta.innerHTML = operadores.map(op => `
            <label class="checkbox-item">
                <input type="checkbox" value="${op.nombre}" onchange="actualizarTextoVentaRealizadaPor();">
                <span>${op.nombre}</span>
            </label>
        `).join('');
    }
}

function filtrarOpcionesOperador() {
    const busqueda = document.getElementById('buscarOperador').value.toLowerCase();
    document.querySelectorAll('#panelOperadores .checkbox-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(busqueda) ? '' : 'none';
    });
}

function toggleDropdownOperadores(event) {
    event.stopPropagation();
    const panel = document.getElementById('panelOperadores');
    const trigger = document.getElementById('triggerOperadores');
    panel.classList.toggle('active');
    trigger.classList.toggle('active');
}

function cerrarDropdownOperadores() {
    const panel = document.getElementById('panelOperadores');
    const trigger = document.getElementById('triggerOperadores');
    if (panel) panel.classList.remove('active');
    if (trigger) trigger.classList.remove('active');
}

function actualizarTextoOperadores() {
    const checkboxes = document.querySelectorAll('#panelOperadores input[type="checkbox"]:checked');
    const texto = document.getElementById('textoOperadores');
    if (!texto) return;
    if (checkboxes.length === 0) {
        texto.textContent = 'Todos los operadores';
        texto.style.color = '#94a3b8';
    } else if (checkboxes.length === 1) {
        texto.textContent = checkboxes[0].value;
        texto.style.color = '#1e293b';
    } else {
        texto.textContent = `${checkboxes.length} operadores seleccionados`;
        texto.style.color = '#6366f1';
    }
}

// ============================================
// FILTRO VENTA REALIZADA POR
// ============================================

function toggleDropdownVentaRealizadaPor(event) {
    event.stopPropagation();
    const panel = document.getElementById('panelVentaRealizadaPor');
    const trigger = document.getElementById('triggerVentaRealizadaPor');
    panel.classList.toggle('active');
    trigger.classList.toggle('active');
}

function cerrarDropdownVentaRealizadaPor() {
    const panel = document.getElementById('panelVentaRealizadaPor');
    const trigger = document.getElementById('triggerVentaRealizadaPor');
    if (panel) panel.classList.remove('active');
    if (trigger) trigger.classList.remove('active');
}

function actualizarTextoVentaRealizadaPor() {
    const checkboxes = document.querySelectorAll('#panelVentaRealizadaPor input[type="checkbox"]:checked');
    const texto = document.getElementById('textoVentaRealizadaPor');
    if (!texto) return;
    if (checkboxes.length === 0) {
        texto.textContent = 'Todos los operadores';
        texto.style.color = '#94a3b8';
    } else if (checkboxes.length === 1) {
        texto.textContent = checkboxes[0].value;
        texto.style.color = '#1e293b';
    } else {
        texto.textContent = `${checkboxes.length} operadores seleccionados`;
        texto.style.color = '#6366f1';
    }
    guardarFiltrosEnStorage();
    aplicarFiltros();
}

function filtrarOpcionesVentaRealizadaPor() {
    const busqueda = document.getElementById('buscarVentaRealizadaPor').value.toLowerCase();
    document.querySelectorAll('#panelVentaRealizadaPor .checkbox-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(busqueda) ? 'flex' : 'none';
    });
}

// Cerrar al hacer click fuera
document.addEventListener('click', function(event) {
    const panel = document.getElementById('panelVentaRealizadaPor');
    const trigger = document.getElementById('triggerVentaRealizadaPor');
    if (panel && trigger &&
        !panel.contains(event.target) &&
        !trigger.contains(event.target)) {
        cerrarDropdownVentaRealizadaPor();
    }
});

function filtrarOpcionesOperador() {
    const busqueda = document.getElementById('buscarOperador').value.toLowerCase();
    document.querySelectorAll('#panelOperadores .checkbox-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(busqueda) ? 'flex' : 'none';
    });
}

document.addEventListener('click', function(event) {
    const panel = document.getElementById('panelOperadores');
    const trigger = document.getElementById('triggerOperadores');
    if (panel && trigger &&
        !panel.contains(event.target) &&
        !trigger.contains(event.target)) {
        cerrarDropdownOperadores();
    }
});

const null1 = document.getElementById("nullPlazoDocumentos")

document.getElementById('nullPlazoDocumentos').addEventListener("click", function() {
})

function abirModalTipoRegistro() {
    const modal = document.getElementById('modalTipoRegistro')
    modal.style.display = 'flex'
}

function cerrarModalTipoRegistro() {
    const modal = document.getElementById('modalTipoRegistro')
    modal.style.display = 'none'
}

document.getElementById('modalTipoRegistro').addEventListener('click', function(e) {
    if (e.target === this) cerrarModalTipoRegistro()
})

// ============================================
// CAMBIO DE OPERADOR (SOLO ADMIN)
// ============================================

let operadoresCache = [];

async function cargarOperadoresCache() {
    if (operadoresCache.length > 0) return; // Ya cargados
    const { data } = await supabaseClient
        .from('usuarios')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true });
    operadoresCache = data || [];
}

async function abrirSelectorOperador(event, clienteId, operadorActual) {
    event.stopPropagation();
    if (!clienteId) return;

    // Cerrar selector anterior si existe
    cerrarSelectorOperador();

    // Cargar operadores si no están en cache
    await cargarOperadoresCache();

    // Crear dropdown
    const dropdown = document.createElement('div');
    dropdown.id = 'selectorOperadorDropdown';
    dropdown.className = 'selector-operador-dropdown';
    dropdown.innerHTML = `
        <div class="selector-operador-header">
            <span>Cambiar Operador</span>
            <span class="material-symbols-rounded" 
                style="cursor:pointer; font-size:18px;"
                onclick="cerrarSelectorOperador()"
            >close</span>
        </div>
        <input 
            type="text" 
            class="selector-operador-buscar" 
            placeholder="Buscar operador..."
            oninput="filtrarOpcionesSelectorOperador(this.value)"
            onclick="event.stopPropagation()"
        >
        <div class="selector-operador-lista" id="listaSelectorOperador">
            ${operadoresCache.map(op => `
                <div class="selector-operador-item ${op.nombre === operadorActual ? 'activo' : ''}"
                    onclick="seleccionarOperador('${clienteId}', '${op.nombre}', this)"
                >
                    ${op.nombre === operadorActual ? '<span class="material-symbols-rounded" style="font-size:16px;color:#7c3aed;">check</span>' : ''}
                    ${op.nombre}
                </div>
            `).join('')}
        </div>
    `;

    // Posicionar cerca del click
    const rect = event.target.closest('td').getBoundingClientRect();
    dropdown.style.top  = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(dropdown);

    // Cerrar al hacer click fuera
    setTimeout(() => {
        document.addEventListener('click', cerrarSelectorOperador, { once: true });
    }, 100);
}

function filtrarOpcionesSelectorOperador(query) {
    const items = document.querySelectorAll('.selector-operador-item');
    items.forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
    });
}

async function seleccionarOperador(clienteId, nuevoOperador, itemEl) {
    try {
        // 1. Actualizar en tabla clientes
        const { error: errorCliente } = await supabaseClient
            .from('clientes')
            .update({ 
                operador_nombre: nuevoOperador,
                updated_at: new Date().toISOString()
            })
            .eq('id', clienteId);

        if (errorCliente) throw errorCliente;

        // 2. Actualizar en tabla polizas (todas las pólizas del cliente)
        const { error: errorPoliza } = await supabaseClient
            .from('polizas')
            .update({ 
                operador_nombre: nuevoOperador,
                updated_at: new Date().toISOString()
            })
            .eq('cliente_id', clienteId);

        if (errorPoliza) throw errorPoliza;

        // Actualizar en memoria
        const poliza = todasLasPolizas.find(p => p.cliente?.id === clienteId);
        if (poliza?.cliente) poliza.cliente.operador_nombre = nuevoOperador;
        if (poliza) _indiceBusqueda.delete(poliza);   // el índice de búsqueda incluye el operador

        // Actualizar en la tabla sin re-renderizar todo
        const td = document.querySelector(`[onclick*="${clienteId}"]`)?.closest('td');
        if (td) {
            td.querySelector('.operador-nombre').textContent = nuevoOperador;
        }

        cerrarSelectorOperador();

    } catch (error) {
        console.error('Error cambiando operador:', error?.message);
        alert('Error al cambiar el operador');
    }
}

function cerrarSelectorOperador() {
    document.getElementById('selectorOperadorDropdown')?.remove();
}

// ============================================
// DROPDOWN ESTADO MERCADO
// ============================================
function toggleDropdownEstadoMercado(event) {
    event.stopPropagation();
    document.getElementById('panelEstadoMercado').classList.toggle('active');
    document.getElementById('triggerEstadoMercado').classList.toggle('active');
}
function cerrarDropdownEstadoMercado() {
    document.getElementById('panelEstadoMercado').classList.remove('active');
    document.getElementById('triggerEstadoMercado').classList.remove('active');
}
function limpiarEstadoMercado() {
    document.querySelectorAll('#panelEstadoMercado input[type="checkbox"]').forEach(cb => cb.checked = false);
    actualizarTextoEstadoMercado();
    guardarFiltrosEnStorage();
    aplicarFiltros();
}
function actualizarTextoEstadoMercado() {
    const checked = document.querySelectorAll('#panelEstadoMercado input:checked');
    const texto   = document.getElementById('textoEstadoMercado');
    if (checked.length === 0) {
        texto.textContent = 'Seleccionar estados...';
        texto.style.color = '#94a3b8';
    } else if (checked.length === 1) {
        texto.textContent = checked[0].value === '__null__' ? 'Pendiente' : checked[0].value;
        texto.style.color = '#1e293b';
    } else {
        texto.textContent = `${checked.length} estados seleccionados`;
        texto.style.color = '#6366f1';
    }
}
document.addEventListener('click', e => {
    const panel = document.getElementById('panelEstadoMercado');
    const trigger = document.getElementById('triggerEstadoMercado');
    if (panel && trigger && !panel.contains(e.target) && !trigger.contains(e.target))
        cerrarDropdownEstadoMercado();
});
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.querySelectorAll('#panelEstadoMercado input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                actualizarTextoEstadoMercado();
                guardarFiltrosEnStorage();
                aplicarFiltros();
            });
        });
        actualizarTextoEstadoMercado();
    }, 100);
});

// ============================================
// DROPDOWN ESTADO COMPAÑÍA
// ============================================
function toggleDropdownEstadoCompania(event) {
    event.stopPropagation();
    document.getElementById('panelEstadoCompania').classList.toggle('active');
    document.getElementById('triggerEstadoCompania').classList.toggle('active');
}
function cerrarDropdownEstadoCompania() {
    document.getElementById('panelEstadoCompania').classList.remove('active');
    document.getElementById('triggerEstadoCompania').classList.remove('active');
}
function limpiarEstadoCompania() {
    document.querySelectorAll('#panelEstadoCompania input[type="checkbox"]').forEach(cb => cb.checked = false);
    actualizarTextoEstadoCompania();
    guardarFiltrosEnStorage();
    aplicarFiltros();
}
function actualizarTextoEstadoCompania() {
    const checked = document.querySelectorAll('#panelEstadoCompania input:checked');
    const texto   = document.getElementById('textoEstadoCompania');
    if (checked.length === 0) {
        texto.textContent = 'Seleccionar estados...';
        texto.style.color = '#94a3b8';
    } else if (checked.length === 1) {
        texto.textContent = checked[0].value === '__null__' ? 'Pendiente' : checked[0].value;
        texto.style.color = '#1e293b';
    } else {
        texto.textContent = `${checked.length} estados seleccionados`;
        texto.style.color = '#6366f1';
    }
}

document.addEventListener('click', e => {
    const panel = document.getElementById('panelEstadoCompania');
    const trigger = document.getElementById('triggerEstadoCompania');
    if (panel && trigger && !panel.contains(e.target) && !trigger.contains(e.target))
        cerrarDropdownEstadoCompania();
});
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.querySelectorAll('#panelEstadoCompania input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                actualizarTextoEstadoCompania();
                guardarFiltrosEnStorage();
                aplicarFiltros();
            });
        });
        actualizarTextoEstadoCompania();
    }, 100);
});

window.abrirSelectorOperador  = abrirSelectorOperador;
window.cerrarSelectorOperador = cerrarSelectorOperador;
window.seleccionarOperador    = seleccionarOperador;
window.filtrarOpcionesSelectorOperador = filtrarOpcionesSelectorOperador;

// Helpers
// Seguimiento efectivo: "Si" si en los últimos 120 días hubo AL MENOS un seguimiento
// efectivo; si no, lo que diga el último seguimiento ("No" o vacío).
function seguimientoEfectivo120(poliza) {
    const segs = (poliza?.seguimientos || []).filter(s => s.fecha_seguimiento);
    if (!segs.length) return '';
    const limite = new Date();
    limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() - 120);
    const fecha = (s) => new Date(String(s.fecha_seguimiento).slice(0, 10) + 'T00:00:00');
    if (segs.some(s => s.seguimiento_efectivo === 'Si' && fecha(s) >= limite)) return 'Si';
    const ultimo = segs.reduce((a, b) => (fecha(b) > fecha(a) ? b : a));
    return ultimo.seguimiento_efectivo || '';
}

function obtenerMetodoPrincipal(cliente) {
    const metodos = cliente?.metodos_pago;
    if (!metodos || metodos.length === 0) return null;
    return metodos.find(m => m.activo === true) || metodos[0];
}

function obtenerMesesPagadosAnioActual(cliente) {
    const anioActual = new Date().getFullYear();
    const registros = cliente?.pagos_mensuales_cliente;
    if (!registros || registros.length === 0) return null;
    return registros.find(r => r.anio === anioActual) || null;
}