// ============================================================================
// Ruta en el repo: js/carteras.js
// FASE 3 — Panel "Carteras" en Usuarios → Permisos
// Requiere sql/fase3a_carteras.sql. Se carga en pages/usuarios.html después de
// usuarios-permisos.js. Solo aparece para quien tenga el permiso gestionar_carteras
// (el servidor lo vuelve a validar en conceder_cartera / revocar_cartera).
//
// - Elegir un usuario → ver qué ve por defecto (su cartera y, si es supervisor, su equipo)
//   y sus accesos extra activos.
// - Conceder: cartera de una persona, o "todas las carteras" de su portal,
//   de un portal específico o de todos los portales.
// - Revocar con confirmación (no se borra: queda quién y cuándo).
// - Tabla con todos los accesos activos.
// ============================================================================

(function () {
  const PORTALES = ['Alfred Nieves', 'Dante SY', 'Evelyn Morillo', 'Isabel SY'];
  let usuarios = [];
  let porId = {};
  let accesos = [];

  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nombre = (id) => (id ? porId[id]?.nombre || 'Usuario eliminado' : '');
  const fecha = (f) => (f ? new Date(f).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '');

  function avisar(msg, tipo) {
    if (typeof mostrarNotificacion === 'function') return mostrarNotificacion(msg, tipo);
    if (window.Notyf) { const n = new Notyf(); return tipo === 'error' ? n.error(msg) : n.success(msg); }
    alert(msg);
  }

  function describir(a) {
    if (a.alcance === 'individual') return `Cartera de <strong>${esc(nombre(a.propietario_id))}</strong>`;
    return a.portal ? `Todas las carteras de <strong>${esc(a.portal)}</strong>` : '<strong>Todas las carteras</strong> (todos los portales)';
  }

  // ---------- Estilos
  function estilos() {
    if (document.getElementById('estilosCarteras')) return;
    const css = document.createElement('style');
    css.id = 'estilosCarteras';
    css.textContent = `
      .cart-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin-top:16px}
      @media(max-width:900px){.cart-grid{grid-template-columns:1fr}}
      .cart-card{background:var(--bg-secondary,#fff);border:1px solid var(--border-color,#e6ebf3);border-radius:12px;padding:16px}
      .cart-card h3{margin:0 0 12px;font-size:1rem;display:flex;align-items:center;gap:8px}
      .cart-card h3 .material-symbols-rounded{font-size:20px;color:var(--primary-color,#7c3af5)}
      .cart-chips{display:flex;flex-wrap:wrap;gap:6px}
      .cart-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;font-size:.8rem;background:#f1ebff;color:#5b21b6}
      .cart-chip.base{background:#f1f5f9;color:#475569}
      .cart-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color,#e6ebf3)}
      .cart-item:last-child{border-bottom:none}
      .cart-item small{display:block;color:var(--text-secondary,#8892a5);font-size:.75rem;margin-top:2px}
      .cart-btn-revocar{border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:.8rem;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
      .cart-btn-revocar:hover{background:#fef2f2}
      .cart-btn-revocar .material-symbols-rounded{font-size:16px}
      .cart-form .form-group{margin-bottom:12px}
      .cart-radios{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
      .cart-radios label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.9rem}
      .cart-vacio{color:var(--text-secondary,#8892a5);font-size:.85rem;padding:8px 0}
      .cart-tabla-wrap{overflow-x:auto;margin-top:16px}
      .cart-tabla{width:100%;border-collapse:collapse;font-size:.85rem}
      .cart-tabla th,.cart-tabla td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--border-color,#e6ebf3);vertical-align:middle}
      .cart-tabla th{font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary,#8892a5)}
      [data-theme="dark"] .cart-chip{background:#3b0764;color:#ddd6fe}
      [data-theme="dark"] .cart-chip.base{background:#1e293b;color:#cbd5e1}
      [data-theme="dark"] .cart-btn-revocar{background:transparent}
    `;
    document.head.appendChild(css);
  }

  // ---------- Estructura (subpestaña nueva)
  function montar() {
    const nav = document.querySelector('.permisos-subtabs');
    const cont = document.querySelector('#tab-permisos .usuarios-container');
    if (!nav || !cont || document.getElementById('subtab-carteras')) return false;

    const btn = document.createElement('button');
    btn.className = 'subtab-btn';
    btn.dataset.subtab = 'carteras';
    btn.innerHTML = '<span class="material-symbols-rounded">account_tree</span> Carteras';
    btn.addEventListener('click', () => {
      if (typeof cambiarSubtabPermisos === 'function') cambiarSubtabPermisos('carteras');
      cargarAccesos();
    });
    nav.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'subtab-content';
    panel.id = 'subtab-carteras';
    panel.innerHTML = `
      <div class="permisos-selectores">
        <div class="form-group">
          <label>Usuario</label>
          <input type="text" id="cartBuscar" placeholder="Buscar por nombre o email...">
          <select id="cartUsuario"><option value="">Selecciona un usuario...</option></select>
        </div>
      </div>

      <div class="cart-grid" id="cartDetalle" style="display:none">
        <div class="cart-card">
          <h3><span class="material-symbols-rounded">visibility</span>Qué ve</h3>
          <div id="cartBase"></div>
          <h3 style="margin-top:16px"><span class="material-symbols-rounded">key</span>Accesos extra activos</h3>
          <div id="cartExtra"></div>
        </div>

        <div class="cart-card cart-form">
          <h3><span class="material-symbols-rounded">add_moderator</span>Conceder acceso</h3>
          <div class="cart-radios">
            <label><input type="radio" name="cartAlcance" value="individual" checked> Cartera de una persona</label>
            <label><input type="radio" name="cartAlcance" value="todas"> Todas las carteras</label>
          </div>
          <div class="form-group" id="cartGrupoPersona">
            <label>Persona</label>
            <select id="cartPropietario"></select>
          </div>
          <div class="form-group" id="cartGrupoPortal" style="display:none">
            <label>Portal</label>
            <select id="cartPortal"></select>
          </div>
          <button class="btn-primary" id="cartConceder" type="button">
            <span class="material-symbols-rounded">check</span> Conceder
          </button>
        </div>
      </div>

      <div class="cart-card" style="margin-top:16px">
        <h3><span class="material-symbols-rounded">list_alt</span>Todos los accesos activos <span id="cartTotal" class="cart-chip base">0</span></h3>
        <div class="cart-tabla-wrap">
          <table class="cart-tabla">
            <thead><tr><th>Usuario</th><th>Puede ver</th><th>Concedido por</th><th>Fecha</th><th></th></tr></thead>
            <tbody id="cartTabla"><tr><td colspan="5" class="cart-vacio">Cargando...</td></tr></tbody>
          </table>
        </div>
      </div>`;
    cont.appendChild(panel);

    document.getElementById('cartBuscar').addEventListener('input', llenarSelectUsuarios);
    document.getElementById('cartUsuario').addEventListener('change', mostrarUsuario);
    panel.querySelectorAll('input[name="cartAlcance"]').forEach((r) => r.addEventListener('change', cambiarAlcance));
    document.getElementById('cartConceder').addEventListener('click', conceder);
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-revocar]');
      if (b) revocar(Number(b.dataset.revocar));
    });
    return true;
  }

  // ---------- Datos
  async function cargarUsuarios() {
    const { data, error } = await sb()
      .from('usuarios')
      .select('id, nombre, email, rol, portales, es_supervisor, supervisor_id, activo')
      .order('nombre');
    if (error) { console.warn('[carteras] usuarios:', error.message); return; }
    usuarios = (data || []).filter((u) => u.activo !== false);
    porId = Object.fromEntries((data || []).map((u) => [u.id, u]));
    llenarSelectUsuarios();
  }

  async function cargarAccesos() {
    const { data, error } = await sb()
      .from('permisos_cartera')
      .select('*')
      .eq('activo', true)
      .order('concedido_en', { ascending: false });
    if (error) {
      document.getElementById('cartTabla').innerHTML =
        `<tr><td colspan="5" class="cart-vacio">No se pudieron cargar los accesos: ${esc(error.message)}</td></tr>`;
      return;
    }
    accesos = data || [];
    pintarTabla();
    if (document.getElementById('cartUsuario').value) mostrarUsuario();
  }

  function llenarSelectUsuarios() {
    const sel = document.getElementById('cartUsuario');
    const q = (document.getElementById('cartBuscar').value || '').toLowerCase().trim();
    const actual = sel.value;
    const lista = usuarios.filter((u) => !q || (u.nombre || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    sel.innerHTML = '<option value="">Selecciona un usuario...</option>' +
      lista.map((u) => `<option value="${u.id}">${esc(u.nombre)} — ${esc(u.rol)}${u.es_supervisor ? ' (supervisor)' : ''}</option>`).join('');
    if (lista.some((u) => u.id === actual)) sel.value = actual;
  }

  // ---------- Detalle de un usuario
  function mostrarUsuario() {
    const id = document.getElementById('cartUsuario').value;
    const detalle = document.getElementById('cartDetalle');
    if (!id) { detalle.style.display = 'none'; return; }
    detalle.style.display = '';
    const u = porId[id];

    let base;
    if (u.rol === 'admin_general') {
      base = '<div class="cart-chips"><span class="cart-chip">Todo (admin general)</span></div>';
    } else {
      const equipo = usuarios.filter((o) => o.supervisor_id === id);
      base = '<div class="cart-chips"><span class="cart-chip base">Su propia cartera</span>' +
        (u.es_supervisor
          ? (equipo.length
              ? equipo.map((o) => `<span class="cart-chip base">Equipo: ${esc(o.nombre)}</span>`).join('')
              : '<span class="cart-chip base">Supervisor sin equipo asignado</span>')
          : '') + '</div>';
    }
    document.getElementById('cartBase').innerHTML = base;

    const propios = accesos.filter((a) => a.beneficiario_id === id);
    document.getElementById('cartExtra').innerHTML = propios.length
      ? propios.map((a) => `
          <div class="cart-item">
            <div>${describir(a)}<small>${a.concedido_por ? 'Concedido por ' + esc(nombre(a.concedido_por)) : 'Carga inicial (admin)'} · ${fecha(a.concedido_en)}</small></div>
            <button class="cart-btn-revocar" data-revocar="${a.id}" type="button"><span class="material-symbols-rounded">block</span>Revocar</button>
          </div>`).join('')
      : '<div class="cart-vacio">Sin accesos extra.</div>';

    // Opciones del formulario
    document.getElementById('cartPropietario').innerHTML = usuarios
      .filter((o) => o.id !== id)
      .map((o) => `<option value="${o.id}">${esc(o.nombre)}${o.portales?.length ? ' · ' + esc(o.portales.join(', ')) : ''}</option>`)
      .join('');

    const suyos = u.portales || [];
    const opcionesPortal = [];
    suyos.forEach((p) => opcionesPortal.push(`<option value="${esc(p)}">Su portal: ${esc(p)}</option>`));
    PORTALES.filter((p) => !suyos.includes(p)).forEach((p) => opcionesPortal.push(`<option value="${esc(p)}">${esc(p)}</option>`));
    opcionesPortal.push('<option value="__todos__">Todos los portales</option>');
    document.getElementById('cartPortal').innerHTML = opcionesPortal.join('');
  }

  function cambiarAlcance() {
    const todas = document.querySelector('input[name="cartAlcance"]:checked').value === 'todas';
    document.getElementById('cartGrupoPersona').style.display = todas ? 'none' : '';
    document.getElementById('cartGrupoPortal').style.display = todas ? '' : 'none';
  }

  // ---------- Tabla general
  function pintarTabla() {
    document.getElementById('cartTotal').textContent = accesos.length;
    const tb = document.getElementById('cartTabla');
    if (!accesos.length) { tb.innerHTML = '<tr><td colspan="5" class="cart-vacio">No hay accesos activos.</td></tr>'; return; }
    tb.innerHTML = accesos.map((a) => `
      <tr>
        <td>${esc(nombre(a.beneficiario_id))}</td>
        <td>${describir(a)}</td>
        <td>${a.concedido_por ? esc(nombre(a.concedido_por)) : '<span class="cart-chip base">Carga inicial</span>'}</td>
        <td>${fecha(a.concedido_en)}</td>
        <td><button class="cart-btn-revocar" data-revocar="${a.id}" type="button"><span class="material-symbols-rounded">block</span>Revocar</button></td>
      </tr>`).join('');
  }

  // ---------- Acciones
  async function conceder() {
    const beneficiario = document.getElementById('cartUsuario').value;
    if (!beneficiario) return;
    const alcance = document.querySelector('input[name="cartAlcance"]:checked').value;
    const params = { p_beneficiario_id: beneficiario, p_alcance: alcance, p_propietario_id: null, p_portal: null };
    let texto;
    if (alcance === 'individual') {
      params.p_propietario_id = document.getElementById('cartPropietario').value;
      if (!params.p_propietario_id) return;
      texto = `la cartera de ${nombre(params.p_propietario_id)}`;
    } else {
      const p = document.getElementById('cartPortal').value;
      params.p_portal = p === '__todos__' ? null : p;
      texto = params.p_portal ? `todas las carteras de ${params.p_portal}` : 'todas las carteras de todos los portales';
    }
    if (!confirm(`¿Dar a ${nombre(beneficiario)} acceso a ${texto}?`)) return;

    const btn = document.getElementById('cartConceder');
    btn.disabled = true;
    const { error } = await sb().rpc('conceder_cartera', params);
    btn.disabled = false;
    if (error) return avisar(error.message, 'error');
    avisar('Acceso concedido. Lo verá al recargar su página.', 'success');
    await cargarAccesos();
  }

  async function revocar(id) {
    const a = accesos.find((x) => x.id === id);
    if (!a) return;
    const desc = describir(a).replace(/<[^>]+>/g, '');
    if (!confirm(`¿Quitar a ${nombre(a.beneficiario_id)} el acceso a: ${desc}?`)) return;
    const { error } = await sb().rpc('revocar_cartera', { p_id: id });
    if (error) return avisar(error.message, 'error');
    avisar('Acceso revocado.', 'success');
    await cargarAccesos();
  }

  // ---------- Inicio: solo con permiso gestionar_carteras
  async function iniciar() {
    const cliente = sb();
    if (!cliente) return;
    const { data: puede, error } = await cliente.rpc('tiene_permiso', { p_clave: 'gestionar_carteras' });
    if (error) { console.warn('[carteras] permiso:', error.message); return; }
    if (!puede) return;
    estilos();
    if (!montar()) return;
    await cargarUsuarios();
    await cargarAccesos();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();