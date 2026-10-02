// Ruta en el repo (ASESORÍAS): js/xiris.js
// Botón "Xiris" del sidebar (id="menu-xiris").
//
// Al hacer clic abre SIEMPRE una pestaña nueva con la pantalla
// "Conectando tu cuenta de Xiris" (conexion/index.html de este sitio, con su
// sonido ambiente). Mientras se ve la animación, esta página pide el acceso
// a la Edge Function "ir-a-xiris" y luego lleva esa pestaña a Xiris (/auth/sso),
// que abre la sesión. Asesorías se queda abierta en la pestaña original.
//
// Si el usuario no tiene cuenta de Xiris (o algo falla), la pestaña muestra
// el aviso con el botón "Ir al inicio de sesión", que lleva al login de Xiris.
//
// Cargar DESPUÉS del script que crea el cliente de Supabase.

(function () {
  const XIRIS_URL = 'https://www.xiris.online'; // sin "/" al final
  const XIRIS_LOGIN = `${XIRIS_URL}/login`;
  const XIRIS_REDIRECT = '/dashboard';
  const MINIMO_MS = 1800; // tiempo mínimo de la animación antes de pasar a Xiris
  const LIMITE_MS = 15000; // tiempo máximo esperando a la Edge Function

  // La pantalla de conexión vive en ESTE sitio (carpeta /conexion junto a /js y /pages)
  const CONEXION_BASE = new URL('../conexion/', document.currentScript?.src || location.href).href;
  const ORIGEN = location.origin;

  // Logo izquierdo según el portal del usuario:
  // Dante SY o Isabel SY → logo FM; cualquier otro portal → logo S&S
  const PORTALES_FM = ['Dante SY', 'Isabel SY'];
  function logoSegunPortal() {
    let portales = [];
    try { if (typeof datosUsuario !== 'undefined' && datosUsuario) portales = datosUsuario.portales || []; } catch (e) {}
    if (!Array.isArray(portales)) portales = [portales];
    return portales.some((p) => PORTALES_FM.includes(p)) ? 'fm' : 'ss';
  }

  function getClient() {
    // `const` globales no quedan en window, por eso se revisan con typeof
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.functions) return supabaseClient; } catch (e) {}
    try { if (typeof supabase !== 'undefined' && supabase?.functions) return supabase; } catch (e) {}
    if (window.supabaseClient?.functions) return window.supabaseClient;
    return null;
  }

  // Lee el mensaje de error que devolvió la Edge Function
  async function mensajeDeError(error, data) {
    if (data?.error) return data.error;
    try {
      const body = await error?.context?.clone().json();
      if (body?.error) return body.error;
    } catch (e) {}
    return 'No se pudo conectar con Xiris.';
  }

  let enCurso = false;

  function irAXiris(ev) {
    ev.preventDefault();
    if (enCurso) return;
    enCurso = true;

    const link = ev.currentTarget;
    link.style.pointerEvents = 'none';
    const liberar = () => { enCurso = false; link.style.pointerEvents = ''; };

    // ---------- 1) Pestaña nueva con la pantalla de conexión (se abre dentro del clic
    //               para que el navegador no la bloquee como ventana emergente)
    const tab = window.open(`${CONEXION_BASE}index.html?modo=tab&logo=${logoSegunPortal()}`, '_blank');
    if (!tab) {
      // El navegador bloqueó la pestaña: se abre el login de Xiris
      liberar();
      window.open(XIRIS_LOGIN, '_blank');
      return;
    }

    let cargada = false;
    let salio = false;
    const pendientes = [];
    const enviar = (m) => (cargada ? tab.postMessage(m, ORIGEN) : pendientes.push(m));

    const ir = (url) => {
      if (salio) return;
      salio = true;
      window.removeEventListener('message', onMsg);
      try { tab.location.href = url; } catch (e) { window.open(url, '_blank'); }
      liberar();
    };

    function onMsg(e) {
      if (e.origin !== ORIGEN || e.source !== tab) return;
      const d = e.data || {};
      if (d.type === 'xiris-conexion:cargada') {
        cargada = true;
        pendientes.splice(0).forEach((m) => tab.postMessage(m, ORIGEN));
      }
      // Botón del aviso de error: lleva al login de Xiris para entrar manualmente
      if (d.type === 'xiris-conexion:cerrar') ir(XIRIS_LOGIN);
    }
    window.addEventListener('message', onMsg);

    // Respaldo visible: si la pantalla animada no carga en 4 s, la pestaña nunca queda en negro
    setTimeout(() => {
      if (cargada || salio || tab.closed) return;
      console.warn('[Ir a Xiris] la pantalla animada no cargó desde', `${CONEXION_BASE}index.html`,
        '— revisa que la carpeta /conexion esté publicada junto a /js y /pages');
      try {
        tab.document.title = 'Conectando con Xiris';
        tab.document.body.style.cssText = 'margin:0;background:#0D0D0F;';
        tab.document.body.innerHTML =
          '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
          'color:#F2C77A;font:500 18px system-ui,sans-serif;letter-spacing:.03em;">Conectando con Xiris…</div>';
      } catch (e) {}
    }, 4000);

    // ---------- 2) Pedir el acceso mientras corre la animación
    const inicio = Date.now();
    const client = getClient();

    (async () => {
      try {
        if (!client) throw new Error('No se encontró la sesión de Asesorías.');
        const limite = new Promise((_, no) =>
          setTimeout(() => no(new Error('Xiris está tardando en responder. Vuelve a intentarlo.')), LIMITE_MS));
        console.info('[Ir a Xiris] pidiendo acceso');
        const { data, error } = await Promise.race([
          client.functions.invoke('ir-a-xiris', { body: { redirect: XIRIS_REDIRECT } }),
          limite,
        ]);
        if (error || !data?.url) throw new Error(await mensajeDeError(error, data));

        console.info('[Ir a Xiris] acceso recibido, pasando a Xiris');
        setTimeout(() => ir(data.url), Math.max(0, MINIMO_MS - (Date.now() - inicio)));
      } catch (e) {
        console.error('[Ir a Xiris]', e.message);
        if (tab.closed) return liberar();
        // Se muestra el aviso en la pestaña (si aún está cargando, se entrega al terminar)
        enviar({ type: 'xiris-conexion:error', msg: `${e.message} Puedes entrar con tu correo y contraseña.`, boton: 'Ir al inicio de sesión' });
        liberar();
        // Si la pantalla no carga en 4 s, se va directo al login
        setTimeout(() => { if (!cargada) ir(XIRIS_LOGIN); }, 4000);
      }
    })();
  }

  function init() {
    const btn = document.getElementById('menu-xiris');
    if (btn && !btn.dataset.xirisListo) {
      btn.dataset.xirisListo = '1';
      btn.setAttribute('target', '_blank');
      btn.setAttribute('rel', 'noopener');
      btn.addEventListener('click', irAXiris);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();