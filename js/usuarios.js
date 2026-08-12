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
        
        await cargarRolUsuario();
        
        const tieneAcceso = tienePermiso('acceso_usuarios');

        if (!tieneAcceso) {
            alert('No tienes permiso para acceder a esta sección')
            window.location.href = "../pages/polizas.html"
            return
        }
        
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        usuarios = data || [];
        ;
        
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
                <td colspan="8" style="text-align:center;padding:40px;">
                    <span class="material-symbols-rounded" style="font-size:48px;opacity:0.3;">group_off</span>
                    <p>No hay usuarios registrados</p>
                </td>
            </tr>`;
        return;
    }
    
    tbody.innerHTML = '';
    
    usuarios.forEach(usuario => {
        const tr = document.createElement('tr');
        
        const rolClass    = usuario.rol === 'admin' ? 'badge-admin' : usuario.rol === 'operador' ? 'badge-operador' : 'badge-soporte';
        const estadoClass = usuario.activo ? 'badge-activo' : 'badge-inactivo';
        const estadoTexto = usuario.activo ? 'Activo' : 'Inactivo';
        const estadoIcon  = usuario.activo ? 'check_circle' : 'cancel';
        const supervisor  = usuarios.find(u => u.id === usuario.supervisor_id);
        const nombreSupervisor = supervisor ? supervisor.nombre : '-';
        const usaIA       = usuario.puede_usar_ia || usuario.rol === 'admin';
        
        tr.innerHTML = `
            <td>${usuario.nombre}</td>
            <td>${usuario.email}</td>
            <td><span class="badge-rol ${rolClass}">${usuario.rol}</span></td>
            <td>
                <span class="badge-estado ${estadoClass}">
                    <span class="material-symbols-rounded" style="font-size:16px;">${estadoIcon}</span>
                    ${estadoTexto}
                </span>
            </td>
            <td>${usuario.es_supervisor ? '<span class="badge-rol badge-admin">Supervisor</span>' : nombreSupervisor}</td>
            <td>${new Date(usuario.created_at).toLocaleDateString('es-ES')}</td>
            <td style="text-align:center">
                ${usaIA
                    ? '<span style="color:#8b5cf6;font-size:0.85rem;font-weight:700;">✦ IA</span>'
                    : '<span style="color:#cbd5e1;font-size:0.85rem;">—</span>'
                }
            </td>
            <td>
                ${esUsuarioAutorizadoPermisos() ? `
                <button class="btn-edit" onclick="editarUsuario('${usuario.id}')">
                    <span class="material-symbols-rounded">edit</span>
                    Editar
                </button>
                ` : ''}
                ${esUsuarioAutorizadoPermisos() ? `
                <button class="btn-delete" onclick="eliminarUsuario('${usuario.id}', '${usuario.nombre}')">
                    <span class="material-symbols-rounded">delete</span>
                    Eliminar
                </button>` : ''}
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Abrir modal crear
async function abrirModalCrear() {
    usuarioEditando = null;
    document.getElementById('modalTitulo').innerHTML = `
        <span class="material-symbols-rounded">person_add</span>
        Nuevo Usuario
    `;
    document.getElementById('formUsuario').reset();
    document.getElementById('grupoPassword').style.display = 'block';
    document.getElementById('password').required = true;
    document.getElementById('modalUsuario').classList.add('show');
    document.getElementById('grupoSupervisor').style.display = 'none';
    document.getElementById('esSupervisor').checked = false;
    await cargarSupervisores();
}

// Editar usuario
async function editarUsuario(id) {
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
    document.getElementById('esSupervisor').checked = usuario.es_supervisor || false;

    document.querySelectorAll('.chk-portal').forEach(cb => {
        cb.checked = (usuario.portales || []).includes(cb.value);
    });

    
    // Ocultar campo contraseña en edición
    document.getElementById('grupoPassword').style.display = 'none';
    document.getElementById('password').required = false;
    
    document.getElementById('modalUsuario').classList.add('show');

    await cargarSupervisores();
    const grupoSupervisor = document.getElementById('grupoSupervisor');
    if (usuario.rol === 'operador') {
        grupoSupervisor.style.display = 'block'
        document.getElementById('supervisorId').value = usuario.supervisor_id || '';
    } else {
        grupoSupervisor.style.display = 'none';
    }
}

