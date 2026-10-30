(function () {
  'use strict';
  if (typeof window.aplicarFiltrosAvanzados !== 'function') return;

  const CLAVE = 'ss_polizas_filtro_renovacion';
  const CLAVE_FIRMA = 'ss_polizas_filtro_firma';
  let firma = '';
  try { firma = localStorage.getItem(CLAVE_FIRMA) || ''; } catch (e) {}
  const firmaDe = new Map();   // poliza_id → true/false
  const ANIOS = ['2025', '2026', '2027'];
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  let valor = '';
  try { valor = localStorage.getItem(CLAVE) || ''; localStorage.removeItem('ss_polizas_filtro_renovacion_anio'); } catch (e) {}
  const estadoRenov = new Map();   // poliza_id → estado_renovacion (solo si la lista no lo trae)

  const lista = () => (Array.isArray(todasLasPolizas) ? todasLasPolizas : []);
  const aniosMarcados = () => ANIOS.filter((a) => document.getElementById(a)?.checked);

  const estadoDe = (p) => {
    const e = p.estado_renovacion !== undefined ? p.estado_renovacion : estadoRenov.get(p.id);
    const v = String(e || '').trim().toLowerCase();
    if (v === 'borrador') return 'borrador';
    return v === 'renovada' ? 'renovadas' : v === 'no renovada' ? 'no_renovadas' : 'pendientes';
  };
  const anioDe = (p) => {
    for (const f of [p.fecha_efectividad, p.fecha_final_cobertura]) {
      const m = String(f || '').match(/(\d{4})-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/(\d{4})/);
      if (m) return m[1] || m[2];
    }
    const n = String(p.numero_poliza || '').match(/POL-(\d{4})-/i);
    return n ? n[1] : '';
  };

  async function asegurarFirma() {
    if (!firma) return;
    const faltan = lista().map((p) => p.id).filter((id) => id && !firmaDe.has(id));
    for (let i = 0; i < faltan.length; i += 300) {
      const { data, error } = await sb().from('polizas').select('id, firma_docusign').in('id', faltan.slice(i, i + 300));
      if (error) throw error;
      (data || []).forEach((r) => firmaDe.set(r.id, !!r.firma_docusign));
    }
  }

  async function asegurarDatos() {
    if (!valor) return;
    const l = lista();
    if (!l.length || l[0].estado_renovacion !== undefined) return;
    const faltan = l.map((p) => p.id).filter((id) => id && !estadoRenov.has(id));
    for (let i = 0; i < faltan.length; i += 300) {
      const { data, error } = await sb().from('polizas').select('id, estado_renovacion').in('id', faltan.slice(i, i + 300));
      if (error) throw error;
      (data || []).forEach((r) => estadoRenov.set(r.id, r.estado_renovacion));
    }
  }

  // Aplica año + renovación sobre lo que ya filtró polizas.js
  function posfiltro() {
    const anios = aniosMarcados();
    const base = Array.isArray(polizasFiltradas) ? polizasFiltradas : lista();
    polizasFiltradas = base.filter((p) =>
      (!anios.length || anios.includes(anioDe(p))) &&
      (!valor || estadoDe(p) === valor) &&
      (!firma || !firmaDe.size || (firma === 'si') === !!(p.firma_docusign ?? firmaDe.get(p.id))));
    paginaActual = 1;
    try { renderizarTabla(); } catch (e) {}
    try { actualizarPaginacion(); } catch (e) {}
    try { if (typeof actualizarIndicadorFiltros === 'function') actualizarIndicadorFiltros(); } catch (e) {}
    const cont = document.getElementById('contadorResultados');
    if (cont) cont.textContent = `${polizasFiltradas.length}/${lista().length}`;
  }

  async function aplicar() {
    try { await asegurarDatos(); } catch (e) { console.warn('[filtro renovación] sin estado de renovación:', e); }
    try { await asegurarFirma(); } catch (e) { console.warn('[filtro firma] sin datos de firma:', e); }
    try { posfiltro(); } catch (e) { console.warn('[filtro año/renovación] sin efecto:', e); }
  }

  // ---- control dentro del modal de filtros avanzados
  function pintarControl() {
    if (document.getElementById('filtroRenovacion')) return;
    const cuerpo = document.querySelector('.modal-filtros-body');
    if (!cuerpo) return;
    const sec = document.createElement('div');
    sec.className = 'filtro-section';
    sec.innerHTML = `
      <h3>Renovación</h3>
      <div class="filtro-grid">
        <div class="filtro-group">
          <label for="filtroRenovacion">Estado de renovación</label>
          <select id="filtroRenovacion">
            <option value="">Todas</option>
            <option value="pendientes">Pendientes de renovar</option>
            <option value="renovadas">Renovadas</option>
            <option value="no_renovadas">No quiere renovar</option>
          </select>
        </div>
        <div class="filtro-group">
          <label for="filtroFirmaDocusign">Firma DocuSign</label>
          <select id="filtroFirmaDocusign">
            <option value="">Todas</option>
            <option value="si">Con firma</option>
            <option value="no">Sin firma</option>
          </select>
        </div>
      </div>`;
    cuerpo.insertBefore(sec, cuerpo.firstChild);
    document.getElementById('filtroRenovacion').value = valor;
    document.getElementById('filtroFirmaDocusign').value = firma;
  }

  // ---- envolturas
  const aplicarOriginal = window.aplicarFiltrosAvanzados;
  window.aplicarFiltrosAvanzados = function () {
    const sel = document.getElementById('filtroRenovacion');
    if (sel) valor = sel.value || '';
    const selF = document.getElementById('filtroFirmaDocusign');
    if (selF) firma = selF.value || '';
    try { localStorage.setItem(CLAVE, valor); localStorage.setItem(CLAVE_FIRMA, firma); } catch (e) {}
    try { filtroAnioActivado = false; } catch (e) {}   // el año lo aplica posfiltro()
    let r;
    try { r = aplicarOriginal.apply(this, arguments); }
    catch (e) { console.warn('[filtros] error en los filtros base, se continúa:', e); }
    try { if (valor || firma) hayFiltrosActivos = true; } catch (e) {}
    try { posfiltro(); } catch (e) {}
    if (valor || firma) Promise.resolve(r).catch(() => {}).then(aplicar);
    return r;
  };

  // Casillas de año: aplican año + todos los demás filtros
  window.aplicarFiltros = function () {
    try { guardarFiltrosEnStorage(); } catch (e) {}
    return window.aplicarFiltrosAvanzados();
  };
  ANIOS.forEach((a) => {
    const cb = document.getElementById(a);
    if (cb) cb.onchange = () => window.aplicarFiltros();
  });

  if (typeof window.limpiarFiltros === 'function') {
    const limpiarOriginal = window.limpiarFiltros;
    window.limpiarFiltros = function () {
      valor = ''; firma = '';
      try { localStorage.removeItem(CLAVE); localStorage.removeItem(CLAVE_FIRMA); } catch (e) {}
      const sel = document.getElementById('filtroRenovacion');
      if (sel) sel.value = '';
      const selF = document.getElementById('filtroFirmaDocusign');
      if (selF) selF.value = '';
      const r = limpiarOriginal.apply(this, arguments);
      try { posfiltro(); } catch (e) {}   // mantiene los años marcados
      return r;
    };
  }

  // al cargar la página: aplicar años marcados + filtros recordados
  if (typeof window.cargarPolizas === 'function') {
    const cargarOriginal = window.cargarPolizas;
    window.cargarPolizas = async function () {
      const r = await cargarOriginal.apply(this, arguments);
      await aplicar();
      return r;
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintarControl);
  else pintarControl();
})();