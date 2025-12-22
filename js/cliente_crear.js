// ============================================
// CLIENTE_CREAR.JS - VERSIÓN CORREGIDA
// Todas las correcciones aplicadas
// ============================================

// ============================================
// VARIABLES GLOBALES
// ============================================
let dependientesCount = 0;
let documentosCount = 0;
let notasCount = 0;
let imagenesNotaSeleccionadas = [];
let autosaveTimer = null;
const AUTOSAVE_INTERVAL = 30000; // 30 segundos

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📝 Modo: CREAR NUEVO CLIENTE');
    
    inicializarFormulario();
    inicializarTabs();
    calcularFechasAutomaticas();
    inicializarValidacionTiempoReal();
    inicializarAutoguardado();
    
    document.getElementById('clienteForm').addEventListener('submit', handleSubmit);
    
    // Cargar borrador si existe
    cargarBorradorAutomatico();
    
    console.log('✅ Formulario de creación inicializado');
});

function inicializarFormulario() {
    // Establecer fecha de registro a hoy en formato mm/dd/aaaa
    const hoy = new Date();
    const fechaRegistro = document.getElementById('fechaRegistro');
    if (fechaRegistro) {
        fechaRegistro.value = formatearFechaUS(hoy);
    }
    
    // Inicializar inputs numéricos en 0
    const ingresos = document.getElementById('ingresos');
    const creditoFiscal = document.getElementById('creditoFiscal');
    const prima = document.getElementById('prima');
    
    if (ingresos) ingresos.value = 0;
    if (creditoFiscal) creditoFiscal.value = 0;
    if (prima) prima.value = 0;
}

// ============================================
// FORMATEADORES DE FECHA
// ============================================

// Convertir Date a formato mm/dd/aaaa
function formatearFechaUS(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    const anio = d.getFullYear();
    return `${mes}/${dia}/${anio}`;
}

// Convertir aaaa-mm-dd a mm/dd/aaaa
function convertirAFormatoUS(fechaISO) {
    if (!fechaISO) return '';
    const partes = fechaISO.split('-');
    if (partes.length !== 3) return '';
    return `${partes[1]}/${partes[2]}/${partes[0]}`;
}

// Convertir mm/dd/aaaa a aaaa-mm-dd (para guardar en BD)
function convertirAFormatoISO(fechaUS) {
    if (!fechaUS) return '';
    const partes = fechaUS.split('/');
    if (partes.length !== 3) return '';
    return `${partes[2]}-${partes[0]}-${partes[1]}`;
}

// ============================================
// TABS NAVEGACIÓN
// ============================================

function inicializarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            cambiarTab(tabName);
        });
    });
}

function cambiarTab(tabName) {
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Desactivar todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activar el tab seleccionado
    const tabContent = document.getElementById(`tab-${tabName}`);
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (tabContent) tabContent.classList.add('active');
    if (tabButton) tabButton.classList.add('active');
}

// ============================================
// SECCIONES COLAPSABLES
// ============================================

function toggleSection(header) {
    const section = header.parentElement;
    section.classList.toggle('collapsed');
}

// ============================================
// FECHAS AUTOMÁTICAS
// ============================================

function calcularFechasAutomaticas() {
    // Calcular fechas al cargar la página
    calcularYMostrarFechas();
    
    console.log('📅 Fechas calculadas automáticamente');
}

function calcularYMostrarFechas() {
    const hoy = new Date();
    
    // Fecha inicial: Primer día del mes siguiente
    const fechaInicial = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    
    // Fecha final: Siempre 12/31/2026
    const fechaFinal = new Date(2026, 11, 31); // Mes 11 = Diciembre
    
    // Fecha efectividad: Igual a fecha inicial
    const fechaEfectividad = new Date(fechaInicial);
    
    // Formatear a mm/dd/aaaa para mostrar
    const fechaInicialUS = formatearFechaUS(fechaInicial);
    const fechaFinalUS = formatearFechaUS(fechaFinal);
    const fechaEfectividadUS = formatearFechaUS(fechaEfectividad);
    
    // Mostrar en displays
    const displayInicial = document.getElementById('displayFechaInicial');
    const displayFinal = document.getElementById('displayFechaFinal');
    const displayEfectividad = document.getElementById('displayFechaEfectividad');
    
    if (displayInicial) displayInicial.textContent = fechaInicialUS;
    if (displayFinal) displayFinal.textContent = fechaFinalUS;
    if (displayEfectividad) displayEfectividad.textContent = fechaEfectividadUS;
    
    // Guardar en inputs hidden (formato ISO para BD)
    const inputInicial = document.getElementById('fechaInicialCobertura');
    const inputFinal = document.getElementById('fechaFinalCobertura');
    const inputEfectividad = document.getElementById('fechaEfectividad');
    
    if (inputInicial) inputInicial.value = convertirAFormatoISO(fechaInicialUS);
    if (inputFinal) inputFinal.value = convertirAFormatoISO(fechaFinalUS);
    if (inputEfectividad) inputEfectividad.value = convertirAFormatoISO(fechaEfectividadUS);
    
    console.log('Fechas calculadas:');
    console.log('  Inicial:', fechaInicialUS, '→', convertirAFormatoISO(fechaInicialUS));
    console.log('  Final:', fechaFinalUS, '→', convertirAFormatoISO(fechaFinalUS));
    console.log('  Efectividad:', fechaEfectividadUS, '→', convertirAFormatoISO(fechaEfectividadUS));
}

