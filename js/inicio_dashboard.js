/* ============================================================================
 * Ruta en el repo: js/inicio_dashboard.js
 * Nuevo Inicio (diseño Figma "Tablero"). Todo se calcula en la base con
 * una sola llamada: supabase.rpc('dashboard_inicio').
 *
 * Seguridad de producción: si la RPC falla o no existe, se elimina el panel
 * nuevo y se vuelve a mostrar el Inicio anterior (home.js sigue cargado).
 * Se carga DESPUÉS de home.js.
 * ==========================================================================*/
(function () {
  'use strict';

  // ---- Inicio anterior (home.js) en espera ----
  // home.js descargaba TODAS las pólizas al abrir el Inicio. Con el tablero nuevo
  // esa descarga se omite; solo se hace si el tablero nuevo falla (plan B).
  const homeCargarOriginal = typeof window.cargarPolizasParaGrafico === 'function' ? window.cargarPolizasParaGrafico : null;
  if (homeCargarOriginal) window.cargarPolizasParaGrafico = async () => [];

  async function reactivarInicioAnterior() {
    if (!homeCargarOriginal) return;
    window.cargarPolizasParaGrafico = homeCargarOriginal;
    try {
      const datos = await homeCargarOriginal();
      polizasGlobales = datos;                                   // variable de home.js
      if (typeof renderizarGraficaSupervisores === 'function') renderizarGraficaSupervisores();
      if (typeof calcularTotales === 'function' && typeof actualizarEstadisticas === 'function') {
        const t = calcularTotales(datos);
        actualizarEstadisticas(t.totalPolizas, t.totalAplicantes);
      }
      if (typeof actualizarGrafico === 'function') actualizarGrafico();
      if (typeof renderizarClasificacion === 'function') renderizarClasificacion(tabClasificacionActual);
      if (typeof calcularCumpleanosEnSemana === 'function') {
        const c = document.getElementById('contadorCumpleanos');
        if (c) c.textContent = calcularCumpleanosEnSemana().length;
      }
    } catch (e) { console.error('No se pudo reactivar el Inicio anterior:', e); }
  }

  const GOOGLE_API_KEY = 'AIzaSyCeugZ-srhj6GKF_6BNe9LLv26HvBL1qYQ';   // misma clave de autocompletado_direccion.js
  // Centro aproximado de cada estado [lat, lng] para el mapa real
  const CENTROS = { AL:[32.8,-86.8],AK:[64.2,-149.5],AZ:[34.3,-111.7],AR:[34.9,-92.4],CA:[37.2,-119.5],CO:[39.0,-105.5],
    CT:[41.6,-72.7],DE:[39.0,-75.5],DC:[38.9,-77.0],FL:[28.6,-82.4],GA:[32.7,-83.4],HI:[20.8,-156.3],ID:[44.4,-114.6],
    IL:[40.0,-89.2],IN:[39.9,-86.3],IA:[42.1,-93.5],KS:[38.5,-98.4],KY:[37.5,-85.3],LA:[31.1,-92.0],ME:[45.4,-69.2],
    MD:[39.0,-76.8],MA:[42.3,-71.8],MI:[44.3,-85.4],MN:[46.3,-94.3],MS:[32.7,-89.7],MO:[38.4,-92.5],MT:[47.0,-109.6],
    NE:[41.5,-99.8],NV:[39.3,-116.6],NH:[43.7,-71.6],NJ:[40.2,-74.7],NM:[34.4,-106.1],NY:[42.9,-75.5],NC:[35.6,-79.4],
    ND:[47.5,-100.5],OH:[40.3,-82.8],OK:[35.6,-97.5],OR:[43.9,-120.6],PA:[40.9,-77.8],RI:[41.7,-71.5],SC:[33.9,-80.9],
    SD:[44.4,-100.2],TN:[35.9,-86.4],TX:[31.5,-99.3],UT:[39.3,-111.7],VT:[44.1,-72.7],VA:[37.5,-78.8],WA:[47.4,-120.5],
    WV:[38.6,-80.6],WI:[44.6,-89.9],WY:[43.0,-107.6] };
  const COLORES_DOC = { 'Permiso de trabajo': '#8b5cf6', 'Residencia': '#22b8cf', 'Ciudadanía': '#22c55e', 'Otros': '#94a3b8' };

  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const EXCLUIR_RANKING = ['jostyn aragon'];   // misma regla que el ranking actual
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const PERIODOS = [['mes', 'Este mes'], ['90d', 'Últimos 3 meses'], ['anio', 'Año actual']];
  const TXT_PERIODO = { mes: 'este mes', '90d': 'últimos 3 meses', anio: 'año actual' };
  const PERIODOS_RANKING = [...PERIODOS, ['rango', 'Rango de fechas']];
  const isoHoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fechaUS = (iso) => { const [a, m, d] = String(iso || '').split('-'); return a ? `${m}/${d}/${a}` : ''; };
  function txtRanking() {
    if (st.pRanking !== 'rango') return TXT_PERIODO[st.pRanking];
    return `del ${fechaUS(st.desde)} al ${fechaUS(st.hasta)}`;
  }

  // Mosaico [código, fila, columna]
  const MOSAICO = [
    ['WA',0,0],['MT',0,2],['ND',0,3],['MN',0,4],['WI',0,5],['MI',0,6],['NY',0,9],['VT',0,10],['NH',0,11],['ME',0,12],
    ['OR',1,0],['ID',1,1],['SD',1,3],['IA',1,4],['IL',1,5],['IN',1,6],['OH',1,7],['PA',1,8],['NJ',1,9],['MA',1,11],
    ['CA',2,0],['NV',2,1],['WY',2,2],['NE',2,3],['MO',2,4],['KY',2,5],['WV',2,6],['VA',2,7],['MD',2,8],['CT',2,10],['RI',2,11],
    ['AZ',3,1],['UT',3,2],['CO',3,3],['KS',3,4],['AR',3,5],['TN',3,6],['NC',3,8],['SC',3,9],['DE',3,10],
    ['NM',4,2],['OK',4,3],['LA',4,4],['MS',4,5],['AL',4,6],['GA',4,7],['FL',4,8],['DC',4,9],
    ['AK',5,0],['HI',5,1],['TX',5,3],
  ];
  const NOMBRES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',
    DE:'Delaware',DC:'Distrito de Columbia',FL:'Florida',GA:'Georgia',HI:'Hawái',ID:'Idaho',IL:'Illinois',IN:'Indiana',
    IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Luisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',
    MN:'Minnesota',MS:'Misisipi',MO:'Misuri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'Nuevo Hampshire',NJ:'Nueva Jersey',
    NM:'Nuevo México',NY:'Nueva York',NC:'Carolina del Norte',ND:'Dakota del Norte',OH:'Ohio',OK:'Oklahoma',OR:'Oregón',
    PA:'Pensilvania',RI:'Rhode Island',SC:'Carolina del Sur',SD:'Dakota del Sur',TN:'Tennessee',TX:'Texas',UT:'Utah',
    VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'Virginia Occidental',WI:'Wisconsin',WY:'Wyoming' };

  const st = {
    pNuevas: 'mes', pRenovadas: 'mes', pRanking: 'mes', desde: isoHoy().slice(0, 8) + '01', hasta: isoHoy(), anio: new Date().getFullYear(),
    compania: '', operador: '', registro: '', portal: '', sinCancelado: false, sinCanceladoPc: false, vista: 'polizas', estadoSel: null, zoomEstado: null, datos: null, cargando: false,
  };
  let raiz, ocultos = [];
  let mapa = null, mapaDiv = null, marcadores = {}, usarMosaico = false, promesaGoogle = null;
  let marcadoresCondado = [], buscadorLugares = null;
  const condadosCache = {};                       // código de estado → [{condado, polizas, miembros}]
  // Zoom al hacer clic en un estado (los estados grandes necesitan menos zoom)
  const ZOOM_ESTADO = { AK: 4, TX: 5, CA: 5, MT: 5, HI: 6, NV: 5, AZ: 6, NM: 6, CO: 6, WY: 6, OR: 6, ID: 5, UT: 6,
    FL: 6, MI: 6, MN: 6, NE: 6, KS: 6, SD: 6, ND: 6, OK: 6, GA: 7, NC: 7, NY: 6, IL: 6, WA: 6,
    RI: 9, DE: 8, DC: 10, CT: 8, NJ: 8, MA: 8, NH: 7, VT: 7, MD: 7 };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('es-CO');
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const opts = (lista, sel) => lista.map(([v, t]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');

  // ---------------------------------------------------------------- montaje
  function montar() {
    const main = document.querySelector('main.main-content');
    if (!main) return false;
    const titulo = main.querySelector('.page-title');
    raiz = document.createElement('section');
    raiz.id = 'idash';
    raiz.className = 'idash';
    raiz.innerHTML = esqueleto();
    if (titulo) {
      titulo.after(raiz);
      const h1 = titulo.querySelector('h1');
      if (h1) h1.innerHTML = 'Tablero<small class="idash-sub">Resumen general de la operación</small>';
    } else main.prepend(raiz);
    ocultos = [...main.children].filter((el) => el !== raiz && el !== titulo && el.style.display !== 'none');
    ocultos.forEach((el) => { el.dataset.idashOculto = '1'; el.style.display = 'none'; });
    return true;
  }

  // Pantalla de carga tipo skeleton con la misma forma del tablero
  function esqueleto() {
    const b = (cls) => `<div class="idash-sk ${cls}"></div>`;
    const card = (cont, cls = '') => `<div class="idash-card ${cls}">${cont}</div>`;
    return `<div class="idash-skeleton" aria-busy="true" aria-label="Cargando tablero">
      <div class="idash-filtros">${b('sk-sel')}${b('sk-sel')}${b('sk-sel')}${b('sk-sel')}${b('sk-btn')}</div>
      <div class="idash-kpis">${[1, 2, 3, 4].map(() => card(b('sk-ico') + b('sk-l1') + b('sk-num') + b('sk-l2'))).join('')}</div>
      <div class="idash-fila">${card(b('sk-tit') + b('sk-sub') + b('sk-mapa'))}${card(b('sk-tit') + b('sk-sub') + `<div class="sk-barras">${Array.from({ length: 12 }, (_, i) => `<i style="height:${30 + ((i * 37) % 60)}%"></i>`).join('')}</div>`)}</div>
      <div class="idash-fila">${card(b('sk-tit') + b('sk-sub') + [1, 2, 3, 4, 5].map(() => b('sk-fila')).join(''))}${card(b('sk-tit') + b('sk-sub') + [1, 2, 3].map(() => b('sk-item')).join(''))}</div>
      <div class="idash-fila idash-fila-par">${card(b('sk-tit') + b('sk-sub') + b('sk-dona'))}${card(b('sk-tit') + b('sk-sub') + b('sk-tree'))}</div>
    </div>`;
  }

  function volverAlAnterior(error) {
    console.error('Tablero nuevo no disponible, se muestra el Inicio anterior:', error);
    ocultos.forEach((el) => { el.style.display = ''; delete el.dataset.idashOculto; });
    raiz?.remove();
    raiz = null;
    reactivarInicioAnterior();
  }

  // ---------------------------------------------------------------- datos
  async function cargar() {
    if (!raiz || st.cargando) return;
    st.cargando = true;
    raiz.classList.add('idash-ocupado');
    if (!st.datos) raiz.innerHTML = esqueleto();
    try {
      const { data, error } = await sb().rpc('dashboard_inicio', {
        p_periodo_nuevas: st.pNuevas, p_periodo_renovadas: st.pRenovadas, p_periodo_ranking: st.pRanking,
        p_anio: st.anio, p_compania: st.compania || null, p_operador: st.operador || null, p_registro: st.registro || null,
        p_desde: st.pRanking === 'rango' ? st.desde : null, p_hasta: st.pRanking === 'rango' ? st.hasta : null,
        p_portal: st.portal || null, p_excluir_cancelado: st.sinCancelado, p_excluir_cancelado_pc: st.sinCanceladoPc,
      });
      if (error) throw error;
      if (!data || !data.kpis) throw new Error('Respuesta vacía de dashboard_inicio');
      st.datos = data;
      Object.keys(condadosCache).forEach((k) => delete condadosCache[k]);
      if (!st.estadoSel) st.estadoSel = (data.estados[0] || {}).codigo || null;
      pintar();
    } catch (e) {
      if (!st.datos) volverAlAnterior(e);                       // primera carga: plan B
      else (window.notyf?.error?.('No se pudo actualizar el tablero') || console.error(e));
    } finally {
      st.cargando = false;
      raiz?.classList.remove('idash-ocupado');
    }
  }

  // ---------------------------------------------------------------- render
  function pintar() {
    const d = st.datos;
    const o = d.opciones || {};
    const anioActual = new Date().getFullYear();
    const anios = [];
    for (let a = anioActual; a >= anioActual - 3; a--) anios.push([String(a), String(a)]);

    raiz.innerHTML = `
      <div class="idash-toolbar">
        <span class="idash-eyebrow">Vista general</span>
        <div class="idash-filtros">
          <label class="idash-sel"><span class="material-symbols-rounded">schedule</span>
            <select data-f="pRanking">${opts(PERIODOS_RANKING.map(([v, t]) => [v, 'Periodo: ' + t]), st.pRanking)}</select></label>
          <label class="idash-sel"><select data-f="compania">${opts([['', 'Compañía: Todas'], ...(o.companias || []).map((c) => [c, c])], st.compania)}</select></label>
          <label class="idash-sel"><select data-f="operador">${opts([['', 'Operador: Todos'], ...(o.operadores || []).map((c) => [c, c])], st.operador)}</select></label>
          <label class="idash-sel"><select data-f="registro">${opts([['', 'Registro: Todos'], ...(o.registros || []).map((c) => [c, c])], st.registro)}</select></label>
          ${(o.portales || []).length ? `<label class="idash-sel"><select data-f="portal">${opts([['', 'Portal: Todos'], ...o.portales.map((c) => [c, c])], st.portal)}</select></label>` : ''}
          <label class="idash-check"><input type="checkbox" data-f="sinCancelado" ${st.sinCancelado ? 'checked' : ''}>Excluir Cancelado</label>
          <label class="idash-check"><input type="checkbox" data-f="sinCanceladoPc" ${st.sinCanceladoPc ? 'checked' : ''}>Excluir Cancelado a P.C</label>
          <button class="idash-btn-prim" data-acc="exportar"><span class="material-symbols-rounded">download</span>Exportar resumen</button>
        </div>
      </div>

      <div class="idash-kpis">
        ${kpi('description', 'v1', 'Total de pólizas', d.kpis.total_polizas, 'Cartera registrada')}
        ${kpi('group', 'v2', 'Total de miembros', d.kpis.total_miembros, 'Titulares y dependientes que aplican')}
        ${kpi('trending_up', 'v3', 'Nuevas', d.kpis.nuevas, 'Periodo: ' + TXT_PERIODO[st.pNuevas], 'pNuevas')}
        ${kpi('autorenew', 'v4', 'Renovadas', d.kpis.renovadas, 'Periodo: ' + TXT_PERIODO[st.pRenovadas], 'pRenovadas')}
      </div>

      <div class="idash-fila">
        <div class="idash-card idash-mapa">
          <div class="idash-card-head">
            <div><h3>Distribución por estado</h3><p>Explora la cartera y navega a las pólizas de cada estado</p></div>
            <button class="idash-btn-sec" data-acc="usa" ${st.zoomEstado ? '' : 'hidden'}><span class="material-symbols-rounded">zoom_out_map</span>Ver todo EE.UU.</button>
          </div>
          <div class="idash-mapa-cuerpo">
            <div>
              ${usarMosaico
                ? `<div class="idash-leyenda">VOLUMEN <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> <span>Menos · Más</span></div>
                   <div class="idash-mosaico">${mosaico()}</div>`
                : '<div class="idash-mapa-slot"></div>'}
              ${d.sin_estado ? `<p class="idash-nota">${fmt(d.sin_estado)} pólizas sin estado registrado</p>` : ''}
            </div>
            ${detalleEstado()}
          </div>
        </div>

        <div class="idash-card idash-mensual">
          <div class="idash-card-head">
            <div><h3>Actividad mensual</h3><p>Pólizas procesadas por tipo de registro</p></div>
            <label class="idash-sel idash-sel-sm"><select data-f="anio">${opts(anios, String(st.anio))}</select></label>
          </div>
          ${grafica()}
          <div class="idash-ley-series"><span><i class="s-n"></i>Nuevas</span><span><i class="s-r"></i>Renovadas</span><span><i class="s-c"></i>Recuperadas</span></div>
        </div>
      </div>

      <div class="idash-fila">
        <div class="idash-card idash-ranking">
          <div class="idash-card-head"><div><h3>Clasificación de operadores</h3><p>Rendimiento ${esc(txtRanking())}</p></div>
            <div class="idash-rango">
              <label class="idash-sel idash-sel-sm"><select data-f="pRanking">${opts(PERIODOS_RANKING, st.pRanking)}</select></label>
              ${st.pRanking === 'rango' ? `
                <label class="idash-fecha"><span>Desde</span><input type="date" data-f="desde" value="${esc(st.desde)}" max="${esc(st.hasta)}"></label>
                <label class="idash-fecha"><span>Hasta</span><input type="date" data-f="hasta" value="${esc(st.hasta)}" min="${esc(st.desde)}"></label>` : ''}
            </div>
          </div>
          ${tablaRanking(5)}
          <div class="idash-pie"><a href="#" data-acc="ranking">Ver clasificación completa →</a></div>
        </div>

        <div class="idash-card idash-atencion">
          <div class="idash-card-head"><div><h3>Atención operativa</h3><p>Elementos que requieren seguimiento</p></div></div>
          ${atencion('payments', 'a2', `${fmt(d.atencion.pagos_pendientes)} pólizas con pagos pendientes`,
              `1 mes: ${fmt(d.atencion.pagos_1)} · 2: ${fmt(d.atencion.pagos_2)} · 3: ${fmt(d.atencion.pagos_3)} · 4+: ${fmt(d.atencion.pagos_4mas)}`, 'analisis.html')}
          ${atencion('event_busy', 'a3', `${fmt(d.atencion.seguimiento_30)} pólizas sin seguimiento hace más de 30 días`,
              `Último seguimiento hace +30 días · aparte, ${fmt(d.atencion.sin_seguimiento)} nunca han tenido seguimiento`, 'analisis.html')}
          ${atencion('schedule', 'a1', `${fmt(d.atencion.plazo_30)} pólizas con plazo Mercado en 30 días`,
              `${fmt(d.atencion.plazo_vencido)} con plazo ya vencido · sin documentos completos`, 'analisis.html#documentos')}
        </div>
      </div>

      <div class="idash-fila idash-fila-par">
        <div class="idash-card">
          <div class="idash-card-head"><div><h3>Tipos de documento</h3><p>Estado migratorio registrado del titular</p></div></div>
          ${dona()}
          ${cumpleanos()}
        </div>
        <div class="idash-card">
          <div class="idash-card-head"><div><h3>Clientes por compañía</h3><p>Entre más clientes, más grande el recuadro</p></div></div>
          ${arbol()}
        </div>
      </div>`;
    if (!usarMosaico) montarMapa();
    if (st.zoomEstado) { const z = st.zoomEstado; st.zoomEstado = null; seleccionarEstado(z); }
  }

  function kpi(icono, color, titulo, valor, pie, selector) {
    return `<div class="idash-card idash-kpi">
      <div class="idash-kpi-top">
        <span class="idash-ico ${color}"><span class="material-symbols-rounded">${icono}</span></span>
        <span class="idash-kpi-t">${esc(titulo)}</span>
        ${selector ? `<label class="idash-sel idash-sel-xs"><select data-f="${selector}">${opts(PERIODOS, st[selector])}</select></label>` : ''}
      </div>
      <div class="idash-kpi-v">${fmt(valor)}</div>
      <div class="idash-kpi-p">${esc(pie)}</div>
    </div>`;
  }

  function mosaico() {
    const porCodigo = {};
    (st.datos.estados || []).forEach((e) => { porCodigo[e.codigo] = e; });
    const campo = 'polizas';
    const max = Math.max(1, ...Object.values(porCodigo).map((e) => e[campo] || 0));
    return MOSAICO.map(([c, f, col]) => {
      const v = porCodigo[c]?.[campo] || 0;
      const nivel = v === 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999));
      return `<button class="idash-tile n${nivel}${st.estadoSel === c ? ' sel' : ''}" style="grid-row:${f + 1};grid-column:${col + 1}"
        data-estado="${c}" title="${esc(NOMBRES[c] || c)}: ${fmt(v)}"><b>${c}</b><small>${fmt(v)}</small></button>`;
    }).join('');
  }

  function detalleEstado() {
    const c = st.estadoSel;
    const e = (st.datos.estados || []).find((x) => x.codigo === c) || { polizas: 0, miembros: 0 };
    const total = st.datos.kpis.total_polizas || 1;
    if (!c) return '<div class="idash-destacado"><p class="idash-nota">Sin estados con pólizas.</p></div>';
    return `<div class="idash-destacado">
      <span class="idash-eyebrow">Estado destacado</span>
      <h4>${esc(NOMBRES[c] || c)}</h4><small>${c}</small>
      <span class="idash-eyebrow">Pólizas registradas</span>
      <div class="idash-big">${fmt(e.polizas)}</div>
      <span class="idash-ok">${((e.polizas / total) * 100).toFixed(1).replace('.', ',')}% de la cartera</span>
      <hr>
      <span class="idash-eyebrow">Miembros asociados</span>
      <div class="idash-med">${fmt(e.miembros)}</div>
      ${listaCondados(c)}
      <a class="idash-btn-prim idash-full" href="polizas.html?estado=${encodeURIComponent(c)}">Ver pólizas de ${esc(NOMBRES[c] || c)} →</a>
    </div>`;
  }

  function listaCondados(c) {
    if (st.zoomEstado !== c) return '';
    const lista = condadosCache[c];
    if (!lista) return '<hr><span class="idash-eyebrow">Condados</span><div class="idash-sk sk-l2" style="width:100%;height:60px;margin-top:8px"></div>';
    if (!lista.length) return '<hr><p class="idash-nota">Sin condados registrados.</p>';
    return `<hr><span class="idash-eyebrow">Condados con clientes (${fmt(lista.filter((x) => x.condado !== 'Sin condado').length)})</span>
      <ul class="idash-condados">${lista.map((x) => `<li><a href="polizas.html?estado=${encodeURIComponent(c)}&condado=${encodeURIComponent(x.condado)}"
        title="${fmt(x.miembros)} miembros · ver pólizas"><span>${esc(x.condado)}</span><b>${fmt(x.polizas)}</b></a></li>`).join('')}</ul>`;
  }

  function grafica() {
    const m = st.datos.mensual || [];
    const max = Math.max(1, ...m.flatMap((x) => [x.nuevas, x.renovadas, x.recuperadas]));
    const h = (v) => `${Math.max(v ? 2 : 0, (v / max) * 100)}%`;
    return `<div class="idash-barras">${m.map((x) => `
      <div class="idash-mes" title="${MESES[x.mes - 1]}: ${fmt(x.nuevas)} nuevas · ${fmt(x.renovadas)} renovadas · ${fmt(x.recuperadas)} recuperadas">
        <div class="idash-grupo"><i class="s-n" style="height:${h(x.nuevas)}"></i><i class="s-r" style="height:${h(x.renovadas)}"></i><i class="s-c" style="height:${h(x.recuperadas)}"></i></div>
        <span>${MESES[x.mes - 1]}</span>
      </div>`).join('')}</div>`;
  }

  function filasRanking() {
    return (st.datos.ranking || []).filter((r) => !EXCLUIR_RANKING.includes(norm(r.operador)));
  }

  function tablaRanking(limite, completa) {
    const filas = filasRanking();
    const lista = completa ? filas : filas.filter((r) => r.total > 0).slice(0, limite);
    const suma = filas.reduce((a, r) => a + r.total, 0) || 1;
    if (!lista.length) return '<p class="idash-vacio">Sin actividad en el periodo.</p>';
    return `<div class="idash-tabla-wrap"><table class="idash-tabla">
      <thead><tr><th>Operador</th><th>Total</th><th>Nuevas</th><th>Renovadas</th>${completa ? '<th>Recuperadas</th><th>Activos</th>' : ''}<th>% del total</th></tr></thead>
      <tbody>${lista.map((r, i) => `<tr>
        <td><span class="idash-pos">${String(i + 1).padStart(2, '0')}</span>${esc(r.operador)}</td>
        <td><span class="idash-pill">${fmt(r.total)}</span></td><td>${fmt(r.nuevas)}</td><td>${fmt(r.renovadas)}</td>
        ${completa ? `<td>${fmt(r.recuperadas)}</td><td>${fmt(r.activos)}</td>` : ''}
        <td>${((r.total / suma) * 100).toFixed(1).replace('.', ',')}%</td></tr>`).join('')}</tbody></table></div>`;
  }

  function atencion(icono, color, titulo, sub, href) {
    return `<a class="idash-at" href="${href}"><span class="idash-ico ${color}"><span class="material-symbols-rounded">${icono}</span></span>
      <span><b>${esc(titulo)}</b><small>${esc(sub)}</small></span><span class="material-symbols-rounded idash-flecha">chevron_right</span></a>`;
  }

  // ---------------------------------------------------------------- mapa real (Google Maps)
  function cargarGoogle() {
    if (window.google?.maps?.Map) return Promise.resolve();
    if (promesaGoogle) return promesaGoogle;
    promesaGoogle = new Promise((ok, mal) => {
      const cb = '__idashGoogle' + Date.now();
      window[cb] = () => ok();
      const sc = document.createElement('script');
      sc.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&callback=${cb}&loading=async`;
      sc.async = true;
      sc.onerror = () => mal(new Error('No cargó Google Maps'));
      document.head.appendChild(sc);
      setTimeout(() => mal(new Error('Google Maps tardó demasiado')), 12000);
    });
    // Si la clave no tiene permiso de mapas, Google llama a esta función global
    const previo = window.gm_authFailure;
    window.gm_authFailure = () => { pasarAMosaico(new Error('Clave de Google sin permiso de Maps')); if (typeof previo === 'function') previo(); };
    return promesaGoogle;
  }

  function pasarAMosaico(e) {
    if (usarMosaico) return;
    console.warn('Mapa real no disponible, se usa el mosaico:', e);
    usarMosaico = true;
    if (st.datos) pintar();
  }

  const ESTILO_OSCURO = [
    { elementType: 'geometry', stylers: [{ color: '#1d1d27' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8a8aa0' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d27' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3b3b4d' }] },
    { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4a4a60' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#121218' }] },
  ];

  async function montarMapa() {
    const slot = raiz?.querySelector('.idash-mapa-slot');
    if (!slot) return;
    if (!mapaDiv) { mapaDiv = document.createElement('div'); mapaDiv.className = 'idash-gmap'; }
    slot.appendChild(mapaDiv);                       // el mapa se reutiliza entre repintados
    try {
      await cargarGoogle();
      if (usarMosaico) return;
      const oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
      if (!mapa) {
        mapa = new google.maps.Map(mapaDiv, {
          center: { lat: 38.5, lng: -96 }, zoom: 4, minZoom: 3, maxZoom: 8,
          styles: oscuro ? ESTILO_OSCURO : [], disableDefaultUI: true, zoomControl: true,
          fullscreenControl: true, gestureHandling: 'cooperative', clickableIcons: false,
        });
      }
      actualizarMarcadores();
    } catch (e) { pasarAMosaico(e); }
  }

  function actualizarMarcadores() {
    if (!mapa) return;
    const campo = 'polizas';
    const lista = (st.datos.estados || []).filter((e) => CENTROS[e.codigo] && e[campo] > 0);
    const max = Math.max(1, ...lista.map((e) => e[campo]));
    Object.values(marcadores).forEach((m) => m.setMap(null));
    marcadores = {};
    lista.forEach((e) => {
      const v = e[campo];
      const sel = st.estadoSel === e.codigo;
      const m = new google.maps.Marker({
        map: mapa,
        position: { lat: CENTROS[e.codigo][0], lng: CENTROS[e.codigo][1] },
        title: `${NOMBRES[e.codigo] || e.codigo}: ${fmt(e.polizas)} pólizas · ${fmt(e.miembros)} miembros`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE, scale: 6 + 20 * Math.sqrt(v / max),
          fillColor: sel ? '#a78bfa' : '#7c5cf5', fillOpacity: sel ? 0.95 : 0.7,
          strokeColor: sel ? '#ffffff' : '#c4b5fd', strokeWeight: sel ? 2 : 1,
        },
        label: v / max > 0.08 ? { text: e.codigo, color: '#fff', fontSize: '10px', fontWeight: '700' } : null,
        zIndex: sel ? 1000 : Math.round(v),
        visible: st.zoomEstado !== e.codigo,          // al acercar, el estado se muestra por condados
      });
      m.addListener('click', () => seleccionarEstado(e.codigo));
      marcadores[e.codigo] = m;
    });
  }

  // ---------------------------------------------------------------- detalle por condado
  async function seleccionarEstado(c) {
    st.estadoSel = c;
    st.zoomEstado = c;
    raiz.querySelector('[data-acc="usa"]')?.removeAttribute('hidden');
    if (mapa && CENTROS[c]) {
      mapa.panTo({ lat: CENTROS[c][0], lng: CENTROS[c][1] });
      mapa.setZoom(ZOOM_ESTADO[c] || 7);
    }
    refrescarEstado();
    try {
      if (!condadosCache[c]) {
        const { data, error } = await sb().rpc('dashboard_condados', {
          p_estado: c, p_compania: st.compania || null, p_operador: st.operador || null, p_registro: st.registro || null,
        });
        if (error) throw error;
        condadosCache[c] = data || [];
      }
    } catch (e) {
      console.warn('No se pudieron cargar los condados:', e);
      condadosCache[c] = [];
    }
    if (st.zoomEstado !== c) return;                 // el usuario ya eligió otro estado
    refrescarEstado();
    pintarCondadosEnMapa(c);
  }

  function verTodoUSA() {
    st.zoomEstado = null;
    limpiarCondados();
    raiz.querySelector('[data-acc="usa"]')?.setAttribute('hidden', '');
    if (mapa) { mapa.panTo({ lat: 38.5, lng: -96 }); mapa.setZoom(4); }
    refrescarEstado();
  }

  function limpiarCondados() {
    marcadoresCondado.forEach((m) => m.setMap(null));
    marcadoresCondado = [];
  }

  // Ubica cada condado con Google Places (misma clave del autocompletado) y guarda la posición
  // en el navegador para no volver a consultarla.
  function ubicarCondado(condado, c) {
    const clave = `idash_cnd_${c}_${condado}`;
    try { const g = localStorage.getItem(clave); if (g) return Promise.resolve(JSON.parse(g)); } catch (_) { /* sin almacenamiento */ }
    if (!google.maps.places) return Promise.resolve(null);
    buscadorLugares = buscadorLugares || new google.maps.places.PlacesService(mapa);
    const sufijo = c === 'LA' ? 'Parish' : 'County';
    return new Promise((ok) => {
      buscadorLugares.findPlaceFromQuery({ query: `${condado} ${sufijo}, ${NOMBRES[c] || c}, USA`, fields: ['geometry'] }, (res, estado) => {
        const loc = estado === 'OK' && res?.[0]?.geometry?.location;
        const pos = loc ? { lat: loc.lat(), lng: loc.lng() } : null;
        if (pos) { try { localStorage.setItem(clave, JSON.stringify(pos)); } catch (_) { /* sin almacenamiento */ } }
        ok(pos);
      });
    });
  }

  async function pintarCondadosEnMapa(c) {
    if (!mapa) return;
    limpiarCondados();
    actualizarMarcadores();
    const lista = (condadosCache[c] || []).filter((x) => x.condado !== 'Sin condado').slice(0, 60);
    const max = Math.max(1, ...lista.map((x) => x.polizas));
    for (const x of lista) {
      if (st.zoomEstado !== c) return;
      const pos = await ubicarCondado(x.condado, c);
      if (!pos || st.zoomEstado !== c) continue;
      marcadoresCondado.push(new google.maps.Marker({
        map: mapa, position: pos,
        title: `${x.condado}: ${fmt(x.polizas)} pólizas · ${fmt(x.miembros)} miembros`,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5 + 16 * Math.sqrt(x.polizas / max),
          fillColor: '#22b8cf', fillOpacity: 0.75, strokeColor: '#cffafe', strokeWeight: 1 },
        label: x.polizas / max > 0.15 ? { text: fmt(x.polizas), color: '#fff', fontSize: '10px', fontWeight: '700' } : null,
      }));
    }
  }

  // Cambia el estado destacado sin reconstruir el mapa
  function refrescarEstado() {
    const actual = raiz.querySelector('.idash-destacado');
    if (actual) actual.outerHTML = detalleEstado();
    if (usarMosaico) raiz.querySelectorAll('.idash-tile').forEach((t) => t.classList.toggle('sel', t.dataset.estado === st.estadoSel));
    else actualizarMarcadores();
  }

  // ---------------------------------------------------------------- dona de documentos
  function dona() {
    const d = st.datos.documentos || {};
    const orden = ['Permiso de trabajo', 'Residencia', 'Ciudadanía', 'Otros'];
    const total = orden.reduce((a, k) => a + (d[k] || 0), 0);
    if (!total) return '<p class="idash-vacio">Sin datos.</p>';
    const R = 60, C = 2 * Math.PI * R;
    let acum = 0;
    const arcos = orden.map((k) => {
      const v = d[k] || 0;
      const largo = (v / total) * C;
      const arco = v ? `<circle r="${R}" cx="80" cy="80" fill="none" stroke="${COLORES_DOC[k]}" stroke-width="26"
        stroke-dasharray="${largo} ${C - largo}" stroke-dashoffset="${-acum}" transform="rotate(-90 80 80)"><title>${k}: ${fmt(v)}</title></circle>` : '';
      acum += largo;
      return arco;
    }).join('');
    return `<div class="idash-dona">
      <svg viewBox="0 0 160 160" role="img" aria-label="Tipos de documento">${arcos}
        <text x="80" y="76" text-anchor="middle" class="idash-dona-num">${fmt(total)}</text>
        <text x="80" y="94" text-anchor="middle" class="idash-dona-txt">titulares</text></svg>
      <ul>${orden.map((k) => `<li><i style="background:${COLORES_DOC[k]}"></i><span>${k}</span>
        <b>${fmt(d[k] || 0)}</b><small>${(((d[k] || 0) / total) * 100).toFixed(1).replace('.', ',')}%</small></li>`).join('')}</ul>
    </div>`;
  }

  // ---------------------------------------------------------------- cumpleaños (hoy y mañana)
  function cumpleanos() {
    const lista = st.datos.cumpleanos || [];
    const fecha = (iso) => { const [, m, d] = String(iso || '').split('-'); return m ? `${m}/${d}` : ''; };
    const grupo = (cuando, titulo) => {
      const filas = lista.filter((x) => x.cuando === cuando);
      if (!filas.length) return '';
      return `<div class="idash-cum-grupo">${titulo}</div>${filas.map((x) => `
        <a class="idash-cum" href="cliente_editar.html?id=${encodeURIComponent(x.cliente_id)}">
          <span class="idash-cum-n"><b>${esc(x.nombre)}</b>${x.titular ? `<small>${esc(x.titular)}</small>` : ''}</span>
          <span class="idash-cum-f">${fecha(x.fecha)}</span>
          <span class="material-symbols-rounded idash-flecha">chevron_right</span>
        </a>`).join('')}`;
    };
    return `<div class="idash-cumple">
      <div class="idash-card-head"><div><h3>Cumpleaños</h3></div><span class="idash-pill">${fmt(lista.length)}</span></div>
      ${lista.length ? grupo('hoy', 'Hoy') + grupo('manana', 'Mañana') : '<p class="idash-vacio">Nadie cumple años hoy ni mañana.</p>'}
    </div>`;
  }

  // ---------------------------------------------------------------- mapa de árbol por compañía
  function squarify(items, x, y, w, h) {
    const out = [];
    let resto = items.slice();
    const peor = (fila, lado) => {
      const s = fila.reduce((a, r) => a + r.a, 0);
      const mx = Math.max(...fila.map((r) => r.a)), mn = Math.min(...fila.map((r) => r.a));
      return Math.max((lado * lado * mx) / (s * s), (s * s) / (lado * lado * mn));
    };
    while (resto.length) {
      const lado = Math.min(w, h);
      const fila = [resto[0]];
      let i = 1;
      while (i < resto.length && peor([...fila, resto[i]], lado) <= peor(fila, lado)) { fila.push(resto[i]); i++; }
      const s = fila.reduce((a, r) => a + r.a, 0);
      if (w >= h) {
        const ancho = s / h; let yy = y;
        fila.forEach((r) => { const alto = r.a / ancho; out.push({ ...r, x, y: yy, w: ancho, h: alto }); yy += alto; });
        x += ancho; w -= ancho;
      } else {
        const alto = s / w; let xx = x;
        fila.forEach((r) => { const ancho = r.a / alto; out.push({ ...r, x: xx, y, w: ancho, h: alto }); xx += ancho; });
        y += alto; h -= alto;
      }
      resto = resto.slice(i);
    }
    return out;
  }

  function arbol() {
    const lista = (st.datos.companias || []).filter((c) => c.clientes > 0);
    const total = lista.reduce((a, c) => a + c.clientes, 0);
    if (!total) return '<p class="idash-vacio">Sin datos.</p>';
    const W = 100, H = 50;   // proporción del recuadro (CSS aspect-ratio 2/1)
    const rects = squarify(lista.map((c) => ({ ...c, a: (c.clientes / total) * W * H })), 0, 0, W, H);
    return `<div class="idash-arbol">${rects.map((r, i) => {
      const pct = ((r.clientes / total) * 100).toFixed(1).replace('.', ',');
      const grande = r.w > 14 && r.h > 9;
      return `<div class="idash-hoja t${Math.min(i, 7)}" style="left:${r.x / W * 100}%;top:${r.y / H * 100}%;width:${r.w / W * 100}%;height:${r.h / H * 100}%"
        title="${esc(r.nombre)}: ${fmt(r.clientes)} clientes (${pct}%)">
        ${r.w > 6 && r.h > 5 ? `<span>${esc(r.nombre)}</span>` : ''}${grande ? `<small>${fmt(r.clientes)} · ${pct}%</small>` : ''}</div>`;
    }).join('')}</div>`;
  }

  // ---------------------------------------------------------------- acciones
  function modalRanking() {
    const fondo = document.createElement('div');
    fondo.className = 'idash-modal-fondo';
    fondo.innerHTML = `<div class="idash-modal idash" role="dialog" aria-modal="true">
      <div class="idash-card-head"><div><h3>Clasificación completa</h3><p>Periodo: ${esc(txtRanking())} · Activos = pólizas activas en compañía (total cartera)</p></div>
      <button class="idash-x" aria-label="Cerrar"><span class="material-symbols-rounded">close</span></button></div>
      ${tablaRanking(0, true)}</div>`;
    const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = (e) => { if (e.key === 'Escape') cerrar(); };
    fondo.addEventListener('click', (e) => { if (e.target === fondo || e.target.closest('.idash-x')) cerrar(); });
    document.addEventListener('keydown', esc_);
    document.body.appendChild(fondo);
  }

  async function exportar() {
    try {
      const { data: ok } = await sb().rpc('tiene_permiso', { p_clave: 'exportar_inicio' });
      if (!ok) { (window.notyf?.error?.('No tienes permiso para exportar el resumen') || alert('No tienes permiso para exportar el resumen')); return; }
    } catch (e) { console.warn('No se pudo validar el permiso', e); return; }
    const d = st.datos;
    const L = [];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    L.push(['Resumen Inicio', d.hoy].map(q).join(','));
    L.push(['Filtros', `Compañía: ${st.compania || 'Todas'}`, `Operador: ${st.operador || 'Todos'}`, `Registro: ${st.registro || 'Todos'}`].map(q).join(','));
    L.push('');
    L.push(['Indicador', 'Valor', 'Periodo'].map(q).join(','));
    L.push(['Total pólizas', d.kpis.total_polizas, ''].map(q).join(','));
    L.push(['Total miembros', d.kpis.total_miembros, ''].map(q).join(','));
    L.push(['Nuevas', d.kpis.nuevas, TXT_PERIODO[st.pNuevas]].map(q).join(','));
    L.push(['Renovadas', d.kpis.renovadas, TXT_PERIODO[st.pRenovadas]].map(q).join(','));
    L.push(['Plazo Mercado ≤ 30 días', d.atencion.plazo_30, ''].map(q).join(','));
    L.push(['Plazo Mercado vencido', d.atencion.plazo_vencido, ''].map(q).join(','));
    L.push(['Pólizas con pagos pendientes', d.atencion.pagos_pendientes, ''].map(q).join(','));
    L.push(['Sin seguimiento > 30 días', d.atencion.seguimiento_30, ''].map(q).join(','));
    L.push('');
    L.push(['Tipo de documento', 'Titulares'].map(q).join(','));
    Object.entries(d.documentos || {}).forEach(([k, v]) => L.push([k, v].map(q).join(',')));
    L.push('');
    L.push(['Compañía', 'Clientes'].map(q).join(','));
    (d.companias || []).forEach((c) => L.push([c.nombre, c.clientes].map(q).join(',')));
    L.push('');
    L.push(['Operador', 'Total', 'Nuevas', 'Renovadas', 'Recuperadas', 'Activos'].map(q).join(','));
    filasRanking().forEach((r) => L.push([r.operador, r.total, r.nuevas, r.renovadas, r.recuperadas, r.activos].map(q).join(',')));
    L.push('');
    L.push(['Estado', 'Pólizas', 'Miembros'].map(q).join(','));
    (d.estados || []).forEach((e) => L.push([e.codigo, e.polizas, e.miembros].map(q).join(',')));
    L.push('');
    L.push(['Mes ' + st.anio, 'Nuevas', 'Renovadas', 'Recuperadas'].map(q).join(','));
    (d.mensual || []).forEach((m) => L.push([MESES[m.mes - 1], m.nuevas, m.renovadas, m.recuperadas].map(q).join(',')));
    const blob = new Blob(['﻿' + L.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `resumen_inicio_${d.hoy}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function eventos() {
    raiz.addEventListener('change', (e) => {
      const f = e.target.dataset.f;
      if (!f) return;
      if ((f === 'desde' || f === 'hasta') && !e.target.value) return;     // fecha incompleta: no recarga
      st[f] = e.target.type === 'checkbox' ? e.target.checked : (f === 'anio' ? Number(e.target.value) : e.target.value);
      if (st.desde > st.hasta) { if (f === 'desde') st.hasta = st.desde; else st.desde = st.hasta; }
      cargar();
    });
    raiz.addEventListener('click', (e) => {
      const t = e.target.closest('[data-estado],[data-acc]');
      if (!t) return;
      if (t.dataset.estado) seleccionarEstado(t.dataset.estado);
      else if (t.dataset.acc === 'usa') verTodoUSA();
      else if (t.dataset.acc === 'ranking') { e.preventDefault(); modalRanking(); }
      else if (t.dataset.acc === 'exportar') exportar();
    });
  }

  let intentos = 0;
  function iniciar() {
    if (!sb()) { if (++intentos < 60) setTimeout(iniciar, 150); return; }
    try {
      if (!montar()) return;
      eventos();
      cargar();
    } catch (e) { volverAlAnterior(e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();