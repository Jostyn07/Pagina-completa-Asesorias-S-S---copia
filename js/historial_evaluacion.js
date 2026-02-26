// ============================================
// VARIABLES GLOBALES
// ============================================
let usuarioActual = null;
let todasEvaluaciones = [];
let evaluacionesFiltradas = [];

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    ;
    
    // Obtener usuario actual
    usuarioActual = obtenerUsuario();
    
    if (!usuarioActual) {
        console.error('❌ No hay usuario autenticado');
        window.location.href = './login.html';
        return;
    }
    
    // Verificar permisos y ajustar interfaz
    verificarPermisosYAjustarUI();
    
    // Cargar evaluaciones
    await cargarEvaluaciones();
    
    ;
});

// ============================================
// VERIFICAR PERMISOS Y AJUSTAR UI
// ============================================
function verificarPermisosYAjustarUI() {
    const esAdmin = usuarioActual.rol === 'admin' || usuarioActual.rol === 'supervisor';
    
    const headerTitle = document.getElementById('headerTitle');
    const headerSubtitle = document.getElementById('headerSubtitle');
    const adminActions = document.getElementById('adminActions');
    const filtroOperadorContainer = document.getElementById('filtroOperador');
    
    if (esAdmin) {
        // Admins ven todas las evaluaciones
        headerTitle.textContent = 'Evaluaciones de Calidad';
        headerSubtitle.textContent = 'Historial completo de todas las evaluaciones realizadas';
        
        // Mostrar controles de admin
        if (adminActions) {
            adminActions.style.display = 'flex';
        }
        
        // Cargar lista de operadores en el filtro
        cargarOperadoresFiltro();
    } else {
        // Operadores solo ven sus propias evaluaciones
        headerTitle.textContent = 'Mis Evaluaciones';
        headerSubtitle.textContent = 'Historial de mis evaluaciones de desempeño';
        
        // Ocultar controles de admin
        if (adminActions) {
            adminActions.style.display = 'none';
        }
    }
}

