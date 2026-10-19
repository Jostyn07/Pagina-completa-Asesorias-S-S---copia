(function () {
  'use strict';
  if (typeof window.compararCambios !== 'function') return;

  const sb = () => supabaseClient;
  const $ = (id) => document.getElementById(id);
  const val = (id) => { const e = $(id); return e ? (e.value ?? '') : undefined; };

  // ---------------------------------------------------------------- utilidades
  let usuarioCache = null;
  async function usuario() {
    if (usuarioCache) return usuarioCache;
    const { data: { user } } = await sb().auth.getUser();
    const { data } = await sb().from('usuarios').select('nombre').eq('email', user.email).maybeSingle();
    usuarioCache = { nombre: data?.nombre || user.email, email: user.email };
    return usuarioCache;
  }

  const n = (v) => (typeof normalizarValor === 'function' ? normalizarValor(Array.isArray(v) ? v.join(', ') : v) : String(v ?? '').trim());

  // cambios: [{ campo, antes, despues }]
  async function registrar(tipo, seccion, cambios) {
    try {
      const filas = (cambios || []).filter((c) => c && (c.antes || c.despues));
      if (!filas.length) return;
      const u = await usuario();
      const ahora = new Date().toISOString();
      const { error } = await sb().from('historial_cambios').insert(filas.map((c) => ({
        cliente_id: clienteId,
        tipo_cambio: tipo,
        seccion,
        campo_modificado: c.campo,
        valor_anterior: c.antes ? String(c.antes).slice(0, 500) : null,
        valor_nuevo: c.despues ? String(c.despues).slice(0, 500) : null,
        usuario_nombre: u.nombre,
        usuario_email: u.email,
        created_at: ahora,
      })));
      if (error) throw error;
      if (document.querySelector('#tab-historial.active')) await cargarHistorial(clienteId);
    } catch (e) { console.warn('[historial] no se registró:', e); }
  }

  function diff(antes, despues, etiquetas) {
    const out = [];
    Object.keys(etiquetas).forEach((k) => {
      const a = n(antes?.[k]); const d = n(despues?.[k]);
      if (a !== d) out.push({ campo: etiquetas[k], antes: a || '(vacío)', despues: d || '(vacío)' });
    });
    return out;
  }

  const ultimos4 = (v) => { const s = String(v || '').replace(/\D/g, ''); return s ? '•••• ' + s.slice(-4) : ''; };

  // ----------------------------------------------------- 1) Falso "Agente 3.5"
  // guardarEstadoSeguimiento llama registrarCambioEstado(clienteId, estadoData) con
  // 2 parámetros, pero la función espera 4 → siempre guardaba "Estado Cambiado · Agente 3.5"
  // vacío. Los cambios de estado ya se registran en "Póliza Editada".
  const registrarCambioEstadoOriginal = window.registrarCambioEstado;
  window.registrarCambioEstado = function (cid, tipoEstado, anterior, nuevo) {
    if (typeof tipoEstado !== 'string') return Promise.resolve();
    return registrarCambioEstadoOriginal.apply(this, arguments);
  };

  // ------------------------------------- 2) Campos que no se comparaban al guardar
  const compararOriginal = window.compararCambios;
  window.compararCambios = function (originales, nuevos, seccion) {
    try {
      nuevos = Object.assign({}, nuevos);
      if (seccion === 'Información Personal') {
        delete nuevos.tipoDeclaracion; // clave mal escrita: daba falso cambio
        if (val('tipoDeclaracion') !== undefined) nuevos.tipo_declaracion = val('tipoDeclaracion');
        if (val('casoEspecial') !== undefined) nuevos.caso_especial = val('casoEspecial');
        if (val('fechaRegistro') !== undefined) nuevos.fecha_registro = val('fechaRegistro');
        const chk = $('tieneSsn');
        if (chk) nuevos.tiene_social = chk.checked ? 'Si' : 'No';
        if (!esAdministrador() && val('tipoRegistro') !== undefined) nuevos.tipo_registro = val('tipoRegistro');
      }
      if (seccion === 'Póliza') {
        const extra = {
          agente_nombre: 'agenteNombre',
          aplicantes: 'aplicantes',
          observaciones: 'observaciones',
          fecha_revision_compania: 'fechaRevisionCompania',
          nombre_agente_compania: 'nombreAgenteCompania',
        };
        Object.entries(extra).forEach(([col, id]) => { if (val(id) !== undefined) nuevos[col] = val(id); });

        const puedeMercado = typeof tienePermiso === 'function' && tienePermiso('editar_estado_mercado');
        if (puedeMercado) {
          const mercado = {
            estado_mercado: 'estadoMercado', estado_documentos: 'estadoDocumentos',
            nombre_agente_mercado: 'nombreAgenteMercado', fecha_revision_mercado: 'fechaRevisionMercado',
            documentos_pendientes: 'documentosPendientes', fecha_plazo_documentos: 'fechaPlazoDocumento',
            agente_externo_mercado: 'agenteExterno', agente_externo_mercado2: 'agenteExterno2',
          };
          Object.entries(mercado).forEach(([col, id]) => { if (!(col in nuevos) && val(id) !== undefined) nuevos[col] = val(id); });
          // observación de mercado: el campo no se precarga, solo se registra si se escribe algo
          const obs = (val('observacionMercado') || '').trim();
          if (obs && obs !== n(originales?.observacion_mercado)) nuevos.observacion_mercado = obs;
        }
      }
    } catch (e) { console.warn('[historial] comparación extra omitida:', e); }
    return compararOriginal.call(this, originales, nuevos, seccion);
  };

  // nombres legibles de los campos nuevos
  const formatearOriginal = window.formatearNombreCampo;
  const NOMBRES = {
    agente_nombre: 'Agente', aplicantes: 'Aplicantes', caso_especial: 'Caso especial',
    fecha_registro: 'Fecha de registro', tiene_social: 'Tiene SSN', tipo_declaracion: 'Tipo de declaración',
    estado_migratorio: 'Estado migratorio', nacionalidad: 'Nacionalidad', nombres: 'Nombres', apellidos: 'Apellidos',
    condiciones_medicas: 'Condiciones médicas', portal: 'Portal', venta_realizada_por: 'Venta realizada por',
    plan: 'Plan', prima: 'Prima', credito_fiscal: 'Crédito fiscal', fecha_efectividad: 'Fecha de efectividad',
    fecha_inicial_cobertura: 'Fecha inicial de cobertura', fecha_final_cobertura: 'Fecha final de cobertura',
    email_portal: 'Email del portal', contrasena_portal: 'Contraseña del portal',
    observacion_compania: 'Observación (Compañía)', fecha_revision_compania: 'Fecha de revisión (Compañía)',
    nombre_agente_compania: 'Agente (Compañía)', observacion_mercado: 'Observación (Mercado)',
    fecha_plazo_documentos: 'Plazo de documentos', agente_externo_mercado: 'Agente externo 1',
    agente_externo_mercado2: 'Agente externo 2', operador_nombre: 'Operador',
  };
  window.formatearNombreCampo = function (campo) {
    return NOMBRES[campo] || formatearOriginal.call(this, campo);
  };

  // la contraseña del portal no se guarda en texto en el historial
  const registrarCambioOriginal = window.registrarCambio;
  window.registrarCambio = function (cid, tipo, seccion, cambios) {
    (cambios || []).forEach((c) => {
      if (c.campo === 'contrasena_portal') { c.valorAnterior = c.valorAnterior ? '••••' : ''; c.valorNuevo = '•••• (modificada)'; }
    });
    // borrarCambioProgramado enviaba el id del cambio en lugar del id del cliente
    if (tipo === 'cambio_programado_eliminado') cid = clienteId;
    return registrarCambioOriginal.call(this, cid, tipo, seccion, cambios);
  };

  // ------------------------------------------------------------ 3) Dependientes
  const ETQ_DEP = {
    nombres: 'Nombres', apellidos: 'Apellidos', fecha_nacimiento: 'Fecha de nacimiento', sexo: 'Sexo',
    ssn: 'SSN', estado_migratorio: 'Estado migratorio', relacion: 'Relación', aplica: 'Aplica', member_id_dep: 'Member ID',
  };
  const nombreDep = (d) => `${d?.nombres || ''} ${d?.apellidos || ''}`.trim();
  const leerDeps = async () => (await sb().from('dependientes').select('*').eq('cliente_id', clienteId)).data || [];

  const actualizarDepsOriginal = window.actualizarDependientes;
  window.actualizarDependientes = async function () {
    let antes = null;
    try { antes = await leerDeps(); } catch (e) {}
    const r = await actualizarDepsOriginal.apply(this, arguments);
    if (antes) {
      try {
        const despues = await leerDeps();
        const mapa = Object.fromEntries(antes.map((d) => [d.id, d]));
        const cambios = [];
        despues.forEach((d) => {
          const a = mapa[d.id];
          if (!a) { cambios.push({ campo: 'Dependiente agregado', antes: '', despues: `${nombreDep(d)}${d.relacion ? ' (' + d.relacion + ')' : ''}` }); return; }
          diff(a, d, ETQ_DEP).forEach((c) => {
            if (c.campo === 'SSN') { c.antes = c.antes === '(vacío)' ? c.antes : ultimos4(a.ssn); c.despues = c.despues === '(vacío)' ? c.despues : ultimos4(d.ssn); }
            cambios.push({ campo: `${nombreDep(d)} · ${c.campo}`, antes: c.antes, despues: c.despues });
          });
        });
        await registrar('dependiente_editado', 'Dependientes', cambios);
      } catch (e) { console.warn('[historial] dependientes:', e); }
    }
    return r;
  };

  const eliminarDepOriginal = window.eliminarDependienteCard;
  window.eliminarDependienteCard = async function (count, depId) {
    let dep = null;
    if (depId) { try { dep = (await sb().from('dependientes').select('*').eq('id', depId).maybeSingle()).data; } catch (e) {} }
    const r = await eliminarDepOriginal.apply(this, arguments);
    if (dep) {
      const { data } = await sb().from('dependientes').select('id').eq('id', depId).maybeSingle();
      if (!data) await registrar('dependiente_eliminado', 'Dependientes', [{ campo: 'Dependiente eliminado', antes: nombreDep(dep), despues: '' }]);
    }
    return r;
  };

  // -------------------------------------------------------------- 4) Documentos
  const guardarDocsOriginal = window.guardarDocumentosNuevos;
  window.guardarDocumentosNuevos = async function () {
    const nombres = [];
    document.querySelectorAll('.documento-card.nuevo input[type="file"]').forEach((i) => { if (i.files?.[0]) nombres.push(i.files[0].name); });
    const r = await guardarDocsOriginal.apply(this, arguments);
    if (nombres.length) await registrar('documento_agregado', 'Documentos', nombres.map((x) => ({ campo: 'Documento agregado', antes: '', despues: x })));
    return r;
  };

  const eliminarDocOriginal = window.confirmarEliminarDocumento;
  window.confirmarEliminarDocumento = async function (docId) {
    let doc = null;
    try { doc = (await sb().from('documentos').select('id, nombre_archivo').eq('id', docId).maybeSingle()).data; } catch (e) {}
    const r = await eliminarDocOriginal.apply(this, arguments);
    if (doc) {
      const { data } = await sb().from('documentos').select('id').eq('id', docId).maybeSingle();
      if (!data) await registrar('documento_eliminado', 'Documentos', [{ campo: 'Documento eliminado', antes: doc.nombre_archivo, despues: '' }]);
    }
    return r;
  };

  // ------------------------------------------------------------------- 5) Notas
  const eliminarNotaOriginal = window.confirmarEliminarNota;
  window.confirmarEliminarNota = async function (notaId) {
    let nota = null;
    try { nota = (await sb().from('notas').select('id, mensaje').eq('id', notaId).maybeSingle()).data; } catch (e) {}
    const r = await eliminarNotaOriginal.apply(this, arguments);
    if (nota) {
      const { data } = await sb().from('notas').select('id').eq('id', notaId).maybeSingle();
      if (!data) {
        const txt = String(nota.mensaje || '').replace(/<[^>]+>/g, '').trim();
        await registrar('nota_eliminada', 'Notas', [{ campo: 'Nota Eliminada', antes: txt.slice(0, 100) + (txt.length > 100 ? '...' : '') || '(imagen)', despues: '' }]);
      }
    }
    return r;
  };

  // ---------------------------------------------------------- 6) Métodos de pago
  const descMetodo = (m) => m.tipo === 'banco'
    ? `Banco ${m.nombre_banco || ''} ${ultimos4(m.numero_cuenta)}`.replace(/\s+/g, ' ').trim()
    : `Tarjeta ${m.tipo_tarjeta ? m.tipo_tarjeta.toUpperCase() : ''} ${ultimos4(m.numero_tarjeta)}`.replace(/\s+/g, ' ').trim();
  const ETQ_MP = {
    nombre_banco: 'Banco', routing_number: 'Routing number', nombre_cuenta: 'Nombre en la cuenta',
    nombre_tarjeta: 'Nombre en la tarjeta', fecha_expiracion: 'Fecha de expiración', tipo_tarjeta: 'Tipo de tarjeta',
    usar_misma_direccion: 'Usar misma dirección',
  };
  const leerMetodos = async () => (await sb().from('metodos_pago').select('*').eq('cliente_id', clienteId)).data || [];

  const guardarMetodoOriginal = window.guardarMetodoPago;
  window.guardarMetodoPago = async function () {
    let antes = null;
    try { antes = await leerMetodos(); } catch (e) {}
    const r = await guardarMetodoOriginal.apply(this, arguments);
    if (antes) {
      try {
        const despues = await leerMetodos();
        const mA = Object.fromEntries(antes.map((m) => [m.id, m]));
        const mD = Object.fromEntries(despues.map((m) => [m.id, m]));
        const cambios = [];
        despues.forEach((m) => {
          const a = mA[m.id];
          if (!a) { cambios.push({ campo: 'Método agregado', antes: '', despues: descMetodo(m) }); return; }
          if (n(a.numero_cuenta) !== n(m.numero_cuenta)) cambios.push({ campo: 'Número de cuenta', antes: ultimos4(a.numero_cuenta), despues: ultimos4(m.numero_cuenta) });
          if (n(a.numero_tarjeta) !== n(m.numero_tarjeta)) cambios.push({ campo: 'Número de tarjeta', antes: ultimos4(a.numero_tarjeta), despues: ultimos4(m.numero_tarjeta) });
          if (n(a.cvv) !== n(m.cvv)) cambios.push({ campo: `${descMetodo(m)} · CVV`, antes: a.cvv ? '•••' : '', despues: '••• (modificado)' });
          diff(a, m, ETQ_MP).forEach((c) => cambios.push({ campo: `${descMetodo(m)} · ${c.campo}`, antes: c.antes, despues: c.despues }));
          if (!!a.activo !== !!m.activo && m.activo) cambios.push({ campo: 'Método principal', antes: '', despues: descMetodo(m) });
        });
        antes.forEach((a) => { if (!mD[a.id]) cambios.push({ campo: 'Método eliminado', antes: descMetodo(a), despues: '' }); });
        const pA = antes.find((m) => m.activo) || {}; const pD = despues.find((m) => m.activo) || {};
        if (n(pA.tiene_metodo_pago) !== n(pD.tiene_metodo_pago)) cambios.push({ campo: 'Tiene método de pago', antes: pA.tiene_metodo_pago || '(vacío)', despues: pD.tiene_metodo_pago || '(vacío)' });
        if (n(pA.tiene_pago_automatico) !== n(pD.tiene_pago_automatico)) cambios.push({ campo: 'Pago automático', antes: pA.tiene_pago_automatico || '(vacío)', despues: pD.tiene_pago_automatico || '(vacío)' });
        await registrar('metodo_pago_editado', 'Método de pago', cambios);
      } catch (e) { console.warn('[historial] métodos de pago:', e); }
    }
    return r;
  };

  // --------------------------------------------------------- 7) Meses pagados
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const guardarMesesOriginal = window.guardarMesesPagados;
  window.guardarMesesPagados = async function () {
    const anio = parseInt(val('anioMesesPagados'), 10) || new Date().getFullYear();
    let antes;
    try { antes = (await sb().from('pagos_mensuales_cliente').select('*').eq('cliente_id', clienteId).eq('anio', anio).maybeSingle()).data || {}; } catch (e) {}
    const r = await guardarMesesOriginal.apply(this, arguments);
    if (antes) {
      try {
        const despues = (await sb().from('pagos_mensuales_cliente').select('*').eq('cliente_id', clienteId).eq('anio', anio).maybeSingle()).data || {};
        const cambios = [];
        MESES.forEach((m) => {
          const a = antes[m] === 'Si' ? 'Pagado' : 'No pagado'; const d = despues[m] === 'Si' ? 'Pagado' : 'No pagado';
          if (a !== d) cambios.push({ campo: `${m.charAt(0).toUpperCase() + m.slice(1)} ${anio}`, antes: a, despues: d });
        });
        diff(antes, despues, { estado_pago: 'Estado de pago', fecha_pago: 'Fecha de pago' })
          .forEach((c) => cambios.push({ campo: `${c.campo} ${anio}`, antes: c.antes, despues: c.despues }));
        await registrar('pagos_editados', 'Pagos', cambios);
      } catch (e) { console.warn('[historial] meses pagados:', e); }
    }
    return r;
  };

  // ------------------------------------------------------------- 8) Seguimientos
  const guardarSegOriginal = window.guardarSeguimientoModal;
  window.guardarSeguimientoModal = async function () {
    const segId = val('modal_seg_id');
    let antes = null;
    if (segId) { try { antes = (await sb().from('seguimientos').select('*').eq('id', segId).maybeSingle()).data; } catch (e) {} }
    const r = await guardarSegOriginal.apply(this, arguments);
    if (antes) {
      try {
        const despues = (await sb().from('seguimientos').select('*').eq('id', segId).maybeSingle()).data;
        if (despues) {
          const cambios = diff(antes, despues, { fecha_seguimiento: 'Fecha', medio_comunicacion: 'Medio', observacion: 'Observación', seguimiento_efectivo: 'Efectivo' });
          await registrar('seguimiento_editado', 'Seguimientos', cambios);
        }
      } catch (e) { console.warn('[historial] seguimiento:', e); }
    }
    return r;
  };

  const efectivaOriginal = window.actualizarComunicacionEfectiva;
  window.actualizarComunicacionEfectiva = async function (esEfectivo) {
    const ult = (typeof seguimientosData !== 'undefined' && seguimientosData?.[0]) || null;
    const antes = ult?.seguimiento_efectivo;
    const r = await efectivaOriginal.apply(this, arguments);
    if (ult && ult.seguimiento_efectivo !== antes) {
      await registrar('seguimiento_editado', 'Seguimientos', [{ campo: 'Comunicación efectiva', antes: antes || 'No', despues: ult.seguimiento_efectivo }]);
    }
    return r;
  };

  // ------------------------------------------------------------- 9) Archivar
  const archivarOriginal = window.ejecutarArchivarCliente;
  window.ejecutarArchivarCliente = async function () {
    // el original redirige al terminar, por eso se registra antes
    if (typeof tienePermiso === 'function' && tienePermiso('archivar_cliente')) {
      await registrar('cliente_archivado', 'Cliente', [{ campo: 'Cliente archivado', antes: '', despues: val('motivoArchivo') || 'Sin motivo' }]);
    }
    return archivarOriginal.apply(this, arguments);
  };

  // -------------------------------------------- 10) Cambio programado aplicado
  const aplicarOriginal = window.aplicarCambioAhora;
  window.aplicarCambioAhora = async function (cambioId) {
    let cambio = null;
    try { cambio = (await sb().from('polizas_pendientes').select('id, tipo_cambio, fecha_efectividad, campos_modificados').eq('id', cambioId).maybeSingle()).data; } catch (e) {}
    const confirmar = window.confirm;
    let acepto = false;
    window.confirm = function (msg) { acepto = confirmar.call(window, msg); return acepto; };
    const hrefDesc = Object.getOwnPropertyDescriptor(window, 'location');
    try {
      // registrar antes del redirect: se intercepta el primer alert de éxito
      const alertar = window.alert;
      window.alert = function (msg) {
        window.alert = alertar;
        if (acepto && cambio && String(msg).indexOf('✅') === 0) {
          registrar('cambio_programado_aplicado', 'Cambios Programados', [{
            campo: cambio.tipo_cambio === 'recuperado' ? 'Recuperado' : 'Cambio de vida',
            antes: `Programado para ${cambio.fecha_efectividad}`,
            despues: `Aplicado ahora${cambio.campos_modificados ? ': ' + cambio.campos_modificados : ''}`,
          }]);
        }
        return alertar.call(window, msg);
      };
      return await aplicarOriginal.apply(this, arguments);
    } finally {
      window.confirm = confirmar;
      void hrefDesc;
    }
  };

  // ------------------------------------------------ títulos e iconos en la línea de tiempo
  const TIPOS = {
    dependiente_editado: ['Dependientes Editados', 'family_restroom'],
    dependiente_eliminado: ['Dependiente Eliminado', 'person_remove'],
    documento_agregado: ['Documento Agregado', 'upload_file'],
    documento_eliminado: ['Documento Eliminado', 'delete'],
    metodo_pago_editado: ['Método de Pago Editado', 'credit_card'],
    pagos_editados: ['Pagos Editados', 'payments'],
    seguimiento_editado: ['Seguimiento Editado', 'edit_note'],
    cliente_archivado: ['Cliente Archivado', 'archive'],
    cambio_programado_aplicado: ['Cambio Programado Aplicado', 'bolt'],
    cambio_programado_eliminado: ['Cambio Programado Eliminado', 'event_busy'],
  };
  const itemOriginal = window.crearItemHistorial;
  window.crearItemHistorial = function (grupo) {
    let html = itemOriginal.apply(this, arguments);
    const t = TIPOS[grupo?.tipo_cambio];
    if (t) {
      html = html.replace('>Cambio Realizado<', `>${t[0]}<`)
        .replace('<span class="material-symbols-rounded">edit</span>', `<span class="material-symbols-rounded">${t[1]}</span>`);
    }
    return html;
  };

  function completarFiltroTipos() {
    const sel = $('filtroTipoCambio');
    if (!sel) return;
    Object.entries(TIPOS).forEach(([k, [t]]) => {
      if (!sel.querySelector(`option[value="${k}"]`)) sel.insertAdjacentHTML('beforeend', `<option value="${k}">${t}</option>`);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', completarFiltroTipos);
  else completarFiltroTipos();
})();