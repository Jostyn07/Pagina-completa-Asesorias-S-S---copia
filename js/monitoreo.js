// ============================================
// MONITOREO.JS — Actividad en tiempo real
// ============================================

let sesionesActuales = [];
let canalRealtime = null;

// ── Colores para avatares ─────────────────────
const COLORES_AVATAR = [
    '#6366f1','#22c55e','#f59e0b','#ef4444',
    '#06b6d4','#8b5cf6','#ec4899','#f97316',
    '#10b981','#3b82f6'
];

function colorAvatar(nombre) {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
        hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORES_AVATAR[Math.abs(hash) % COLORES_AVATAR.length];
}

function iniciales(nombre) {
    if (!nombre) return '?';
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length === 1) return partes[0][0].toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// ── Inicializar ───────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await verificarAcceso();
    await cargarSesiones();
    suscribirRealtime();

    setInterval(() => {
        renderizarSesiones();
    }, 10 * 1000);

    console.log(canalRealtime?.state);
});

async function verificarAcceso() {
    try {
        await cargarRolUsuario();

        if (!tienePermiso('ver_monitoreo')) {
            alert('⚠️ No tienes acceso a esta sección');
            window.location.href = '../pages/home.html';
        }
    } catch (error) {
        console.error('Error verificando acceso:', error);
        window.location.href = '../pages/home.html';
    }
}

// ── Cargar sesiones ───────────────────────────
async function cargarSesiones() {
    try {
        // Cargar todos los usuarios activos
        const { data: usuarios } = await supabaseClient
            .from('usuarios')
            .select('id, nombre, rol')
            .eq('activo', true)
            .order('nombre');

        if (datosUsuario?.rol !== 'admin_general') {
            queryUsuarios = queryUsuarios.overlaps('portales', datosUsuario?.portales || []);
        }

        const { data: usuarios } = await queryUsuarios;

        const { data: sesiones } = await supabaseClient
            .from('actividad_sesiones')
            .select('*')
        // Cargar sesiones activas
        const { data: sesiones } = await supabaseClient
            .from('actividad_sesiones')
            .select('*');

        // Cruzar: todos los usuarios con su sesión si existe
        sesionesActuales = (usuarios || []).map(u => {
            const sesion = (sesiones || []).find(s => s.usuario_id === u.id);
            return sesion || {
                usuario_id:       u.id,
                usuario_nombre:   u.nombre,
                pagina_actual:    null,
                ultima_actividad: null,
                estado:           'desconectado'
            };
        });

        renderizarSesiones();

    } catch (error) {
        console.error('❌ Error cargando sesiones:', error);
    }
}

// ── Realtime ──────────────────────────────────
function suscribirRealtime() {
    canalRealtime = supabaseClient
        .channel('actividad_sesiones_cambios')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'actividad_sesiones' },
            (payload) => {
                manejarCambioRealtime(payload);
            }
        )
        .subscribe();
}

function manejarCambioRealtime(payload) {
    const { eventType, new: nuevaSesion, old: sesionVieja } = payload;

    if (eventType === 'INSERT') {
        // Nueva sesión — agregar
        sesionesActuales = sesionesActuales.filter(
            s => s.usuario_id !== nuevaSesion.usuario_id
        );
        sesionesActuales.unshift(nuevaSesion);

    } else if (eventType === 'UPDATE') {
        // Actualizar sesión existente
        const idx = sesionesActuales.findIndex(
            s => s.usuario_id === nuevaSesion.usuario_id
        );
        if (idx >= 0) {
            sesionesActuales[idx] = nuevaSesion;
        } else {
            sesionesActuales.unshift(nuevaSesion);
        }

    } else if (eventType === 'DELETE') {
        sesionesActuales = sesionesActuales.filter(
            s => s.usuario_id !== sesionVieja.usuario_id
        );
    }

    renderizarSesiones();
}

// ── Renderizar ────────────────────────────────
function renderizarSesiones() {
    const grid = document.getElementById('monGrid');
    if (!grid) return;

    // Ordenar: activos primero, luego inactivos, luego desconectados
    const orden = { activo: 0, inactivo: 1, desconectado: 2 };
    const ordenadas = [...sesionesActuales].sort(
        (a, b) => (orden[a.estado] ?? 3) - (orden[b.estado] ?? 3)
    );

    // Actualizar stats
    const activos       = ordenadas.filter(s => s.estado === 'activo').length;
    const inactivos     = ordenadas.filter(s => s.estado === 'inactivo').length;
    const desconectados = ordenadas.filter(s => s.estado === 'desconectado').length;

    document.getElementById('statActivos').textContent       = activos;
    document.getElementById('statInactivos').textContent     = inactivos;
    document.getElementById('statDesconectados').textContent = desconectados;
    document.getElementById('statTotal').textContent         = ordenadas.length;

    if (ordenadas.length === 0) {
        grid.innerHTML = `
            <div class="mon-empty">
                <span class="material-symbols-rounded">wifi_off</span>
                <p>No hay sesiones activas en este momento</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = ordenadas.map(sesion => {
        const color      = colorAvatar(sesion.usuario_nombre || '?');
        const inis       = iniciales(sesion.usuario_nombre || '?');
        const estado     = sesion.estado || 'desconectado';
        const ultimaAct  = new Date(sesion.ultima_actividad);
        const ahoraMs    = Date.now();
        const difMin     = Math.round((ahoraMs - ultimaAct.getTime()) / 60000);

        const tiempoTexto = !sesion.ultima_actividad
            ? 'Sin sesión'
            : difMin < 1
                ? 'Hace menos de 1 min'
                : difMin === 1
                    ? 'Hace 1 min'
                    : `Hace ${difMin} min`;

        const badgeClase  = `mon-badge-${estado}`;
        const dotClase    = `dot-${estado}`;
        const cardClase   = `estado-${estado}`;

        const etiquetaEstado = {
            activo:       'Activo',
            inactivo:     'Inactivo',
            desconectado: 'Desconectado'
        }[estado] || estado;

        return `
            <div class="mon-card ${cardClase}">
                <div class="mon-card-header">
                    <div class="mon-avatar" style="background: ${color}">
                        ${inis}
                    </div>
                    <div class="mon-card-info">
                        <div class="mon-card-nombre">${sesion.usuario_nombre || 'Usuario desconocido'}</div>
                        <span class="mon-badge-estado ${badgeClase}">
                            <span class="dot ${dotClase}"></span>
                            ${etiquetaEstado}
                        </span>
                    </div>
                </div>
                <div class="mon-card-body">
                    <div class="mon-info-row">
                        <span class="material-symbols-rounded">web</span>
                        <span>${sesion.pagina_actual || 'Página desconocida'}</span>
                    </div>
                    <div class="mon-info-row">
                        <span class="material-symbols-rounded">schedule</span>
                        <span>${tiempoTexto}</span>
                    </div>
                    <div class="mon-info-row">
                        <span class="material-symbols-rounded">update</span>
                        <span>${ultimaAct.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Pie de página con última actualización
    const footer = document.getElementById('monFooter');
    if (footer) {
        footer.textContent = `Última actualización: ${new Date().toLocaleTimeString('es-US')}`;
    }
}