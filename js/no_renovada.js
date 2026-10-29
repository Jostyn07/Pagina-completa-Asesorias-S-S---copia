/* ============================================================================
 * Ruta en el repo: js/no_renovada.js
 * Ficha del cliente: botón "No quiere renovar" junto a "Renovar".
 *   - Marca la póliza como estado_renovacion = 'No renovada' con su motivo, y
 *     queda en el Historial de Cambios (quién, cuándo y por qué).
 *   - Si ya está marcada, muestra un aviso con "Reactivar" (vuelve a Pendiente).
 * Usa el mismo permiso que Renovar (renovar_poliza).
 * No aparece en pólizas renovadas, en renovación en proceso ni en borradores.
 * Se carga DESPUÉS de cliente_editar.js y renovacion.js. Si algo falla, la ficha sigue igual.
 * ==========================================================================*/
(function () {
  'use strict';
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MOTIVOS = ['Cliente no desea renovar', 'Se fue con otra agencia', 'No califica', 'No se pudo contactar', 'Otro'];

  let poliza = null;

  function idPoliza() {
    try { if (typeof polizaId !== 'undefined' && polizaId) return polizaId; } catch (e) {}
    return null;
  }

  async function iniciar() {
    // esperar a que la ficha cargue la póliza
    let pid = null;
    for (let i = 0; i < 40 && !pid; i++) { pid = idPoliza(); if (!pid) await new Promise((r) => setTimeout(r, 250)); }
    if (!pid) return;

    const { data, error } = await sb().from('polizas')
      .select('id, cliente_id, numero_poliza, estado_renovacion').eq('id', pid).maybeSingle();
    if (error || !data) return;
    poliza = data;

    const estado = poliza.estado_renovacion || 'Pendiente';
    if (['Renovada', 'En proceso', 'Borrador'].includes(estado)) return;

    const { data: permitido } = await sb().rpc('tiene_permiso', { p_clave: 'renovar_poliza' });
    if (!permitido) { if (estado === 'No renovada') aviso(false); return; }

    if (estado === 'No renovada') aviso(true);
    else boton();
  }

  // ---------------------------------------------------------------- UI
  function boton() {
    if ($('btnNoRenovar')) return;
    const izquierda = document.querySelector('.page-header .header-left');
    if (!izquierda) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'btnNoRenovar';
    b.className = 'btn-no-renovar';
    b.innerHTML = '<span class="material-symbols-rounded">block</span> No quiere renovar';
    b.addEventListener('click', abrirModal);
    const ref = $('btnRenovarPoliza') || izquierda.querySelector('.btn-back');
    if (ref) ref.insertAdjacentElement('afterend', b); else izquierda.appendChild(b);
  }

  async function aviso(puedeReactivar) {
    document.querySelectorAll('.aviso-no-renovada').forEach((e) => e.remove());
    const header = document.querySelector('.page-header');
    if (!header) return;
    let detalle = '';
    try {
      const { data } = await sb().from('historial_cambios')
        .select('valor_nuevo, usuario_nombre, created_at')
        .eq('cliente_id', poliza.cliente_id).eq('tipo_cambio', 'poliza_no_renovada').eq('campo_modificado', 'Motivo')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        const f = new Date(data.created_at);
        detalle = ` · ${esc(data.valor_nuevo)} · ${esc(data.usuario_nombre)} ${String(f.getMonth() + 1).padStart(2, '0')}/${String(f.getDate()).padStart(2, '0')}/${f.getFullYear()}`;
      }
    } catch (e) {}
    const div = document.createElement('div');
    div.className = 'aviso-renovacion aviso-no-renovada';
    div.innerHTML = `<span class="material-symbols-rounded">block</span>
      <span><strong>No quiere renovar</strong>${detalle}</span>
      ${puedeReactivar ? '<button type="button" class="btn-reactivar-renov">Reactivar</button>' : ''}`;
    div.querySelector('.btn-reactivar-renov')?.addEventListener('click', reactivar);
    header.insertAdjacentElement('afterend', div);
  }

  function abrirModal() {
    let m = $('modalNoRenovar');
    if (!m) {
      m = document.createElement('div');
      m.id = 'modalNoRenovar';
      m.className = 'nr-modal';
      m.innerHTML = `
        <div class="nr-box">
          <h3>No quiere renovar · <span id="nrPoliza"></span></h3>
          <label>Motivo
            <select id="nrMotivo">${MOTIVOS.map((x) => `<option>${x}</option>`).join('')}</select>
          </label>
          <label>Detalle
            <textarea id="nrDetalle" rows="3"></textarea>
          </label>
          <div class="nr-acciones">
            <button type="button" class="nr-cancelar">Cancelar</button>
            <button type="button" class="nr-confirmar"><span class="material-symbols-rounded">block</span> Confirmar</button>
          </div>
        </div>`;
      document.body.appendChild(m);
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('activo'); });
      m.querySelector('.nr-cancelar').addEventListener('click', () => m.classList.remove('activo'));
      m.querySelector('.nr-confirmar').addEventListener('click', marcar);
    }
    $('nrPoliza').textContent = poliza.numero_poliza || '';
    $('nrDetalle').value = '';
    m.classList.add('activo');
  }

  // ---------------------------------------------------------------- acciones
  async function usuario() {
    const { data: { user } } = await sb().auth.getUser();
    const { data } = await sb().from('usuarios').select('nombre').eq('id', user.id).maybeSingle();
    return { nombre: data?.nombre || user.email, email: user.email };
  }

  async function historial(filas) {
    try {
      const u = await usuario();
      const ahora = new Date().toISOString();
      await sb().from('historial_cambios').insert(filas.map((f) => ({
        cliente_id: poliza.cliente_id, tipo_cambio: f.tipo, seccion: 'Renovación',
        campo_modificado: f.campo, valor_anterior: f.antes || null, valor_nuevo: f.despues || null,
        usuario_nombre: u.nombre, usuario_email: u.email, created_at: ahora,
      })));
    } catch (e) { console.warn('[no renovada] historial:', e); }
  }

  async function cambiarEstado(nuevo) {
    const { data, error } = await sb().from('polizas')
      .update({ estado_renovacion: nuevo }).eq('id', poliza.id)
      .select('estado_renovacion').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Sin acceso a esta póliza');
    poliza.estado_renovacion = data.estado_renovacion;
  }

  async function marcar() {
    const btn = document.querySelector('#modalNoRenovar .nr-confirmar');
    btn.disabled = true;
    const motivo = $('nrMotivo').value;
    const detalle = $('nrDetalle').value.trim();
    try {
      const antes = poliza.estado_renovacion || 'Pendiente';
      await cambiarEstado('No renovada');
      const filas = [
        { tipo: 'poliza_no_renovada', campo: 'Estado de renovación', antes, despues: 'No quiere renovar' },
        { tipo: 'poliza_no_renovada', campo: 'Motivo', despues: motivo },
      ];
      if (detalle) filas.push({ tipo: 'poliza_no_renovada', campo: 'Detalle', despues: detalle });
      await historial(filas);
      $('modalNoRenovar').classList.remove('activo');
      $('btnNoRenovar')?.remove();
      $('btnRenovarPoliza')?.remove();
      aviso(true);
      if (document.querySelector('#tab-historial.active') && typeof cargarHistorial === 'function') cargarHistorial(poliza.cliente_id);
    } catch (e) {
      alert('No se pudo marcar "No quiere renovar": ' + (e.message || e));
    } finally { btn.disabled = false; }
  }

  async function reactivar() {
    if (!confirm('¿Volver a dejar esta póliza pendiente de renovar?')) return;
    try {
      await cambiarEstado('Pendiente');
      await historial([{ tipo: 'poliza_reactivada_renovacion', campo: 'Estado de renovación', antes: 'No quiere renovar', despues: 'Pendiente' }]);
      location.reload(); // vuelve a mostrar el botón Renovar
    } catch (e) {
      alert('No se pudo reactivar: ' + (e.message || e));
    }
  }

  // ---------------------------------------------------------------- estilos
  const css = document.createElement('style');
  css.textContent = `
    .btn-no-renovar { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px;
      border:1px solid #ef4444; background:transparent; color:#ef4444; font:inherit; font-size:.85rem; font-weight:600; cursor:pointer; margin-left:8px; }
    .btn-no-renovar:hover { background:rgba(239,68,68,.08); }
    .btn-no-renovar .material-symbols-rounded { font-size:18px; }
    .aviso-no-renovada { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; margin:0 0 14px;
      background:#fef2f2; color:#991b1b; border:1px solid #fecaca; font-size:.88rem; }
    .btn-reactivar-renov { margin-left:auto; padding:6px 12px; border-radius:8px; border:1px solid currentColor;
      background:transparent; color:inherit; font:inherit; font-size:.82rem; cursor:pointer; }
    [data-theme="dark"] .aviso-no-renovada { background:#2e1a1a; color:#f07070; border-color:#4a2424; }
    .nr-modal { position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; align-items:center; justify-content:center; z-index:10000; padding:16px; }
    .nr-modal.activo { display:flex; }
    .nr-box { width:100%; max-width:440px; background:#fff; color:#1e293b; border-radius:14px; padding:20px; display:flex; flex-direction:column; gap:12px; }
    [data-theme="dark"] .nr-box { background:#1a1a24; color:#e2e4e9; border:1px solid #2e2e3e; }
    .nr-box h3 { margin:0; font-size:1.05rem; }
    .nr-box label { display:flex; flex-direction:column; gap:6px; font-size:.85rem; font-weight:500; }
    .nr-box select, .nr-box textarea { padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0; font:inherit; }
    .nr-acciones { display:flex; justify-content:flex-end; gap:8px; }
    .nr-acciones button { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font:inherit; font-size:.85rem; cursor:pointer; border:1px solid #e2e8f0; background:transparent; color:inherit; }
    .nr-confirmar { background:#ef4444 !important; border-color:#ef4444 !important; color:#fff !important; }
    .nr-confirmar:disabled { opacity:.5; }
    .nr-acciones .material-symbols-rounded { font-size:18px; }`;
  document.head.appendChild(css);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();