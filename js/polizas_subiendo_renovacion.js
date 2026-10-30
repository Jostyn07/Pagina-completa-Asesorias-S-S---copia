(function () {
  'use strict';
  if (typeof window.cargarPolizas !== 'function' || typeof window.renderizarTabla !== 'function') return;
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let borradores = new Set();      // poliza_id de los borradores
  let porCliente = new Map();      // cliente_id de la póliza vieja → operador

  async function cargarEnCurso() {
    const { data, error } = await sb().from('renovaciones')
      .select('poliza_destino_id, cliente_origen_id, operador_nombre').eq('estado', 'en_proceso');
    if (error) throw error;
    borradores = new Set((data || []).map((r) => String(r.poliza_destino_id)).filter(Boolean));
    porCliente = new Map((data || []).filter((r) => r.cliente_origen_id)
      .map((r) => [String(r.cliente_origen_id), r.operador_nombre || '']));
  }

  function quitarBorradores() {
    if (!borradores.size) return;
    const fuera = (p) => !borradores.has(String(p.id)) &&
      String(p.estado_renovacion || '').toLowerCase() !== 'borrador';
    try { if (Array.isArray(todasLasPolizas)) todasLasPolizas = todasLasPolizas.filter(fuera); } catch (e) {}
    try { if (Array.isArray(polizasFiltradas)) polizasFiltradas = polizasFiltradas.filter(fuera); } catch (e) {}
  }

  function marcarFilas() {
    if (!porCliente.size) return;
    document.querySelectorAll('td.td1 a[href*="cliente_editar.html?id="]').forEach((a) => {
      const td = a.closest('td');
      if (!td || td.querySelector('.subiendo-renov')) return;
      const id = new URL(a.href, location.href).searchParams.get('id');
      if (!id || !porCliente.has(id)) return;
      const s = document.createElement('div');
      s.className = 'subiendo-renov';
      s.textContent = `Subiendo renovada por: ${porCliente.get(id) || '—'}`;
      td.appendChild(s);
    });
  }

  const renderOriginal = window.renderizarTabla;
  window.renderizarTabla = function () {
    quitarBorradores();
    const r = renderOriginal.apply(this, arguments);
    try { marcarFilas(); } catch (e) {}
    return r;
  };

  const cargarOriginal = window.cargarPolizas;
  window.cargarPolizas = async function () {
    const [r] = await Promise.all([
      cargarOriginal.apply(this, arguments),
      cargarEnCurso().catch((e) => console.warn('[subiendo renovada] sin datos:', e)),
    ]);
    try {
      quitarBorradores();
      renderizarTabla();
      if (typeof actualizarPaginacion === 'function') actualizarPaginacion();
    } catch (e) {}
    return r;
  };

  const css = document.createElement('style');
  css.textContent = `
    .subiendo-renov { display:inline-block; margin-top:4px; padding:2px 8px; border-radius:6px; font-size:.74rem; font-weight:600;
      background:#ede9fe; color:#5b21b6; border:1px dashed #a78bfa; white-space:nowrap; }
    [data-theme="dark"] .subiendo-renov { background:#2a2140; color:#c4b5fd; border-color:#6d55b8; }`;
  document.head.appendChild(css);
})();