/* ============================================================================
 * Ruta en el repo: js/home_ranking_renovadas.js
 * Inicio → Clasificación de agentes → pestaña "Ventas":
 * Total (nuevas + renovadas) · Nuevas · Renovadas · % del total.
 * Requiere sql/renovaciones_por_operador.sql. Se carga DESPUÉS de home.js.
 * Las demás pestañas (Recuperadas, Activos) no cambian.
 * ==========================================================================*/
(function () {
  'use strict';
  if (typeof window.renderizarClasificacion !== 'function') return;

  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const excluido = (n) => !n || n === 'Sin asignar' || n === '(usuario eliminado)' || /^jostyn arag[oó]n$/i.test(n);
  const original = window.renderizarClasificacion;
  const cache = {};
  let turno = 0;

  async function renovadasPorOperador(desde, hasta) {
    const k = desde + '|' + hasta;
    if (!cache[k]) {
      cache[k] = sb().rpc('renovaciones_por_operador', { p_desde: desde, p_hasta: hasta })
        .then(({ data, error }) => { if (error) throw error; return data || []; })
        .catch((e) => { delete cache[k]; throw e; });
    }
    return cache[k];
  }

  window.renderizarClasificacion = async function (tab) {
    if (tab !== 'ventas') return original(tab);
    const contenedor = document.getElementById('clasificacion-contenido');
    if (!contenedor) return;
    const miTurno = ++turno;
    const f = (typeof filtrosActivos !== 'undefined') ? filtrosActivos : { fechaDesde: '2000-01-01', fechaHasta: '2099-12-31' };

    // Nuevas: el mismo cálculo de siempre (home.js)
    const nuevas = {};
    (typeof calcularClasificacionVentas === 'function' ? calcularClasificacionVentas() : [])
      .forEach((x) => { nuevas[x.nombre] = x.total; });

    let renov = [];
    try { renov = await renovadasPorOperador(f.fechaDesde, f.fechaHasta); }
    catch (e) {
      console.warn('Renovadas no disponibles, se muestran solo ventas nuevas:', e);
      if (miTurno === turno) original(tab);
      return;
    }
    if (miTurno !== turno) return;   // el usuario cambió de pestaña o de fechas mientras cargaba

    const renovadas = {};
    renov.forEach((r) => { if (!excluido(r.operador_nombre)) renovadas[r.operador_nombre] = Number(r.renovadas) || 0; });

    const filas = [...new Set([...Object.keys(nuevas), ...Object.keys(renovadas)])]
      .filter((n) => !excluido(n))
      .map((n) => ({ nombre: n, nuevas: nuevas[n] || 0, renovadas: renovadas[n] || 0 }))
      .map((x) => ({ ...x, total: x.nuevas + x.renovadas }))
      .sort((a, b) => b.total - a.total || b.nuevas - a.nuevas || a.nombre.localeCompare(b.nombre));

    if (!filas.length) {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:40px;color:#94a3b8;">
          <span class="material-symbols-rounded" style="font-size:40px;opacity:.3;">search_off</span>
          <p style="margin-top:10px;">Sin datos para este período</p>
        </div>`;
      return;
    }

    const tot = filas.reduce((s, x) => ({ t: s.t + x.total, n: s.n + x.nuevas, r: s.r + x.renovadas }), { t: 0, n: 0, r: 0 });
    const rank = (i) => (i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other');

    contenedor.innerHTML = `
      <table class="clasificacion-table">
        <thead>
          <tr>
            <th>Operador</th>
            <th title="Nuevas + renovadas">Total</th>
            <th>Nuevas</th>
            <th>Rev</th>
            <th>% del total</th>
          </tr>
        </thead>
        <tbody>
          ${filas.map((x, i) => `
            <tr>
              <td><span class="rank-badge ${rank(i)}">${i + 1}</span><span class="agente-nombre">${esc(x.nombre)}</span></td>
              <td><span class="total-badge">${x.total}</span></td>
              <td>${x.nuevas || '<span style="color:#94a3b8">0</span>'}</td>
              <td>${x.renovadas || '<span style="color:#94a3b8">0</span>'}</td>
              <td style="color:#94a3b8;font-size:.85rem;">${Math.round((x.total / tot.t) * 100)}%</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p style="text-align:right;font-size:.8rem;color:#94a3b8;margin-top:10px;padding-right:12px;">
        Total: <strong>${tot.t}</strong> · Nuevas: <strong>${tot.n}</strong> · Renovadas: <strong>${tot.r}</strong>
      </p>`;
  };
})();