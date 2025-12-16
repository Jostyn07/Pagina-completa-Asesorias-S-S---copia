// ============================================
// VARIABLES GLOBALES
// ============================================
let dependientesCount = 0;
let documentosCount = 0;
let notasCount = 0;
let imagenesPrevisualizadas = [];
let autosaveTimer = null;
const AUTOSAVE_INTERVAL = 30000; // 30 segundos

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    inicializarFormulario();
    inicializarTabs();
    calcularFechasAutomaticas();
    inicializarValidacionTiempoReal();
    inicializarAutoguardado();
    verificarModoEdicion();
    
    // Event listener para submit del formulario
    document.getElementById('clienteForm').addEventListener('submit', handleSubmit);
});

function inicializarFormulario() {
    // Establecer fecha de registro a hoy
    const hoy = new Date();
    document.getElementById('fechaRegistro').value = formatearFecha(hoy);
    
    // Inicializar inputs numéricos en 0
    document.getElementById('ingresos').value = 0;
    document.getElementById('creditoFiscal').value = 0;
}

function verificarModoEdicion() {
    // Verificar si hay un ID en la URL (modo editar)
    const urlParams = new URLSearchParams(window.location.search);
    const clienteId = urlParams.get('id');
    
    if (clienteId) {
        // Modo EDITAR
        document.getElementById('pageTitle').textContent = `Editando Cliente #${clienteId}`;
        document.querySelector('.btn-submit').innerHTML = `
            <span class="material-symbols-rounded">check_circle</span>
            Actualizar Cliente
        `;
        
        // Mostrar tabs adicionales (Estado y Comisiones para admin)
        mostrarTabsEdicion();
        
        // Cargar datos del cliente
        cargarDatosCliente(clienteId);
    } else {
        // Modo CREAR
        // Ocultar tabs de Estado y Comisiones
        document.querySelector('.tab-estado').style.display = 'none';
        document.querySelector('.tab-comisiones').style.display = 'none';
    }
}

function mostrarTabsEdicion() {
    document.querySelector('.tab-estado').style.display = 'flex';
    
    // Solo mostrar comisiones si es admin
    const usuario = obtenerUsuario();
    if (usuario && usuario.rol === 'admin') {
        document.querySelector('.tab-comisiones').style.display = 'flex';
    }
}

function cargarDatosCliente(clienteId) {
    // TODO: Aquí iría la lógica para cargar datos desde la base de datos
    
    // Por ahora, datos de ejemplo
    // En producción, esto vendría de una API
}

// ============================================
// SISTEMA DE TABS
// ============================================
function inicializarTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.disabled) return;
            
            const tabName = this.getAttribute('data-tab');
            cambiarTab(tabName);
        });
    });
}

function cambiarTab(tabName) {
    // Remover clase active de todos los botones y contenidos
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activar el tab seleccionado
    const boton = document.querySelector(`[data-tab="${tabName}"]`);
    const contenido = document.getElementById(`tab-${tabName}`);
    
    if (boton && contenido) {
        boton.classList.add('active');
        contenido.classList.add('active');
    }
}

// ============================================
// SECCIONES COLAPSABLES
// ============================================
function toggleSection(headerElement) {
    headerElement.classList.toggle('collapsed');
}

// ============================================
// FECHAS AUTOMÁTICAS
// ============================================
function calcularFechasAutomaticas() {
    const hoy = new Date();
    
    // Calcular próximo mes (día 1)
    const proximoMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    
    // Fecha inicial: 1° del próximo mes
    const fechaInicial = proximoMes;
    
    // Fecha final: último día del mes, 11 meses después
    const fechaFinal = new Date(proximoMes.getFullYear(), proximoMes.getMonth() + 12, 0);
    
    // Fecha efectividad: mismo que fecha inicial
    const fechaEfectividad = fechaInicial;
    
    // Mostrar en la UI
    document.getElementById('displayFechaInicial').textContent = formatearFecha(fechaInicial);
    document.getElementById('displayFechaFinal').textContent = formatearFecha(fechaFinal);
    document.getElementById('displayFechaEfectividad').textContent = formatearFecha(fechaEfectividad);
    
    // Guardar en hidden inputs para el form
    document.getElementById('fechaInicialCobertura').value = formatearFechaISO(fechaInicial);
    document.getElementById('fechaFinalCobertura').value = formatearFechaISO(fechaFinal);
    document.getElementById('fechaEfectividad').value = formatearFechaISO(fechaEfectividad);
}

