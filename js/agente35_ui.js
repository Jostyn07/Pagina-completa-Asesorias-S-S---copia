/* ============================================================================
 * Ruta en el repo: js/agente35_ui.js
 * Ajustes de Agente 3.5 en páginas existentes, sin modificar sus archivos:
 *   - polizas.html:         insignias de los 7 estados (incluye New application
 *                           y Policy change) y los valores viejos.
 *   - cliente_editar.html:  lista oficial de estados, carga correcta de la nota,
 *                           quién/cuándo, bloqueo sin permiso editar_agente35,
 *                           y ?abrir=agente35 abre la sub-pestaña.
 *   - movimientos.html:     el filtro "Renovación" usa el valor guardado (con tilde).
 * Se carga DESPUÉS del js principal de cada página. Si algo falla, la página
 * sigue funcionando como antes.
 * ==========================================================================*/
(function () {
  'use strict';

  const ESTADOS = ['Pendiente', 'New application', 'Policy change', 'Procesado',
                   'Cambio necesario', 'Termination request', 'Cancelado'];
  const VIEJOS = { pendiente: 'Pendiente', draft: 'Pendiente', processed: 'Procesado', procesado: 'Procesado',
                   canceled: 'Cancelado', cancelado: 'Cancelado' };

  function normalizar(v) {
    const s = String(v ?? '').trim();
    if (!s || s === '-') return '';
    return VIEJOS[s.toLowerCase()] || s;
  }

  // --------------------------------------------------------------- insignias
  const CLASES = {
    'Pendiente': ['pendiente', 'Pendiente'],
    'New application': ['new', 'New application'],
    'Policy change': ['policy', 'Policy change'],
    'Procesado': ['procesado', 'Procesado'],
    'Cambio necesario': ['cambio', 'Cambio necesario'],
    'Termination request': ['termination', 'Termination request'],
    'Cancelado': ['cancelado', 'Cancelado'],
  };
  window.obtenerBadgeAgente35 = function (estado) {
    const e = normalizar(estado);
    if (!e) return '<span class="badge-agente35 pendiente">Pendiente</span>';
    const c = CLASES[e];
    if (!c) return `<span class="badge-agente35 sin-estado">${String(e).replace(/</g, '&lt;')}</span>`;
    return `<span class="badge-agente35 ${c[0]}">${c[1]}</span>`;
  };

  // --------------------------------------------------------------- permisos
  function puede(k) {
    try { return typeof tienePermiso === 'function' && tienePermiso(k); } catch (e) { return false; }
  }

  // --------------------------------------------------------------- cliente_editar
  function prepararSelect() {
    const sel = document.getElementById('agente35_estado');
    if (!sel || sel.dataset.a35) return;
    sel.dataset.a35 = '1';
    sel.innerHTML = '<option value="">Seleccionar estado</option>' +
      ESTADOS.map((e) => `<option value="${e}">${e}</option>`).join('');
  }

  function aplicarPoliza(poliza) {
    if (!poliza) return;
    prepararSelect();
    const sel = document.getElementById('agente35_estado');
    const notas = document.getElementById('agente35_notas');
    const fecha = document.getElementById('agente35_fecha');
    const por = document.getElementById('agente35_actualizado_por');

    if (sel) {
      const e = normalizar(poliza.agente35_estado);
      if (e && !ESTADOS.includes(e)) sel.insertAdjacentHTML('beforeend', `<option value="${e}">${e}</option>`);
      sel.value = e;
    }
    if (notas) notas.value = (poliza.agente35_notas && poliza.agente35_notas !== '-') ? poliza.agente35_notas : '';
    if (fecha) fecha.value = poliza.agente35_fecha_actualizacion && typeof formatearFechaHora === 'function'
      ? formatearFechaHora(poliza.agente35_fecha_actualizacion) : '';
    if (por) por.value = poliza.agente35_actualizado_por || '';

    // el original compara contra el valor crudo; se iguala al normalizado para no
    // registrar en el historial un "cambio" que el usuario no hizo
    try {
      if (typeof datosOriginalesPoliza !== 'undefined' && datosOriginalesPoliza) {
        datosOriginalesPoliza.agente35_estado = sel ? sel.value : datosOriginalesPoliza.agente35_estado;
      }
    } catch (e) {}

    if (!puede('editar_agente35')) {
      [sel, notas].forEach((el) => { if (el) { el.disabled = true; el.classList.add('campo-bloqueado'); } });
    }
  }

  if (typeof window.rellenarFormulario === 'function') {
    prepararSelect();
    const original = window.rellenarFormulario;
    window.rellenarFormulario = async function (cliente, poliza) {
      const r = await original.apply(this, arguments);
      try { aplicarPoliza(poliza); } catch (e) { console.warn('[agente35_ui]', e); }
      return r;
    };

    // capturarDatosOriginales corre después de rellenarFormulario: se vuelve a igualar
    if (typeof window.capturarDatosOriginales === 'function') {
      const capOriginal = window.capturarDatosOriginales;
      window.capturarDatosOriginales = function () {
        const r = capOriginal.apply(this, arguments);
        try {
          const sel = document.getElementById('agente35_estado');
          if (sel && typeof datosOriginalesPoliza !== 'undefined' && datosOriginalesPoliza) {
            // sin permiso el select va deshabilitado y no viaja en el formulario:
            // se compara contra vacío para no registrar un borrado que no ocurre
            if (sel.disabled) datosOriginalesPoliza.agente35_estado = '';
            else if (normalizar(datosOriginalesPoliza.agente35_estado) === sel.value) datosOriginalesPoliza.agente35_estado = sel.value;
          }
        } catch (e) {}
        return r;
      };
    }

    // ?abrir=agente35 → pestaña Estado y Seguimiento, sub-pestaña Agente 3.5
    document.addEventListener('DOMContentLoaded', () => {
      if (new URLSearchParams(location.search).get('abrir') !== 'agente35') return;
      setTimeout(() => {
        try { cambiarTab('estado'); cambiarSubPestana('agente35'); } catch (e) {}
      }, 600);
    });
  }

  // --------------------------------------------------------------- movimientos
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#panelFiltroTipo input[value="Renovacion"]').forEach((i) => { i.value = 'Renovación'; });
  });
})();