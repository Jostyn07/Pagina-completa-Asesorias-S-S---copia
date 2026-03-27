// ============================================
// CLIENTES ARCHIVADOS
// ============================================

let clientesArchivados = [];

// Cargar clientes archivados
async function cargarClientesArchivados() {
    try {
        ;
        
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
        ;
        
        renderizarTablaArchivados();
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al cargar clientes archivados');
    }
}

// Renderizar tabla
function renderizarTablaArchivados(lista = clientesArchivados) {
    const contenedor = document.getElementById('tablaArchivados');
    const contador = document.getElementById('contadorArchivados');

    if (contador) contador.textContent = `${lista.length} cliente${lista.length !== 1 ? 's' : ''}`;

    if (!contenedor) return;

    if (lista.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">inventory_2</span>
                <p>No hay clientes archivados</p>
            </div>`;
        return;
    }

    contenedor.innerHTML = lista.map(cliente => {
        const nombre = `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim();
        const iniciales = nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
        const fecha = cliente.archivado_fecha
            ? new Date(cliente.archivado_fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
            : '-';

        return `
        <div class="card-archivado">
            <div class="card-top">
                <div class="card-avatar">${iniciales}</div>
                <div>
                    <div class="card-nombre">
                        <a href="./cliente_editar.html?id=${cliente.id}&modo=ver" style="text-decoration:none; color:inherit; cursor:pointer;">
                            ${nombre}
                        </a>
                    </div>
                    <div class="card-email">${cliente.email || '-'}</div>
                </div>
            </div>
            <div class="card-details">
                <div class="card-detail-item">
                    <label>Teléfono</label>
                    <span>${cliente.telefono1 || '-'}</span>
                </div>
                <div class="card-detail-item">
                    <label>Archivado por</label>
                    <span>${cliente.archivado_por || '-'}</span>
                </div>
                <div class="card-detail-item">
                    <label>Fecha</label>
                    <span>${fecha}</span>
                </div>
            </div>
            ${cliente.motivo_archivo ? `
            <div class="card-motivo">
                <span class="material-symbols-rounded">info</span>
                ${cliente.motivo_archivo}
            </div>` : ''}
            <div class="card-footer">
                <button class="btn-restaurar" onclick="restaurarCliente('${cliente.id}')">
                    <span class="material-symbols-rounded">unarchive</span>
                    Restaurar
                </button>
            </div>
        </div>`;
    }).join('');
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
    const filtrados = !busqueda ? clientesArchivados : clientesArchivados.filter(c =>
        c.nombres?.toLowerCase().includes(busqueda) ||
        c.apellidos?.toLowerCase().includes(busqueda) ||
        c.telefono1?.includes(busqueda) ||
        c.email?.toLowerCase().includes(busqueda)
    );
    renderizarTablaArchivados(filtrados);
}

// Cargar al iniciar
document.addEventListener('DOMContentLoaded', cargarClientesArchivados);