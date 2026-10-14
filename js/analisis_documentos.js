(function () {
  'use strict';
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('es-CO');
  const POR_PAGINA = 25;

  const DEF = { busqueda: '', estado: 'todos', tipo: 'ambos', vencimiento: 'todos', estado_ia: 'todos', integrante: 'todos', orden: 'prioridad' };
  const F = { ...DEF };
  let pagina = 1, total = 0, filas = [], puedeExportar = false, temporizador = null;

  const CHIP_DOC = {
    completo: ['Completo', 'verde'], por_revisar: ['Por revisar', 'amarillo'],
    faltante: ['Faltante', 'rojo'], vencido: ['Vencido', 'rojo']
  };
  const CHIP_IA = {
    procesado: ['Procesado', 'verde'], revision: ['Revisión requerida', 'amarillo'],
    sin_clasificar: ['Sin clasificar', 'azul'], error: ['Error', 'rojo'], sin_documentos: ['Sin documentos', 'gris']
  };
  const chip = ([t, c]) => `<span class="ad-chip ${c}">${t}</span>`;

  function estilos() {
    if (document.getElementById('estilosAnalisisDocs')) return;
    const css = document.createElement('style');
    css.id = 'estilosAnalisisDocs';
    css.textContent = `
      #vistaAnalisisDocumentos{flex-direction:column;gap:16px;
        --ad-bg:#fff;--ad-borde:#e5e7eb;--ad-sub:#6b7280;--ad-pri:#6366f1;--ad-pri-s:#eef0ff;--ad-hover:#f8fafc;
        --ad-verde:#16a34a;--ad-verde-bg:#dcfce7;--ad-amar:#a16207;--ad-amar-bg:#fef3c7;--ad-rojo:#dc2626;--ad-rojo-bg:#fee2e2;
        --ad-azul:#2563eb;--ad-azul-bg:#dbeafe;--ad-gris:#6b7280;--ad-gris-bg:#f3f4f6}
      [data-theme="dark"] #vistaAnalisisDocumentos{
        --ad-bg:#1e2433;--ad-borde:#2e3647;--ad-sub:#9ca3af;--ad-pri:#818cf8;--ad-pri-s:#2a2f4a;--ad-hover:#252c3d;
        --ad-verde:#4ade80;--ad-verde-bg:rgba(74,222,128,.14);--ad-amar:#facc15;--ad-amar-bg:rgba(250,204,21,.14);
        --ad-rojo:#f87171;--ad-rojo-bg:rgba(248,113,113,.14);--ad-azul:#60a5fa;--ad-azul-bg:rgba(96,165,250,.14);
        --ad-gris:#9ca3af;--ad-gris-bg:rgba(156,163,175,.14)}
      .ad-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
      .ad-top h2{margin:0}.ad-top small{color:var(--ad-sub)}
      .ad-acc{display:flex;gap:8px}
      .ad-btn{display:inline-flex;align-items:center;gap:6px;border-radius:8px;padding:9px 16px;font:inherit;font-size:.85rem;font-weight:500;cursor:pointer;border:1px solid var(--ad-borde);background:var(--ad-bg);color:inherit}
      .ad-btn.pri{background:var(--ad-pri);border-color:var(--ad-pri);color:#fff}
      .ad-btn:disabled{opacity:.6;cursor:wait}
      .ad-btn .material-symbols-rounded{font-size:18px}
      .ad-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
      .ad-kpi{background:var(--ad-bg);border:1px solid var(--ad-borde);border-radius:12px;padding:16px;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:center}
      .ad-kpi .ic{grid-row:span 2;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:var(--ad-pri-s);color:var(--ad-pri)}
      .ad-kpi small{font-size:.68rem;letter-spacing:.04em;text-transform:uppercase;color:var(--ad-sub)}
      .ad-kpi strong{font-size:1.7rem;font-variant-numeric:tabular-nums;line-height:1.1}
      .ad-kpi em{grid-column:1/-1;font-style:normal;font-size:.75rem;color:var(--ad-sub)}
      .ad-card{background:var(--ad-bg);border:1px solid var(--ad-borde);border-radius:12px;padding:16px}
      .ad-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;flex-wrap:wrap}
      .ad-card-head h3{margin:0;font-size:1.05rem}.ad-card-head small{color:var(--ad-sub);font-size:.78rem}
      .ad-link{background:none;border:0;color:var(--ad-pri);cursor:pointer;font:inherit;font-size:.82rem}
      .ad-filtros{display:grid;grid-template-columns:2fr repeat(5,1fr);gap:12px}
      .ad-filtros label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;color:var(--ad-sub)}
      .ad-filtros input,.ad-filtros select,.ad-orden{padding:9px 10px;border-radius:8px;border:1px solid var(--ad-borde);background:var(--ad-bg);color:inherit;font:inherit;font-size:.85rem}
      .ad-resumen{display:flex;justify-content:space-between;gap:8px;margin-top:10px;font-size:.75rem;color:var(--ad-sub);flex-wrap:wrap}
      .ad-resumen b{background:var(--ad-amar-bg);color:var(--ad-amar);padding:4px 12px;border-radius:999px;font-weight:500}
      .ad-tabla-wrap{overflow-x:auto}
      .ad-tabla{width:100%;border-collapse:collapse;font-size:.86rem}
      .ad-tabla th{font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:var(--ad-sub);text-align:left;padding:10px 12px;background:var(--ad-hover)}
      .ad-tabla td{padding:12px;border-bottom:1px solid var(--ad-borde);vertical-align:middle}
      .ad-tabla td strong{display:block}.ad-tabla td small{color:var(--ad-sub);font-size:.72rem}
      .ad-tabla tr:hover td{background:var(--ad-hover)}
      .ad-chip{display:inline-block;padding:4px 12px;border-radius:999px;font-size:.74rem;font-weight:500;white-space:nowrap}
      .ad-chip.verde{background:var(--ad-verde-bg);color:var(--ad-verde)}.ad-chip.amarillo{background:var(--ad-amar-bg);color:var(--ad-amar)}
      .ad-chip.rojo{background:var(--ad-rojo-bg);color:var(--ad-rojo)}.ad-chip.azul{background:var(--ad-azul-bg);color:var(--ad-azul)}
      .ad-chip.gris{background:var(--ad-gris-bg);color:var(--ad-gris)}
      .ad-vence-rojo{color:var(--ad-rojo);font-weight:500}
      .ad-ver{color:var(--ad-pri);text-decoration:none;font-weight:500;white-space:nowrap}
      .ad-pag{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:.78rem;color:var(--ad-sub);flex-wrap:wrap;gap:8px}
      .ad-pag-btns{display:flex;gap:4px}
      .ad-pag-btns button{min-width:32px;height:32px;border-radius:8px;border:1px solid transparent;background:none;color:inherit;cursor:pointer;font:inherit}
      .ad-pag-btns button.act{border-color:var(--ad-pri);color:var(--ad-pri);font-weight:600}
      .ad-pag-btns button:disabled{opacity:.4;cursor:default}
      .ad-vacio{padding:28px;text-align:center;color:var(--ad-sub)}
      .ad-nota{background:var(--ad-amar-bg);color:var(--ad-amar);border-radius:8px;padding:8px 12px;font-size:.75rem}
      @media (max-width:1100px){.ad-filtros{grid-template-columns:repeat(3,1fr)}}
      @media (max-width:640px){.ad-filtros{grid-template-columns:1fr}}
    `;
    document.head.appendChild(css);
  }

  const sel = (id, label, opts) => `<label>${label}<select id="${id}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;

  function montar() {
    const nav = document.getElementById('analisisNavTabs');
    if (!nav || document.getElementById('vistaAnalisisDocumentos')) return;

    const btn = document.createElement('button');
    btn.className = 'analisis-nav-tab';
    btn.dataset.vista = 'documentos';
    btn.innerHTML = '<span class="material-symbols-rounded">folder_open</span> Documentos';
    nav.appendChild(btn);

    const vista = document.createElement('div');
    vista.id = 'vistaAnalisisDocumentos';
    vista.className = 'vista-analisis';
    vista.style.display = 'none';
    vista.innerHTML = `
      <div class="ad-top">
        <div><h2>Análisis de documentos</h2><small>Control documental de familias, vencimientos y clasificación con IA.</small></div>
        <div class="ad-acc">
          <button type="button" class="ad-btn" id="adExportar" style="display:none"><span class="material-symbols-rounded">download</span> Exportar</button>
          <button type="button" class="ad-btn pri" id="adClasificar"><span class="material-symbols-rounded">auto_awesome</span> Clasificar IA</button>
        </div>
      </div>
      <div class="ad-kpis">
        <div class="ad-kpi"><span class="ic"><span class="material-symbols-rounded">folder_shared</span></span><small>Familias con documentos</small><strong id="adK1">–</strong><em>Expedientes en cartera</em></div>
        <div class="ad-kpi"><span class="ic"><span class="material-symbols-rounded">rule</span></span><small>Documentación incompleta</small><strong id="adK2">–</strong><em id="adK2b">&nbsp;</em></div>
        <div class="ad-kpi"><span class="ic"><span class="material-symbols-rounded">event_busy</span></span><small>Vencidos o por vencer</small><strong id="adK3">–</strong><em id="adK3b">&nbsp;</em></div>
        <div class="ad-kpi"><span class="ic"><span class="material-symbols-rounded">auto_awesome</span></span><small>Pendientes de IA</small><strong id="adK4">–</strong><em>Clasificación o revisión</em></div>
      </div>
      <div class="ad-card">
        <div class="ad-card-head"><div><h3>Filtros</h3><small>Combina criterios para localizar expedientes específicos.</small></div>
          <button type="button" class="ad-link" id="adReset">Restablecer</button></div>
        <div class="ad-filtros">
          <label>Buscar familia o cliente<input id="adBusqueda" type="search" placeholder="Nombre o asesor…"></label>
          ${sel('adEstado', 'Estado general', [['todos', 'Todos'], ['completo', 'Completo'], ['incompleto', 'Incompleto'], ['por_revisar', 'Por revisar'], ['vencido', 'Vencido']])}
          ${sel('adTipo', 'Tipo de documento', [['ambos', 'Ambos'], ['estado_migratorio', 'Estado migratorio'], ['income', 'Income']])}
          ${sel('adVencimiento', 'Vencimiento', [['todos', 'Todos los periodos'], ['vencidos', 'Vencidos'], ['30', 'Próximos 30 días'], ['60', 'Próximos 60 días'], ['90', 'Próximos 90 días'], ['sin_fecha', 'Sin fecha']])}
          ${sel('adEstadoIa', 'Estado de IA', [['todos', 'Todos'], ['procesado', 'Procesado'], ['revision', 'Revisión requerida'], ['sin_clasificar', 'Sin clasificar'], ['error', 'Error']])}
          ${sel('adIntegrante', 'Integrante', [['todos', 'Todos'], ['titular', 'Titular'], ['conyuge', 'Cónyuge'], ['dependiente', 'Dependientes']])}
        </div>
        <div class="ad-resumen"><span id="adResumen"></span><b id="adTipoTxt">Estado migratorio + Income</b></div>
      </div>
      <div class="ad-card">
        <div class="ad-card-head"><div><h3>Expedientes</h3><small id="adTotal">–</small></div>
          <select class="ad-orden" id="adOrden"><option value="prioridad">Orden: prioridad</option><option value="vencimiento">Orden: vencimiento</option><option value="nombre">Orden: nombre</option></select></div>
        <div class="ad-tabla-wrap"><table class="ad-tabla">
          <thead><tr><th>Familia / cliente</th><th>Estado migratorio</th><th>Income</th><th>Vencimiento</th><th>Estado de IA</th><th>Asesor</th><th>Acción</th></tr></thead>
          <tbody id="adCuerpo"><tr><td colspan="7" class="ad-vacio">Cargando…</td></tr></tbody>
        </table></div>
        <div class="ad-pag"><span id="adPagTxt"></span><div class="ad-pag-btns" id="adPag"></div></div>
      </div>`;
    const ancla = document.getElementById('vistaRankingRenovaciones') || document.getElementById('vistaAnalisisEspecifico') || nav;
    ancla.insertAdjacentElement('afterend', vista);

    const original = window.cambiarVistaAnalisis;
    window.cambiarVistaAnalisis = function (v) {
      if (v === 'documentos') {
        document.querySelectorAll('.analisis-nav-tab').forEach((b) => b.classList.toggle('active', b.dataset.vista === 'documentos'));
        document.querySelectorAll('.vista-analisis').forEach((el) => { if (el !== vista) el.style.display = 'none'; });
        ['vistaAnalisisGeneral', 'vistaAnalisisEspecifico'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        const acciones = document.getElementById('accionesGeneral');
        if (acciones) acciones.style.display = 'none';
        vista.style.display = 'flex';
        cargar();
        return;
      }
      vista.style.display = 'none';
      if (typeof original === 'function') return original.apply(this, arguments);
    };
    btn.addEventListener('click', () => window.cambiarVistaAnalisis('documentos'));

    const mapa = { adEstado: 'estado', adTipo: 'tipo', adVencimiento: 'vencimiento', adEstadoIa: 'estado_ia', adIntegrante: 'integrante', adOrden: 'orden' };
    Object.entries(mapa).forEach(([id, k]) => document.getElementById(id).addEventListener('change', (e) => { F[k] = e.target.value; pagina = 1; cargar(); }));
    document.getElementById('adBusqueda').addEventListener('input', (e) => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { F.busqueda = e.target.value.trim(); pagina = 1; cargar(); }, 400);
    });
    document.getElementById('adReset').addEventListener('click', () => {
      Object.assign(F, DEF); pagina = 1;
      document.getElementById('adBusqueda').value = '';
      Object.entries(mapa).forEach(([id, k]) => { document.getElementById(id).value = DEF[k]; });
      cargar();
    });
    document.getElementById('adPag').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-p]');
      if (!b || b.disabled) return;
      pagina = Number(b.dataset.p); cargar();
    });
    document.getElementById('adExportar').addEventListener('click', exportar);
    document.getElementById('adClasificar').addEventListener('click', clasificarPendientes);
    if (puedeExportar) document.getElementById('adExportar').style.display = '';
  }

  const params = (limite, offset) => ({
    p_busqueda: F.busqueda || null, p_estado: F.estado, p_tipo: F.tipo, p_vencimiento: F.vencimiento,
    p_estado_ia: F.estado_ia, p_integrante: F.integrante, p_orden: F.orden, p_limite: limite, p_offset: offset
  });

  async function cargar() {
    const cuerpo = document.getElementById('adCuerpo');
    cuerpo.innerHTML = '<tr><td colspan="7" class="ad-vacio">Cargando…</td></tr>';
    const { data, error } = await sb().rpc('analisis_documentos', params(POR_PAGINA, (pagina - 1) * POR_PAGINA));
    if (error) { cuerpo.innerHTML = `<tr><td colspan="7" class="ad-vacio">No se pudo cargar: ${esc(error.message)}</td></tr>`; return; }

    const k = data.kpis || {};
    document.getElementById('adK1').textContent = num(k.familias_con_documentos);
    document.getElementById('adK2').textContent = num(k.incompletas);
    document.getElementById('adK2b').textContent = k.familias ? `${((k.incompletas / k.familias) * 100).toFixed(1)}% de las familias` : '';
    document.getElementById('adK3').textContent = num(k.vencidos_o_por_vencer);
    document.getElementById('adK3b').textContent = `${num(k.urgentes)} requieren atención urgente`;
    document.getElementById('adK4').textContent = num(k.pendientes_ia);

    total = Number(data.total || 0);
    filas = data.filas || [];
    document.getElementById('adTotal').textContent = `${num(total)} familia${total === 1 ? '' : 's'}`;
    const txt = { ambos: 'Estado migratorio + Income', estado_migratorio: 'Estado migratorio', income: 'Income' };
    document.getElementById('adTipoTxt').textContent = txt[F.tipo];
    const cambios = Object.keys(DEF).filter((x) => x !== 'orden' && F[x] !== DEF[x]).length;
    document.getElementById('adResumen').textContent = cambios ? `${cambios} filtro${cambios === 1 ? '' : 's'} activo${cambios === 1 ? '' : 's'}` : 'Mostrando todos los estados · Estado migratorio e Income · Todos los integrantes';

    cuerpo.innerHTML = filas.length ? filas.map(fila).join('') : '<tr><td colspan="7" class="ad-vacio">No hay familias con estos filtros.</td></tr>';
    paginacion();
  }

  function fila(f) {
    const integ = ['Titular', f.n_conyuge > 0 ? 'cónyuge' : null, f.n_dep > 0 ? `${f.n_dep} dependiente${f.n_dep > 1 ? 's' : ''}` : null].filter(Boolean).join(' + ');
    let vence = 'Sin fecha', clase = '';
    if (f.dias != null) {
      if (f.dias < 0) { vence = `Vencido · ${Math.abs(f.dias)} d`; clase = 'ad-vence-rojo'; }
      else if (f.dias === 0) { vence = 'Vence hoy'; clase = 'ad-vence-rojo'; }
      else vence = `En ${f.dias} día${f.dias === 1 ? '' : 's'}`;
    }
    const tipo = F.tipo;
    return `<tr>
      <td><strong>${esc(f.nombre)}</strong><small>${esc(integ)} · ${num(f.n_docs)} doc.</small></td>
      <td>${tipo === 'income' ? '<small>—</small>' : chip(CHIP_DOC[f.mig])}</td>
      <td>${tipo === 'estado_migratorio' ? '<small>—</small>' : chip(CHIP_DOC[f.inc])}</td>
      <td class="${clase}">${vence}</td>
      <td>${chip(CHIP_IA[f.ia] || CHIP_IA.sin_documentos)}</td>
      <td>${esc(f.asesor || '—')}</td>
      <td><a class="ad-ver" href="./cliente_editar.html?id=${encodeURIComponent(f.cliente_id)}&tab=documentos">Ver documentos ↗</a></td>
    </tr>`;
  }

  function paginacion() {
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const ini = total ? (pagina - 1) * POR_PAGINA + 1 : 0, fin = Math.min(pagina * POR_PAGINA, total);
    document.getElementById('adPagTxt').textContent = `Mostrando ${num(ini)}–${num(fin)} de ${num(total)} familias`;
    const set = new Set([1, paginas, pagina - 1, pagina, pagina + 1].filter((p) => p >= 1 && p <= paginas));
    const lista = [...set].sort((a, b) => a - b);
    let html = `<button data-p="${pagina - 1}" ${pagina <= 1 ? 'disabled' : ''}>‹</button>`;
    lista.forEach((p, i) => {
      if (i && p - lista[i - 1] > 1) html += '<button disabled>…</button>';
      html += `<button data-p="${p}" class="${p === pagina ? 'act' : ''}">${p}</button>`;
    });
    html += `<button data-p="${pagina + 1}" ${pagina >= paginas ? 'disabled' : ''}>›</button>`;
    document.getElementById('adPag').innerHTML = html;
  }

  // Exportar CSV con los filtros actuales (requiere permiso exportar_documentos)
  async function exportar() {
    const b = document.getElementById('adExportar');
    b.disabled = true;
    try {
      const todas = [];
      for (let off = 0; off < total; off += 200) {
        const { data, error } = await sb().rpc('analisis_documentos', params(200, off));
        if (error) throw error;
        todas.push(...(data.filas || []));
      }
      const E = { completo: 'Completo', por_revisar: 'Por revisar', faltante: 'Faltante', vencido: 'Vencido' };
      const I = { procesado: 'Procesado', revision: 'Revisión requerida', sin_clasificar: 'Sin clasificar', error: 'Error', sin_documentos: 'Sin documentos' };
      const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = ['Familia,Estado general,Estado migratorio,Income,Vencimiento,Días,Estado IA,Asesor,Documentos']
        .concat(todas.map((f) => [f.nombre, f.general, E[f.mig], E[f.inc], f.vence || '', f.dias ?? '', I[f.ia], f.asesor, f.n_docs].map(q).join(','))).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `analisis_documentos_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      if (typeof window.auditar === 'function') window.auditar('documentos.exportar', { recurso: 'analisis_documentos', detalle: { ...F, filas: todas.length } });
    } catch (e) { alert('No se pudo exportar: ' + (e.message || e)); }
    finally { b.disabled = false; }
  }

  // Clasificar con IA los documentos sin procesar de las familias en pantalla
  // (la cola masiva completa llega en la Fase 5)
  async function clasificarPendientes() {
    const b = document.getElementById('adClasificar');
    const ids = filas.filter((f) => ['sin_clasificar', 'error'].includes(f.ia)).map((f) => f.cliente_id);
    if (!ids.length) return alert('Las familias de esta página no tienen documentos pendientes de IA.');
    const { data: docs, error } = await sb().from('documentos').select('id')
      .in('cliente_id', ids).eq('vigente', true).in('estado_ia', ['sin_procesar', 'error']).limit(100);
    if (error) return alert('No se pudo consultar: ' + error.message);
    if (!docs.length) return alert('No hay documentos pendientes.');
    if (!confirm(`Se analizarán ${docs.length} documento(s) de ${ids.length} familia(s) de esta página con IA (OpenAI). Puede tardar unos minutos y tiene costo. ¿Continuar?`)) return;
    b.disabled = true;
    let ok = 0, malos = 0;
    try {
      for (let i = 0; i < docs.length; i += 5) {
        b.innerHTML = `<span class="material-symbols-rounded">hourglass_top</span> ${Math.min(i + 5, docs.length)}/${docs.length}`;
        const { data, error: e } = await sb().functions.invoke('clasificar-documento', { body: { documento_ids: docs.slice(i, i + 5).map((d) => d.id) } });
        if (e) { malos += 5; continue; }
        (data?.resultados || []).forEach((r) => (r.estado === 'procesado' || r.estado === 'no_compatible' ? ok++ : malos++));
      }
      alert(`Listo: ${ok} procesado(s)${malos ? `, ${malos} con error` : ''}. Los datos quedan «Por revisar» hasta que alguien los confirme.`);
    } finally {
      b.disabled = false;
      b.innerHTML = '<span class="material-symbols-rounded">auto_awesome</span> Clasificar IA';
      cargar();
    }
  }

  async function iniciar() {
    if (!sb()) return;
    const [{ data: ver, error }, { data: exp }] = await Promise.all([
      sb().rpc('tiene_permiso', { p_clave: 'ver_analisis_documentos' }),
      sb().rpc('tiene_permiso', { p_clave: 'exportar_documentos' })
    ]);
    if (error || !ver) return;
    puedeExportar = !!exp;
    estilos();
    montar();
    if (new URLSearchParams(location.search).get('vista') === 'documentos') window.cambiarVistaAnalisis('documentos');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();