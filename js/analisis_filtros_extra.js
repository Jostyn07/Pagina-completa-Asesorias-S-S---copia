/* ============================================================================
 * Ruta en el repo: js/analisis_filtros_extra.js
 * Análisis general → Filtros avanzados: dos filtros nuevos.
 *   1) Portal: solo aparece si la cartera del usuario tiene clientes en más de un
 *      portal (es decir, si tiene más de un portal asignado).
 *   2) "Contar Cancelados": incluye o excluye las pólizas con estado de Mercado
 *      "Cancelado". Los "Cancelado a P.C" siguen sin contarse, como hasta ahora.
 * Afectan resumen (rojo/amarillo/verde), gráficas, tabla y planes.
 * No modifica analisis.js: lo envuelve. Si algo falla, Análisis sigue igual.
 * Se carga DESPUÉS de analisis.js.
 * ==========================================================================*/
(function () {
  'use strict';
  if (typeof window.aplicarFiltroOperador !== 'function' || typeof window.cargarDatosAnalisis !== 'function') return;

  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const extra = { portales: [], contarCancelados: true };
  let maestro = null;          // lista completa cargada por analisis.js (sin estos filtros)
  const portalDe = {};         // cliente_id → portal

  function cumple(p) {
    if (!extra.contarCancelados && p.estado_mercado === 'Cancelado') return false;
    if (extra.portales.length) {
      const portal = portalDe[p.clientes?.id];
      if (!extra.portales.includes(portal)) return false;
    }
    return true;
  }

  // ---- aplicar: se filtra la lista base y luego corre el flujo normal de analisis.js
  const aplicarOriginal = window.aplicarFiltroOperador;
  window.aplicarFiltroOperador = function () {
    try {
      if (!maestro) maestro = todasLasPolizasAnalisis.slice();
      todasLasPolizasAnalisis = maestro.filter(cumple);
    } catch (e) { console.warn('[filtros extra] sin efecto:', e); }
    return aplicarOriginal.apply(this, arguments);
  };

  // ---- recarga de datos: se reinicia la lista base y se cargan los portales
  const cargarOriginal = window.cargarDatosAnalisis;
  window.cargarDatosAnalisis = async function () {
    maestro = null;
    const r = await cargarOriginal.apply(this, arguments);
    try { await cargarPortales(); } catch (e) { console.warn('[filtros extra] portales:', e); }
    return r;
  };

  async function cargarPortales() {
    const base = maestro || todasLasPolizasAnalisis || [];
    const ids = [...new Set(base.map((p) => p.clientes?.id).filter(Boolean))].filter((id) => !(id in portalDe));
    for (let i = 0; i < ids.length; i += 500) {
      const { data, error } = await sb().from('clientes').select('id, portal').in('id', ids.slice(i, i + 500));
      if (error) throw error;
      (data || []).forEach((c) => { portalDe[c.id] = c.portal || 'Sin portal'; });
    }
    pintarFiltros();
  }

  // ---- interfaz dentro del panel de filtros avanzados
  function pintarFiltros() {
    const panel = document.getElementById('analisisFiltrosAvanzados');
    if (!panel) return;
    const acciones = panel.querySelector('.filtro-avanzado-acciones');

    // Portal: solo si hay más de un portal en la cartera del usuario
    const base = maestro || [];
    const portales = [...new Set(base.map((p) => portalDe[p.clientes?.id]).filter(Boolean))].sort();
    let gPortal = document.getElementById('filtroExtraPortal');
    if (portales.length > 1) {
      if (!gPortal) {
        gPortal = document.createElement('div');
        gPortal.id = 'filtroExtraPortal';
        gPortal.className = 'filtro-avanzado-grupo';
        panel.insertBefore(gPortal, panel.firstChild);
      }
      gPortal.innerHTML = `<span class="filtro-avanzado-titulo">Portal</span>
        <div class="filtro-avanzado-chips">${portales.map((pt) =>
          `<button type="button" class="analisis-chip-filtro${extra.portales.includes(pt) ? ' active' : ''}" data-portal="${pt.replace(/"/g, '&quot;')}">${pt}</button>`).join('')}</div>`;
      gPortal.querySelectorAll('[data-portal]').forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.portal;
        const i = extra.portales.indexOf(v);
        if (i === -1) extra.portales.push(v); else extra.portales.splice(i, 1);
        b.classList.toggle('active', i === -1);
        window.aplicarFiltroOperador();
      }));
    } else if (gPortal) {
      gPortal.remove();
      extra.portales = [];
    }

    // Contar Cancelados
    let gCanc = document.getElementById('filtroExtraCancelados');
    if (!gCanc) {
      gCanc = document.createElement('div');
      gCanc.id = 'filtroExtraCancelados';
      gCanc.className = 'filtro-avanzado-grupo';
      gCanc.innerHTML = `<span class="filtro-avanzado-titulo">Pólizas canceladas</span>
        <div class="filtro-avanzado-chips">
          <label class="analisis-chip-filtro filtro-extra-check">
            <input type="checkbox" id="chkContarCancelados" ${extra.contarCancelados ? 'checked' : ''}>
            Incluir cancelados
          </label>
        </div>`;
      panel.insertBefore(gCanc, acciones || null);
      gCanc.querySelector('#chkContarCancelados').addEventListener('change', (e) => {
        extra.contarCancelados = e.target.checked;
        window.aplicarFiltroOperador();
      });
    }
  }

  // ---- "Limpiar filtros" también reinicia estos dos
  if (typeof window.limpiarFiltrosAvanzados === 'function') {
    const limpiarOriginal = window.limpiarFiltrosAvanzados;
    window.limpiarFiltrosAvanzados = function () {
      extra.portales = [];
      extra.contarCancelados = true;
      const chk = document.getElementById('chkContarCancelados');
      if (chk) chk.checked = true;
      const r = limpiarOriginal.apply(this, arguments);
      window.aplicarFiltroOperador();
      return r;
    };
  }

  const css = document.createElement('style');
  css.textContent = `
    .filtro-extra-check { display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
    .filtro-extra-check input { margin:0; accent-color:#7c5cf5; }
    .filtro-extra-check small { opacity:.7; font-weight:400; }`;
  document.head.appendChild(css);
})();