// ============================================================================
// Ruta en el repo: js/ranking_renovaciones.js
// FASE 4 — Pestaña "Ranking de renovaciones" en Análisis
// Requiere sql/fase4_ranking.sql y sql/ranking_renovaciones_portal.sql (filtro por portal).
// Filtro por portal: checklist, todos activos por defecto; se recuerda lo último que dejó cada usuario. Se carga en pages/analisis.html después de analisis.js.
// Solo aparece con el permiso ver_ranking_renovaciones (el servidor lo vuelve a validar).
// ============================================================================

(function () {
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MEDALLAS = { 1: '🥇', 2: '🥈', 3: '🥉' };

  function estilos() {
    if (document.getElementById('estilosRanking')) return;
    const css = document.createElement('style');
    css.id = 'estilosRanking';
    css.textContent = `
      #vistaRankingRenovaciones{flex-direction:column;gap:16px}
      .rk-barra{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
      .rk-barra select{padding:8px 12px;border-radius:8px;border:1px solid var(--border-color,#e2e8f0);background:var(--bg-secondary,#fff);color:inherit;font:inherit}
      .rk-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
      .rk-kpi{background:var(--bg-secondary,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:12px;padding:14px 16px}
      .rk-kpi small{display:block;color:var(--text-secondary,#64748b);font-size:.78rem}
      .rk-kpi strong{font-size:1.6rem;font-variant-numeric:tabular-nums}
      .rk-card{background:var(--bg-secondary,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:12px;overflow:hidden}
      .rk-tabla{width:100%;border-collapse:collapse;font-size:.9rem}
      .rk-tabla th,.rk-tabla td{padding:10px 14px;text-align:left;border-bottom:1px solid var(--border-color,#e2e8f0)}
      .rk-tabla th{font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary,#64748b)}
      .rk-tabla td.num{text-align:right;font-variant-numeric:tabular-nums}
      .rk-tabla th.num{text-align:right}
      .rk-barra-prog{height:6px;border-radius:999px;background:#ede9fe;overflow:hidden;min-width:80px}
      .rk-barra-prog span{display:block;height:100%;background:#7c3aed;border-radius:999px}
      .rk-vacio{padding:24px;text-align:center;color:var(--text-secondary,#64748b)}
      .rk-pos{font-weight:700;width:60px}
      [data-theme="dark"] .rk-barra-prog{background:#3b0764}
      .rk-portales{display:flex;flex-wrap:wrap;gap:8px}
      .rk-portal{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--border-color,#e2e8f0);background:var(--bg-secondary,#fff);font-size:.85rem;cursor:pointer;user-select:none}
      .rk-portal input{accent-color:#7c3aed;margin:0;cursor:pointer}
      .rk-portal.off{opacity:.55}
      .rk-portal small{color:var(--text-secondary,#64748b);font-variant-numeric:tabular-nums}
    `;
    document.head.appendChild(css);
  }

  function montar() {
    const nav = document.getElementById('analisisNavTabs');
    if (!nav || document.getElementById('vistaRankingRenovaciones')) return false;

    const btn = document.createElement('button');
    btn.className = 'analisis-nav-tab';
    btn.dataset.vista = 'ranking';
    btn.innerHTML = '<span class="material-symbols-rounded">emoji_events</span> Ranking de renovaciones';
    nav.appendChild(btn);

    const vista = document.createElement('div');
    vista.id = 'vistaRankingRenovaciones';
    vista.className = 'vista-analisis';
    vista.style.display = 'none';
    const anioSiguiente = new Date().getFullYear() + 1;
    const anios = [anioSiguiente, anioSiguiente - 1, anioSiguiente - 2];
    vista.innerHTML = `
      <div class="rk-barra">
        <div><h2 style="margin:0">Ranking de renovaciones</h2></div>
        <label>Año de efectividad
          <select id="rkAnio">${anios.map((a) => `<option value="${a}">${a}</option>`).join('')}</select>
        </label>
      </div>
      <div class="rk-portales" id="rkPortales"></div>
      <div class="rk-kpis">
        <div class="rk-kpi"><small>Total renovadas</small><strong id="rkTotal">0</strong></div>
        <div class="rk-kpi"><small>En proceso (sin terminar)</small><strong id="rkProceso">0</strong></div>
        <div class="rk-kpi"><small>Operadores con renovaciones</small><strong id="rkOperadores">0</strong></div>
      </div>
      <div class="rk-card">
        <table class="rk-tabla">
          <thead><tr><th>Posición</th><th>Operador</th><th class="num">Renovaciones</th><th></th><th class="num">En proceso</th><th>Última</th></tr></thead>
          <tbody id="rkCuerpo"><tr><td colspan="6" class="rk-vacio">Cargando…</td></tr></tbody>
        </table>
      </div>`;
    const especifica = document.getElementById('vistaAnalisisEspecifico');
    (especifica || nav).insertAdjacentElement('afterend', vista);

    // Cambio de pestaña: se envuelve la función existente de analisis.js
    const original = window.cambiarVistaAnalisis;
    window.cambiarVistaAnalisis = function (v) {
      if (v === 'ranking') {
        document.querySelectorAll('.analisis-nav-tab').forEach((b) => b.classList.toggle('active', b.dataset.vista === 'ranking'));
        ['vistaAnalisisGeneral', 'vistaAnalisisEspecifico'].forEach((id) => {
          const el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        const acciones = document.getElementById('accionesGeneral');
        if (acciones) acciones.style.display = 'none';
        vista.style.display = 'flex';
        cargar();
        return;
      }
      vista.style.display = 'none';
      if (typeof original === 'function') return original.apply(this, arguments);
    };
    btn.addEventListener('click', () => window.cambiarVistaAnalisis('ranking'));
    document.getElementById('rkAnio').addEventListener('change', cargar);
    document.getElementById('rkPortales').addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-portal]');
      if (!cb) return;
      if (cb.checked) apagados.delete(cb.dataset.portal); else apagados.add(cb.dataset.portal);
      cb.closest('.rk-portal').classList.toggle('off', !cb.checked);
      guardarApagados();
      cargarRanking();
    });
    return true;
  }

  // ---- portales: se guardan los DESMARCADOS, así un portal nuevo aparece marcado
  let apagados = new Set();
  let portales = [];
  const claveApagados = () => {
    let id = '';
    try { id = JSON.parse(localStorage.getItem('usuario') || '{}').id || ''; } catch (e) {}
    return 'ss_rk_portales_off_' + id;
  };
  function leerApagados() {
    try { apagados = new Set(JSON.parse(localStorage.getItem(claveApagados()) || '[]')); } catch (e) { apagados = new Set(); }
  }
  function guardarApagados() {
    try { localStorage.setItem(claveApagados(), JSON.stringify([...apagados])); } catch (e) {}
  }

  async function cargar() {
    const anio = Number(document.getElementById('rkAnio').value);
    leerApagados();
    const cont = document.getElementById('rkPortales');
    try {
      const { data, error } = await sb().rpc('ranking_renovaciones_portales', { p_anio: anio });
      if (error) throw error;
      portales = (data || []).map((p) => ({ nombre: p.portal, n: Number(p.renovaciones) || 0 }));
    } catch (e) { portales = []; }
    cont.innerHTML = portales.map((p) => `
      <label class="rk-portal${apagados.has(p.nombre) ? ' off' : ''}">
        <input type="checkbox" data-portal="${esc(p.nombre)}" ${apagados.has(p.nombre) ? '' : 'checked'}>
        ${esc(p.nombre)} <small>${p.n.toLocaleString('es-CO')}</small>
      </label>`).join('');
    cont.style.display = portales.length ? '' : 'none';
    return cargarRanking();
  }

  async function cargarRanking() {
    const anio = Number(document.getElementById('rkAnio').value);
    const cuerpo = document.getElementById('rkCuerpo');
    cuerpo.innerHTML = '<tr><td colspan="6" class="rk-vacio">Cargando…</td></tr>';

    const activos = portales.map((p) => p.nombre).filter((n) => !apagados.has(n));
    const params = { p_anio: anio };
    if (portales.length && activos.length < portales.length) params.p_portales = activos;
    let { data, error } = await sb().rpc('ranking_renovaciones', params);
    if (error && params.p_portales) ({ data, error } = await sb().rpc('ranking_renovaciones', { p_anio: anio }));
    if (error) {
      cuerpo.innerHTML = `<tr><td colspan="6" class="rk-vacio">No se pudo cargar: ${esc(error.message)}</td></tr>`;
      return;
    }
    const filas = data || [];
    const total = filas.reduce((s, f) => s + Number(f.renovaciones), 0);
    const proceso = filas.reduce((s, f) => s + Number(f.en_proceso), 0);
    const maximo = Math.max(1, ...filas.map((f) => Number(f.renovaciones)));
    document.getElementById('rkTotal').textContent = total.toLocaleString('es-CO');
    document.getElementById('rkProceso').textContent = proceso.toLocaleString('es-CO');
    document.getElementById('rkOperadores').textContent = filas.filter((f) => Number(f.renovaciones) > 0).length;

    if (!filas.length) {
      cuerpo.innerHTML = `<tr><td colspan="6" class="rk-vacio">Aún no hay renovaciones para ${anio}.</td></tr>`;
      return;
    }
    cuerpo.innerHTML = filas.map((f) => `
      <tr>
        <td class="rk-pos">${Number(f.renovaciones) > 0 ? (MEDALLAS[f.posicion] || '') + ' ' + f.posicion : '—'}</td>
        <td>${esc(f.operador_nombre)}</td>
        <td class="num"><strong>${Number(f.renovaciones).toLocaleString('es-CO')}</strong></td>
        <td style="width:30%"><div class="rk-barra-prog"><span style="width:${(Number(f.renovaciones) / maximo) * 100}%"></span></div></td>
        <td class="num">${Number(f.en_proceso) || ''}</td>
        <td>${f.ultima ? new Date(f.ultima).toLocaleDateString('es-CO') : ''}</td>
      </tr>`).join('');

    if (typeof window.auditar === 'function') {
      window.auditar('ranking.consulta', { recurso: 'renovaciones', detalle: { anio, portales: params.p_portales || 'todos' } });
    }
  }

  async function iniciar() {
    const cliente = sb();
    if (!cliente) return;
    const { data: puede, error } = await cliente.rpc('tiene_permiso', { p_clave: 'ver_ranking_renovaciones' });
    if (error || !puede) return;
    estilos();
    montar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();