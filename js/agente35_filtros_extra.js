/* ============================================================================
 * Ruta en el repo: js/agente35_filtros_extra.js
 * Agente 3.5: filtros por Portal y por Operador, junto a "Todos los estados".
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
  const filtro = { portal: '', operador: '' };

  function envolverRpc() {
    const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!sb || sb.__a35Filtros) return;
    const original = sb.rpc.bind(sb);
    sb.rpc = function (fn, args, opts) {
      if (fn === 'agente35_listar' && (filtro.portal || filtro.operador)) {
        args = Object.assign({}, args || {});
        if (filtro.portal) args.p_portales = [filtro.portal];
        if (filtro.operador) args.p_operadores = [filtro.operador];
      }
      return original(fn, args, opts);
    };
    sb.__a35Filtros = true;
  }

  function recargar() {
    const est = $('a35Estado');
    if (est) est.dispatchEvent(new Event('change'));   // agente35.js recarga desde la página 1
  }

  function crearSelect(id, todos, valores, clave) {
    const sel = document.createElement('select');
    sel.id = id;
    sel.className = 'a35-input';
    sel.innerHTML = `<option value="">${todos}</option>` + valores.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    sel.addEventListener('change', () => { filtro[clave] = sel.value; recargar(); });
    return sel;
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
    const portales = op.portales || [];
    const operadores = op.operadores || [];
    let ref = est;
    if (portales.length > 1) {
      const s = crearSelect('a35Portal', 'Todos los portales', portales, 'portal');
      ref.insertAdjacentElement('afterend', s); ref = s;
    }
    if (operadores.length > 1) {
      const s = crearSelect('a35Operador', 'Todos los operadores', operadores, 'operador');
      ref.insertAdjacentElement('afterend', s);
    }

    $('a35Limpiar')?.addEventListener('click', () => {
      filtro.portal = ''; filtro.operador = '';
      if ($('a35Portal')) $('a35Portal').value = '';
      if ($('a35Operador')) $('a35Operador').value = '';
    }, true);   // antes que el limpiar de agente35.js, para que recargue ya sin filtros
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 0));
  else setTimeout(iniciar, 0);
})();