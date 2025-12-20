// ============================================
// CLIENTE_CREAR.JS - VERSIÓN COMPLETA
// ============================================

// Variables globales
let imagenesNotaSeleccionadas = [];

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📝 Modo: CREAR NUEVO CLIENTE');
    
    inicializarFormulario();
    inicializarTabs();
    calcularFechasAutomaticas();
    inicializarValidacionTiempoReal();
    
    document.getElementById('clienteForm').addEventListener('submit', handleSubmit);
    
    // Cargar borrador si existe
    cargarBorradorAutomatico();
    
    console.log('✅ Formulario inicializado');
});

function inicializarFormulario() {
    // Configurar fecha de registro
    const hoy = new Date().toISOString().split('T')[0];
    if (document.getElementById('fechaRegistro')) {
        document.getElementById('fechaRegistro').value = hoy;
    }
}

// ============================================
// TABS NAVEGACIÓN
// ============================================

function inicializarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    console.log('📑 Tabs encontrados:', tabs.length);
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => cambiarTab(tab.dataset.tab));
    });
}

function cambiarTab(tabName) {
    console.log('🔄 Cambiando a tab:', tabName);
    
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Desactivar todos los botones de tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activar el tab seleccionado
    const tabContent = document.getElementById(`tab-${tabName}`);
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (tabContent) {
        tabContent.classList.add('active');
    }
    if (tabButton) {
        tabButton.classList.add('active');
    }
}

// ============================================
// SECCIONES COLAPSABLES
// ============================================

function toggleSection(header) {
    const section = header.parentElement;
    section.classList.toggle('collapsed');
}

// ============================================
// MANEJO DEL FORMULARIO - SUBMIT
// ============================================

async function handleSubmit(event) {
    event.preventDefault();
    
    console.log('📤 Iniciando proceso de guardado...');
    
    // Validar formulario
    if (!validarFormularioCompleto()) {
        alert('Por favor, completa todos los campos requeridos correctamente.');
        return;
    }
    
    // Confirmar creación
    const confirmacion = confirm('¿Guardar este nuevo cliente?\n\nSe procesará la información ingresada.');
    if (!confirmacion) return;
    
    // Mostrar indicador de carga
    const btnSubmit = document.querySelector('.btn-submit');
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Guardando...';
    btnSubmit.disabled = true;
    
    // Obtener datos
    const formData = obtenerDatosFormulario();
    
    console.log('📋 Datos del nuevo cliente:', formData);
    
    try {
        await crearCliente(formData);
    } catch (error) {
        console.error('❌ Error al crear:', error);
        alert(`Error al crear cliente: ${error.message}`);
        
        // Restaurar botón
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
    }
}

// ============================================
// CREAR CLIENTE Y PÓLIZA
// ============================================