function obtenerPortalesSeleccionados() {
    return Array.from(document.querySelectorAll('.chk-portal:checked')).map(cb => cb.value);
}

// Guardar usuario
async function guardarUsuario(event) {
    event.preventDefault();
    
    const idEditando = usuarioEditando?.id || null;
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rol = document.getElementById('rol').value;
    const activo = document.getElementById('activo').checked;
    const portales = obtenerPortalesSeleccionados();
    
    if (!nombre || !email || !rol) {
        alert('⚠️ Por favor completa todos los campos obligatorios');
        return;
    }

    if (portales.length === 0) {
        alert('Selecciona al menos un portal para este usuario')
        return;
    }
    
    try {
        if (usuarioEditando) {
            // ACTUALIZAR
            const { data, error } = await supabaseClient
                .from('usuarios')
                .update({
                    nombre,
                    rol,
                    activo,
                    portales,
                    es_supervisor: document.getElementById('esSupervisor').checked,
                    supervisor_id: (() => {
                        const val = document.getElementById('supervisorId').value;
                        return val || null;
                    })(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', idEditando)
                .select();
            
            
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
                    activo,
                    portales,
                    es_supervisor: document.getElementById('esSupervisor').checked,
                    supervisor_id: rol === 'operador' ? (document.getElementById('supervisorId').value || null) : null
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
    
    if (!busqueda) { renderizarTabla(); return; }
    
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
                <td colspan="8" style="text-align:center;padding:40px;">
                    <span class="material-symbols-rounded" style="font-size:48px;opacity:0.3;">search_off</span>
                    <p>No se encontraron usuarios</p>
                </td>
            </tr>`;
        return;
    }
    
    filtrados.forEach(usuario => {
        const tr = document.createElement('tr');
        
        const rolClass    = usuario.rol === 'admin' ? 'badge-admin' : usuario.rol === 'operador' ? 'badge-operador' : 'badge-soporte';
        const estadoClass = usuario.activo ? 'badge-activo' : 'badge-inactivo';
        const estadoTexto = usuario.activo ? 'Activo' : 'Inactivo';
        const estadoIcon  = usuario.activo ? 'check_circle' : 'cancel';
        const usaIA       = usuario.puede_usar_ia || usuario.rol === 'admin';
        
        tr.innerHTML = `
            <td>${usuario.nombre}</td>
            <td>${usuario.email}</td>
            <td><span class="badge-rol ${rolClass}">${usuario.rol}</span></td>
            <td>
                <span class="badge-estado ${estadoClass}">
                    <span class="material-symbols-rounded" style="font-size:16px;">${estadoIcon}</span>
                    ${estadoTexto}
                </span>
            </td>
            <td>${new Date(usuario.created_at).toLocaleDateString('es-ES')}</td>
            <td style="text-align:center">
                ${usaIA
                    ? '<span style="color:#8b5cf6;font-size:0.85rem;font-weight:700;">✦ IA</span>'
                    : '<span style="color:#cbd5e1;font-size:0.85rem;">—</span>'
                }
            </td>
            <td>
                ${esUsuarioAutorizadoPermisos() ? `
                <button class="btn-edit" onclick="editarUsuario('${usuario.id}')">
                    <span class="material-symbols-rounded">edit</span>
                    Editar
                </button>
                ` : ''}
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

document.getElementById('rol').addEventListener('change', function() {
    const grupoSupervisor = document.getElementById('grupoSupervisor');
    grupoSupervisor.style.display = this.value === 'operador' ? 'block' : 'none';
})

async function cargarSupervisores() {
    const {data, error } = await supabaseClient
        .from('usuarios')
        .select('id, nombre')
        .eq('activo', true)
        .eq('es_supervisor', true)
        .order('nombre');

    console.log('Supervisores encontrados:', data);
    console.log('Error:', error);
    const select = document.getElementById('supervisorId');
    console.log('supervisor_id a guardar:', document.getElementById('supervisorId').value);
    select.innerHTML = '<option value="">Sin supervisor</option>';
    (data || []).forEach(s => {
        select.innerHTML += `<option value="${s.id}">${s.nombre}</option>`
    })
}


// Cargar al iniciar
document.addEventListener('DOMContentLoaded', cargarUsuarios);