/**
* Convierte CUALQUIER formato de fecha a mm/dd/aaaa
 * @param {string|Date} fecha - Fecha en cualquier formato
 * @returns {string} Fecha en formato mm/dd/aaaa
 */
function formatoUS(fecha) {
    if (!fecha) return '';
    
    // Si ya viene en formato mm/dd/aaaa, devolver tal cual
    if (typeof fecha === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
        return fecha;
    }
    
    // Convertir a objeto Date
    let d;
    if (fecha instanceof Date) {
        d = fecha;
    } else if (typeof fecha === 'string') {
        // Manejar formato ISO (aaaa-mm-dd)
        if (fecha.includes('-')) {
            const partes = fecha.split('T')[0].split('-');
            d = new Date(partes[0], partes[1] - 1, partes[2]);
        } else {
            d = new Date(fecha);
        }
    } else {
        return '';
    }
    
    // Validar que sea fecha válida
    if (isNaN(d.getTime())) return '';
    
    // Formatear a mm/dd/aaaa
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    const anio = d.getFullYear();
    
    return `${mes}/${dia}/${anio}`;
}

// ============================================
// VALIDACIÓN EN TIEMPO REAL
// ============================================

function inicializarValidacionTiempoReal() {
    // Email
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            validarEmail(this);
        });
    }
    
    // Teléfonos - Aplicar formato automáticamente y límite 10
    const tel1 = document.getElementById('telefono1');
    const tel2 = document.getElementById('telefono2');
    
    if (tel1) {
        tel1.addEventListener('input', function() {
            this.value = formatearTelefono(this.value);
        });
        tel1.addEventListener('blur', function() {
            validarTelefono(this);
        });
    }
    
    if (tel2) {
        tel2.addEventListener('input', function() {
            this.value = formatearTelefono(this.value);
        });
        tel2.addEventListener('blur', function() {
            validarTelefono(this);
        });
    }
    
    // SSN - Aplicar formato automáticamente
    const ssn = document.getElementById('ssn');
    if (ssn) {
        ssn.addEventListener('input', function() {
            this.value = formatearSSN(this.value);
        });
        ssn.addEventListener('blur', function() {
            validarSSN(this);
        });
    }
    
    // Código postal - Solo números
    const cp = document.getElementById('codigoPostal');
    if (cp) {
        cp.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 5);
        });
        cp.addEventListener('blur', function() {
            validarCodigoPostal(this);
        });
    }
    
    // Montos - Formato de moneda
    const prima = document.getElementById('prima');
    const creditoFiscal = document.getElementById('creditoFiscal');
    const ingresos = document.getElementById('ingresos');
    
    [prima, creditoFiscal, ingresos].forEach(input => {
        if (input) {
            input.addEventListener('blur', function() {
                formatearMonto(this);
            });
        }
    });
}

// Formateadores
function formatearTelefono(valor) {
    // Remover todo excepto números
    const numeros = valor.replace(/\D/g, '');
    
    // Limitar a 10 dígitos
    const limitado = numeros.slice(0, 10);
    
    // Formatear
    if (limitado.length <= 3) return limitado;
    if (limitado.length <= 6) return `(${limitado.slice(0, 3)}) ${limitado.slice(3)}`;
    return `(${limitado.slice(0, 3)}) ${limitado.slice(3, 6)}-${limitado.slice(6, 10)}`;
}

function formatearSSN(valor) {
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 5) return `${numeros.slice(0, 3)}-${numeros.slice(3)}`;
    return `${numeros.slice(0, 3)}-${numeros.slice(3, 5)}-${numeros.slice(5, 9)}`;
}