async function crearCliente(formData) {
    console.log('📝 Creando nuevo cliente...');
    
    const clienteData = {
        // Información personal
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        email: formData.email,
        telefono: formData.telefono,
        telefono_secundario: formData.telefono_secundario || null,
        fecha_nacimiento: formData.fechaNacimiento,
        sexo: formData.genero,
        ssn: formData.ssn || null,
        estado_migratorio: formData.estadoMigratorio,
        
        // Dirección
        direccion: formData.direccion,
        ciudad: formData.ciudad,
        estado: formData.estado,
        codigo_postal: formData.codigoPostal,
        
        // Información laboral
        empleador: formData.ocupacion || null,
        ingreso_anual: parseFloat(formData.ingresos) || 0,
        
        // Sistema
        operador_nombre: formData.operadorNombre || null,
        agente_nombre: formData.agenteNombre || null,
        observaciones: formData.observaciones || null
    };
    
    console.log('📤 Datos cliente a enviar:', clienteData);
    
    // Insertar cliente
    const { data: cliente, error: clienteError } = await supabaseClient
        .from('clientes')
        .insert([clienteData])
        .select()
        .single();
    
    if (clienteError) {
        console.error('❌ Error al crear cliente:', clienteError);
        throw clienteError;
    }
    
    console.log('✅ Cliente creado con ID:', cliente.id);
    
    // Generar número de póliza
    const numeroPolizaGenerado = await generarNumeroPoliza();
    console.log('🔢 Número de póliza generado:', numeroPolizaGenerado);
    
    // Crear póliza
    const polizaData = {
        cliente_id: cliente.id,
        
        // Información básica
        numero_poliza: formData.numeroPoliza || numeroPolizaGenerado,
        compania: formData.compania,
        plan: formData.plan,
        tipo_plan: formData.tipoPlan || null,
        
        // Costos
        prima: parseFloat(formData.prima) || 0,
        credito_fiscal: parseFloat(formData.creditoFiscal) || 0,
        
        // Fechas
        fecha_efectividad: formData.fechaEfectividad,
        fecha_inicial_cobertura: formData.fechaInicialCobertura,
        fecha_final_cobertura: formData.fechaFinalCobertura,
        
        // Acceso
        member_id: formData.memberId || null,
        portal_npn: formData.portalNpn || null,
        clave_seguridad: formData.claveSeguridad || null,
        enlace_poliza: formData.enlacePoliza || null,
        
        // Información de venta
        tipo_venta: formData.tipoVenta || null,
        operador_nombre: formData.operadorNombre || null,
        agente_nombre: formData.agenteNombre || null,
        
        // Estados iniciales
        estado_compania: 'pendiente',
        estado_mercado: 'pendiente',
        
        // Observaciones
        observaciones: formData.observaciones || null
    };
    
    console.log('📤 Datos póliza a enviar:', polizaData);
    
    const { data: poliza, error: polizaError } = await supabaseClient
        .from('polizas')
        .insert([polizaData])
        .select()
        .single();
    
    if (polizaError) {
        console.error('❌ Error al crear póliza:', polizaError);
        throw polizaError;
    }
    
    console.log('✅ Póliza creada con ID:', poliza.id);
    
    // Limpiar borrador y redirigir
    localStorage.removeItem('borrador_cliente');
    
    alert(`✅ Cliente y póliza guardados correctamente\n\nCliente: ${cliente.nombres} ${cliente.apellidos}\nPóliza: ${poliza.numero_poliza}`);
    
    // Redirigir a la lista de pólizas
    window.location.href = './polizas.html';
}

// ============================================
// GENERAR NÚMERO DE PÓLIZA
// ============================================

async function generarNumeroPoliza() {
    const anioActual = new Date().getFullYear();
    
    try {
        const { data, error } = await supabaseClient
            .from('polizas')
            .select('numero_poliza')
            .like('numero_poliza', `POL-${anioActual}-%`)
            .order('numero_poliza', { ascending: false })
            .limit(1);
        
        if (error) throw error;
        
        let siguiente = 1;
        if (data && data.length > 0) {
            const ultimoNumero = data[0].numero_poliza;
            const match = ultimoNumero.match(/POL-\d{4}-(\d+)/);
            if (match) {
                siguiente = parseInt(match[1]) + 1;
            }
        }
        
        return `POL-${anioActual}-${String(siguiente).padStart(4, '0')}`;
        
    } catch (error) {
        console.error('Error al generar número de póliza:', error);
        const timestamp = Date.now().toString().slice(-6);
        return `POL-${anioActual}-${timestamp}`;
    }
}

// ============================================
// OBTENER DATOS DEL FORMULARIO
// ============================================

