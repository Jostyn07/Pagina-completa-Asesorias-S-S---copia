/* ============================================================================
 * Ruta en el repo: js/polizas_firma_docusign.js
 * Pólizas → vista rápida (modal al hacer clic en una póliza):
 * casilla "Tiene firma (DocuSign)" en el encabezado, junto al número.
 *   - Marcada: verde, con quién la marcó y cuándo.
 *   - Se puede marcar o quitar desde aquí (quitar pide confirmación).
 *   - Queda en el Historial igual que desde la ficha (lo hace la base de datos).
 * Requiere sql/firma_docusign.sql. Si no está, el modal queda como antes.
 * Se carga DESPUÉS de polizas.js.
 * ==========================================================================*/
(function () {
  'use strict';
  if (typeof window.abrirDetalles !== 'function') return;
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLS = 'id, firma_docusign, firma_docusign_por, firma_docusign_en';
  let actual = null;

  const fecha = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${h}:${p(d.getMinutes())} ${ap}`;
  };

  const original = window.abrirDetalles;
  window.abrirDetalles = async function (polizaId) {
    const r = await original.apply(this, arguments);
    try {
      const { data, error } = await sb().from('polizas').select(COLS).eq('id', polizaId).maybeSingle();
      if (error || !data) return r;
      actual = data;
      pintar();
    } catch (e) {}
    return r;
  };

  function pintar() {
    const header = document.querySelector('#modalContenido .modal-header');
    if (!header || !actual) return;
    let el = header.querySelector('.firma-ds');
    if (!el) {
      el = document.createElement('label');
      el.className = 'firma-ds';
      el.addEventListener('click', (e) => e.stopPropagation());
      el.addEventListener('change', cambiar);
      const cerrar = header.querySelector('.btn-close-modal');
      header.insertBefore(el, cerrar || null);
    }
    const si = !!actual.firma_docusign;
    el.classList.toggle('activa', si);
    el.innerHTML = `
      <input type="checkbox" ${si ? 'checked' : ''}>
      <span class="firma-ds-txt">
        <strong>Tiene firma (DocuSign)</strong>
        ${si && actual.firma_docusign_por ? `<small>${esc(actual.firma_docusign_por)} · ${fecha(actual.firma_docusign_en)}</small>` : ''}
      </span>`;
  }

  async function cambiar(e) {
    const cb = e.target;
    const nuevo = cb.checked;
    if (!nuevo && !confirm('¿Quitar la firma de DocuSign de esta póliza?')) { cb.checked = true; return; }
    cb.disabled = true;
    const { data, error } = await sb().from('polizas').update({ firma_docusign: nuevo }).eq('id', actual.id)
      .select(COLS).maybeSingle();
    if (error || !data) {
      alert('No se pudo guardar la firma: ' + (error?.message || 'sin acceso a esta póliza'));
      cb.checked = !nuevo; cb.disabled = false;
      return;
    }
    actual = data;
    // mantener el dato en la lista para el filtro "Firma DocuSign"
    try {
      const p = todasLasPolizas.find((x) => String(x.id) === String(data.id));
      if (p) p.firma_docusign = data.firma_docusign;
    } catch (err) {}
    pintar();
  }

  const css = document.createElement('style');
  css.textContent = `
    #modalContenido .modal-header { gap:12px; }
    #modalContenido .modal-header h2 { flex:1; }
    #modalContenido .firma-ds { display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border-radius:10px; cursor:pointer;
      background:rgba(255,255,255,.92); color:#475569; font-size:.82rem; user-select:none; border:1px solid rgba(255,255,255,.6); }
    #modalContenido .firma-ds input { width:16px; height:16px; accent-color:#16a34a; cursor:pointer; margin:0; }
    #modalContenido .firma-ds .material-symbols-rounded { font-size:20px; }
    #modalContenido .firma-ds-txt { display:flex; flex-direction:column; line-height:1.2; }
    #modalContenido .firma-ds-txt small { font-size:.7rem; opacity:.85; }
    #modalContenido .firma-ds.activa { background:#dcfce7; color:#166534; border-color:#86efac; }
    [data-theme="dark"] #modalContenido .firma-ds { background:#1a1a24; color:#cbd5e1; border-color:#2e2e3e; }
    [data-theme="dark"] #modalContenido .firma-ds.activa { background:#123322; color:#4ade80; border-color:#1f6b3d; }`;
  document.head.appendChild(css);
})();