// ============================================
// CLIENTE_EDITAR.JS - SOLO EDICIÓN DE CLIENTES
// ============================================

let clienteIdActual = null;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('✏️ Modo: EDITAR CLIENTE EXISTENTE');
    
    // Obtener ID del cliente desde URL
    const urlParams = new URLSearchParams(window.location.search);
    clienteIdActual = urlParams.get('id');
    
    if (!clienteIdActual) {
        alert('❌ No se especificó ID de cliente');
        window.location.href = './polizas.html';
        return;
    }
    
    console.log('📋 Cliente ID:', clienteIdActual);
    
    // Inicializar formulario
    inicializarFormulario();
    inicializarTabs();
    inicializarValidacionTiempoReal();
    
    // Cargar datos del cliente
    await cargarDatosCliente(clienteIdActual);
    
    // Configurar submit
    document.getElementById('clienteForm').addEventListener('submit', handleSubmit);
});

function inicializarFormulario() {
    // Configurar fecha de registro
    const hoy = new Date().toISOString().split('T')[0];
    if (document.getElementById('fechaRegistro')) {
        document.getElementById('fechaRegistro').value = hoy;
    }
}

// ============================================
// CARGAR DATOS DEL CLIENTE
// ============================================

async function cargarDatosCliente(clienteId) {
    try {
        mostrarIndicadorCarga(true);
        
        console.log('📡 Cargando datos del cliente...');
        
        // Cargar cliente
        const { data: clientes, error: clienteError } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('id', clienteId)
            .single();
        
        if (clienteError || !clientes) {
            throw new Error('Cliente no encontrado');
        }
        
        console.log('✅ Cliente cargado:', clientes);
        
        // Cargar póliza asociada
        const { data: polizas, error: polizaError } = await supabaseClient
            .from('polizas')
            .select('*')
            .eq('cliente_id', clienteId);
        
        if (polizaError) {
            console.error('⚠️ Error al cargar póliza:', polizaError);
        }
        
        console.log('✅ Póliza cargada:', polizas);
        
        // Rellenar formulario
        rellenarFormulario(clientes, polizas || []);
        
        mostrarIndicadorCarga(false);
        
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
        alert(`Error al cargar datos: ${error.message}`);
        window.location.href = './polizas.html';
    }
}

// ============================================
// RELLENAR FORMULARIO CON DATOS EXISTENTES
// ============================================

