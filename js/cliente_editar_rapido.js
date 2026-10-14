/* ============================================================================
 * Ruta en el repo: js/cliente_editar_rapido.js
 * Carga rápida de cliente_editar: hace las consultas EN PARALELO.
 *
 * Antes: ~15 consultas una detrás de otra (rol → cliente → métodos de pago →
 * meses pagados → pólizas → póliza otra vez → seguimientos → historial →
 * dependientes → notas (que ni se usaban) → documentos → notas otra vez →
 * cambios pendientes). Cada una espera a la anterior.
 * Ahora: todas salen al mismo tiempo; la pantalla espera solo a la más lenta.
 *
 * No cambia qué se muestra ni cómo se guarda: reutiliza las funciones de
 * cliente_editar.js. Si algo falla, usa la carga original (no frena producción).
 * Se carga DESPUÉS de cliente_editar.js y de documentos_familia.js.
 * ==========================================================================*/
(function () {
  'use strict';
  if (typeof window.cargarDatosCliente !== 'function') return;

  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
  const original = {
    cargarDatosCliente: window.cargarDatosCliente,
    cargarDocumentos: window.cargarDocumentos,
    cargarNotas: window.cargarNotas,
    verificarCambiosPendientes: window.verificarCambiosPendientes,
  };

  // Tareas que el DOMContentLoaded de cliente_editar.js pedirá DESPUÉS de cargarDatosCliente.
  // Se arrancan antes y, cuando las pidan, se devuelve la misma promesa (no se repite la consulta).
  const adelantadas = {};
  function adelantar(nombre, id) {
    if (typeof original[nombre] !== 'function') return;
    adelantadas[nombre] = { id, promesa: Promise.resolve().then(() => original[nombre](id)).catch((e) => console.error(nombre, e)) };
  }
  ['cargarDocumentos', 'cargarNotas', 'verificarCambiosPendientes'].forEach((nombre) => {
    if (typeof original[nombre] !== 'function') return;
    window[nombre] = function (id, ...resto) {
      const a = adelantadas[nombre];
      if (a && a.id === id) { delete adelantadas[nombre]; return a.promesa; }   // primera vez: ya está en curso
      return original[nombre].call(this, id, ...resto);                          // recargas posteriores: normal
    };
  });

  window.cargarDatosCliente = async function (id) {
    const t0 = performance.now();
    const btnSubmit = document.querySelector('.btn-submit');
    const textoOriginal = btnSubmit?.innerHTML;
    try {
      if (btnSubmit) {
        btnSubmit.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Cargando...';
        btnSubmit.disabled = true;
      }

      // 1. Todo lo independiente sale a la vez
      adelantar('cargarNotas', id);
      adelantar('verificarCambiosPendientes', id);

      const anio = new Date().getFullYear();
      const [, cliRes, polRes, depRes] = await Promise.all([
        typeof cargarRolUsuario === 'function' ? cargarRolUsuario() : null,
        sb().from('clientes').select('*').eq('id', id).single(),
        sb().from('polizas').select('*').eq('cliente_id', id),
        sb().from('dependientes').select('*').eq('cliente_id', id).order('created_at', { ascending: true }),
        typeof cargarMetodoPago === 'function' ? cargarMetodoPago(id) : null,
        (async () => {
          if (typeof inicializarSelectorAnioMesesPagados === 'function') inicializarSelectorAnioMesesPagados();
          if (typeof cargarMesesPagados === 'function') await cargarMesesPagados(id, anio);
        })(),
      ]);

      if (cliRes.error) throw cliRes.error;
      const clienteData = cliRes.data;
      if (!clienteData) throw new Error('Cliente no encontrado');
      if (polRes.error) console.warn('⚠️ Error al cargar pólizas:', polRes.error);
      if (depRes.error) console.warn('⚠️ Error al cargar dependientes:', depRes.error);

      const polizaData = polRes.data && polRes.data.length ? polRes.data[0] : null;
      if (polizaData) polizaId = polizaData.id;   // variable global de cliente_editar.js
      adelantar('cargarDocumentos', id);           // necesita polizaId (documentos solicitados y plazo)

      // 2. Formulario y estado/seguimiento al mismo tiempo (tocan campos distintos)
      await Promise.all([
        rellenarFormulario(clienteData, polizaData, depRes.data || [], []),
        polizaData && typeof cargarEstadoSeguimiento === 'function' ? cargarEstadoSeguimiento(polizaData.id) : null,
      ]);

      if (typeof CAMPOS_REQUERIDOS !== 'undefined' && typeof limpiarEstadoCampo === 'function') {
        CAMPOS_REQUERIDOS.forEach((c) => { const el = document.getElementById(c.id); if (el) limpiarEstadoCampo(el); });
      }
      const titulo = document.getElementById('pageTitle');
      if (titulo) titulo.textContent = `✏️ Editando: ${clienteData.nombres} ${clienteData.apellidos}`;

      if (btnSubmit) { btnSubmit.innerHTML = textoOriginal; btnSubmit.disabled = false; }

      if (typeof aplicarPermisosEstadoMercado === 'function') await aplicarPermisosEstadoMercado();
      if (typeof capturarDatosOriginales === 'function') capturarDatosOriginales(clienteData, polizaData);
      if (document.querySelector('#tab-historial.active') && typeof cargarHistorial === 'function') await cargarHistorial(id);
      if (typeof sincronizarBadgesMeses === 'function') sincronizarBadgesMeses();

      console.info(`⚡ Cliente cargado en ${Math.round(performance.now() - t0)} ms (carga en paralelo)`);
    } catch (error) {
      // Plan B: la carga original, para no dejar la pantalla vacía
      console.error('Carga rápida falló, se usa la original:', error);
      Object.keys(adelantadas).forEach((k) => delete adelantadas[k]);
      if (btnSubmit) { btnSubmit.innerHTML = textoOriginal; btnSubmit.disabled = false; }
      return original.cargarDatosCliente(id);
    }
  };
})();