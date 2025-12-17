// ============================================
// QUALITY CONTROL - JAVASCRIPT
// Control de Calidad para Evaluación de Ventas
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ============================================
    // ELEMENTOS DEL DOM
    // ============================================
    
    const form = document.getElementById('evaluationForm');
    const autosaveIndicator = document.getElementById('autosaveIndicator');
    
    // Textareas con contador
    const observedFact = document.getElementById('observedFact');
    const impact = document.getElementById('impact');
    const expectedAction = document.getElementById('expectedAction');
    const goodPractices = document.getElementById('goodPractices');
    const conclusion = document.getElementById('conclusion');
    
    // Contadores
    const factCounter = document.getElementById('factCounter');
    const impactCounter = document.getElementById('impactCounter');
    const actionCounter = document.getElementById('actionCounter');
    const practicesCounter = document.getElementById('practicesCounter');
    const conclusionCounter = document.getElementById('conclusionCounter');
    
    // Botones
    const btnClear = document.getElementById('btnClear');
    const btnSaveDraft = document.getElementById('btnSaveDraft');
    const btnGenerateReport = document.getElementById('btnGenerateReport');
    const btnNewEvaluation = document.getElementById('btnNewEvaluation');
    const btnHistory = document.getElementById('btnHistory');
    
    // Sección de errores críticos
    const criticalErrorsSection = document.getElementById('criticalErrorsSection');
    const errorMinute = document.getElementById('errorMinute');
    const errorDescription = document.getElementById('errorDescription');
    
    // ============================================
    // CONFIGURACIÓN INICIAL
    // ============================================
    
    // Establecer fecha actual
    const evaluationDate = document.getElementById('evaluationDate');
    evaluationDate.value = new Date().toISOString().split('T')[0];
    
    // ============================================
    // CONTADORES DE CARACTERES
    // ============================================
    
    function updateCharCounter(textarea, counter) {
        const currentLength = textarea.value.length;
        const maxLength = textarea.getAttribute('maxlength') || 500;
        counter.textContent = `${currentLength} / ${maxLength}`;
        
        // Cambiar color según porcentaje
        const percentage = (currentLength / maxLength) * 100;
        if (percentage >= 90) {
            counter.style.color = '#ef4444'; // Rojo
        } else if (percentage >= 70) {
            counter.style.color = '#f59e0b'; // Amarillo
        } else {
            counter.style.color = '#94a3b8'; // Gris
        }
    }
    
    // Inicializar contadores
    observedFact.addEventListener('input', () => updateCharCounter(observedFact, factCounter));
    impact.addEventListener('input', () => updateCharCounter(impact, impactCounter));
    expectedAction.addEventListener('input', () => updateCharCounter(expectedAction, actionCounter));
    goodPractices.addEventListener('input', () => updateCharCounter(goodPractices, practicesCounter));
    conclusion.addEventListener('input', () => updateCharCounter(conclusion, conclusionCounter));
    
    // ============================================
    // VALIDACIÓN DE RESULTADO
    // ============================================
    
    const resultRadios = document.querySelectorAll('input[name="result"]');
    const criticalErrorCheckboxes = document.querySelectorAll('input[name="criticalError"]');
    
    resultRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'rejected') {
                // Si es rechazada, resaltar sección de errores críticos
                criticalErrorsSection.style.borderLeft = '4px solid #ef4444';
                criticalErrorsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                criticalErrorsSection.style.borderLeft = 'none';
            }
        });
    });
    
    // ============================================
    // VALIDACIÓN DE ERRORES CRÍTICOS
    // ============================================
    
    criticalErrorCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const anyChecked = Array.from(criticalErrorCheckboxes).some(cb => cb.checked);
            
            if (anyChecked) {
                // Requerir descripción si hay errores marcados
                errorMinute.setAttribute('required', 'required');
                errorDescription.setAttribute('required', 'required');
                errorMinute.style.borderColor = '#ef4444';
                errorDescription.style.borderColor = '#ef4444';
            } else {
                errorMinute.removeAttribute('required');
                errorDescription.removeAttribute('required');
                errorMinute.style.borderColor = '#e2e8f0';
                errorDescription.style.borderColor = '#e2e8f0';
            }
        });
    });
    
    // ============================================
    // AUTOSAVE
    // ============================================
    
    let autosaveTimeout;
    
    function showAutosaveIndicator() {
        autosaveIndicator.classList.add('show');
        setTimeout(() => {
            autosaveIndicator.classList.remove('show');
        }, 2000);
    }
    
    function saveFormData() {
        const formData = new FormData(form);
        const data = {};
        
        // Convertir FormData a objeto
        for (let [key, value] of formData.entries()) {
            if (data[key]) {
                // Si ya existe, convertir a array
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        
        // Guardar en localStorage
        localStorage.setItem('qualityControl_draft', JSON.stringify(data));
        localStorage.setItem('qualityControl_lastSave', new Date().toISOString());
        
        showAutosaveIndicator();
        console.log('Formulario guardado automáticamente:', data);
    }
    
    // Autosave cada vez que cambia un input
    form.addEventListener('input', function() {
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(saveFormData, 2000); // Guardar después de 2 segundos sin cambios
    });
    
    // Guardar también cuando cambian checkboxes o radios
    form.addEventListener('change', function() {
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(saveFormData, 1000);
    });
    
    // ============================================
    // CARGAR BORRADOR AL INICIAR
    // ============================================
    
    function loadDraft() {
        const savedData = localStorage.getItem('qualityControl_draft');
        if (savedData) {
            const data = JSON.parse(savedData);
            
            // Preguntar si quiere cargar el borrador
            if (confirm('Se encontró un borrador guardado. ¿Desea cargarlo?')) {
                // Cargar datos en el formulario
                for (let [key, value] of Object.entries(data)) {
                    const input = form.elements[key];
                    if (input) {
                        if (input.type === 'checkbox' || input.type === 'radio') {
                            if (Array.isArray(value)) {
                                value.forEach(v => {
                                    const element = form.querySelector(`input[name="${key}"][value="${v}"]`);
                                    if (element) element.checked = true;
                                });
                            } else {
                                const element = form.querySelector(`input[name="${key}"][value="${value}"]`);
                                if (element) element.checked = true;
                            }
                        } else {
                            input.value = value;
                        }
                    }
                }
                
                // Actualizar contadores
                updateCharCounter(observedFact, factCounter);
                updateCharCounter(impact, impactCounter);
                updateCharCounter(expectedAction, actionCounter);
                updateCharCounter(goodPractices, practicesCounter);
                updateCharCounter(conclusion, conclusionCounter);
                
                alert('Borrador cargado correctamente');
            }
        }
    }
    
    // Cargar borrador al iniciar (después de 1 segundo)
    setTimeout(loadDraft, 1000);
    
    // ============================================
    // LIMPIAR FORMULARIO
    // ============================================
    
    btnClear.addEventListener('click', function() {
        if (confirm('¿Está seguro de que desea limpiar el formulario? Se perderán todos los datos no guardados.')) {
            form.reset();
            localStorage.removeItem('qualityControl_draft');
            
            // Restablecer fecha
            evaluationDate.value = new Date().toISOString().split('T')[0];
            
            // Actualizar contadores
            updateCharCounter(observedFact, factCounter);
            updateCharCounter(impact, impactCounter);
            updateCharCounter(expectedAction, actionCounter);
            updateCharCounter(goodPractices, practicesCounter);
            updateCharCounter(conclusion, conclusionCounter);
            
            // Scroll al inicio
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            alert('Formulario limpiado correctamente');
        }
    });
    
    // ============================================
    // GUARDAR BORRADOR MANUALMENTE
    // ============================================
    
    btnSaveDraft.addEventListener('click', function() {
        saveFormData();
        alert('Borrador guardado correctamente');
    });
    
    // ============================================
    // GENERAR REPORTE
    // ============================================
    
    btnGenerateReport.addEventListener('click', function() {
        // Validar que el formulario esté completo
        if (!form.checkValidity()) {
            alert('Por favor, complete todos los campos requeridos antes de generar el reporte.');
            form.reportValidity();
            return;
        }
        
        // Aquí iría la lógica para generar el PDF
        alert('Función de generación de reporte en desarrollo.\n\nSe generará un PDF con toda la información de la evaluación.');
        console.log('Generar reporte PDF');
    });
    
    // ============================================
    // ENVIAR EVALUACIÓN
    // ============================================
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validaciones adicionales
        const selectedResult = document.querySelector('input[name="result"]:checked');
        if (!selectedResult) {
            alert('Por favor, seleccione un resultado de evaluación (Aprobada/Rechazada)');
            return;
        }
        
        // Si es rechazada, verificar que haya al menos un error crítico
        if (selectedResult.value === 'rejected') {
            const anyErrorChecked = Array.from(criticalErrorCheckboxes).some(cb => cb.checked);
            if (!anyErrorChecked) {
                alert('Si la venta es rechazada, debe marcar al menos un error crítico.');
                criticalErrorsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }
        
        // Recopilar datos del formulario
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        
        console.log('Datos de evaluación:', data);
        
        // Aquí iría la lógica para enviar al backend
        alert('Evaluación enviada correctamente.\n\nLos datos se han guardado en la base de datos.');
        
        // Limpiar borrador
        localStorage.removeItem('qualityControl_draft');
        
        // Preguntar si quiere crear otra evaluación
        if (confirm('¿Desea crear una nueva evaluación?')) {
            form.reset();
            evaluationDate.value = new Date().toISOString().split('T')[0];
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    // ============================================
    // NUEVA EVALUACIÓN
    // ============================================
    
    btnNewEvaluation.addEventListener('click', function() {
        if (form.checkValidity() && !confirm('Hay datos en el formulario. ¿Desea crear una nueva evaluación sin guardar?')) {
            return;
        }
        
        form.reset();
        evaluationDate.value = new Date().toISOString().split('T')[0];
        localStorage.removeItem('qualityControl_draft');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // ============================================
    // HISTORIAL
    // ============================================
    
    btnHistory.addEventListener('click', function() {
        alert('Función de historial en desarrollo.\n\nAquí podrá ver todas las evaluaciones anteriores.');
        console.log('Abrir historial de evaluaciones');
    });
    
    // ============================================
    // PREVENIR PÉRDIDA DE DATOS
    // ============================================
    
    window.addEventListener('beforeunload', function(e) {
        const formIsFilled = Array.from(form.elements).some(element => {
            if (element.type === 'text' || element.type === 'textarea') {
                return element.value.trim() !== '';
            }
            if (element.type === 'checkbox' || element.type === 'radio') {
                return element.checked;
            }
            return false;
        });
        
        if (formIsFilled) {
            e.preventDefault();
            e.returnValue = '¿Está seguro de que desea salir? Los cambios no guardados se perderán.';
        }
    });
    
    // ============================================
    // ATAJOS DE TECLADO
    // ============================================
    
    document.addEventListener('keydown', function(e) {
        // Ctrl + S = Guardar borrador
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveFormData();
            alert('Borrador guardado');
        }
        
        // Ctrl + Enter = Enviar formulario (si está en un textarea)
        if (e.ctrlKey && e.key === 'Enter') {
            if (document.activeElement.tagName === 'TEXTAREA') {
                if (confirm('¿Desea enviar la evaluación?')) {
                    form.dispatchEvent(new Event('submit'));
                }
            }
        }
    });
    
    // ============================================
    // MENSAJES DE CONSOLE
    // ============================================
    
    console.log('%c✅ Quality Control System Loaded', 'color: #10b981; font-size: 16px; font-weight: bold;');
    console.log('%cFuncionalidades activas:', 'color: #3b82f6; font-weight: bold;');
    console.log('- Autosave cada 2 segundos');
    console.log('- Validaciones en tiempo real');
    console.log('- Contadores de caracteres');
    console.log('- Atajos: Ctrl+S (guardar), Ctrl+Enter (enviar)');
    
});