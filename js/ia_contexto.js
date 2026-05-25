// ============================================
// Capa de datos para la IA — filtrada por rol
// ============================================

const CAMPOS_PROHIBIDOS = [
    'numero_cuenta', 'routing_number', 'numero_routing',
    'password', 'token', 'api_key', 'encrypted'
];

const MAX_REGISTROS_IA = {
    admin: 200, supervisor: 100, operador: 50, soporte: 50
};

// ── Sanitizar: quita campos prohibidos ───────
function sanitizarParaIA(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizarParaIA);

    const limpio = {};
    for (const [key, value] of Object.entries(obj)) {
        if (CAMPOS_PROHIBIDOS.some(c => key.toLowerCase().includes(c))) continue;
        limpio[key] = typeof value === 'object' ? sanitizarParaIA(value) : value;
    }
    return limpio;
}

function limitarRegistros(datos, rol) {
    const max = MAX_REGISTROS_IA[rol] || 50;
    if (Array.isArray(datos) && datos.length > max) {
        console.warn(`⚠️ IA: datos truncados a ${max} (rol: ${rol})`);
        return datos.slice(0, max);
    }
    return datos;
}

// ── Pólizas + clientes ────────────────────────
async function obtenerPolizasParaIA(limite) {
    const nivel = obtenerNivelContextoIA();
    if (!nivel) return [];

    const max = limite || MAX_REGISTROS_IA[nivel.rol] || 50;

    try {
        let query = supabaseClient
            .from('polizas')
            .select(`
                id,
                operador_nombre,
                estado_compania,
                estado_mercado,
                estado_documentos,
                compania,
                plan,
                prima,
                fecha_efectividad,
                fecha_vencimiento,
                created_at,
                cliente:clientes (
                    id,
                    nombres,
                    apellidos,
                    fecha_nacimiento,
                    estado_migratorio,
                    tipo_registro,
                    tipo_modificacion,
                    venta_realizada_por,
                    operador_nombre,
                    estado_documentos
                )
            `)
            .limit(max);

        if (nivel.alcance === 'propio') {
            query = query.eq('operador_nombre', nivel.nombre);
        }

        const { data, error } = await query;
        if (error) throw error;

        let resultado = data || [];

        if (nivel.alcance === 'equipo') {
            const { data: equipo } = await supabaseClient
                .from('usuarios')
                .select('nombre')
                .eq('supervisor_id', nivel.usuarioId);

            const nombresEquipo = (equipo || []).map(u => u.nombre);
            resultado = resultado.filter(p => nombresEquipo.includes(p.operador_nombre));
        }

        return sanitizarParaIA(limitarRegistros(resultado, nivel.rol));

    } catch (e) {
        console.error('❌ IA polizas:', e);
        return [];
    }
}

// ── Clientes para listado con links ──────────
// Devuelve estructura plana optimizada para que
// Claude pueda generar bloques <clientes>
async function obtenerClientesParaIA() {
    const polizas = await obtenerPolizasParaIA();

    // Aplanar: una entrada por cliente único
    const mapa = new Map();
    for (const p of polizas) {
        const c = p.cliente;
        if (!c?.id || mapa.has(c.id)) continue;

        const hoy = new Date();
        let cumpleHoy = false;
        let cumpleEstaSemana = false;

        if (c.fecha_nacimiento) {
            const fn  = new Date(c.fecha_nacimiento);
            const cum = new Date(hoy.getFullYear(), fn.getMonth(), fn.getDate());
            const diff = Math.ceil((cum - hoy) / 86400000);
            cumpleHoy        = diff === 0;
            cumpleEstaSemana = diff >= 0 && diff <= 6;
        }

        mapa.set(c.id, {
            id:              c.id,
            nombre:          `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
            operador:        p.operador_nombre || c.operador_nombre,
            compania:        p.compania,
            estado_compania: p.estado_compania,
            estado_docs:     p.estado_documentos || c.estado_documentos,
            tipo_registro:   c.tipo_registro,
            fecha_nacimiento: c.fecha_nacimiento,
            cumple_hoy:      cumpleHoy,
            cumple_semana:   cumpleEstaSemana,
            fecha_efectividad: p.fecha_efectividad,
            fecha_vencimiento: p.fecha_vencimiento,
        });
    }

    return Array.from(mapa.values());
}

// ── Recordatorios ─────────────────────────────
async function obtenerRecordatoriosParaIA() {
    const nivel = obtenerNivelContextoIA();
    if (!nivel) return [];

    try {
        let query = supabaseClient
            .from('recordatorios')
            .select('id, titulo, descripcion, fecha_recordatorio, estado, creado_por, asignado_a')
            .neq('estado', 'eliminado')
            .limit(MAX_REGISTROS_IA[nivel.rol] || 50);

        if (nivel.alcance === 'propio') {
            query = query.or(`creado_por.eq.${nivel.usuarioId},asignado_a.eq.${nivel.usuarioId}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return sanitizarParaIA(data || []);

    } catch (e) {
        console.error('❌ IA recordatorios:', e);
        return [];
    }
}

// ── Estadísticas resumidas ────────────────────
async function obtenerEstadisticasParaIA() {
    const nivel  = obtenerNivelContextoIA();
    if (!nivel) return {};

    try {
        const polizas = await obtenerPolizasParaIA();

        return {
            total:           polizas.length,
            activas:         polizas.filter(p => p.estado_compania === 'Activo').length,
            canceladas:      polizas.filter(p => p.estado_compania === 'Cancelado').length,
            docsIncompletos: polizas.filter(p =>
                p.estado_documentos && p.estado_documentos !== 'Documentos completos'
            ).length,
            porCompania:     agrupar(polizas, p => p.compania),
            porOperador:     nivel.alcance === 'global'
                ? agrupar(polizas, p => p.operador_nombre) : undefined,
            porTipoRegistro: agrupar(polizas, p => p.cliente?.tipo_registro),
        };

    } catch (e) {
        console.error('❌ IA stats:', e);
        return {};
    }
}

function agrupar(arr, fn) {
    return arr.reduce((acc, item) => {
        const key = fn(item) || 'Sin dato';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

// ── Constructor principal de contexto ─────────
async function construirContextoIA(modulo = 'general') {
    const nivel = obtenerNivelContextoIA();
    if (!nivel || !puedeUsarIA()) return null;

    const ahora = new Date().toLocaleString('es-CO', {
        dateStyle: 'full', timeStyle: 'short'
    });

    let datos = {};

    if (['polizas', 'home', 'graficas', 'general'].includes(modulo)) {
        datos.estadisticas = await obtenerEstadisticasParaIA();
        datos.clientes     = await obtenerClientesParaIA();
    }

    if (modulo === 'recordatorios') {
        datos.recordatorios = await obtenerRecordatoriosParaIA();
    }

    if (modulo === 'monitoreo' && nivel.alcance === 'global') {
        datos.sesiones = typeof sesionesActuales !== 'undefined' ? sesionesActuales : [];
    }

    if (['home', 'general', 'polizas'].includes(modulo)) {
        datos.clientes = datos.clientes || await obtenerClientesParaIA();
    }

    return {
        fechaHora: ahora,
        usuario:   { nombre: nivel.nombre, rol: nivel.rol, alcance: nivel.alcance },
        modulo,
        datos,
        _limites: {
            soloLectura:      true,
            maxRegistros:     MAX_REGISTROS_IA[nivel.rol],
            puedeVerUsuarios: nivel.alcance === 'global',
            puedeVerPagos:    nivel.rol !== 'soporte'
        }
    };
}
