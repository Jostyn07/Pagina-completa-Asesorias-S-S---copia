/* Helper para leer archivos del bucket "documentos" mediante URLs firmadas.
   Sirve igual si el bucket es público (fallback a la URL original) o privado.
   Requiere supabase_config.js cargado antes (usa supabaseClient). */
(function () {
  const BUCKET = 'documentos';
  const MARCA_PUBLICA = '/storage/v1/object/public/documentos/';
  const MARCA_FIRMADA = '/storage/v1/object/sign/documentos/';
  const MARGEN_RENOVAR_MS = 5 * 60 * 1000; // renovar si faltan menos de 5 min
  const LOTE = 200;

  const cache = new Map();      // ruta -> { url, exp (ms) }
  const enCurso = new Map();    // ruta -> Promise<string|null> (dedup de peticiones)

  function cliente() {
    try { return (typeof supabaseClient !== 'undefined') ? supabaseClient : null; } catch (e) { return null; }
  }

  function log(...a) { if (window.dbg) window.dbg.warn(...a); }

  // Normaliza una ruta de Storage: decodifica %XX (rutas guardadas URL-codificadas) y quita '/' inicial.
  // Es idempotente salvo que el nombre real contenga un '%XX' literal (improbable).
  function normalizarRuta(r) {
    if (!r || typeof r !== 'string') return r || null;
    let s = r.trim();
    if (/%[0-9A-Fa-f]{2}/.test(s)) {
      try { s = decodeURIComponent(s); } catch (e) { /* se deja igual */ }
    }
    s = s.replace(/^\/+/, '');
    return s || null;
  }

  // Extrae la ruta dentro del bucket desde una URL pública/firmada (o devuelve la ruta si ya lo es)
  function rutaDesdeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    let s = url.trim();
    if (!s) return null;
    let idx = s.indexOf(MARCA_PUBLICA);
    let largo = MARCA_PUBLICA.length;
    if (idx === -1) { idx = s.indexOf(MARCA_FIRMADA); largo = MARCA_FIRMADA.length; }
    if (idx === -1) {
      if (/^(https?:|data:|blob:)/i.test(s)) return null; // URL ajena al bucket
      s = s.split('?')[0].split('#')[0];                  // ruta directa
      return normalizarRuta(s);
    }
    s = s.slice(idx + largo).split('?')[0].split('#')[0];
    return normalizarRuta(s);
  }

  function urlPublica(ruta) {
    const c = cliente();
    if (!c) return ruta;
    try { return c.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl; } catch (e) { return ruta; }
  }

  function vigente(ruta) {
    const e = cache.get(ruta);
    return e && (e.exp - Date.now()) > MARGEN_RENOVAR_MS ? e.url : null;
  }

  // Firma rutas en lote. Devuelve { ruta: url }. Si falla una ruta, su valor es la URL pública original.
  async function firmar(rutas, segundos = 3600) {
    const resultado = {};
    const unicas = Array.from(new Set((rutas || []).map(r => rutaDesdeUrl(r)).filter(Boolean)));
    const pendientes = [];
    const esperas = [];

    unicas.forEach(r => {
      const ok = vigente(r);
      if (ok) { resultado[r] = ok; return; }
      if (enCurso.has(r)) { esperas.push(enCurso.get(r).then(u => { resultado[r] = u || urlPublica(r); })); return; }
      pendientes.push(r);
    });

    const c = cliente();
    for (let i = 0; i < pendientes.length; i += LOTE) {
      const grupo = pendientes.slice(i, i + LOTE);
      const promesa = (async () => {
        try {
          if (!c) throw new Error('Cliente Supabase no disponible');
          const { data, error } = await c.storage.from(BUCKET).createSignedUrls(grupo, segundos);
          if (error) throw error;
          const mapa = {};
          (data || []).forEach(d => {
            if (d && d.signedUrl && !d.error) mapa[d.path] = d.signedUrl;
            else if (d) log('No se pudo firmar la ruta:', d.path, d.error); // fallback: URL pública original
          });
          return mapa;
        } catch (e) {
          log('No se pudieron firmar URLs:', e && e.message);
          return {};
        }
      })();
      grupo.forEach(r => {
        const p = promesa.then(mapa => {
          const u = mapa[r] || null;
          if (u) cache.set(r, { url: u, exp: Date.now() + segundos * 1000 });
          return u;
        }).finally(() => enCurso.delete(r));
        enCurso.set(r, p);
        esperas.push(p.then(u => { resultado[r] = u || urlPublica(r); }));
      });
    }

    await Promise.all(esperas);
    return resultado;
  }

  // URL firmada para una URL (pública) o ruta. Si falla, devuelve la original.
  async function urlFirmada(urlOruta) {
    const ruta = rutaDesdeUrl(urlOruta);
    if (!ruta) return urlOruta;
    const mapa = await firmar([ruta]);
    return mapa[ruta] || (/^https?:/i.test(urlOruta) ? urlOruta : urlPublica(ruta));
  }

  // Reemplaza img/a del contenedor que apuntan al bucket por URLs firmadas
  async function resolverEn(contenedor) {
    if (!contenedor || !contenedor.querySelectorAll) return;
    const sel = `img[src*="${MARCA_PUBLICA}"], img[data-src*="${MARCA_PUBLICA}"], a[href*="${MARCA_PUBLICA}"]`;
    const nodos = Array.from(contenedor.querySelectorAll(sel)).filter(n => !n.dataset.sfOk);
    if (!nodos.length) return;

    const items = nodos.map(n => {
      let attr = 'href';
      if (n.tagName === 'IMG') attr = (n.getAttribute('src') || '').includes(MARCA_PUBLICA) ? 'src' : 'data-src';
      const original = n.getAttribute(attr);
      if (n.tagName === 'IMG' && attr === 'src') {
        // Evita la petición con la URL sin firmar: se guarda y se oculta hasta tener la firmada
        n.dataset.sfOriginal = original;
        n.removeAttribute('src');
        n.style.visibility = 'hidden';
      }
      return { n, attr, original };
    });

    const mapa = await firmar(items.map(i => i.original));
    items.forEach(({ n, attr, original }) => {
      const ruta = rutaDesdeUrl(original);
      const url = (ruta && mapa[ruta]) || original;
      n.dataset.sfOk = '1';
      if (n.tagName === 'IMG' && attr === 'src') {
        n.addEventListener('load', () => { n.style.visibility = ''; }, { once: true });
        n.addEventListener('error', () => { n.style.visibility = ''; }, { once: true });
        n.setAttribute('src', url);
      } else {
        n.setAttribute(attr, url);
      }
    });
  }

  // Reescribe en un HTML las URLs firmadas del bucket (.../object/sign/documentos/<ruta>?token=...)
  // a la forma canónica pública sin token (.../object/public/documentos/<ruta>), para que lo guardado no caduque.
  function canonizarHtml(html) {
    if (!html || typeof html !== 'string') return html;
    return html.replace(/(\/storage\/v1\/object\/)sign(\/documentos\/[^"'\s?#<>]*)(?:\?[^"'\s<>]*)?/g, '$1public$2');
  }

  // Abre el archivo en una pestaña nueva (se abre antes para no perder el gesto del usuario)
  async function abrir(url) {
    const w = window.open('', '_blank');
    const firmada = await urlFirmada(url);
    if (w) { try { w.opener = null; } catch (e) {} w.location.href = firmada; }
    else window.open(firmada, '_blank');
  }

  async function descargar(url, nombre) {
    try {
      const firmada = await urlFirmada(url);
      const resp = await fetch(firmada);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = nombre || 'archivo';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (e) {
      console.error('Error al descargar:', e && e.message);
      alert('No se pudo descargar el archivo');
    }
  }

  window.storageFirmado = { normalizarRuta, rutaDesdeUrl, firmar, urlFirmada, resolverEn, canonizarHtml, abrir, descargar };
})();
