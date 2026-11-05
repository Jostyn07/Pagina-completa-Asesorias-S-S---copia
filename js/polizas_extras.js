/* ============================================================================
 * Ruta en el repo: js/polizas_extras.js
 * Pólizas:
 *   1. (quitado) el nombre del cliente vuelve a abrir en la misma pestaña.
 *   2. Filtro desde el Inicio → Atención operativa (polizas.html?atencion=...):
 *        pagos | seguimiento | plazo. Muestra solo esas pólizas; el contador
 *        de abajo a la derecha lo refleja y su "Limpiar" lo quita.
 *   3. Botón Recargar junto a "Descargar Excel". Cada 60 s (solo con la pestaña
 *      a la vista) cuenta los cambios hechos desde la última carga y los
 *      muestra al lado. Recarga la lista sin recargar la página y sin perder
 *      los filtros.
 * Requiere sql/atencion_polizas.sql para el punto 2.
 * Se carga DESPUÉS de polizas.js y de los demás archivos de Pólizas.
 * ==========================================================================*/
(function () {
  'use strict';
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const $ = (id) => document.getElementById(id);
  const TITULOS = {
    pagos: 'Pólizas con pagos pendientes',
    seguimiento: 'Pólizas sin seguimiento hace más de 30 días',
    plazo: 'Pólizas con plazo Mercado en 30 días',
  };

  // ------------------------------------------------------------ 2. filtro de Atención operativa
  let tipoAtencion = new URLSearchParams(location.search).get('atencion');
  if (!TITULOS[tipoAtencion]) tipoAtencion = null;
  let idsAtencion = null;   // Set de poliza_id

  async function cargarAtencion() {
    if (!tipoAtencion) return;
    try {
      const { data, error } = await sb().rpc('atencion_polizas', { p_tipo: tipoAtencion });
      if (error) throw error;
      idsAtencion = new Set((data || []).map(String));
      await traerFaltantes();
    } catch (e) {
      console.warn('[atención] sin filtro:', e);
      idsAtencion = null;
    }
    pintarAviso();
  }

  // Lo que cuenta el Inicio y no está en la lista cargada (p. ej. cliente archivado)
  // se trae aparte, para que al dar clic salgan exactamente los mismos clientes.
  const COLUMNAS = `id, numero_poliza, operador_nombre, estado_mercado, fecha_revision_mercado, documentos_pendientes,
    agente35_estado, compania, fecha_revision_compania, plan, prima, agente_nombre, fecha_efectividad,
    fecha_inicial_cobertura, fecha_final_cobertura, created_at, updated_at, estado_documentos, tipo_venta,
    estado_compania, pagado_hasta, fecha_plazo_documentos, nombre_agente_mercado, modificado_por_nombre,
    modificado_por_email, clave_seguridad, member_id, aplicantes,
    cliente:clientes ( id, nombres, apellidos, fecha_nacimiento, telefono1, telefono2, email, direccion, ciudad,
      estado, codigo_postal, estado_migratorio, ssn, ocupacion, tipo_registro, tipo_modificacion, operador_nombre,
      tiene_social, archivado, venta_realizada_por, portal, agente_nombre,
      metodos_pago ( tiene_metodo_pago, tiene_pago_automatico, activo ),
      pagos_mensuales_cliente ( anio, enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre ) ),
    seguimientos ( fecha_seguimiento, seguimiento_efectivo, medio_comunicacion, observacion )`;
  let extras = [];   // pólizas del Inicio que no venían en la lista

  async function traerFaltantes() {
    extras = [];
    try {
      if (!Array.isArray(todasLasPolizas)) return;
      const cargadas = new Set(todasLasPolizas.map((p) => String(p.id)));
      const faltan = [...idsAtencion].filter((id) => !cargadas.has(id));
      for (let i = 0; i < faltan.length; i += 100) {
        const { data, error } = await sb().from('polizas').select(COLUMNAS).in('id', faltan.slice(i, i + 100));
        if (error) throw error;
        extras.push(...(data || []));
      }
      if (extras.length) {
        todasLasPolizas.push(...extras);   // para que abran sus detalles
        if (typeof window.calcularFactoresTodasLasPolizas === 'function') setTimeout(() => window.calcularFactoresTodasLasPolizas(), 50);
      }
    } catch (e) {
      console.warn('[atención] no se pudieron traer las faltantes:', e);
    }
  }

  function pintarAviso() { /* sin aviso aparte: lo muestra el contador de abajo a la derecha */ }

  function quitarAtencion() {
    tipoAtencion = null; idsAtencion = null;
    if (extras.length && Array.isArray(todasLasPolizas)) {
      const fuera = new Set(extras.map((p) => String(p.id)));
      todasLasPolizas = todasLasPolizas.filter((p) => !fuera.has(String(p.id)));
    }
    extras = [];
    history.replaceState(null, '', location.pathname);
  }

  // "Limpiar" del contador de abajo a la derecha también quita el filtro del Inicio
  if (typeof window.limpiarFiltros === 'function') {
    const limpiar = window.limpiarFiltros;
    window.limpiarFiltros = function () {
      quitarAtencion();
      return limpiar.apply(this, arguments);
    };
  }

  if (typeof window.renderizarTabla === 'function') {
    const render = window.renderizarTabla;
    window.renderizarTabla = function () {
      if (idsAtencion) {
        try {
          const base = Array.isArray(polizasFiltradas) ? polizasFiltradas : [];
          const filtradas = base.filter((p) => idsAtencion.has(String(p.id)));
          const ya = new Set(filtradas.map((p) => String(p.id)));
          polizasFiltradas = filtradas.concat(extras.filter((p) => !ya.has(String(p.id))));
        } catch (e) {}
      }
      const r = render.apply(this, arguments);
      sincronizarContador();
      return r;
    };
  }

  // El contador de abajo ("Filtros activos: x/y") siempre igual al de arriba ("Mostrando … de x")
  function sincronizarContador() {
    try {
      const total = Array.isArray(todasLasPolizas) ? todasLasPolizas.length : 0;
      const vis = Array.isArray(polizasFiltradas) ? polizasFiltradas.length : 0;
      if (idsAtencion) { try { hayFiltrosActivos = true; } catch (e) {} }
      if (typeof window.actualizarIndicadorFiltros === 'function') window.actualizarIndicadorFiltros();
      const c = $('contadorResultados');
      if (c) c.textContent = `${vis.toLocaleString('es-CO')}/${total.toLocaleString('es-CO')}`;
      if (idsAtencion && $('indicadorFiltrosActivos')) $('indicadorFiltrosActivos').style.display = 'flex';
    } catch (e) {}
  }

  // ------------------------------------------------------------ 3. recargar + contador
  const linea = { mov: null, pol: null, timer: null };

  async function marcarLinea() {
    try {
      const [m, p] = await Promise.all([
        sb().from('movimientos').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        sb().from('polizas').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      linea.mov = m.data?.created_at || new Date().toISOString();
      linea.pol = p.data?.created_at || new Date().toISOString();
      pintarContador(0);
      if (!linea.timer) linea.timer = setInterval(revisar, 60000);
    } catch (e) {}
  }

  async function revisar() {
    if (document.hidden || !linea.mov) return;
    try {
      const [m, p] = await Promise.all([
        sb().from('movimientos').select('id', { count: 'exact', head: true }).gt('created_at', linea.mov),
        sb().from('polizas').select('id', { count: 'exact', head: true }).gt('created_at', linea.pol),
      ]);
      if (m.error || p.error) return;
      pintarContador((m.count || 0) + (p.count || 0));
    } catch (e) {}
  }

  function botonRecargar() {
    if ($('btnRecargarPolizas')) return;
    const excel = [...document.querySelectorAll('button')].find((b) => /descargar excel/i.test(b.textContent));
    const grupo = document.createElement('span');
    grupo.className = 'pol-recarga';
    grupo.innerHTML = `
      <button type="button" id="btnRecargarPolizas" class="pol-btn-recargar" title="Recargar">
        <span class="material-symbols-rounded">refresh</span></button>
      <button type="button" id="polActualizaciones" class="pol-actualizaciones" style="display:none"></button>`;
    if (excel) excel.insertAdjacentElement('afterend', grupo);
    else document.body.appendChild(grupo);
    grupo.querySelectorAll('button').forEach((b) => b.addEventListener('click', recargar));
  }

  function pintarContador(n) {
    const av = $('polActualizaciones');
    if (!av) return;
    av.style.display = n ? '' : 'none';
    av.textContent = `${n} ${n === 1 ? 'actualización' : 'actualizaciones'}`;
    // copia flotante arriba, para que se vea aunque la persona haya bajado en la lista
    let flot = $('polActualizacionesFlot');
    if (!flot) {
      flot = document.createElement('button');
      flot.type = 'button';
      flot.id = 'polActualizacionesFlot';
      flot.className = 'pol-actualizaciones pol-flotante';
      flot.addEventListener('click', recargar);
      document.body.appendChild(flot);
    }
    flot.innerHTML = `<span class="material-symbols-rounded">refresh</span> ${av.textContent}`;
    const visible = () => { const r = $('btnRecargarPolizas')?.getBoundingClientRect(); return r && r.top >= 0 && r.bottom <= innerHeight; };
    flot.style.display = n && !visible() ? '' : 'none';
    if (!flot.__scroll) { flot.__scroll = true; addEventListener('scroll', () => { flot.style.display = $('polActualizaciones').style.display !== 'none' && !visible() ? '' : 'none'; }, { passive: true }); }
  }

  let recargando = false;
  async function recargar() {
    if (recargando || typeof window.cargarPolizas !== 'function') return;
    recargando = true;
    const btn = $('btnRecargarPolizas');
    btn?.classList.add('girando');
    try {
      await window.cargarPolizas();
      if (tipoAtencion) await cargarAtencion();
      if (typeof window.aplicarFiltrosAvanzados === 'function') window.aplicarFiltrosAvanzados();
      await marcarLinea();
    } catch (e) {
      console.warn('[recargar pólizas]', e);
    } finally {
      btn?.classList.remove('girando');
      recargando = false;
    }
  }

  // ------------------------------------------------------------ inicio
  if (typeof window.cargarPolizas === 'function') {
    const cargar = window.cargarPolizas;
    window.cargarPolizas = async function () {
      const r = await cargar.apply(this, arguments);
      if (tipoAtencion && !idsAtencion) {
        await cargarAtencion();
        try { renderizarTabla(); actualizarPaginacion(); } catch (e) {}
      }
      if (!linea.mov) marcarLinea();
      return r;
    };
  }

  function iniciar() { botonRecargar(); }

  const css = document.createElement('style');
  css.textContent = `
    .pol-recarga { display:inline-flex; align-items:center; gap:8px; margin-left:8px; }
    .pol-btn-recargar { display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:10px;
      border:1px solid #e2e8f0; background:#fff; color:#334155; cursor:pointer; }
    .pol-btn-recargar:hover { border-color:#6366f1; color:#6366f1; }
    .pol-btn-recargar.girando .material-symbols-rounded { animation:polgira 1s linear infinite; }
    @keyframes polgira { to { transform:rotate(360deg); } }
    .pol-actualizaciones { padding:7px 14px; border-radius:999px; border:0; background:#f59e0b; color:#fff; font:inherit;
      font-size:.82rem; font-weight:700; cursor:pointer; animation:polpulso 2s ease-in-out infinite; }
    @keyframes polpulso { 0%,100% { box-shadow:0 0 0 0 rgba(245,158,11,.5); } 50% { box-shadow:0 0 0 6px rgba(245,158,11,0); } }
    .pol-flotante { position:fixed; top:14px; left:50%; transform:translateX(-50%); z-index:9000; display:inline-flex; align-items:center; gap:6px; }
    .pol-flotante .material-symbols-rounded { font-size:18px; }
    [data-theme="dark"] .pol-btn-recargar { background:#1a1a24; border-color:#2e2e3e; color:#cbd5e1; }`;
  document.head.appendChild(css);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();