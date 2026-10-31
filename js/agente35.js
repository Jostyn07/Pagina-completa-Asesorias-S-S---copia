/* ============================================================================
 * Ruta en el repo: js/agente35.js
 * Pestaña Agente 3.5: Nuevas, Ventas con registro, Renovaciones, Recuperadas y
 * Cambios de vida (vista_agente35), la más reciente primero. Con permiso
 * editar_agente35 se cambia el estado y la observación de la póliza; quién y
 * cuándo los llena la base.
 * ==========================================================================*/
(function () {
  'use strict';

  const ESTADOS = ['Pendiente', 'New application', 'Policy change', 'Procesado',
                   'Cambio necesario', 'Termination request', 'Cancelado'];
  const TIPOS = [
    { valor: ['Nueva', 'Nuevo'], texto: 'Nueva' },
    { valor: ['Venta con registro'], texto: 'Venta con registro' },
    { valor: ['Renovación'], texto: 'Renovación' },
    { valor: ['Tipo renovación'], texto: 'Tipo renovación' },
    { valor: ['Recuperada'], texto: 'Recuperada' },
    { valor: ['Cambio de vida'], texto: 'Cambio de vida' },
  ];
  const POR_PAGINA = 50;
  const ORIGEN_TXT = { 'Nueva': 'nueva', 'Venta con registro': 'de venta con registro', 'Renovación': 'renovada', 'Tipo renovación': 'tipo renovación' };

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const claseEstado = (e) => 'a35-e-' + String(e || 'Pendiente').toLowerCase().replace(/[^a-z]+/g, '-');
  const fecha = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const estado = { pagina: 1, tipos: [], filas: [], total: 0, puedeEditar: false, actual: null, timer: null };

  function toast(msg, tipo) {
    try { if (window.Notyf) { (window._a35Notyf ||= new Notyf({ duration: 3000 }))[tipo === 'error' ? 'error' : 'success'](msg); return; } } catch (e) {}
    alert(msg);
  }

  // ------------------------------------------------------------ consulta
  // Una sola llamada: página + total + conteo por estado (agente35_listar).
  function parametros() {
    const tipos = TIPOS.filter((t) => estado.tipos.includes(t.texto)).flatMap((t) => t.valor);
    const txt = $('a35Buscar').value.trim();
    return {
      p_tipos: tipos.length ? tipos : null,
      p_estado: $('a35Estado').value || null,
      p_desde: $('a35Desde').value || null,
      p_hasta: $('a35Hasta').value || null,
      p_buscar: txt || null,
      p_offset: (estado.pagina - 1) * POR_PAGINA,
      p_limit: POR_PAGINA,
    };
  }

  let solicitud = 0;
  async function cargar() {
    const tbody = $('a35Tbody');
    const mia = ++solicitud;
    if (!estado.filas.length) tbody.innerHTML = `<tr><td colspan="9" class="a35-vacio"><span class="a35-spinner"></span></td></tr>`;
    else tbody.style.opacity = '.5';
    try {
      const { data, error } = await supabaseClient.rpc('agente35_listar', parametros());
      if (mia !== solicitud) return; // llegó una respuesta más nueva
      if (error) throw error;
      estado.filas = data?.filas || [];
      estado.total = data?.total || 0;
      await cargarSubiendo();
      if (mia !== solicitud) return;
      marcarLinea();
      pintarTabla();
      pintarPaginacion();
      pintarResumen(data?.resumen || {});
    } catch (e) {
      if (mia !== solicitud) return;
      console.error('[agente35]', e);
      tbody.innerHTML = `<tr><td colspan="9" class="a35-vacio">No se pudo cargar la información</td></tr>`;
    } finally {
      if (mia === solicitud) tbody.style.opacity = '';
    }
  }

  // ------------------------------------------------------------ aviso de actualizaciones
  // Cada 60 s (solo con la pestaña visible) cuenta los cambios hechos por otros
  // desde la última carga y lo muestra junto a "Recargar". No recarga solo.
  const linea = { pol: null, ren: null, timer: null };
  const maxDe = (...v) => v.filter(Boolean).sort().pop() || null;

  async function marcarLinea() {
    try {
      const [a, b, c, d] = await Promise.all([
        supabaseClient.from('polizas').select('agente35_fecha_actualizacion').not('agente35_fecha_actualizacion', 'is', null)
          .order('agente35_fecha_actualizacion', { ascending: false }).limit(1).maybeSingle(),
        supabaseClient.from('polizas').select('agente35_evento_en').not('agente35_evento_en', 'is', null)
          .order('agente35_evento_en', { ascending: false }).limit(1).maybeSingle(),
        supabaseClient.from('renovaciones').select('iniciada_en').not('iniciada_en', 'is', null)
          .order('iniciada_en', { ascending: false }).limit(1).maybeSingle(),
        supabaseClient.from('renovaciones').select('fecha_renovacion').not('fecha_renovacion', 'is', null)
          .order('fecha_renovacion', { ascending: false }).limit(1).maybeSingle(),
      ]);
      linea.pol = maxDe(a.data?.agente35_fecha_actualizacion, b.data?.agente35_evento_en) || new Date().toISOString();
      linea.ren = maxDe(c.data?.iniciada_en, d.data?.fecha_renovacion) || new Date().toISOString();
      pintarAviso(0);
      if (!linea.timer) linea.timer = setInterval(revisarCambios, 60000);
    } catch (e) { /* sin aviso */ }
  }

  async function revisarCambios() {
    if (document.hidden || !linea.pol) return;
    try {
      const [p, r] = await Promise.all([
        supabaseClient.from('polizas').select('id', { count: 'exact', head: true })
          .or(`agente35_fecha_actualizacion.gt."${linea.pol}",agente35_evento_en.gt."${linea.pol}"`),
        supabaseClient.from('renovaciones').select('id', { count: 'exact', head: true })
          .or(`iniciada_en.gt."${linea.ren}",fecha_renovacion.gt."${linea.ren}"`),
      ]);
      if (p.error || r.error) return;
      pintarAviso((p.count || 0) + (r.count || 0));
    } catch (e) {}
  }

  function pintarAviso(n) {
    const btn = $('a35Recargar');
    if (!btn) return;
    const grupo = grupoRecarga();
    let av = $('a35Actualizaciones');
    if (!n) { av?.remove(); return; }
    if (!av) {
      av = document.createElement('button');
      av.type = 'button';
      av.id = 'a35Actualizaciones';
      av.className = 'a35-actualizaciones';
      av.addEventListener('click', () => cargar());
      grupo.insertBefore(av, btn);   // [x actualizaciones] [recargar]
    }
    av.textContent = `${n} ${n === 1 ? 'actualización' : 'actualizaciones'}`;
  }

  // ------------------------------------------------------------ exportar (permiso exportar_agente35)
  // Exporta a Excel TODAS las filas que cumplen los filtros actuales (no solo la página).
  function grupoRecarga() {
    const btn = $('a35Recargar');
    let grupo = btn.parentElement.classList.contains('a35-recarga-grupo') ? btn.parentElement : null;
    if (!grupo) {
      grupo = document.createElement('div');
      grupo.className = 'a35-recarga-grupo';
      btn.parentNode.insertBefore(grupo, btn);
      grupo.appendChild(btn);
    }
    return grupo;
  }

  function pintarExportar() {
    if ($('a35Exportar')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'a35Exportar';
    b.className = 'a35-exportar';
    b.innerHTML = '<span class="material-symbols-rounded">download</span> Exportar';
    b.addEventListener('click', () => exportar(b));
    grupoRecarga().insertBefore(b, grupoRecarga().firstChild);
  }

  function cargarExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise((ok, mal) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
      sc.onload = ok; sc.onerror = () => mal(new Error('No se pudo cargar ExcelJS'));
      document.head.appendChild(sc);
    });
  }

  async function exportar(btn) {
    const txt = btn.innerHTML;
    btn.disabled = true;
    try {
      await cargarExcelJS();
      const base = parametros();
      const filas = [];
      let total = Infinity;
      for (let off = 0; off < total; off += 200) {
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span> ${filas.length.toLocaleString('es-CO')}…`;
        const { data, error } = await supabaseClient.rpc('agente35_listar', { ...base, p_offset: off, p_limit: 200 });
        if (error) throw error;
        total = data?.total || 0;
        const lote = data?.filas || [];
        filas.push(...lote);
        if (!lote.length) break;
      }
      if (!filas.length) { toast('No hay filas para exportar', 'error'); return; }

      const ids = filas.map((r) => String(r.poliza_id));
      const sube = new Map();
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await supabaseClient.from('renovaciones').select('poliza_destino_id, operador_nombre')
          .eq('estado', 'en_proceso').in('poliza_destino_id', ids.slice(i, i + 300));
        (data || []).forEach((x) => sube.set(String(x.poliza_destino_id), x.operador_nombre || ''));
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Agente 3.5');
      ws.columns = [
        { header: 'Fecha', key: 'fecha', width: 18 },
        { header: 'Acción', key: 'accion', width: 16 },
        { header: 'Origen', key: 'origen', width: 16 },
        { header: 'Cliente', key: 'cliente', width: 32 },
        { header: 'Teléfono', key: 'tel', width: 15 },
        { header: 'Compañía', key: 'compania', width: 24 },
        { header: 'Póliza', key: 'poliza', width: 16 },
        { header: 'Operador', key: 'operador', width: 22 },
        { header: 'Estado', key: 'estado', width: 18 },
        { header: 'Observación', key: 'obs', width: 40 },
        { header: 'Subiendo renovada por', key: 'sube', width: 22 },
        { header: 'Actualizado por', key: 'por', width: 22 },
        { header: 'Actualizado', key: 'cuando', width: 18 },
      ];
      filas.forEach((r) => ws.addRow({
        fecha: fecha(r.created_at),
        accion: r.tipo === 'Nuevo' ? 'Nueva' : r.tipo,
        origen: r.origen && r.origen !== r.tipo ? r.origen : '',
        cliente: r.cliente_nombre || '', tel: r.cliente_telefono || '', compania: r.compania || '',
        poliza: r.numero_poliza || '', operador: r.operador_nombre || '', estado: r.agente35_estado || '',
        obs: r.agente35_notas || '', sube: sube.get(String(r.poliza_id)) || '',
        por: r.agente35_actualizado_por || '', cuando: fecha(r.agente35_fecha_actualizacion),
      }));
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.autoFilter = { from: 'A1', to: 'M1' };

      const buf = await wb.xlsx.writeBuffer();
      const hoy = new Date();
      const nombre = `agente35_${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}.xlsx`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast(`${filas.length.toLocaleString('es-CO')} filas exportadas`);
    } catch (e) {
      console.error('[agente35] exportar', e);
      toast('No se pudo exportar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = txt;
    }
  }

  // Borradores de renovación sin guardar: poliza_id → operador que la está subiendo
  let subiendo = new Map();
  async function cargarSubiendo() {
    try {
      const ids = estado.filas.map((r) => String(r.poliza_id)).filter(Boolean);
      if (!ids.length) { subiendo = new Map(); return; }
      const { data, error } = await supabaseClient.from('renovaciones')
        .select('poliza_destino_id, operador_nombre').eq('estado', 'en_proceso').in('poliza_destino_id', ids);
      if (error) throw error;
      subiendo = new Map((data || []).map((x) => [String(x.poliza_destino_id), x.operador_nombre || '']));
    } catch (e) { subiendo = new Map(); }
  }

  function pintarResumen(resumen) {
    const cont = $('a35Resumen');
    cont.innerHTML = ESTADOS.map((e) => `
      <button type="button" class="a35-res ${claseEstado(e)}${$('a35Estado').value === e ? ' activo' : ''}" data-estado="${esc(e)}">
        <span class="a35-res-n">${(resumen[e] || 0).toLocaleString('es-CO')}</span><span class="a35-res-t">${esc(e)}</span>
      </button>`).join('');
    cont.querySelectorAll('[data-estado]').forEach((b) => b.addEventListener('click', () => {
      $('a35Estado').value = $('a35Estado').value === b.dataset.estado ? '' : b.dataset.estado;
      reiniciar();
    }));
  }

  // ------------------------------------------------------------ pintar
  function pintarTabla() {
    const tbody = $('a35Tbody');
    if (!estado.filas.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="a35-vacio">Sin registros</td></tr>`;
      return;
    }
    tbody.innerHTML = estado.filas.map((r, i) => `
      <tr>
        <td class="a35-nowrap">${esc(fecha(r.created_at))}</td>
        <td>
          <span class="a35-tipo">${esc(r.tipo === 'Nuevo' ? 'Nueva' : r.tipo)}</span>
          ${r.origen && r.origen !== r.tipo ? `<div class="a35-sub a35-origen">Póliza ${esc(ORIGEN_TXT[r.origen] || r.origen)}</div>` : ''}
        </td>
        <td>
          <a class="a35-cliente" href="./cliente_editar.html?id=${encodeURIComponent(r.cliente_id)}&abrir=agente35">${esc(r.cliente_nombre || '—')}</a>
          <div class="a35-sub">${esc(r.cliente_telefono || '')}</div>
        </td>
        <td>${esc(r.compania || '')}</td>
        <td class="a35-nowrap">${esc(r.numero_poliza || '')}</td>
        <td>${esc(r.operador_nombre || '')}</td>
        <td>
          ${estado.puedeEditar
            ? `<select class="a35-sel-estado ${claseEstado(r.agente35_estado)}" data-i="${i}">
                 ${opcionesEstado(r.agente35_estado)}
               </select>`
            : `<span class="a35-badge ${claseEstado(r.agente35_estado)}">${esc(r.agente35_estado)}</span>`}
        </td>
        <td>
          ${subiendo.has(String(r.poliza_id))
            ? `<div class="a35-subiendo">Subiendo renovada por: ${esc(subiendo.get(String(r.poliza_id)) || '—')}</div>` : ''}
          <button type="button" class="a35-obs" data-i="${i}" title="${esc(r.agente35_notas || '')}">
            ${r.agente35_notas ? esc(r.agente35_notas.length > 60 ? r.agente35_notas.slice(0, 60) + '…' : r.agente35_notas)
                               : `<span class="material-symbols-rounded">${estado.puedeEditar ? 'edit_note' : 'remove'}</span>`}
          </button>
        </td>
        <td class="a35-sub">${r.agente35_actualizado_por ? `${esc(r.agente35_actualizado_por)}<br>${esc(fecha(r.agente35_fecha_actualizacion))}` : ''}</td>
      </tr>`).join('');

    tbody.querySelectorAll('.a35-sel-estado').forEach((s) => s.addEventListener('change', async () => {
      const r = estado.filas[+s.dataset.i];
      const ok = await guardar(r, s.value, r.agente35_notas);
      if (!ok) s.value = r.agente35_estado;
    }));
    tbody.querySelectorAll('.a35-obs').forEach((b) => b.addEventListener('click', () => abrirModal(estado.filas[+b.dataset.i])));
  }

  function opcionesEstado(sel) {
    const lista = ESTADOS.includes(sel) ? ESTADOS : [sel, ...ESTADOS];
    return lista.map((e) => `<option value="${esc(e)}"${e === sel ? ' selected' : ''}>${esc(e)}</option>`).join('');
  }

  function pintarPaginacion() {
    const paginas = Math.max(1, Math.ceil(estado.total / POR_PAGINA));
    $('a35Contador').textContent = `${estado.total.toLocaleString('es-CO')} registros`;
    $('a35Pagina').textContent = `${estado.pagina} / ${paginas}`;
    $('a35Ant').disabled = estado.pagina <= 1;
    $('a35Sig').disabled = estado.pagina >= paginas;
  }

  function pintarTipos() {
    $('a35Tipos').innerHTML = TIPOS.map((t) =>
      `<button type="button" class="a35-chip${estado.tipos.includes(t.texto) ? ' activo' : ''}" data-tipo="${esc(t.texto)}">${esc(t.texto)}</button>`).join('');
    $('a35Tipos').querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.tipo;
      const i = estado.tipos.indexOf(v);
      if (i === -1) estado.tipos.push(v); else estado.tipos.splice(i, 1);
      pintarTipos();
      reiniciar();
    }));
  }

  // ------------------------------------------------------------ guardar
  async function guardar(fila, nuevoEstado, nuevasNotas) {
    if (!estado.puedeEditar) return false;
    try {
      const { data, error } = await supabaseClient.from('polizas')
        .update({ agente35_estado: nuevoEstado, agente35_notas: nuevasNotas ?? null })
        .eq('id', fila.poliza_id)
        .select('agente35_estado, agente35_notas, agente35_actualizado_por, agente35_fecha_actualizacion')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Sin acceso a esta póliza');
      estado.filas.filter((r) => r.poliza_id === fila.poliza_id).forEach((r) => Object.assign(r, data));
      cargar();
      toast('Guardado');
      return true;
    } catch (e) {
      console.error('[agente35] guardar', e);
      toast('No se pudo guardar: ' + (e.message || e), 'error');
      return false;
    }
  }

  // ------------------------------------------------------------ modal
  function abrirModal(fila) {
    estado.actual = fila;
    $('a35ModalTitulo').textContent = `${fila.cliente_nombre || ''} · ${fila.numero_poliza || ''}`;
    $('a35ModalEstado').innerHTML = opcionesEstado(fila.agente35_estado);
    $('a35ModalNotas').value = fila.agente35_notas || '';
    $('a35ModalEstado').disabled = !estado.puedeEditar;
    $('a35ModalNotas').readOnly = !estado.puedeEditar;
    $('a35ModalGuardar').style.display = estado.puedeEditar ? '' : 'none';
    $('a35ModalMeta').textContent = fila.agente35_actualizado_por
      ? `${fila.agente35_actualizado_por} · ${fecha(fila.agente35_fecha_actualizacion)}` : '';
    $('a35ModalFicha').href = `./cliente_editar.html?id=${encodeURIComponent(fila.cliente_id)}&abrir=agente35`;
    $('a35Modal').classList.add('activo');
  }
  function cerrarModal() { $('a35Modal').classList.remove('activo'); estado.actual = null; }

  // ------------------------------------------------------------ inicio
  function reiniciar() { estado.pagina = 1; cargar(); }

  async function iniciar() {
    try { if (typeof cargarRolUsuario === 'function') await cargarRolUsuario(); } catch (e) {}
    const puede = (k) => { try { return typeof tienePermiso === 'function' && tienePermiso(k); } catch (e) { return false; } };
    if (!puede('ver_agente35')) { window.location.href = './home.html'; return; }
    estado.puedeEditar = puede('editar_agente35');
    if (puede('exportar_agente35')) pintarExportar();

    $('a35Estado').insertAdjacentHTML('beforeend', ESTADOS.map((e) => `<option value="${esc(e)}">${esc(e)}</option>`).join(''));
    pintarTipos();

    $('a35Estado').addEventListener('change', reiniciar);
    $('a35Desde').addEventListener('change', reiniciar);
    $('a35Hasta').addEventListener('change', reiniciar);
    $('a35Buscar').addEventListener('input', () => { clearTimeout(estado.timer); estado.timer = setTimeout(reiniciar, 400); });
    $('a35Limpiar').addEventListener('click', () => {
      estado.tipos = []; $('a35Estado').value = ''; $('a35Desde').value = ''; $('a35Hasta').value = ''; $('a35Buscar').value = '';
      pintarTipos(); reiniciar();
    });
    $('a35Recargar').addEventListener('click', cargar);
    $('a35Ant').addEventListener('click', () => { if (estado.pagina > 1) { estado.pagina--; cargar(); } });
    $('a35Sig').addEventListener('click', () => { estado.pagina++; cargar(); });
    $('a35ModalCerrar').addEventListener('click', cerrarModal);
    $('a35Modal').addEventListener('click', (e) => { if (e.target.id === 'a35Modal') cerrarModal(); });
    $('a35ModalGuardar').addEventListener('click', async () => {
      if (!estado.actual) return;
      const btn = $('a35ModalGuardar');
      btn.disabled = true;
      const ok = await guardar(estado.actual, $('a35ModalEstado').value, $('a35ModalNotas').value.trim());
      btn.disabled = false;
      if (ok) cerrarModal();
    });

    cargar();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
  const cssSubiendo = document.createElement('style');
  cssSubiendo.textContent = `
    .a35-subiendo { display:inline-block; padding:5px 10px; border-radius:8px; font-size:.8rem; font-weight:600;
      background:#ede9fe; color:#5b21b6; border:1px dashed #a78bfa; white-space:nowrap; margin-bottom:4px; }
    .a35-actualizaciones { padding:6px 12px; border-radius:999px; border:0; background:#f59e0b; color:#fff; font:inherit;
      font-size:.8rem; font-weight:700; cursor:pointer; animation:a35pulso 2s ease-in-out infinite; }
    .a35-exportar { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; border:1px solid #e2e8f0;
      background:#fff; color:#334155; font:inherit; font-size:.85rem; font-weight:600; cursor:pointer; }
    .a35-exportar:hover { border-color:#6366f1; color:#6366f1; }
    .a35-exportar:disabled { opacity:.6; cursor:wait; }
    .a35-exportar .material-symbols-rounded { font-size:18px; }
    [data-theme="dark"] .a35-exportar { background:#1a1a24; border-color:#2e2e3e; color:#cbd5e1; }
    .a35-recarga-grupo { display:flex; align-items:center; gap:8px; margin-left:auto; }
    @keyframes a35pulso { 0%,100% { box-shadow:0 0 0 0 rgba(245,158,11,.5); } 50% { box-shadow:0 0 0 6px rgba(245,158,11,0); } }
    [data-theme="dark"] .a35-subiendo { background:#2a2140; color:#c4b5fd; border-color:#6d55b8; }`;
  document.head.appendChild(cssSubiendo);
})();