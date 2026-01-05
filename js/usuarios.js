// ============================================
// GESTIÓN DE USUARIOS
// ============================================

let usuarios = [];
let usuarioEditando = null;

// Cargar usuarios al inicio
async function cargarUsuarios() {
    try {
        // Verificar que permisos.js esté cargado
        if (typeof cargarRolUsuario === 'undefined') {
            console.error('❌ permisos.js no está cargado');
            alert('Error de configuración. Recarga la página.');
            return;
        }
        
        // Verificar permisos
        const rol = await cargarRolUsuario();
        
        if (rol !== 'admin') {
            alert('⚠️ Solo administradores pueden acceder a esta sección');
            window.location.href = './polizas.html';
            return;
        }
        
        console.log('📋 Cargando usuarios...');
        
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        usuarios = data || [];
        console.log(`✅ ${usuarios.length} usuarios cargados`);
        
        renderizarTabla();
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al cargar usuarios: ' + error.message);
    }
}

// Renderizar tabla
function renderizarTabla() {
    const tbody = document.getElementById('tablaUsuarios');
    
    if (!tbody) return;
    
    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.3;">group_off</span>
                    <p>No hay usuarios registrados</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    usuarios.forEach(usuario => {
        const tr = document.createElement('tr');
        
        const rolClass = usuario.rol === 'admin' ? 'badge-admin' : 
                        usuario.rol === 'operador' ? 'badge-operador' : 'badge-soporte';
        
        const estadoClass = usuario.activo ? 'badge-activo' : 'badge-inactivo';
        const estadoTexto = usuario.activo ? 'Activo' : 'Inactivo';
        const estadoIcon = usuario.activo ? 'check_circle' : 'cancel';
        
        tr.innerHTML = `
            <td>${usuario.nombre}</td>
            <td>${usuario.email}</td>
            <td><span class="badge-rol ${rolClass}">${usuario.rol}</span></td>
            <td>
                <span class="badge-estado ${estadoClass}">
                    <span class="material-symbols-rounded" style="font-size: 16px;">${estadoIcon}</span>
                    ${estadoTexto}
                </span>
            </td>
            <td>${new Date(usuario.created_at).toLocaleDateString('es-ES')}</td>
            <td>
                <button class="btn-edit" onclick="editarUsuario('${usuario.id}')">
                    <span class="material-symbols-rounded">edit</span>
                    Editar
                </button>
                <button class="btn-delete" onclick="eliminarUsuario('${usuario.id}', '${usuario.nombre}')">
                    <span class="material-symbols-rounded">delete</span>
                    Eliminar
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Abrir modal crear
function abrirModalCrear() {
    usuarioEditando = null;
    document.getElementById('modalTitulo').innerHTML = `
        <span class="material-symbols-rounded">person_add</span>
        Nuevo Usuario
    `;
    document.getElementById('formUsuario').reset();
    document.getElementById('grupoPassword').style.display = 'block';
    document.getElementById('password').required = true;
    document.getElementById('modalUsuario').classList.add('show');
}

// Editar usuario
function editarUsuario(id) {
    const usuario = usuarios.find(u => u.id === id);
    
    if (!usuario) return;
    
    usuarioEditando = usuario;
    
    document.getElementById('modalTitulo').innerHTML = `
        <span class="material-symbols-rounded">edit</span>
        Editar Usuario
    `;
    
    document.getElementById('nombre').value = usuario.nombre;
    document.getElementById('email').value = usuario.email;
    document.getElementById('rol').value = usuario.rol;
    document.getElementById('activo').checked = usuario.activo;
    
    // Ocultar campo contraseña en edición
    document.getElementById('grupoPassword').style.display = 'none';
    document.getElementById('password').required = false;
    
    document.getElementById('modalUsuario').classList.add('show');
}

// Guardar usuario
async function guardarUsuario(event) {
    event.preventDefault();
    
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rol = document.getElementById('rol').value;
    const activo = document.getElementById('activo').checked;
    
    if (!nombre || !email || !rol) {
        alert('⚠️ Por favor completa todos los campos obligatorios');
        return;
    }
    
    try {
        if (usuarioEditando) {
            // ACTUALIZAR
            const { error } = await supabaseClient
                .from('usuarios')
                .update({
                    nombre,
                    rol,
                    activo,
                    updated_at: new Date().toISOString()
                })
                .eq('id', usuarioEditando.id);
            
            if (error) throw error;
            
            alert('✅ Usuario actualizado correctamente');
            
        } else {
            // CREAR NUEVO
            if (!password || password.length < 6) {
                alert('⚠️ La contraseña debe tener al menos 6 caracteres');
                return;
            }
            
            // 1. Crear usuario en Auth
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre,
                        rol
                    }
                }
            });
            
            if (authError) throw authError;
            
            // 2. Insertar en tabla usuarios
            const { error: dbError } = await supabaseClient
                .from('usuarios')
                .insert({
                    id: authData.user.id,
                    email,
                    nombre,
                    rol,
                    activo
                });
            
            if (dbError) throw dbError;
            
            alert('✅ Usuario creado correctamente');
        }
        
        cerrarModal();
        cargarUsuarios();
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al guardar usuario: ' + error.message);
    }
}

// Eliminar usuario
async function eliminarUsuario(id, nombre) {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${nombre}"?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('usuarios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        alert('✅ Usuario eliminado correctamente');
        cargarUsuarios();
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al eliminar usuario: ' + error.message);
    }
}

// Buscar usuarios
function buscarUsuarios() {
    const busqueda = document.getElementById('searchUsuarios').value.toLowerCase();
    
    if (!busqueda) {
        renderizarTabla();
        return;
    }
    
    const filtrados = usuarios.filter(u => 
        u.nombre?.toLowerCase().includes(busqueda) ||
        u.email?.toLowerCase().includes(busqueda) ||
        u.rol?.toLowerCase().includes(busqueda)
    );
    
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = '';
    
    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.3;">search_off</span>
                    <p>No se encontraron usuarios</p>
                </td>
            </tr>
        `;
        return;
    }
    
    filtrados.forEach(usuario => {
        const tr = document.createElement('tr');
        
        const rolClass = usuario.rol === 'admin' ? 'badge-admin' : 
                        usuario.rol === 'operador' ? 'badge-operador' : 'badge-soporte';
        
        const estadoClass = usuario.activo ? 'badge-activo' : 'badge-inactivo';
        const estadoTexto = usuario.activo ? 'Activo' : 'Inactivo';
        const estadoIcon = usuario.activo ? 'check_circle' : 'cancel';
        
        tr.innerHTML = `
            <td>${usuario.nombre}</td>
            <td>${usuario.email}</td>
            <td><span class="badge-rol ${rolClass}">${usuario.rol}</span></td>
            <td>
                <span class="badge-estado ${estadoClass}">
                    <span class="material-symbols-rounded" style="font-size: 16px;">${estadoIcon}</span>
                    ${estadoTexto}
                </span>
            </td>
            <td>${new Date(usuario.created_at).toLocaleDateString('es-ES')}</td>
            <td>
                <button class="btn-edit" onclick="editarUsuario('${usuario.id}')">
                    <span class="material-symbols-rounded">edit</span>
                    Editar
                </button>
                <button class="btn-delete" onclick="eliminarUsuario('${usuario.id}', '${usuario.nombre}')">
                    <span class="material-symbols-rounded">delete</span>
                    Eliminar
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Cerrar modal
function cerrarModal() {
    document.getElementById('modalUsuario').classList.remove('show');
    document.getElementById('formUsuario').reset();
    usuarioEditando = null;
}

// Cargar al iniciar
document.addEventListener('DOMContentLoaded', cargarUsuarios);