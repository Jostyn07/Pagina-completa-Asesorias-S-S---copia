// ============================================
// VARIABLES GLOBALES
// ============================================
let autoguardadoTimer = null;
const AUTOSAVE_DELAY = 30000; // 30 segundos

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    await cargarRolUsuario();
    
    if (!datosUsuario) {
        console.error('❌ No hay usuario autenticado');
        window.location.href = './login.html';
        return;
    }
    
    // Verificar que sea admin o supervisor
   if (!tienePermiso('acceso_control_calidad')) {
        alert('⚠️ No tienes permisos para acceder a esta página');
        window.location.href = './home.html';
        return;
    }
    
    // Inicializar fecha actual
    const fechaInput = document.getElementById('fechaEvaluacion');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Cargar nombre del evaluador
    const evaluadorInput = document.getElementById('evaluador');
    if (evaluadorInput && datosUsuario.nombre) {
        evaluadorInput.value = datosUsuario.nombre;
    }
    
    // Intentar cargar borrador guardado
    cargarBorrador();
    
    // Configurar eventos del formulario
    configurarEventos();
    
    // Iniciar autoguardado
    iniciarAutoguardado();
    
    ;
});

// ============================================
// CONFIGURAR EVENTOS
// ============================================
function configurarEventos() {
    const form = document.getElementById('formEvaluacion');
    
    // Evento de submit
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await enviarEvaluacion();
    });
    
    // Validar resultado seleccionado y mostrar/ocultar errores críticos
    const resultRadios = document.querySelectorAll('input[name="result"]');
    resultRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            validarErroresCriticos();
        });
    });
    
    // Validar cuando se marca/desmarca un error crítico
    const errorCheckboxes = document.querySelectorAll('input[name="criticalError"]');
    errorCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            validarErroresCriticos();
        });
    });
}

// ============================================
// VALIDAR ERRORES CRÍTICOS
// ============================================
function validarErroresCriticos() {
    const resultadoSeleccionado = document.querySelector('input[name="result"]:checked');
    const seccionErrores = document.getElementById('seccionErrores');
    
    if (!seccionErrores) return;
    
    if (resultadoSeleccionado && resultadoSeleccionado.value === 'rejected') {
        // Si es rechazada, resaltar la sección de errores
        seccionErrores.style.borderColor = '#ef4444';
        seccionErrores.style.background = '#fef2f2';
    } else {
        // Si es aprobada, volver al estilo normal
        seccionErrores.style.borderColor = '#e2e8f0';
        seccionErrores.style.background = '#ffffff';
    }
}

