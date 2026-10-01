(function () {
  const XIRIS_LOGIN = 'https://www.xiris.online/login';
  const XIRIS_REDIRECT = '/dashboard';

  function getClient() {
    if (window.supabaseClient?.functions) return window.supabaseClient;
    if (typeof supabase !== 'undefined' && supabase?.functions) return supabase;
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
        if (!error && data?.url) destino = data.url;
      }
    } catch (e) {
      // se queda en el login
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