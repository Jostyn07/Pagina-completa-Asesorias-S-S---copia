/* ============================================================================
 * Ruta en el repo: js/agente35_filtros_extra.js
 * Agente 3.5: filtros por Portal y por Operador, junto a "Todos los estados".
 *   - Al activar "Renovación" aparecen tres opciones al lado:
 *     Todos · Completados · En proceso (borrador sin terminar).
 *   - Cada filtro aparece SOLO si el usuario puede ver más de un portal / más
 *     de un operador (según sus permisos y carteras; lo calcula la base con
 *     agente35_opciones()). Un operador que solo ve lo suyo no ve el filtro.
 *   - Se aplican a la tabla, al resumen por estado y a Exportar.
 *   - "Limpiar" también los reinicia.
 * Requiere sql/agente35_filtro_portal_operador.sql. Sin él, no aparece nada.
 * Se carga DESPUÉS de agente35.js.
 * ==========================================================================*/
(function () {
  'use strict';
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (id) => document.getElementById(id);
  const filtro = { portal: [], operador: [], renov: '' };

  function envolverRpc() {
    const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!sb || sb.__a35Filtros) return;
    const original = sb.rpc.bind(sb);
    sb.rpc = function (fn, args, opts) {
      if (fn === 'agente35_listar' && (filtro.portal.length || filtro.operador.length || filtro.renov)) {
        args = Object.assign({}, args || {});
        if (filtro.portal.length) args.p_portales = filtro.portal.slice();
        if (filtro.operador.length) args.p_operadores = filtro.operador.slice();
        if (filtro.renov) args.p_renov = filtro.renov;
      }
      return original(fn, args, opts);
    };
    sb.__a35Filtros = true;
  }

  function recargar() {
    const est = $('a35Estado');
    if (est) est.dispatchEvent(new Event('change'));   // agente35.js recarga desde la página 1
  }

  // Lista desplegable con casillas (selección múltiple). Nada marcado = todos.
  function crearMulti(id, todos, plural, valores, clave) {
    const caja = document.createElement('div');
    caja.id = id;
    caja.className = 'a35-multi';
    caja.innerHTML = `
      <button type="button" class="a35-input a35-multi-btn"><span></span><span class="material-symbols-rounded">expand_more</span></button>
      <div class="a35-multi-panel">
        <div class="a35-multi-acc"><button type="button" data-todos="1">${todos}</button></div>
        ${valores.map((v) => `<label><input type="checkbox" value="${esc(v)}"> ${esc(v)}</label>`).join('')}
      </div>`;
    const btn = caja.querySelector('.a35-multi-btn');
    const panel = caja.querySelector('.a35-multi-panel');
    const texto = () => {
      const n = filtro[clave].length;
      btn.firstElementChild.textContent = !n ? todos : n === 1 ? filtro[clave][0] : `${n} ${plural}`;
      btn.classList.toggle('a35-multi-activo', n > 0);
    };
    let timer = null;
    const cambio = () => {
      filtro[clave] = [...panel.querySelectorAll('input:checked')].map((c) => c.value);
      texto();
      clearTimeout(timer);
      timer = setTimeout(recargar, 350);   // espera a que termine de marcar
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); document.querySelectorAll('.a35-multi.abierto').forEach((m) => m !== caja && m.classList.remove('abierto')); caja.classList.toggle('abierto'); });
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.addEventListener('change', cambio);
    panel.querySelector('[data-todos]').addEventListener('click', () => { panel.querySelectorAll('input').forEach((c) => { c.checked = false; }); cambio(); });
    document.addEventListener('click', () => caja.classList.remove('abierto'));
    caja.__limpiar = () => { panel.querySelectorAll('input').forEach((c) => { c.checked = false; }); texto(); };
    texto();
    return caja;
  }

  // ---- Renovación: Todos / Completados / En proceso
  const OPC_RENOV = [['', 'Todos'], ['completados', 'Completados'], ['en_proceso', 'En proceso']];
  function pintarRenov() {
    const cont = $('a35Tipos');
    if (!cont) return;
    const chip = cont.querySelector('[data-tipo="Renovación"]');
    let grupo = $('a35RenovSub');
    if (!chip || !chip.classList.contains('activo')) {
      grupo?.remove();
      if (filtro.renov) { filtro.renov = ''; }
      return;
    }
    if (!grupo) {
      grupo = document.createElement('span');
      grupo.id = 'a35RenovSub';
      grupo.className = 'a35-renov-sub';
      grupo.addEventListener('click', (e) => {
        const b = e.target.closest('[data-renov]');
        if (!b) return;
        filtro.renov = b.dataset.renov;
        pintarBotones(grupo);
        recargar();
      });
    }
    const nuevo = !grupo.childElementCount;
    if (grupo.previousElementSibling !== chip) chip.insertAdjacentElement('afterend', grupo);
    if (nuevo) pintarBotones(grupo);
  }
  function pintarBotones(grupo) {
    grupo.innerHTML = OPC_RENOV.map(([v, t]) =>
      `<button type="button" class="a35-renov-op${filtro.renov === v ? ' activo' : ''}" data-renov="${v}">${t}</button>`).join('');
  }

  async function iniciar() {
    const est = $('a35Estado');
    const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!est || !sb) return;
    let op;
    try {
      const { data, error } = await sb.rpc('agente35_opciones');
      if (error) return;
      op = data || {};
    } catch (e) { return; }

    envolverRpc();
    const tipos = $('a35Tipos');
    if (tipos) {
      new MutationObserver((cambios) => {
        // ignorar los cambios dentro de las tres opciones (evita repintar en círculo)
        if (cambios.every((m) => m.target.closest && m.target.closest('#a35RenovSub'))) return;
        pintarRenov();
      }).observe(tipos, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      pintarRenov();
    }
    const portales = op.portales || [];
    const operadores = op.operadores || [];
    let ref = est;
    if (portales.length > 1) {
      const s = crearMulti('a35Portal', 'Todos los portales', 'portales', portales, 'portal');
      ref.insertAdjacentElement('afterend', s); ref = s;
    }
    if (operadores.length > 1) {
      const s = crearMulti('a35Operador', 'Todos los operadores', 'operadores', operadores, 'operador');
      ref.insertAdjacentElement('afterend', s);
    }

    $('a35Limpiar')?.addEventListener('click', () => {
      filtro.portal = []; filtro.operador = []; filtro.renov = '';
      $('a35Portal')?.__limpiar?.();
      $('a35Operador')?.__limpiar?.();
    }, true);   // antes que el limpiar de agente35.js, para que recargue ya sin filtros
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 0));
  else setTimeout(iniciar, 0);

  const css = document.createElement('style');
  css.textContent = `
    .a35-renov-sub { display:inline-flex; gap:2px; padding:2px; border-radius:999px; border:1px solid var(--a35-acento, #6366f1); }
    .a35-renov-op { border:0; background:transparent; color:var(--a35-txt, inherit); font:inherit; font-size:.8rem; padding:4px 10px; border-radius:999px; cursor:pointer; }
    .a35-multi { position:relative; }
    .a35-multi-btn { display:inline-flex; align-items:center; gap:6px; cursor:pointer; white-space:nowrap; max-width:220px; }
    .a35-multi-btn span:first-child { overflow:hidden; text-overflow:ellipsis; }
    .a35-multi-btn .material-symbols-rounded { font-size:18px; }
    .a35-multi-btn.a35-multi-activo { border-color:var(--a35-acento, #6366f1); color:var(--a35-acento, #6366f1); font-weight:600; }
    .a35-multi-panel { display:none; position:absolute; top:calc(100% + 4px); left:0; z-index:50; min-width:220px; max-height:300px; overflow:auto;
      background:var(--a35-card, #fff); border:1px solid var(--a35-borde, #e2e8f0); border-radius:10px; padding:6px; box-shadow:0 8px 24px rgba(0,0,0,.12); }
    .a35-multi.abierto .a35-multi-panel { display:block; }
    .a35-multi-panel label { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:.85rem; white-space:nowrap; }
    .a35-multi-panel label:hover { background:var(--a35-acento-bg, #eef2ff); }
    .a35-multi-panel input { accent-color:var(--a35-acento, #6366f1); }
    .a35-multi-acc { display:flex; gap:6px; padding:2px 4px 6px; border-bottom:1px solid var(--a35-borde, #e2e8f0); margin-bottom:4px; }
    .a35-multi-acc button { border:0; background:transparent; color:var(--a35-acento, #6366f1); font:inherit; font-size:.78rem; font-weight:600; cursor:pointer; padding:2px 4px; }
    [data-theme="dark"] .a35-multi-panel { background:#1a1a24; border-color:#2e2e3e; }
    .a35-renov-op.activo { background:var(--a35-acento, #6366f1); color:#fff; font-weight:600; }`;
  document.head.appendChild(css);
})();