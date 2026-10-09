(function () {
  if (window.__auditoriaCargada) return;
  window.__auditoriaCargada = true;

  const ruta = location.pathname.split('/').pop() || 'index.html';
  const recientes = new Map(); // evita duplicados en ráfaga (mismo evento en < 3 s)

  function cliente() {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient; } catch (e) {}
    return null;
  }

  async function auditar(accion, datos = {}) {
    try {
      const sb = cliente();
      if (!sb) return;

      const clave = [accion, datos.recurso_id, datos.cliente_id, datos.poliza_id].join('|');
      const ahora = Date.now();
      if (recientes.has(clave) && ahora - recientes.get(clave) < 3000) return;
      recientes.set(clave, ahora);

      const { data: { session } } = await sb.auth.getSession();
      if (!session) return; // sin sesión no se registra (la RPC lo exige)

      const { error } = await sb.rpc('registrar_evento', {
        p_accion: accion,
        p_recurso: datos.recurso ?? null,
        p_recurso_id: datos.recurso_id != null ? String(datos.recurso_id) : null,
        p_cliente_id: datos.cliente_id != null ? String(datos.cliente_id) : null,
        p_poliza_id: datos.poliza_id != null ? String(datos.poliza_id) : null,
        p_ruta: datos.ruta ?? ruta,
        p_detalle: datos.detalle ?? {},
        p_metodo: datos.metodo ?? 'ui',
      });
      if (error) console.warn('[auditoría]', accion, error.message);
    } catch (e) {
      console.warn('[auditoría]', accion, e?.message || e);
    }
  }

  window.auditar = auditar;

  // ---------- Inicio de sesión (una vez por sesión del navegador)
  function escucharInicioSesion() {
    const sb = cliente();
    if (!sb) return;
    sb.auth.onAuthStateChange((evento, session) => {
      if (evento !== 'SIGNED_IN' || !session) return;
      try {
        const marca = 'aud_sesion_' + session.user.id;
        if (sessionStorage.getItem(marca)) return;
        sessionStorage.setItem(marca, '1');
      } catch (e) {}
      auditar('sesion.inicio', { recurso: 'sesion', metodo: 'navegacion' });
    });
  }

  // ---------- Ficha del cliente: cliente.view y poliza.view
  function auditarFichaCliente() {
    if (ruta !== 'cliente_editar.html') return;
    const params = new URLSearchParams(location.search);
    const clienteId = params.get('id');
    if (!clienteId) return;

    const modo = params.get('modo') === 'ver' ? 'ver' : 'editar';
    auditar('cliente.view', {
      recurso: 'clientes', recurso_id: clienteId, cliente_id: clienteId,
      metodo: 'navegacion', detalle: { modo },
    });

    // cliente_editar.js guarda la póliza cargada en la variable global polizaId
    let intentos = 0;
    const espera = setInterval(() => {
      intentos++;
      let pid = null;
      try { pid = typeof polizaId !== 'undefined' ? polizaId : null; } catch (e) {}
      if (pid) {
        clearInterval(espera);
        auditar('poliza.view', {
          recurso: 'polizas', recurso_id: pid, cliente_id: clienteId, poliza_id: pid,
          metodo: 'navegacion', detalle: { modo },
        });
      } else if (intentos > 40) {
        clearInterval(espera); // ~20 s: el cliente no tiene póliza cargada
      }
    }, 500);
  }

  // ---------- Filtros avanzados de Pólizas: qué filtros se usaron (sin valores sensibles)
  function auditarFiltrosPolizas() {
    if (ruta !== 'polizas.html' || typeof window.aplicarFiltrosAvanzados !== 'function') return;
    const original = window.aplicarFiltrosAvanzados;
    window.aplicarFiltrosAvanzados = function (...args) {
      try {
        const usados = [];
        document.querySelectorAll('#modalFiltros input, #modalFiltros select').forEach((el) => {
          if (!el.id) return;
          const activo = el.type === 'checkbox' ? el.checked : (el.value || '').trim() !== '';
          if (activo) usados.push(el.id);
        });
        auditar('filtros.aplicar', { recurso: 'polizas', detalle: { filtros: usados.slice(0, 40) } });
      } catch (e) {}
      return original.apply(this, args);
    };
  }

  function iniciar() {
    escucharInicioSesion();
    if (ruta !== 'login.html' && ruta !== 'index.html') {
      auditar('pagina.view', { recurso: 'pagina', metodo: 'navegacion', detalle: { query: location.search ? 'si' : 'no' } });
    }
    auditarFichaCliente();
    auditarFiltrosPolizas();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();