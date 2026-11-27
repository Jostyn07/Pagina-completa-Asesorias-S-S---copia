(function () {
  'use strict';
  try {
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabaseClient;
    if (!client || !client.auth || client.auth.__getUserCache) return;

    const VIGENCIA_MS = 60 * 1000;
    const original = client.auth.getUser.bind(client.auth);
    let promesa = null;
    let hasta = 0;

    client.auth.getUser = function (jwt) {
      if (jwt) return original(jwt);                       // token explícito: sin caché
      const ahora = Date.now();
      if (promesa && ahora < hasta) return promesa;
      hasta = ahora + VIGENCIA_MS;
      promesa = original().then((r) => {
        if (!r || r.error || !r.data?.user) { promesa = null; hasta = 0; }
        return r;
      }, (e) => { promesa = null; hasta = 0; throw e; });
      return promesa;
    };
    client.auth.__getUserCache = true;

    // Permisos: tiene_permiso se consulta una sola vez por clave durante la vida de la página
    // (solo se guardan respuestas correctas; se vacía si cambia la sesión).
    if (!client.__rpcPermisosCache && typeof client.rpc === 'function') {
      client.__rpcPermisosCache = true;
      const rpcOriginal = client.rpc.bind(client);
      const permisos = new Map();
      client.rpc = function (fn, args, opts) {
        if (fn !== 'tiene_permiso') return rpcOriginal(fn, args, opts);
        const clave = JSON.stringify(args || {});
        if (!permisos.has(clave)) {
          const p = Promise.resolve(rpcOriginal(fn, args, opts)).then(
            (r) => { if (!r || r.error) permisos.delete(clave); return r; },
            (e) => { permisos.delete(clave); throw e; }
          );
          permisos.set(clave, p);
        }
        return permisos.get(clave);
      };
      client.auth.onAuthStateChange(() => permisos.clear());
    }

    client.auth.onAuthStateChange((evento) => {
      if (evento !== 'TOKEN_REFRESHED') { promesa = null; hasta = 0; }
    });
  } catch (e) { /* sin caché: todo funciona como antes */ }
})();