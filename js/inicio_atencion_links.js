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
    location.href = `polizas.html?atencion=${regla[1]}`;
  }, true);
})();