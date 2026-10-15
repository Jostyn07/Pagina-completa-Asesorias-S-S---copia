(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const codigo = (params.get('estado') || '').trim().toUpperCase();
  const condadoUrl = (params.get('condado') || '').trim();
  if (!codigo || typeof window.cargarPolizas !== 'function') return;

  const NOMBRES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',
    DE:'Delaware',DC:'Distrito de Columbia',FL:'Florida',GA:'Georgia',HI:'Hawái',ID:'Idaho',IL:'Illinois',IN:'Indiana',
    IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Luisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',
    MN:'Minnesota',MS:'Misisipi',MO:'Misuri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'Nuevo Hampshire',NJ:'Nueva Jersey',
    NM:'Nuevo México',NY:'Nueva York',NC:'Carolina del Norte',ND:'Dakota del Norte',OH:'Ohio',OK:'Oklahoma',OR:'Oregón',
    PA:'Pensilvania',RI:'Rhode Island',SC:'Carolina del Sur',SD:'Dakota del Sur',TN:'Tennessee',TX:'Texas',UT:'Utah',
    VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'Virginia Occidental',WI:'Wisconsin',WY:'Wyoming' };
  // Variantes escritas en la base → código (mismo criterio que estado_usa_codigo en SQL)
  const VARIANTES = { arkanzas:'AR', 'carolina del sur':'SC', 'carolina del norte':'NC', pensilvania:'PA', luisiana:'LA',
    'nueva jersey':'NJ', 'nueva york':'NY', 'nuevo mexico':'NM', 'dakota del norte':'ND', 'dakota del sur':'SD',
    'virginia occidental':'WV', hawai:'HI', 'washington dc':'DC', 'district of columbia':'DC',
    alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',
    florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',
    louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',
    montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY',
    'north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI',
    'south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',
    washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY' };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const aCodigo = (s) => { const n = norm(s); if (!n) return ''; if (n.length === 2) return n.toUpperCase(); return VARIANTES[n] || ''; };
  // Mismo criterio que dashboard_condados en SQL
  const normCondado = (s) => norm(s).replace(/\s+(county|parish|condado)\s*$/, '').replace(/[-\s]+/g, ' ').trim();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);

  let activo = true;

  async function idsDelCondado(polizas) {
    const ids = [...new Set(polizas.map((p) => p.cliente?.id).filter(Boolean))];
    const buscado = normCondado(condadoUrl);
    const ok = new Set();
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await sb().from('clientes').select('id, condado').in('id', ids.slice(i, i + 300));
      if (error) throw error;
      (data || []).forEach((c) => {
        const cn = normCondado(c.condado);
        if (buscado === 'sin condado' ? !cn : cn === buscado) ok.add(c.id);
      });
    }
    return ok;
  }

  function barra(total) {
    let el = document.getElementById('barraFiltroEstado');
    if (!el) {
      el = document.createElement('div');
      el.id = 'barraFiltroEstado';
      el.className = 'pfe-barra';
      const ancla = document.querySelector('.filters-bar, .filtros, .table-container, table');
      (ancla?.parentNode || document.querySelector('main') || document.body).insertBefore(el, ancla || null);
    }
    const nombre = NOMBRES[codigo] || codigo;
    el.innerHTML = `
      <a href="./home.html" class="pfe-volver"><span class="material-symbols-rounded">arrow_back</span>Volver al tablero</a>
      <span class="pfe-chip"><span class="material-symbols-rounded">location_on</span>
        ${esc(nombre)}${condadoUrl ? ` · ${esc(condadoUrl)}` : ''} <b>${Number(total).toLocaleString('es-CO')} pólizas</b></span>
      <button type="button" class="pfe-quitar"><span class="material-symbols-rounded">close</span>Quitar filtro</button>`;
    el.querySelector('.pfe-quitar').onclick = quitar;
  }

  function quitar() {
    activo = false;
    document.getElementById('barraFiltroEstado')?.remove();
    history.replaceState(null, '', location.pathname);
    polizasFiltradas = todasLasPolizas;
    paginaActual = 1;
    renderizarTabla();
    actualizarPaginacion();
  }

  async function aplicar() {
    if (!activo || !Array.isArray(todasLasPolizas)) return;
    try {
      let lista = todasLasPolizas.filter((p) => aCodigo(p.cliente?.estado) === codigo);
      if (condadoUrl) {
        const ids = await idsDelCondado(lista);
        lista = lista.filter((p) => ids.has(p.cliente?.id));
      }
      polizasFiltradas = lista;
      paginaActual = 1;
      renderizarTabla();
      actualizarPaginacion();
      barra(lista.length);
    } catch (e) {
      console.error('No se pudo aplicar el filtro por estado; se muestran todas las pólizas:', e);
    }
  }

  // Se aplica después de la carga normal (que también restaura los filtros guardados)
  const original = window.cargarPolizas;
  window.cargarPolizas = async function (...args) {
    const r = await original.apply(this, args);
    await aplicar();
    return r;
  };

  // Estilos
  const css = document.createElement('style');
  css.textContent = `
    .pfe-barra { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:10px 0 14px; }
    .pfe-volver, .pfe-quitar { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border-radius:8px;
      border:1px solid var(--border-color, #e2e8f0); background:var(--card-background, #fff); color:inherit;
      font:inherit; font-size:.85rem; cursor:pointer; text-decoration:none; }
    .pfe-chip { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:999px;
      background:#7c5cf5; color:#fff; font-size:.85rem; font-weight:600; }
    .pfe-chip b { background:rgba(255,255,255,.2); padding:1px 8px; border-radius:999px; margin-left:4px; }
    .pfe-barra .material-symbols-rounded { font-size:18px; }`;
  document.head.appendChild(css);
})();