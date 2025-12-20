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
        await cargarDependientes(clienteId);
        await cargarEstadoSeguimiento(clienteId);

        if (polizas && polizas.length > 0) {
       await cargarHistorialPoliza(polizas[0].id);
        }
        
        await cargarNotas(clienteId);

        mostrarIndicadorCarga(false);
        
        await cargarDependientes(clienteId);
        
        mostrarIndicadorCarga(false)
        
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
    if (cliente.telefono) document.getElementById('telefono').value = cliente.telefono;
    if (cliente.telefono_secundario) document.getElementById('telefonoSecundario').value = cliente.telefono_secundario;
    if (cliente.fecha_nacimiento) document.getElementById('fechaNacimiento').value = cliente.fecha_nacimiento;
    if (cliente.genero) document.getElementById('genero').value = cliente.genero;
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
        telefono: formData.telefono,
        telefono_secundario: formData.telefono_secundario || null,
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
            compania: formData.compania,
            plan: formData.plan,
            prima: parseFloat(formData.prima)  || 0,
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
        telefono: formData.get('telefono'),
        telefono_secundario: formData.get('telefonoSecundario') || null,
        fechaNacimiento: formData.get('fechaNacimiento'),
        genero: formData.get('genero'),
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
        'nombres', 'apellidos', 'email', 'telefono',
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
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() { validarEmail(this); });
    }
    
    const tel1 = document.getElementById('telefono');
    const tel2 = document.getElementById('telefonoSecundario');
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
    // ✅ CORRECCIÓN: Usar '.tab-btn' en lugar de '.tab'
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => cambiarTab(tab.dataset.tab));
    });
    
    console.log('✅ Tabs inicializados:', tabs.length);
}

function cambiarTab(tabName) {
    console.log('📑 Cambiando a tab:', tabName);
    
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Desactivar todos los botones
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activar el contenido seleccionado
    const contenido = document.getElementById(`tab-${tabName}`);
    if (contenido) {
        contenido.classList.add('active');
    } else {
        console.error('❌ No se encontró tab:', `tab-${tabName}`);
    }
    
    // Activar el botón seleccionado
    const boton = document.querySelector(`[data-tab="${tabName}"]`);
    if (boton) {
        boton.classList.add('active');
    }
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

let dependienteEditandoId = null;

async function cargarDependientes(clienteId) {
    console.log('👨‍👩‍👧‍👦 Cargando dependientes del cliente:', clienteId);
    
    try {
        const { data: dependientes, error } = await supabaseClient
            .from('dependientes')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('❌ Error al cargar dependientes:', error);
            return;
        }
        
        console.log('✅ Dependientes cargados:', dependientes);
        mostrarDependientes(dependientes);
        
    } catch (error) {
        console.error('❌ Error al cargar dependientes:', error);
    }
}