function formatearMonto(input) {
    let valor = parseFloat(input.value.replace(/[^0-9.]/g, ''));
    if (isNaN(valor)) valor = 0;
    input.value = valor.toFixed(2);
}

// Validadores
function validarEmail(input) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (input.value && !regex.test(input.value)) {
        input.setCustomValidity('Email inválido');
        input.reportValidity();
        return false;
    }
    input.setCustomValidity('');
    return true;
}

function validarTelefono(input) {
    const numeros = input.value.replace(/\D/g, '');
    if (numeros && numeros.length !== 10) {
        input.setCustomValidity('Teléfono debe tener 10 dígitos');
        input.reportValidity();
        return false;
    }
    input.setCustomValidity('');
    return true;
}

function validarSSN(input) {
    const numeros = input.value.replace(/\D/g, '');
    if (numeros && numeros.length !== 9) {
        input.setCustomValidity('SSN debe tener 9 dígitos');
        input.reportValidity();
        return false;
    }
    input.setCustomValidity('');
    return true;
}

function validarCodigoPostal(input) {
    if (input.value && input.value.length !== 5) {
        input.setCustomValidity('Código postal debe tener 5 dígitos');
        input.reportValidity();
        return false;
    }
    input.setCustomValidity('');
    return true;
}

// ============================================
// MÉTODO DE PAGO
// ============================================

function mostrarFormularioPago(tipo) {
    // Ocultar ambos formularios
    const formBanco = document.getElementById('formBanco');
    const formTarjeta = document.getElementById('formTarjeta');
    
    if (formBanco) formBanco.style.display = 'none';
    if (formTarjeta) formTarjeta.style.display = 'none';
    
    // Mostrar el formulario seleccionado
    if (tipo === 'banco' && formBanco) {
        formBanco.style.display = 'block';
    } else if (tipo === 'tarjeta' && formTarjeta) {
        formTarjeta.style.display = 'block';
    }
}

function limpiarMetodoPago() {
    // Desmarcar radio buttons
    document.querySelectorAll('[name="metodoPago"]').forEach(radio => {
        radio.checked = false;
    });
    
    // Ocultar formularios
    const formBanco = document.getElementById('formBanco');
    const formTarjeta = document.getElementById('formTarjeta');
    
    if (formBanco) formBanco.style.display = 'none';
    if (formTarjeta) formTarjeta.style.display = 'none';
    
    // Limpiar campos
    document.querySelectorAll('#formBanco input, #formTarjeta input, #formTarjeta select').forEach(input => {
        input.value = '';
    });
}

// ============================================
// DEPENDIENTES
// ============================================

function agregarDependiente() {
    dependientesCount++;
    const container = document.getElementById('dependientesContainer');
    
    // Quitar empty state
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const dependienteHTML = `
        <div class="dependiente-item" id="dependiente-${dependientesCount}">
            <div class="dependiente-header">
                <h4>Dependiente #${dependientesCount}</h4>
                <button type="button" class="btn-remove" onclick="eliminarDependiente(${dependientesCount})">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
            <div class="dependiente-body">
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombres <span class="required">*</span></label>
                        <input type="text" name="dep_nombres_${dependientesCount}" required>
                    </div>
                    <div class="form-group">
                        <label>Apellidos <span class="required">*</span></label>
                        <input type="text" name="dep_apellidos_${dependientesCount}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Fecha de Nacimiento <span class="required">*</span></label>
                        <input type="date" name="dep_fecha_nacimiento_${dependientesCount}" required>
                    </div>
                    <div class="form-group">
                        <label>Género <span class="required">*</span></label>
                        <select name="dep_genero_${dependientesCount}" required>
                            <option value="">Seleccionar...</option>
                            <option value="masculino">Masculino</option>
                            <option value="femenino">Femenino</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>SSN</label>
                        <input type="text" name="dep_ssn_${dependientesCount}" 
                               placeholder="###-##-####" 
                               oninput="this.value = formatearSSN(this.value)">
                    </div>
                    <div class="form-group">
                        <label>Estado Migratorio</label>
                        <select name="dep_estado_migratorio_${dependientesCount}">
                            <option value="">Seleccionar...</option>
                            <option value="ciudadano">Ciudadano</option>
                            <option value="residente">Residente Permanente</option>
                            <option value="visa">Visa</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>¿Aplica para el seguro?</label>
                        <select name="dep_relacion_${dependientesCount}">
                            <option value="">Seleccionar...</option>
                            <option value="Si">Si</option>
                            <option value="No">No</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Relación</label>
                        <select name="dep_aplicante_${dependientesCount}">
                            <option value="">Seleccionar...</option>
                            <option value="hijo/a">Hijo/a</option>
                            <option value="conyuge">Cónyuge</option>
                            <option value="padre/madre">Padre/Madre</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', dependienteHTML);
    actualizarContadorDependientes();
}

function eliminarDependiente(id) {
    if (confirm('¿Eliminar este dependiente?')) {
        const elemento = document.getElementById(`dependiente-${id}`);
        if (elemento) {
            elemento.remove();
            actualizarContadorDependientes();
            
            // Mostrar empty state si no hay dependientes
            const container = document.getElementById('dependientesContainer');
            if (container.querySelectorAll('.dependiente-item').length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="material-symbols-rounded">family_restroom</span>
                        <p>No hay dependientes agregados</p>
                        <small>Haz clic en "Agregar Dependiente" para comenzar</small>
                    </div>
                `;
            }
        }
    }
}

