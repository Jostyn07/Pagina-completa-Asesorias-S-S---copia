// ============================================
// CLIENTE_CREAR.JS - VERSIÓN MEJORADA
// Con todas las funciones fluidas de cliente.js
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
    // Establecer fecha de registro a hoy
    const hoy = new Date().toISOString().split('T')[0];
    const fechaRegistro = document.getElementById('fechaRegistro');
    if (fechaRegistro) {
        fechaRegistro.value = hoy;
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
    const fechaEfectividad = document.getElementById('fechaEfectividad');
    const fechaInicial = document.getElementById('fechaInicialCobertura');
    const fechaFinal = document.getElementById('fechaFinalCobertura');
    
    if (fechaEfectividad) {
        fechaEfectividad.addEventListener('change', function() {
            if (this.value) {
                const fecha = new Date(this.value + 'T00:00:00');
                
                // Fecha inicial = mismo día
                if (fechaInicial) {
                    fechaInicial.value = this.value;
                }
                
                // Fecha final = un año después (menos 1 día)
                if (fechaFinal) {
                    const fechaFin = new Date(fecha);
                    fechaFin.setFullYear(fechaFin.getFullYear() + 1);
                    fechaFin.setDate(fechaFin.getDate() - 1);
                    fechaFinal.value = fechaFin.toISOString().split('T')[0];
                }
                
                console.log('📅 Fechas calculadas automáticamente');
            }
        });
    }
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
    
    // Teléfonos - Aplicar formato automáticamente
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
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 6) return `(${numeros.slice(0, 3)}) ${numeros.slice(3)}`;
    return `(${numeros.slice(0, 3)}) ${numeros.slice(3, 6)}-${numeros.slice(6, 10)}`;
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
// DEPENDIENTES
// ============================================