function formatearFecha(fecha) {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const año = fecha.getFullYear();
    return `${mes}/${dia}/${año}`;
}

function formatearFechaISO(fecha) {
    return fecha.toISOString().split('T')[0];
}

// ============================================
// VALIDACIÓN EN TIEMPO REAL
// ============================================
function inicializarValidacionTiempoReal() {
    // Email
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('input', function() {
        validarEmail(this);
    });
    
    // Teléfonos
    const telefono1 = document.getElementById('telefono1');
    const telefono2 = document.getElementById('telefono2');
    telefono1.addEventListener('input', function() {
        validarTelefono(this);
    });
    telefono2.addEventListener('input', function() {
        validarTelefono(this);
    });
    
    // SSN
    const ssnInput = document.getElementById('ssn');
    ssnInput.addEventListener('input', function() {
        validarSSN(this);
    });
    
    // Código Postal
    const codigoPostal = document.getElementById('codigoPostal');
    codigoPostal.addEventListener('input', function() {
        validarCodigoPostal(this);
    });
    
    // Prima
    const prima = document.getElementById('prima');
    prima.addEventListener('input', function() {
        validarNumero(this);
    });
}

function validarEmail(input) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mensaje = input.nextElementSibling;
    
    if (input.value === '') {
        input.classList.remove('valid', 'invalid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '';
        }
        return true;
    }
    
    if (regex.test(input.value)) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '';
        }
        return true;
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '❌ Email inválido';
        }
        return false;
    }
}

function validarTelefono(input) {
    // Eliminar todo excepto números
    let valor = input.value.replace(/\D/g, '');
    const mensaje = input.nextElementSibling;
    
    if (valor === '') {
        input.classList.remove('valid', 'invalid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '';
        }
        return true;
    }
    
    // Formatear con paréntesis y guiones: (305) 123-4567
    if (valor.length >= 3) {
        valor = `(${valor.slice(0, 3)}) ${valor.slice(3)}`;
    }
    if (valor.length >= 9) {
        valor = `${valor.slice(0, 9)}-${valor.slice(9, 13)}`;
    }
    
    input.value = valor;
    
    // Validar longitud (debe tener 10 dígitos)
    const numeros = input.value.replace(/\D/g, '');
    if (numeros.length === 10) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '';
        }
        return true;
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '⚠️ Debe tener 10 dígitos';
        }
        return false;
    }
}

function validarSSN(input) {
    // Formatear: XXX-XX-XXXX
    let valor = input.value.replace(/\D/g, '');
    const mensaje = input.nextElementSibling;
    
    if (valor === '') {
        input.classList.remove('valid', 'invalid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '';
        }
        return true;
    }
    
    if (valor.length >= 3) {
        valor = `${valor.slice(0, 3)}-${valor.slice(3)}`;
    }
    if (valor.length >= 6) {
        valor = `${valor.slice(0, 6)}-${valor.slice(6, 10)}`;
    }
    
    input.value = valor;
    
    const numeros = input.value.replace(/\D/g, '');
    if (numeros.length === 9) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '';
        }
        return true;
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '⚠️ Formato: XXX-XX-XXXX';
        }
        return false;
    }
}

function validarCodigoPostal(input) {
    const valor = input.value.replace(/\D/g, '');
    const mensaje = input.nextElementSibling;
    
    input.value = valor;
    
    if (valor === '') {
        input.classList.remove('valid', 'invalid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '';
        }
        return true;
    }
    
    if (valor.length === 5) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '';
        }
        return true;
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '⚠️ Debe tener 5 dígitos';
        }
        return false;
    }
}

