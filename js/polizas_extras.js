(function () {
  'use strict';
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const $ = (id) => document.getElementById(id);
  const TITULOS = {
    pagos: 'Pólizas con pagos pendientes',
    seguimiento: 'Pólizas sin seguimiento hace más de 30 días',
    plazo: 'Pólizas con plazo Mercado en 30 días',
  };

  // ------------------------------------------------------------ 1. nombre → pestaña nueva
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="cliente_editar.html"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(a.href, '_blank');
  }, true);

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
    } catch (e) {
      console.warn('[atención] sin filtro:', e);
      idsAtencion = null;
    }
    pintarAviso();
  }

  function pintarAviso() { /* sin aviso aparte: lo muestra el contador de abajo a la derecha */ }

  function quitarAtencion() {
    tipoAtencion = null; idsAtencion = null;
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
          polizasFiltradas = base.filter((p) => idsAtencion.has(String(p.id)));
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