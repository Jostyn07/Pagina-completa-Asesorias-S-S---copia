// ============================================================================
// Ruta en el repo: js/carteras_tiempo_real.js
// FASE 3 — Accesos de cartera en tiempo real
// Se carga en pages/polizas.html después de polizas.js.
//
// Escucha (Supabase Realtime) los cambios en permisos_cartera del usuario que
// tiene la página abierta. Cuando un admin le concede o le revoca una cartera en
// Usuarios → Carteras, su lista de pólizas se recarga sola en ese momento.
// Requiere que permisos_cartera esté en la publicación supabase_realtime.
// ============================================================================

(function () {
  let canal = null;
  let espera = null;

  function sb() {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient; } catch (e) {}
    return null;
  }

  function avisar(msg) {
    if (typeof mostrarNotificacion === 'function') return mostrarNotificacion(msg, 'info');
    if (window.Notyf) return new Notyf({ duration: 4000 }).success(msg);
    console.info(msg);
  }

  // Varios cambios seguidos (p. ej. 10 carteras concedidas a la vez) → una sola recarga
  function recargar(evento) {
    clearTimeout(espera);
    espera = setTimeout(async () => {
      const concedido = evento.eventType === 'INSERT' || (evento.new && evento.new.activo === true);
      avisar(concedido ? 'Se te concedió acceso a nuevas carteras. Actualizando pólizas…'
                       : 'Se actualizaron tus accesos de cartera. Actualizando pólizas…');
      try {
        if (typeof cargarPolizas === 'function') await cargarPolizas();
      } catch (e) {
        console.warn('[carteras] no se pudo recargar:', e?.message || e);
      }
    }, 800);
  }

  async function iniciar() {
    const cliente = sb();
    if (!cliente) return;
    const { data: { session } } = await cliente.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;

    canal = cliente
      .channel('permisos-cartera-' + uid)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'permisos_cartera', filter: `beneficiario_id=eq.${uid}` },
        recargar)
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') console.info('[carteras] escuchando cambios de acceso en tiempo real');
        if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') console.warn('[carteras] tiempo real no disponible:', estado);
      });

    window.addEventListener('beforeunload', () => { if (canal) cliente.removeChannel(canal); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();