function validarNumero(input) {
    const mensaje = input.nextElementSibling;
    const valor = parseFloat(input.value);
    
    if (isNaN(valor) || valor < 0) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '❌ Solo números positivos';
        }
        return false;
    } else {
        input.classList.remove('invalid');
        input.classList.add('valid');
        if (mensaje && mensaje.classList.contains('validation-message')) {
            mensaje.textContent = '';
        }
        return true;
    }
}

// ============================================
// PO BOX
// ============================================
function togglePOBox() {
    const checkbox = document.getElementById('tienePOBox');
    const poBoxGroup = document.getElementById('poBoxGroup');
    
    if (checkbox.checked) {
        poBoxGroup.style.display = 'block';
    } else {
        poBoxGroup.style.display = 'none';
        document.getElementById('poBox').value = '';
    }
}

// ============================================
// DEPENDIENTES
// ============================================
function agregarDependiente() {
    dependientesCount++;
    
    const container = document.getElementById('dependientesContainer');
    
    // Remover empty state si existe
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const dependienteHTML = `
        <div class="dependiente-card" id="dependiente-${dependientesCount}">
            <div class="dependiente-header">
                <h3>Dependiente ${dependientesCount}</h3>
                <button type="button" class="btn-delete" onclick="eliminarDependiente(${dependientesCount})">
                    <span class="material-symbols-rounded">delete</span>
                    Eliminar
                </button>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Nombres <span class="required">*</span></label>
                    <input type="text" name="dependiente_${dependientesCount}_nombres" placeholder="Nombres" required>
                </div>
                <div class="form-group">
                    <label>Apellidos <span class="required">*</span></label>
                    <input type="text" name="dependiente_${dependientesCount}_apellidos" placeholder="Apellidos" required>
                </div>
                <div class="form-group">
                    <label>Relación <span class="required">*</span></label>
                    <select name="dependiente_${dependientesCount}_relacion" required>
                        <option value="">Selecciona...</option>
                        <option value="esposa">Esposa</option>
                        <option value="esposo">Esposo</option>
                        <option value="hijo">Hijo</option>
                        <option value="hija">Hija</option>
                        <option value="otro">Otro</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Fecha de nacimiento <span class="required">*</span></label>
                    <input type="date" name="dependiente_${dependientesCount}_fechaNacimiento" required>
                </div>
                <div class="form-group">
                    <label>SSN</label>
                    <input type="text" name="dependiente_${dependientesCount}_ssn" placeholder="XXX-XX-XXXX" maxlength="11">
                </div>
                <div class="form-group">
                    <label>Género <span class="required">*</span></label>
                    <select name="dependiente_${dependientesCount}_genero" required>
                        <option value="">Selecciona...</option>
                        <option value="masculino">Masculino</option>
                        <option value="femenino">Femenino</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Aplicante <span class="required">*</span></label>
                    <select name="dependiente_${dependientesCount}_aplicante" required>
                        <option value="">Selecciona...</option>
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', dependienteHTML);
    actualizarContadorDependientes();
}

function eliminarDependiente(id) {
    const confirmacion = confirm('¿Estás seguro de eliminar este dependiente?');
    if (confirmacion) {
        const elemento = document.getElementById(`dependiente-${id}`);
        elemento.remove();
        
        // Si no quedan dependientes, mostrar empty state
        const container = document.getElementById('dependientesContainer');
        if (container.children.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">family_restroom</span>
                    <p>No hay dependientes agregados</p>
                    <small>Haz clic en "Agregar Dependiente" para comenzar</small>
                </div>
            `;
        }
        
        actualizarContadorDependientes();
    }
}

function actualizarContadorDependientes() {
    const container = document.getElementById('dependientesContainer');
    const count = container.querySelectorAll('.dependiente-card').length;
    document.getElementById('dependientesCounter').textContent = `(${count})`;
}

// ============================================
// MÉTODO DE PAGO
// ============================================
function mostrarFormularioPago(tipo) {
    // Ocultar todos los formularios
    document.getElementById('formBanco').style.display = 'none';
    document.getElementById('formTarjeta').style.display = 'none';
    
    // Mostrar el seleccionado
    if (tipo === 'banco') {
        document.getElementById('formBanco').style.display = 'block';
    } else if (tipo === 'tarjeta') {
        document.getElementById('formTarjeta').style.display = 'block';
    }
}

