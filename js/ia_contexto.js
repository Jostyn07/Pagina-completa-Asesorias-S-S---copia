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
async function obtenerPolizasParaIA(limite = 100) {
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
                estado_documentos,
                documentos_pendientes,
                operador_nombre,
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
                    tipo_modificacion
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
            id:                c.id,
            nombre:            `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
            operador:          p.operador_nombre || c.operador_nombre,
            venta_realizada_por: c.venta_realizada_por,
            compania:          p.compania,
            estado_compania:   p.estado_compania,
            estado_docs:       p.estado_documentos || c.estado_documentos,
            tipo_registro:     c.tipo_registro,
            tipo_modificacion: c.tipo_modificacion,
            fecha_nacimiento:  c.fecha_nacimiento,
            cumple_hoy:        cumpleHoy,
            cumple_semana:     cumpleEstaSemana,
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

// ── Estadísticas reales vía COUNT ─────────────
async function obtenerEstadisticasParaIA() {
    const nivel = obtenerNivelContextoIA();
    if (!nivel) return {};

    try {
        // Filtro base según alcance
        const filtroBase = (q) => {
            if (nivel.alcance === 'propio') {
                return q.eq('operador_nombre', nivel.nombre);
            }
            return q;
        };

        // Total
        const { count: total } = await filtroBase(
            supabaseClient.from('polizas').select('*', { count: 'exact', head: true })
        );

        // Activas
        const { count: activas } = await filtroBase(
            supabaseClient.from('polizas')
                .select('*', { count: 'exact', head: true })
                .eq('estado_compania', 'Activo')
        );

        // Canceladas
        const { count: canceladas } = await filtroBase(
            supabaseClient.from('polizas')
                .select('*', { count: 'exact', head: true })
                .eq('estado_compania', 'Cancelado')
        );

        // Docs incompletos
        const { count: docsIncompletos } = await filtroBase(
            supabaseClient.from('polizas')
                .select('*', { count: 'exact', head: true })
                .neq('estado_documentos', 'Documentos completos')
                .neq('estado_documentos', '-')
        );

        // Por compañía (agrupado real)
        const { data: porCompaniaRaw } = await filtroBase(
            supabaseClient.from('polizas')
                .select('compania')
        );
        const porCompania = agrupar(porCompaniaRaw || [], p => p.compania);

        // Por operador (solo admin/supervisor)
        let porOperador = undefined;
        if (nivel.alcance === 'global') {
            const { data: porOpRaw } = await supabaseClient
                .from('polizas').select('operador_nombre');
            porOperador = agrupar(porOpRaw || [], p => p.operador_nombre);
        }

        // Cumpleaños esta semana
        const hoy = new Date();
        const en7 = new Date(hoy.getTime() + 7 * 86400000);
        // (esto sigue necesitando registros — se calcula en obtenerClientesParaIA)

    return {
        total:            polizas.length,
        activas:          polizas.filter(p => p.estado_compania === 'Activo').length,
        canceladas:       polizas.filter(p => p.estado_compania === 'Cancelado').length,
        docsIncompletos:  polizas.filter(p =>
            p.estado_documentos && p.estado_documentos !== 'Documentos completos'
        ).length,
        recuperadas:      polizas.filter(p =>
            (p.cliente?.tipo_modificacion || '').toLowerCase() === 'recuperada'
        ).length,
        cambiosDeVida:    polizas.filter(p =>
            (p.cliente?.tipo_modificacion || '').toLowerCase() === 'cambio de vida'
        ).length,
        porCompania:      agrupar(polizas, p => p.compania),
        porOperador:      nivel.alcance === 'global'
            ? agrupar(polizas, p => p.operador_nombre) : undefined,
        porTipoRegistro:  agrupar(polizas, p => p.cliente?.tipo_registro),
        porModificacion:  agrupar(polizas, p => p.cliente?.tipo_modificacion),
    };

    } catch (e) {
        console.error('❌ IA stats:', e);
        return {};
    }
}

// ── Estadísticas COMPLETAS sin límite ─────────
async function obtenerEstadisticasCompletasParaIA() {
    const nivel = obtenerNivelContextoIA();
    if (!nivel) return {};

    try {
        let query = supabaseClient
            .from('polizas')
            .select(`
                estado_compania,
                estado_mercado,
                estado_documentos,
                compania,
                operador_nombre,
                fecha_efectividad,
                fecha_vencimiento,
                created_at,
                update_at,
                cliente:clientes (
                    tipo_registro,
                    tipo_modificacion,
                    venta_realizada_por,
                    fecha_nacimiento,
                    archivado
                )
            `);

        if (nivel.alcance === 'propio') {
            query = query.eq('operador_nombre', nivel.nombre);
        }

        const { data, error } = await query;
        if (error) throw error;

        const polizas = (data || []).filter(p => !p.cliente?.archivado);

        // Cumpleaños esta semana
        const hoy          = new Date();
        const en7dias      = new Date(hoy.getTime() + 7 * 86400000);
        const cumpleSemana = polizas.filter(p => {
            const fn = p.cliente?.fecha_nacimiento;
            if (!fn) return false;
            const [y, m, d]  = fn.split('T')[0].split('-');
            const cumple     = new Date(hoy.getFullYear(), parseInt(m) - 1, parseInt(d));
            const diff       = Math.ceil((cumple - hoy) / 86400000);
            return diff >= 0 && diff <= 6;
        });

        // Pólizas próximas a vencer (30 días)
        const en30dias    = new Date(hoy.getTime() + 30 * 86400000);
        const porVencer   = polizas.filter(p => {
            if (!p.fecha_vencimiento) return false;
            const v = new Date(p.fecha_vencimiento);
            return v >= hoy && v <= en30dias;
        });

        return {
            total:              polizas.length,
            activas:            polizas.filter(p => p.estado_compania === 'Activo').length,
            canceladas:         polizas.filter(p => p.estado_compania === 'Cancelado').length,
            docsIncompletos:    polizas.filter(p =>
                p.estado_documentos && p.estado_documentos !== 'Documentos completos'
            ).length,
            recuperadas:        polizas.filter(p =>
                (p.cliente?.tipo_modificacion || '').toLowerCase() === 'recuperada'
            ).length,
            cambiosDeVida:      polizas.filter(p =>
                (p.cliente?.tipo_modificacion || '').toLowerCase() === 'cambio de vida'
            ).length,
            cumpleanosEstaSemana: cumpleSemana.length,
            porVencer30dias:    porVencer.length,
            porCompania:        agrupar(polizas, p => p.compania),
            porOperador:        nivel.alcance === 'global'
                ? agrupar(polizas, p => p.operador_nombre) : undefined,
            porTipoRegistro:    agrupar(polizas, p => p.cliente?.tipo_registro),
            porModificacion:    agrupar(polizas, p => p.cliente?.tipo_modificacion),
            porEstadoCompania:  agrupar(polizas, p => p.estado_compania),
            porEstadoMercado:   agrupar(polizas, p => p.estado_mercado),
        };

    } catch (e) {
        console.error('❌ IA stats completas:', e);
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

    if (['polizas', 'home', 'general'].includes(modulo)) {
        datos.estadisticas = await obtenerEstadisticasCompletasParaIA();
        datos.clientes     = await obtenerClientesParaIA();
    }

    if (modulo === 'recordatorios') {
        datos.recordatorios = await obtenerRecordatoriosParaIA();
    }

    if (modulo === 'monitoreo' && nivel.alcance === 'global') {
        datos.sesiones = typeof sesionesActuales !== 'undefined' ? sesionesActuales : [];
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

// ── System prompt con reglas de seguridad ─────
function construirSystemPromptSeguro(contexto) {
    if (!contexto) return 'Eres un asistente de S&S Asesorías.';

    const { usuario, modulo, datos } = contexto;

    return `Eres un asistente inteligente integrado en S&S Asesorías, una plataforma de gestión de seguros de salud en Estados Unidos.

IDENTIDAD DEL USUARIO:
- Nombre: ${usuario.nombre}
- Rol: ${usuario.rol}
- Alcance: ${
    usuario.alcance === 'global'  ? 'Ve toda la plataforma' :
    usuario.alcance === 'equipo'  ? 'Ve solo su equipo' :
                                    'Ve solo sus propios datos'
}

CAPACIDADES:
Puedes responder CUALQUIER pregunta que el usuario haga, incluyendo:
- Análisis e interpretación de los datos de S&S disponibles en el contexto
- Preguntas generales sobre seguros de salud, Medicare, Medicaid, ACA, planes, deducibles, etc.
- Consejos de gestión, productividad, atención al cliente
- Explicaciones de conceptos del sector
- Redacción de mensajes, emails o comunicaciones
- Cualquier otra consulta que el usuario tenga

LÍMITES ÚNICOS (solo estos):
1. No puedes modificar, insertar ni eliminar datos en la plataforma — eres de solo lectura.
2. No inventes datos ESPECÍFICOS de S&S (nombres de clientes, números de póliza, cifras exactas) que no estén en el contexto. Para datos reales usa solo lo que está abajo.
3. No expongas números de cuenta bancaria, routing ni claves de seguridad.

REGLAS DE RESPUESTA:
- Responde siempre en español, de forma clara y directa.
- Usa **negrita** para resaltar. Usa • para listas. Usa emojis con moderación.
- Si la pregunta es sobre datos de S&S y no están en el contexto, dilo y sugiere dónde encontrarlos.
- Si la pregunta es general (seguros, conceptos, redacción, consejos), responde libremente con tu conocimiento.

MÓDULO ACTIVO: ${modulo}

DATOS DISPONIBLES EN TIEMPO REAL:
${JSON.stringify(datos, null, 2)}`;
}