// ============================================
// CARGAR OPERADORES PARA FILTRO (SOLO ADMINS)
// ============================================
async function cargarOperadoresFiltro() {
    try {
        // TODO: Cargar desde Supabase usuarios con rol='operador'
        // Por ahora usar datos de ejemplo
        const operadores = [
            { id: 1, nombre: 'Jostyn Aragón' },
            { id: 2, nombre: 'Ana Martínez' },
            { id: 3, nombre: 'Joel Nieves' }
        ];
        
        const select = document.getElementById('filtroOperador');
        operadores.forEach(op => {
            const option = document.createElement('option');
            option.value = op.id;
            option.textContent = op.nombre;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar operadores:', error);
    }
}

// ============================================
// CARGAR EVALUACIONES
// ============================================
async function cargarEvaluaciones() {
    try {
        ;
        
        let query = supabaseClient
            .from('evaluaciones_calidad')
            .select('*')
            .order('fecha_evaluacion', { ascending: false });
        
        // Si NO es admin, solo cargar evaluaciones propias
        const esAdmin = usuarioActual.rol === 'admin' || usuarioActual.rol === 'supervisor';
        if (!esAdmin) {
            query = query.eq('asesor_id', usuarioActual.id);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.warn('⚠️ Error al cargar evaluaciones:', error);
            // Usar datos de ejemplo si hay error
            todasEvaluaciones = obtenerEvaluacionesEjemplo();
        } else {
            todasEvaluaciones = data || [];
        }
        
        evaluacionesFiltradas = [...todasEvaluaciones];
        
        ;
        
        // Renderizar evaluaciones
        renderizarEvaluaciones();
        
        // Actualizar estadísticas
        actualizarEstadisticas();
        
    } catch (error) {
        console.error('❌ Error al cargar evaluaciones:', error);
        // Usar datos de ejemplo en caso de error
        todasEvaluaciones = obtenerEvaluacionesEjemplo();
        evaluacionesFiltradas = [...todasEvaluaciones];
        renderizarEvaluaciones();
        actualizarEstadisticas();
    }
}

// ============================================
// DATOS DE EJEMPLO
// ============================================
function obtenerEvaluacionesEjemplo() {
    const esAdmin = usuarioActual.rol === 'admin' || usuarioActual.rol === 'supervisor';
    
    const todasLasEvaluaciones = [
        {
            id: 1,
            fecha_evaluacion: '2024-12-15',
            evaluador: 'Supervisor Principal',
            asesor_nombre: 'Jostyn Aragón',
            asesor_id: 1,
            cliente_id_venta: 'CLI-12345',
            canal: 'Teléfono',
            duracion_audio: '05:30',
            resultado: 'approved',
            checklist_presentacion: 'Sí',
            checklist_identificacion: 'Sí',
            checklist_explicacion: 'Sí',
            checklist_condiciones: 'Sí',
            checklist_consentimiento: 'Sí',
            checklist_cierre: 'Sí',
            checklist_lenguaje: 'Sí',
            errores_criticos: [],
            hecho_observado: 'Excelente manejo de objeciones y claridad en la explicación de beneficios.',
            impacto: 'Cliente quedó muy satisfecho y completó la venta sin dudas.',
            accion_esperada: 'Continuar con esta metodología y compartir técnicas con el equipo.',
            buenas_practicas: 'Uso efectivo de pausa para dejar pensar al cliente.',
            seguimiento: ['Capacitación'],
            conclusion: 'Venta aprobada con reconocimiento por excelente desempeño.',
            autor_nombre: 'Supervisor Principal',
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            fecha_evaluacion: '2024-12-14',
            evaluador: 'Supervisor Principal',
            asesor_nombre: 'Jostyn Aragón',
            asesor_id: 1,
            cliente_id_venta: 'CLI-12346',
            canal: 'Videollamada',
            duracion_audio: '08:15',
            resultado: 'rejected',
            checklist_presentacion: 'Sí',
            checklist_identificacion: 'Sí',
            checklist_explicacion: 'No',
            checklist_condiciones: 'Parcial',
            checklist_consentimiento: 'Sí',
            checklist_cierre: 'No',
            checklist_lenguaje: 'Sí',
            errores_criticos: ['No explicó correctamente las condiciones de renovación', 'Omitió el proceso de cancelación'],
            minuto_error: '04:30',
            descripcion_error: 'No mencionó el período de renovación automática ni el proceso de cancelación',
            hecho_observado: 'Faltó claridad en explicación de términos y condiciones.',
            impacto: 'Cliente podría tener confusión posterior sobre renovación.',
            accion_esperada: 'Revisar script de condiciones y practicar explicación completa.',
            seguimiento: ['Capacitación', 'Revisión en 1 semana'],
            conclusion: 'Venta rechazada por omisión de información crítica. Requiere refuerzo en capacitación.',
            autor_nombre: 'Supervisor Principal',
            created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: 3,
            fecha_evaluacion: '2024-12-13',
            evaluador: 'Supervisor Principal',
            asesor_nombre: 'Ana Martínez',
            asesor_id: 2,
            cliente_id_venta: 'CLI-12347',
            canal: 'Teléfono',
            duracion_audio: '06:45',
            resultado: 'approved',
            checklist_presentacion: 'Sí',
            checklist_identificacion: 'Sí',
            checklist_explicacion: 'Sí',
            checklist_condiciones: 'Sí',
            checklist_consentimiento: 'Sí',
            checklist_cierre: 'Sí',
            checklist_lenguaje: 'Sí',
            errores_criticos: [],
            hecho_observado: 'Presentación clara y completa de todos los puntos requeridos.',
            impacto: 'Venta exitosa con cliente satisfecho.',
            accion_esperada: 'Mantener el nivel de calidad actual.',
            buenas_practicas: 'Excelente rapport con el cliente.',
            seguimiento: [],
            conclusion: 'Venta aprobada sin observaciones.',
            autor_nombre: 'Supervisor Principal',
            created_at: new Date(Date.now() - 172800000).toISOString()
        }
    ];
    
    // Si NO es admin, filtrar solo las del usuario actual
    if (!esAdmin) {
        return todasLasEvaluaciones.filter(ev => ev.asesor_id === usuarioActual.id);
    }
    
    return todasLasEvaluaciones;
}

// ============================================
// RENDERIZAR EVALUACIONES
// ============================================
function renderizarEvaluaciones() {
    const container = document.getElementById('evaluacionesList');
    const counter = document.getElementById('evaluacionesCount');
    
    // Actualizar contador
    counter.textContent = `(${evaluacionesFiltradas.length})`;
    
    // Limpiar container
    container.innerHTML = '';
    
    if (evaluacionesFiltradas.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No hay evaluaciones registradas</p>
                <small>Las evaluaciones aparecerán aquí cuando sean creadas</small>
            </div>
        `;
        return;
    }
    
    // Renderizar cada evaluación
    evaluacionesFiltradas.forEach(evaluacion => {
        const evaluacionHTML = crearEvaluacionHTML(evaluacion);
        container.insertAdjacentHTML('beforeend', evaluacionHTML);
    });
}

// ============================================
// CREAR HTML DE EVALUACIÓN
// ============================================
function crearEvaluacionHTML(evaluacion) {
    const resultado = evaluacion.resultado;
    const esAprobada = resultado === 'approved';
    const claseResultado = esAprobada ? 'approved' : 'rejected';
    const textoResultado = esAprobada ? 'Aprobada' : 'Rechazada';
    const iconoResultado = esAprobada ? 'check_circle' : 'cancel';
    
    const fecha = new Date(evaluacion.fecha_evaluacion);
    const fechaFormateada = fecha.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Contar items del checklist completados
    const checklistItems = [
        evaluacion.checklist_presentacion,
        evaluacion.checklist_identificacion,
        evaluacion.checklist_explicacion,
        evaluacion.checklist_condiciones,
        evaluacion.checklist_consentimiento,
        evaluacion.checklist_cierre,
        evaluacion.checklist_lenguaje
    ];
    const completados = checklistItems.filter(item => item === 'Sí').length;
    const total = checklistItems.length;
    
    return `
        <div class="evaluacion-card ${claseResultado}" onclick="verDetalleEvaluacion('${evaluacion.id}')">
            <div class="evaluacion-header">
                <div class="evaluacion-info">
                    <h3>${evaluacion.asesor_nombre}</h3>
                    <p>Evaluado por: ${evaluacion.evaluador}</p>
                </div>
                <div class="evaluacion-badge ${claseResultado}">
                    <i class="material-symbols-rounded">${iconoResultado}</i>
                    ${textoResultado}
                </div>
            </div>
            
            <div class="evaluacion-body">
                <div class="evaluacion-row">
                    <div class="evaluacion-item">
                        <label>Fecha</label>
                        <span>${fechaFormateada}</span>
                    </div>
                    <div class="evaluacion-item">
                        <label>Canal</label>
                        <span>${evaluacion.canal}</span>
                    </div>
                    <div class="evaluacion-item">
                        <label>ID Venta</label>
                        <span>${evaluacion.cliente_id_venta}</span>
                    </div>
                    <div class="evaluacion-item">
                        <label>Checklist</label>
                        <span>${completados}/${total} completados</span>
                    </div>
                </div>
                
                ${evaluacion.errores_criticos && evaluacion.errores_criticos.length > 0 ? `
                    <div class="evaluacion-errores">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>${evaluacion.errores_criticos.length} error(es) crítico(s) identificado(s)</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="evaluacion-footer">
                <span class="evaluacion-fecha">
                    <i class="far fa-clock"></i>
                    ${formatearFechaRelativa(fecha)}
                </span>
                <span class="evaluacion-autor">
                    <i class="far fa-user"></i>
                    ${evaluacion.autor_nombre || evaluacion.evaluador}
                </span>
            </div>
        </div>
    `;
}

// ============================================
// VER DETALLE DE EVALUACIÓN
// ============================================
function verDetalleEvaluacion(evaluacionId) {
    const evaluacion = todasEvaluaciones.find(ev => ev.id === evaluacionId);
    
    if (!evaluacion) {
        alert('Evaluación no encontrada');
        return;
    }
    
    const esAprobada = evaluacion.resultado === 'approved';
    const claseResultado = esAprobada ? 'approved' : 'rejected';
    const textoResultado = esAprobada ? 'Aprobada' : 'Rechazada';
    
    const contenido = `
        <div class="detalle-section">
            <h3>
                <i class="fas fa-info-circle"></i>
                Información General
            </h3>
            <div class="detalle-grid">
                <div class="detalle-item">
                    <label>Asesor</label>
                    <p><strong>${evaluacion.asesor_nombre}</strong></p>
                </div>
                <div class="detalle-item">
                    <label>Fecha Evaluación</label>
                    <p>${new Date(evaluacion.fecha_evaluacion).toLocaleDateString('es-ES')}</p>
                </div>
                <div class="detalle-item">
                    <label>Evaluador</label>
                    <p>${evaluacion.evaluador}</p>
                </div>
                <div class="detalle-item">
                    <label>ID Cliente/Venta</label>
                    <p>${evaluacion.cliente_id_venta}</p>
                </div>
                <div class="detalle-item">
                    <label>Canal</label>
                    <p>${evaluacion.canal}</p>
                </div>
                <div class="detalle-item">
                    <label>Duración Audio</label>
                    <p>${evaluacion.duracion_audio || 'N/A'}</p>
                </div>
                <div class="detalle-item full-width">
                    <label>Resultado</label>
                    <p class="resultado-badge ${claseResultado}">
                        <strong>${textoResultado}</strong>
                    </p>
                </div>
            </div>
        </div>
        
        <div class="detalle-section">
            <h3>
                <i class="fas fa-check-square"></i>
                Checklist de Cumplimiento
            </h3>
            <div class="detalle-grid">
                <div class="detalle-item">
                    <label>Presentación</label>
                    <p>${evaluacion.checklist_presentacion || 'N/A'}</p>
                </div>
                <div class="detalle-item">
                    <label>Identificación</label>
                    <p>${evaluacion.checklist_identificacion || 'N/A'}</p>
                </div>
                <div class="detalle-item">
                    <label>Explicación Producto</label>
                    <p>${evaluacion.checklist_explicacion || 'N/A'}</p>
                </div>
                <div class="detalle-item">
                    <label>Condiciones</label>
                    <p>${evaluacion.checklist_condiciones || 'N/A'}</p>
                </div>
                <div class="detalle-item">
                    <label>Consentimiento</label>
                    <p>${evaluacion.checklist_consentimiento || 'N/A'}</p>
                </div>
                <div class="detalle-item">
                    <label>Cierre</label>
                    <p>${evaluacion.checklist_cierre || 'N/A'}</p>
                </div>
                <div class="detalle-item">
                    <label>Lenguaje</label>
                    <p>${evaluacion.checklist_lenguaje || 'N/A'}</p>
                </div>
            </div>
        </div>
        
        ${evaluacion.errores_criticos && evaluacion.errores_criticos.length > 0 ? `
        <div class="detalle-section">
            <h3>
                <i class="fas fa-exclamation-triangle"></i>
                Errores Críticos
            </h3>
            <div class="detalle-grid">
                <div class="detalle-item full-width">
                    <label>Errores Identificados</label>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        ${evaluacion.errores_criticos.map(error => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
                ${evaluacion.minuto_error ? `
                <div class="detalle-item">
                    <label>Minuto del Error</label>
                    <p>${evaluacion.minuto_error}</p>
                </div>
                ` : ''}
                ${evaluacion.descripcion_error ? `
                <div class="detalle-item full-width">
                    <label>Descripción del Error</label>
                    <p>${evaluacion.descripcion_error}</p>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}
        
        <div class="detalle-section">
            <h3>
                <i class="fas fa-comments"></i>
                Feedback Detallado
            </h3>
            <div class="detalle-grid">
                <div class="detalle-item full-width">
                    <label>Hecho Observado</label>
                    <p style="line-height: 1.6;">${evaluacion.hecho_observado}</p>
                </div>
                <div class="detalle-item full-width">
                    <label>Impacto</label>
                    <p style="line-height: 1.6;">${evaluacion.impacto}</p>
                </div>
                <div class="detalle-item full-width">
                    <label>Acción Esperada</label>
                    <p style="line-height: 1.6;">${evaluacion.accion_esperada}</p>
                </div>
                ${evaluacion.buenas_practicas ? `
                <div class="detalle-item full-width">
                    <label>Buenas Prácticas</label>
                    <p style="line-height: 1.6;">${evaluacion.buenas_practicas}</p>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${evaluacion.seguimiento && evaluacion.seguimiento.length > 0 ? `
        <div class="detalle-section">
            <h3>
                <i class="fas fa-tasks"></i>
                Seguimiento
            </h3>
            <div class="detalle-grid">
                <div class="detalle-item full-width">
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        ${evaluacion.seguimiento.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
        ` : ''}
        
        ${evaluacion.conclusion ? `
        <div class="detalle-section">
            <h3>
                <i class="fas fa-clipboard-check"></i>
                Conclusión
            </h3>
            <div class="detalle-grid">
                <div class="detalle-item full-width">
                    <p style="line-height: 1.6;">${evaluacion.conclusion}</p>
                </div>
            </div>
        </div>
        ` : ''}
    `;
    
    document.getElementById('detalleEvaluacion').innerHTML = contenido;
    document.getElementById('modalDetalle').classList.add('show');
    document.body.style.overflow = 'hidden';
}

// ============================================
// CERRAR MODAL
// ============================================
function cerrarModalDetalle() {
    document.getElementById('modalDetalle').classList.remove('show');
    document.body.style.overflow = 'auto';
}

// ============================================
// ACTUALIZAR ESTADÍSTICAS
// ============================================
function actualizarEstadisticas() {
    const total = todasEvaluaciones.length;
    const aprobadas = todasEvaluaciones.filter(ev => ev.resultado === 'approved').length;
    const rechazadas = todasEvaluaciones.filter(ev => ev.resultado === 'rejected').length;
    const porcentaje = total > 0 ? Math.round((aprobadas / total) * 100) : 0;
    
    document.getElementById('totalAprobadas').textContent = aprobadas;
    document.getElementById('totalRechazadas').textContent = rechazadas;
    document.getElementById('totalEvaluaciones').textContent = total;
    document.getElementById('porcentajeAprobacion').textContent = `${porcentaje}%`;
}

// ============================================
// FILTROS
// ============================================
function aplicarFiltros() {
    const resultado = document.getElementById('filtroResultado').value;
    const periodo = document.getElementById('filtroPeriodo').value;
    const operadorId = document.getElementById('filtroOperador')?.value;
    
    evaluacionesFiltradas = todasEvaluaciones.filter(evaluacion => {
        // Filtrar por resultado
        if (resultado && evaluacion.resultado !== resultado) {
            return false;
        }
        
        // Filtrar por operador (solo para admins)
        if (operadorId && evaluacion.asesor_id !== parseInt(operadorId)) {
            return false;
        }
        
        // Filtrar por período
        if (periodo !== 'todos') {
            const fechaEval = new Date(evaluacion.fecha_evaluacion);
            const ahora = new Date();
            const diff = ahora - fechaEval;
            const dias = diff / (1000 * 60 * 60 * 24);
            
            if (periodo === 'mes' && dias > 30) return false;
            if (periodo === 'trimestre' && dias > 90) return false;
            if (periodo === 'año' && dias > 365) return false;
        }
        
        return true;
    });
    
    renderizarEvaluaciones();
}

function limpiarFiltros() {
    document.getElementById('filtroResultado').value = '';
    document.getElementById('filtroPeriodo').value = 'todos';
    
    const filtroOperador = document.getElementById('filtroOperador');
    if (filtroOperador) {
        filtroOperador.value = '';
    }
    
    evaluacionesFiltradas = [...todasEvaluaciones];
    renderizarEvaluaciones();
}

// ============================================
// UTILIDADES
// ============================================
function formatearFechaRelativa(fecha) {
    const ahora = new Date();
    const diff = ahora - fecha;
    const segundos = Math.floor(diff / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    
    if (dias > 7) {
        return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } else if (dias > 0) {
        return `Hace ${dias} día${dias > 1 ? 's' : ''}`;
    } else if (horas > 0) {
        return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
    } else if (minutos > 0) {
        return `Hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
    } else {
        return 'Hace un momento';
    }
}

// ============================================
// LOG DE DESARROLLO
// ============================================
;
;
;
;
;
;
;