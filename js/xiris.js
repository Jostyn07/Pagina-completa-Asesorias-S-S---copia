// Ruta en el repo (ASESORÍAS): js/xiris.js
// Botón "Xiris" del sidebar (id="menu-xiris").
//
// Al hacer clic muestra a pantalla completa "Conectando tu cuenta de Xiris"
// (alojada en Asesorías: /conexion/index.html?modo=embed) con su sonido ambiente,
// pide el acceso a la Edge Function "ir-a-xiris" y pasa a Xiris (/auth/sso),
// que muestra su pantalla de carga mientras abre la sesión.
//
// Si el usuario no tiene cuenta de Xiris (o algo falla), la pantalla muestra
// el aviso con el botón "Ir al inicio de sesión", que lleva al login de Xiris.
//
// El sonido se inicia AQUÍ, dentro del clic, porque los navegadores solo
// permiten reproducir audio como respuesta directa a una acción del usuario.
//
// Cargar DESPUÉS del script que crea el cliente de Supabase.

(function () {
  const XIRIS_URL = 'https://www.xiris.online'; // sin "/" al final
  const XIRIS_LOGIN = `${XIRIS_URL}/login`;
  // La pantalla de conexión vive en ESTE sitio (carpeta /conexion junto a /js y /pages)
  const CONEXION_BASE = new URL('../conexion/', document.currentScript?.src || location.href).href;
  const ORIGEN = location.origin;
  const XIRIS_REDIRECT = '/dashboard';
  const VOLUMEN = 0.5;
  const MINIMO_MS = 1800; // tiempo mínimo de la animación antes de pasar a Xiris

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

    // ---------- 1) Sonido: play() directo en el clic (necesario en iPhone/Safari)
    const audio = new Audio(`${CONEXION_BASE}ambient.mp3`);
    audio.loop = true;
    audio.volume = 0;
    let fadeId;
    const fade = (hasta, ms, fin) => {
      clearInterval(fadeId);
      const desde = audio.volume;
      let i = 0;
      fadeId = setInterval(() => {
        i++;
        try { audio.volume = Math.max(0, Math.min(1, desde + (hasta - desde) * (i / 20))); } catch (e) {}
        if (i >= 20) { clearInterval(fadeId); if (fin) fin(); }
      }, ms / 20);
    };
    audio.play().then(() => fade(VOLUMEN, 1200)).catch(() => {});

    // ---------- 2) Pantalla de conexión a pantalla completa
    const capa = document.createElement('div');
    capa.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0D0D0F;';
    const frame = document.createElement('iframe');
    frame.src = `${CONEXION_BASE}index.html?modo=embed`;
    frame.title = 'Conectando con Xiris';
    frame.allow = 'autoplay';
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    capa.appendChild(frame);
    document.body.appendChild(capa);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let cargada = false;
    let destino = null;
    let salio = false;
    const pendientes = [];
    const enviar = (m) => (cargada ? frame.contentWindow.postMessage(m, ORIGEN) : pendientes.push(m));

    const ir = (url) => {
      if (salio) return;
      salio = true;
      window.location.href = url; // misma pestaña
    };

    // Pasa a Xiris, que muestra su propia pantalla de carga mientras abre la sesión
    const irADestino = () => ir(destino);

    const cerrar = () => {
      window.removeEventListener('message', onMsg);
      fade(0, 300, () => audio.pause());
      capa.remove();
      document.body.style.overflow = prevOverflow;
      link.style.pointerEvents = '';
      enCurso = false;
    };

    function onMsg(e) {
      if (e.origin !== ORIGEN || e.source !== frame.contentWindow) return;
      const d = e.data || {};
      if (d.type === 'xiris-conexion:cargada') {
        cargada = true;
        pendientes.splice(0).forEach((m) => frame.contentWindow.postMessage(m, ORIGEN));
      }
      if (d.type === 'xiris-conexion:sonido') {
        if (d.on) audio.play().then(() => fade(VOLUMEN, 600)).catch(() => {});
        else fade(0, 400, () => audio.pause());
      }
      // Botón del aviso de error: lleva al login de Xiris para entrar manualmente
      if (d.type === 'xiris-conexion:cerrar') ir(XIRIS_LOGIN);
    }
    window.addEventListener('message', onMsg);

    // Respaldo: si la pantalla no carga (Xiris caído o bloquea el iframe), se quita la capa
    setTimeout(() => {
      if (!cargada && !destino && !salio) {
        cerrar();
        window.open(XIRIS_LOGIN, '_blank');
      }
    }, 8000);

    // ---------- 3) Pedir el acceso mientras corre la animación
    const inicio = Date.now();
    const client = getClient();

    (async () => {
      try {
        if (!client) throw new Error('No se encontró la sesión de Asesorías.');
        // Límite de 15 s para que la pantalla no quede esperando indefinidamente
        const limite = new Promise((_, no) =>
          setTimeout(() => no(new Error('Xiris está tardando en responder. Vuelve a intentarlo.')), 15000));
        console.info('[Ir a Xiris] pidiendo acceso');
        const { data, error } = await Promise.race([
          client.functions.invoke('ir-a-xiris', { body: { redirect: XIRIS_REDIRECT } }),
          limite,
        ]);
        if (error || !data?.url) throw new Error(await mensajeDeError(error, data));

        destino = data.url;
        console.info('[Ir a Xiris] acceso recibido, pasando a Xiris');
        setTimeout(irADestino, Math.max(0, MINIMO_MS - (Date.now() - inicio)));
      } catch (e) {
        console.error('[Ir a Xiris]', e.message);
        if (cargada) {
          enviar({ type: 'xiris-conexion:error', msg: `${e.message} Puedes entrar con tu correo y contraseña.`, boton: 'Ir al inicio de sesión' });
        } else {
          // La pantalla no alcanzó a cargar: se va directo al login
          ir(XIRIS_LOGIN);
        }
      }
    })();
  }

  function init() {
    const btn = document.getElementById('menu-xiris');
    if (btn && !btn.dataset.xirisListo) {
      btn.dataset.xirisListo = '1';
      btn.removeAttribute('target'); // ahora se navega en la misma pestaña
      btn.addEventListener('click', irAXiris);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();