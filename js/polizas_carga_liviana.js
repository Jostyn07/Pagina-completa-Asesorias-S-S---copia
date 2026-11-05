(function () {
  'use strict';
  if (!/polizas\.html/.test(location.pathname)) return;
  const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  if (!sb || sb.__cargaLiviana) return;
  sb.__cargaLiviana = true;

  const SEG = 'seguimientos ( fecha_seguimiento, seguimiento_efectivo )';
  const MP = 'metodos_pago ( tiene_metodo_pago, tiene_pago_automatico, activo )';

  function aligerar(cols) {
    if (typeof cols !== 'string' || !/cliente:clientes/.test(cols) || !/seguimientos\s*\(/.test(cols)) return cols;
    return cols
      .replace(/seguimientos\s*\([^)]*\)/, SEG)
      .replace(/metodos_pago\s*\([^)]*\)/, MP);
  }

  const fromOriginal = sb.from.bind(sb);
  sb.from = function (tabla) {
    const q = fromOriginal(tabla);
    if (tabla === 'polizas' && q && typeof q.select === 'function') {
      const sel = q.select.bind(q);
      q.select = function (cols, opts) { return sel(aligerar(cols), opts); };
    }
    return q;
  };

  // Al abrir el detalle de una póliza: traer sus seguimientos completos
  function envolverDetalle() {
    if (typeof window.abrirDetalles !== 'function' || window.abrirDetalles.__liviano) return;
    const original = window.abrirDetalles;
    const nuevo = async function (polizaId) {
      try {
        const p = (Array.isArray(todasLasPolizas) ? todasLasPolizas : []).find((x) => x.id === polizaId);
        if (p && !p.__segCompletos) {
          const { data, error } = await fromOriginal('seguimientos')
            .select('fecha_seguimiento, seguimiento_efectivo, medio_comunicacion, observacion')
            .eq('poliza_id', polizaId);
          if (!error && data) { p.seguimientos = data; p.__segCompletos = true; }
        }
      } catch (e) {}
      return original.apply(this, arguments);
    };
    nuevo.__liviano = true;
    window.abrirDetalles = nuevo;
  }
  envolverDetalle();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', envolverDetalle);
})();