// ============================================
// ENVIAR EVALUACIÓN
// ============================================
async function enviarEvaluacion() {
    const form = document.getElementById('formEvaluacion');
    
    // Validar que el formulario esté completo
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Validar resultado seleccionado
    const resultadoSeleccionado = document.querySelector('input[name="result"]:checked');
    if (!resultadoSeleccionado) {
        alert('⚠️ Por favor, seleccione un resultado de evaluación (Aprobada/Rechazada)');
        document.querySelector('.result-options').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    // Si es rechazada, verificar que haya al menos un error crítico
    if (resultadoSeleccionado.value === 'rejected') {
        const erroresSeleccionados = document.querySelectorAll('input[name="criticalError"]:checked');
        if (erroresSeleccionados.length === 0) {
            alert('⚠️ Si la venta es rechazada, debe marcar al menos un error crítico.');
            document.getElementById('seccionErrores').scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }
    
    // Recopilar datos del formulario
    const formData = new FormData(form);
    
    try {
        // Mostrar indicador de carga
        mostrarCargando(true);
        
        // Guardar en Supabase
        await guardarEvaluacionEnSupabase(formData);
        
        // Ocultar indicador
        mostrarCargando(false);
        
        // Mostrar mensaje de éxito
        mostrarNotificacion('✅ Evaluación guardada correctamente', 'success');
        
        // Limpiar borrador
        localStorage.removeItem('qualityControl_draft');
        
        // Preguntar si quiere crear otra o ver historial
        const respuesta = confirm('Evaluación guardada exitosamente.\n\n¿Desea crear una nueva evaluación?\n\n(Cancelar para ir al historial)');
        
        if (respuesta) {
            limpiarFormulario();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.location.href = '../pages/historial_evaluacion.html';
        }
        
    } catch (error) {
        console.error('❌ Error al guardar evaluación:', error);
        mostrarCargando(false);
        mostrarNotificacion('❌ Error al guardar: ' + error.message, 'error');
    }
}

// ============================================
// GUARDAR EVALUACIÓN EN SUPABASE
// ============================================
async function guardarEvaluacionEnSupabase(formData) {

    // Notificar al operador
    const { data: userData } = await supabaseClient
        .from('usuarios')
        .select('id')
        .eq('nombre', document.getElementById('asesorNombre').value || '')
        .maybeSingle();

    const opId = userData?.id || null

    // Recopilar errores críticos
    const erroresCriticos = [];
    document.querySelectorAll('input[name="criticalError"]:checked').forEach(checkbox => {
        erroresCriticos.push(checkbox.value);
    });
    
    // Recopilar seguimiento
    const seguimiento = [];
    document.querySelectorAll('input[name="followUp"]:checked').forEach(checkbox => {
        seguimiento.push(checkbox.value);
    });
    
    // Preparar datos para Supabase
    const evaluacionData = {
        fecha_evaluacion: formData.get('evaluationDate'),
        evaluador: formData.get('evaluator'),
        asesor_nombre: document.getElementById('asesorNombre').value || null,
        cliente_id: document.getElementById('ccClienteId').value || null,
        operador_id: opId || null,
        canal: formData.get('channel'),
        duracion_audio: formData.get('audioDuration') || null,
        resultado: formData.get('result'),
        
        // Checklist
        checklist_presentacion: formData.get('item1') || null,
        checklist_identificacion: formData.get('item2') || null,
        checklist_explicacion: formData.get('item3') || null,
        checklist_condiciones: formData.get('item4') || null,
        checklist_consentimiento: formData.get('item5') || null,
        checklist_cierre: formData.get('item6') || null,
        checklist_lenguaje: formData.get('item7') || null,
        
        // Errores críticos
        errores_criticos: erroresCriticos,
        minuto_error: formData.get('errorMinute') || null,
        descripcion_error: formData.get('errorDescription') || null,
        
        // Feedback
        hecho_observado: formData.get('observedFact'),
        impacto: formData.get('impact'),
        accion_esperada: formData.get('expectedAction'),
        buenas_practicas: formData.get('goodPractices') || null,
        
        // Seguimiento
        seguimiento: seguimiento,
        conclusion: formData.get('conclusion') || null,
        
        // Metadatos
        autor_nombre: datosUsuario.nombre || 'Evaluador'
    };
    
    const { data, error } = await supabaseClient
        .from('evaluaciones_calidad')
        .insert([evaluacionData])
        .select()
        .single();
    
    if (error) throw error;

    if (opId) {
        await supabaseClient.from('notificaciones_calidad').insert({
            operador_id: opId,
            evaluacion_id: data.id,
            cliente_nombre: document.getElementById('ccClienteNombre').textContent,
            resultado: evaluacionData.resultado,
        })
    }

    return data;
}

// ============================================
// AUTOGUARDADO DE BORRADOR
// ============================================
function iniciarAutoguardado() {
    const form = document.getElementById('formEvaluacion');
    
    // Guardar borrador cada vez que cambie el formulario
    form.addEventListener('input', function() {
        // Reiniciar timer
        if (autoguardadoTimer) {
            clearTimeout(autoguardadoTimer);
        }
        
        // Programar autoguardado
        autoguardadoTimer = setTimeout(() => {
            guardarBorrador(true);
        }, AUTOSAVE_DELAY);
    });
}

function guardarBorrador(esAutomatico = false) {
    const form = document.getElementById('formEvaluacion');
    const formData = new FormData(form);
    
    // Convertir FormData a objeto
    const borrador = {};
    
    for (let [key, value] of formData.entries()) {
        if (borrador[key]) {
            // Si ya existe, convertir a array
            if (Array.isArray(borrador[key])) {
                borrador[key].push(value);
            } else {
                borrador[key] = [borrador[key], value];
            }
        } else {
            borrador[key] = value;
        }
    }
    
    // Guardar en localStorage
    localStorage.setItem('qualityControl_draft', JSON.stringify(borrador));
    
    // Mostrar indicador
    if (esAutomatico) {
        mostrarIndicadorAutoguardado();
    } else {
        mostrarNotificacion('💾 Borrador guardado', 'success');
    }
    
    ;
}

function cargarBorrador() {
    const borradorStr = localStorage.getItem('qualityControl_draft');
    
    if (!borradorStr) return;
    
    try {
        const borrador = JSON.parse(borradorStr);
        const form = document.getElementById('formEvaluacion');
        
        // Preguntar si quiere cargar el borrador
        if (!confirm('📋 Se encontró un borrador guardado.\n\n¿Desea continuar con la evaluación anterior?')) {
            localStorage.removeItem('qualityControl_draft');
            return;
        }
        
        // Cargar datos en el formulario
        for (let [name, value] of Object.entries(borrador)) {
            const elements = form.elements[name];
            
            if (!elements) continue;
            
            if (elements.length) {
                // Es un NodeList (radio buttons, checkboxes)
                if (Array.isArray(value)) {
                    // Múltiples valores (checkboxes)
                    value.forEach(val => {
                        const element = Array.from(elements).find(el => el.value === val);
                        if (element) element.checked = true;
                    });
                } else {
                    // Un solo valor (radio button)
                    const element = Array.from(elements).find(el => el.value === value);
                    if (element) element.checked = true;
                }
            } else {
                // Es un solo elemento
                elements.value = value;
            }
        }
        
        ;
        mostrarNotificacion('📋 Borrador cargado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error al cargar borrador:', error);
        localStorage.removeItem('qualityControl_draft');
    }
}

function mostrarIndicadorAutoguardado() {
    const indicador = document.getElementById('autosaveIndicator');
    if (!indicador) return;
    
    indicador.classList.add('show');
    
    setTimeout(() => {
        indicador.classList.remove('show');
    }, 3000);
}

// ============================================
// LIMPIAR FORMULARIO
// ============================================
function limpiarFormulario() {
    const form = document.getElementById('formEvaluacion');
    form.reset();
    
    // Restablecer fecha actual
    const fechaInput = document.getElementById('fechaEvaluacion');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Restablecer evaluador
    const evaluadorInput = document.getElementById('evaluador');
    if (evaluadorInput && datosUsuario.nombre) {
        evaluadorInput.value = datosUsuario.nombre;
    }
    
    // Limpiar borrador
    localStorage.removeItem('qualityControl_draft');
    
    // Resetear estilos de sección de errores
    const seccionErrores = document.getElementById('seccionErrores');
    if (seccionErrores) {
        seccionErrores.style.borderColor = '#e2e8f0';
        seccionErrores.style.background = '#ffffff';
    }
    
    mostrarNotificacion('🔄 Formulario limpiado', 'success');
}

// ============================================
// UTILIDADES
// ============================================
function mostrarCargando(mostrar) {
    const form = document.getElementById('formEvaluacion');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (mostrar) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        // Deshabilitar todos los inputs
        const inputs = form.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => input.disabled = true);
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Evaluación';
        
        // Habilitar todos los inputs
        const inputs = form.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => input.disabled = false);
    }
}

