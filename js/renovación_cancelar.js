/* ============================================================================
 * Ruta en el repo: js/renovacion_cancelar.js
 * En la ficha del BORRADOR de renovación, "Cancelar" cancela la renovación:
 * borra el borrador y deja la póliza anterior otra vez lista para renovar
 * (vuelven "Renovar" y "No quiere renovar"). Luego abre la póliza anterior.
 * En cualquier otra ficha, "Cancelar" funciona como siempre.
 * Se carga DESPUÉS de cliente_editar.js y renovacion.js.
 * ==========================================================================*/
(function () {
  'use strict';
  if (typeof window.cancelarFormulario !== 'function') return;
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);

  async function polizaBorrador() {
    let pid = null;
    try { if (typeof polizaId !== 'undefined') pid = polizaId; } catch (e) {}
    if (!pid) return null;
    const { data } = await sb().from('polizas')
      .select('id, numero_poliza, estado_renovacion, poliza_origen_id').eq('id', pid).maybeSingle();
    return data && data.estado_renovacion === 'Borrador' && data.poliza_origen_id ? data : null;
  }

  const original = window.cancelarFormulario;
  window.cancelarFormulario = async function () {
    let borrador = null;
    try { borrador = await polizaBorrador(); } catch (e) {}
    if (!borrador) return original.apply(this, arguments);

    if (!confirm(`¿Cancelar la renovación?\n\nSe borrará el borrador ${borrador.numero_poliza || ''} y la póliza anterior quedará lista para renovar de nuevo.`)) return;

    const btn = document.querySelector('.btn-cancel');
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await sb().rpc('cancelar_renovacion', { p_poliza_id: borrador.id });
      if (error) throw error;
      try { localStorage.removeItem(`borrador_cliente_${clienteId}`); } catch (e) {}
      try { clearInterval(autosaveTimer); } catch (e) {}
      window.location.href = data?.cliente_anterior_id
        ? `./cliente_editar.html?id=${encodeURIComponent(data.cliente_anterior_id)}`
        : './polizas.html';
    } catch (e) {
      alert('No se pudo cancelar la renovación: ' + (e.message || e));
      if (btn) btn.disabled = false;
    }
  };
})();