// Ruta en el repo: js/xiris.js
// Maneja el clic del botón "Xiris" (id="menu-xiris") que pegas en el sidebar de cada HTML.
// - Con credenciales en usuarios_xiris → Edge Function "ir-a-xiris" devuelve la URL con sesión iniciada.
// - Sin credenciales o error → abre el login de Xiris para ingreso manual.
// Cargar DESPUÉS del script que crea el cliente de Supabase.

(function () {
  const XIRIS_LOGIN = 'https://www.xiris.online/login';
  const XIRIS_REDIRECT = '/dashboard';

  function getClient() {
    // `const` globales no quedan en window, por eso se revisan con typeof
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.functions) return supabaseClient; } catch (e) {}
    try { if (typeof supabase !== 'undefined' && supabase?.functions) return supabase; } catch (e) {}
    if (window.supabaseClient?.functions) return window.supabaseClient;
    console.warn('[Xiris] No se encontró el cliente de Supabase con .functions');
    return null;
  }

  async function irAXiris(ev) {
    ev.preventDefault();
    const link = ev.currentTarget;
    // Abrir la pestaña ya, para que el navegador no la bloquee como popup
    const tab = window.open('about:blank', '_blank');
    link.style.pointerEvents = 'none';
    link.style.opacity = '0.6';
    let destino = XIRIS_LOGIN;
    try {
      const client = getClient();
      if (client) {
        const { data, error } = await client.functions.invoke('ir-a-xiris', {
          body: { redirect: XIRIS_REDIRECT },
        });
        console.log('[Xiris] respuesta ir-a-xiris:', { data, error });
        if (!error && data?.url) destino = data.url;
      }
    } catch (e) {
      console.error('[Xiris] error:', e);
    } finally {
      if (tab) tab.location.href = destino;
      else window.location.href = destino;
      link.style.pointerEvents = '';
      link.style.opacity = '';
    }
  }

  function init() {
    const btn = document.getElementById('menu-xiris');
    if (btn && !btn.dataset.xirisListo) {
      btn.dataset.xirisListo = '1';
      btn.addEventListener('click', irAXiris);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();