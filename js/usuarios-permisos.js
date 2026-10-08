// Gestion de permisos

let catalogoPermisos = [];
let matrizActual = {};
let cambiosPendientesRol = {};
let usuariosParaSelector = [];
let matrizUsuarioActual = {};
let overridesUsuarioActual = {};
let cambiosPendientesUsuario = {};

async function verificarAccesoPermisos() {
    await cargarRolUsuario();

    const botonTab = document.querySelector('[data-tab="permisos"]');
    const contenedor = document.getElementById('tab-permisos');

    const permitido =
        (typeof esAdminGenearl === 'function' && esAdminGenearl()) ||
        (typeof esAdminOMayor === 'function' && esAdminOMayor()) ||
        (typeof tienePermiso === 'function' && tienePermiso('gestionar_carteras'));

    if (!permitido) {
        if (botonTab) botonTab.style.display = 'none';
        if (contenedor) {
            contenedor.innerHTML = `
                <div style="text-align:center;padding:60px 20px;color:var(--color-text-placeholder)">
                    <span class="material-symbols-rounded" style="font-size:48px;opacity:0.3">lock</span>
                    <p>No tienes permiso para acceder a esta sección</p>
                </div>`;
        }
        return false;
    }

    return true;
}

document.addEventListener('DOMContentLoaded', async () => {
    const autorizado = await verificarAccesoPermisos();
    if(!autorizado) return;

    await cargarCatalogoPermisos();
    await cargarPortalesDisponibles();
    await cargarMatrizRol();
    await cargarUsuariosParaSelector();
    await prepararGestionCarteras();
});
async function cargarUsuariosParaSelector() {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('id, nombre, email, rol, portales')
        .order('nombre', { ascending: true });

    if (error) {
        console.error('Error cargando usuarios: ', error);
        return;
    }
    usuariosParaSelector = data || [];
    poblarSelectUsuarioPermisos(usuariosParaSelector);    
}

function poblarSelectUsuarioPermisos(lista) {
    const select = document.getElementById('selectUsuarioPermisos');
    const valorActual = select.value;

    select.innerHTML = '<option value="">Selecciona un usuario...</option>' + 
        lista.map(u => `<option value ="${u.id}">${u.nombre} (${u.rol})</option>`).join('');
    
    if (lista.some(u => u.id === valorActual)) {
        select.value = valorActual;
    }
}

function filtrarSelectUsuarioPermisos() {
    const query = document.getElementById('buscarUsuarioPermisos').value.toLowerCase().trim();
    const filtrados = !query ? usuariosParaSelector : usuariosParaSelector.filter(u => 
        u.nombre?.toLowerCase().includes(query) || 
        u.email?.toLowerCase().includes(query)
    );
    poblarSelectUsuarioPermisos(filtrados);
}

const PORTALES_VALIDOS = ['TODOS', 'Evelyn Morillo', 'Dante SY', 'Isabel SY', 'Alfred Nieves'];

async function cargarPortalesDisponibles() {
    const select = document.getElementById('selectPortalPermisos');
    select.innerHTML = PORTALES_VALIDOS
        .map(p => `<option value="${p}">${p === 'TODOS' ? 'Todos los portales (base)' : p}</option>`)
        .join('');
}

