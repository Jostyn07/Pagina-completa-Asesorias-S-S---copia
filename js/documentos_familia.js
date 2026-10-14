/* ============================================================================
 * Ruta en el repo: js/documentos_familia.js
 * MÓDULO DE DOCUMENTOS — FASE 2: Pólizas > Documentos (diseño Figma 8-2 / 10-122)
 *
 * Reemplaza la pestaña "Documentos" de cliente_editar.html por la vista por
 * familia: selector de integrantes, tarjetas Estado migratorio / Income,
 * Otros documentos y casillas de documentos solicitados por la póliza.
 *
 * - Sube al instante (no espera "Guardar Cliente").
 * - No borra archivos: "Eliminar" oculta el documento (vigente = false).
 * - "Reemplazar" crea una versión nueva y conserva la anterior.
 * - Audios y otros formatos antiguos se pueden abrir y reproducir.
 * - Requiere sql/documentos_fase1_modelo.sql.
 * Se carga DESPUÉS de cliente_editar.js (sobrescribe cargarDocumentos).
 * ==========================================================================*/
(function () {
  'use strict';

  const BUCKET = 'documentos';
  const MAX_MB = 15;
  const EXT_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'jfif', 'webp', 'gif', 'doc', 'docx', 'mp3', 'ogg', 'oga', 'opus', 'wav', 'm4a', 'aac', 'amr', 'webm'];

  const CATEGORIAS = {
    estado_migratorio: { label: 'Estado migratorio', icono: 'badge', desc: 'Identidad, emisión y vencimiento' },
    income:            { label: 'Income', icono: 'attach_money', desc: 'Comprobantes de ingresos y año fiscal' },
    otro:              { label: 'Otros documentos', icono: 'folder', desc: 'Archivos que no son Estado migratorio ni Income' },
    sin_clasificar:    { label: 'Sin clasificar', icono: 'help', desc: '' }
  };
  const SUBTIPOS = {
    estado_migratorio: {
      permiso_trabajo: 'Permiso de trabajo (EAD)',
      residencia: 'Residencia (Green Card)',
      f1: 'F1',
      ciudadania_acta_nacimiento: 'Ciudadanía – Acta de nacimiento',
      ciudadania_naturalizacion: 'Ciudadanía – Naturalización',
      ciudadania_pasaporte: 'Ciudadanía – Pasaporte de EE. UU.',
      ciudadania_licencia: 'Ciudadanía – Licencia'
    },
    income: {
      '1040': 'Declaración 1040',
      w2: 'W-2',
      '1099': '1099',
      comprobante_ingresos: 'Comprobante de ingresos (paystub / carta)'
    },
    otro: {
      aviso_elegibilidad_mercado: 'Aviso de Elegibilidad del Mercado',
      resumen_plan: 'Resumen de aplicación y plan',
      ssn: 'Tarjeta del Seguro Social',
      carta_rechazo_medicaid: 'Carta de rechazo Medicaid',
      carta_uscis: 'Carta de USCIS',
      cms: 'Formulario CMS',
      consentimiento: 'Consentimiento (Acepto)',
      factura_aseguradora: 'Factura de aseguradora',
      carta_aseguradora: 'Carta de aseguradora / Mercado',
      tarjeta_seguro: 'Tarjeta del seguro',
      licencia: 'Licencia',
      evidencia: 'Evidencia / captura',
      audio: 'Audio',
      otro: 'Otro'
    }
  };
  const SOLICITADOS = {
    estado_migratorio: 'Estado migratorio',
    income: 'Income',
    ssn: 'SSN',
    ciudadania: 'Ciudadanía',
    carta_rechazo_medicaid: 'Carta de rechazo Medicaid',
    otro: 'Otro'
  };
  const ESTADO_REVISION = {
    pendiente:   ['Sin revisar', 'gris'],
    por_revisar: ['Por revisar', 'amarillo'],
    confirmado:  ['Revisado', 'verde'],
    rechazado:   ['Rechazado', 'rojo'],
    no_aplica:   ['No aplica', 'gris']
  };

  const S = {
    clienteId: null, polizaId: null,
    titular: { nombre: '' },
    integrantes: [], documentos: [], extracciones: {}, solicitados: [],
    seleccionado: 'titular',
    modo: 'bd',          // 'bd' = sube al instante · 'pendiente' = se sube al guardar el cliente (cliente_crear)
    pendientes: []
  };

  // ---------------------------------------------------------------- utilidades
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // supabaseClient / polizaId pueden ser const/let globales (no quedan en window)
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const polizaGlobal = () => {
    try { if (typeof polizaIdSeleccionada !== 'undefined' && polizaIdSeleccionada) return polizaIdSeleccionada; } catch { /* */ }
    try { return typeof polizaId !== 'undefined' ? polizaId : null; } catch { return null; }
  };
  // Página: 'editar' (cliente existente), 'recuperado' (cliente buscado) o 'crear' (cliente aún no existe)
  const pagina = () => {
    try { if (typeof clienteIdSeleccionado !== 'undefined') return 'recuperado'; } catch { /* */ }
    return /cliente_crear/.test(location.pathname) ? 'crear' : 'editar';
  };
  const clienteRecuperado = () => { try { return clienteIdSeleccionado || null; } catch { return null; } };
  const fecha = (d) => d ? new Date(d).toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const tam = (b) => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
  const iniciales = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const ext = (n) => (String(n || '').split('.').pop() || '').toLowerCase();

  function aviso(msg, tipo) {
    if (typeof window.mostrarNotificacion === 'function') return window.mostrarNotificacion(msg, tipo || 'info');
    if (window.Notyf) { const n = new window.Notyf(); return tipo === 'error' ? n.error(msg) : n.success(msg); }
    console.log(msg);
  }
  async function usuarioId() {
    try { const { data } = await sb().auth.getUser(); return data?.user?.id || null; } catch { return null; }
  }
  async function historial(documentoId, accion, campo, antes, despues) {
    try {
      const uid = await usuarioId();
      await sb().from('documento_revision_historial').insert({
        documento_id: documentoId, accion, campo: campo || null,
        antes: antes == null ? null : String(antes), despues: despues == null ? null : String(despues), usuario_id: uid
      });
    } catch (e) { console.warn('historial documentos:', e); }
  }

  function rolDeRelacion(rel) {
    const r = String(rel || '').toLowerCase();
    if (/espos|c[oó]nyuge|pareja/.test(r)) return 'conyuge';
    return 'dependiente';
  }
  function integranteDe(doc) {
    if (doc._integrante) return doc._integrante;
    if (doc.integrante_tipo === 'general') return 'general';
    if (doc.dependiente_id) return 'dep:' + doc.dependiente_id;
    return 'titular';  // documentos anteriores sin integrante se muestran en el titular
  }
  function infoIntegrante(clave) {
    return S.integrantes.find((i) => i.clave === clave) || S.integrantes[0];
  }
  function nombreEstandar(categoria, subtipo, anio, clave) {
    const cat = CATEGORIAS[categoria]?.label || 'Documento';
    const sub = SUBTIPOS[categoria]?.[subtipo] || '';
    const it = infoIntegrante(clave);
    const quien = it.clave === 'general' ? 'Familia ' + (S.titular.apellidos || S.titular.nombre) : `${it.nombre} (${it.rolLabel.toLowerCase()})`;
    return [cat === 'Otros documentos' ? (sub || 'Documento') : cat + (sub ? ' – ' + sub : ''), anio || null, quien]
      .filter(Boolean).join(' – ');
  }

  // ------------------------------------------------------------- carga de datos
  function armarIntegrantes(nombres, apellidos, deps) {
    S.titular = { nombre: [nombres, apellidos].filter(Boolean).join(' ') || 'Titular', apellidos: apellidos || '' };
    S.integrantes = [{ clave: 'titular', rol: 'titular', rolLabel: 'Titular', nombre: S.titular.nombre }];
    deps.forEach((d) => {
      const rol = rolDeRelacion(d.relacion);
      S.integrantes.push({
        clave: d.clave, rol, dependienteId: d.dependienteId || null,
        rolLabel: rol === 'conyuge' ? 'Cónyuge' : (d.relacion && d.relacion !== 'Otro' ? d.relacion : 'Dependiente'),
        nombre: [d.nombres, d.apellidos].filter(Boolean).join(' ') || 'Sin nombre'
      });
    });
    S.integrantes.push({ clave: 'general', rol: 'general', rolLabel: 'General', nombre: 'Toda la familia' });
    if (!S.integrantes.some((i) => i.clave === S.seleccionado)) S.seleccionado = 'titular';
  }

  // cliente_crear: el cliente aún no existe → integrantes desde el formulario, archivos en memoria
  function cargarPendiente() {
    S.modo = 'pendiente'; S.clienteId = null; S.polizaId = null; S.solicitados = []; S.extracciones = {};
    const val = (id) => document.getElementById(id)?.value?.trim() || '';
    const deps = [...document.querySelectorAll('#dependientesContainer .dependiente-card')].map((card) => {
      const n = (card.id.match(/dependiente-(\d+)/) || [])[1];
      const g = (k) => card.querySelector(`[name="dep_${k}_${n}"]`)?.value || '';
      return { clave: 'tmp:' + n, nombres: g('nombres'), apellidos: g('apellidos'), relacion: g('relacion') };
    }).filter((d) => d.nombres);
    armarIntegrantes(val('nombres'), val('apellidos'), deps);
    // Si se borró un dependiente, sus archivos pasan al titular
    S.pendientes.forEach((d) => { if (!S.integrantes.some((i) => i.clave === d._integrante)) d._integrante = 'titular'; });
    S.documentos = S.pendientes;
  }
  async function cargarTodo(clienteId) {
    S.clienteId = clienteId;
    S.polizaId = polizaGlobal() || window.polizaId || new URLSearchParams(location.search).get('poliza') || null;

    const [cli, deps, docs, sol, pol] = await Promise.all([
      sb().from('clientes').select('nombres, apellidos').eq('id', clienteId).maybeSingle(),
      sb().from('dependientes').select('id, nombres, apellidos, relacion, fecha_nacimiento').eq('cliente_id', clienteId).order('created_at'),
      sb().from('documentos').select('*').eq('cliente_id', clienteId).eq('vigente', true).order('created_at', { ascending: false }),
      S.polizaId
        ? sb().from('poliza_documentos_solicitados').select('*').eq('poliza_id', S.polizaId).order('creado_en')
        : Promise.resolve({ data: [] }),
      S.polizaId
        ? sb().from('polizas').select('fecha_plazo_documentos, estado_documentos').eq('id', S.polizaId).maybeSingle()
        : Promise.resolve({ data: null })
    ]);
    S.poliza = pol.data || null;
    if (docs.error) throw docs.error;

    armarIntegrantes(cli.data?.nombres, cli.data?.apellidos, (deps.data || []).map((d) => ({ ...d, clave: 'dep:' + d.id, dependienteId: d.id })));

    S.documentos = docs.data || [];
    S.solicitados = sol.data || [];

    // Extracciones (solo de los documentos visibles)
    S.extracciones = {};
    const ids = S.documentos.map((d) => d.id);
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await sb().from('documento_extracciones').select('*').in('documento_id', ids.slice(i, i + 150));
      (data || []).forEach((x) => { (S.extracciones[x.documento_id] ||= []).push(x); });
    }
    if (!S.integrantes.some((i) => i.clave === S.seleccionado)) S.seleccionado = 'titular';
  }

  // ------------------------------------------------------------------- render
  function contenedor() { return document.getElementById('documentosContainer'); }

  function render() {
    const c = contenedor();
    if (!c) return;
    const cont = document.getElementById('documentosCounter');
    if (cont) cont.textContent = `(${S.documentos.length})`;

    // "Toda la familia" muestra TODOS los documentos (de cada integrante y los generales)
    const docsSel = S.seleccionado === 'general' ? S.documentos : S.documentos.filter((d) => integranteDe(d) === S.seleccionado);
    const porCat = (cat) => docsSel.filter((d) => d.categoria === cat);
    const otros = docsSel.filter((d) => d.categoria === 'otro' || d.categoria === 'sin_clasificar');

    c.innerHTML = `
      <div class="docf">
        ${htmlSolicitados()}
        <div class="docf-bloque">
          <h3 class="docf-h3">Integrantes de la familia</h3>
          <p class="docf-sub">Cada persona mantiene sus documentos y resultados de IA independientes.</p>
          <div class="docf-integrantes">${S.integrantes.map(htmlIntegrante).join('')}</div>
        </div>
        <div class="docf-bloque">
          <div class="docf-h3-fila"><h3 class="docf-h3">Documentación</h3>
            ${S.modo === 'bd' ? `<button type="button" class="docf-btn-sec" data-docf-ia="1"><span class="material-symbols-rounded">auto_awesome</span> Clasificar con IA (${docsSel.filter(pendienteIA).length})</button>` : ''}</div>
          <p class="docf-sub">Clasificación asistida · Revisión humana antes de confirmar campos dudosos</p>
          <label class="docf-drop" data-docf-drop>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.jfif,.webp,.gif,.doc,.docx,audio/*" hidden>
            <span class="material-symbols-rounded">cloud_upload</span>
            <span class="docf-drop-txt"><b>Arrastra los archivos aquí</b> o haz clic para elegirlos · la IA los clasifica sola</span>
          </label>
          <div class="docf-grid">
            ${htmlCategoria('estado_migratorio', porCat('estado_migratorio'))}
            ${htmlCategoria('income', porCat('income'))}
          </div>
        </div>
        ${htmlOtros(otros)}
      </div>`;
  }

  function htmlIntegrante(it) {
    const n = it.clave === 'general' ? S.documentos.length : S.documentos.filter((d) => integranteDe(d) === it.clave).length;
    const sel = it.clave === S.seleccionado;
    return `<button type="button" class="docf-int${sel ? ' activo' : ''}" data-docf-int="${esc(it.clave)}">
        <span class="docf-avatar">${it.clave === 'general' ? '<span class="material-symbols-rounded">groups</span>' : it.clave === 'sin_asignar' ? '<span class="material-symbols-rounded">help</span>' : esc(iniciales(it.nombre))}</span>
        <span class="docf-int-txt">
          <small>${esc(it.rolLabel.toUpperCase())}</small>
          <strong>${esc(it.nombre)}</strong>
          <em>${sel ? 'Seleccionado' : n + (n === 1 ? ' documento' : ' documentos')}</em>
        </span>
      </button>`;
  }

  function estadoTarjeta(docs) {
    if (!docs.length) return ['Faltante', 'rojo'];
    const hoy = new Date().toISOString().slice(0, 10);
    if (docs.some((d) => d.fecha_vencimiento && d.fecha_vencimiento < hoy)) return ['Vencido', 'rojo'];
    if (docs.some((d) => d.estado_revision === 'confirmado')) return ['Revisado', 'verde'];
    return ['Por revisar', 'amarillo'];
  }

  function htmlCategoria(cat, docs) {
    const info = CATEGORIAS[cat];
    const [txt, color] = estadoTarjeta(docs);
    return `<div class="docf-card">
        <div class="docf-card-head">
          <span class="docf-ico"><span class="material-symbols-rounded">${info.icono}</span></span>
          <div><h4>${info.label}</h4><small>${info.desc}</small></div>
          <span class="docf-chip ${color}">${txt}</span>
        </div>
        ${docs.length ? docs.map(htmlDoc).join('') : `
          <div class="docf-vacio">
            <span class="material-symbols-rounded">upload_file</span>
            <p>Sin documento de ${info.label.toLowerCase()}</p>
          </div>`}
        <button type="button" class="docf-btn-sec docf-card-add" data-docf-subir="${cat}">
          <span class="material-symbols-rounded">add</span> Subir ${info.label.toLowerCase()}
        </button>
      </div>`;
  }

  function htmlDoc(d) {
    const nombre = d.nombre_estandar || d.nombre || d.nombre_archivo;
    const [est, col] = ESTADO_REVISION[d.estado_revision] || ESTADO_REVISION.pendiente;
    const sub = SUBTIPOS[d.categoria]?.[d.subtipo];
    const ext_ = S.extracciones[d.id] || [];
    const tipo = (d.tipo_archivo || '').split('/').pop().toUpperCase() || ext(d.nombre_archivo).toUpperCase();
    return `<div class="docf-doc" data-doc-id="${d.id}">
        <div class="docf-doc-row">
          <div class="docf-doc-info">
            <strong title="${esc(d.nombre_archivo)}">${esc(nombre)}</strong>
            ${S.seleccionado === 'general' ? `<small class="docf-dueno"><span class="material-symbols-rounded">person</span>${esc(duenoDe(d))}</small>` : ''}
            <small>${esc([tipo, sub, 'Cargado ' + fecha(d.created_at), tam(d.tamanio), d.version > 1 ? 'v' + d.version : ''].filter(Boolean).join(' · '))}</small>
            ${d.integrante_tipo == null ? '<small class="docf-vence">Integrante sin confirmar · usa ⋮ para asignarlo</small>' : ''}
            ${d.fecha_vencimiento ? `<small class="docf-vence">Vence: ${fecha(d.fecha_vencimiento + 'T12:00:00')}</small>` : ''}
          </div>
          ${d.estado_ia === 'procesando' || d.estado_ia === 'en_cola' ? '<span class="docf-chip azul">Analizando…</span>' : d.estado_ia === 'error' ? '<span class="docf-chip rojo" title="La IA no pudo leerlo">Error IA</span>' : ''}
          <span class="docf-chip ${col}">${est}</span>
          <div class="docf-doc-acc">
            ${ext_.some((x) => x.estado === 'por_revisar' || x.estado === 'sugerido')
              ? `<button type="button" class="docf-btn-pri docf-btn-verif" data-docf-verif="${d.id}" title="Ver el archivo y confirmar todos los datos a la vez"><span class="material-symbols-rounded">fact_check</span> Verificar</button>` : ''}
            <button type="button" class="docf-btn-ver" data-docf-ver="${d.id}">Ver archivo</button>
            <button type="button" class="docf-btn-ico" data-docf-menu="${d.id}" title="Más acciones"><span class="material-symbols-rounded">more_vert</span></button>
          </div>
        </div>
        ${ext_.length ? `<details class="docf-ext" data-docf-det="${d.id}"${abiertos.has(d.id) ? ' open' : ''}>
            <summary><span class="material-symbols-rounded">expand_more</span>Datos extraídos (${ext_.length})${(() => {
              const rev = ext_.filter((x) => x.estado === 'por_revisar' || x.estado === 'sugerido').length;
              const conf = ext_.filter((x) => x.estado === 'confirmado').length;
              return (rev ? ` · <b class="docf-amar-txt">${rev} por revisar</b>` : '') + (conf ? ` · ${conf} confirmado${conf === 1 ? '' : 's'}` : '');
            })()}</summary>${ext_.map((x) => `
            <div class="docf-ext-row" data-docf-ext="${x.id}" title="Revisar dato"><span>${esc(x.campo.replace(/_/g, ' '))}: <b>${esc(x.estado === 'no_identificado' ? 'No identificado' : x.estado === 'no_aplica' ? 'No aplica' : x.valor)}</b></span>
            ${x.estado === 'confirmado' ? '<span class="docf-chip verde">Confirmado</span>' : x.confianza != null ? `<span class="docf-chip ${x.confianza >= 95 ? 'verde' : x.confianza >= 80 ? 'azul' : 'amarillo'}">${Math.round(x.confianza)}% confianza</span>` : ''}</div>`).join('')}
          </details>` : ''}
      </div>`;
  }

  function duenoDe(d) {
    const it = S.integrantes.find((i) => i.clave === integranteDe(d));
    if (!it || it.clave === 'general') return 'Toda la familia';
    return `${it.nombre} · ${it.rolLabel}`;
  }

  function htmlOtros(docs) {
    return `<div class="docf-card docf-otros">
        <div class="docf-card-head">
          <div><h4>Otros documentos</h4><small>Archivos de la póliza que no corresponden a Estado migratorio ni Income</small></div>
          <button type="button" class="docf-btn-pri" data-docf-subir="otro"><span class="material-symbols-rounded">add</span> Agregar archivo</button>
        </div>
        ${docs.length ? docs.map(htmlDoc).join('') : `<div class="docf-vacio"><p>${S.seleccionado === 'general' ? 'La familia no tiene otros documentos' : 'No hay otros documentos para este integrante'}</p></div>`}
        <small class="docf-pie">${docs.length} archivo${docs.length === 1 ? '' : 's'} adicional${docs.length === 1 ? '' : 'es'}</small>
      </div>`;
  }

  function cumplido(sol) {
    if (sol.estado !== 'pendiente') return sol.estado === 'cumplido';
    const delTit = S.documentos.filter((d) => ['titular', 'general'].includes(integranteDe(d)) || d.integrante_tipo == null);
    switch (sol.tipo) {
      case 'estado_migratorio': return delTit.some((d) => d.categoria === 'estado_migratorio');
      case 'income': return delTit.some((d) => d.categoria === 'income');
      case 'ssn': return delTit.some((d) => d.subtipo === 'ssn');
      case 'ciudadania': return delTit.some((d) => String(d.subtipo || '').startsWith('ciudadania'));
      case 'carta_rechazo_medicaid': return delTit.some((d) => d.subtipo === 'carta_rechazo_medicaid');
      default: return false;
    }
  }
  // Fecha de plazo de documento (Estado en Mercado): lo que evita la cancelación del cliente
  function htmlPlazo() {
    const p = S.poliza;
    if (!p?.fecha_plazo_documentos || /documentos completos/i.test(p.estado_documentos || '')) return '';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(p.fecha_plazo_documentos + 'T00:00:00') - hoy) / 86400000);
    const color = dias < 0 ? 'rojo' : dias <= 7 ? 'rojo' : dias <= 30 ? 'amarillo' : 'verde';
    const txt = dias < 0 ? `vencido hace ${-dias} d` : dias === 0 ? 'vence hoy' : `vence en ${dias} d`;
    return ` <span class="docf-chip ${color}" title="Fecha de plazo de documento (Estado en Mercado)">Plazo Mercado ${fecha(p.fecha_plazo_documentos + 'T12:00:00')} · ${txt}</span>`;
  }

  function htmlSolicitados() {
    if (!S.polizaId) return '';
    const items = S.solicitados.map((s) => {
      const ok = cumplido(s);
      const na = s.estado === 'no_aplica';
      const label = s.tipo === 'otro' ? s.descripcion : SOLICITADOS[s.tipo];
      return `<span class="docf-sol ${na ? 'gris' : ok ? 'verde' : 'rojo'}" title="${na ? 'No aplica' : ok ? 'Recibido' : 'Falta'}">
          <span class="material-symbols-rounded">${na ? 'block' : ok ? 'check_circle' : 'pending'}</span>${esc(label)}
          <button type="button" data-docf-sol="${s.id}" title="Cambiar estado"><span class="material-symbols-rounded">more_horiz</span></button>
        </span>`;
    }).join('');
    return `<div class="docf-solicitados">
        <div><strong>Documentos solicitados para esta póliza</strong>${htmlPlazo()}
          <small>${S.solicitados.length ? 'Se marcan como recibidos cuando hay un documento de ese tipo en el titular.' : 'No hay documentos solicitados.'}</small></div>
        <div class="docf-sol-lista">${items}
          <button type="button" class="docf-btn-sec" data-docf-sol-nuevo="1"><span class="material-symbols-rounded">add</span> Solicitar otro</button>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------ modales
  function modal(html, onMontar) {
    cerrarModal();
    const m = document.createElement('div');
    m.className = 'docf-modal';
    m.innerHTML = `<div class="docf-modal-caja" role="dialog">${html}</div>`;
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-docf-cerrar]')) cerrarModal(); });
    document.body.appendChild(m);
    if (onMontar) onMontar(m);
    return m;
  }
  function cerrarModal() { document.querySelectorAll('.docf-modal').forEach((m) => m.remove()); }

  function opcionesIntegrante(sel) {
    return S.integrantes.filter((i) => i.clave !== 'sin_asignar')
      .map((i) => `<option value="${esc(i.clave)}"${i.clave === sel ? ' selected' : ''}>${esc(i.rolLabel)} – ${esc(i.nombre)}</option>`).join('');
  }
  function opcionesCategoria(sel) {
    return ['estado_migratorio', 'income', 'otro'].map((c) => `<option value="${c}"${c === sel ? ' selected' : ''}>${CATEGORIAS[c].label}</option>`).join('');
  }
  function opcionesSubtipo(cat, sel) {
    return '<option value="">Seleccionar…</option>' + Object.entries(SUBTIPOS[cat] || {})
      .map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }
  function enlazarCatSub(m) {
    const cat = m.querySelector('[name=categoria]'), sub = m.querySelector('[name=subtipo]');
    cat.addEventListener('change', () => { sub.innerHTML = opcionesSubtipo(cat.value, ''); });
  }

  // Subir (nuevo o reemplazo)
  function abrirSubir(categoria, reemplazo) {
    const integ = reemplazo ? integranteDe(reemplazo) : (S.seleccionado === 'sin_asignar' ? 'titular' : S.seleccionado);
    const cat = reemplazo ? (reemplazo.categoria === 'sin_clasificar' ? 'otro' : reemplazo.categoria) : categoria;
    modal(`
      <h3>${reemplazo ? 'Reemplazar archivo' : 'Subir documento'}</h3>
      ${reemplazo ? `<p class="docf-sub">La versión anterior se conserva en el historial.</p>` : ''}
      <label>Integrante<select name="integrante">${opcionesIntegrante(integ)}</select></label>
      <label>Categoría<select name="categoria">${opcionesCategoria(cat)}</select></label>
      <label>Tipo de documento<select name="subtipo">${opcionesSubtipo(cat, reemplazo?.subtipo || '')}</select></label>
      <label>Año fiscal (Income)<input name="anio" type="number" min="2000" max="2100" placeholder="${new Date().getFullYear() - 1}" value="${reemplazo?.anio_fiscal || ''}"></label>
      <label>Archivo${reemplazo ? '' : 's'} (PDF, imágenes, Word o audio · máx. ${MAX_MB} MB)
        <input name="archivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.jfif,.webp,.gif,.doc,.docx,audio/*" ${reemplazo ? '' : 'multiple'}></label>
      <div class="docf-modal-acc">
        <button type="button" class="docf-btn-sec" data-docf-cerrar>Cancelar</button>
        <button type="button" class="docf-btn-pri" data-docf-ok>Subir</button>
      </div>`, (m) => {
      enlazarCatSub(m);
      m.querySelector('[data-docf-ok]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const files = [...m.querySelector('[name=archivo]').files];
        if (!files.length) return aviso('Selecciona un archivo', 'warning');
        for (const f of files) {
          if (!EXT_PERMITIDAS.includes(ext(f.name))) return aviso(`${f.name}: formato no permitido`, 'warning');
          if (f.size > MAX_MB * 1048576) return aviso(`${f.name}: supera ${MAX_MB} MB`, 'warning');
        }
        btn.disabled = true; btn.textContent = 'Subiendo…';
        try {
          for (const f of files) {
            await subirArchivo(f, {
              integrante: m.querySelector('[name=integrante]').value,
              categoria: m.querySelector('[name=categoria]').value,
              subtipo: m.querySelector('[name=subtipo]').value || null,
              anio: parseInt(m.querySelector('[name=anio]').value, 10) || null
            }, reemplazo);
          }
          cerrarModal();
          aviso(files.length > 1 ? `${files.length} documentos subidos` : 'Documento subido', 'success');
          await recargar();
        } catch (err) {
          console.error(err);
          aviso('No se pudo subir: ' + (err.message || err), 'error');
          btn.disabled = false; btn.textContent = 'Subir';
        }
      });
    });
  }

  async function subirArchivo(file, o, reemplazo) {
    if (S.modo === 'pendiente') {
      const it = infoIntegrante(o.integrante);
      if (reemplazo) S.pendientes = S.pendientes.filter((d) => d !== reemplazo);
      S.pendientes.unshift({
        id: 'tmp-' + Date.now() + Math.random().toString(36).slice(2, 6), _file: file, _integrante: it.clave, _integranteNombre: it.nombre,
        nombre_estandar: nombreEstandar(o.categoria, o.subtipo, o.anio, it.clave), nombre_archivo: file.name,
        tipo_archivo: file.type, tamanio: file.size, created_at: new Date().toISOString(),
        categoria: o.categoria, subtipo: o.subtipo, anio_fiscal: o.anio, estado_revision: 'pendiente', version: 1,
        integrante_tipo: o.auto ? null : it.rol, _auto: !!o.auto, estado_ia: o.auto ? 'en_cola' : 'sin_procesar'
      });
      if (o.auto) S.pendientes[0].nombre_estandar = file.name;
      return;
    }
    const it = infoIntegrante(o.integrante);
    const carpeta = o.auto ? 'por_clasificar' : it.clave === 'general' ? 'general' : it.clave === 'titular' ? 'titular' : slug(it.nombre) || 'dependiente';
    const base = slug(o.subtipo || o.categoria) || 'documento';
    const path = `${S.clienteId}/${carpeta}/${o.categoria}/${Date.now()}_${base}${o.anio ? '_' + o.anio : ''}.${ext(file.name) || 'bin'}`;

    const up = await sb().storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
    if (up.error) throw up.error;
    const { data: pub } = sb().storage.from(BUCKET).getPublicUrl(path);

    // Subida rápida: sin datos; la IA decide tipo e integrante
    const nombre = o.auto ? file.name : nombreEstandar(o.categoria, o.subtipo, o.anio, it.clave);
    const fila = {
      cliente_id: S.clienteId,
      poliza_id: S.polizaId,
      nombre, nombre_estandar: nombre,
      nombre_archivo: file.name,
      url_archivo: pub.publicUrl,
      storage_path: path,
      tipo_archivo: file.type || null,
      tamanio: file.size,
      uploaded_by: await usuarioId(),
      origen: 'manual',
      categoria: o.categoria,
      subtipo: o.subtipo,
      anio_fiscal: o.anio,
      integrante_tipo: o.auto ? null : it.rol === 'sin_asignar' ? null : it.rol === 'conyuge' ? 'conyuge' : it.rol,
      dependiente_id: o.auto ? null : it.dependienteId || null,
      clasificado_por: o.auto ? null : 'manual',
      estado_revision: 'pendiente',
      version: reemplazo ? (reemplazo.version || 1) + 1 : 1,
      reemplaza_a: reemplazo ? reemplazo.id : null
    };
    const ins = await sb().from('documentos').insert(fila).select('id').single();
    if (ins.error) {
      await sb().storage.from(BUCKET).remove([path]);  // no dejar archivos huérfanos
      throw ins.error;
    }
    await historial(ins.data.id, reemplazo ? 'reemplazar' : 'subir', null, reemplazo?.id || null, nombre);
    if (reemplazo) {
      await sb().from('documentos').update({ vigente: false }).eq('id', reemplazo.id);
      await historial(reemplazo.id, 'reemplazado', null, null, ins.data.id);
    }
    return ins.data.id;
  }

  // Subida rápida: arrastrar o elegir archivos → se suben sin preguntar nada y la IA los analiza
  async function subirRapido(files) {
    files = [...(files || [])];
    if (!files.length) return;
    const malos = files.filter((f) => !EXT_PERMITIDAS.includes(ext(f.name)) || f.size > MAX_MB * 1048576);
    if (malos.length) aviso(`No se subieron (formato o > ${MAX_MB} MB): ${malos.map((f) => f.name).join(', ')}`, 'warning');
    files = files.filter((f) => !malos.includes(f));
    if (!files.length) return;
    if (pagina() === 'recuperado' && !clienteRecuperado()) return aviso('Primero selecciona un cliente', 'warning');
    if (S.modo === 'pendiente') cargarPendiente();
    const zona = document.querySelector('#documentosContainer .docf-drop');
    zona?.classList.add('subiendo');
    const ids = [];
    try {
      for (let i = 0; i < files.length; i++) {
        if (zona) zona.querySelector('.docf-drop-txt').textContent = `Subiendo ${i + 1} de ${files.length}…`;
        try { const id = await subirArchivo(files[i], { integrante: 'titular', categoria: 'sin_clasificar', subtipo: null, anio: null, auto: true }); if (id) ids.push(id); }
        catch (e) { console.error(e); aviso(`No se pudo subir ${files[i].name}: ${e.message || e}`, 'error'); }
      }
    } finally {
      zona?.classList.remove('subiendo');
    }
    await recargar();
    if (S.modo === 'pendiente') return aviso(`${files.length} archivo(s) listos. Se subirán y analizarán al guardar el cliente.`, 'success');
    // Análisis automático (sin confirmación: son pocos archivos)
    const analizables = ids.filter((id) => { const d = S.documentos.find((x) => x.id === id); return d && !String(d.tipo_archivo || '').startsWith('audio/'); });
    if (analizables.length) clasificarIA(analizables);
  }

  // Ver archivo (imagen, PDF, audio u otro)
  async function urlDe(d) {
    if (d._file) return (d._url ||= URL.createObjectURL(d._file));
    if (d.storage_path) {
      try {
        const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(d.storage_path, 600);
        if (!error && data?.signedUrl) return data.signedUrl;
      } catch { /* bucket público: se usa la URL guardada */ }
    }
    return d.url_archivo;
  }
  async function ver(d) {
    const url = await urlDe(d);
    const t = (d.tipo_archivo || '').toLowerCase(), e = ext(d.nombre_archivo);
    let cuerpo;
    const esImg = t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'jfif'].includes(e);
    if (esImg || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'jfif'].includes(e)) cuerpo = `<img src="${esc(url)}" alt="${esc(d.nombre_archivo)}">`;
    else if (t === 'application/pdf' || e === 'pdf') cuerpo = `<iframe src="${esc(url)}" title="${esc(d.nombre_archivo)}"></iframe>`;
    else if (t.startsWith('audio/') || ['mp3', 'ogg', 'oga', 'opus', 'wav', 'm4a', 'aac', 'amr', 'webm'].includes(e)) cuerpo = `<audio controls src="${esc(url)}"></audio>`;
    else cuerpo = `<p class="docf-sub">Este formato no tiene vista previa.</p>`;
    modal(`
      <div class="docf-visor-head"><h3>${esc(d.nombre_estandar || d.nombre || d.nombre_archivo)}</h3>
        <button type="button" class="docf-btn-ico" data-docf-cerrar><span class="material-symbols-rounded">close</span></button></div>
      <div class="docf-visor">${cuerpo}</div>
      <div class="docf-modal-acc">
        ${esImg ? `<div class="docf-giro">
          <button type="button" class="docf-btn-ico" data-giro="-90" title="Girar a la izquierda"><span class="material-symbols-rounded">rotate_left</span></button>
          <button type="button" class="docf-btn-ico" data-giro="90" title="Girar a la derecha"><span class="material-symbols-rounded">rotate_right</span></button>
          <button type="button" class="docf-btn-ico" data-zoom="0.25" title="Acercar"><span class="material-symbols-rounded">zoom_in</span></button>
          <button type="button" class="docf-btn-ico" data-zoom="-0.25" title="Alejar"><span class="material-symbols-rounded">zoom_out</span></button>
        </div>` : ''}
        <a class="docf-btn-sec" href="${esc(url)}" target="_blank" rel="noopener">Abrir en otra pestaña</a>
        <button type="button" class="docf-btn-pri" data-docf-desc>Descargar</button>
      </div>`, (m) => {
      m.querySelector('.docf-modal-caja').classList.add('ancho');
      m.querySelector('[data-docf-desc]').addEventListener('click', () => descargar(url, d.nombre_archivo));
      // Girar y acercar la imagen (solo en pantalla, no cambia el archivo)
      const img = m.querySelector('.docf-visor img');
      if (img) {
        let giro = 0, zoom = 1;
        const aplicar = () => {
          const lado = giro % 180 !== 0;
          img.style.transform = `rotate(${giro}deg) scale(${zoom})`;
          // Al girar 90°, el alto disponible pasa a ser el ancho
          img.style.maxWidth = lado ? '70vh' : '100%';
          img.style.maxHeight = lado ? 'min(100%, 900px)' : '70vh';
        };
        m.querySelectorAll('[data-giro]').forEach((b) => b.addEventListener('click', () => { giro = (giro + Number(b.dataset.giro) + 360) % 360; aplicar(); }));
        m.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => { zoom = Math.min(3, Math.max(0.5, zoom + Number(b.dataset.zoom))); aplicar(); }));
      }
    });
  }
  async function descargar(url, nombre) {
    try {
      const r = await fetch(url); const b = await r.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nombre || 'documento';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch { window.open(url, '_blank'); }
  }

  // Menú de acciones
  function menu(d) {
    if (S.modo === 'pendiente') {
      return modal(`
        <h3>${esc(d.nombre_estandar || d.nombre_archivo)}</h3>
        <p class="docf-sub">Se subirá al guardar el cliente.</p>
        <div class="docf-menu">
          <button type="button" data-a="clasificar"><span class="material-symbols-rounded">sell</span> Cambiar tipo o integrante</button>
          <button type="button" data-a="quitar" class="peligro"><span class="material-symbols-rounded">delete</span> Quitar</button>
        </div>
        <div class="docf-modal-acc"><button type="button" class="docf-btn-sec" data-docf-cerrar>Cerrar</button></div>`, (m) => {
        m.querySelector('.docf-menu').addEventListener('click', (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (a === 'clasificar') return clasificar(d);
          if (a === 'quitar') { S.pendientes = S.pendientes.filter((x) => x !== d); cerrarModal(); recargar(); }
        });
      });
    }
    modal(`
      <h3>${esc(d.nombre_estandar || d.nombre || d.nombre_archivo)}</h3>
      <div class="docf-menu">
        <button type="button" data-a="ia"><span class="material-symbols-rounded">auto_awesome</span> Clasificar con IA</button>
        <button type="button" data-a="clasificar"><span class="material-symbols-rounded">sell</span> Cambiar tipo o integrante</button>
        <button type="button" data-a="confirmar"><span class="material-symbols-rounded">verified</span> Marcar como revisado</button>
        <button type="button" data-a="no_aplica"><span class="material-symbols-rounded">block</span> Marcar «No aplica»</button>
        <button type="button" data-a="reemplazar"><span class="material-symbols-rounded">sync</span> Reemplazar archivo</button>
        <button type="button" data-a="descargar"><span class="material-symbols-rounded">download</span> Descargar</button>
        <button type="button" data-a="eliminar" class="peligro"><span class="material-symbols-rounded">delete</span> Quitar del expediente</button>
      </div>
      <div class="docf-modal-acc"><button type="button" class="docf-btn-sec" data-docf-cerrar>Cerrar</button></div>`, (m) => {
      m.querySelector('.docf-menu').addEventListener('click', async (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (!a) return;
        if (a === 'ia') { cerrarModal(); return clasificarIA([d.id]); }
        if (a === 'clasificar') return clasificar(d);
        if (a === 'reemplazar') return abrirSubir(null, d);
        if (a === 'descargar') { cerrarModal(); return descargar(await urlDe(d), d.nombre_archivo); }
        if (a === 'eliminar') {
          if (!confirm('El documento se quitará del expediente. El archivo se conserva y queda en el historial. ¿Continuar?')) return;
          return actualizar(d, { vigente: false, eliminado_en: new Date().toISOString(), eliminado_por: await usuarioId() }, 'eliminar');
        }
        if (a === 'confirmar') return actualizar(d, { estado_revision: 'confirmado', confirmado_por: await usuarioId(), confirmado_en: new Date().toISOString() }, 'confirmar');
        if (a === 'no_aplica') return actualizar(d, { estado_revision: 'no_aplica' }, 'no_aplica');
      });
    });
  }

  function clasificar(d) {
    const cat = d.categoria === 'sin_clasificar' ? 'otro' : d.categoria;
    const integ = integranteDe(d) === 'sin_asignar' ? 'titular' : integranteDe(d);
    modal(`
      <h3>Cambiar tipo o integrante</h3>
      <label>Integrante<select name="integrante">${opcionesIntegrante(integ)}</select></label>
      <label>Categoría<select name="categoria">${opcionesCategoria(cat)}</select></label>
      <label>Tipo de documento<select name="subtipo">${opcionesSubtipo(cat, d.subtipo)}</select></label>
      <label>Año fiscal (Income)<input name="anio" type="number" min="2000" max="2100" value="${d.anio_fiscal || ''}"></label>
      <label>Fecha de vencimiento (confirmada)<input name="vence" type="date" value="${d.fecha_vencimiento || ''}"></label>
      <div class="docf-modal-acc">
        <button type="button" class="docf-btn-sec" data-docf-cerrar>Cancelar</button>
        <button type="button" class="docf-btn-pri" data-docf-ok>Guardar</button>
      </div>`, (m) => {
      enlazarCatSub(m);
      m.querySelector('[data-docf-ok]').addEventListener('click', async () => {
        const it = infoIntegrante(m.querySelector('[name=integrante]').value);
        const categoria = m.querySelector('[name=categoria]').value;
        const subtipo = m.querySelector('[name=subtipo]').value || null;
        const anio = parseInt(m.querySelector('[name=anio]').value, 10) || null;
        const vence = m.querySelector('[name=vence]').value || null;
        const nombre = nombreEstandar(categoria, subtipo, anio, it.clave);
        const extra = S.modo === 'pendiente' ? { _integrante: it.clave, _integranteNombre: it.nombre } : {};
        await actualizar(d, {
          ...extra,
          categoria, subtipo, anio_fiscal: anio, fecha_vencimiento: vence,
          integrante_tipo: it.rol === 'conyuge' ? 'conyuge' : it.rol,
          dependiente_id: it.dependienteId || null,
          nombre_estandar: nombre, clasificado_por: 'manual'
        }, 'clasificar', `${d.categoria}/${d.subtipo || ''}`, `${categoria}/${subtipo || ''}`);
      });
    });
  }

  async function actualizar(d, cambios, accion, antes, despues) {
    if (S.modo === 'pendiente') {
      Object.assign(d, cambios);
      cerrarModal(); return recargar();
    }
    const { error } = await sb().from('documentos').update(cambios).eq('id', d.id);
    if (error) { console.error(error); return aviso('No se pudo guardar: ' + error.message, 'error'); }
    await historial(d.id, accion, null, antes ?? null, despues ?? null);
    cerrarModal();
    aviso('Cambios guardados', 'success');
    await recargar();
  }

  // Casillas solicitadas
  function menuSolicitado(s) {
    modal(`
      <h3>${esc(s.tipo === 'otro' ? s.descripcion : SOLICITADOS[s.tipo])}</h3>
      <div class="docf-menu">
        <button type="button" data-e="pendiente"><span class="material-symbols-rounded">pending</span> Automático (según documentos)</button>
        <button type="button" data-e="cumplido"><span class="material-symbols-rounded">check_circle</span> Marcar recibido</button>
        <button type="button" data-e="no_aplica"><span class="material-symbols-rounded">block</span> No aplica</button>
      </div>
      <div class="docf-modal-acc"><button type="button" class="docf-btn-sec" data-docf-cerrar>Cerrar</button></div>`, (m) => {
      m.querySelector('.docf-menu').addEventListener('click', async (e) => {
        const est = e.target.closest('[data-e]')?.dataset.e;
        if (!est) return;
        const { error } = await sb().from('poliza_documentos_solicitados').update({ estado: est }).eq('id', s.id);
        if (error) return aviso('No se pudo guardar: ' + error.message, 'error');
        cerrarModal(); await recargar();
      });
    });
  }
  function nuevoSolicitado() {
    modal(`
      <h3>Solicitar otro documento</h3>
      <label>Tipo<select name="tipo">${Object.entries(SOLICITADOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>Descripción (si es «Otro»)<input name="desc" type="text" placeholder="Ej: Non-ESI Minimum Essential Coverage"></label>
      <div class="docf-modal-acc">
        <button type="button" class="docf-btn-sec" data-docf-cerrar>Cancelar</button>
        <button type="button" class="docf-btn-pri" data-docf-ok>Agregar</button>
      </div>`, (m) => {
      m.querySelector('[data-docf-ok]').addEventListener('click', async () => {
        const tipo = m.querySelector('[name=tipo]').value;
        const descripcion = tipo === 'otro' ? m.querySelector('[name=desc]').value.trim() : '';
        if (tipo === 'otro' && !descripcion) return aviso('Escribe qué documento se solicita', 'warning');
        const { error } = await sb().from('poliza_documentos_solicitados')
          .upsert({ poliza_id: S.polizaId, cliente_id: S.clienteId, tipo, descripcion, origen: 'manual' }, { onConflict: 'poliza_id,tipo,descripcion' });
        if (error) return aviso('No se pudo agregar: ' + error.message, 'error');
        cerrarModal(); await recargar();
      });
    });
  }

  // Detalles abiertos (se recuerdan al recargar la lista)
  const abiertos = new Set();
  document.addEventListener('toggle', (e) => {
    const det = e.target;
    if (!det.matches || !det.matches('[data-docf-det]')) return;
    if (det.open) abiertos.add(det.dataset.docfDet); else abiertos.delete(det.dataset.docfDet);
  }, true);

  // ------------------------------------------------------------------ IA
  const pendienteIA = (d) => ['sin_procesar', 'error'].includes(d.estado_ia) && !d._file;
  let iaOcupada = false;
  async function clasificarIA(ids) {
    if (iaOcupada) return aviso('Ya hay un análisis en curso', 'warning');
    iaOcupada = true;
    let ok = 0, errores = 0, noComp = 0;
    try {
      ids.forEach((id) => { const d = S.documentos.find((x) => x.id === id); if (d) d.estado_ia = 'procesando'; });
      render();
      aviso(`Analizando ${ids.length} documento(s)…`, 'info');
      for (let i = 0; i < ids.length; i += 5) {
        const { data, error } = await sb().functions.invoke('clasificar-documento', { body: { documento_ids: ids.slice(i, i + 5) } });
        if (error) { errores += Math.min(5, ids.length - i); console.error('IA:', error); continue; }
        (data?.resultados || []).forEach((r) => { if (r.estado === 'procesado') ok++; else if (r.estado === 'no_compatible') noComp++; else errores++; });
      }
      aviso(`IA: ${ok} procesado(s)${noComp ? `, ${noComp} no compatible(s)` : ''}${errores ? `, ${errores} con error` : ''}. Revisa los datos antes de confirmar.`, errores ? 'warning' : 'success');
    } finally {
      iaOcupada = false;
      await recargar();
    }
  }

  // Verificación rápida: archivo a la izquierda, todos los datos a la derecha, un solo botón
  const pendientesDe = (d) => (S.extracciones[d.id] || []).some((x) => x.estado === 'por_revisar' || x.estado === 'sugerido');
  async function verificar(d) {
    if (!d) return;
    const lista = (S.extracciones[d.id] || []).slice().sort((a, b) => (a.estado === 'confirmado') - (b.estado === 'confirmado'));
    const url = await urlDe(d);
    const t = (d.tipo_archivo || '').toLowerCase(), e = ext(d.nombre_archivo);
    const esImg = t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'jfif'].includes(e);
    const visor = esImg ? `<img src="${esc(url)}" alt="">` : `<iframe src="${esc(url)}" title="documento"></iframe>`;
    const siguientes = S.documentos.filter((x) => x.id !== d.id && pendientesDe(x));
    modal(`
      <div class="docf-visor-head"><h3>Verificar: ${esc(d.nombre_estandar || d.nombre_archivo)}</h3>
        <button type="button" class="docf-btn-ico" data-docf-cerrar><span class="material-symbols-rounded">close</span></button></div>
      <div class="docf-verif">
        <div class="docf-verif-doc">
          ${esImg ? `<div class="docf-giro">
            <button type="button" class="docf-btn-ico" data-giro="-90" title="Girar a la izquierda"><span class="material-symbols-rounded">rotate_left</span></button>
            <button type="button" class="docf-btn-ico" data-giro="90" title="Girar a la derecha"><span class="material-symbols-rounded">rotate_right</span></button>
            <button type="button" class="docf-btn-ico" data-zoom="0.25" title="Acercar"><span class="material-symbols-rounded">zoom_in</span></button>
            <button type="button" class="docf-btn-ico" data-zoom="-0.25" title="Alejar"><span class="material-symbols-rounded">zoom_out</span></button></div>` : ''}
          <div class="docf-visor">${visor}</div>
        </div>
        <div class="docf-verif-campos">
          <p class="docf-sub">Corrige lo que esté mal y pulsa <b>Confirmar todo</b>. Desmarca un dato para dejarlo pendiente.</p>
          ${lista.map((x) => `
            <div class="docf-verif-fila" data-id="${x.id}">
              <input type="checkbox" class="docf-verif-ok" ${x.estado === 'confirmado' ? 'checked disabled' : x.estado === 'no_aplica' ? 'disabled' : 'checked'} title="Confirmar este dato">
              <label>${esc(x.campo.replace(/_/g, ' '))}
                <input type="text" class="docf-verif-valor" value="${esc(x.valor || '')}" data-orig="${esc(x.valor || '')}" placeholder="No identificado" ${x.estado === 'confirmado' ? 'disabled' : ''}>
              </label>
              <select class="docf-verif-est" ${x.estado === 'confirmado' ? 'disabled' : ''}>
                <option value="confirmado">${x.estado === 'confirmado' ? 'Confirmado' : x.confianza != null ? Math.round(x.confianza) + '%' : 'Dato'}</option>
                <option value="no_aplica" ${x.estado === 'no_aplica' ? 'selected' : ''}>No aplica</option>
                <option value="no_identificado" ${x.estado === 'no_identificado' ? 'selected' : ''}>No identificado</option>
              </select>
            </div>`).join('')}
        </div>
      </div>
      <div class="docf-modal-acc">
        <button type="button" class="docf-btn-sec" data-docf-cerrar>Cancelar</button>
        ${siguientes.length ? `<button type="button" class="docf-btn-sec" data-verif-sig>Confirmar y siguiente (${siguientes.length})</button>` : ''}
        <button type="button" class="docf-btn-pri" data-verif-ok>Confirmar todo</button>
      </div>`, (m) => {
      m.querySelector('.docf-modal-caja').classList.add('ancho');
      const img = m.querySelector('.docf-visor img');
      if (img) {
        let giro = 0, zoom = 1;
        const aplicar = () => { img.style.transform = `rotate(${giro}deg) scale(${zoom})`; };
        m.querySelectorAll('[data-giro]').forEach((b) => b.addEventListener('click', () => { giro = (giro + Number(b.dataset.giro) + 360) % 360; aplicar(); }));
        m.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => { zoom = Math.min(3, Math.max(0.5, zoom + Number(b.dataset.zoom))); aplicar(); }));
      }
      // Escribir o cambiar el estado marca el dato para confirmar
      m.querySelectorAll('.docf-verif-fila').forEach((fila) => {
        const ok = fila.querySelector('.docf-verif-ok'), est = fila.querySelector('.docf-verif-est');
        fila.querySelector('.docf-verif-valor').addEventListener('input', () => { if (!ok.disabled) ok.checked = true; });
        est.addEventListener('change', () => { ok.disabled = false; ok.checked = true; });
      });
      const guardar = async (siguiente) => {
        const botones = m.querySelectorAll('[data-verif-ok],[data-verif-sig]');
        botones.forEach((b) => { b.disabled = true; });
        const cambios = [];
        m.querySelectorAll('.docf-verif-fila').forEach((fila) => {
          const ok = fila.querySelector('.docf-verif-ok');
          if (ok.disabled || !ok.checked) return;
          const input = fila.querySelector('.docf-verif-valor');
          let estado = fila.querySelector('.docf-verif-est').value;
          const valor = input.value.trim();
          if (estado === 'confirmado' && !valor) estado = 'no_identificado';
          const c = { estado, valor: valor || null };
          if (valor !== input.dataset.orig) c.origen = 'manual';
          cambios.push(sb().from('documento_extracciones').update(c).eq('id', fila.dataset.id));
        });
        const res = await Promise.all(cambios);
        const err = res.find((r) => r.error);
        if (err) { botones.forEach((b) => { b.disabled = false; }); return aviso('No se pudo guardar: ' + err.error.message, 'error'); }
        // Si ya no quedan datos pendientes, el documento queda revisado
        const quedan = m.querySelectorAll('.docf-verif-ok:not(:checked):not(:disabled)').length;
        if (!quedan) {
          await sb().from('documentos').update({ estado_revision: 'confirmado', confirmado_por: await usuarioId(), confirmado_en: new Date().toISOString() }).eq('id', d.id);
          await historial(d.id, 'confirmar', null, null, `${cambios.length} datos verificados`);
        }
        aviso(`${cambios.length} dato(s) guardados`, 'success');
        await recargar();
        if (siguiente) {
          const prox = S.documentos.find((x) => x.id !== d.id && pendientesDe(x));
          if (prox) return verificar(prox);
        }
        cerrarModal();
      };
      m.querySelector('[data-verif-ok]').addEventListener('click', () => guardar(false));
      m.querySelector('[data-verif-sig]')?.addEventListener('click', () => guardar(true));
      m.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) guardar(!!m.querySelector('[data-verif-sig]')); });
      m.querySelector('.docf-verif-valor:not([disabled])')?.focus();
    });
  }

  // Revisar un dato extraído: confirmar, corregir o marcar No aplica
  function revisarDato(x, d) {
    modal(`
      <h3>${esc(x.campo.replace(/_/g, ' '))}</h3>
      <p class="docf-sub">${esc(d?.nombre_estandar || d?.nombre_archivo || '')}${x.confianza != null ? ` · IA ${Math.round(x.confianza)}% confianza` : ''}</p>
      <label>Valor<input name="valor" type="text" value="${esc(x.valor || '')}" placeholder="No identificado"></label>
      <div class="docf-modal-acc">
        <button type="button" class="docf-btn-sec" data-e="no_aplica">No aplica</button>
        <button type="button" class="docf-btn-sec" data-e="no_identificado">No identificado</button>
        <button type="button" class="docf-btn-pri" data-e="confirmado">Confirmar</button>
      </div>`, (m) => {
      m.querySelectorAll('[data-e]').forEach((b) => b.addEventListener('click', async () => {
        const estado = b.dataset.e;
        const valor = m.querySelector('[name=valor]').value.trim();
        if (estado === 'confirmado' && !valor) return aviso('Escribe el valor o marca «No identificado»', 'warning');
        const cambios = { estado, valor: estado === 'confirmado' ? valor : x.valor };
        if (estado === 'confirmado' && valor !== (x.valor || '')) cambios.origen = 'manual';
        const { error } = await sb().from('documento_extracciones').update(cambios).eq('id', x.id);
        if (error) return aviso('No se pudo guardar: ' + error.message, 'error');
        cerrarModal(); aviso('Dato guardado', 'success'); await recargar();
      }));
    });
  }

  // ------------------------------------------------------------------ arrastrar y soltar
  document.addEventListener('change', (e) => {
    if (e.target.matches('#documentosContainer .docf-drop input[type=file]')) { subirRapido(e.target.files); e.target.value = ''; }
  });
  let arrastres = 0;
  const marcar = (on) => document.querySelector('#documentosContainer .docf')?.classList.toggle('docf-arrastrando', on);
  document.addEventListener('dragenter', (e) => {
    if (!e.target.closest?.('#documentosContainer') || !e.dataTransfer?.types?.includes('Files')) return;
    arrastres++; marcar(true);
  });
  document.addEventListener('dragleave', (e) => {
    if (!e.target.closest?.('#documentosContainer')) return;
    if (--arrastres <= 0) { arrastres = 0; marcar(false); }
  });
  document.addEventListener('dragover', (e) => {
    if (e.target.closest?.('#documentosContainer') && e.dataTransfer?.types?.includes('Files')) e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    if (!e.target.closest?.('#documentosContainer') || !e.dataTransfer?.files?.length) return;
    e.preventDefault(); arrastres = 0; marcar(false);
    subirRapido(e.dataTransfer.files);
  });

  // ------------------------------------------------------------------ eventos
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#documentosContainer')) return;
    const t = e.target.closest('[data-docf-int],[data-docf-subir],[data-docf-ver],[data-docf-menu],[data-docf-sol],[data-docf-sol-nuevo],[data-docf-ia],[data-docf-ext],[data-docf-verif]');
    if (!t) return;
    e.preventDefault();
    const doc = (id) => S.documentos.find((d) => d.id === id);
    if (t.dataset.docfInt) { S.seleccionado = t.dataset.docfInt; return render(); }
    if (t.dataset.docfSubir) return document.querySelector('#documentosContainer .docf-drop input')?.click();
    if (t.dataset.docfVer) return ver(doc(t.dataset.docfVer));
    if (t.dataset.docfVerif) return verificar(doc(t.dataset.docfVerif));
    if (t.dataset.docfMenu) return menu(doc(t.dataset.docfMenu));
    if (t.dataset.docfSol) return menuSolicitado(S.solicitados.find((s) => s.id === t.dataset.docfSol));
    if (t.dataset.docfSolNuevo) return nuevoSolicitado();
    if (t.dataset.docfIa) {
      const docs = (S.seleccionado === 'general' ? S.documentos : S.documentos.filter((d) => integranteDe(d) === S.seleccionado)).filter(pendienteIA);
      if (!docs.length) return aviso('No hay documentos pendientes de analizar', 'info');
      if (!confirm(`Se analizarán ${docs.length} documento(s) con IA (OpenAI). ¿Continuar?`)) return;
      return clasificarIA(docs.map((d) => d.id));
    }
    if (t.dataset.docfExt) {
      for (const [docId, lista] of Object.entries(S.extracciones)) {
        const x = lista.find((y) => y.id === t.dataset.docfExt);
        if (x) return revisarDato(x, S.documentos.find((d) => d.id === docId));
      }
    }
  });

  async function recargar() {
    try {
      if (S.modo === 'pendiente') cargarPendiente(); else await cargarTodo(S.clienteId);
      render();
    }
    catch (err) { console.error('documentos:', err); }
  }

  // ---------------------------------------------------- reemplazo de la pestaña
  // cliente_editar.js llama cargarDocumentos(clienteId) al abrir el cliente
  const cargarOriginal = window.cargarDocumentos;
  window.cargarDocumentos = async function (clienteId) {
    try {
      S.modo = 'bd';
      await cargarTodo(clienteId);
      render();
    } catch (err) {
      // Si algo falla (p. ej. falta la migración), se usa la vista anterior: producción no se detiene
      console.error('Vista nueva de documentos no disponible, se usa la anterior:', err);
      if (typeof cargarOriginal === 'function') return cargarOriginal(clienteId);
    }
  };

  // Pantallas sin cargarDocumentos propio: cliente_crear y cliente_recuperado-cambioDeVida
  async function iniciar() {
    const pag = pagina();
    if (pag === 'editar') return;               // lo maneja cargarDocumentos
    if (pag === 'crear') { cargarPendiente(); return render(); }
    const id = clienteRecuperado();
    if (!id) {
      const c = contenedor();
      if (c) c.innerHTML = '<div class="docf"><div class="docf-vacio"><span class="material-symbols-rounded">person_search</span><p>Busca y selecciona un cliente para ver sus documentos</p></div></div>';
      return;
    }
    try { S.modo = 'bd'; await cargarTodo(id); render(); }
    catch (err) { console.error('documentos:', err); }
  }

  // El botón "Agregar Archivo" de las 3 pantallas abre el flujo nuevo
  window.agregarDocumento = async function () {
    const pag = pagina();
    if (pag === 'recuperado' && !clienteRecuperado()) return aviso('Primero selecciona un cliente', 'warning');
    if (pag === 'crear') cargarPendiente();
    else if (pag === 'recuperado' && S.clienteId !== clienteRecuperado()) await iniciar();
    document.querySelector('#documentosContainer .docf-drop input')?.click();
  };

  // Al abrir la pestaña Documentos se refrescan integrantes (crear) o se carga el cliente (recuperado)
  document.addEventListener('click', (e) => {
    if (e.target.closest('.tab-btn[data-tab="documentos"]') && pagina() !== 'editar') setTimeout(iniciar, 0);
  });

  // cliente_recuperado: al seleccionar otro cliente se recargan sus documentos
  if (pagina() === 'recuperado' && typeof window.seleccionarCliente === 'function') {
    const selOriginal = window.seleccionarCliente;
    window.seleccionarCliente = async function (...args) {
      const r = await selOriginal.apply(this, args);
      S.seleccionado = 'titular';
      iniciar();
      return r;
    };
  }

  // cliente_crear: los archivos se suben justo después de crear el cliente y sus dependientes
  // (crearCliente llama guardarNotas(cliente.id) después de guardar dependientes)
  async function subirPendientes(clienteId) {
    if (!S.pendientes.length || !clienteId) return;
    const pendientes = S.pendientes.slice();
    const fallidos = [], paraIA = [];
    try {
      S.modo = 'bd';
      await cargarTodo(clienteId);   // integrantes reales con sus IDs
      const norm = (t) => slug(t);
      for (const d of pendientes) {
        let clave = d._integrante;
        if (String(clave).startsWith('tmp:')) {
          clave = (S.integrantes.find((i) => i.dependienteId && norm(i.nombre) === norm(d._integranteNombre)) || {}).clave || 'titular';
        }
        try {
          const nuevo = await subirArchivo(d._file, { integrante: clave, categoria: d.categoria, subtipo: d.subtipo, anio: d.anio_fiscal, auto: d._auto });
          if (d._auto && nuevo && !String(d.tipo_archivo || '').startsWith('audio/')) paraIA.push(nuevo);
        } catch (err) { console.error('No se pudo subir', d.nombre_archivo, err); fallidos.push(d.nombre_archivo); }
      }
    } catch (err) {
      console.error('Documentos pendientes:', err);
      fallidos.push(...pendientes.map((d) => d.nombre_archivo));
    }
    S.pendientes = [];
    // Análisis IA de lo que se subió sin datos (espera máx. 20 s para no frenar el guardado del cliente)
    if (paraIA.length) {
      const ia = (async () => { for (let i = 0; i < paraIA.length; i += 5) await sb().functions.invoke('clasificar-documento', { body: { documento_ids: paraIA.slice(i, i + 5) } }); })();
      await Promise.race([ia.catch((e) => console.warn('IA:', e)), new Promise((r) => setTimeout(r, 20000))]);
    }
    if (fallidos.length) alert('El cliente se guardó, pero estos archivos no se pudieron subir. Súbelos desde Editar cliente > Documentos:\n\n' + fallidos.join('\n'));
  }
  if (pagina() === 'crear' && typeof window.guardarNotas === 'function') {
    const notasOriginal = window.guardarNotas;
    window.guardarNotas = async function (clienteId, ...resto) {
      const r = await notasOriginal.call(this, clienteId, ...resto);
      await subirPendientes(clienteId);   // nunca lanza error: no detiene la creación del cliente
      return r;
    };
  }

  window.DocumentosFamilia = { recargar, iniciar, subir: (cat) => abrirSubir(cat || 'otro'), subirPendientes };

  // Abrir directo la pestaña si viene de Análisis > Documentos (?tab=documentos)
  if (new URLSearchParams(location.search).get('tab') === 'documentos') {
    window.addEventListener('load', () => setTimeout(() => document.querySelector('.tab-btn[data-tab="documentos"]')?.click(), 600));
  }
})();