function obtenerDatosFormulario() {
    const form = document.getElementById('clienteForm');
    const formData = new FormData(form);
    
    const datos = {
        // Información General
        tipoRegistro: formData.get('tipoRegistro') || 'individual',
        nombres: formData.get('nombres'),
        apellidos: formData.get('apellidos'),
        email: formData.get('email'),
        telefono: formData.get('telefono'),
        telefonoSecundario: formData.get('telefono') || null,
        fechaNacimiento: formData.get('fechaNacimiento'),
        genero: formData.get('genero'),
        estadoMigratorio: formData.get('estadoMigratorio'),
        nacionalidad: formData.get('nacionalidad'),
        ssn: formData.get('ssn') || null,
        ocupacion: formData.get('ocupacion') || null,
        ingresos: formData.get('ingresos') || 0,
        aplica: formData.get('aplica'),
        
        // Dirección
        direccion: formData.get('direccion'),
        casaApartamento: formData.get('casaApartamento') || null,
        ciudad: formData.get('ciudad'),
        estado: formData.get('estado'),
        condado: formData.get('condado'),
        codigoPostal: formData.get('codigoPostal'),
        tienePoBox: formData.get('tienePoBox') === 'on',
        poBox: formData.get('poBox') || null,
        
        // Póliza
        compania: formData.get('compania'),
        plan: formData.get('plan'),
        tipoPlan: formData.get('tipoPlan') || null,
        numeroPoliza: formData.get('numeroPoliza') || null,
        prima: formData.get('prima') || 0,
        creditoFiscal: formData.get('creditoFiscal') || 0,
        fechaEfectividad: formData.get('fechaEfectividad'),
        fechaInicialCobertura: formData.get('fechaInicialCobertura'),
        fechaFinalCobertura: formData.get('fechaFinalCobertura'),
        memberId: formData.get('memberId') || null,
        portalNpn: formData.get('portalNpn') || null,
        claveSeguridad: formData.get('claveSeguridad') || null,
        tipoVenta: formData.get('tipoVenta') || null,
        enlacePoliza: formData.get('enlacePoliza') || null,
        operadorNombre: formData.get('operadorNombre') || null,
        agenteNombre: formData.get('agenteNombre') || null,
        observaciones: formData.get('observaciones') || null
    };
    
    return datos;
}

// ============================================
// VALIDACIÓN
// ============================================

function validarFormularioCompleto() {
    const camposRequeridos = [
        { id: 'nombres', nombre: 'Nombres' },
        { id: 'apellidos', nombre: 'Apellidos' },
        { id: 'email', nombre: 'Email' },
        { id: 'telefono', nombre: 'Teléfono' },
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
        const elemento = document.getElementById(campo.id) || document.querySelector(`[name="${campo.id}"]`);
        if (!elemento || !elemento.value || elemento.value.trim() === '') {
            console.error(`Campo requerido vacío: ${campo.nombre}`);
            alert(`El campo "${campo.nombre}" es requerido`);
            elemento?.focus();
            
            // Cambiar al tab correspondiente
            if (['nombres', 'apellidos', 'email', 'telefono', 'fechaNacimiento', 'genero', 'estadoMigratorio'].includes(campo.id)) {
                cambiarTab('info-general');
            } else if (['compania', 'plan', 'fechaEfectividad'].includes(campo.id)) {
                cambiarTab('info-general');
            }
            
            return false;
        }
    }
    
    return true;
}

function inicializarValidacionTiempoReal() {
    // Email
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            validarEmail(this);
        });
    }
    
    // Teléfonos
    const tel1 = document.getElementById('telefono');
    const tel2 = document.getElementById('telefonoSecundario');
    if (tel1) tel1.addEventListener('blur', function() { validarTelefono(this); });
    if (tel2) tel2.addEventListener('blur', function() { validarTelefono(this); });
    
    // SSN
    const ssn = document.getElementById('ssn');
    if (ssn) ssn.addEventListener('blur', function() { validarSSN(this); });
    
    // Código postal
    const cp = document.getElementById('codigoPostal');
    if (cp) cp.addEventListener('blur', function() { validarCodigoPostal(this); });
}

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
    const regex = /^\d{10}$/;
    const valor = input.value.replace(/\D/g, '');
    if (valor && !regex.test(valor)) {
        input.setCustomValidity('Teléfono debe tener 10 dígitos');
        input.reportValidity();
        return false;
    }
    input.setCustomValidity('');
    return true;
}

