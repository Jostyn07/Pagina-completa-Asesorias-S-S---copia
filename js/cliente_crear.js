// ============================================
// CLIENTE_CREAR.JS - SOLO CREACIÓN DE CLIENTES
// ============================================

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
});

function inicializarFormulario() {
    // Configurar fecha de registro
    const hoy = new Date().toISOString().split('T')[0];
    if (document.getElementById('fechaRegistro')) {
        document.getElementById('fechaRegistro').value = hoy;
    }
}

// ============================================
// MANEJO DEL FORMULARIO - SUBMIT
// ============================================

async function handleSubmit(event) {
    event.preventDefault();
    
    // Validar formulario
    if (!validarFormularioCompleto()) {
        alert('Por favor, completa todos los campos requeridos correctamente.');
        return;
    }
    
    // Confirmar creación
    const confirmacion = confirm('¿Guardar este nuevo cliente?\n\nSe procesará la información ingresada.');
    if (!confirmacion) return;
    
    // Obtener datos
    const formData = obtenerDatosFormulario();
    
    console.log('📋 Datos del nuevo cliente:', formData);
    
    try {
        await crearCliente(formData);
    } catch (error) {
        console.error('❌ Error al crear:', error);
        alert(`Error al crear cliente: ${error.message}`);
    }
}

// ============================================
// CREAR CLIENTE Y PÓLIZA
// ============================================

async function crearCliente(formData) {
    console.log('📝 Creando nuevo cliente...');
    
    const clienteData = {
        tipo_registro: formData.tipoRegistro,
        fecha_registro: new Date().toISOString().split('T')[0],
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        email: formData.email,
        telefono1: formData.telefono1,
        telefono2: formData.telefono2 || null,
        genero: formData.genero,
        fecha_nacimiento: formData.fechaNacimiento,
        estado_migratorio: formData.estadoMigratorio,
        nacionalidad: formData.nacionalidad || 'No especificada',
        ssn: formData.ssn || null,
        ocupacion: formData.ocupacion || null,
        ingresos: parseFloat(formData.ingresos) || 0,
        aplica: formData.aplica === 'true' || formData.aplica === true,
        direccion: formData.direccion,
        casa_apartamento: formData.casaApartamento || null,
        ciudad: formData.ciudad,
        estado: formData.estado,
        condado: formData.condado || 'No especificado',
        codigo_postal: formData.codigoPostal,
        tiene_po_box: formData.tienePoBox === 'true' || formData.tienePoBox === true || false,
        po_box: formData.poBox || null,
        operador_nombre: formData.operadorNombre || null,
    };
    
    console.log('📤 Datos a enviar a Supabase:', clienteData);
    
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
    
    console.log('✅ Cliente creado:', cliente);
    
    // Generar número de póliza
    const numeroPolizaGenerado = await generarNumeroPoliza();
    console.log('🔢 Número de póliza generado:', numeroPolizaGenerado);
    
    // Crear póliza
    const polizaData = {
        cliente_id: cliente.id,
        compania: formData.compania,
        plan: formData.plan,
        numero_poliza: formData.numeroPoliza || numeroPolizaGenerado,
        prima: parseFloat(formData.prima) || 0,
        credito_fiscal: parseFloat(formData.creditoFiscal) || 0,
        fecha_efectividad: formData.fechaEfectividad,
        fecha_inicial_cobertura: formData.fechaInicialCobertura,
        fecha_final_cobertura: formData.fechaFinalCobertura,
        member_id: formData.memberId || null,
        portal_npn: formData.portalNpn || null,
        clave_seguridad: formData.claveSeguridad || null,
        tipo_venta: formData.tipoVenta || null,
        enlace_poliza: formData.enlacePoliza || null,
        operador_nombre: formData.operadorNombre || null,
        agente_nombre: formData.agenteNombre || null,
        estado_mercado: 'pendiente',
        observaciones: formData.observaciones || null
    };
    
    const { data: poliza, error: polizaError } = await supabaseClient
        .from('polizas')
        .insert([polizaData])
        .select()
        .single();
    
    if (polizaError) {
        console.error('❌ Error al crear póliza:', polizaError);
        throw polizaError;
    }
    
    console.log('✅ Póliza creada:', poliza);
    
    // Limpiar borrador y redirigir
    localStorage.removeItem('borrador_cliente');
    alert('✅ Cliente y póliza guardados correctamente');
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
            .select('numero_poliza', { count: 'exact' })
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
        telefono1: formData.get('telefono1'),
        telefono2: formData.get('telefono2') || null,
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
        'nombres', 'apellidos', 'email', 'telefono1',
        'fechaNacimiento', 'genero', 'estadoMigratorio',
        'direccion', 'ciudad', 'estado', 'codigoPostal',
        'compania', 'plan', 'fechaEfectividad'
    ];
    
    for (const campo of camposRequeridos) {
        const elemento = document.getElementById(campo) || document.querySelector(`[name="${campo}"]`);
        if (!elemento || !elemento.value || elemento.value.trim() === '') {
            console.error(`Campo requerido vacío: ${campo}`);
            elemento?.focus();
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
    const tel1 = document.getElementById('telefono1');
    const tel2 = document.getElementById('telefono2');
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
// TABS
// ============================================

function inicializarTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => cambiarTab(tab.dataset.tab));
    });
}

function cambiarTab(tabName) {
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Desactivar todos los tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activar tab y contenido seleccionados
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
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
                const fecha = new Date(this.value);
                
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
// PO BOX
// ============================================

function togglePOBox() {
    const checkbox = document.getElementById('tienePoBox');
    const poBoxContainer = document.getElementById('poBoxContainer');
    
    if (checkbox && poBoxContainer) {
        poBoxContainer.style.display = checkbox.checked ? 'block' : 'none';
    }
}