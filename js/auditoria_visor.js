// ============================================================================
// Ruta en el repo: js/auditoria_visor.js
// FASE 4 — Visor de auditoría (pages/auditoria.html)
// Lee auditoria_eventos; la base de datos solo deja leer a quien tenga
// ver_logs_auditoria (RLS de la fase 1). Paginado en el servidor.
// Cada consulta queda registrada como 'auditoria.consulta'.
// ============================================================================

(function () {
  const POR_PAGINA = 50;
  let pagina = 0;
  let total = 0;
  let usuarios = {};

  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const NOMBRES = {
    'pagina.view': 'Entró a una página', 'cliente.view': 'Abrió un cliente', 'poliza.view': 'Abrió una póliza',
    'sesion.inicio': 'Inició sesión', 'filtros.aplicar': 'Aplicó filtros', 'poliza.renovar': 'Renovó una póliza',
    'poliza.renovacion_iniciar': 'Inició una renovación', 'cartera.conceder': 'Concedió una cartera',
    'cartera.revocar': 'Revocó una cartera', 'auditoria.consulta': 'Consultó la auditoría',
    'ranking.consulta': 'Consultó el ranking',
  };
  function nombreAccion(a) {
    if (NOMBRES[a]) return NOMBRES[a];
    const [tabla, op] = String(a).split('.');
    const verbo = { crear: 'Creó', editar: 'Editó', eliminar: 'Eliminó', insert: 'Creó', update: 'Editó', delete: 'Eliminó' }[op];
    return verbo ? `${verbo} en ${tabla}` : a;
  }

  // ---------- Detalle legible: Campo | Antes | Después
  const CAMPOS = {
    nombres: 'Nombres', apellidos: 'Apellidos', genero: 'Género', email: 'Correo', telefono1: 'Teléfono 1',
    telefono2: 'Teléfono 2', fecha_nacimiento: 'Fecha de nacimiento', ssn: 'SSN', estado_migratorio: 'Estado migratorio',
    direccion: 'Dirección', ciudad: 'Ciudad', estado: 'Estado', codigo_postal: 'Código postal', condado: 'Condado',
    casa_apartamento: 'Casa/Apto', po_box: 'PO Box', ocupacion: 'Ocupación', ingreso_anual: 'Ingreso anual',
    nacionalidad: 'Nacionalidad', aplica: 'Aplica', tipo_registro: 'Tipo de registro', tipo_modificacion: 'Tipo de modificación',
    caso_especial: 'Caso especial', condiciones_medicas: 'Condiciones médicas', tipo_declaracion: 'Tipo de declaración',
    tiene_social: 'Tiene SSN', operador_nombre: 'Operador', venta_realizada_por: 'Venta realizada por', portal: 'Portal',
    agente_nombre: 'Agente', archivado: 'Archivado', motivo_archivo: 'Motivo de archivo',
    numero_poliza: 'Número de póliza', compania: 'Compañía', plan: 'Plan', prima: 'Prima', credito_fiscal: 'Crédito fiscal',
    member_id: 'Member ID', aplicantes: 'Aplicantes', fecha_efectividad: 'Fecha de efectividad',
    fecha_inicial_cobertura: 'Inicio de cobertura', fecha_final_cobertura: 'Fin de cobertura',
    estado_compania: 'Estado compañía', estado_mercado: 'Estado mercado', estado_documentos: 'Estado documentos',
    documentos_pendientes: 'Documentos solicitados', fecha_plazo_documentos: 'Plazo de documentos',
    observacion_compania: 'Observación compañía', observacion_mercado: 'Observación mercado', observacion_pagos: 'Observación pagos',
    email_portal: 'Correo portal', contrasena_portal: 'Contraseña portal', clave_seguridad: 'Clave de seguridad',
    enlace_poliza: 'Enlace póliza', pagado_hasta: 'Pagado hasta', fecha_confirmacion: 'Fecha de confirmación',
    agente35_estado: 'Agente 3.5 estado', agente35_notas: 'Agente 3.5 notas', estado_renovacion: 'Estado de renovación',
    mensaje: 'Nota', observacion: 'Observación', medio_comunicacion: 'Medio', fecha_seguimiento: 'Fecha del seguimiento',
    seguimiento_efectivo: 'Comunicación efectiva', relacion: 'Relación', sexo: 'Sexo', member_id_dep: 'Member ID dependiente',
    tipo: 'Tipo', nombre_banco: 'Banco', numero_cuenta: 'N.º de cuenta', routing_number: 'Routing', nombre_cuenta: 'Nombre en la cuenta',
    numero_tarjeta: 'N.º de tarjeta', nombre_tarjeta: 'Nombre en la tarjeta', fecha_expiracion: 'Expiración', cvv: 'CVV',
    tipo_tarjeta: 'Tipo de tarjeta', activo: 'Activo', tiene_metodo_pago: 'Tiene método de pago',
    tiene_pago_automatico: 'Pago automático', estado_pago: 'Estado del pago', fecha_pago: 'Fecha de pago', anio: 'Año',
    nombre_archivo: 'Archivo', notas: 'Notas', detalle: 'Detalle', titulo: 'Título', descripcion: 'Descripción',
    fecha_recordatorio: 'Fecha', rol: 'Rol', portales: 'Portales', es_supervisor: 'Supervisor', supervisor_id: 'Supervisor asignado',
  };
  const etiqueta = (c) => CAMPOS[c] || String(c).replace(/_/g, ' ').replace(/^./, (l) => l.toUpperCase());
  const valor = (v) => {
    if (v === null || v === undefined || v === '') return '<span class="aud-nulo">vacío</span>';
    if (v === true) return 'Sí';
    if (v === false) return 'No';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) { const [a, m, d] = v.slice(0, 10).split('-'); return `${m}/${d}/${a}`; }
    if (typeof v === 'object') return esc(JSON.stringify(v));
    return esc(v);
  };

  function htmlDetalle(d) {
    const cambios = Array.isArray(d.cambios) ? d.cambios : null;
    if (!cambios) {
      // Eventos antiguos o de navegación: se muestra tal cual
      return `<details><summary>Ver</summary><pre>${esc(JSON.stringify(d, null, 2))}</pre></details>`;
    }
    if (!cambios.length) return '';
    const tieneAntes = cambios.some((c) => 'antes' in c);
    const tieneDespues = cambios.some((c) => 'despues' in c);
    const filas = cambios.map((c) => {
      const oculto = c.antes === '(oculto)' && c.despues === '(oculto)';
      return `<tr><th>${esc(etiqueta(c.campo))}</th>
        ${oculto ? `<td colspan="${tieneAntes && tieneDespues ? 2 : 1}"><em>(cambió — dato protegido)</em></td>` :
          (tieneAntes ? `<td class="aud-antes">${valor(c.antes)}</td>` : '') +
          (tieneDespues ? `<td class="aud-despues">${valor(c.despues)}</td>` : '')}
      </tr>`;
    }).join('');
    const cab = `<tr><th>Campo</th>${tieneAntes ? '<th>Antes</th>' : ''}${tieneDespues ? '<th>' + (tieneAntes ? 'Después' : 'Lo que se puso') + '</th>' : ''}</tr>`;
    const resumen = cambios.length === 1 ? esc(etiqueta(cambios[0].campo)) : `${cambios.length} campos`;
    return `<details ${cambios.length <= 3 ? 'open' : ''}><summary>${resumen}</summary>
      <table class="aud-cambios"><thead>${cab}</thead><tbody>${filas}</tbody></table></details>`;
  }

  function estilosDetalle() {
    if (document.getElementById('estilosAudDetalle')) return;
    const css = document.createElement('style');
    css.id = 'estilosAudDetalle';
    css.textContent = `
      .aud-cambios{border-collapse:collapse;margin-top:6px;font-size:.78rem;min-width:280px;max-width:520px}
      .aud-cambios th,.aud-cambios td{border:1px solid var(--border-color,#e2e8f0);padding:4px 8px;text-align:left;vertical-align:top;word-break:break-word}
      .aud-cambios thead th{background:var(--bg-primary,#f8fafc);font-size:.7rem;text-transform:uppercase;color:var(--text-secondary,#64748b)}
      .aud-cambios th{position:static;letter-spacing:0}
      .aud-cambios tbody th{font-weight:600;white-space:nowrap;text-transform:none;font-size:.78rem;color:inherit;background:transparent}
      .aud-antes{color:#b91c1c;text-decoration:line-through;text-decoration-color:rgba(185,28,28,.4)}
      .aud-despues{color:#15803d;font-weight:600}
      .aud-nulo{color:var(--text-secondary,#94a3b8);font-style:italic;font-weight:400;text-decoration:none}
      [data-theme="dark"] .aud-antes{color:#fca5a5}[data-theme="dark"] .aud-despues{color:#86efac}`;
    document.head.appendChild(css);
  }

  function filtros() {
    return {
      desde: $('audDesde').value, hasta: $('audHasta').value, accion: $('audAccion').value.trim(),
      usuario: $('audUsuario').value, cliente: $('audCliente').value.trim(), poliza: $('audPoliza').value.trim(),
    };
  }

  async function cargarUsuarios() {
    const { data } = await sb().from('usuarios').select('id, nombre').order('nombre');
    usuarios = Object.fromEntries((data || []).map((u) => [u.id, u.nombre]));
    $('audUsuario').innerHTML = '<option value="">Todos</option>' +
      (data || []).map((u) => `<option value="${u.id}">${esc(u.nombre)}</option>`).join('');
  }

  async function cargar(registrar) {
    const f = filtros();
    const cuerpo = $('audCuerpo');
    cuerpo.innerHTML = '<tr><td colspan="6" class="aud-vacio">Cargando…</td></tr>';

    let q = sb().from('auditoria_eventos')
      .select('id, created_at, usuario_id, usuario_nombre, accion, recurso, recurso_id, cliente_id, poliza_id, ruta, metodo, detalle', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    if (f.desde) q = q.gte('created_at', f.desde + 'T00:00:00-05:00');
    if (f.hasta) q = q.lte('created_at', f.hasta + 'T23:59:59-05:00');
    if (f.accion) q = q.ilike('accion', `%${f.accion}%`);
    if (f.usuario) q = q.eq('usuario_id', f.usuario);
    if (f.cliente) q = q.eq('cliente_id', f.cliente);
    if (f.poliza) q = q.eq('poliza_id', f.poliza);

    const { data, error, count } = await q;
    if (error) {
      cuerpo.innerHTML = `<tr><td colspan="6" class="aud-vacio">No se pudo cargar: ${esc(error.message)}</td></tr>`;
      return;
    }
    total = count || 0;
    $('audTotal').textContent = `${total.toLocaleString('es-CO')} eventos`;
    $('audPagina').textContent = total ? `Página ${pagina + 1} de ${Math.ceil(total / POR_PAGINA)}` : '';
    $('audAnterior').disabled = pagina === 0;
    $('audSiguiente').disabled = (pagina + 1) * POR_PAGINA >= total;

    if (!data?.length) { cuerpo.innerHTML = '<tr><td colspan="6" class="aud-vacio">No hay eventos con estos filtros.</td></tr>'; return; }

    // Datos de las pólizas y clientes de esta página (número de póliza y nombre del cliente)
    const polizaIds = [...new Set(data.map((e) => e.poliza_id).filter(Boolean))];
    const polizas = {};
    if (polizaIds.length) {
      const { data: ps } = await sb().from('polizas')
        .select('id, numero_poliza, cliente_id, clientes(nombres, apellidos)')
        .in('id', polizaIds);
      (ps || []).forEach((p) => { polizas[p.id] = p; });
    }
    const clienteIds = [...new Set(data.map((e) => e.cliente_id).filter((id) => id && !Object.values(polizas).some((p) => p.cliente_id === id)))];
    const clientes = {};
    if (clienteIds.length) {
      const { data: cs } = await sb().from('clientes').select('id, nombres, apellidos').in('id', clienteIds);
      (cs || []).forEach((c) => { clientes[c.id] = c; });
    }
    const nombreCli = (c) => c ? `${c.nombres || ''} ${c.apellidos || ''}`.trim() : '';

    cuerpo.innerHTML = data.map((e) => {
      const det = e.detalle && Object.keys(e.detalle).length ? JSON.stringify(e.detalle) : '';
      const pol = e.poliza_id ? polizas[e.poliza_id] : null;
      const cliId = e.cliente_id || pol?.cliente_id;
      const cliNombre = nombreCli(pol?.clientes) || nombreCli(clientes[e.cliente_id]);
      const enlace = (texto) => cliId
        ? `<a href="./cliente_editar.html?id=${encodeURIComponent(cliId)}" target="_blank">${esc(texto)}</a>` : esc(texto);
      const ids = [
        e.poliza_id ? (pol ? enlace(pol.numero_poliza || 'Póliza') : `<span title="${esc(e.poliza_id)}">póliza (sin acceso o eliminada)</span>`) : '',
        cliNombre ? enlace(cliNombre) : (e.cliente_id && !pol ? enlace('cliente') : ''),
      ].filter(Boolean).join(' · ');
      return `<tr>
        <td class="aud-fecha">${new Date(e.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' })}</td>
        <td>${esc(e.usuario_nombre || usuarios[e.usuario_id] || 'Sistema')}</td>
        <td><span class="aud-chip m-${esc(e.metodo)}">${esc(nombreAccion(e.accion))}</span><small>${esc(e.accion)}</small></td>
        <td>${esc(e.ruta || '')}</td>
        <td>${esc(e.recurso || '')} ${ids ? '<small>' + ids + '</small>' : ''}</td>
        <td>${det ? htmlDetalle(e.detalle) : ''}</td>
      </tr>`;
    }).join('');

    if (registrar && typeof window.auditar === 'function') {
      const usados = Object.entries(f).filter(([, v]) => v).map(([k]) => k);
      window.auditar('auditoria.consulta', { recurso: 'auditoria_eventos', detalle: { filtros: usados, pagina: pagina + 1 } });
    }
  }

  async function iniciar() {
    estilosDetalle();
    const cliente = sb();
    if (!cliente) return;
    const { data: puede } = await cliente.rpc('tiene_permiso', { p_clave: 'ver_logs_auditoria' });
    if (!puede) {
      $('audContenido').innerHTML = '<div class="aud-sin-permiso"><span class="material-symbols-rounded">lock</span><h2>Sin acceso</h2><p>Necesitas el permiso <strong>ver_logs_auditoria</strong> para ver esta página.</p></div>';
      return;
    }
    const hoy = new Date();
    const hace7 = new Date(hoy.getTime() - 6 * 864e5);
    const iso = (d) => d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    $('audDesde').value = iso(hace7);
    $('audHasta').value = iso(hoy);

    await cargarUsuarios();
    $('audBuscar').addEventListener('click', () => { pagina = 0; cargar(true); });
    $('audLimpiar').addEventListener('click', () => {
      ['audAccion', 'audUsuario', 'audCliente', 'audPoliza'].forEach((id) => { $(id).value = ''; });
      $('audDesde').value = iso(hace7); $('audHasta').value = iso(hoy);
      pagina = 0; cargar(true);
    });
    $('audAnterior').addEventListener('click', () => { if (pagina > 0) { pagina--; cargar(false); } });
    $('audSiguiente').addEventListener('click', () => { pagina++; cargar(false); });
    document.querySelectorAll('#audFiltros input').forEach((i) =>
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { pagina = 0; cargar(true); } }));
    cargar(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();