// ============================================
// CLIENTES ARCHIVADOS
// ============================================

let clientesArchivados = [];

// Cargar clientes archivados
async function cargarClientesArchivados() {
    try {
        console.log('📦 Cargando clientes archivados...');
        
        // Verificar que sea admin
        await cargarRolUsuario();
        
        if (!esAdministrador()) {
            alert('⚠️ Solo administradores pueden acceder a esta sección');
            window.location.href = './polizas.html';
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('archivado', true)
            .order('archivado_fecha', { ascending: false });
        
        if (error) throw error;
        
        clientesArchivados = data || [];
        console.log(`✅ ${clientesArchivados.length} clientes archivados cargados`);
        
        renderizarTablaArchivados();
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al cargar clientes archivados');
    }
}

// Renderizar tabla
function renderizarTablaArchivados() {
    const tbody = document.getElementById('tablaArchivados');
    
    if (!tbody) return;
    
    if (clientesArchivados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.3;">inventory_2</span>
                    <p>No hay clientes archivados</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    clientesArchivados.forEach(cliente => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cliente.nombres} ${cliente.apellido}</td>
            <td>${cliente.telefono1 || '-'}</td>
            <td>${cliente.email || '-'}</td>
            <td>${cliente.archivado_por || '-'}</td>
            <td>${cliente.archivado_fecha ? new Date(cliente.archivado_fecha).toLocaleDateString('es-ES') : '-'}</td>
            <td>${cliente.motivo_archivo || '-'}</td>
            <td>
                <button class="btn-restaurar" onclick="restaurarCliente('${cliente.id}')">
                    <span class="material-symbols-rounded">unarchive</span>
                    Restaurar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Restaurar cliente
async function restaurarCliente(clienteId) {
    if (!confirm('¿Restaurar este cliente? Volverá a aparecer en la lista principal.')) {
        return;
    }
    
    try {
        const usuarioData = JSON.parse(localStorage.getItem('usuario'));
        
        const { error } = await supabaseClient
            .from('clientes')
            .update({
                archivado: false,
                archivado_por: null,
                archivado_fecha: null,
                motivo_archivo: null,
                restaurado_por: usuarioData?.nombre || 'Admin',
                restaurado_fecha: new Date().toISOString()
            })
            .eq('id', clienteId);
        
        if (error) throw error;
        
        alert('✅ Cliente restaurado exitosamente');
        cargarClientesArchivados();
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al restaurar cliente');
    }
}

// Buscar
function buscarArchivados() {
    const busqueda = document.getElementById('searchArchivados').value.toLowerCase();
    
    if (!busqueda) {
        renderizarTablaArchivados();
        return;
    }
    
    const filtrados = clientesArchivados.filter(c => 
        c.nombres?.toLowerCase().includes(busqueda) ||
        c.apellido?.toLowerCase().includes(busqueda) ||
        c.telefono1?.includes(busqueda) ||
        c.email?.toLowerCase().includes(busqueda)
    );
    
    const tbody = document.getElementById('tablaArchivados');
    tbody.innerHTML = '';
    
    filtrados.forEach(cliente => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cliente.nombres} ${cliente.apellido}</td>
            <td>${cliente.telefono1 || '-'}</td>
            <td>${cliente.email || '-'}</td>
            <td>${cliente.archivado_por || '-'}</td>
            <td>${cliente.archivado_fecha ? new Date(cliente.archivado_fecha).toLocaleDateString('es-ES') : '-'}</td>
            <td>${cliente.motivo_archivo || '-'}</td>
            <td>
                <button class="btn-restaurar" onclick="restaurarCliente('${cliente.id}')">
                    <span class="material-symbols-rounded">unarchive</span>
                    Restaurar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Cargar al iniciar
document.addEventListener('DOMContentLoaded', cargarClientesArchivados);