let recordatoriosList = [];
let recordatorioEditandoId = null;
let notificacionesMostradas = new Set(); // evitar duplicados
let intervaloVerificacion = null;

// ── Inicializar al cargar ─────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    inyectarDrawer();
    await cargarRecordatorios();
    verificarNotificaciones();
    intervaloVerificacion = setInterval(verificarNotificaciones, 5 * 60 * 1000);
});

// ── Inyectar drawer en el DOM ─────────────────
function inyectarDrawer() {
    const drawer = document.createElement('div');
    drawer.id = 'drawerRecordatorios';
    drawer.innerHTML = `
        <div class="drawer-overlay" onclick="cerrarDrawerRecordatorios()"></div>
        <div class="drawer-panel">
            <div class="drawer-header">
                <div class="drawer-header-left">
                    <span class="material-symbols-rounded">task_alt</span>
                    <h2>Recordatorios</h2>
                    <span class="badge-contador" id="badgeDrawer">0</span>
                </div>
                <button class="drawer-close" onclick="cerrarDrawerRecordatorios()">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>

            <!-- FORMULARIO NUEVO/EDITAR -->
            <div class="drawer-form" id="drawerForm">
                <h3 id="drawerFormTitulo">Nuevo recordatorio</h3>
                <div class="form-group-dr">
                    <label>Título *</label>
                    <input type="text" id="drTitulo" placeholder="Ej: Llamar a cliente...">
                </div>
                <div class="form-group-dr">
                    <label>Descripción</label>
                    <textarea id="drDescripcion" rows="2" placeholder="Detalles adicionales..."></textarea>
                </div>
                <div class="form-group-dr">
                    <label>Fecha y hora *</label>
                    <input type="datetime-local" id="drFecha">
                </div>
                <div class="form-group-dr">
                    <label>Vincular cliente (opcional)</label>
                    <input type="text" id="drBuscarCliente" placeholder="Buscar por nombre o teléfono..."
                        oninput="buscarClienteRecordatorio(this.value)" autocomplete="off">
                    <div class="dr-sugerencias" id="drSugerencias"></div>
                    <div class="dr-cliente-seleccionado" id="drClienteSeleccionado" style="display:none">
                        <span id="drClienteNombre"></span>
                        <button type="button" onclick="limpiarClienteRecordatorio()">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <input type="hidden" id="drClienteId">
                    <input type="hidden" id="drPolizaId">
                    <input type="hidden" id="drNombreCliente">
                    <input type="hidden" id="drNumeroPoliza">
                </div>
                <div class="drawer-form-acciones">
                    <button class="btn-dr-secundario" onclick="cancelarFormRecordatorio()">Cancelar</button>
                    <button class="btn-dr-primario" onclick="guardarRecordatorio()">
                        <span class="material-symbols-rounded">save</span>
                        Guardar
                    </button>
                </div>
            </div>

            <!-- LISTA -->
            <div class="drawer-lista-header">
                <div class="dr-tabs">
                    <button class="dr-tab active" onclick="filtrarRecordatoriosPorEstado('pendiente', this)">Pendientes</button>
                    <button class="dr-tab" onclick="filtrarRecordatoriosPorEstado('completado', this)">Completados</button>
                    <button class="dr-tab" onclick="filtrarRecordatoriosPorEstado('vencido', this)">Vencidos</button>
                    <button class="dr-tab" onclick="filtrarRecordatoriosPorEstado('todos', this)">Todos</button>
                </div>
                <button class="btn-dr-nuevo" onclick="mostrarFormRecordatorio()">
                    <span class="material-symbols-rounded">add</span>
                    Nuevo
                </button>
            </div>

            <div class="drawer-lista" id="drawerLista">
                <div class="dr-loading">Cargando...</div>
            </div>
        </div>
    `;
    document.body.appendChild(drawer);

    // Ocultar formulario inicialmente
    document.getElementById('drawerForm').style.display = 'none';
}

// ── Abrir / cerrar drawer ─────────────────────
function abrirDrawerRecordatorios() {
    document.getElementById('drawerRecordatorios').classList.add('abierto');
    filtrarRecordatoriosPorEstado('pendiente',
        document.querySelector('.dr-tab.active'));
}

function cerrarDrawerRecordatorios() {
    document.getElementById('drawerRecordatorios').classList.remove('abierto');
}

