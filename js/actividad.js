// ============================================
// ACTIVIDAD.JS — Tracking de sesión en tiempo real
// Incluir en todas las páginas protegidas
// ============================================

const INACTIVIDAD_MINUTOS = 5;
const INTERVALO_PING_MS   = 30 * 1000;  // actualizar cada 30 seg
const INTERVALO_CHECK_MS  = 60 * 1000;  // verificar inactividad cada 1 min

let actividadUsuarioId   = null;
let actividadUltimaAccion = Date.now();
let intervaloPing        = null;
let intervaloCheck       = null;

// ── Inicializar al cargar ─────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarActividad();
});

async function inicializarActividad() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data: usuario } = await supabaseClient
            .from('usuarios')
            .select('id, nombre')
            .eq('id', user.id)
            .single();

        if (!usuario) return;

        actividadUsuarioId = usuario.id;

        const pagina = obtenerNombrePagina();

        // Insertar o actualizar registro de sesión
        await supabaseClient
            .from('actividad_sesiones')
            .upsert({
                usuario_id:       usuario.id,
                usuario_nombre:   usuario.nombre,
                pagina_actual:    pagina,
                ultima_actividad: new Date().toISOString(),
                estado:           'activo'
            }, { onConflict: 'usuario_id' });

        // Registrar eventos de actividad
        ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'].forEach(ev => {
            document.addEventListener(ev, registrarAccion, { passive: true });
        });

        document.addEventListener('visibilitychange', async () => {
        if (!actividadUsuarioId) return;

        if (document.hidden) {
            // Cambió de pestaña o minimizó → inactivo
            await supabaseClient
                .from('actividad_sesiones')
                .update({ estado: 'inactivo' })
                .eq('usuario_id', actividadUsuarioId);
        } else {
            // Volvió a la pestaña → activo
            actividadUltimaAccion = Date.now();
            await supabaseClient
                .from('actividad_sesiones')
                .update({
                    estado: 'activo',
                    ultima_actividad: new Date().toISOString(),
                    pagina_actual: obtenerNombrePagina()
                })
                .eq('usuario_id', actividadUsuarioId);
        }
    });

        // Ping periódico para mantener sesión activa
        intervaloPing = setInterval(pingActividad, INTERVALO_PING_MS);

        // Verificar inactividad
        intervaloCheck = setInterval(verificarInactividad, INTERVALO_CHECK_MS);

        // Al cerrar/salir de la página
        window.addEventListener('beforeunload', limpiarSesionActividad);

    } catch (error) {
        console.warn('⚠️ Error inicializando actividad:', error);
    }
}

function registrarAccion() {
    actividadUltimaAccion = Date.now();
}

async function pingActividad() {
    if (!actividadUsuarioId) return;

    const minutosInactivo = (Date.now() - actividadUltimaAccion) / 60000;
    const nuevoEstado = minutosInactivo >= INACTIVIDAD_MINUTOS ? 'inactivo' : 'activo';

    try {

        const updateData = {
            pagina_actual: obtenerNombrePagina(),
            estado: nuevoEstado
        };

        if (nuevoEstado === 'activo') {
            updateData.ultima_actividad = new Date().toISOString();
        }
        await supabaseClient
            .from('actividad_sesiones')
            .update({updateData})
            .eq('usuario_id', actividadUsuarioId);
    } catch (error) {
        console.warn('⚠️ Error en ping actividad:', error);
    }
}

async function verificarInactividad() {
    if (!actividadUsuarioId) return;

    const minutosInactivo = (Date.now() - actividadUltimaAccion) / 60000;

    if (minutosInactivo >= INACTIVIDAD_MINUTOS) {
        try {
            await supabaseClient
                .from('actividad_sesiones')
                .update({ estado: 'inactivo' })
                .eq('usuario_id', actividadUsuarioId);
        } catch (error) {
            console.warn('⚠️ Error marcando inactivo:', error);
        }
    }
}

async function limpiarSesionActividad() {
    if (!actividadUsuarioId) return;
    clearInterval(intervaloPing);
    clearInterval(intervaloCheck);

    // Usar update normal en vez de sendBeacon
    try {
        await supabaseClient
            .from('actividad_sesiones')
            .update({ estado: 'desconectado' })
            .eq('usuario_id', actividadUsuarioId);
    } catch (e) {}
}

function obtenerNombrePagina() {
    const paginas = {
        'home.html':            '🏠 Inicio',
        'polizas.html':         '📋 Pólizas',
        'cliente_crear.html':   '➕ Crear cliente',
        'cliente_editar.html':  '✏️ Editar cliente',
        'cliente_recuperado-cambioDeVida.html': '🔄 Cambio de vida',
        'usuarios.html':        '👥 Usuarios',
        'control_calidad.html': '✅ Control calidad',
        'para-revisar.html':    '🔍 Para revisar',
        'clientes_archivados.html': '📦 Archivados',
        'monitoreo.html':       '📡 Monitoreo',
    };

    const pagina = window.location.pathname.split('/').pop();
    return paginas[pagina] || pagina || 'Página desconocida';
}