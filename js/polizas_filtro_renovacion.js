/* ============================================================================
 * Ruta en el repo: js/polizas_filtro_renovacion.js
 * Pólizas → Filtros avanzados: filtro "Renovación".
 *   - Renovadas:              estado_renovacion = 'Renovada'
 *   - Pendientes de renovar:  'Pendiente', 'En proceso' o sin dato
 *   - No quiere renovar:      marcadas con el botón "No quiere renovar" de la ficha
 * + Año de la póliza (por defecto el año actual): así en 2026 se trabajan las
 *   pólizas 2026, y en 2027 las 2027, sin cambiar nada.
 *   Año = año de la fecha final de cobertura → si no, de la efectividad → si no,
 *   el del número de póliza (POL-AAAA-…).
 * Se combina con los demás filtros y se recuerda en el navegador.
 * No modifica polizas.js: lo envuelve. Si algo falla, Pólizas sigue igual.
 * Se carga DESPUÉS de polizas.js.
 * ==========================================================================*/
(function () {
  'use strict';
  if (typeof window.aplicarFiltrosAvanzados !== 'function') return;

  const CLAVE = 'ss_polizas_filtro_renovacion';
  const CLAVE_ANIO = 'ss_polizas_filtro_renovacion_anio';
  const ANIO_ACTUAL = String(new Date().getFullYear());
  let anio = ANIO_ACTUAL;
  try { anio = localStorage.getItem(CLAVE_ANIO) ?? ANIO_ACTUAL; } catch (e) {}
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  let valor = '';
  try { valor = localStorage.getItem(CLAVE) || ''; } catch (e) {}
  const estadoRenov = new Map();   // poliza_id → estado_renovacion (solo si la lista no lo trae)

  const estadoDe = (p) => {
    const e = p.estado_renovacion !== undefined ? p.estado_renovacion : estadoRenov.get(p.id);
    const v = String(e || '').trim().toLowerCase();
    if (v === 'borrador') return 'borrador';   // póliza nueva aún sin terminar: no entra en ningún grupo
    return v === 'renovada' ? 'renovadas' : v === 'no renovada' ? 'no_renovadas' : 'pendientes';
  };
  const anioDe = (p) => {
    for (const f of [p.fecha_final_cobertura, p.fecha_efectividad]) {
      const m = String(f || '').match(/(\d{4})-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/(\d{4})/);
      if (m) return m[1] || m[2];
    }
    const n = String(p.numero_poliza || '').match(/POL-(\d{4})-/i);
    return n ? n[1] : '';
  };

  // Si la carga de pólizas no trae estado_renovacion, se consulta aparte una sola vez
  async function asegurarDatos() {
    const lista = Array.isArray(todasLasPolizas) ? todasLasPolizas : [];
    if (!lista.length || lista[0].estado_renovacion !== undefined) return;
    const faltan = lista.map((p) => p.id).filter((id) => id && !estadoRenov.has(id));
    for (let i = 0; i < faltan.length; i += 300) {
      const { data, error } = await sb().from('polizas').select('id, estado_renovacion').in('id', faltan.slice(i, i + 300));
      if (error) throw error;
      (data || []).forEach((r) => estadoRenov.set(r.id, r.estado_renovacion));
    }
  }

  function filtrar() {
    if (!valor) return;
    const base = Array.isArray(polizasFiltradas) ? polizasFiltradas : [];
    polizasFiltradas = base.filter((p) => estadoDe(p) === valor && (!anio || anioDe(p) === anio));
    paginaActual = 1;
    try { renderizarTabla(); } catch (e) {}
    try { actualizarPaginacion(); } catch (e) {}
    const cont = document.getElementById('contadorResultados');
    if (cont) cont.textContent = `${polizasFiltradas.length}/${todasLasPolizas.length}`;
  }

  async function aplicar() {
    if (!valor) return;
    try { await asegurarDatos(); filtrar(); }
    catch (e) { console.warn('[filtro renovación] sin efecto:', e); }
  }

  function pintarAnios() {
    const sel = document.getElementById('filtroRenovacionAnio');
    if (!sel) return;
    const desdeDatos = (Array.isArray(todasLasPolizas) ? todasLasPolizas : []).map(anioDe).filter(Boolean);
    const anios = [...new Set([ANIO_ACTUAL, String(+ANIO_ACTUAL + 1), ...desdeDatos])].sort().reverse();
    sel.innerHTML = `<option value="">Todos los años</option>` + anios.map((a) => `<option value="${a}">${a}</option>`).join('');
    sel.value = anios.includes(anio) || anio === '' ? anio : ANIO_ACTUAL;
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
          <label for="filtroRenovacionAnio">Año de la póliza</label>
          <select id="filtroRenovacionAnio"></select>
        </div>
      </div>`;
    cuerpo.insertBefore(sec, cuerpo.firstChild);
    document.getElementById('filtroRenovacion').value = valor;
    pintarAnios();
  }

  // ---- envolturas
  const aplicarOriginal = window.aplicarFiltrosAvanzados;
  window.aplicarFiltrosAvanzados = function () {
    valor = document.getElementById('filtroRenovacion')?.value || '';
    anio = document.getElementById('filtroRenovacionAnio')?.value ?? ANIO_ACTUAL;
    try { localStorage.setItem(CLAVE, valor); localStorage.setItem(CLAVE_ANIO, anio); } catch (e) {}
    const r = aplicarOriginal.apply(this, arguments);
    if (valor) {
      try { hayFiltrosActivos = true; } catch (e) {}
      Promise.resolve(r).then(aplicar);
    }
    return r;
  };

  if (typeof window.limpiarFiltros === 'function') {
    const limpiarOriginal = window.limpiarFiltros;
    window.limpiarFiltros = function () {
      valor = ''; anio = ANIO_ACTUAL;
      try { localStorage.removeItem(CLAVE); localStorage.removeItem(CLAVE_ANIO); } catch (e) {}
      const sel = document.getElementById('filtroRenovacion');
      if (sel) sel.value = '';
      const selA = document.getElementById('filtroRenovacionAnio');
      if (selA) selA.value = ANIO_ACTUAL;
      return limpiarOriginal.apply(this, arguments);
    };
  }

  // al cargar la página se vuelve a aplicar el filtro recordado
  if (typeof window.cargarPolizas === 'function') {
    const cargarOriginal = window.cargarPolizas;
    window.cargarPolizas = async function () {
      const r = await cargarOriginal.apply(this, arguments);
      pintarAnios();
      await aplicar();
      return r;
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintarControl);
  else pintarControl();
})();