function actualizarContadorDependientes() {
    const total = document.querySelectorAll('.dependiente-item').length;
    const contador = document.getElementById('dependientesCounter');
    if (contador) {
        contador.textContent = `(${total})`;
    }
}

// ============================================
// DOCUMENTOS (SIMPLIFICADOS - SIN TIPO)
// ============================================

function agregarDocumento() {
    documentosCount++;
    const container = document.getElementById('documentosContainer');
    
    // Quitar empty state
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const documentoHTML = `
        <div class="documento-item" id="documento-${documentosCount}">
            <div class="documento-header">
                <span class="material-symbols-rounded">description</span>
                <span class="documento-nombre" id="nombre-doc-${documentosCount}">Documento #${documentosCount}</span>
                <button type="button" class="btn-remove" onclick="eliminarDocumento(${documentosCount})">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
            <div class="documento-body">
                <div class="form-row">
                    <div class="form-group full-width">
                        <label>Archivo</label>
                        <input type="file" name="doc_archivo_${documentosCount}" 
                               accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                               onchange="previsualizarDocumento(${documentosCount}, this)">
                    </div>
                </div>
                <div class="form-group">
                    <label>Notas</label>
                    <textarea name="doc_notas_${documentosCount}" rows="3" 
                              placeholder="Describe el documento, especifica qué tipo es (ID, Póliza, Comprobante, etc.)..."></textarea>
                </div>
                <div class="documento-preview" id="preview-doc-${documentosCount}"></div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', documentoHTML);
    actualizarContadorDocumentos();
}

function eliminarDocumento(id) {
    if (confirm('¿Eliminar este documento?')) {
        const elemento = document.getElementById(`documento-${id}`);
        if (elemento) {
            elemento.remove();
            actualizarContadorDocumentos();
            
            // Mostrar empty state si no hay documentos
            const container = document.getElementById('documentosContainer');
            if (container.querySelectorAll('.documento-item').length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="material-symbols-rounded">upload_file</span>
                        <p>No hay documentos cargados</p>
                        <small>Haz clic en "Agregar Archivo" para comenzar</small>
                    </div>
                `;
            }
        }
    }
}

function previsualizarDocumento(id, input) {
    const preview = document.getElementById(`preview-doc-${id}`);
    const file = input.files[0];
    
    if (!file) {
        preview.innerHTML = '';
        return;
    }
    
    const fileName = file.name;
    const fileSize = (file.size / 1024).toFixed(2); // KB
    const fileType = file.type;
    
    // Actualizar nombre del documento
    const nombreSpan = document.getElementById(`nombre-doc-${id}`);
    if (nombreSpan) {
        nombreSpan.textContent = fileName;
    }
    
    let previewHTML = `
        <div class="archivo-info">
            <span class="material-symbols-rounded">insert_drive_file</span>
            <div class="archivo-detalles">
                <strong>${fileName}</strong>
                <small>${fileSize} KB</small>
            </div>
        </div>
    `;
    
    // Si es imagen, mostrar preview
    if (fileType.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewHTML = `
                <div class="imagen-preview">
                    <img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">
                </div>
                <div class="archivo-info">
                    <span class="material-symbols-rounded">image</span>
                    <div class="archivo-detalles">
                        <strong>${fileName}</strong>
                        <small>${fileSize} KB</small>
                    </div>
                </div>
            `;
            preview.innerHTML = previewHTML;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = previewHTML;
    }
}

function actualizarContadorDocumentos() {
    const total = document.querySelectorAll('.documento-item').length;
    const contador = document.getElementById('documentosCounter');
    if (contador) {
        contador.textContent = `(${total})`;
    }
}

