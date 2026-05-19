// Variables globales
let usuarioActual = null;
let rolUsuario = 'operador';
let datosUsuario = null;

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
            .select('id, nombre, email, rol, activo')
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
    return rolUsuario === 'operador';
}

function esSoporte() {
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