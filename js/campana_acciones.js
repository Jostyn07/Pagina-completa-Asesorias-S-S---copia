/* ============================================================================
 * Ruta en el repo: js/campana_acciones.js
 * Campana de notificaciones:
 *   - "Marcar todo como leído" en el encabezado.
 *   - ✕ en cada notificación para borrarla (se oculta para el usuario; queda
 *     en Auditoría → Notificaciones).
 * Requiere sql/notificaciones_borrar_auditoria.sql. Si el SQL aún no está,
 * la campana funciona como antes.
 * Se carga DESPUÉS de campana_notificaciones.js.
 * ==========================================================================*/
(function () {
  'use strict';
  if (typeof window.renderizarCampana !== 'function') return;
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let conBorrado = true;   // pasa a false si la columna borrada_en no existe

  // ---- carga: sin las borradas
  window.cargarNotificacionesCampana = async function () {
    if (!campanaUsuarioId) return;
    const q = (filtrar) => {
      let c = sb().from('notificaciones_app').select('*').eq('usuario_id', campanaUsuarioId);
      if (filtrar) c = c.is('borrada_en', null);
      return c.order('created_at', { ascending: false }).limit(20);
    };
    let { data, error } = await q(conBorrado);
    if (error && conBorrado) { conBorrado = false; ({ data, error } = await q(false)); }
    if (error) { console.error('Error cargando notificaciones', error); return; }
    notificacionesCampana = data || [];
    renderizarCampana();
    actualizarBadgeCampana();
  };

  // ---- lista con ✕
  window.renderizarCampana = function () {
    pintarEncabezado();
    const cont = document.getElementById('campanaLista');
    if (!cont) return;
    if (!notificacionesCampana.length) { cont.innerHTML = '<div class="campana-vacio">No tienes notificaciones</div>'; return; }
    cont.innerHTML = notificacionesCampana.map((n) => `
      <div class="campana-item ${n.leida ? '' : 'no-leida'}" data-id="${esc(n.id)}">
        ${conBorrado ? `<button type="button" class="campana-borrar" data-borrar="${esc(n.id)}" title="Borrar"><span class="material-symbols-rounded">close</span></button>` : ''}
        <div class="campana-item-titulo">${esc(n.titulo)}</div>
        ${n.cuerpo ? `<div class="campana-item-cuerpo">${esc(n.cuerpo)}</div>` : ''}
        <div class="campana-item-fecha">${formatearFechaRelativa(n.created_at)}</div>
      </div>`).join('');
  };

  function pintarEncabezado() {
    const h = document.querySelector('#campanaPanel .campana-panel-header');
    if (!h || h.querySelector('.campana-marcar-todo')) return;
    h.classList.add('campana-header-acciones');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'campana-marcar-todo';
    b.textContent = 'Marcar todo como leído';
    b.addEventListener('click', (e) => { e.stopPropagation(); marcarTodo(b); });
    h.appendChild(b);
  }

  async function marcarTodo(btn) {
    btn.disabled = true;
    try {
      let { error } = await sb().rpc('marcar_notificaciones_leidas');
      if (error) ({ error } = await sb().from('notificaciones_app').update({ leida: true })
        .eq('usuario_id', campanaUsuarioId).eq('leida', false));
      if (error) throw error;
      notificacionesCampana.forEach((n) => { n.leida = true; });
      renderizarCampana();
      actualizarBadgeCampana();
    } catch (e) {
      console.error('No se pudieron marcar como leídas:', e);
    } finally { btn.disabled = false; }
  }

  async function borrar(id) {
    const i = notificacionesCampana.findIndex((n) => String(n.id) === String(id));
    if (i < 0) return;
    const quitada = notificacionesCampana.splice(i, 1)[0];
    renderizarCampana();
    actualizarBadgeCampana();
    const { error } = await sb().from('notificaciones_app').update({ borrada_en: new Date().toISOString() }).eq('id', id);
    if (error) {
      console.error('No se pudo borrar la notificación:', error);
      notificacionesCampana.splice(i, 0, quitada);
      renderizarCampana();
      actualizarBadgeCampana();
    }
  }

  // clics dentro de la lista: ✕ borra; el resto abre la notificación
  document.addEventListener('click', (e) => {
    const lista = e.target.closest && e.target.closest('#campanaLista');
    if (!lista) return;
    const x = e.target.closest('[data-borrar]');
    if (x) { e.stopPropagation(); borrar(x.dataset.borrar); return; }
    const item = e.target.closest('.campana-item');
    if (item && typeof clickNotificacion === 'function') clickNotificacion(item.dataset.id);
  }, true);

  const css = document.createElement('style');
  css.textContent = `
    .campana-header-acciones { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .campana-marcar-todo { border:0; background:transparent; color:#6366f1; font:inherit; font-size:.78rem; font-weight:600; cursor:pointer; padding:4px 6px; border-radius:6px; }
    .campana-marcar-todo:hover { background:rgba(99,102,241,.1); }
    .campana-marcar-todo:disabled { opacity:.5; }
    .campana-item { position:relative; padding-right:30px !important; }
    .campana-borrar { position:absolute; top:8px; right:6px; width:22px; height:22px; border:0; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .15s; }
    .campana-item:hover .campana-borrar { opacity:1; }
    .campana-borrar:hover { background:rgba(239,68,68,.1); color:#ef4444; }
    .campana-borrar .material-symbols-rounded { font-size:16px; }
    @media (hover:none) { .campana-borrar { opacity:1; } }`;
  document.head.appendChild(css);

  // la campana ya cargó antes que este archivo: volver a cargar sin las borradas
  if (typeof campanaUsuarioId !== 'undefined' && campanaUsuarioId) window.cargarNotificacionesCampana();
  else renderizarCampana();
})();