// Cambiar entre sub-pestañas por rol / por usuario
function cambiarSubtabPermisos(target) {
    document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.subtab-btn[data-subtab="${target}"]`).classList.add('active')
    document.getElementById(`subtab-${target}`).classList.add('active');
}

// Cargar la mtariz de permisos para el rol + portal seleccionados
async function cargarMatrizRol() {
    const rol = document.getElementById('selectRolPermisos').value;
    const portal = document.getElementById('selectPortalPermisos').value;
    if (!rol || !portal) return;

    const { data: filas, error } = await supabaseClient
        .from('permisos_rol')
        .select('permiso_clave, valor')
        .eq('rol', rol)
        .eq('portal', portal);

    if (error) {
        console.error('Error cargando permisos_rol', error);
        return
    }

    // Construir mapa: lo que ya está guardado, y si no hay fila, usa el default del catálogo

    const guardados = Object.fromEntries((filas || []).map(f => [f.permiso_clave, f.valor]));
    matrizActual = {};
    catalogoPermisos.forEach(p=> {
        matrizActual[p.clave] = p.clave in guardados ? guardados[p.clave] : p.valor_por_defecto;
    });

    cambiosPendientesRol = {}
    document.getElementById('btnGuardarPermisosRol').disabled = true;
    renderizarMatrizRol()
}

// ================================================================
// GESTIÓN MANUAL DE CARTERAS
// ================================================================

function tienePermisoGestionCarteras() {
    return (
        (typeof esAdminGenearl === 'function' && esAdminGenearl()) ||
        (typeof esAdminOMayor === 'function' && esAdminOMayor()) ||
        (typeof tienePermiso === 'function' && tienePermiso('gestionar_carteras'))
    );
}

async function prepararGestionCarteras() {
    const panel = document.getElementById('gestionCarterasManual');
    if (!panel || !tienePermisoGestionCarteras()) return;

    panel.style.display = 'block';

    const operadores = usuariosParaSelector.filter(u =>
        u.rol === 'operador' && u.activo !== false
    );

    const propietarios = usuariosParaSelector.filter(u =>
        u.activo !== false
    );

    const selOperador = document.getElementById('selectCarteraOperador');
    const selPropietario = document.getElementById('selectCarteraPropietario');

    if (selOperador) {
        selOperador.innerHTML =
            '<option value="">Selecciona un operador...</option>' +
            operadores.map(u =>
                '<option value="' + u.id + '">' +
                escapeHtmlCartera(u.nombre + ' (' + u.email + ')') +
                '</option>'
            ).join('');
    }

    if (selPropietario) {
        selPropietario.innerHTML =
            '<option value="">Selecciona el usuario propietario...</option>' +
            propietarios.map(u =>
                '<option value="' + u.id + '">' +
                escapeHtmlCartera(u.nombre + ' (' + u.email + ')') +
                '</option>'
            ).join('');
    }

    actualizarSelectorPropietarioCartera();
    await cargarAccesosCartera();
}

function escapeHtmlCartera(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function actualizarSelectorPropietarioCartera() {
    const scope = document.getElementById('selectCarteraScope')?.value;
    const grupo = document.getElementById('grupoPropietarioCartera');
    const select = document.getElementById('selectCarteraPropietario');

    if (!grupo || !select) return;

    const esTodas = scope === 'all_asesorias';
    grupo.style.display = esTodas ? 'none' : 'block';
    select.disabled = esTodas;

    if (esTodas) select.value = '';
}

async function cargarAccesosCartera() {
    const tbody = document.getElementById('tablaAccesosCartera');
    if (!tbody) return;

    const { data, error } = await supabaseClient
        .from('portfolio_access')
        .select('*')
        .order('granted_at', { ascending: false });

    if (error) {
        console.error('Error cargando accesos de cartera:', error);
        tbody.innerHTML =
            '<tr><td colspan="7" style="text-align:center;padding:25px;color:#ef4444;">' +
            escapeHtmlCartera(error.message) +
            '</td></tr>';
        return;
    }

    const usuariosMap = new Map(
        usuariosParaSelector.map(u => [u.id, u])
    );

    const filas = data || [];

    if (!filas.length) {
        tbody.innerHTML =
            '<tr><td colspan="7" style="text-align:center;padding:25px;color:#94a3b8;">No hay accesos manuales configurados.</td></tr>';
        return;
    }

    tbody.innerHTML = filas.map(row => {
        const operador = usuariosMap.get(row.operator_id);
        const propietario = row.owner_user_id
            ? usuariosMap.get(row.owner_user_id)
            : null;
        const concedido = usuariosMap.get(row.granted_by);

        const alcance = row.scope === 'all_asesorias'
            ? 'Todas las carteras de Asesorías'
            : 'Cartera de un usuario';

        const propietarioTexto = propietario
            ? propietario.nombre
            : row.scope === 'all_asesorias' ? '—' : (row.owner_user_id || '—');

        const estado = row.activo
            ? '<span class="badge-estado badge-activo">Activo</span>'
            : '<span class="badge-estado badge-inactivo">Revocado</span>';

        const acciones = row.activo
            ? '<button class="btn-delete" type="button" onclick="revocarAccesoCarteraUI(\'' + row.id + '\')"><span class="material-symbols-rounded">lock</span> Revocar</button>'
            : '—';

        return '<tr>' +
            '<td>' + escapeHtmlCartera(operador?.nombre || row.operator_id) + '</td>' +
            '<td>' + escapeHtmlCartera(alcance) + '</td>' +
            '<td>' + escapeHtmlCartera(propietarioTexto) + '</td>' +
            '<td>' + escapeHtmlCartera(concedido?.nombre || row.granted_by || '—') + '</td>' +
            '<td>' + escapeHtmlCartera(new Date(row.granted_at).toLocaleString('es-CO')) + '</td>' +
            '<td>' + estado + '</td>' +
            '<td>' + acciones + '</td>' +
        '</tr>';
    }).join('');
}

async function otorgarAccesoCarteraUI() {
    if (!tienePermisoGestionCarteras()) {
        alert('No tienes permiso para gestionar carteras.');
        return;
    }

    const operatorId = document.getElementById('selectCarteraOperador')?.value;
    const scope = document.getElementById('selectCarteraScope')?.value || 'user_portfolio';
    const ownerId = scope === 'all_asesorias'
        ? null
        : document.getElementById('selectCarteraPropietario')?.value || null;

    if (!operatorId) {
        alert('Selecciona el operador que recibirá el acceso.');
        return;
    }

    if (scope === 'user_portfolio' && !ownerId) {
        alert('Selecciona el propietario de la cartera.');
        return;
    }

    const confirmado = confirm(
        scope === 'all_asesorias'
            ? '¿Conceder acceso a TODAS las carteras de Asesorías para este operador?'
            : '¿Conceder acceso a la cartera seleccionada para este operador?'
    );

    if (!confirmado) return;

    const { error } = await supabaseClient.rpc('otorgar_acceso_cartera', {
        p_operator_id: operatorId,
        p_owner_user_id: ownerId,
        p_scope: scope
    });

    if (error) {
        console.error(error);
        alert('No se pudo conceder el acceso: ' + error.message);
        return;
    }

    alert('Acceso concedido correctamente.');

    document.getElementById('selectCarteraOperador').value = '';
    document.getElementById('selectCarteraPropietario').value = '';
    await cargarAccesosCartera();
}

async function revocarAccesoCarteraUI(accessId) {
    if (!tienePermisoGestionCarteras()) {
        alert('No tienes permiso para gestionar carteras.');
        return;
    }

    if (!confirm('¿Revocar este acceso a cartera?')) return;

    const { error } = await supabaseClient.rpc('revocar_acceso_cartera', {
        p_access_id: accessId
    });

    if (error) {
        console.error(error);
        alert('No se pudo revocar el acceso: ' + error.message);
        return;
    }

    await cargarAccesosCartera();
}

function renderizarMatrizRol() {
    const contenedor = document.getElementById('matrizPermisosRol');

    const categorias = [...new Set(catalogoPermisos.map(p => p.categoria))];

    contenedor.innerHTML = categorias.map(cat => `
        <div class="permisos-categoria">
            <div class="permisos-categoria-titulo">${cat}</div>
            ${catalogoPermisos.filter(p => p.categoria === cat).map(p => `
                <label class="permiso-row" for="perm-${p.clave}">
                    <span class="permiso-row-nombre">${p.nombre}</span>
                    <div class="toggle-switch">
                        <input type="checkbox" id="perm-${p.clave}" ${matrizActual[p.clave] ? 'checked' : ''} onchange="marcarCambioPermiso('${p.clave}', this.checked)">
                        <span class="toggle-track"></span>
                    </div>
                </label>
            `).join('')}
        </div>
    `).join('');
}

function marcarCambioPermiso(clave, nuevoValor) {
    if (nuevoValor === matrizActual[clave]) {
        delete cambiosPendientesRol[clave];
    } else {
        cambiosPendientesRol[clave] = nuevoValor;
    }
    document.getElementById('btnGuardarPermisosRol').disabled = Object.keys(cambiosPendientesRol).length === 0;
}

// Guardar cambios, con cascada de overrides individuales
async function guardarPermisosRol() {
    const claves = Object.keys(cambiosPendientesRol);
    if (claves.length === 0) return;

    const rol = document.getElementById('selectRolPermisos').value;
    const portal = document.getElementById('selectPortalPermisos').value;

    const { data: usuariosDelRol } = await supabaseClient
        .from('usuarios')
        .select('id, nombre')
        .eq('rol', rol)
        .contains('portales', [portal]);

    const idsUsuarios = (usuariosDelRol || []).map(u => u.id);
    let overridesAfectados = [];

    if (idsUsuarios.length > 0) {
        const { data } = await supabaseClient
            .from('permisos_usuario')
            .select('usuario_id, permiso_clave')
            .in('usuario_id', idsUsuarios)
            .in('permiso_clave', claves);
        overridesAfectados = data || [];
    }

    if (overridesAfectados.length > 0) {
        const confirmar = confirm(
            `Este cambio afecta ${overridesAfectados.length} permiso(s) personalizado(s) que ya tenían usuarios de este rol/portal. ` +
            `Se van a borrar esos overrides individuales para que hereden el nuevo valor general.\n\n¿Continuar?`
        );
        if (!confirmar) return
    }

    // Upsert de los permisos de rol
    const filas = claves.map(clave => ({
        rol,
        portal,
        permiso_clave: clave,
        valor: cambiosPendientesRol[clave],
        actualizado_por: datosUsuario.id,
        actualizado_en: new Date().toISOString()
    }));

    const { error: errorUpsert } = await supabaseClient
        .from('permisos_rol')
        .upsert(filas, { onConflict: 'rol,portal,permiso_clave'});

    if (errorUpsert) {
        alert('Error al guardar: ' + errorUpsert.message);
        return
    }

    // Borrar los overrides que quedaron obsoletos
    for (const ov of overridesAfectados) {
        await supabaseClient
            .from('permisos_usuario')
            .delete()
            .eq('usuario_id', ov.usuario_id)
            .eq('permiso_clave', ov.permiso_clave);
    }

    alert('Permisos guardados correctamente');
    await cargarMatrizRol();
}

async function cargarMatrizUsuario() {
    const usuarioId = document.getElementById('selectUsuarioPermisos').value;
    const contenedor = document.getElementById('matrizPermisosUsuario');
    const info = document.getElementById('infoBaseUsuario');

    if (!usuarioId) {
        contenedor.innerHTML = '';
        info.innerHTML = '';
        document.getElementById('btnGuardarPermisosUsuario').disabled = true;
        return;
    }

    const usuario = usuariosParaSelector.find(u => u.id === usuarioId);
    if (!usuario) return;

    const portalesUsuario = usuario.portales?.length ? usuario.portales : [];
    const portalesConsulta = ['TODOS', ...portalesUsuario];

    const [{ data: filasRol }, { data: filasUsuario }] = await Promise.all([
        supabaseClient
            .from('permisos_rol')
            .select('permiso_clave, valor')
            .eq('rol', usuario.rol)
            .in('portal', portalesConsulta),
        supabaseClient
            .from('permisos_usuario')
            .select('permiso_clave, valor')
            .eq('usuario_id', usuarioId)
    ]);

    const baseHeredada = {};
    catalogoPermisos.forEach(p => { baseHeredada[p.clave] = p.valor_por_defecto; });
    (filasRol || []).forEach(f => { baseHeredada[f.permiso_clave] = f.valor; });

    // Overrides individuales ya guardados para este usuario
    overridesUsuarioActual = Object.fromEntries((filasUsuario || []).map(f => [f.permiso_clave, f.valor]));

    // Valor efectivo mostrado: override si existe, si no la base heredada
    matrizUsuarioActual = {};
    catalogoPermisos.forEach(p => {
        matrizUsuarioActual[p.clave] = p.clave in overridesUsuarioActual
            ? overridesUsuarioActual[p.clave]
            : baseHeredada[p.clave];
    });

    cambiosPendientesUsuario = {};
    document.getElementById('btnGuardarPermisosUsuario').disabled = true;
    info.innerHTML = `<p>Rol: <strong>${usuario.rol}</strong> · Portal(es): <strong>${portalesUsuario.join(', ') || '—'}</strong></p>`;

    renderizarMatrizUsuario();
}

function renderizarMatrizUsuario() {
    const contenedor = document.getElementById('matrizPermisosUsuario');
    const categorias = [...new Set(catalogoPermisos.map(p => p.categoria))];

    contenedor.innerHTML = categorias.map(cat => `
        <div class="permisos-categoria">
            <div class="permisos-categoria-titulo">${cat}</div>
            ${catalogoPermisos.filter(p => p.categoria === cat).map(p => {
                const esPersonalizado = p.clave in overridesUsuarioActual;
                return `
                <div class="permiso-row">
                    <span class="permiso-row-nombre">
                        ${p.nombre}
                        ${esPersonalizado ? '<span class="badge-personalizado">Personalizado</span>' : ''}
                    </span>
                    <div class="permiso-row-acciones">
                        ${esPersonalizado ? `<button type="button" class="btn-quitar-override" onclick="quitarOverrideUsuario('${p.clave}')" title="Quitar personalización">✕</button>` : ''}
                        <div class="toggle-switch">
                            <input type="checkbox" id="permu-${p.clave}" ${matrizUsuarioActual[p.clave] ? 'checked' : ''} onchange="marcarCambioPermisoUsuario('${p.clave}', this.checked)">
                            <span class="toggle-track"></span>
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `).join('');
}

function marcarCambioPermisoUsuario(clave, nuevoValor) {
    if (nuevoValor === matrizUsuarioActual[clave]) {
        delete cambiosPendientesUsuario[clave];
    } else {
        cambiosPendientesUsuario[clave] = nuevoValor;
    }
    document.getElementById('btnGuardarPermisosUsuario').disabled = Object.keys(cambiosPendientesUsuario).length === 0;
}

async function guardarPermisosUsuario() {
    const claves = Object.keys(cambiosPendientesUsuario);
    if (claves.length === 0) return;

    const usuarioId = document.getElementById('selectUsuarioPermisos').value;
    if (!usuarioId) return;

    const filas = claves.map(clave => ({
        usuario_id: usuarioId,
        permiso_clave: clave,
        valor: cambiosPendientesUsuario[clave],
        actualizado_por: datosUsuario.id,
        actualizado_en: new Date().toISOString()
    }));

    const { error } = await supabaseClient
        .from('permisos_usuario')
        .upsert(filas, { onConflict: 'usuario_id, permiso_clave' });

    if (error) {
        alert('Error al guardar: ' + error.message);
        return;
    }

    alert('Permisos individuales guardados correctamente');
    await cargarMatrizUsuario();
}

async function quitarOverrideUsuario(clave) {
    const usuarioId = document.getElementById('selectUsuarioPermisos').value;
    if (!usuarioId) return;
    if (!confirm('¿Quitar la personalización de este permiso? Volverá a heredar el valor del rol.')) return;

    const { error } = await supabaseClient
        .from('permisos_usuario')
        .delete()
        .eq('usuario_id', usuarioId)
        .eq('permiso_clave', clave);

    if (error) {
        alert('Error: ' + error.message);
        return;
    }

    await cargarMatrizUsuario();
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#tabsNavUsuarios .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            document.querySelectorAll('#tabsNavUsuarios .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });
});