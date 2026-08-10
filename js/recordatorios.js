let recordatoriosList = [];
let recordatorioEditandoId = null;
let notificacionesMostradas = new Set(); // evitar duplicados
let intervaloVerificacion = null;
const MINUTOS_GRACIA_VENCIDO = 5;
let usuarioActualCache = null;

function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(valor) {
    return escapeHtml(valor).replace(/`/g, '&#096;');
}

function fechaValida(valor) {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

async function obtenerUsuarioActualRecordatorio() {
    if (usuarioActualCache) return usuarioActualCache;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('id, rol, es_supervisor, puede_ver_monitoreo, supervisor_id, nombre, portales')
        .eq('id', user.id)
        .single();
    if (error) {
        console.error('Error obteniendo usuario actual:', error);
        return null
    }
    usuarioActualCache = data;
    return usuarioActualCache;
}

function recordatorioEstaVencido(recordatorio, ahora = new Date()) {
    const fecha = fechaValida(recordatorio.fecha_recordatorio);
    if (!fecha) return false;
    const fechaVencimiento = new Date(fecha.getTime() + MINUTOS_GRACIA_VENCIDO * 60 * 1000);
    return recordatorio.estado === 'pendiente' && fechaVencimiento < ahora;
}

async function sincronizarRecordatoriosVencidos(recordatorios) {
    const ahora = new Date();
    const vencidos = (recordatorios || []).filter(r => recordatorioEstaVencido(r, ahora));
    if (vencidos.length === 0) return recordatorios || [];

    const idsVencidos = vencidos.map(r => r.id).filter(Boolean);
    if (idsVencidos.length === 0) return recordatorios || [];

    const { error } = await supabaseClient
        .from('recordatorios')
        .update({ estado: 'vencido', updated_at: ahora.toISOString() })
        .in('id', idsVencidos);

    if (error) {
        console.error('Error buscando cliente:', error);
    }

    return (recordatorios || []).map(r =>
        idsVencidos.includes(r.id) ? { ...r, estado: 'vencido' } : r
    );
}

// ── Inicializar al cargar ─────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    inyectarDrawer();
    await cargarRecordatorios();
    verificarNotificaciones();
    intervaloVerificacion = setInterval(async () => {
        await cargarRecordatorios();
        verificarNotificaciones();
    }, 60 * 1000);
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
                <button onclick="solicitarPermisoNotificaciones()">Activar notificaciones</button>                
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
                    <label>¿Para quién es? *</label>
                    <select id="drParaQuien"></select>
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
    
    cerrarFAB()
}

function cerrarDrawerRecordatorios() {
    document.getElementById('drawerRecordatorios').classList.remove('abierto');
}

// ── Cargar recordatorios ──────────────────────
async function cargarRecordatorios() {
    try {
        if (!supabaseClient?.auth) {
            throw new Error('Supabase no esta inicializado');
        }

        const usuarioActual = await obtenerUsuarioActualRecordatorio();
        if (!usuarioActual) throw new Error ('No se encontro el perfil del usuario');

        let query = supabaseClient
            .from('recordatorios')
            .select('*, usuario:usuarios!usuario_id(nombre)')
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
        recordatoriosList = await sincronizarRecordatoriosVencidos(data || []);

        actualizarContadorBadge();
        renderizarRecordatorios(estadoFiltroActual);

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
        const fecha = fechaValida(r.fecha_recordatorio);
        const ahora = new Date();
        const minutos = fecha ? Math.round((fecha - ahora) / 60000) : null;
        let badgeTiempo = '';
        if (r.estado === 'pendiente') {
            if (minutos <= 5 && minutos > 0) badgeTiempo = `<span class="dr-badge-urgente">En ${minutos} min</span>`;
            else if (minutos <= 15 && minutos > 0) badgeTiempo = `<span class="dr-badge-aviso">En ${minutos} min</span>`;
        }

        const fechaTexto = fecha
            ? `${fecha.toLocaleDateString('es-US', { month:'short', day:'numeric' })} ${fecha.toLocaleTimeString('es-US', { hour:'2-digit', minute:'2-digit' })}`
            : 'Fecha invalida';

        return `
            <div class="dr-item dr-estado-${escapeAttr(r.estado)}" data-id="${escapeAttr(r.id)}">
                <div class="dr-item-header">
                    <span class="dr-item-titulo">${escapeHtml(r.titulo)}</span>
                    ${badgeTiempo}
                    <div class="dr-item-acciones">
                        ${r.estado === 'pendiente' ? `
                            <button title="Completar" onclick="cambiarEstadoRecordatorio('${escapeAttr(r.id)}', 'completado')">
                                <span class="material-symbols-rounded">check_circle</span>
                            </button>
                        ` : ''}
                        <button title="Editar" onclick="editarRecordatorio('${escapeAttr(r.id)}')">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button title="Eliminar" onclick="eliminarRecordatorio('${escapeAttr(r.id)}')">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                </div>
                ${r.descripcion ? `<p class="dr-item-desc">${escapeHtml(r.descripcion)}</p>` : ''}
                <div class="dr-item-meta">
                    <span><span class="material-symbols-rounded">schedule</span>
                        ${escapeHtml(fechaTexto)}
                    </span>
                    ${r.cliente_nombre ? `
                        <a href="#" onclick="irAClienteDesdeRecordatorio('${escapeAttr(r.cliente_id)}', event)" class="dr-item-cliente">
                            <span class="material-symbols-rounded">person</span>
                            ${escapeHtml(r.cliente_nombre)}
                        </a>
                    ` : ''}
                    ${r.creado_por_id && r.creado_por_id !== r.usuario_id
                        ? `<span class="dr-item-creado-por">
                            <span class="material-symbols-rounded" style="font-size:0.85rem">supervisor_account</span>
                            De: ${escapeHtml(r.creado_por_nombre || 'Supervisor')}
                        </span>`
                        : (r.usuario?.nombre
                            ? `<span class="dr-item-usuario">${escapeHtml(r.usuario.nombre)}</span>`
                            : '')
                    }
                </div>
                ${renderizarCasillasRespuesta(r)}
            </div>
        `;
    }).join('');
}

function renderizarCasillasRespuesta(r) {
    const miId = usuarioActualCache?.id;
    const esDestinatario = miId && miId === r.usuario_id;
    const esRemitente = miId && miId === r.creado_por_id;

    return `
        <div class="dr-respuestas">
            <div class="dr-respuesta-box">
                <label>Respuesta de quien lo hace</label>
                <textarea
                    ${esDestinatario ? '' : 'disabled'}
                    placeholder="${esDestinatario ? 'Escribe tu respuesta...' : 'Sin respuesta'}"
                    onblur="guardarRespuesta('${escapeAttr(r.id)}', 'destinatario', this.value)"
                >${escapeHtml(r.respuesta_destinatario || '')}</textarea>
            </div>
            <div class="dr-respuesta-box">
                <label>Respuesta de quien lo mandó</label>
                <textarea
                    ${esRemitente ? '' : 'disabled'}
                    placeholder="${esRemitente ? 'Escribe tu respuesta...' : 'Sin respuesta'}"
                    onblur="guardarRespuesta('${escapeAttr(r.id)}', 'remitente', this.value)"
                >${escapeHtml(r.respuesta_remitente || '')}</textarea>
            </div>
        </div>
    `;
}

// Poblar usuarios
async function cargarOpcionesParaQuien(seleccionarId = null) {
    const select = document.getElementById('drParaQuien');
    if (!select) return;

    const usuarioActual = await obtenerUsuarioActualRecordatorio();
    if (!usuarioActual) return;

    let personas = [{ id: usuarioActual.id, nombre: `${usuarioActual.nombre} (yo)`}]

    if (usuarioActual.rol === 'admin_general') {
        const { data } = await supabaseClient
            .from('usuarios')
            .select('id, nombre')
            .eq('activo', true)
            .neq('id', usuarioActual.id)
            .order('nombre');
        personas = personas.concat(data || []);
    } else if (usuarioActual.rol === 'admin') {
        const misPortales = usuarioActual.portales || [];
        const { data } = await supabaseClient
            .from('usuarios')
            .select('id, nombre, portales')
            .eq('activo', true)
            .order('nombre');
        personas = personas.concat(
            (data || []).filter(u => (u.portales || []).some(p => misPortales.includes(p)))
        );
    } else if (usuarioActual.es_supervisor) {
        const { data } = await supabaseClient
            .from('usuarios')
            .select('id, nombre')
            .eq('supervisor_id', usuarioActual.id)
            .eq('activo', true)
            .order('nombre');
        personas = personas.concat(data || []);
    } else {
        const misPortales = usuarioActual.portales || [];
        const { data } = await supabaseClient
            .from('usuarios')
            .select('id, nombre, portales')
            .eq('activo', true)
            .neq('id', usuarioActual.id)
            .order('nombre');
        personas = personas.concat(
            (data || []).filter(u => (u.portales || []).some(p => misPortales.includes(p)))
        );
    }

    select.innerHTML = personas.map(p => 
        `<option value="${escapeAttr(p.id)}">${escapeHtml(p.nombre)}</option>` 
    ).join('');
    
    select.value = seleccionarId || usuarioActual.id
} 

// ── Formulario ────────────────────────────────
async function mostrarFormRecordatorio() {
    recordatorioEditandoId = null;
    document.getElementById('drawerFormTitulo').textContent = 'Nuevo recordatorio';
    document.getElementById('drTitulo').value = '';
    document.getElementById('drDescripcion').value = '';
    document.getElementById('drFecha').value = '';
    limpiarClienteRecordatorio();
    await cargarOpcionesParaQuien()
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
    const paraQuienId = document.getElementById('drParaQuien').value || null;

    if (!titulo || !fecha) {
        alert('⚠️ El título y la fecha son obligatorios');
        return;
    }

    const fechaRecordatorio = fechaValida(fecha);
    if (!fechaRecordatorio) {
        alert('Fecha invalida');
        return;
    }

    try {
        
        const usuarioActual = await obtenerUsuarioActualRecordatorio();
        if (!usuarioActual) throw new Error('No hay una sesion activa');

        const destinatarioId = paraQuienId || usuarioActual.id;

        let portalDestinatario = null;
        if (destinatarioId === usuarioActual.id) {
            portalDestinatario = usuarioActual.portales?.[0] || null
        } else {
            const { data : destinatario } = await supabaseClient
                .from('usuarios')
                .select('portales')
                .eq('id', destinatarioId)
                .single();
            portalDestinatario = destinatario?.portales?.[0] || null;
        }

        const datos = {
            titulo,
            descripcion: descripcion || null,
            fecha_recordatorio: fechaRecordatorio.toISOString(),
            cliente_id: clienteId,
            poliza_id: polizaId,
            cliente_nombre: clienteNombre,
            numero_poliza: numeroPoliza,
            portal: portalDestinatario,
            updated_at: new Date().toISOString()
        };

        if (recordatorioEditandoId) {
            datos.usuario_id = destinatarioId;
            datos.estado = recordatorioEstaVencido({ ...datos, estado: 'pendiente'}) ? 'vencido' : 'pendiente';
            const { error } = await supabaseClient
                .from('recordatorios')
                .update(datos)
                .eq('id', recordatorioEditandoId);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('recordatorios')
                .insert({
                    ...datos,
                    usuario_id: destinatarioId,
                    creado_por_id: usuarioActual.id,
                    creado_por_nombre: usuarioActual.nombre,
                    estado: 'pendiente'
                });
            if (error) throw error;
        }

        cancelarFormRecordatorio();
        await cargarRecordatorios();

    } catch (error) {
        console.error('❌ Error guardando recordatorio:', error);
        alert('Error al guardar: ' + error.message);
    }
}

async function editarRecordatorio(id) {
    const r = recordatoriosList.find(x => x.id === id);
    if (!r) return;

    recordatorioEditandoId = id;
    document.getElementById('drawerFormTitulo').textContent = 'Editar recordatorio';
    document.getElementById('drTitulo').value = r.titulo;
    document.getElementById('drDescripcion').value = r.descripcion || '';
    await cargarOpcionesParaQuien(r.usuario_id);

    // Formatear fecha para datetime-local
    const fecha = fechaValida(r.fecha_recordatorio);
    if (!fecha) {
        alert('Este recordatorio tiene una fecha invalida');
        return;
    }
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
    } else {
        limpiarClienteRecordatorio();
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
async function guardarRespuesta(id, tipo, valor) {
    const campoTexto = tipo === 'destinatario' ? 'respuesta_destinatario' : 'respuesta_remitente';
    const campoFecha = tipo === 'destinatario' ? 'respuesta_destinatario_fecha' : 'respuesta_remitente_fecha';

    const r = recordatoriosList.find(x => x.id === id);
    const valorAnterior = r ? (r[campoTexto] || '') : '';
    if (valor === valorAnterior) return; // sin cambios, no gastamos una escritura

    try {
        const { error } = await supabaseClient
            .from('recordatorios')
            .update({
                [campoTexto]: valor || null,
                [campoFecha]: valor ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        if (r) {
            r[campoTexto] = valor || null;
            r[campoFecha] = valor ? new Date().toISOString() : null;
        }
    } catch (error) {
        console.error('❌ Error guardando respuesta:', error);
        alert('No se pudo guardar la respuesta: ' + error.message);
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
    const textoBusqueda = texto.trim();

    if (textoBusqueda.length < 2) {
        sugerencias.innerHTML = '';
        sugerencias.style.display = 'none';
        return;
    }

    timeoutBusqueda = setTimeout(async () => {
        const termino = textoBusqueda.replace(/[%,]/g, '').trim();
        const usuarioActual = await obtenerUsuarioActualRecordatorio();

        let consulta = supabaseClient
            .from('clientes')
            .select('id, nombres, apellidos, telefono1, polizas(id, numero_poliza)')
            .or(`nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,telefono1.ilike.%${termino}%`)
            .limit(8);

        const esOperadorNormal = usuarioActual &&
            usuarioActual.rol !== 'admin_genral' &&
            usuarioActual.rol !== 'admin' &&
            !usuarioActual.es_supervisor;

        if (esOperadorNormal) {
            consulta = consulta.eq('operador_id', usuarioActual.id);
        }
        const { data, error } = await consulta
        if (error) {
            console.error('âŒ Error buscando cliente:', error);
            sugerencias.innerHTML = '<div class="dr-sug-item dr-sug-empty">Error buscando clientes</div>';
            sugerencias.style.display = 'block';
            return;
        }

        if (!data || data.length === 0) {
            sugerencias.innerHTML = '<div class="dr-sug-item dr-sug-empty">Sin resultados</div>';
            sugerencias.style.display = 'block';
            return;
        }

        sugerencias.innerHTML = data.map(c => {
            const poliza = c.polizas?.[0];
            const nombre = `${c.nombres || ''} ${c.apellidos || ''}`.trim();
            const args = [
                c.id || '',
                nombre,
                poliza?.id || '',
                poliza?.numero_poliza || ''
            ].map(valor => escapeAttr(JSON.stringify(valor)));
            return `
                <div class="dr-sug-item" onclick="seleccionarClienteRecordatorio(${args.join(', ')})" data-cliente-id="${escapeAttr(c.id)}">
                    <span class="material-symbols-rounded">person</span>
                    <div>
                        <strong>${escapeHtml(nombre)}</strong>
                        <small>${escapeHtml(c.telefono1 || '')} ${poliza ? '- ' + escapeHtml(poliza.numero_poliza) : ''}</small>
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

function irAClienteDesdeRecordatorio(clienteId, event) {
    if (!clienteId) return;
    event.preventDefault();
    window.location.href = `../pages/cliente_editar.html?id=${encodeURIComponent(clienteId)}`;
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
            const fecha = fechaValida(r.fecha_recordatorio);
            if (!fecha) return;
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
            <p>${escapeHtml(recordatorio.titulo)}</p>
            ${recordatorio.cliente_nombre ? `<small>${escapeHtml(recordatorio.cliente_nombre)}</small>` : ''}
        </div>
        <button onclick="this.parentElement.remove()">
            <span class="material-symbols-rounded">close</span>
        </button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 10000);
}
