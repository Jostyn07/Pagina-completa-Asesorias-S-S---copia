/* Logger de depuración: solo escribe en la consola si el modo depuración está activo.
   Activar:    localStorage.setItem('ss_debug', '1')   (y recargar)
   Desactivar: localStorage.removeItem('ss_debug')
   console.error no se toca (lo usa Sentry). */
(function () {
  function activo() {
    try { return localStorage.getItem('ss_debug') === '1'; } catch (e) { return false; }
  }
  window.dbg = {
    log: function () { if (activo()) console.log.apply(console, arguments); },
    info: function () { if (activo()) console.info.apply(console, arguments); },
    warn: function () { if (activo()) console.warn.apply(console, arguments); }
  };
})();
