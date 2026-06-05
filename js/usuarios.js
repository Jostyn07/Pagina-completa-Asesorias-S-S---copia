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
        
        ;
        
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
    document.getElementById('puedeVerMonitoreo').checked = false;
    document.getElementById('puedeUsarIA').checked = false;
    document.getElementById('puedeVerMovimientos').checked = false;
    document.getAnimations('puedeEditarTablero').checked = false
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
    document.getElementById('puedeVerMonitoreo').checked = usuario.puede_ver_monitoreo || false;
    document.getElementById('puedeUsarIA').checked = usuario.puede_usar_ia || false;
    document.getElementById('esSupervisor').checked = usuario.es_supervisor || false;
    document.getElementById('puedeVerMovimientos').checked = usuario.puede_ver_movimientos || false;
    document.getElementById('puedeEditarTablero').checked = usuario.puede_editar_tablero || false;

    
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

// Guardar usuario
async function guardarUsuario(event) {
    event.preventDefault();
    
    const idEditando = usuarioEditando?.id || null;
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
            const { data, error } = await supabaseClient
                .from('usuarios')
                .update({
                    nombre,
                    rol,
                    activo,
                    es_supervisor: document.getElementById('esSupervisor').checked,
                    supervisor_id: (() => {
                        const val = document.getElementById('supervisorId').value;
                        console.log('supervisor_id al guardar:', val);
                        return val || null;
                    })(),
                    puede_ver_monitoreo: document.getElementById('puedeVerMonitoreo').checked,
                    puede_usar_ia: document.getElementById('puedeUsarIA').checked,
                    puede_ver_movimientos: document.getElementById('puedeVerMovimientos').checked,
                    puede_editar_tablero: document.getElementById('puedeEditarTablero').checked,
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
                    es_supervisor: document.getElementById('esSupervisor').checked,
                    supervisor_id: rol === 'operador' ? (document.getElementById('supervisorId').value || null) : null,
                    puede_ver_monitoreo: document.getElementById('puedeVerMonitoreo').checked,
                    puede_usar_ia: document.getElementById('puedeUsarIA').checked,
                    puede_ver_movimientos: document.getElementById('puedeVerMovimientos').checked,
                    puede_editar_tablero: document.getElementById('puedeEditarTablero').checked,
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