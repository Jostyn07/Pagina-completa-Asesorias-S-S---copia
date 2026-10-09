// ============================================================================
// Ruta en el repo: js/auditoria.js
// FASE 1 — Auditoría desde el navegador
//
// Se carga solo desde js/supabase_config.js (no hay que tocar cada HTML).
// Registra lo que los triggers de la base de datos no pueden ver:
//   - sesion.inicio      al iniciar sesión
//   - pagina.view        al entrar a cualquier página
//   - cliente.view       al abrir la ficha de un cliente (con su id)
//   - poliza.view        al abrir la póliza dentro de la ficha (con cliente y póliza)
//   - filtros.aplicar    al aplicar filtros avanzados en Pólizas (qué filtros, no datos sensibles)
// Además agrega el enlace "Auditoría" al menú para quien tenga ver_logs_auditoria.
//
// Los cambios de datos (crear, editar, eliminar, archivar, cambiar estado…)
// los registran los triggers de la fase 1 en el servidor.
//
// Uso manual desde cualquier página:
//   auditar('modulo.accion', { recurso, recurso_id, cliente_id, poliza_id, detalle })
// Nunca lanza errores ni bloquea la página.
// ============================================================================

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

  // ---------- Enlace "Auditoría" en el menú lateral (solo con ver_logs_auditoria)
  async function menuAuditoria() {
    try {
      const nav = document.querySelector('.sidebar-nav');
      const sb = cliente();
      if (!nav || !sb || nav.querySelector('#menuAuditoria')) return;
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const { data: puede } = await sb.rpc('tiene_permiso', { p_clave: 'ver_logs_auditoria' });
      if (!puede || nav.querySelector('#menuAuditoria')) return;
      const a = document.createElement('a');
      a.href = './auditoria.html';
      a.id = 'menuAuditoria';
      a.className = 'menu-item' + (ruta === 'auditoria.html' ? ' active' : '');
      a.innerHTML = '<span class="material-symbols-rounded">policy</span><span>Auditoría</span>';
      const usuarios = nav.querySelector('a[href="./usuarios.html"]');
      if (usuarios) nav.insertBefore(a, usuarios); else nav.appendChild(a);
    } catch (e) {}
  }

  function iniciar() {
    menuAuditoria();
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