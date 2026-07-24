// Gestion de permisos

let catalogoPermisos = [];
let matrizActual = {};
let cambiosPendientesRol = {};

document.addEventListener('DOMContentLoaded', async () => {
    await cargarCatalogoPermisos();
    await cargarPortalesDisponibles();
    await cargarMatrizRol();
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