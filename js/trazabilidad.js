(function () {
  'use strict';
  const sb = () => window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('es-CO');
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const us = (s) => { const [a, m, d] = String(s || '').split('-'); return a ? `${m}/${d}/${a}` : ''; };
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // [campo, título, ¿subir es bueno?]
  const INDICADORES = [
    ['polizas', 'Pólizas', true], ['miembros', 'Miembros', true],
    ['activas_mercado', 'Activas (Mercado)', true], ['activas_compania', 'Activas (Compañía)', true],
    ['canceladas', 'Canceladas', false], ['nuevas', 'Nuevas del día', true], ['renovadas', 'Renovadas del día', true],
    ['pagos_pendientes', 'Pagos pendientes', false], ['sin_seguimiento', 'Sin seguimiento +30 días', false],
  ];

  const st = { anio: String(new Date().getFullYear()), dimension: 'total', valor: 'Todas', fechas: [], puedeMeta: false, operadores: [] };
  let chEvo = null, chVentas = null;

  function avisar(msg) { (window.notyf?.error?.(msg)) || console.warn(msg); }

  // ---------------------------------------------------------------- comparativo
  async function cargarFechas() {
    const { data, error } = await sb().from('foto_diaria').select('fecha, anio_ef').eq('dimension', 'total').order('fecha', { ascending: false }).limit(2000);
    if (error) throw error;
    st.fechas = [...new Set((data || []).map((x) => x.fecha))];
    const anios = [...new Set((data || []).map((x) => x.anio_ef))].filter((a) => /^\d{4}$/.test(a)).sort().reverse();
    if (!anios.includes(st.anio) && anios.length) st.anio = anios.find((a) => a <= st.anio) || anios[0];
    $('tzAnio').innerHTML = anios.map((a) => `<option value="${a}"${a === st.anio ? ' selected' : ''}>Año ${a}</option>`).join('');
    const b = st.fechas[0] || iso(new Date());
    const a = st.fechas[1] || b;
    $('tzFechaB').value = b;
    $('tzFechaA').value = a;
  }

  async function cargarValores() {
    const sel = $('tzValor');
    if (st.dimension === 'total') { sel.hidden = true; st.valor = 'Todas'; return; }
    const ult = st.fechas[0];
    const { data } = await sb().from('foto_diaria').select('valor, polizas').eq('anio_ef', st.anio).eq('dimension', st.dimension).eq('fecha', ult).order('polizas', { ascending: false });
    const lista = (data || []).map((x) => x.valor);
    sel.innerHTML = lista.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    sel.hidden = !lista.length;
    st.valor = lista[0] || '';
  }

  // La foto más cercana en o antes de la fecha pedida
  const fotoEnOAntes = (f) => st.fechas.find((x) => x <= f) || null;

  async function comparativo() {
    const fa = fotoEnOAntes($('tzFechaA').value), fb = fotoEnOAntes($('tzFechaB').value);
    const cont = $('tzKpis');
    if (!fa || !fb) { cont.innerHTML = '<p class="tz-vacio">Todavía no hay fotos para esas fechas.</p>'; $('tzComparaFechas').textContent = ''; return; }
    const { data, error } = await sb().from('foto_diaria').select('*').eq('anio_ef', st.anio).eq('dimension', st.dimension).eq('valor', st.valor).in('fecha', [fa, fb]);
    if (error) { avisar('No se pudo cargar el comparativo'); return; }
    const A = (data || []).find((x) => x.fecha === fa) || {};
    const B = (data || []).find((x) => x.fecha === fb) || {};
    $('tzComparaFechas').textContent = `${us(fa)} → ${us(fb)}`;
    cont.innerHTML = INDICADORES.map(([k, t, subeBien]) => {
      const a = A[k] || 0, b = B[k] || 0, d = b - a;
      const cls = d === 0 ? 'igual' : (d > 0 ? (subeBien ? 'sube-bien' : 'sube-mal') : (subeBien ? 'baja-mal' : 'baja-bien'));
      const pct = a ? ` (${d > 0 ? '+' : ''}${((d / a) * 100).toFixed(1).replace('.', ',')}%)` : '';
      return `<div class="tz-kpi"><div class="tz-kpi-t">${esc(t)}</div><div class="tz-kpi-v">${fmt(b)}</div>
        <div class="tz-kpi-d ${cls}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '= '}${fmt(d)}${pct}</div><div class="tz-kpi-a">Antes: ${fmt(a)}</div></div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- evolución
  async function evolucion() {
    const dias = Number($('tzRango').value);
    const desde = new Date(); desde.setDate(desde.getDate() - dias);
    const { data, error } = await sb().from('foto_diaria')
      .select('fecha, polizas, activas_mercado, activas_compania, canceladas')
      .eq('anio_ef', st.anio).eq('dimension', st.dimension).eq('valor', st.valor).gte('fecha', iso(desde)).order('fecha');
    if (error) { avisar('No se pudo cargar la evolución'); return; }
    const filas = data || [];
    const series = [['polizas', 'Pólizas', '#6366f1'], ['activas_mercado', 'Activas (Mercado)', '#22c55e'],
      ['activas_compania', 'Activas (Compañía)', '#22b8cf'], ['canceladas', 'Canceladas', '#ef4444']];
    chEvo?.destroy();
    chEvo = new Chart($('tzEvolucion'), {
      type: 'line',
      data: { labels: filas.map((x) => us(x.fecha)), datasets: series.map(([k, t, c]) => ({ label: t, data: filas.map((x) => x[k]), borderColor: c, backgroundColor: c, tension: .25, pointRadius: filas.length > 60 ? 0 : 3 })) },
      options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } } },
    });
  }

  // ---------------------------------------------------------------- ventas y proyección
  async function ventas() {
    const [y, m] = $('tzMes').value.split('-').map(Number);
    const ini = new Date(y, m - 1, 1), fin = new Date(y, m, 0);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    // 30 días antes del mes para calcular el ritmo
    const base = new Date(ini); base.setDate(base.getDate() - 30);
    const operador = st.dimension === 'operador' ? st.valor : null;
    const [{ data: dias, error }, { data: metas }] = await Promise.all([
      sb().rpc('trazabilidad_ventas', { p_desde: iso(base), p_hasta: iso(fin), p_operador: operador }),
      sb().from('metas_ventas').select('tipo, meta, operador').eq('mes', iso(ini)).eq('operador', operador || ''),
    ]);
    if (error) { avisar('No se pudieron cargar las ventas'); return; }
    const lista = dias || [];
    const delMes = lista.filter((x) => x.dia >= iso(ini));
    const corte = hoy < fin ? hoy : fin;
    const transcurridos = delMes.filter((x) => new Date(x.dia + 'T00:00:00') <= corte);
    // ritmo = promedio diario de los últimos 30 días hasta hoy (o hasta fin de mes si ya pasó)
    const ult30 = lista.filter((x) => { const d = new Date(x.dia + 'T00:00:00'); return d <= corte && d > new Date(corte.getTime() - 30 * 864e5); });
    const ritmo = (k) => ult30.reduce((a, x) => a + x[k], 0) / Math.max(1, ult30.length);
    const meta = (k) => (metas || []).find((x) => x.tipo === k)?.meta ?? null;

    const acum = (k) => { let s = 0; return delMes.map((x) => (new Date(x.dia + 'T00:00:00') <= corte ? (s += x[k]) : null)); };
    const proy = (k) => {
      let s = transcurridos.reduce((a, x) => a + x[k], 0);
      const r = ritmo(k);
      return delMes.map((x) => { const d = new Date(x.dia + 'T00:00:00'); if (d < corte) return null; if (d.getTime() === corte.getTime()) return s; s += r; return Math.round(s); });
    };
    const real = (k) => transcurridos.reduce((a, x) => a + x[k], 0);
    const final = (k) => Math.round(real(k) + ritmo(k) * delMes.filter((x) => new Date(x.dia + 'T00:00:00') > corte).length);

    $('tzVentasResumen').innerHTML = ['nuevas', 'renovadas'].map((k) => {
      const t = k === 'nuevas' ? 'Nuevas' : 'Renovadas', mt = meta(k);
      return `<div class="tz-kpi"><div class="tz-kpi-t">${t} en el mes</div><div class="tz-kpi-v">${fmt(real(k))}</div>
        <div class="tz-kpi-a">Proyección a fin de mes: <b>${fmt(final(k))}</b></div>
        <div class="tz-kpi-a">Ritmo: ${ritmo(k).toFixed(1).replace('.', ',')} por día${mt != null ? ` · Meta: <b>${fmt(mt)}</b> (${Math.round((final(k) / Math.max(1, mt)) * 100)}% proyectado)` : ''}</div></div>`;
    }).join('');

    const etiquetas = delMes.map((x) => x.dia.slice(8));
    const ds = [
      { label: 'Nuevas (real)', data: acum('nuevas'), borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: .2 },
      { label: 'Nuevas (proyección)', data: proy('nuevas'), borderColor: '#8b5cf6', borderDash: [6, 4], pointRadius: 0, tension: .2 },
      { label: 'Renovadas (real)', data: acum('renovadas'), borderColor: '#22b8cf', backgroundColor: '#22b8cf', tension: .2 },
      { label: 'Renovadas (proyección)', data: proy('renovadas'), borderColor: '#22b8cf', borderDash: [6, 4], pointRadius: 0, tension: .2 },
    ];
    if (meta('nuevas') != null) ds.push({ label: 'Meta nuevas', data: delMes.map(() => meta('nuevas')), borderColor: '#f59e0b', borderDash: [2, 3], pointRadius: 0 });
    if (meta('renovadas') != null) ds.push({ label: 'Meta renovadas', data: delMes.map(() => meta('renovadas')), borderColor: '#ef4444', borderDash: [2, 3], pointRadius: 0 });
    chVentas?.destroy();
    chVentas = new Chart($('tzVentas'), {
      type: 'line', data: { labels: etiquetas, datasets: ds },
      options: { maintainAspectRatio: false, spanGaps: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } } },
    });
  }

  // ---------------------------------------------------------------- cohortes
  async function cohortes() {
    const hasta = new Date(), desde = new Date(hasta.getFullYear(), hasta.getMonth() - 11, 1);
    const { data, error } = await sb().rpc('trazabilidad_cohortes', { p_desde: iso(desde), p_hasta: iso(hasta), p_anio_ef: Number(st.anio) || null });
    const cont = $('tzCohortes');
    if (error) { cont.innerHTML = '<p class="tz-vacio">No se pudieron cargar las cohortes.</p>'; return; }
    const filas = data || [];
    if (!filas.length) { cont.innerHTML = '<p class="tz-vacio">Sin datos.</p>'; return; }
    const meses = [...new Set(filas.flatMap((f) => Object.keys(f.cancel_por_mes || {})))].sort((a, b) => (a === 'sin_fecha') - (b === 'sin_fecha') || a.localeCompare(b));
    const nombreMes = (k) => (k === 'sin_fecha' ? 'Sin fecha' : `${MESES[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`);
    cont.innerHTML = `<table class="tz-tabla"><thead><tr><th>Ingreso</th><th>Pólizas</th><th>Activas hoy</th><th>Canceladas</th><th>% cancel.</th>
      ${meses.map((k) => `<th>${nombreMes(k)}</th>`).join('')}</tr></thead><tbody>
      ${filas.map((f) => `<tr><td>${nombreMes(f.mes)}</td><td>${fmt(f.total)}</td><td>${fmt(f.activas)}</td><td>${fmt(f.canceladas)}</td>
        <td>${f.total ? ((f.canceladas / f.total) * 100).toFixed(1).replace('.', ',') : '0'}%</td>
        ${meses.map((k) => { const v = (f.cancel_por_mes || {})[k]; return `<td class="${v ? 'tz-cel-c' : ''}">${v ? fmt(v) : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table>`;
  }

  // ---------------------------------------------------------------- metas
  async function abrirMetas() {
    $('tzMetaMes').value = $('tzMes').value;
    $('tzMetaOperador').innerHTML = '<option value="">General</option>' + st.operadores.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    if (st.dimension === 'operador') $('tzMetaOperador').value = st.valor;
    await llenarMetas();
    $('tzModalMeta').hidden = false;
  }
  async function llenarMetas() {
    const mes = $('tzMetaMes').value + '-01';
    const { data } = await sb().from('metas_ventas').select('tipo, meta').eq('mes', mes).eq('operador', $('tzMetaOperador').value);
    $('tzMetaNuevas').value = (data || []).find((x) => x.tipo === 'nuevas')?.meta ?? '';
    $('tzMetaRenovadas').value = (data || []).find((x) => x.tipo === 'renovadas')?.meta ?? '';
  }
  async function guardarMetas() {
    const mes = $('tzMetaMes').value + '-01', operador = $('tzMetaOperador').value;
    const filas = [['nuevas', $('tzMetaNuevas').value], ['renovadas', $('tzMetaRenovadas').value]];
    try {
      for (const [tipo, v] of filas) {
        if (v === '') { await sb().from('metas_ventas').delete().eq('mes', mes).eq('tipo', tipo).eq('operador', operador); continue; }
        const { error } = await sb().from('metas_ventas').upsert({ mes, tipo, operador, meta: Number(v), actualizado_en: new Date().toISOString() }, { onConflict: 'mes,tipo,operador' });
        if (error) throw error;
      }
      $('tzModalMeta').hidden = true;
      window.notyf?.success?.('Metas guardadas');
      ventas();
    } catch (e) { avisar('No se pudieron guardar las metas: ' + (e.message || e)); }
  }

  // ---------------------------------------------------------------- inicio
  async function recargarTodo() { await Promise.all([comparativo(), evolucion(), ventas()]); }

  async function iniciar() {
    if (!sb()) return setTimeout(iniciar, 150);
    const permiso = async (k) => { try { const { data } = await sb().rpc('tiene_permiso', { p_clave: k }); return !!data; } catch (e) { return false; } };
    if (!(await permiso('ver_trazabilidad'))) { location.href = './home.html'; return; }
    st.puedeMeta = await permiso('editar_metas_ventas');
    $('tzBtnMeta').hidden = !st.puedeMeta;
    const hoy = new Date();
    $('tzMes').value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    try {
      await cargarFechas();
      const { data: ops } = await sb().from('foto_diaria').select('valor').eq('dimension', 'operador').eq('fecha', st.fechas[0] || iso(hoy));
      st.operadores = [...new Set((ops || []).map((x) => x.valor))].filter((v) => v !== 'Sin operador').sort();
    } catch (e) { avisar('Falta crear la foto diaria (sql/foto_diaria.sql)'); }

    $('tzAnio').addEventListener('change', async (e) => { st.anio = e.target.value; await cargarValores(); recargarTodo(); cohortes(); });
    $('tzDimension').addEventListener('change', async (e) => { st.dimension = e.target.value; await cargarValores(); recargarTodo(); });
    $('tzValor').addEventListener('change', (e) => { st.valor = e.target.value; recargarTodo(); });
    $('tzFechaA').addEventListener('change', comparativo);
    $('tzFechaB').addEventListener('change', comparativo);
    $('tzRango').addEventListener('change', evolucion);
    $('tzMes').addEventListener('change', ventas);
    $('tzBtnMeta').addEventListener('click', abrirMetas);
    $('tzMetaCerrar').addEventListener('click', () => { $('tzModalMeta').hidden = true; });
    $('tzMetaMes').addEventListener('change', llenarMetas);
    $('tzMetaOperador').addEventListener('change', llenarMetas);
    $('tzMetaGuardar').addEventListener('click', guardarMetas);

    recargarTodo();
    cohortes();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();