/* ============================================================================
 * Ruta en el repo: js/sentry_init.js
 * Monitoreo de errores con Sentry, sin riesgo para producción:
 *   - Sin DSN no hace nada.
 *   - MODO decide dónde se activa:
 *       'off'     → apagado en todas partes
 *       'pruebas' → solo en localhost, *.vercel.app (previews) o con ?sentry=1
 *       'todo'    → también en el dominio de producción
 *   - El SDK se carga en segundo plano (async); si el CDN falla o está
 *     bloqueado, la página sigue igual.
 *   - No envía datos personales: quita contraseñas, SSN, teléfonos, correos y
 *     el texto de los formularios. Solo identifica al usuario por su id.
 * Lo carga main.js (fragmento_js_main_sentry.js). Para apagarlo de golpe:
 * MODO = 'off'.
 * ==========================================================================*/
(function () {
  'use strict';

  const DSN  = 'https://30f1f57ec332d7b26d5aab85c0264e9d@o4512345671335936.ingest.us.sentry.io/4512345693093888';          // ← pegar aquí el DSN del proyecto de Sentry
  const MODO = 'todo';   // 'off' | 'pruebas' | 'todo'
  const SDK  = 'https://browser.sentry-cdn.com/8.55.0/bundle.tracing.min.js';
  const VERSION = 'asesorias@2026-10-29';

  try {
    if (!DSN || MODO === 'off' || window.__sentryIniciado) return;
    const host = location.hostname;
    const esPrueba = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app') ||
                     new URLSearchParams(location.search).get('sentry') === '1';
    if (MODO === 'pruebas' && !esPrueba) return;
    window.__sentryIniciado = true;

    const SENSIBLE = /(contrasen|password|passwd|clave|ssn|social|token|apikey|api_key|authorization|telefono|phone|email|correo|tarjeta|card|cuenta|routing)/i;
    const limpiar = (obj, nivel = 0) => {
      if (!obj || typeof obj !== 'object' || nivel > 5) return obj;
      for (const k of Object.keys(obj)) {
        if (SENSIBLE.test(k)) obj[k] = '[oculto]';
        else if (typeof obj[k] === 'string') obj[k] = obj[k]
          .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]')
          .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[ssn]')
          .replace(/\+?\d[\d\s().-]{8,}\d/g, '[numero]');
        else limpiar(obj[k], nivel + 1);
      }
      return obj;
    };

    const s = document.createElement('script');
    s.src = SDK;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = function () {
      try {
        if (!window.Sentry) return;
        Sentry.init({
          dsn: DSN,
          release: VERSION,
          environment: esPrueba ? 'pruebas' : 'produccion',
          sendDefaultPii: false,
          integrations: [Sentry.browserTracingIntegration()],
          tracesSampleRate: esPrueba ? 1.0 : 0.1,
          tracePropagationTargets: [],          // no añade cabeceras a Supabase
          ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured', 'AbortError', 'Load failed', 'Failed to fetch'],
          denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
          beforeBreadcrumb(b) {
            if (b.category === 'ui.input') return null;           // nada de lo que se escribe
            if (b.data && b.data.url) b.data.url = String(b.data.url).split('?')[0];
            return b;
          },
          beforeSend(ev) {
            try {
              if (ev.request) { delete ev.request.cookies; if (ev.request.url) ev.request.url = ev.request.url.split('#')[0]; }
              limpiar(ev.extra); limpiar(ev.contexts);
              (ev.exception?.values || []).forEach((v) => { if (v.value) v.value = limpiar({ v: v.value }).v; });
            } catch (e) {}
            return ev;
          },
        });
        Sentry.setTag('pagina', location.pathname.split('/').pop() || 'index');
        // usuario: solo el id
        const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        sb?.auth?.getSession?.().then(({ data }) => {
          const id = data?.session?.user?.id;
          if (id) Sentry.setUser({ id });
        }).catch(() => {});
      } catch (e) { /* Sentry nunca debe romper la página */ }
    };
    s.onerror = function () { /* CDN bloqueado: se ignora */ };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { /* nada */ }
})();