function rellenarFormulario(cliente, polizas = []) {
    console.log('📝 Rellenando formulario...');
    
    // Información general del cliente
    if (cliente.tipo_registro) document.getElementById('tipoRegistro').value = cliente.tipo_registro;
    if (cliente.nombres) document.getElementById('nombres').value = cliente.nombres;
    if (cliente.apellidos) document.getElementById('apellidos').value = cliente.apellidos;
    if (cliente.email) document.getElementById('email').value = cliente.email;
    if (cliente.telefono1) document.getElementById('telefono1').value = cliente.telefono1;
    if (cliente.telefono2) document.getElementById('telefono2').value = cliente.telefono2;
    if (cliente.fecha_nacimiento) document.getElementById('fechaNacimiento').value = cliente.fecha_nacimiento;
    if (cliente.sexo) document.getElementById('sexo').value = cliente.sexo;
    if (cliente.estado_migratorio) document.getElementById('estadoMigratorio').value = cliente.estado_migratorio;
    if (cliente.nacionalidad) document.getElementById('nacionalidad').value = cliente.nacionalidad;
    if (cliente.ssn) document.getElementById('ssn').value = cliente.ssn;
    if (cliente.ocupacion) document.getElementById('ocupacion').value = cliente.ocupacion;
    if (cliente.ingresos) document.getElementById('ingresos').value = cliente.ingresos;
    if (cliente.aplica !== null && cliente.aplica !== undefined) {
        document.getElementById('aplica').value = cliente.aplica ? 'true' : 'false';
    }
    
    // Dirección
    if (cliente.direccion) document.getElementById('direccion').value = cliente.direccion;
    if (cliente.casa_apartamento) document.getElementById('casaApartamento').value = cliente.casa_apartamento;
    if (cliente.ciudad) document.getElementById('ciudad').value = cliente.ciudad;
    if (cliente.estado) document.getElementById('estado').value = cliente.estado;
    if (cliente.condado) document.getElementById('condado').value = cliente.condado;
    if (cliente.codigo_postal) document.getElementById('codigoPostal').value = cliente.codigo_postal;
    if (cliente.tiene_po_box) document.getElementById('tienePoBox').checked = cliente.tiene_po_box;
    if (cliente.po_box) document.getElementById('poBox').value = cliente.po_box;
    
    // Póliza (si existe)
    if (polizas && polizas.length > 0) {
        const poliza = polizas[0];
        
        console.log('📋 Cargando datos de póliza:', poliza);
        
        if (poliza.compania) document.getElementById('compania').value = poliza.compania;
        if (poliza.plan) document.getElementById('plan').value = poliza.plan;
        if (poliza.numero_poliza) document.getElementById('numeroPoliza').value = poliza.numero_poliza;
        if (poliza.prima) document.getElementById('prima').value = poliza.prima;
        if (poliza.credito_fiscal) document.getElementById('creditoFiscal').value = poliza.credito_fiscal;
        if (poliza.fecha_efectividad) document.getElementById('fechaEfectividad').value = poliza.fecha_efectividad;
        if (poliza.fecha_inicial_cobertura) document.getElementById('fechaInicialCobertura').value = poliza.fecha_inicial_cobertura;
        if (poliza.fecha_final_cobertura) document.getElementById('fechaFinalCobertura').value = poliza.fecha_final_cobertura;
        if (poliza.member_id) document.getElementById('memberId').value = poliza.member_id;
        if (poliza.portal_npn) document.getElementById('portalNpn').value = poliza.portal_npn;
        if (poliza.clave_seguridad) document.getElementById('claveSeguridad').value = poliza.clave_seguridad;
        if (poliza.tipo_venta) document.getElementById('tipoVenta').value = poliza.tipo_venta;
        if (poliza.enlace_poliza) document.getElementById('enlacePoliza').value = poliza.enlace_poliza;
        
        // ⭐ OPERADOR Y AGENTE desde póliza
        if (poliza.operador_nombre) {
            document.getElementById('operadorNombre').value = poliza.operador_nombre;
            console.log('👤 Operador cargado:', poliza.operador_nombre);
        }
        if (poliza.agente_nombre) {
            document.getElementById('agenteNombre').value = poliza.agente_nombre;
            console.log('👤 Agente cargado:', poliza.agente_nombre);
        }
        
        if (poliza.observaciones) document.getElementById('observaciones').value = poliza.observaciones;
    }
    
    console.log('✅ Formulario rellenado correctamente');
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
    
    // Confirmar actualización
    const confirmacion = confirm('¿Actualizar la información de este cliente?');
    if (!confirmacion) return;
    
    // Obtener datos
    const formData = obtenerDatosFormulario();
    
    console.log('📋 Datos a actualizar:', formData);
    
    try {
        await actualizarCliente(clienteIdActual, formData);
    } catch (error) {
        console.error('❌ Error al actualizar:', error);
        alert(`Error al actualizar: ${error.message}`);
    }
}

// ============================================
// ACTUALIZAR CLIENTE Y PÓLIZA
// ============================================

