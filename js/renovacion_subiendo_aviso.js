(function () {
  'use strict';
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function idPoliza() {
    try { if (typeof polizaId !== 'undefined' && polizaId) return polizaId; } catch (e) {}
    return null;
  }

  async function iniciar() {
    let pid = null;
    for (let i = 0; i < 40 && !pid; i++) { pid = idPoliza(); if (!pid) await new Promise((r) => setTimeout(r, 250)); }
    if (!pid) return;
    const { data, error } = await sb().from('renovaciones')
      .select('cliente_destino_id, operador_nombre, iniciada_en')
      .eq('poliza_origen_id', String(pid)).eq('estado', 'en_proceso')
      .order('id', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return;

    document.getElementById('avisoSubiendoRenov')?.remove();
    const div = document.createElement('div');
    div.id = 'avisoSubiendoRenov';
    div.className = 'aviso-subiendo-renov';
    div.innerHTML = `
      <span class="material-symbols-rounded">hourglass_top</span>
      <span>Subiendo renovada por: <strong>${esc(data.operador_nombre || '—')}</strong></span>
      ${data.cliente_destino_id ? `<a class="btn-abrir-borrador" href="./cliente_editar.html?id=${encodeURIComponent(data.cliente_destino_id)}">Abrir borrador</a>` : ''}`;
    const header = document.querySelector('.page-header');
    if (header) header.insertAdjacentElement('afterend', div);
  }

  const css = document.createElement('style');
  css.textContent = `
    .aviso-subiendo-renov { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; margin:0 0 14px;
      background:#ede9fe; color:#5b21b6; border:1px dashed #a78bfa; font-size:.9rem; }
    .aviso-subiendo-renov .material-symbols-rounded { font-size:20px; }
    .btn-abrir-borrador { margin-left:auto; padding:6px 12px; border-radius:8px; background:#7c3aed; color:#fff !important;
      text-decoration:none; font-size:.82rem; font-weight:600; }
    [data-theme="dark"] .aviso-subiendo-renov { background:#2a2140; color:#c4b5fd; border-color:#6d55b8; }`;
  document.head.appendChild(css);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();