// Variables globales
let usuarioActual = null;
let rolUsuario = 'operador'; // Default

// ======================================
// CARGA ROL DE USUARIO
// ======================================

async function cargarRolUsuario() {
    try {
        // Obtener usuario autenticado
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        
        if (authError) throw authError;

        if (!user) {
            console.warn('⚠️ No hay usuario autenticado');
            return 'operador';
        }

        // ✅ Guardar usuario PRIMERO
        usuarioActual = user;

        // Obtener rol desde tabla usuarios
        const { data: usuario, error: usuarioError } = await supabaseClient
            .from('usuarios')
            .select('rol, nombre, activo')
            .eq('id', user.id)
            .single();

        if (usuarioError) {
            console.error('❌ Error al obtener usuario:', usuarioError);
            
            // Si el usuario no existe en tabla usuarios, bloquear acceso
            if (usuarioError.code === 'PGRST116') {
                console.error('❌ Usuario no autorizado - No existe en tabla usuarios');
                alert('Tu cuenta no está autorizada. Contacta al administrador.');
                await supabaseClient.auth.signOut();
                window.location.href = './login.html';
                return null;
            }
            
            return 'operador'; // Default para otros errores
        }

        if (!usuario) {
            console.error('❌ Usuario no encontrado en tabla usuarios');
            alert('Tu cuenta no está registrada. Contacta al administrador.');
            await supabaseClient.auth.signOut();
            window.location.href = './login.html';
            return null;
        }

        if (!usuario.activo) {
            console.error('❌ Usuario inactivo');
            alert('Tu cuenta está inactiva.');
            await supabaseClient.auth.signOut();
            window.location.href = './login.html';
            return null;
        }

        // ✅ Asignar rol
        rolUsuario = usuario.rol || 'operador';

        console.log('👤 Usuario:', user.email);
        console.log('👤 Nombre:', usuario.nombre);
        console.log('🔐 Rol:', rolUsuario);

        return rolUsuario;
        
    } catch (error) {
        console.error('❌ Error al cargar rol:', error);
        return 'operador'; // Default seguro 
    }
}

// ============================================
// FUNCIONES DE VERIFICACIÓN DE ROL
// ============================================

function esAdministrador() {
    return rolUsuario === 'admin';
}

function esOperador() {
    return rolUsuario === 'operador';
}

function esSoporte() {
    return rolUsuario === 'soporte';
}

// ============================================
// SISTEMA DE PERMISOS
// ============================================

function tienePermiso(permiso) {
    const permisos = {
        'admin': [
            'ver_todos_clientes',
            'editar_estado_mercado',
            'eliminar_clientes',
            'ver_reportes_todos',
            'gestionar_usuarios',
            'editar_cualquier_cliente',
            'ver_evaluaciones_todas'
        ],
        'soporte': [
            'ver_todos_clientes',
            'editar_estado_compania',
            'ver_reportes_todos',
            'ayudar_operadores'
        ],
        'operador': [
            'ver_mis_clientes',
            'crear_cliente',
            'editar_mi_cliente',
            'ver_mis_reportes',
            'editar_estado_compania'
        ]
    };
    
    const permisosRol = permisos[rolUsuario] || permisos['operador'];
    return permisosRol.includes(permiso);
}

// ============================================
// OBTENER INFORMACIÓN DEL USUARIO
// ============================================

function obtenerUsuarioId() {
    return usuarioActual?.id || null;
}

function obtenerUsuarioEmail() {
    return usuarioActual?.email || null;
}

function obtenerRolUsuario() {
    return rolUsuario;
}

// ============================================
// VERIFICAR PROPIEDAD DE CLIENTE
// ============================================

async function esClientePropio(clienteId) {
    try {
        const { data: cliente, error } = await supabaseClient
            .from('clientes')
            .select('operador_id')
            .eq('id', clienteId)
            .single();
        
        if (error) {
            console.error('Error al verificar propiedad:', error);
            return false;
        }
        
        return cliente.operador_id === obtenerUsuarioId();
    } catch (error) {
        console.error('Error al verificar propiedad:', error);
        return false;
    }
}

// ============================================
// VERIFICAR ACCESO A CLIENTE
// ============================================

async function verificarAccesoCliente(clienteId) {
    try {
        // Admin siempre tiene acceso
        if (esAdministrador()) {
            console.log('✅ Admin - Acceso total');
            return true;
        }
        
        // Verificar si es cliente propio
        const esPropio = await esClientePropio(clienteId);
        
        if (!esPropio) {
            console.error('❌ No tienes permiso para ver este cliente');
            alert('No tienes permiso para ver este cliente');
            window.location.href = './polizas.html';
            return false;
        }
        
        console.log('✅ Cliente propio - Acceso permitido');
        return true;
        
    } catch (error) {
        console.error('Error al verificar acceso:', error);
        alert('Error al verificar acceso. Por favor, intenta de nuevo.');
        return false;
    }
}

// ============================================
// MOSTRAR INFORMACIÓN DE ROL EN UI
// ============================================

function mostrarRolEnUI() {
    const rolBadge = document.getElementById('userRolBadge');
    if (rolBadge) {
        const roles = {
            'admin': { texto: 'Administrador', clase: 'badge-admin' },
            'operador': { texto: 'Operador', clase: 'badge-operador' },
            'soporte': { texto: 'Soporte', clase: 'badge-soporte' }
        };
        
        const rolInfo = roles[rolUsuario] || roles['operador'];
        rolBadge.textContent = rolInfo.texto;
        rolBadge.className = `user-rol-badge ${rolInfo.clase}`;
    }
}

// ============================================
// LOG DE PERMISOS (DEBUG)
// ============================================

function logPermisos() {
    console.group('🔐 Estado de Permisos');
    console.log('Usuario ID:', obtenerUsuarioId());
    console.log('Email:', obtenerUsuarioEmail());
    console.log('Rol:', rolUsuario);
    console.log('Es Admin:', esAdministrador());
    console.log('Es Operador:', esOperador());
    console.log('Permisos:', {
        'Ver todos clientes': tienePermiso('ver_todos_clientes'),
        'Editar estado mercado': tienePermiso('editar_estado_mercado'),
        'Eliminar clientes': tienePermiso('eliminar_clientes')
    });
    console.groupEnd();
}