// ============================================
// NOTAS
// ============================================

function enviarNota() {
    const textarea = document.getElementById('nuevaNota');
    const mensaje = textarea.value.trim();
    
    if (!mensaje && imagenesNotaSeleccionadas.length === 0) {
        alert('Escribe un mensaje o adjunta una imagen');
        return;
    }
    
    const notaHTML = `
        <div class="nota-card">
            <div class="nota-header">
                <div class="nota-info">
                    <span class="nota-usuario">Tú (antes de guardar)</span>
                    <span class="nota-fecha">Ahora</span>
                </div>
            </div>
            <div class="nota-mensaje">${mensaje}</div>
            ${imagenesNotaSeleccionadas.length > 0 ? `
                <div class="nota-imagenes">
                    ${imagenesNotaSeleccionadas.map(img => `
                        <img src="${img}" alt="Imagen adjunta" style="max-width: 150px; border-radius: 8px; margin: 5px;">
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    const thread = document.getElementById('notasThread');
    const emptyState = thread.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    thread.insertAdjacentHTML('afterbegin', notaHTML);
    
    cancelarNota();
    actualizarContadorNotas();
    
    alert('✅ Nota agregada. Se guardará al crear el cliente.');
}

function cancelarNota() {
    document.getElementById('nuevaNota').value = '';
    imagenesNotaSeleccionadas = [];
    document.getElementById('imagenesPreview').innerHTML = '';
    document.getElementById('archivosSeleccionados').textContent = 'Ningún archivo seleccionado';
    
    const fileInput = document.getElementById('notaImagen');
    if (fileInput) fileInput.value = '';
}

function previsualizarImagenesNota() {
    const fileInput = document.getElementById('notaImagen');
    const preview = document.getElementById('imagenesPreview');
    const label = document.getElementById('archivosSeleccionados');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        preview.innerHTML = '';
        label.textContent = 'Ningún archivo seleccionado';
        imagenesNotaSeleccionadas = [];
        return;
    }
    
    const archivos = Array.from(fileInput.files);
    label.textContent = `${archivos.length} imagen(es) seleccionada(s)`;
    
    preview.innerHTML = '';
    imagenesNotaSeleccionadas = [];
    
    archivos.forEach((archivo, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagenesNotaSeleccionadas.push(e.target.result);
            
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'preview-imagen-wrapper';
            imgWrapper.style.cssText = 'display: inline-block; position: relative; margin-right: 10px;';
            imgWrapper.innerHTML = `
                <img src="${e.target.result}" alt="Preview" 
                     style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid #e5e7eb;">
                <button type="button" onclick="quitarImagenNota(${index})" 
                        style="position: absolute; top: -5px; right: -5px; width: 24px; height: 24px; 
                               background: #ef4444; color: white; border: none; border-radius: 50%; 
                               cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <span class="material-symbols-rounded" style="font-size: 16px;">close</span>
                </button>
            `;
            preview.appendChild(imgWrapper);
        };
        reader.readAsDataURL(archivo);
    });
}

function quitarImagenNota(index) {
    imagenesNotaSeleccionadas.splice(index, 1);
    
    const fileInput = document.getElementById('notaImagen');
    const dt = new DataTransfer();
    const archivos = Array.from(fileInput.files);
    
    archivos.forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    fileInput.files = dt.files;
    previsualizarImagenesNota();
}

function actualizarContadorNotas() {
    const total = document.querySelectorAll('.nota-card').length;
    const contador = document.getElementById('notasCounter');
    if (contador) {
        contador.textContent = `(${total})`;
    }
}

// ============================================
// PO BOX
// ============================================

function togglePOBox() {
    const checkbox = document.getElementById('tienePOBox');
    const poBoxGroup = document.getElementById('poBoxGroup');
    
    if (checkbox && poBoxGroup) {
        poBoxGroup.style.display = checkbox.checked ? 'block' : 'none';
    }
}

// ============================================
// AUTOGUARDADO
// ============================================

function inicializarAutoguardado() {
    autosaveTimer = setInterval(() => {
        guardarBorradorSilencioso();
    }, AUTOSAVE_INTERVAL);
    
    console.log('💾 Autoguardado activado (cada 30 segundos)');
}

function guardarBorradorSilencioso() {
    const formData = obtenerDatosFormulario();
    localStorage.setItem('borrador_cliente', JSON.stringify(formData));
    
    const indicator = document.getElementById('autosaveIndicator');
    if (indicator) {
        indicator.style.opacity = '1';
        setTimeout(() => {
            indicator.style.opacity = '0.6';
        }, 2000);
    }
    
    console.log('💾 Borrador guardado automáticamente');
}

function cargarBorradorAutomatico() {
    const borrador = localStorage.getItem('borrador_cliente');
    if (borrador && confirm('Se encontró un borrador guardado. ¿Deseas cargarlo?')) {
        try {
            const datos = JSON.parse(borrador);
            rellenarFormularioDesdeObj(datos);
            console.log('✅ Borrador cargado');
        } catch (error) {
            console.error('Error al cargar borrador:', error);
        }
    }
}

function guardarBorrador() {
    const formData = obtenerDatosFormulario();
    localStorage.setItem('borrador_cliente', JSON.stringify(formData));
    alert('✅ Borrador guardado manualmente');
}

function rellenarFormularioDesdeObj(datos) {
    Object.keys(datos).forEach(key => {
        const elemento = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
        if (elemento && datos[key] != null) {
            if (elemento.type === 'checkbox') {
                elemento.checked = datos[key];
            } else {
                elemento.value = datos[key];
            }
        }
    });
}

// ============================================
// SUBMIT DEL FORMULARIO
// ============================================

async function handleSubmit(event) {
    event.preventDefault();
    
    console.log('📤 Iniciando proceso de guardado...');
    
    if (!validarFormularioCompleto()) {
        alert('Por favor, completa todos los campos requeridos correctamente.');
        return;
    }
    
    const confirmacion = confirm('¿Guardar este nuevo cliente y póliza?');
    if (!confirmacion) return;
    
    const btnSubmit = document.querySelector('.btn-submit');
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Guardando...';
    btnSubmit.disabled = true;
    
    try {
        const formData = obtenerDatosFormulario();
        await crearCliente(formData);
    } catch (error) {
        console.error('❌ Error:', error);
        alert(`Error al guardar: ${error.message}`);
        
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
    }
}

function validarFormularioCompleto() {
    const camposRequeridos = [
        { id: 'nombres', nombre: 'Nombres' },
        { id: 'apellidos', nombre: 'Apellidos' },
        { id: 'email', nombre: 'Email' },
        { id: 'telefono1', nombre: 'Teléfono' },
        { id: 'fechaNacimiento', nombre: 'Fecha de nacimiento' },
        { id: 'genero', nombre: 'Género' },
        { id: 'estadoMigratorio', nombre: 'Estado migratorio' },
        { id: 'direccion', nombre: 'Dirección' },
        { id: 'ciudad', nombre: 'Ciudad' },
        { id: 'estado', nombre: 'Estado' },
        { id: 'codigoPostal', nombre: 'Código postal' },
        { id: 'compania', nombre: 'Compañía' },
        { id: 'plan', nombre: 'Plan' }
    ];
    
    for (const campo of camposRequeridos) {
        const elemento = document.getElementById(campo.id);
        if (!elemento || !elemento.value || elemento.value.trim() === '') {
            console.error(`Campo requerido vacío: ${campo.nombre}`);
            alert(`El campo "${campo.nombre}" es requerido`);
            elemento?.focus();
            cambiarTab('info-general');
            return false;
        }
    }
    
    return true;
} 

// ============================================
// CREAR CLIENTE
// ============================================

async function crearCliente(formData) {
    console.log('📝 Creando cliente...');
    
    const clienteData = {
        tipo_registro: formData.tipoRegistro,
        fecha_registro: formData.fechaRegistro,
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        genero: formData.genero,
        email: formData.email,
        telefono1: formData.telefono1.replace(/\D/g, ''),
        telefono2: formData.telefono2 ? formData.telefono2.replace(/\D/g, '') : null,
        fecha_nacimiento: formData.fechaNacimiento,
        estado_migratorio: formData.estadoMigratorio,
        ssn: formData.ssn ? formData.ssn.replace(/\D/g, '') : null,
        ingreso_anual: parseFloat(formData.ingresos) || 0,
        ocupacion: formData.ocupacion || null,
        nacionalidad: formData.ocupacion || null,
        aplica: formData.aplica,
        direccion: formData.direccion,
        casa_apartamento: formData.casaApartamento,
        condado: formData.condado,
        ciudad: formData.ciudad,
        estado: formData.estado,
        codigo_postal: formData.codigoPostal,
        operador_nombre: formData.operadorNombre || null,
        agente_nombre: formData.portalNPN || null,
        observaciones: formData.observaciones || null
    };
    
    const { data: cliente, error: clienteError } = await supabaseClient
        .from('clientes')
        .insert([clienteData])
        .select()
        .single();
    
    if (clienteError) throw clienteError;
    
    console.log('✅ Cliente creado:', cliente.id);
    
    // Guardar dependientes
    await guardarDependientes(cliente.id, formData);

    await guardarDocumentos(cliente.id);

    await guardarNotas(cliente.id);


    const numeroPoliza = await generarNumeroPoliza();
    
    const polizaData = {
        cliente_id: cliente.id,
        numero_poliza: numeroPoliza,
        compania: formData.compania,
        plan: formData.plan,
        prima: parseFloat(formData.prima) || 0,
        credito_fiscal: parseFloat(formData.creditoFiscal) || 0,
        fecha_efectividad: formData.fechaEfectividad,
        fecha_inicial_cobertura: formData.fechaInicialCobertura,
        fecha_final_cobertura: formData.fechaFinalCobertura,
        member_id: formData.memberId || null,
        portal_npn: formData.portalNpn || null,
        clave_seguridad: formData.claveSeguridad || null,
        enlace_poliza: formData.enlacePoliza || null,
        tipo_venta: formData.tipoVenta || null,
        operador_nombre: formData.operadorNombre || null,
        agente_nombre: formData.portalNPN || null,
        estado_compania: 'pendiente',
        estado_mercado: 'pendiente',
        observaciones: formData.observaciones || null,
    };

    // ============================================
// GUARDAR DEPENDIENTES
// ============================================
async function guardarDependientes(clienteId, formData) {
    const dependientes = [];
    
    // Buscar todos los dependientes en el formulario
    for (let i = 1; i <= dependientesCount; i++) {
        const elemento = document.getElementById(`dependiente-${i}`);
        if (!elemento) continue; // Si fue eliminado, saltar
        
        const nombres = formData[`dep_nombres_${i}`];
        if (!nombres) continue; // Si está vacío, saltar
        
        dependientes.push({
            cliente_id: clienteId,
            nombres: nombres,
            apellidos: formData[`dep_apellidos_${i}`] || '',
            fecha_nacimiento: formData[`dep_fecha_nacimiento_${i}`] || null,
            sexo: formData[`dep_genero_${i}`] || null,
            ssn: formData[`dep_ssn_${i}`] ? formData[`dep_ssn_${i}`].replace(/\D/g, '') : null,
            estado_migratorio: formData[`dep_estado_migratorio_${i}`] || null,
            relacion: formData[`dep_relacion_${i}`] || null
        });
    }
    
    // Guardar todos los dependientes
    if (dependientes.length > 0) {
        const { error } = await supabaseClient
            .from('dependientes')
            .insert(dependientes);
        
        if (error) throw error;
        
        console.log(`✅ ${dependientes.length} dependiente(s) guardado(s)`);
    }
}
    // =============================================
    // GUARDAR DOCUMENTOS
    // =============================================
    async function guardarDocumentos(clienteId) {
        const documentosGuardados = [];
        
        // Buscar todos los documentos en el formulario
        for (let i = 1; i <= documentosCount; i++) {
            const elemento = document.getElementById(`documento-${i}`);
            if (!elemento) continue; // Si fue eliminado, saltar
            
            const fileInput = document.querySelector(`[name="doc_archivo_${i}"]`);
            const notasInput = document.querySelector(`[name="doc_notas_${i}"]`);
            
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) continue;
            
            const archivo = fileInput.files[0];
            const notas = notasInput ? notasInput.value : '';
            
            try {
                // 1. Subir archivo a Supabase Storage
                const timestamp = Date.now();
                const nombreArchivo = `${clienteId}/${timestamp}_${archivo.name}`;
                
                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('documentos') // Bucket de storage
                    .upload(nombreArchivo, archivo, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (uploadError) {
                    console.error('Error al subir archivo:', uploadError);
                    continue;
                }
                
                // 2. Obtener URL pública
                const { data: urlData } = supabaseClient.storage
                    .from('documentos')
                    .getPublicUrl(nombreArchivo);
                
                const urlArchivo = urlData.publicUrl;
                
                // 3. Guardar en tabla documentos
                documentosGuardados.push({
                    cliente_id: clienteId,
                    nombre_archivo: archivo.name,
                    url_archivo: urlArchivo,
                    tipo_archivo: archivo.type,
                    tamanio: archivo.size,
                    notas: notas || null
                });
                
            } catch (error) {
                console.error(`Error procesando documento ${i}:`, error);
            }
        }
        
        // Guardar todos los documentos en la BD
        if (documentosGuardados.length > 0) {
            const { error } = await supabaseClient
                .from('documentos')
                .insert(documentosGuardados);
            
            if (error) throw error;
            
            console.log(`✅ ${documentosGuardados.length} documento(s) guardado(s)`);
        }
    }

    // ============================================
    // GUARDAR NOTAS
    // ============================================
    async function guardarNotas(clienteId) {
        const textarea = document.getElementById('nuevaNota');
        const mensaje = textarea ? textarea.value.trim() : '';
        
        // Si no hay mensaje ni imágenes, saltar
        if (!mensaje && imagenesNotaSeleccionadas.length === 0) {
            console.log('No hay notas para guardar');
            return;
        }
        
        try {
            // Obtener usuario actual
            const { data: { user } } = await supabaseClient.auth.getUser();
            
            if (!user) {
                console.warn('No hay usuario autenticado, saltando notas');
                return;
            }
            
            // Preparar data de la nota
            const notaData = {
                cliente_id: clienteId,
                mensaje: mensaje || null,
                imagenes: imagenesNotaSeleccionadas.length > 0 ? imagenesNotaSeleccionadas : null,
                usuario_email: user.email,
                usuario_nombre: user.user_metadata?.nombre || user.email
            };
            
            // Guardar nota
            const { error } = await supabaseClient
                .from('notas')
                .insert([notaData]);
            
            if (error) throw error;
            
            console.log('✅ Nota guardada');
            
            // Limpiar formulario de notas
            if (textarea) textarea.value = '';
            imagenesNotaSeleccionadas = [];
            const preview = document.getElementById('imagenesPreview');
            if (preview) preview.innerHTML = '';
            
        } catch (error) {
            console.error('Error al guardar nota:', error);
            // No lanzar error para no bloquear la creación del cliente
        }
    }
    
    const { data: poliza, error: polizaError } = await supabaseClient
        .from('polizas')
        .insert([polizaData])
        .select()
        .single();
    
    if (polizaError) throw polizaError;
    
    console.log('✅ Póliza creada:', poliza.id);
    
    localStorage.removeItem('borrador_cliente');
    clearInterval(autosaveTimer);
    
    alert(`✅ Cliente y póliza creados exitosamente\n\nCliente: ${cliente.nombres} ${cliente.apellidos}\nPóliza: ${poliza.numero_poliza}`);
    
    window.location.href = './polizas.html';
}

async function generarNumeroPoliza() {
    const anio = new Date().getFullYear();
    
    try {
        const { data, error } = await supabaseClient
            .from('polizas')
            .select('numero_poliza')
            .like('numero_poliza', `POL-${anio}-%`)
            .order('numero_poliza', { ascending: false })
            .limit(1);
        
        if (error) throw error;
        
        let siguiente = 1;
        if (data && data.length > 0) {
            const match = data[0].numero_poliza.match(/POL-\d{4}-(\d+)/);
            if (match) siguiente = parseInt(match[1]) + 1;
        }
        
        return `POL-${anio}-${String(siguiente).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error al generar número:', error);
        return `POL-${anio}-${Date.now().toString().slice(-4)}`;
    }
}

// ============================================
// OBTENER DATOS DEL FORMULARIO
// ============================================

function obtenerDatosFormulario() {
    const form = document.getElementById('clienteForm');
    const formData = new FormData(form);
    
    const datos = {};
    
    for (let [key, value] of formData.entries()) {
        datos[key] = value;
    }
    
    return datos;
}

// ============================================
// CANCELAR
// ============================================

function cancelarFormulario() {
    if (confirm('¿Cancelar y volver? Se perderán los cambios no guardados.')) {
        localStorage.removeItem('borrador_cliente');
        clearInterval(autosaveTimer);
        window.location.href = './polizas.html';
    }
}

// ============================================
// LOG INICIAL
// ============================================

console.log('%c📝 CLIENTE_CREAR.JS CORREGIDO', 'color: #00a8e8; font-size: 16px; font-weight: bold');
console.log('%c✅ Todas las correcciones aplicadas', 'color: #4caf50; font-weight: bold');
console.log('Correcciones:');
console.log('  ✓ Fechas en formato mm/dd/aaaa');
console.log('  ✓ Teléfono límite 10 caracteres');
console.log('  ✓ Fechas automáticas (1° mes siguiente, 12/31/2026)');
console.log('  ✓ Método de pago desplegables funcionando');
console.log('  ✓ Documentos sin tipo (solo archivo + notas)');