(function () {
  'use strict';
  const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  if (!sb || sb.__polCargaCompleta) return;
  sb.__polCargaCompleta = true;

  const TAM = 1000;
  const PARALELO = 4;
  const fromPrevio = sb.from.bind(sb);   // respeta lo que ya envolvió polizas_carga_liviana.js

  const esCargaPrincipal = (cols, opts) =>
    typeof cols === 'string' && /cliente\s*:\s*clientes/.test(cols) && /seguimientos\s*\(/.test(cols) &&
    !(opts && (opts.head || opts.count));

  function consultaPorPartes(tabla, cols, opts) {
    const pasos = [];   // .order(), .ilike(), etc. que encadena polizas.js
    const armar = (conteo) => {
      let q = fromPrevio(tabla).select(cols, Object.assign({}, opts || {}, conteo ? { count: 'exact' } : {}));
      pasos.forEach(([m, a]) => { q = q[m](...a); });
      return q.order('id', { ascending: true });   // orden estable entre partes
    };
    const ejecutar = async () => {
      try {
        const primera = await armar(true).range(0, TAM - 1);
        if (primera.error) throw primera.error;
        const total = primera.count ?? (primera.data || []).length;
        const filas = [...(primera.data || [])];
        const desdes = [];
        for (let d = TAM; d < total; d += TAM) desdes.push(d);
        for (let i = 0; i < desdes.length; i += PARALELO) {
          const lote = await Promise.all(desdes.slice(i, i + PARALELO).map((d) => armar(false).range(d, d + TAM - 1)));
          for (const r of lote) { if (r.error) throw r.error; filas.push(...(r.data || [])); }
        }
        return { data: filas, error: null, count: total, status: 200, statusText: 'OK' };
      } catch (e) {
        console.warn('[pólizas] carga por partes falló, se usa la consulta normal:', e);
        let q = fromPrevio(tabla).select(cols, opts);
        pasos.forEach(([m, a]) => { q = q[m](...a); });
        return await q;
      }
    };
    const proxy = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') return (ok, mal) => ejecutar().then(ok, mal);
        if (prop === 'catch') return (mal) => ejecutar().catch(mal);
        if (prop === 'finally') return (f) => ejecutar().finally(f);
        return (...args) => { pasos.push([prop, args]); return proxy; };
      },
    });
    return proxy;
  }

  sb.from = function (tabla) {
    const b = fromPrevio(tabla);
    if (tabla !== 'polizas') return b;
    const selectOriginal = b.select.bind(b);
    b.select = function (cols, opts) {
      return esCargaPrincipal(cols, opts) ? consultaPorPartes(tabla, cols, opts) : selectOriginal(cols, opts);
    };
    return b;
  };
})();