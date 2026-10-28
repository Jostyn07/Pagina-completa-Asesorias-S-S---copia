/* ============================================================================
 * Ruta en el repo: js/menu_orden.js
 * Menú lateral personalizable: cada usuario ordena las opciones arrastrándolas
 * (o con las flechas) y el orden se guarda en su perfil (preferencias_usuario).
 * Lo carga main.js en todas las páginas. Si algo falla, el menú queda como siempre.
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__menuOrden) return;
  window.__menuOrden = true;

  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  let uid = null;
  let orden = [];          // claves en el orden del usuario
  let editando = false;
  let arrastrado = null;
  let observador = null;

  const nav = () => document.querySelector('#sidebar .sidebar-nav, .sidebar-nav');
  const items = () => Array.from(nav()?.querySelectorAll(':scope > a.menu-item') || []);

  function clave(a) {
    if (a.dataset.menuKey) return a.dataset.menuKey;
    const href = (a.getAttribute('href') || '').trim();
    let k = (href && href !== '#') ? href.split('?')[0].replace(/^\.\//, '').split('/').pop()
                                    : (a.id || a.textContent.trim().toLowerCase().replace(/\s+/g, '_'));
    a.dataset.menuKey = k;
    return k;
  }

  const lsKey = () => 'menu_orden_' + (uid || 'anon');
  function leerLocal() { try { return JSON.parse(localStorage.getItem(lsKey()) || '[]'); } catch (e) { return []; } }
  function guardarLocal() { try { localStorage.setItem(lsKey(), JSON.stringify(orden)); } catch (e) {} }

  // ------------------------------------------------------------ aplicar orden
  function aplicar() {
    const n = nav();
    if (!n || !orden.length || editando) return;
    const lista = items();
    const pos = new Map(orden.map((k, i) => [k, i]));
    // los que no están en el orden guardado (opciones nuevas) quedan al final, en su orden original
    const ordenados = lista.slice().sort((a, b) => {
      const pa = pos.has(clave(a)) ? pos.get(clave(a)) : 1000 + lista.indexOf(a);
      const pb = pos.has(clave(b)) ? pos.get(clave(b)) : 1000 + lista.indexOf(b);
      return pa - pb;
    });
    if (ordenados.every((a, i) => a === lista[i])) return;
    pausarObservador(() => ordenados.forEach((a) => n.appendChild(a)));
  }

  function pausarObservador(fn) {
    if (observador) observador.disconnect();
    fn();
    if (observador && nav()) observador.observe(nav(), { childList: true });
  }

  // ------------------------------------------------------------ guardar
  async function guardar() {
    orden = items().map(clave);
    guardarLocal();
    if (!uid || !sb()) return;
    try {
      const { error } = await sb().from('preferencias_usuario')
        .upsert({ usuario_id: uid, menu_orden: orden, actualizado_en: new Date().toISOString() }, { onConflict: 'usuario_id' });
      if (error) throw error;
    } catch (e) { console.warn('[menu_orden] no se guardó en el perfil:', e); }
  }

  // id del usuario sin esperar a la red (lo guarda el login en localStorage)
  function uidLocal() {
    try { return JSON.parse(localStorage.getItem('usuario') || 'null')?.id || null; } catch (e) { return null; }
  }

  // El orden se aplica primero desde el navegador (sin parpadeo). La base se
  // consulta una sola vez por sesión del navegador, y solo se reacomoda si cambió.
  async function cargar() {
    uid = uidLocal();
    const local = uid ? leerLocal() : [];
    if (local.length) { orden = local; aplicar(); }

    const marca = 'menu_orden_sync_' + (uid || '');
    try { if (uid && local.length && sessionStorage.getItem(marca)) return; } catch (e) {}

    try {
      if (!uid) {
        const { data: { user } } = await sb().auth.getUser();
        if (!user) return;
        uid = user.id;
      }
      const { data, error } = await sb().from('preferencias_usuario')
        .select('menu_orden').eq('usuario_id', uid).maybeSingle();
      if (error) throw error;
      const remoto = data?.menu_orden || [];
      if (remoto.length && JSON.stringify(remoto) !== JSON.stringify(orden)) {
        orden = remoto; guardarLocal(); aplicar();
      } else if (!remoto.length && orden.length) {
        guardar();   // había orden local y aún no estaba en el perfil
      }
      try { sessionStorage.setItem(marca, '1'); } catch (e) {}
    } catch (e) { console.warn('[menu_orden] usando orden local:', e); }
  }

  // ------------------------------------------------------------ edición
  function mover(a, delta) {
    const lista = items();
    const i = lista.indexOf(a);
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    if (delta < 0) nav().insertBefore(a, lista[j]);
    else nav().insertBefore(a, lista[j].nextSibling);
    a.querySelector('.mo-arriba')?.focus();
  }

  function activarEdicion(on) {
    editando = on;
    const n = nav();
    if (!n) return;
    n.classList.toggle('mo-editando', on);
    const btn = document.getElementById('btnOrdenMenu');
    if (btn) {
      btn.classList.toggle('activo', on);
      btn.innerHTML = `<span class="material-symbols-rounded">${on ? 'check' : 'swap_vert'}</span>`;
      btn.title = on ? 'Guardar orden' : 'Ordenar menú';
    }
    items().forEach((a) => {
      a.draggable = on;
      if (on) {
        if (!a.querySelector('.mo-flechas')) {
          a.insertAdjacentHTML('beforeend',
            `<span class="mo-flechas"><button type="button" class="mo-arriba" title="Subir"><span class="material-symbols-rounded">keyboard_arrow_up</span></button><button type="button" class="mo-abajo" title="Bajar"><span class="material-symbols-rounded">keyboard_arrow_down</span></button></span>`);
        }
      } else {
        a.querySelector('.mo-flechas')?.remove();
      }
    });
    if (!on) guardar();
  }

  function enlazarEventos() {
    const n = nav();
    if (!n || n.dataset.moListo) return;
    n.dataset.moListo = '1';

    // en modo edición, los enlaces no navegan
    n.addEventListener('click', (e) => {
      if (!editando) return;
      const flecha = e.target.closest('.mo-arriba, .mo-abajo');
      e.preventDefault();
      e.stopPropagation();
      if (flecha) mover(flecha.closest('a.menu-item'), flecha.classList.contains('mo-arriba') ? -1 : 1);
    }, true);

    n.addEventListener('dragstart', (e) => {
      if (!editando) return;
      arrastrado = e.target.closest('a.menu-item');
      if (!arrastrado) return;
      arrastrado.classList.add('mo-arrastrando');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', clave(arrastrado)); } catch (err) {}
    });
    n.addEventListener('dragover', (e) => {
      if (!editando || !arrastrado) return;
      e.preventDefault();
      const destino = e.target.closest('a.menu-item');
      if (!destino || destino === arrastrado) return;
      const r = destino.getBoundingClientRect();
      const despues = e.clientY > r.top + r.height / 2;
      n.insertBefore(arrastrado, despues ? destino.nextSibling : destino);
    });
    n.addEventListener('drop', (e) => { if (editando) e.preventDefault(); });
    n.addEventListener('dragend', () => { arrastrado?.classList.remove('mo-arrastrando'); arrastrado = null; });
  }

  function crearBoton() {
    if (document.getElementById('btnOrdenMenu')) return;
    const pie = document.querySelector('#sidebar .sidebar-footer, .sidebar-footer');
    if (!pie) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'btnOrdenMenu';
    b.className = 'theme-toggle mo-boton';
    b.title = 'Ordenar menú';
    b.innerHTML = '<span class="material-symbols-rounded">swap_vert</span>';
    b.addEventListener('click', () => activarEdicion(!editando));
    pie.appendChild(b);
  }

  function estilos() {
    const css = document.createElement('style');
    css.textContent = `
      .sidebar-footer { display:flex; gap:8px; align-items:center; }
      .mo-boton.activo { background:#6366f1; color:#fff; border-color:#6366f1; }
      .mo-editando a.menu-item { cursor:grab; outline:1px dashed rgba(99,102,241,.45); outline-offset:-2px; position:relative; }
      .mo-editando a.menu-item.mo-arrastrando { opacity:.4; }
      .mo-flechas { margin-left:auto; display:inline-flex; gap:2px; }
      .mo-flechas button { border:0; background:transparent; color:inherit; cursor:pointer; padding:0; width:22px; height:22px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; }
      .mo-flechas button:hover { background:rgba(99,102,241,.15); }
      .mo-flechas .material-symbols-rounded { font-size:18px; }
      .sidebar-unified.collapsed .mo-flechas { display:none; }
    `;
    document.head.appendChild(css);
  }

  function iniciar() {
    if (!nav()) return;
    estilos();
    items().forEach(clave);
    enlazarEventos();
    crearBoton();
    // opciones que se agregan después (ej. Agente 3.5, Monitoreo) se acomodan solas
    observador = new MutationObserver(() => { if (!editando) aplicar(); });
    observador.observe(nav(), { childList: true });
    if (sb()) cargar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();