function mostrarNotificacion(mensaje, tipo) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${tipo === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 600;
        max-width: 400px;
    `;
    notif.textContent = mensaje;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);

// ============================================
// PREVENIR PÉRDIDA DE DATOS
// ============================================
window.addEventListener('beforeunload', function(e) {
    const form = document.getElementById('formEvaluacion');
    const hayCambios = Array.from(new FormData(form)).some(([key, value]) => value !== '');
    
    if (hayCambios && !localStorage.getItem('qualityControl_draft')) {
        // Guardar borrador automáticamente antes de salir
        guardarBorrador(true);
    }
});

// Buscar cliente
let timeoutCC;
async function buscarClienteCC(texto) {
    clearTimeout(timeoutCC);
    const sugerencias = document.getElementById('ccSugerencias');
    if (texto.trim().length < 2) {
        sugerencias.style.display = 'none';
        return;
    }

    timeoutCC = setTimeout(async () => {
        const termino = texto.replace(/[%,]/g, '').trim();
        const { data } = await supabaseClient
            .from('clientes')
            .select('id, nombres, apellidos, telefono1, operador_id, operador_nombre')
            .or(`nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,telefono1.ilike.%${termino}%`)
            .neq('archivado', true)
            .limit(8);

        if (!data || data.length === 0) {
            sugerencias.innerHTML = `<div style="padding:12px;color:#94a3b8;font-size:0.84rem">Sin resultados</div>`;
            sugerencias.style.display = 'block';
            return;
        }

        sugerencias.innerHTML = data.map(c => {
            const nombre = `${c.nombres} ${c.apellidos}`.trim();
            const nSafe  = nombre.replace(/'/g, "\\'");
            const tSafe  = (c.operador_nombre || '').replace(/'/g, "\\'");
            return `
                <div onclick="seleccionarClienteCC('${c.id}','${nSafe}','${c.telefono1 || ''}','${c.operador_id || ''}','${tSafe}')"
                     style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f1f5f9;font-size:0.88rem;"
                     onmouseover="this.style.background='#f8fafc'"
                     onmouseout="this.style.background='white'">
                    <span class="material-symbols-rounded" style="color:#6366f1;font-size:1.1rem">person</span>
                    <div>
                        <strong style="display:block;color:#1e293b">${nombre}</strong>
                        <small style="color:#64748b">${c.telefono1 || ''} • ${c.operador_nombre || 'Sin operador'}</small>
                    </div>
                </div>
            `;
        }).join('');
        sugerencias.style.display = 'block';
    }, 300);
}

function seleccionarClienteCC(clienteId, nombre, telefono, operadorId, operadorNombre) {
    document.getElementById('ccClienteId').value = clienteId;
    document.getElementById('ccOperadorId').value = operadorId; 
    document.getElementById('ccClienteNombre').textContent = nombre; 
    document.getElementById('ccClienteTelefono').textContent = telefono; 
    document.getElementById('ccClienteSeleccionado').style.display = 'flex';
    document.getElementById('ccSugerencias').style.display = 'none'; 
    document.getElementById('ccBuscarCliente').value = nombre;
    document.getElementById('asesorNombre').value = operadorNombre; 
}

function limpiarClienteCC() {
    document.getElementById('ccClienteId').value = '';
    document.getElementById('ccOperadorId').value = ''; 
    document.getElementById('ccClienteNombre').textContent = ''; 
    document.getElementById('ccClienteTelefono').textContent = ''; 
    document.getElementById('ccClienteSeleccionado').style.display = 'none';
    document.getElementById('ccSugerencias').style.display = 'none'; 
    document.getElementById('ccBuscarCliente').value = '';
    document.getElementById('asesorNombre').value = ''; 
}

document.addEventListener('click', e => {
    const sug = document.getElementById('ccSugerencias');
    if (sug && !sug.contains(e.target) && e.target.id !== 'ccBuscarCliente') {
        sug.style.display = 'none';
    }
});