function limpiarMetodoPago() {
    // Desmarcar radio buttons
    document.querySelectorAll('input[name="metodoPago"]').forEach(radio => {
        radio.checked = false;
    });
    
    // Ocultar formularios
    document.getElementById('formBanco').style.display = 'none';
    document.getElementById('formTarjeta').style.display = 'none';
    
    // Limpiar campos
    document.getElementById('nombreBanco').value = '';
    document.getElementById('numeroCuenta').value = '';
    document.getElementById('routingNumber').value = '';
    document.getElementById('nombreCuenta').value = '';
    document.getElementById('numeroTarjeta').value = '';
    document.getElementById('nombreTarjeta').value = '';
    document.getElementById('fechaExpiracion').value = '';
    document.getElementById('cvv').value = '';
    document.getElementById('tipoTarjeta').value = '';
}

// ============================================
// COMISIONES
// ============================================
document.addEventListener('input', function(e) {
    if (e.target.id && e.target.id.startsWith('comision')) {
        calcularTotalComisiones();
    }
});

function calcularTotalComisiones() {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    let total = 0;
    let mesesConComision = 0;
    
    meses.forEach(mes => {
        const input = document.getElementById(`comision${mes}`);
        if (input) {
            const valor = parseFloat(input.value) || 0;
            total += valor;
            if (valor > 0) mesesConComision++;
        }
    });
    
    const promedio = mesesConComision > 0 ? total / mesesConComision : 0;
    
    document.getElementById('totalAnual').textContent = `$${total.toFixed(2)}`;
    document.getElementById('promedioMensual').textContent = `$${promedio.toFixed(2)}`;
    document.getElementById('mesesConComision').textContent = `${mesesConComision}/12`;
}

// ============================================
// DOCUMENTOS
// ============================================
function agregarDocumento() {
    documentosCount++;
    
    const container = document.getElementById('documentosContainer');
    
    // Remover empty state si existe
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const documentoHTML = `
        <div class="documento-card" id="documento-${documentosCount}">
            <div class="documento-header">
                <h3>
                    <span class="material-symbols-rounded">description</span>
                    Archivo ${documentosCount}
                </h3>
                <button type="button" class="btn-delete" onclick="eliminarDocumento(${documentosCount})">
                    <span class="material-symbols-rounded">delete</span>
                    Eliminar
                </button>
            </div>
            
            <div class="form-row">
                <div class="form-group full-width">
                    <label>Nombre del archivo en base de datos <span class="required">*</span></label>
                    <input type="text" name="documento_${documentosCount}_nombre" placeholder="Ej: Identificación Juan Pérez" required>
                    <small class="helper-text">Se usará como nombre final en base de datos</small>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group full-width">
                    <label>Seleccionar archivo</label>
                    <input type="file" name="documento_${documentosCount}_archivo" onchange="actualizarNombreArchivo(this, ${documentosCount})">
                    <span id="nombreArchivo-${documentosCount}" class="helper-text">Ningún archivo seleccionado</span>
                </div>
            </div>
            
            <div class="documento-status" id="status-${documentosCount}" style="display: none;">
                <span>Estado: <strong>Pendiente</strong></span>
                <span>•</span>
                <span>Tamaño: <strong id="tamano-${documentosCount}">--</strong></span>
                <span>•</span>
                <span>Fecha: <strong>${formatearFecha(new Date())}</strong></span>
            </div>
            
            <div class="documento-actions" id="actions-${documentosCount}" style="display: none;">
                <button type="button" class="btn-secondary" onclick="verDocumento(${documentosCount})">
                    <span class="material-symbols-rounded">visibility</span>
                    Ver archivo
                </button>
                <button type="button" class="btn-secondary" onclick="descargarDocumento(${documentosCount})">
                    <span class="material-symbols-rounded">download</span>
                    Descargar
                </button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', documentoHTML);
    actualizarContadorDocumentos();
}

function eliminarDocumento(id) {
    const confirmacion = confirm('¿Estás seguro de eliminar este documento?');
    if (confirmacion) {
        const elemento = document.getElementById(`documento-${id}`);
        elemento.remove();
        
        // Si no quedan documentos, mostrar empty state
        const container = document.getElementById('documentosContainer');
        if (container.children.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">upload_file</span>
                    <p>No hay documentos cargados</p>
                    <small>Haz clic en "Agregar Archivo" para comenzar</small>
                </div>
            `;
        }
        
        actualizarContadorDocumentos();
    }
}