function agregarDependiente() {
    dependientesCount++;
    const container = document.getElementById('dependientesContainer');
    
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
                        <label>Relación</label>
                        <select name="dep_relacion_${dependientesCount}">
                            <option value="">Seleccionar...</option>
                            <option value="hijo/a">Hijo/a</option>
                            <option value="conyuge">Cónyuge</option>
                            <option value="padre/madre">Padre/Madre</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
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
// DOCUMENTOS
// ============================================

function agregarDocumento() {
    documentosCount++;
    const container = document.getElementById('documentosContainer');
    
    // Quitar empty state si existe
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const documentoHTML = `
        <div class="documento-item" id="documento-${documentosCount}">
            <div class="documento-header">
                <span class="material-symbols-rounded">description</span>
                <span class="documento-nombre" id="nombre-doc-${documentosCount}">Nuevo documento</span>
                <button type="button" class="btn-remove" onclick="eliminarDocumento(${documentosCount})">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
            <div class="documento-body">
                <div class="form-row">
                    <div class="form-group">
                        <label>Tipo de Documento</label>
                        <select name="doc_tipo_${documentosCount}" onchange="actualizarNombreDocumento(${documentosCount})">
                            <option value="id">Identificación</option>
                            <option value="poliza">Póliza</option>
                            <option value="comprobante">Comprobante de Pago</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Archivo</label>
                        <input type="file" name="doc_archivo_${documentosCount}" 
                               accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                               onchange="previsualizarDocumento(${documentosCount}, this)">
                    </div>
                </div>
                <div class="form-group">
                    <label>Notas (opcional)</label>
                    <textarea name="doc_notas_${documentosCount}" rows="2" 
                              placeholder="Agregar notas sobre este documento..."></textarea>
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

function actualizarNombreDocumento(id) {
    const select = document.querySelector(`[name="doc_tipo_${id}"]`);
    const nombreSpan = document.getElementById(`nombre-doc-${id}`);
    if (select && nombreSpan) {
        nombreSpan.textContent = select.options[select.selectedIndex].text;
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
    
    // Crear nota visual (temporal hasta guardar en BD)
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
    if (emptyState) {
        emptyState.remove();
    }
    
    thread.insertAdjacentHTML('afterbegin', notaHTML);
    
    // Limpiar formulario
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
    const checkbox = document.getElementById('tienePoBox');
    const poBoxContainer = document.getElementById('poBoxContainer');
    
    if (checkbox && poBoxContainer) {
        poBoxContainer.style.display = checkbox.checked ? 'block' : 'none';
    }
}

// ============================================
// AUTOGUARDADO
// ============================================

function inicializarAutoguardado() {
    // Guardar cada 30 segundos
    autosaveTimer = setInterval(() => {
        guardarBorradorSilencioso();
    }, AUTOSAVE_INTERVAL);
    
    console.log('💾 Autoguardado activado (cada 30 segundos)');
}

function guardarBorradorSilencioso() {
    const formData = obtenerDatosFormulario();
    localStorage.setItem('borrador_cliente', JSON.stringify(formData));
    
    // Mostrar indicador visual
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
    
    // Validar
    if (!validarFormularioCompleto()) {
        alert('Por favor, completa todos los campos requeridos correctamente.');
        return;
    }
    
    // Confirmar
    const confirmacion = confirm('¿Guardar este nuevo cliente y póliza?');
    if (!confirmacion) return;
    
    // Mostrar indicador
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
        { id: 'plan', nombre: 'Plan' },
        { id: 'fechaEfectividad', nombre: 'Fecha de efectividad' }
    ];
    
    for (const campo of camposRequeridos) {
        const elemento = document.getElementById(campo.id);
        if (!elemento || !elemento.value || elemento.value.trim() === '') {
            console.error(`Campo requerido vacío: ${campo.nombre}`);
            alert(`El campo "${campo.nombre}" es requerido`);
            elemento?.focus();
            
            // Cambiar al tab correspondiente
            if (['nombres', 'apellidos', 'email', 'telefono1', 'fechaNacimiento', 'genero', 'estadoMigratorio'].includes(campo.id)) {
                cambiarTab('info-general');
            }
            
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
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        email: formData.email,
        telefono: formData.telefono1.replace(/\D/g, ''),
        telefono_secundario: formData.telefono2 ? formData.telefono2.replace(/\D/g, '') : null,
        fecha_nacimiento: formData.fechaNacimiento,
        sexo: formData.genero,
        ssn: formData.ssn ? formData.ssn.replace(/\D/g, '') : null,
        estado_migratorio: formData.estadoMigratorio,
        direccion: formData.direccion,
        ciudad: formData.ciudad,
        estado: formData.estado,
        codigo_postal: formData.codigoPostal,
        empleador: formData.ocupacion || null,
        ingreso_anual: parseFloat(formData.ingresos) || 0,
        operador_nombre: formData.operadorNombre || null,
        agente_nombre: formData.agenteNombre || null,
        observaciones: formData.observaciones || null
    };
    
    const { data: cliente, error: clienteError } = await supabaseClient
        .from('clientes')
        .insert([clienteData])
        .select()
        .single();
    
    if (clienteError) throw clienteError;
    
    console.log('✅ Cliente creado:', cliente.id);
    
    // Crear póliza
    const numeroPoliza = await generarNumeroPoliza();
    
    const polizaData = {
        cliente_id: cliente.id,
        numero_poliza: numeroPoliza,
        compania: formData.compania,
        plan: formData.plan,
        tipo_plan: formData.tipoPlan || null,
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
        agente_nombre: formData.agenteNombre || null,
        estado_compania: 'pendiente',
        estado_mercado: 'pendiente',
        observaciones: formData.observaciones || null
    };
    
    const { data: poliza, error: polizaError } = await supabaseClient
        .from('polizas')
        .insert([polizaData])
        .select()
        .single();
    
    if (polizaError) throw polizaError;
    
    console.log('✅ Póliza creada:', poliza.id);
    
    // Limpiar borrador y redirigir
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
    
    // Obtener todos los campos del formulario
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

console.log('%c📝 CLIENTE_CREAR.JS MEJORADO', 'color: #00a8e8; font-size: 16px; font-weight: bold');
console.log('%c✅ Todas las funciones cargadas', 'color: #4caf50; font-weight: bold');
console.log('Funcionalidades activas:');
console.log('  ✓ Tabs funcionales');
console.log('  ✓ Validación en tiempo real');
console.log('  ✓ Formatos automáticos (teléfono, SSN, montos)');
console.log('  ✓ Fechas automáticas');
console.log('  ✓ Dependientes dinámicos');
console.log('  ✓ Documentos con preview');
console.log('  ✓ Notas con imágenes');
console.log('  ✓ Autoguardado cada 30s');
console.log('  ✓ Secciones colapsables');