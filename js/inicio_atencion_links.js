(function () {
  'use strict';
  const REGLAS = [
    [/pagos pendientes/i, 'pagos'],
    [/sin seguimiento/i, 'seguimiento'],
    [/plazo mercado/i, 'plazo'],
  ];
  document.addEventListener('click', (e) => {
    const card = e.target.closest && e.target.closest('.idash-atencion a, .idash-atencion .idash-at, .idash-at');
    if (!card) return;
    const texto = card.textContent || '';
    const regla = REGLAS.find(([re]) => re.test(texto));
    if (!regla) return;
    e.preventDefault();
    e.stopPropagation();
    // Lleva a Pólizas los mismos filtros del Inicio (año, compañía, operador…)
    const f = window.__idashFiltros || {};
    const q = new URLSearchParams({ atencion: regla[1] });
    if (f.anioEf) q.set('anio', f.anioEf);
    if (f.compania) q.set('compania', f.compania);
    if (f.operador) q.set('operador', f.operador);
    if (f.registro) q.set('registro', f.registro);
    if (f.portal) q.set('portal', f.portal);
    if (f.sinCancelado) q.set('sin_cancelado', '1');
    if (f.sinCanceladoPc) q.set('sin_cancelado_pc', '1');
    location.href = `polizas.html?${q}`;
  }, true);
})();