// ── Cargar recordatorios ──────────────────────
async function cargarRecordatorios() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data: usuarioActual } = await supabaseClient
            .from('usuarios')
            .select('id, rol, es_supervisor, puede_ver_monitoreo, supervisor_id')
            .eq('id', user.id)
            .single();

        let query = supabaseClient
            .from('recordatorios')
            .select('*, usuario:usuarios(nombre)')
            .order('fecha_recordatorio', { ascending: true });

        // Filtrar según permisos
        if (!usuarioActual.puede_ver_monitoreo) {
            if (usuarioActual.es_supervisor) {
                // Ver los propios + los de sus operadores
                const { data: operadores } = await supabaseClient
                    .from('usuarios')
                    .select('id')
                    .eq('supervisor_id', usuarioActual.id);

                const idsOperadores = (operadores || []).map(o => o.id);
                idsOperadores.push(usuarioActual.id);
                query = query.in('usuario_id', idsOperadores);
            } else {
                // Solo los propios
                query = query.eq('usuario_id', usuarioActual.id);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        // Actualizar estados vencidos
        const ahora = new Date();
        recordatoriosList = (data || []).map(r => {
            if (r.estado === 'pendiente' && new Date(r.fecha_recordatorio) < ahora) {
                return { ...r, estado: 'vencido' };
            }
            return r;
        });

        actualizarContadorBadge();
        renderizarRecordatorios('pendiente');

    } catch (error) {
        console.error('❌ Error cargando recordatorios:', error);
    }
}

// ── Renderizar lista ──────────────────────────
let estadoFiltroActual = 'pendiente';

