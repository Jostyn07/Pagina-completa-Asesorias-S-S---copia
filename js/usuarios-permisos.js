// Gestion de permisos

let catalogoPermisos = [];
let matrizActual = {};
let cambiosPendientesRol = {};
let usuariosParaSelector = [];
let matrizUsuarioActual = {};
let overridesUsuarioActual = {};
let cambiosPendientesUsuario = {};

document.addEventListener('DOMContentLoaded', async () => {
    await cargarCatalogoPermisos();
    await cargarPortalesDisponibles();
    await cargarMatrizRol();
    await cargarUsuariosParaSelector();
});

async function cargarCatalogoPermisos() {
    const { data, error } = await supabaseClient
        .from('catalogo_permisos')
        .select('*')
        .order('categoria', {ascending: true});

    if (error) {
        console.error('Error cargando catálogo de permisos:', error);
        return;
    }
    catalogoPermisos = data || [];
}

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

const PORTALES_VALIDOS = ['TODOS', 'Evelyn Morillo', 'Dante SY', 'Isabel SY'];

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

    alert('permisos guardados correctamente');
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
    overridesUsuarioActual = Object.fromEntries((filasUusuario || []).map(f => [f.permiso_clave, f.valor]));

    // Valor efectivo mostrado: override si existe, si no la base heredada
    matrizUsuarioActual = {};
    catalogoPermisos.forEach(p => {
        matrizUsuarioActual[p.clave] = p.clave in overridesUsuarioActual
            ? overridesUsuarioActual[p.clave]
            : baseHeredada[p.clave];
    });

    cambiosPendientesUsuario = {};
    document.getElementById(`<p>Rol: <strong>${usuario.rol}</strong> Portal(es): <strong>${portalesUsuario.join(', ') || '-'}</strong></p>`)

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

function marcarCambioPermiso() {
    if (nuevoValor === matrizUsuarioActual[clave]) {
        if (nuevoValor === matrizUsuarioActual[clave]) {
            delete cambiosPendientesUsuario[clave];
        } else {
            cambiosPendientesUsuario[clave] = nuevoValor;
        }
        document.getElementById('btnGuardarPermisosUsuario').disabled = Object.keys(cambiosPendientesUsuario).length === 0
    }
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
        .upset(filas, { onConflict: 'usuario_id, permiso_clave' });

    if (error) {
        alert('Error al guardar: ' + error.message);
        return;
    }

    alert('Permisos inddividuales guardados correctamente');
    await cargarMatrizUsuario();
}

async function quitarOverrideUsuario(clave) {
    const usuarioId = document.getElementById('selectUsuarioPermisos').value;
    if (!usuarioId) return;
    if (!confirm('¿Quitar la personalización de este permiso? Volerá a heredar el valor del rol.')) return;

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