function validarSSN(input) {
    const regex = /^\d{3}-?\d{2}-?\d{4}$/;
    if (input.value && !regex.test(input.value)) {
        input.setCustomValidity('SSN inválido (formato: 123-45-6789)');
        input.reportValidity();
        return false;
    }
    input.setCustomValidity('');
    return true;
}

function validarCodigoPostal(input) {
    const regex = /^\d{5}$/;
    if (input.value && !regex.test(input.value)) {
        input.setCustomValidity('Código postal debe tener 5 dígitos');
        input.reportValidity();
        return false;
    }
    input.setCustomValidity('');
    return true;
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
            }
        });
    }
}

// ============================================
// BORRADOR AUTOMÁTICO
// ============================================

function cargarBorradorAutomatico() {
    const borrador = localStorage.getItem('borrador_cliente');
    if (borrador && confirm('Se encontró un borrador guardado. ¿Deseas cargarlo?')) {
        try {
            const datos = JSON.parse(borrador);
            // Rellenar formulario con datos del borrador
            Object.keys(datos).forEach(key => {
                const elemento = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
                if (elemento && datos[key]) {
                    elemento.value = datos[key];
                }
            });
            console.log('✅ Borrador cargado');
        } catch (error) {
            console.error('Error al cargar borrador:', error);
        }
    }
}

function guardarBorrador() {
    const formData = obtenerDatosFormulario();
    localStorage.setItem('borrador_cliente', JSON.stringify(formData));
    alert('✅ Borrador guardado');
}

// Guardar borrador cada 2 minutos
setInterval(() => {
    const formData = obtenerDatosFormulario();
    localStorage.setItem('borrador_cliente', JSON.stringify(formData));
    console.log('💾 Borrador guardado automáticamente');
}, 120000);

// ============================================
// CANCELAR FORMULARIO
// ============================================

function cancelarFormulario() {
    if (confirm('¿Seguro que deseas cancelar? Se perderán los cambios no guardados.')) {
        localStorage.removeItem('borrador_cliente');
        window.location.href = './polizas.html';
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
// FUNCIONES DE NOTAS (Placeholders)
// ============================================

function enviarNota() {
    alert('Las notas se pueden agregar después de crear el cliente');
}

function cancelarNota() {
    document.getElementById('nuevaNota').value = '';
    imagenesNotaSeleccionadas = [];
    document.getElementById('imagenesPreview').innerHTML = '';
    document.getElementById('archivosSeleccionados').textContent = 'Ningún archivo seleccionado';
}

function previsualizarImagenesNota() {
    const fileInput = document.getElementById('notaImagen');
    const preview = document.getElementById('imagenesPreview');
    const label = document.getElementById('archivosSeleccionados');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        preview.innerHTML = '';
        label.textContent = 'Ningún archivo seleccionado';
        return;
    }
    
    const archivos = Array.from(fileInput.files);
    label.textContent = `${archivos.length} imagen(es) seleccionada(s)`;
    
    preview.innerHTML = '';
    imagenesNotaSeleccionadas = [];
    
    archivos.forEach(archivo => {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagenesNotaSeleccionadas.push(e.target.result);
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'preview-imagen';
            img.style.width = '100px';
            img.style.height = '100px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.marginRight = '10px';
            preview.appendChild(img);
        };
        reader.readAsDataURL(archivo);
    });
}

// ============================================
// FUNCIONES DE DOCUMENTOS (Placeholders)
// ============================================

function agregarDocumento() {
    alert('Los documentos se pueden agregar después de crear el cliente');
}

// ============================================
// LOG INICIAL
// ============================================

console.log('✅ cliente_crear.js cargado completamente');