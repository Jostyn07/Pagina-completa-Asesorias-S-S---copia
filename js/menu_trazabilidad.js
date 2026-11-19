(function () {
  'use strict';
  let intentos = 0;
  async function iniciar() {
    const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    const nav = document.querySelector('.sidebar-nav');
    if (!sb || !nav) { if (++intentos < 60) setTimeout(iniciar, 200); return; }
    if (document.getElementById('menuTrazabilidad')) return;
    try {
      const { data } = await sb.rpc('tiene_permiso', { p_clave: 'ver_trazabilidad' });
      if (!data) return;
    } catch (e) { return; }
    const a = document.createElement('a');
    a.href = './trazabilidad.html';
    a.className = 'menu-item' + (/trazabilidad\.html/.test(location.pathname) ? ' active' : '');
    a.id = 'menuTrazabilidad';
    a.innerHTML = '<span class="material-symbols-rounded">timeline</span><span>Trazabilidad</span>';
    const usuarios = nav.querySelector('a[href*="usuarios.html"]');
    nav.insertBefore(a, usuarios || null);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();