function filtrarRecordatoriosPorEstado(estado, btn) {
    estadoFiltroActual = estado;
    document.querySelectorAll('.dr-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderizarRecordatorios(estado);
}

function renderizarRecordatorios(estado) {
    const contenedor = document.getElementById('drawerLista');
    if (!contenedor) return;

    const filtrados = estado === 'todos'
        ? recordatoriosList
        : recordatoriosList.filter(r => r.estado === estado);

    if (filtrados.length === 0) {
        contenedor.innerHTML = `
            <div class="dr-empty">
                <span class="material-symbols-rounded">task_alt</span>
                <p>No hay recordatorios ${estado === 'todos' ? '' : estado + 's'}</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = filtrados.map(r => {
        const fecha = new Date(r.fecha_recordatorio);
        const ahora = new Date();
        const minutos = Math.round((fecha - ahora) / 60000);
        let badgeTiempo = '';
        if (r.estado === 'pendiente') {
            if (minutos <= 5 && minutos > 0) badgeTiempo = `<span class="dr-badge-urgente">En ${minutos} min</span>`;
            else if (minutos <= 15 && minutos > 0) badgeTiempo = `<span class="dr-badge-aviso">En ${minutos} min</span>`;
        }

        return `
            <div class="dr-item dr-estado-${r.estado}" data-id="${r.id}">
                <div class="dr-item-header">
                    <span class="dr-item-titulo">${r.titulo}</span>
                    ${badgeTiempo}
                    <div class="dr-item-acciones">
                        ${r.estado === 'pendiente' ? `
                            <button title="Completar" onclick="cambiarEstadoRecordatorio('${r.id}', 'completado')">
                                <span class="material-symbols-rounded">check_circle</span>
                            </button>
                        ` : ''}
                        <button title="Editar" onclick="editarRecordatorio('${r.id}')">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button title="Eliminar" onclick="eliminarRecordatorio('${r.id}')">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                </div>
                ${r.descripcion ? `<p class="dr-item-desc">${r.descripcion}</p>` : ''}
                <div class="dr-item-meta">
                    <span><span class="material-symbols-rounded">schedule</span>
                        ${fecha.toLocaleDateString('es-US', { month:'short', day:'numeric' })}
                        ${fecha.toLocaleTimeString('es-US', { hour:'2-digit', minute:'2-digit' })}
                    </span>
                    ${r.cliente_nombre ? `
                        <a href="#" onclick="irAClienteDesdeRecordatorio('${r.cliente_id}', event)" class="dr-item-cliente">
                            <span class="material-symbols-rounded">person</span>
                            ${r.cliente_nombre}
                        </a>
                    ` : ''}
                    ${r.usuario?.nombre ? `<span class="dr-item-usuario">${r.usuario.nombre}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ── Formulario ────────────────────────────────
function mostrarFormRecordatorio() {
    recordatorioEditandoId = null;
    document.getElementById('drawerFormTitulo').textContent = 'Nuevo recordatorio';
    document.getElementById('drTitulo').value = '';
    document.getElementById('drDescripcion').value = '';
    document.getElementById('drFecha').value = '';
    limpiarClienteRecordatorio();
    document.getElementById('drawerForm').style.display = 'block';
    document.getElementById('drTitulo').focus();
}

function cancelarFormRecordatorio() {
    document.getElementById('drawerForm').style.display = 'none';
    recordatorioEditandoId = null;
}

async function guardarRecordatorio() {
    const titulo = document.getElementById('drTitulo').value.trim();
    const descripcion = document.getElementById('drDescripcion').value.trim();
    const fecha = document.getElementById('drFecha').value;
    const clienteId = document.getElementById('drClienteId').value || null;
    const polizaId = document.getElementById('drPolizaId').value || null;
    const clienteNombre = document.getElementById('drNombreCliente').value || null;
    const numeroPoliza = document.getElementById('drNumeroPoliza').value || null;

    if (!titulo || !fecha) {
        alert('⚠️ El título y la fecha son obligatorios');
        return;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();

        const datos = {
            titulo,
            descripcion: descripcion || null,
            fecha_recordatorio: new Date(fecha).toISOString(),
            cliente_id: clienteId,
            poliza_id: polizaId,
            cliente_nombre: clienteNombre,
            numero_poliza: numeroPoliza,
            updated_at: new Date().toISOString()
        };

        if (recordatorioEditandoId) {
            const { error } = await supabaseClient
                .from('recordatorios')
                .update(datos)
                .eq('id', recordatorioEditandoId);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('recordatorios')
                .insert({ ...datos, usuario_id: user.id, estado: 'pendiente' });
            if (error) throw error;
        }

        cancelarFormRecordatorio();
        await cargarRecordatorios();

    } catch (error) {
        console.error('❌ Error guardando recordatorio:', error);
        alert('Error al guardar: ' + error.message);
    }
}

function editarRecordatorio(id) {
    const r = recordatoriosList.find(x => x.id === id);
    if (!r) return;

    recordatorioEditandoId = id;
    document.getElementById('drawerFormTitulo').textContent = 'Editar recordatorio';
    document.getElementById('drTitulo').value = r.titulo;
    document.getElementById('drDescripcion').value = r.descripcion || '';

    // Formatear fecha para datetime-local
    const fecha = new Date(r.fecha_recordatorio);
    const iso = fecha.getFullYear() + '-' +
        String(fecha.getMonth() + 1).padStart(2, '0') + '-' +
        String(fecha.getDate()).padStart(2, '0') + 'T' +
        String(fecha.getHours()).padStart(2, '0') + ':' +
        String(fecha.getMinutes()).padStart(2, '0');
    document.getElementById('drFecha').value = iso;

    if (r.cliente_nombre) {
        document.getElementById('drClienteId').value = r.cliente_id || '';
        document.getElementById('drPolizaId').value = r.poliza_id || '';
        document.getElementById('drNombreCliente').value = r.cliente_nombre;
        document.getElementById('drNumeroPoliza').value = r.numero_poliza || '';
        document.getElementById('drBuscarCliente').value = r.cliente_nombre;
        document.getElementById('drClienteSeleccionado').style.display = 'flex';
        document.getElementById('drClienteNombre').textContent =
            r.cliente_nombre + (r.numero_poliza ? ` — Póliza ${r.numero_poliza}` : '');
    }

    document.getElementById('drawerForm').style.display = 'block';
    document.getElementById('drTitulo').focus();
}

async function cambiarEstadoRecordatorio(id, nuevoEstado) {
    try {
        const { error } = await supabaseClient
            .from('recordatorios')
            .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
        await cargarRecordatorios();
        renderizarRecordatorios(estadoFiltroActual);
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

async function eliminarRecordatorio(id) {
    if (!confirm('¿Eliminar este recordatorio?')) return;
    try {
        const { error } = await supabaseClient
            .from('recordatorios')
            .delete()
            .eq('id', id);
        if (error) throw error;
        await cargarRecordatorios();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// ── Búsqueda de cliente ───────────────────────
let timeoutBusqueda;
async function buscarClienteRecordatorio(texto) {
    clearTimeout(timeoutBusqueda);
    const sugerencias = document.getElementById('drSugerencias');

    if (texto.length < 2) {
        sugerencias.innerHTML = '';
        sugerencias.style.display = 'none';
        return;
    }

    timeoutBusqueda = setTimeout(async () => {
        const { data } = await supabaseClient
            .from('clientes')
            .select('id, nombres, apellidos, telefono1, polizas(id, numero_poliza)')
            .or(`nombres.ilike.%${texto}%,apellidos.ilike.%${texto}%,telefono1.ilike.%${texto}%`)
            .limit(8);

        if (!data || data.length === 0) {
            sugerencias.innerHTML = '<div class="dr-sug-item dr-sug-empty">Sin resultados</div>';
            sugerencias.style.display = 'block';
            return;
        }

        sugerencias.innerHTML = data.map(c => {
            const poliza = c.polizas?.[0];
            return `
                <div class="dr-sug-item" onclick="seleccionarClienteRecordatorio(
                    '${c.id}',
                    '${c.nombres} ${c.apellidos}',
                    '${poliza?.id || ''}',
                    '${poliza?.numero_poliza || ''}'
                )">
                    <span class="material-symbols-rounded">person</span>
                    <div>
                        <strong>${c.nombres} ${c.apellidos}</strong>
                        <small>${c.telefono1 || ''} ${poliza ? '— ' + poliza.numero_poliza : ''}</small>
                    </div>
                </div>
            `;
        }).join('');
        sugerencias.style.display = 'block';
    }, 300);
}

function seleccionarClienteRecordatorio(clienteId, nombre, polizaId, numeroPoliza) {
    document.getElementById('drClienteId').value = clienteId;
    document.getElementById('drPolizaId').value = polizaId;
    document.getElementById('drNombreCliente').value = nombre;
    document.getElementById('drNumeroPoliza').value = numeroPoliza;
    document.getElementById('drBuscarCliente').value = nombre;
    document.getElementById('drClienteNombre').textContent =
        nombre + (numeroPoliza ? ` — Póliza ${numeroPoliza}` : '');
    document.getElementById('drClienteSeleccionado').style.display = 'flex';
    document.getElementById('drSugerencias').style.display = 'none';
}

function limpiarClienteRecordatorio() {
    document.getElementById('drClienteId').value = '';
    document.getElementById('drPolizaId').value = '';
    document.getElementById('drNombreCliente').value = '';
    document.getElementById('drNumeroPoliza').value = '';
    document.getElementById('drBuscarCliente').value = '';
    document.getElementById('drClienteSeleccionado').style.display = 'none';
    document.getElementById('drSugerencias').style.display = 'none';
}

function irAClienteDesdeRecordatorio(polizaId, event) {
    if (!polizaId) return;
    event.preventDefault();
    sessionStorage.setItem('filtro_poliza_id', polizaId);
    window.location.href = `../pages/cliente_editar.html?id=${polizaId}`;
}

// ── Contador badge ────────────────────────────
function actualizarContadorBadge() {
    const pendientes = recordatoriosList.filter(r => r.estado === 'pendiente').length;

    // Badge en el sidebar
    const badge = document.getElementById('badgeRecordatorios');
    if (badge) {
        badge.textContent = pendientes;
        badge.style.display = pendientes > 0 ? 'flex' : 'none';
    }

    // Badge en el drawer
    const badgeDrawer = document.getElementById('badgeDrawer');
    if (badgeDrawer) badgeDrawer.textContent = pendientes;

    // Badge en home
    const badgeHome = document.getElementById('contadorRecordatorios');
    if (badgeHome) badgeHome.textContent = pendientes;
}

// ── Notificaciones ────────────────────────────
function verificarNotificaciones() {
    const ahora = new Date();

    recordatoriosList
        .filter(r => r.estado === 'pendiente')
        .forEach(r => {
            const fecha = new Date(r.fecha_recordatorio);
            const minutos = Math.round((fecha - ahora) / 60000);
            const key5  = `${r.id}-5`;
            const key15 = `${r.id}-15`;

            if (minutos > 0 && minutos <= 5 && !notificacionesMostradas.has(key5)) {
                notificacionesMostradas.add(key5);
                mostrarToastRecordatorio(r, minutos, 'urgente');
            } else if (minutos > 5 && minutos <= 15 && !notificacionesMostradas.has(key15)) {
                notificacionesMostradas.add(key15);
                mostrarToastRecordatorio(r, minutos, 'aviso');
            }
        });
}

function mostrarToastRecordatorio(recordatorio, minutos, tipo) {
    const toast = document.createElement('div');
    toast.className = `dr-toast dr-toast-${tipo}`;
    toast.innerHTML = `
        <span class="material-symbols-rounded">${tipo === 'urgente' ? 'alarm' : 'notifications'}</span>
        <div>
            <strong>${tipo === 'urgente' ? '⚡ ' : '🔔 '}En ${minutos} min</strong>
            <p>${recordatorio.titulo}</p>
            ${recordatorio.cliente_nombre ? `<small>${recordatorio.cliente_nombre}</small>` : ''}
        </div>
        <button onclick="this.parentElement.remove()">
            <span class="material-symbols-rounded">close</span>
        </button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 10000);
}