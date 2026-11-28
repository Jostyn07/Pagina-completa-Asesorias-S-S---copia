(function () {
  'use strict';

  const cli = (p) => p.cliente || {};
  const ultimoSeg = (p) => {
    const s = (p.seguimientos || []).filter((x) => x.fecha_seguimiento);
    if (!s.length) return null;
    return s.reduce((a, b) => (String(b.fecha_seguimiento) > String(a.fecha_seguimiento) ? b : a));
  };
  const metodo = (p) => {
    try { return typeof obtenerMetodoPrincipal === 'function' ? obtenerMetodoPrincipal(p.cliente)?.tiene_metodo_pago : null; }
    catch (e) { return null; }
  };

  // columna → [tipo, cómo leer el dato]
  const COLUMNAS = {
    portal:                 ['texto', (p) => cli(p).portal],
    tipoRegistro:           ['texto', (p) => cli(p).tipo_registro],
    tipo_modificacion:      ['texto', (p) => cli(p).tipo_modificacion],
    agente_mercado:         ['texto', (p) => p.nombre_agente_mercado],
    operador_nombre:        ['texto', (p) => cli(p).operador_nombre || p.operador_nombre],
    cliente:                ['texto', (p) => `${cli(p).nombres || ''} ${cli(p).apellidos || ''}`.trim()],
    aplicantes:             ['numero', (p) => p.aplicantes],
    telefono:               ['texto', (p) => cli(p).telefono1],
    estado_migratorio:      ['texto', (p) => cli(p).estado_migratorio],
    ssn:                    ['texto', (p) => cli(p).ssn],
    estado_mercado:         ['texto', (p) => p.estado_mercado],
    fechaRevisionMercado:   ['fecha', (p) => p.fecha_revision_mercado],
    documentos:             ['texto', (p) => p.documentos_pendientes],
    estado_documentos:      ['texto', (p) => p.estado_documentos],
    'Fecha del plazo de documentos': ['fecha', (p) => p.fecha_plazo_documentos],
    agente35_estado:        ['texto', (p) => p.agente35_estado],
    compania:               ['texto', (p) => p.compania],
    estado_compania:        ['texto', (p) => p.estado_compania],
    fecha_revision_compania:['fecha', (p) => p.fecha_revision_compania],
    plan:                   ['texto', (p) => p.plan],
    prima:                  ['numero', (p) => p.prima],
    pagado_hasta:           ['fecha', (p) => p.pagado_hasta],
    metodo_pago:            ['texto', metodo],
    agente_nombre:          ['texto', (p) => p.agente_nombre],
    fecha_efectividad:      ['fecha', (p) => p.fecha_efectividad],
    created_at:             ['fecha', (p) => p.created_at],
    updated_at:             ['fecha', (p) => p.updated_at],
    modificado_por_nombre:  ['texto', (p) => p.modificado_por_nombre],
    ultimo_seguimiento:     ['fecha', (p) => ultimoSeg(p)?.fecha_seguimiento],
    seguimiento_efectivo:   ['texto', (p) => (typeof seguimientoEfectivo120 === 'function' ? seguimientoEfectivo120(p) : ultimoSeg(p)?.seguimiento_efectivo)],
  };

  // Encabezados que no se podían ordenar: texto del encabezado → columna
  const POR_TITULO = {
    'tipo de modificación': 'tipo_modificacion', 'agente (mercado)': 'agente_mercado', 'aplicantes': 'aplicantes',
    'número de teléfono': 'telefono', 'estado migratorio': 'estado_migratorio', 'ssn': 'ssn',
    'estado(mercado)': 'estado_mercado', 'estado de documentos': 'estado_documentos',
    'fecha de revision en compañia': 'fecha_revision_compania', 'pagado hasta': 'pagado_hasta',
    '¿tiene metodo de pago?': 'metodo_pago', 'agente': 'agente_nombre', 'seguimiento efectivo': 'seguimiento_efectivo',
  };

  const vacio = (v) => v === null || v === undefined || String(v).trim() === '' || v === '-';
  function valor(tipo, v) {
    if (tipo === 'numero') { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? null : n; }
    if (tipo === 'fecha') {
      const s = String(v).trim();
      const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);          // mm/dd/aaaa
      const t = us ? Date.UTC(+us[3], +us[1] - 1, +us[2]) : Date.parse(s.length === 10 ? s + 'T00:00:00Z' : s);
      return isNaN(t) ? null : t;
    }
    return String(v).trim();
  }
  const comparaTexto = new Intl.Collator('es', { sensitivity: 'base', numeric: true }).compare;

  function ordenar(columna) {
    const def = COLUMNAS[columna];
    if (!def) return;
    ordenManual = true;                                // el usuario eligió orden: ya no se reordena por recencia
    if (ordenColumna === columna) ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
    else { ordenColumna = columna; ordenDireccion = 'asc'; }
    const [tipo, leer] = def;
    const dir = ordenDireccion === 'asc' ? 1 : -1;
    const conValor = polizasFiltradas.map((p, i) => {
      const crudo = leer(p);
      return { p, i, v: vacio(crudo) ? null : valor(tipo, crudo) };
    });
    conValor.sort((a, b) => {
      if (a.v === null && b.v === null) return a.i - b.i;
      if (a.v === null) return 1;                      // vacíos siempre al final
      if (b.v === null) return -1;
      const c = tipo === 'texto' ? comparaTexto(a.v, b.v) : a.v - b.v;
      return c !== 0 ? c * dir : a.i - b.i;            // orden estable
    });
    polizasFiltradas = conValor.map((x) => x.p);
    if (typeof actualizarIndicadoresOrden === 'function') actualizarIndicadoresOrden();
    paginaActual = 1;
    renderizarTabla();
    actualizarPaginacion();
  }
  window.ordenarPor = ordenar;

  // Hacer ordenables las columnas que no lo eran (antes de que polizas.js conecte los clics)
  function marcarEncabezados() {
    document.querySelectorAll('table.content__info-client thead th:not(.sortable)').forEach((th) => {
      const t = th.textContent.replace(/\s+/g, ' ').trim().toLowerCase().replace('estado (mercado)', 'estado(mercado)');
      const col = POR_TITULO[t];
      if (col) { th.classList.add('sortable'); th.dataset.column = col; }
    });
  }
  marcarEncabezados();
})();