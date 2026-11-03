/* ============================================================================
 * Ruta en el repo: js/tipo_registro_renovada.js
 * Tipos de registro nuevos: "Nueva renovada" y "Renovada".
 *   - Para clientes que no están en la plataforma y quedan efectivos para el
 *     próximo año.
 *   - cliente_crear: al elegir cualquiera de los dos, las fechas pasan solas a
 *       Efectividad / Inicial = 01/01 del próximo año
 *       Final                 = 12/31 del próximo año
 *     (hoy: 01/01/2027 – 12/31/2027). Al volver a Nuevo / Venta con registro,
 *     se recalculan como siempre.
 *   - cliente_editar y cliente_recuperado-cambioDeVida: solo agrega las dos
 *     opciones a la lista para que se vean en los clientes que las tengan.
 * Cómo se cuentan (Nueva renovada = nueva; Renovada = renovación) lo define
 * el SQL de conteo. Se carga DESPUÉS del js de la página.
 * ==========================================================================*/
(function () {
  'use strict';
  const NUEVOS = [['Nueva renovada', 'Nueva renovada'], ['Renovada', 'Renovada']];
  const ES_CREAR = /cliente_crear\.html/.test(location.pathname);

  function agregarOpciones() {
    const sel = document.getElementById('tipoRegistro');
    if (!sel) return null;
    NUEVOS.forEach(([valor, texto]) => {
      if (![...sel.options].some((o) => o.value === valor)) sel.add(new Option(texto, valor));
    });
    return sel;
  }

  const p2 = (n) => String(n).padStart(2, '0');
  function ponerFechas(ini, fin) {
    const us = (d) => `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${d.getFullYear()}`;
    const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const txt = (id, v) => { const el = document.getElementById(id); if (el) { el.textContent = v; if ('value' in el && el.tagName === 'INPUT') el.value = v; } };
    const val = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    txt('displayFechaEfectividad', us(ini));
    txt('displayFechaInicial', us(ini));
    txt('displayFechaFinal', us(fin));
    val('fechaEfectividad', iso(ini));
    val('fechaInicialCobertura', iso(ini));
    val('fechaFinalCobertura', iso(fin));
  }

  function alCambiar(sel) {
    const esRenovada = NUEVOS.some(([v]) => v === sel.value);
    if (esRenovada) {
      const anio = new Date().getFullYear() + 1;
      ponerFechas(new Date(anio, 0, 1), new Date(anio, 11, 31));
    } else if (typeof window.calcularYMostrarFechas === 'function') {
      window.calcularYMostrarFechas();
    }
  }

  function iniciar() {
    const sel = agregarOpciones();
    if (!sel || !ES_CREAR) return;
    sel.addEventListener('change', () => alCambiar(sel));
    // borrador cargado con uno de estos tipos: aplicar fechas también
    setTimeout(() => { if (NUEVOS.some(([v]) => v === sel.value)) alCambiar(sel); }, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 0));
  else setTimeout(iniciar, 0);
})();