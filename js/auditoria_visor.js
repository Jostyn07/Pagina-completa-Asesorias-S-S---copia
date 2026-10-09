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

    cuerpo.innerHTML = data.map((e) => {
      const det = e.detalle && Object.keys(e.detalle).length ? JSON.stringify(e.detalle) : '';
      const ids = [
        e.cliente_id ? `<a href="./cliente_editar.html?id=${encodeURIComponent(e.cliente_id)}" target="_blank" title="${esc(e.cliente_id)}">cliente</a>` : '',
        e.poliza_id ? `<span title="${esc(e.poliza_id)}">póliza</span>` : '',
      ].filter(Boolean).join(' · ');
      return `<tr>
        <td class="aud-fecha">${new Date(e.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' })}</td>
        <td>${esc(e.usuario_nombre || usuarios[e.usuario_id] || 'Sistema')}</td>
        <td><span class="aud-chip m-${esc(e.metodo)}">${esc(nombreAccion(e.accion))}</span><small>${esc(e.accion)}</small></td>
        <td>${esc(e.ruta || '')}</td>
        <td>${esc(e.recurso || '')} ${ids ? '<small>' + ids + '</small>' : ''}</td>
        <td>${det ? `<details><summary>Ver</summary><pre>${esc(JSON.stringify(e.detalle, null, 2))}</pre></details>` : ''}</td>
      </tr>`;
    }).join('');

    if (registrar && typeof window.auditar === 'function') {
      const usados = Object.entries(f).filter(([, v]) => v).map(([k]) => k);
      window.auditar('auditoria.consulta', { recurso: 'auditoria_eventos', detalle: { filtros: usados, pagina: pagina + 1 } });
    }
  }

  async function iniciar() {
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