function actualizarNombreArchivo(input, id) {
    const nombreSpan = document.getElementById(`nombreArchivo-${id}`);
    if (input.files.length > 0) {
        const archivo = input.files[0];
        nombreSpan.textContent = archivo.name;
        
        // Mostrar status y acciones
        const status = document.getElementById(`status-${id}`);
        const actions = document.getElementById(`actions-${id}`);
        status.style.display = 'flex';
        actions.style.display = 'flex';
        
        // Actualizar tamaño
        const tamanoMB = (archivo.size / (1024 * 1024)).toFixed(2);
        document.getElementById(`tamano-${id}`).textContent = `${tamanoMB} MB`;
    } else {
        nombreSpan.textContent = 'Ningún archivo seleccionado';
    }
}

function actualizarContadorDocumentos() {
    const container = document.getElementById('documentosContainer');
    const count = container.querySelectorAll('.documento-card').length;
    document.getElementById('documentosCounter').textContent = `(${count})`;
}

function verDocumento(id) {
    alert(`Funcionalidad de visualización - Documento ${id}`);
    // TODO: Implementar preview del documento
}

function descargarDocumento(id) {
    alert(`Descargando documento ${id}...`);
    // TODO: Implementar descarga del documento
}

// ============================================
// NOTAS
// ============================================
function previsualizarImagenesNota() {
    const input = document.getElementById('notaImagen');
    const preview = document.getElementById('imagenesPreview');
    const archivosSpan = document.getElementById('archivosSeleccionados');
    
    // Limpiar preview anterior
    preview.innerHTML = '';
    imagenesPrevisualizadas = [];
    
    if (input.files.length > 0) {
        archivosSpan.textContent = `${input.files.length} archivo(s) seleccionado(s)`;
        
        Array.from(input.files).forEach((file, index) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                imagenesPrevisualizadas.push({
                    file: file,
                    data: e.target.result
                });
                
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="Preview ${index + 1}">
                    <span class="preview-remove" onclick="eliminarImagenPreview(${index})">✕</span>
                `;
                
                preview.appendChild(previewItem);
            };
            
            reader.readAsDataURL(file);
        });
    } else {
        archivosSpan.textContent = 'Ningún archivo seleccionado';
    }
}

function eliminarImagenPreview(index) {
    imagenesPrevisualizadas.splice(index, 1);
    
    // Recrear el input file con los archivos restantes
    const input = document.getElementById('notaImagen');
    const dt = new DataTransfer();
    
    imagenesPrevisualizadas.forEach(img => {
        dt.items.add(img.file);
    });
    
    input.files = dt.files;
    previsualizarImagenesNota();
}

function enviarNota() {
    const textarea = document.getElementById('nuevaNota');
    const contenido = textarea.value.trim();
    
    if (contenido === '') {
        alert('Por favor, escribe un mensaje');
        return;
    }
    
    // Obtener usuario actual
    const usuario = obtenerUsuario();
    const thread = document.getElementById('notasThread');
    
    // Remover empty state si existe
    const emptyState = thread.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    // Crear nota
    const ahora = new Date();
    const notaHTML = `
        <div class="nota-item">
            <div class="nota-header">
                <div class="nota-autor">
                    <div class="nota-avatar">${usuario.nombre.charAt(0)}</div>
                    <div class="nota-info">
                        <h4>${usuario.nombre} <span class="nota-rol ${usuario.rol || 'operador'}">${usuario.rol || 'Operador'}</span></h4>
                    </div>
                </div>
                <span class="nota-fecha">${formatearFechaHora(ahora)}</span>
            </div>
            <div class="nota-contenido">${contenido}</div>
            ${imagenesPrevisualizadas.length > 0 ? generarImagenesNotaHTML() : ''}
        </div>
    `;
    
    thread.insertAdjacentHTML('afterbegin', notaHTML);
    
    // Limpiar formulario
    textarea.value = '';
    document.getElementById('notaImagen').value = '';
    document.getElementById('imagenesPreview').innerHTML = '';
    document.getElementById('archivosSeleccionados').textContent = 'Ningún archivo seleccionado';
    imagenesPrevisualizadas = [];
    
    // Actualizar contador
    notasCount++;
    actualizarContadorNotas();
    
    // Scroll al inicio del thread
    thread.scrollTop = 0;
}

function generarImagenesNotaHTML() {
    let html = '<div class="nota-imagenes">';
    
    imagenesPrevisualizadas.forEach((img, index) => {
        html += `<img src="${img.data}" alt="Imagen ${index + 1}" class="nota-imagen" onclick="ampliarImagen('${img.data}')">`;
    });
    
    html += '</div>';
    return html;
}

function ampliarImagen(src) {
    // TODO: Implementar modal para ver imagen en grande
    window.open(src, '_blank');
}

function cancelarNota() {
    const confirmacion = confirm('¿Descartar esta nota?');
    if (confirmacion) {
        document.getElementById('nuevaNota').value = '';
        document.getElementById('notaImagen').value = '';
        document.getElementById('imagenesPreview').innerHTML = '';
        document.getElementById('archivosSeleccionados').textContent = 'Ningún archivo seleccionado';
        imagenesPrevisualizadas = [];
    }
}

function actualizarContadorNotas() {
    const thread = document.getElementById('notasThread');
    const count = thread.querySelectorAll('.nota-item').length;
    document.getElementById('notasCounter').textContent = `(${count})`;
}

function formatearFechaHora(fecha) {
    const opciones = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    return fecha.toLocaleString('es-US', opciones);
}

// ============================================
// AUTOGUARDADO
// ============================================
function inicializarAutoguardado() {
    // Escuchar cambios en el formulario
    const form = document.getElementById('clienteForm');
    form.addEventListener('input', function() {
        reiniciarTimerAutoguardado();
    });
}

function reiniciarTimerAutoguardado() {
    // Cancelar timer anterior si existe
    if (autosaveTimer) {
        clearTimeout(autosaveTimer);
    }
    
    // Iniciar nuevo timer
    autosaveTimer = setTimeout(function() {
        guardarBorradorAutomatico();
    }, AUTOSAVE_INTERVAL);
}

function guardarBorradorAutomatico() {
    const indicator = document.getElementById('autosaveIndicator');
    const text = document.getElementById('autosaveText');
    
    // Cambiar a estado "guardando"
    indicator.classList.remove('saved');
    indicator.classList.add('saving');
    indicator.querySelector('.material-symbols-rounded').textContent = 'cloud_sync';
    text.textContent = 'Guardando borrador...';
    
    // Obtener datos del formulario
    const formData = obtenerDatosFormulario();
    
    // Simular guardado (en producción iría a la API)
    setTimeout(function() {
        // Guardar en localStorage
        localStorage.setItem('borrador_cliente', JSON.stringify({
            data: formData,
            timestamp: new Date().toISOString()
        }));
        
        // Cambiar a estado "guardado"
        indicator.classList.remove('saving');
        indicator.classList.add('saved');
        indicator.querySelector('.material-symbols-rounded').textContent = 'cloud_done';
        
        const ahora = new Date();
        text.textContent = `Borrador guardado (${ahora.toLocaleTimeString()})`;
        
    }, 1000);
}

function guardarBorrador() {
    const confirmacion = confirm('¿Guardar como borrador?\n\nPodrás recuperar estos datos más tarde.');
    if (confirmacion) {
        guardarBorradorAutomatico();
        alert('Borrador guardado correctamente');
    }
}

function obtenerDatosFormulario() {
    const form = document.getElementById('clienteForm');
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    return data;
}

// =============================================
// FUNCIONES AUXILIARES PARA MÉTODO DE PAGO
// =============================================
function obtenerMetodoPago() {
    const metodoSeleccionado = document.querySelector('input[name="metodoPago"]:checked');
    if (!metodoSeleccionado) return null;
    
    const tipo = metodoSeleccionado.value;
    
    if (tipo === 'banco') {
        return {
            tipo: 'banco',
            nombreBanco: document.getElementById('nombreBanco').value,
            numeroCuenta: document.getElementById('numeroCuenta').value,
            routingNumber: document.getElementById('routingNumber').value,
            nombreCuenta: document.getElementById('nombreCuenta').value,
            usarMismaDireccion: document.getElementById('usarMismaDireccion').checked
        };
    } else if (tipo === 'tarjeta') {
        return {
            tipo: 'tarjeta',
            numeroTarjeta: document.getElementById('numeroTarjeta').value,
            nombreTarjeta: document.getElementById('nombreTarjeta').value,
            fechaExpiracion: document.getElementById('fechaExpiracion').value,
            cvv: document.getElementById('cvv').value,
            tipoTarjeta: document.getElementById('tipoTarjeta').value,
            usarMismaDireccion: document.getElementById('usarMismaDireccion').checked
        };
    }
    
    return null;
}

// ============================================
// SUBMIT DEL FORMULARIO
// ============================================
// Línea ~825 en cliente.js
async function handleSubmit(event) {
    event.preventDefault();
    
    // Validar formulario
    if (!validarFormularioCompleto()) {
        alert('Por favor, completa todos los campos requeridos correctamente.');
        return;
    }
    
    // Confirmar envío
    const confirmacion = confirm('¿Guardar este cliente?\n\nSe procesará la información ingresada.');
    if (!confirmacion) return;
    
    try {
        // Mostrar loading
        mostrarIndicadorGuardando();
        
        // Obtener datos del formulario
        const formData = obtenerDatosFormulario();
        
        // 🔥 GUARDAR EN SUPABASE
        const resultado = await guardarClienteEnSupabase(formData);
        
        // Guardar dependientes si hay
        if (dependientesCount > 0) {
            await guardarDependientes(resultado.cliente.id);
        }
        
        // Guardar método de pago si hay
        const metodoPago = obtenerMetodoPago();
        if (metodoPago) {
            await guardarMetodoPago(resultado.cliente.id, metodoPago);
        }
        
        // Limpiar borrador
        localStorage.removeItem('borrador_cliente');
        
        // Ocultar loading
        ocultarIndicadorGuardando();
        
        // Mostrar éxito
        alert('✅ Cliente guardado correctamente');
        
        // Redirigir
        window.location.href = './polizas.html';
        
    } catch (error) {
        console.error('❌ Error al guardar:', error);
        ocultarIndicadorGuardando();
        alert('❌ Error al guardar cliente: ' + error.message);
    }
}

function mostrarIndicadorGuardando() {
    const indicator = document.getElementById('autosaveIndicator');
    const text = document.getElementById('autosaveText');
    indicator.classList.add('saving');
    indicator.querySelector('.material-symbols-rounded').textContent = 'sync';
    text.textContent = 'Guardando...';
}

function ocultarIndicadorGuardando() {
    const indicator = document.getElementById('autosaveIndicator');
    indicator.classList.remove('saving');
}

function validarFormularioCompleto() {
    const camposRequeridos = document.querySelectorAll('[required]');
    let esValido = true;
    
    camposRequeridos.forEach(campo => {
        if (!campo.value || campo.value === '') {
            campo.classList.add('invalid');
            esValido = false;
        } else {
            campo.classList.remove('invalid');
        }
    });
    
    return esValido;
}

function cancelarFormulario() {
    const confirmacion = confirm('¿Cancelar y volver a Pólizas?\n\nSe perderán los cambios no guardados.');
    if (confirmacion) {
        window.location.href = './polizas.html';
    }
}

// ============================================
// LOG DE DESARROLLO
// ============================================