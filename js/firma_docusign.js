/* ============================================================================
 * Ruta en el repo: js/firma_docusign.js
 * Ficha de la póliza (cliente_editar): casilla "Tiene firma (DocuSign)" en
 * Información General, encima de Datos Personales.
 *   - Marcada: se ve en verde con quién la marcó y cuándo.
 *   - Se puede desmarcar (pide confirmación).
 *   - Cada cambio queda en el Historial (lo registra la base de datos).
 * Requiere sql/firma_docusign.sql. Si la columna no existe, no aparece nada.
 * Se carga DESPUÉS de cliente_editar.js.
 * ==========================================================================*/
(function () {
  'use strict';
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let poliza = null;

  const fecha = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${h}:${p(d.getMinutes())} ${ap}`;
  };

  function idPoliza() {
    try { if (typeof polizaId !== 'undefined' && polizaId) return polizaId; } catch (e) {}
    return null;
  }

  async function iniciar() {
    let pid = null;
    for (let i = 0; i < 40 && !pid; i++) { pid = idPoliza(); if (!pid) await new Promise((r) => setTimeout(r, 250)); }
    if (!pid) return;
    const { data, error } = await sb().from('polizas')
      .select('id, cliente_id, firma_docusign, firma_docusign_por, firma_docusign_en').eq('id', pid).maybeSingle();
    if (error || !data) return;   // sin el SQL: no se muestra
    poliza = data;
    pintar();
  }

  function pintar() {
    let el = document.getElementById('firmaDocusign');
    if (!el) {
      const tab = document.getElementById('tab-info-general');
      const seccion = tab && tab.querySelector('.form-section');
      if (!seccion) return;
      const fila = document.createElement('div');
      fila.className = 'firma-ds-fila';
      el = document.createElement('label');
      el.id = 'firmaDocusign';
      el.className = 'firma-ds';
      fila.appendChild(el);
      seccion.parentNode.insertBefore(fila, seccion);
      el.addEventListener('change', cambiar);
    }
    const si = !!poliza.firma_docusign;
    el.classList.toggle('activa', si);
    el.title = si && poliza.firma_docusign_por ? `${poliza.firma_docusign_por} · ${fecha(poliza.firma_docusign_en)}` : '';
    el.innerHTML = `
      <input type="checkbox" ${si ? 'checked' : ''}>
      <span class="firma-ds-txt">
        <strong>Tiene firma (DocuSign)</strong>
        ${si && poliza.firma_docusign_por ? `<small>${esc(poliza.firma_docusign_por)} · ${fecha(poliza.firma_docusign_en)}</small>` : ''}
      </span>`;
  }

  async function cambiar(e) {
    const cb = e.target;
    const nuevo = cb.checked;
    if (!nuevo && !confirm('¿Quitar la firma de DocuSign de esta póliza?')) { cb.checked = true; return; }
    cb.disabled = true;
    const { data, error } = await sb().from('polizas').update({ firma_docusign: nuevo }).eq('id', poliza.id)
      .select('id, cliente_id, firma_docusign, firma_docusign_por, firma_docusign_en').maybeSingle();
    if (error || !data) {
      alert('No se pudo guardar la firma: ' + (error?.message || 'sin acceso a esta póliza'));
      cb.checked = !nuevo; cb.disabled = false;
      return;
    }
    poliza = data;
    pintar();
    if (document.querySelector('#tab-historial.active') && typeof cargarHistorial === 'function') {
      try { cargarHistorial(poliza.cliente_id); } catch (err) {}
    }
  }

  const css = document.createElement('style');
  css.textContent = `
    .firma-ds-fila { display:flex; justify-content:flex-end; margin:0 0 12px; }
    .firma-ds { display:inline-flex; align-items:center; gap:8px; padding:7px 12px; border-radius:10px; cursor:pointer;
      border:1px solid #e2e8f0; background:#fff; color:#475569; font-size:.85rem; user-select:none; }
    .firma-ds input { width:16px; height:16px; accent-color:#16a34a; cursor:pointer; margin:0; }
    .firma-ds .material-symbols-rounded { font-size:20px; }
    .firma-ds-txt { display:flex; flex-direction:column; line-height:1.2; }
    .firma-ds-txt small { font-size:.72rem; opacity:.85; }
    .firma-ds.activa { background:#dcfce7; border-color:#86efac; color:#166534; }
    [data-theme="dark"] .firma-ds { background:#1a1a24; border-color:#2e2e3e; color:#cbd5e1; }
    [data-theme="dark"] .firma-ds.activa { background:#123322; border-color:#1f6b3d; color:#4ade80; }`;
  document.head.appendChild(css);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();