function mostrarDependientes(dependientes) {
    const container = document.getElementById('dependientesContainer');
    const contador = document.getElementById('dependientesCounter');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (contador) {
        contador.textContent = `(${dependientes.length})`;
    }
    
    if (!dependientes || dependientes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">family_restroom</span>
                <p>No hay dependientes agregados</p>
                <small>Haz clic en "Agregar Dependiente" para comenzar</small>
            </div>
        `;
        return;
    }
    
    dependientes.forEach((dep, index) => {
        const card = crearCardDependiente(dep, index + 1);
        container.appendChild(card);
    });
}

function crearCardDependiente(dependiente, numero) {
    const card = document.createElement('div');
    card.className = 'dependiente-card';
    card.dataset.dependienteId = dependiente.id;
    
    const edad = calcularEdad(dependiente.fecha_nacimiento);
    
    card.innerHTML = `
        <div class="dependiente-header">
            <div class="dependiente-info">
                <span class="dependiente-numero">Dependiente #${numero}</span>
                <h3 class="dependiente-nombre">${dependiente.nombres} ${dependiente.apellidos}</h3>
                <div class="dependiente-meta">
                    <span class="meta-item">
                        <span class="material-symbols-rounded">cake</span>
                        ${edad} años
                    </span>
                    <span class="meta-item">
                        <span class="material-symbols-rounded">${dependiente.genero === 'masculino' ? 'male' : 'female'}</span>
                        ${dependiente.genero}
                    </span>
                    ${dependiente.relacion ? `
                    <span class="meta-item">
                        <span class="material-symbols-rounded">family_restroom</span>
                        ${dependiente.relacion}
                    </span>
                    ` : ''}
                </div>
            </div>
            <div class="dependiente-actions">
                <button type="button" class="btn-icon-action" onclick="editarDependiente('${dependiente.id}')" title="Editar">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button type="button" class="btn-icon-action btn-delete" onclick="eliminarDependiente('${dependiente.id}')" title="Eliminar">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
        </div>
        <div class="dependiente-body">
            <div class="dependiente-detail">
                <span class="detail-label">Fecha de nacimiento</span>
                <span class="detail-value">${formatearFechaLegible(dependiente.fecha_nacimiento)}</span>
            </div>
            ${dependiente.estado_migratorio ? `
            <div class="dependiente-detail">
                <span class="detail-label">Estado migratorio</span>
                <span class="detail-value">${dependiente.estado_migratorio}</span>
            </div>
            ` : ''}
            ${dependiente.ssn ? `
            <div class="dependiente-detail">
                <span class="detail-label">SSN</span>
                <span class="detail-value">${dependiente.ssn}</span>
            </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

function agregarDependiente() {
    dependienteEditandoId = null;
    mostrarModalDependiente();
}

async function editarDependiente(dependienteId) {
    try {
        const { data: dependiente, error } = await supabaseClient
            .from('dependientes')
            .select('*')
            .eq('id', dependienteId)
            .single();
        
        if (error) {
            alert('Error al cargar dependiente');
            return;
        }
        
        dependienteEditandoId = dependienteId;
        mostrarModalDependiente(dependiente);
        
    } catch (error) {
        alert('Error al cargar dependiente');
    }
}

async function eliminarDependiente(dependienteId) {
    if (!confirm('¿Eliminar este dependiente?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('dependientes')
            .delete()
            .eq('id', dependienteId);
        
        if (error) {
            alert('Error al eliminar');
            return;
        }
        
        await cargarDependientes(clienteIdActual);
        
    } catch (error) {
        alert('Error al eliminar');
    }
}

function mostrarModalDependiente(dependiente = null) {
    const esEdicion = dependiente !== null;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modalDependiente';
    
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h2>
                    <span class="material-symbols-rounded">${esEdicion ? 'edit' : 'add'}</span>
                    ${esEdicion ? 'Editar Dependiente' : 'Agregar Dependiente'}
                </h2>
                <button type="button" class="btn-close-modal" onclick="cerrarModalDependiente()">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
            <div class="modal-body">
                <form id="formDependiente">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Nombres <span class="required">*</span></label>
                            <input type="text" id="depNombres" required value="${dependiente?.nombres || ''}">
                        </div>
                        <div class="form-group">
                            <label>Apellidos <span class="required">*</span></label>
                            <input type="text" id="depApellidos" required value="${dependiente?.apellidos || ''}">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Fecha de nacimiento <span class="required">*</span></label>
                            <input type="date" id="depFechaNacimiento" required value="${dependiente?.fecha_nacimiento || ''}">
                        </div>
                        <div class="form-group">
                            <label>genero <span class="required">*</span></label>
                            <select id="depGenero" required>
                                <option value="">Seleccionar...</option>
                                <option value="masculino" ${dependiente?.genero === 'masculino' ? 'selected' : ''}>Masculino</option>
                                <option value="femenino" ${dependiente?.genero === 'femenino' ? 'selected' : ''}>Femenino</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Estado migratorio</label>
                            <select id="depEstadoMigratorio">
                                <option value="">Seleccionar...</option>
                                <option value="ciudadano" ${dependiente?.estado_migratorio === 'ciudadano' ? 'selected' : ''}>Ciudadano</option>
                                <option value="residente" ${dependiente?.estado_migratorio === 'residente' ? 'selected' : ''}>Residente</option>
                                <option value="visa" ${dependiente?.estado_migratorio === 'visa' ? 'selected' : ''}>Visa</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>SSN</label>
                            <input type="text" id="depSSN" value="${dependiente?.ssn || ''}">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Relación</label>
                            <select id="depRelacion">
                                <option value="">Seleccionar...</option>
                                <option value="conyuge" ${dependiente?.relacion === 'conyuge' ? 'selected' : ''}>Cónyuge</option>
                                <option value="hijo" ${dependiente?.relacion === 'hijo' ? 'selected' : ''}>Hijo/a</option>
                                <option value="padre" ${dependiente?.relacion === 'padre' ? 'selected' : ''}>Padre/Madre</option>
                            </select>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-cancel" onclick="cerrarModalDependiente()">Cancelar</button>
                <button type="button" class="btn-submit" onclick="guardarDependiente()">
                    <span class="material-symbols-rounded">save</span>
                    ${esEdicion ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    setTimeout(() => document.getElementById('depNombres')?.focus(), 300);
}

function cerrarModalDependiente() {
    const modal = document.getElementById('modalDependiente');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
    dependienteEditandoId = null;
}

async function guardarDependiente() {
    const nombres = document.getElementById('depNombres').value.trim();
    const apellidos = document.getElementById('depApellidos').value.trim();
    const fechaNacimiento = document.getElementById('depFechaNacimiento').value;
    const genero = document.getElementById('depGenero').value;
    
    if (!nombres || !apellidos || !fechaNacimiento || !genero) {
        alert('Completa todos los campos obligatorios');
        return;
    }
    
    const dependienteData = {
        cliente_id: clienteIdActual,
        nombres,
        apellidos,
        fecha_nacimiento: fechaNacimiento,
        genero,
        estado_migratorio: document.getElementById('depEstadoMigratorio').value || null,
        ssn: document.getElementById('depSSN').value || null,
        relacion: document.getElementById('depRelacion').value || null
    };
    
    try {
        if (dependienteEditandoId) {
            const { error } = await supabaseClient
                .from('dependientes')
                .update(dependienteData)
                .eq('id', dependienteEditandoId);
            
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('dependientes')
                .insert([dependienteData]);
            
            if (error) throw error;
        }
        
        cerrarModalDependiente();
        await cargarDependientes(clienteIdActual);
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return 0;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }
    return edad;
}

function formatearFechaLegible(fecha) {
    if (!fecha) return 'No especificada';
    const date = new Date(fecha);
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', opciones);
}

// =====================================================
// ESTADO Y SEGUIMIENTO
// =====================================================

async function cargarEstadoSeguimiento(clienteId) {
    console.log('📊 Cargando estado y seguimiento...');
    
    try {
        const { data: polizas, error } = await supabaseClient
            .from('polizas')
            .select('*')
            .eq('cliente_id', clienteId);
        
        if (error || !polizas || polizas.length === 0) {
            console.log('⚠️ No hay póliza para estado');
            return;
        }
        
        const poliza = polizas[0];
        console.log('✅ Estado de póliza:', poliza);
        
        mostrarTabEstado();
        rellenarEstadoCompania(poliza);
        rellenarEstadoMercado(poliza);
        
    } catch (error) {
        console.error('❌ Error al cargar estado:', error);
    }
}

function mostrarTabEstado() {
    const tabEstado = document.querySelector('.tab-estado');
    if (tabEstado) {
        tabEstado.style.display = 'flex';
        console.log('✅ Tab de estado visible');
    }
}

function rellenarEstadoCompania(poliza) {
    const seccion = document.querySelector('#tab-estado .form-section:nth-child(2) .section-content');
    
    if (!seccion) {
        console.error('❌ No se encontró sección de estado en compañía');
        return;
    }
    
    seccion.innerHTML = `
        <div class="estado-grid">
            <div class="estado-item">
                <span class="estado-label">Estado actual</span>
                <span class="estado-badge estado-${poliza.estado_compania || 'pendiente'}">
                    ${poliza.estado_compania || 'Pendiente'}
                </span>
            </div>
            
            ${poliza.fecha_envio_compania ? `
            <div class="estado-item">
                <span class="estado-label">Fecha de envío</span>
                <span class="estado-value">${formatearFechaLegible(poliza.fecha_envio_compania)}</span>
            </div>
            ` : ''}
            
            ${poliza.numero_confirmacion ? `
            <div class="estado-item">
                <span class="estado-label">Número de confirmación</span>
                <span class="estado-value">${poliza.numero_confirmacion}</span>
            </div>
            ` : ''}
        </div>
        
        ${!poliza.estado_compania ? `
        <div class="info-message" style="margin-top: 20px;">
            <span class="material-symbols-rounded">info</span>
            <p>La información de estado en compañía estará disponible después de procesar la póliza.</p>
        </div>
        ` : ''}
    `;
}

function rellenarEstadoMercado(poliza) {
    const seccion = document.querySelector('#tab-estado .form-section:nth-child(3) .section-content');
    
    if (!seccion) {
        console.error('❌ No se encontró sección de estado en mercado');
        return;
    }
    
    seccion.innerHTML = `
        <div class="estado-grid">
            <div class="estado-item">
                <span class="estado-label">Estado actual</span>
                <span class="estado-badge estado-${poliza.estado_mercado || 'pendiente'}">
                    ${poliza.estado_mercado || 'Pendiente'}
                </span>
            </div>
            
            ${poliza.fecha_revision_mercado ? `
            <div class="estado-item">
                <span class="estado-label">Fecha de revisión</span>
                <span class="estado-value">${formatearFechaLegible(poliza.fecha_revision_mercado)}</span>
            </div>
            ` : ''}
        </div>
        
        ${!poliza.estado_mercado ? `
        <div class="info-message" style="margin-top: 20px;">
            <span class="material-symbols-rounded">info</span>
            <p>La información de estado en mercado estará disponible después de procesar la póliza.</p>
        </div>
        ` : ''}
    `;
}

// =====================================================
// CARGAR HISTORIAL DE AUDITORÍA
// =====================================================

async function cargarHistorialPoliza(polizaId) {
    console.log('📜 Cargando historial de auditoría para póliza:', polizaId);
    
    try {
        const { data: historial, error } = await supabaseClient
            .from('auditoria_polizas')
            .select('*')
            .eq('poliza_id', polizaId)
            .order('timestamp', { ascending: false });
        
        if (error) {
            console.error('❌ Error al cargar historial:', error);
            return;
        }
        
        console.log('✅ Historial cargado:', historial);
        
        // Encontrar el tab de historial y mostrar
        mostrarHistorialUI(historial);
        
    } catch (error) {
        console.error('❌ Error al cargar historial:', error);
    }
}

/**
 * Mostrar historial en el tab de Estado (o crear uno nuevo)
 */
function mostrarHistorialUI(historial) {
    // Buscar el contenedor del historial
    let container = document.getElementById('historialContainer');
    
    // Si no existe, crearlo en el tab de estado
    if (!container) {
        const tabEstado = document.getElementById('tab-estado');
        if (!tabEstado) {
            console.warn('⚠️ No se encontró tab de estado para mostrar historial');
            return;
        }
        
        // Crear sección de historial
        const seccionHistorial = document.createElement('div');
        seccionHistorial.className = 'form-section';
        seccionHistorial.innerHTML = `
            <div class="section-header">
                <div class="section-title">
                    <span class="material-symbols-rounded">history</span>
                    <h2>Historial de Cambios</h2>
                    <span class="counter" id="historialCounter">(${historial.length})</span>
                </div>
            </div>
            <div class="section-content" id="historialContainer"></div>
        `;
        
        tabEstado.appendChild(seccionHistorial);
        container = document.getElementById('historialContainer');
    }
    
    // Limpiar contenedor
    container.innerHTML = '';
    
    // Actualizar contador
    const contador = document.getElementById('historialCounter');
    if (contador) {
        contador.textContent = `(${historial.length})`;
    }
    
    // Si no hay historial
    if (!historial || historial.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">history</span>
                <p>No hay cambios registrados</p>
                <small>Los cambios aparecerán aquí automáticamente</small>
            </div>
        `;
        return;
    }
    
    // Crear timeline de cambios
    const timeline = document.createElement('div');
    timeline.className = 'historial-timeline';
    
    historial.forEach((cambio, index) => {
        const item = crearItemHistorial(cambio, index === 0);
        timeline.appendChild(item);
    });
    
    container.appendChild(timeline);
}

/**
 * Crear un item del historial
 */
function crearItemHistorial(cambio, esReciente) {
    const item = document.createElement('div');
    item.className = `historial-item ${esReciente ? 'reciente' : ''}`;
    
    // Determinar icono y color según acción
    const iconos = {
        'crear': { icon: 'add_circle', color: 'success' },
        'actualizar': { icon: 'edit', color: 'info' },
        'eliminar': { icon: 'delete', color: 'danger' }
    };
    
    const { icon, color } = iconos[cambio.accion] || { icon: 'change_circle', color: 'info' };
    
    // Formatear fecha
    const fecha = new Date(cambio.timestamp);
    const fechaFormateada = formatearFechaCompleta(fecha);
    const horaFormateada = formatearHora(fecha);
    const tiempoRelativo = obtenerTiempoRelativo(fecha);
    
    // Formatear campo modificado
    const campoLegible = formatearNombreCampo(cambio.campo_modificado);
    
    // Determinar mensaje según acción
    let mensaje = '';
    if (cambio.accion === 'crear') {
        mensaje = `<strong>Póliza creada</strong>`;
    } else if (cambio.accion === 'actualizar') {
        mensaje = `
            <strong>${campoLegible}</strong> cambió de 
            <code class="valor-anterior">${cambio.valor_anterior || '(vacío)'}</code> 
            a 
            <code class="valor-nuevo">${cambio.valor_nuevo || '(vacío)'}</code>
        `;
    } else if (cambio.accion === 'eliminar') {
        mensaje = `<strong>Póliza eliminada</strong>`;
    }
    
    item.innerHTML = `
        <div class="historial-dot historial-dot-${color}">
            <span class="material-symbols-rounded">${icon}</span>
        </div>
        <div class="historial-content">
            <div class="historial-header">
                <div class="historial-accion">
                    <span class="accion-badge accion-${cambio.accion}">${cambio.accion}</span>
                    ${esReciente ? '<span class="badge-nuevo">Nuevo</span>' : ''}
                </div>
                <div class="historial-tiempo">
                    <span class="tiempo-relativo">${tiempoRelativo}</span>
                    <span class="tiempo-exacto">${fechaFormateada} • ${horaFormateada}</span>
                </div>
            </div>
            
            <div class="historial-mensaje">
                ${mensaje}
            </div>
            
            <div class="historial-usuario">
                <span class="material-symbols-rounded">person</span>
                <span class="usuario-nombre">${cambio.usuario_nombre || cambio.usuario_email || 'Usuario desconocido'}</span>
            </div>
        </div>
    `;
    
    return item;
}

/**
 * Formatear nombre de campo de forma legible
 */
function formatearNombreCampo(campo) {
    if (!campo) return 'Campo';
    
    const nombres = {
        'numero_poliza': 'Número de póliza',
        'compania': 'Compañía',
        'plan': 'Plan',
        'prima': 'Prima',
        'credito_fiscal': 'Crédito fiscal',
        'fecha_efectividad': 'Fecha de efectividad',
        'fecha_inicial_cobertura': 'Fecha inicial de cobertura',
        'fecha_final_cobertura': 'Fecha final de cobertura',
        'estado_compania': 'Estado en compañía',
        'estado_mercado': 'Estado en mercado',
        'tipo_venta': 'Tipo de venta',
        'operador_nombre': 'Operador',
        'agente_nombre': 'Agente',
        'member_id': 'Member ID',
        'portal_npn': 'Portal NPN',
        'clave_seguridad': 'Clave de seguridad',
        'enlace_poliza': 'Enlace de póliza',
        'observaciones': 'Observaciones',
        'notas_compania': 'Notas de compañía',
        'notas_mercado': 'Notas de mercado'
    };
    
    return nombres[campo] || campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Formatear fecha completa
 */
function formatearFechaCompleta(fecha) {
    const opciones = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return fecha.toLocaleDateString('es-ES', opciones);
}

/**
 * Formatear hora
 */
function formatearHora(fecha) {
    const opciones = { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    };
    return fecha.toLocaleTimeString('es-ES', opciones);
}

/**
 * Obtener tiempo relativo (hace X minutos/horas/días)
 */
function obtenerTiempoRelativo(fecha) {
    const ahora = new Date();
    const diferencia = ahora - fecha;
    
    const segundos = Math.floor(diferencia / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    
    if (segundos < 60) {
        return 'Ahora mismo';
    } else if (minutos < 60) {
        return `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
    } else if (horas < 24) {
        return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
    } else if (dias < 30) {
        return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
    } else {
        return formatearFechaCompleta(fecha);
    }
}


async function recargarHistorialDespuesDeGuardar(polizaId) {
    // Esperar un momento para que el trigger termine
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Recargar historial
    await cargarHistorialPoliza(polizaId);
    
    console.log('✅ Historial actualizado después de guardar');
}

// =====================================================
// EXPORTAR HISTORIAL A CSV (OPCIONAL)
// =====================================================

async function exportarHistorialCSV(polizaId) {
    try {
        const { data: historial, error } = await supabaseClient
            .from('auditoria_polizas')
            .select('*')
            .eq('poliza_id', polizaId)
            .order('timestamp', { ascending: false });
        
        if (error) throw error;
        
        // Crear CSV
        let csv = 'Fecha,Hora,Usuario,Acción,Campo,Valor Anterior,Valor Nuevo\n';
        
        historial.forEach(item => {
            const fecha = new Date(item.timestamp);
            const fechaStr = fecha.toLocaleDateString('es-ES');
            const horaStr = fecha.toLocaleTimeString('es-ES');
            
            csv += `"${fechaStr}","${horaStr}","${item.usuario_nombre || item.usuario_email}","${item.accion}","${formatearNombreCampo(item.campo_modificado)}","${item.valor_anterior || ''}","${item.valor_nuevo || ''}"\n`;
        });
        
        // Descargar
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `historial_poliza_${polizaId}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        console.log('✅ Historial exportado a CSV');
        
    } catch (error) {
        console.error('Error al exportar:', error);
        alert('Error al exportar historial');
    }
}


let imagenesNotaSeleccionadas = [];

// =====================================================
// CARGAR NOTAS DEL CLIENTE
// =====================================================

async function cargarNotas(clienteId) {
    console.log('💬 Cargando notas del cliente:', clienteId);
    
    try {
        const { data: notas, error } = await supabaseClient
            .from('notas')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error al cargar notas:', error);
            return;
        }
        
        console.log('✅ Notas cargadas:', notas);
        mostrarNotas(notas);
        
    } catch (error) {
        console.error('❌ Error al cargar notas:', error);
    }
}

/**
 * Mostrar notas en el thread
 */
function mostrarNotas(notas) {
    const thread = document.getElementById('notasThread');
    const contador = document.getElementById('notasCounter');
    
    if (!thread) {
        console.error('❌ No se encontró notasThread');
        return;
    }
    
    // Actualizar contador
    if (contador) {
        contador.textContent = `(${notas.length})`;
    }
    
    // Limpiar thread
    thread.innerHTML = '';
    
    // Si no hay notas
    if (!notas || notas.length === 0) {
        thread.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">chat_bubble</span>
                <p>No hay notas aún</p>
                <small>Escribe la primera nota para este cliente</small>
            </div>
        `;
        return;
    }
    
    // Agrupar notas por fecha
    const notasAgrupadas = agruparNotasPorFecha(notas);
    
    // Crear cards de notas
    Object.keys(notasAgrupadas).forEach(fecha => {
        // Separador de fecha
        const separador = document.createElement('div');
        separador.className = 'nota-fecha-separador';
        separador.innerHTML = `
            <span class="fecha-label">${fecha}</span>
        `;
        thread.appendChild(separador);
        
        // Notas de esa fecha
        notasAgrupadas[fecha].forEach(nota => {
            const card = crearCardNota(nota);
            thread.appendChild(card);
        });
    });
}

/**
 * Agrupar notas por fecha para mejor visualización
 */
function agruparNotasPorFecha(notas) {
    const grupos = {};
    
    notas.forEach(nota => {
        const fecha = new Date(nota.created_at);
        const hoy = new Date();
        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);
        
        let etiqueta;
        
        if (esMismaFecha(fecha, hoy)) {
            etiqueta = 'Hoy';
        } else if (esMismaFecha(fecha, ayer)) {
            etiqueta = 'Ayer';
        } else {
            etiqueta = formatearFechaCompleta(fecha);
        }
        
        if (!grupos[etiqueta]) {
            grupos[etiqueta] = [];
        }
        
        grupos[etiqueta].push(nota);
    });
    
    return grupos;
}

/**
 * Verificar si dos fechas son el mismo día
 */
function esMismaFecha(fecha1, fecha2) {
    return fecha1.getFullYear() === fecha2.getFullYear() &&
           fecha1.getMonth() === fecha2.getMonth() &&
           fecha1.getDate() === fecha2.getDate();
}

/**
 * Crear card individual de nota
 */
function crearCardNota(nota) {
    const card = document.createElement('div');
    card.className = 'nota-card';
    card.dataset.notaId = nota.id;
    
    // Si es nota importante
    if (nota.es_importante) {
        card.classList.add('nota-importante');
    }
    
    // Determinar ícono según tipo
    const iconos = {
        'nota': 'chat_bubble',
        'llamada': 'call',
        'email': 'email',
        'reunion': 'event',
        'seguimiento': 'flag'
    };
    
    const icono = iconos[nota.tipo] || 'chat_bubble';
    
    // Formatear hora
    const fecha = new Date(nota.created_at);
    const hora = formatearHora(fecha);
    
    // HTML de la nota
    card.innerHTML = `
        <div class="nota-header">
            <div class="nota-info">
                <span class="nota-tipo-icon material-symbols-rounded" title="${nota.tipo}">${icono}</span>
                <span class="nota-usuario">${nota.usuario_nombre || nota.usuario_email}</span>
                <span class="nota-hora">${hora}</span>
                ${nota.es_importante ? '<span class="nota-estrella material-symbols-rounded">star</span>' : ''}
            </div>
            <div class="nota-actions">
                ${esNotaPropia(nota) ? `
                    <button type="button" class="btn-nota-action" onclick="toggleImportanteNota('${nota.id}', ${!nota.es_importante})" title="${nota.es_importante ? 'Quitar importancia' : 'Marcar importante'}">
                        <span class="material-symbols-rounded">${nota.es_importante ? 'star' : 'star_outline'}</span>
                    </button>
                    <button type="button" class="btn-nota-action btn-eliminar" onclick="eliminarNota('${nota.id}')" title="Eliminar">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                ` : ''}
            </div>
        </div>
        
        <div class="nota-mensaje">
            ${formatearMensajeNota(nota.mensaje)}
        </div>
        
        ${nota.imagenes && nota.imagenes.length > 0 ? `
            <div class="nota-imagenes">
                ${nota.imagenes.map(url => `
                    <div class="nota-imagen-wrapper">
                        <img src="${url}" alt="Imagen adjunta" onclick="verImagenCompleta('${url}')">
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    return card;
}

/**
 * Verificar si la nota es del usuario actual
 */
function esNotaPropia(nota) {
    // Obtener email del usuario actual desde Supabase
    const user = supabaseClient.auth.getUser();
    return nota.usuario_email === user?.email;
}

/**
 * Formatear mensaje (detectar URLs, menciones, etc.)
 */
function formatearMensajeNota(mensaje) {
    if (!mensaje) return '';
    
    // Convertir URLs a links
    let formatted = mensaje.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
    
    // Convertir menciones @usuario
    formatted = formatted.replace(
        /@(\w+)/g,
        '<span class="mencion">@$1</span>'
    );
    
    // Convertir saltos de línea
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

/**
 * Formatear hora en formato legible
 */
function formatearHora(fecha) {
    const opciones = { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    };
    return fecha.toLocaleTimeString('es-ES', opciones);
}

/**
 * Formatear fecha completa
 */
function formatearFechaCompleta(fecha) {
    const opciones = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return fecha.toLocaleDateString('es-ES', opciones);
}

// =====================================================
// ENVIAR NUEVA NOTA
// =====================================================

async function enviarNota() {
    const textarea = document.getElementById('nuevaNota');
    const mensaje = textarea.value.trim();
    
    if (!mensaje) {
        alert('Escribe un mensaje antes de enviar');
        textarea.focus();
        return;
    }
    
    console.log('📤 Enviando nota...');
    
    try {
        // Obtener info del usuario actual
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            alert('Error: No hay usuario autenticado');
            return;
        }
        
        // Preparar datos de la nota
        const notaData = {
            cliente_id: clienteIdActual,
            mensaje: mensaje,
            tipo: 'nota', // Por defecto
            usuario_email: user.email,
            usuario_nombre: user.user_metadata?.nombre || user.email,
            imagenes: imagenesNotaSeleccionadas.length > 0 ? imagenesNotaSeleccionadas : null
        };
        
        // Insertar en base de datos
        const { data, error } = await supabaseClient
            .from('notas')
            .insert([notaData])
            .select();
        
        if (error) {
            console.error('Error al guardar nota:', error);
            alert('Error al guardar nota: ' + error.message);
            return;
        }
        
        console.log('✅ Nota guardada:', data);
        
        // Limpiar formulario
        textarea.value = '';
        imagenesNotaSeleccionadas = [];
        document.getElementById('imagenesPreview').innerHTML = '';
        document.getElementById('archivosSeleccionados').textContent = 'Ningún archivo seleccionado';
        
        // Recargar notas
        await cargarNotas(clienteIdActual);
        
        // Scroll al inicio del thread
        const thread = document.getElementById('notasThread');
        if (thread) {
            thread.scrollTop = 0;
        }
        
    } catch (error) {
        console.error('Error al enviar nota:', error);
        alert('Error al enviar nota: ' + error.message);
    }
}

/**
 * Cancelar nota (limpiar formulario)
 */
function cancelarNota() {
    const textarea = document.getElementById('nuevaNota');
    textarea.value = '';
    
    imagenesNotaSeleccionadas = [];
    document.getElementById('imagenesPreview').innerHTML = '';
    document.getElementById('archivosSeleccionados').textContent = 'Ningún archivo seleccionado';
    
    // Limpiar input de archivos
    const fileInput = document.getElementById('notaImagen');
    if (fileInput) {
        fileInput.value = '';
    }
}

// =====================================================
// MANEJO DE IMÁGENES
// =====================================================

/**
 * Previsualizar imágenes seleccionadas
 */
function previsualizarImagenesNota() {
    const fileInput = document.getElementById('notaImagen');
    const preview = document.getElementById('imagenesPreview');
    const archivosLabel = document.getElementById('archivosSeleccionados');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        preview.innerHTML = '';
        archivosLabel.textContent = 'Ningún archivo seleccionado';
        return;
    }
    
    const archivos = Array.from(fileInput.files);
    archivosLabel.textContent = `${archivos.length} ${archivos.length === 1 ? 'archivo' : 'archivos'} seleccionado(s)`;
    
    preview.innerHTML = '';
    imagenesNotaSeleccionadas = [];
    
    archivos.forEach((archivo, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            imagenesNotaSeleccionadas.push(e.target.result);
            
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'preview-imagen-wrapper';
            imgWrapper.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button type="button" class="btn-quitar-imagen" onclick="quitarImagenNota(${index})" title="Quitar">
                    <span class="material-symbols-rounded">close</span>
                </button>
            `;
            preview.appendChild(imgWrapper);
        };
        
        reader.readAsDataURL(archivo);
    });
}

/**
 * Quitar imagen de la previsualización
 */
function quitarImagenNota(index) {
    imagenesNotaSeleccionadas.splice(index, 1);
    
    // Rehacer preview
    const fileInput = document.getElementById('notaImagen');
    const dt = new DataTransfer();
    
    const archivos = Array.from(fileInput.files);
    archivos.forEach((file, i) => {
        if (i !== index) {
            dt.items.add(file);
        }
    });
    
    fileInput.files = dt.files;
    previsualizarImagenesNota();
}

/**
 * Ver imagen en tamaño completo (modal)
 */
function verImagenCompleta(url) {
    const modal = document.createElement('div');
    modal.className = 'modal-imagen-completa';
    modal.innerHTML = `
        <div class="modal-imagen-overlay" onclick="cerrarModalImagen()">
            <div class="modal-imagen-container">
                <button class="btn-cerrar-imagen" onclick="cerrarModalImagen()">
                    <span class="material-symbols-rounded">close</span>
                </button>
                <img src="${url}" alt="Imagen completa">
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
}

/**
 * Cerrar modal de imagen
 */
function cerrarModalImagen() {
    const modal = document.querySelector('.modal-imagen-completa');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

// =====================================================
// ACCIONES DE NOTAS
// =====================================================

/**
 * Marcar/desmarcar nota como importante
 */
async function toggleImportanteNota(notaId, esImportante) {
    console.log('⭐ Cambiando importancia de nota:', notaId, esImportante);
    
    try {
        const { error } = await supabaseClient
            .from('notas')
            .update({ es_importante: esImportante })
            .eq('id', notaId);
        
        if (error) {
            console.error('Error al actualizar:', error);
            alert('Error al actualizar nota');
            return;
        }
        
        console.log('✅ Nota actualizada');
        await cargarNotas(clienteIdActual);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al actualizar nota');
    }
}

/**
 * Eliminar nota
 */
async function eliminarNota(notaId) {
    if (!confirm('¿Eliminar esta nota? Esta acción no se puede deshacer.')) {
        return;
    }
    
    console.log('🗑️ Eliminando nota:', notaId);
    
    try {
        const { error } = await supabaseClient
            .from('notas')
            .delete()
            .eq('id', notaId);
        
        if (error) {
            console.error('Error al eliminar:', error);
            alert('Error al eliminar nota');
            return;
        }
        
        console.log('✅ Nota eliminada');
        await cargarNotas(clienteIdActual);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar nota');
    }
}

// =====================================================
// ATAJOS DE TECLADO (Opcional)
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('nuevaNota');
    
    if (textarea) {
        // Enviar con Ctrl+Enter
        textarea.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                enviarNota();
            }
        });
    }
});

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Buscar notas por texto
 */
function buscarNotas(texto) {
    const cards = document.querySelectorAll('.nota-card');
    const textoBusqueda = texto.toLowerCase();
    
    cards.forEach(card => {
        const mensaje = card.querySelector('.nota-mensaje').textContent.toLowerCase();
        const usuario = card.querySelector('.nota-usuario').textContent.toLowerCase();
        
        if (mensaje.includes(textoBusqueda) || usuario.includes(textoBusqueda)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

/**
 * Filtrar notas por tipo
 */
function filtrarNotasPorTipo(tipo) {
    const cards = document.querySelectorAll('.nota-card');
    
    cards.forEach(card => {
        if (tipo === 'todas') {
            card.style.display = 'block';
        } else {
            const iconElement = card.querySelector('.nota-tipo-icon');
            const notaTipo = iconElement?.getAttribute('title');
            
            if (notaTipo === tipo) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

/**
 * Exportar notas a texto
 */
async function exportarNotasTexto(clienteId) {
    try {
        const { data: notas, error } = await supabaseClient
            .from('notas')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        let texto = '=== HISTORIAL DE NOTAS ===\n\n';
        
        notas.forEach(nota => {
            const fecha = new Date(nota.created_at);
            texto += `[${formatearFechaCompleta(fecha)} ${formatearHora(fecha)}]\n`;
            texto += `Usuario: ${nota.usuario_nombre || nota.usuario_email}\n`;
            texto += `Tipo: ${nota.tipo}\n`;
            texto += `Mensaje: ${nota.mensaje}\n`;
            texto += '\n---\n\n';
        });
        
        // Descargar
        const blob = new Blob([texto], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `notas_cliente_${clienteId}_${new Date().toISOString().split('T')[0]}.txt`;
        link.click();
        
        console.log('✅ Notas exportadas');
        
    } catch (error) {
        console.error('Error al exportar:', error);
        alert('Error al exportar notas');
    }
}