async function actualizarCliente(clienteId, formData) {
    console.log('🔄 Actualizando cliente:', clienteId);
    
    const clienteData = {
        tipo_registro: formData.tipoRegistro,
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        email: formData.email,
        telefono1: formData.telefono1,
        telefono2: formData.telefono2 || null,
        sexo: formData.sexo,
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
        updated_at: new Date().toISOString()
    };
    
    console.log('📤 Datos del cliente a actualizar:', clienteData);
    
    // Actualizar cliente
    const { error: clienteError } = await supabaseClient
        .from('clientes')
        .update(clienteData)
        .eq('id', clienteId);
    
    if (clienteError) {
        console.error('❌ Error al actualizar cliente:', clienteError);
        throw clienteError;
    }
    
    console.log('✅ Cliente actualizado');
    
    // Buscar póliza asociada
    const { data: polizasExistentes } = await supabaseClient
        .from('polizas')
        .select('id, numero_poliza')
        .eq('cliente_id', clienteId)
        .limit(1);
    
    if (polizasExistentes && polizasExistentes.length > 0) {
        // ==========================================
        // ACTUALIZAR PÓLIZA EXISTENTE
        // ==========================================
        console.log('🔄 Actualizando póliza existente');
        
        // Preparar datos SIN numero_poliza (mantener el que ya tiene)
        const polizaData = {
            // ⭐ NO incluir numero_poliza aquí - mantiene el actual
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
            tipo_venta: formData.tipoVenta || null,
            enlace_poliza: formData.enlacePoliza || null,
            operador_nombre: formData.operadorNombre || null,
            agente_nombre: formData.agenteNombre || null,
            estado_mercado: formData.estadoMercado || 'pendiente',
            observaciones: formData.observaciones || null,
            updated_at: new Date().toISOString()
        };
        
        const { error: polizaError } = await supabaseClient
            .from('polizas')
            .update(polizaData)
            .eq('id', polizasExistentes[0].id);
        
        if (polizaError) {
            console.error('❌ Error al actualizar póliza:', polizaError);
            throw polizaError;
        }
        
        console.log('✅ Póliza actualizada (número:', polizasExistentes[0].numero_poliza, ')');
        
    } else {
        // ==========================================
        // CREAR NUEVA PÓLIZA (si no existe)
        // ==========================================
        console.log('📝 Creando nueva póliza para este cliente');
        
        const numeroPolizaGenerado = await generarNumeroPoliza();
        console.log('🔢 Número generado:', numeroPolizaGenerado);
        
        const polizaData = {
            cliente_id: clienteId,
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
        
        const { error: polizaError } = await supabaseClient
            .from('polizas')
            .insert([polizaData]);
        
        if (polizaError) {
            console.error('❌ Error al crear póliza:', polizaError);
            throw polizaError;
        }
        
        console.log('✅ Póliza creada con número:', numeroPolizaGenerado);
    }
    
    // Redirigir
    alert('✅ Cliente y póliza actualizados correctamente');
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
        tipoRegistro: formData.get('tipoRegistro') || 'individual',
        nombres: formData.get('nombres'),
        apellidos: formData.get('apellidos'),
        email: formData.get('email'),
        telefono1: formData.get('telefono1'),
        telefono2: formData.get('telefono2') || null,
        fechaNacimiento: formData.get('fechaNacimiento'),
        sexo: formData.get('sexo'),
        estadoMigratorio: formData.get('estadoMigratorio'),
        nacionalidad: formData.get('nacionalidad'),
        ssn: formData.get('ssn') || null,
        ocupacion: formData.get('ocupacion') || null,
        ingresos: formData.get('ingresos') || 0,
        aplica: formData.get('aplica'),
        direccion: formData.get('direccion'),
        casaApartamento: formData.get('casaApartamento') || null,
        ciudad: formData.get('ciudad'),
        estado: formData.get('estado'),
        condado: formData.get('condado'),
        codigoPostal: formData.get('codigoPostal'),
        tienePoBox: formData.get('tienePoBox') === 'on',
        poBox: formData.get('poBox') || null,
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
        estadoMercado: formData.get('estadoMercado') || null,
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
        'fechaNacimiento', 'sexo', 'estadoMigratorio',
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
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() { validarEmail(this); });
    }
    
    const tel1 = document.getElementById('telefono1');
    const tel2 = document.getElementById('telefono2');
    if (tel1) tel1.addEventListener('blur', function() { validarTelefono(this); });
    if (tel2) tel2.addEventListener('blur', function() { validarTelefono(this); });
    
    const ssn = document.getElementById('ssn');
    if (ssn) ssn.addEventListener('blur', function() { validarSSN(this); });
    
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
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
}

// ============================================
// INDICADOR DE CARGA
// ============================================

function mostrarIndicadorCarga(mostrar) {
    let indicador = document.getElementById('indicadorCarga');
    
    if (mostrar) {
        if (!indicador) {
            indicador = document.createElement('div');
            indicador.id = 'indicadorCarga';
            indicador.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                            background: rgba(0,0,0,0.5); z-index: 9999; 
                            display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; padding: 30px; border-radius: 10px; 
                                text-align: center;">
                        <div style="width: 50px; height: 50px; border: 5px solid #f3f3f3; 
                                    border-top: 5px solid #6366f1; border-radius: 50%; 
                                    animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                        <p style="margin: 0; color: #333;">Cargando datos...</p>
                    </div>
                </div>
            `;
            document.body.appendChild(indicador);
        }
        indicador.style.display = 'block';
    } else {
        if (indicador) {
            indicador.style.display = 'none';
        }
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