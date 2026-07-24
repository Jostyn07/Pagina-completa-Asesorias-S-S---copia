// Variables globales
let usuarioActual = null;
let rolUsuario = 'operador';
let datosUsuario = null;

let permisosEfectivos = {};
let catalogoPermisosCache = [];

const JERARQUIA_ROLES = { admin_general: 4, admin: 3, supervisor: 2, operador: 1};

// Cargar rol del usuario desde localStorage
async function cargarRolUsuario() {
    try {
        const usuarioData = localStorage.getItem('usuario');
        
        if (!usuarioData) {
            console.warn('⚠️ No hay sesión en localStorage');
            window.location.href = './login.html';
            return null;
        }
        
        const usuario = JSON.parse(usuarioData);
        
        // Obtener usuario de Supabase Auth
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        
        if (authError || !user) {
            console.error('❌ Sin sesión de Supabase');
            window.location.href = './login.html';
            return null;
        }
        
        // Leer rol Directo de la tabla usuarios en supabase
        const { data: usuarioDB, error: dbError } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('email', user.email)
            .single();
        
        if (dbError || !usuarioDB) {
            console.error('Usuario no encontrado en BD:', dbError);
            window.location.href = '../index.html'
            return null
        }

        // Guardar en varables de módulo
        usuarioActual = user;
        datosUsuario = usuarioDB;
        rolUsuario = usuarioDB.rol || 'operador';

        await cargarPermisosEfectivos();

        return rolUsuario
        
    } catch (error) {
        console.error('❌ Error al cargar rol:', error);
        return 'operador';
    }
}

function esAdministrador() {
    return rolUsuario === 'admin';
}

function esOperador() {
    if (!datosUsuario) return false;
    return rolUsuario === 'operador';
}

function esSoporte() {
    if (!datosUsuario) return false;
    return rolUsuario === 'soporte';
}

function obtenerUsuarioId() {
    // Usar datos de supabase si ya estan cargados
    if (datosUsuario) return datosUsuario.id || null;
    // Fallback al localstoridage si aun no se ha llamado cargarRolUsuario()
    const usuarioData = localStorage.getItem('usuario');
    if (!usuarioData) return null;
    const usuario = JSON.parse(usuarioData);
    return usuario.id || null;
}

function obtenerUsuarioEmail() {
    if (datosUsuario) return datosUsuario.email || null
    const usuarioData = localStorage.getItem('usuario');
    if (!usuarioData) return null;
    const usuario = JSON.parse(usuarioData);
    return usuario.email || null;
}

function obtenerRolUsuario() {
    return rolUsuario;
}

function puedeUsarIA() {
    if (!datosUsuario) return false;
    // Admin siempre tiene acceso
    if (datosUsuario.rol === 'admin') return true;
    return datosUsuario.puede_usar_ia === true;
}

function obtenerNivelContextoIA() {
    if (!datosUsuario) return null;
    const rol = datosUsuario.rol;
    return {
        usuarioId:    datosUsuario.id,
        nombre:       datosUsuario.nombre,
        rol:          rol,
        esSupervisor: datosUsuario.es_supervisor || false,

        alcance: rol === 'admin'
            ? 'global'
            : datosUsuario.es_supervisor
                ? 'equipo'
                : 'propio'
    };
}

function puedeVerMovimientos() {
    if (!datosUsuario) return false;
    if (datosUsuario.rol == 'admin') return true
    return datosUsuario.puede_ver_movimientos === true;
}

function puedeEditarTablero() {
    if (!datosUsuario) return false;
    if (datosUsuario.rol === 'admin') return true;
    return datosUsuario.puede_editar_tablero === 'true';
}

function nivelRol(rol) {
    return JERARQUIA_ROLES[rol] || 0; // Evalua el nivel de acuerdo al rol que tenga el usuario
}

function esAdminGenearl() {
    return datosUsuario?.rol === 'admin_general'; // Devuelve true o false de acuerdo a si el usuario es admin o no
}

function esAdminOMayor() {
    return nivelRol(datosUsuario?.rol) >= JERARQUIA_ROLES.admin; // devuelve el nivel si el usuario es admin o admin_general
}

function esSupervisorOMayor() {
    return nivelRol(datosUsuario?.rol) >= JERARQUIA_ROLES.supervisor // devuelve el nivel si el usuario es supervisor, admin o admin_general
}

async function cargarPermisosEfectivos() {
    if (!datosUsuario) return;
    
    // En caso de que no haya un solo dato en catalogoPermisosCache, busca la información en la tabla de catalogo_permisos (clave y valor por defecto) y lo ingresa en catalofoPermisosCahe
    if(catalogoPermisosCache.length === 0) {
        const { data: catalogo } = await supabaseClient
            .from('catalogo_permisos')
            .select('clave, valor_por_defecto');
        catalogoPermisosCache = catalogo || []
    }

    const rol = datosUsuario.rol; // se crea un variable con el tipo de rol del usuario
    const portalesUsuario = datosUsuario.portales?.length ? datosUsuario.portales : []; // Se toma la información del usuario
    const portalesConsulta = ['TODOS', ...portalesUsuario]; 

    const [{ data: filasRol }, { data: filasUsuario }] = await Promise.all([
        supabaseClient
            .from('permisos_rol')
            .select('portal, permiso_clave, valor')
            .eq('rol', rol)
            .in('portal', portalesConsulta),
        supabaseClient
            .from('permisos_usuario')
            .select('permiso_clave, valor')
            .eq('usuario_id', datosUsuario.id)
    ]);

    permisosEfectivos = {};
    catalogoPermisosCache.forEach(p => { permisosEfectivos[p.clave] = p.valor_por_defecto; });

    (filasRol || []).filter(f => f.portal === 'TODOS')
        .forEach(f => { permisosEfectivos[f.permiso_clave] = f.valor; });

    (filasRol || []).filter(f => f.portal !== 'TODOS')
        .forEach(f => { permisosEfectivos[f.permiso_clave] = f.valor; });

    (filasRol || []).forEach(f => { permisosEfectivos[f.permiso_clave] = f.valor});
}

// Chequeo granular
function tienePermiso(clave) {
    if (esAdminGenearl()) return true;
    return permisosEfectivos[clave] === true;
}