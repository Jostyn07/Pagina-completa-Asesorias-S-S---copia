// Variables globales
let usuarioActual = null;
let rolUsuario = 'operador';

// Cargar rol del usuario desde localStorage
async function cargarRolUsuario() {
    try {
        // ✅ Leer de localStorage (como hace main.js)
        const usuarioData = localStorage.getItem('usuario');
        
        if (!usuarioData) {
            console.warn('⚠️ No hay sesión en localStorage');
            window.location.href = './login.html';
            return null;
        }
        
        const usuario = JSON.parse(usuarioData);
        
        // ✅ Obtener usuario de Supabase Auth
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        
        if (authError || !user) {
            console.error('❌ Sin sesión de Supabase');
            window.location.href = './login.html';
            return null;
        }
        
        // ✅ Guardar datos
        usuarioActual = user;
        rolUsuario = usuario.rol || 'operador';
        
        ;
        ;
        ;
        ;
        
        return rolUsuario;
        
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
    const usuarioData = localStorage.getItem('usuario');
    if (!usuarioData) return null;
    const usuario = JSON.parse(usuarioData);
    return usuario.id || null;
}

function obtenerUsuarioEmail() {
    const usuarioData = localStorage.getItem('usuario');
    if (!usuarioData) return null;
    const usuario = JSON.parse(usuarioData);
    return usuario.email || null;
}

function obtenerRolUsuario() {
    return rolUsuario;
}