// ============================================
// VARIABLES GLOBALES
// ============================================
let clienteId = null;
let polizaId = null;
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
    console.log('✏️ Modo: EDITAR CLIENTE');
    
    // Obtener ID de la URL
    const urlParams = new URLSearchParams(window.location.search);
    clienteId = urlParams.get('id');
    
    if (!clienteId) {
        alert('Error: No se especificó ID de cliente');
        window.location.href = './polizas.html';
        return;
    }
    
    console.log('📋 Cliente ID:', clienteId);
    
    inicializarFormulario();
    inicializarTabs();
    inicializarValidacionTiempoReal();
    inicializarAutoguardado();
    
    // Cargar datos del cliente
    cargarDatosCliente(clienteId);
    
    document.getElementById('clienteForm').addEventListener('submit', handleSubmit);
    
    console.log('✅ Formulario de edición inicializado');
});

function inicializarFormulario() {
    // Cambiar botón de submit
    const btnSubmit = document.querySelector('.btn-submit');
    if (btnSubmit) {
        btnSubmit.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Actualizar Cliente';
    }
    
    // Mostrar tabs de estado y comisiones
    const tabEstado = document.querySelector('.tab-estado');
    const tabComisiones = document.querySelector('.tab-comisiones');
    if (tabEstado) tabEstado.style.display = 'flex';
    if (tabComisiones) tabComisiones.style.display = 'flex';
}

// ============================================
// FORMATEADORES DE FECHA
// ============================================

function formatearFechaUS(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    const anio = d.getFullYear();
    return `${mes}/${dia}/${anio}`;
}

function convertirAFormatoUS(fechaISO) {
    if (!fechaISO) return '';
    const partes = fechaISO.split('-');
    if (partes.length !== 3) return '';
    return `${partes[1]}/${partes[2]}/${partes[0]}`;
}

function convertirAFormatoISO(fechaUS) {
    if (!fechaUS) return '';
    const partes = fechaUS.split('/');
    if (partes.length !== 3) return '';
    return `${partes[2]}-${partes[0]}-${partes[1]}`;
}

// ============================================
// CARGAR DATOS DEL CLIENTE
// ============================================

async function cargarDatosCliente(id) {
    try {
        console.log('📡 Cargando datos del cliente:', id);
        
        // Mostrar indicador de carga
        const btnSubmit = document.querySelector('.btn-submit');
        const textoOriginal = btnSubmit?.innerHTML;
        if (btnSubmit) {
            btnSubmit.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Cargando...';
            btnSubmit.disabled = true;
        }
        
        // Cargar cliente
        const { data: clienteData, error: clienteError } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('id', id)
            .single();
        
        if (clienteError) throw clienteError;
        if (!clienteData) throw new Error('Cliente no encontrado');
        
        console.log('✅ Cliente cargado:', clienteData);
        
        // Cargar póliza
        const { data: polizasData, error: polizasError } = await supabaseClient
            .from('polizas')
            .select('*')
            .eq('cliente_id', id);
        
        if (polizasError) console.warn('⚠️ Error al cargar pólizas:', polizasError);
        
        const polizaData = polizasData && polizasData.length > 0 ? polizasData[0] : null;
        if (polizaData) {
            polizaId = polizaData.id;
            console.log('✅ Póliza cargada:', polizaId);
        }
        
        // Cargar dependientes
        const { data: dependientesData, error: dependientesError } = await supabaseClient
            .from('dependientes')
            .select('*')
            .eq('cliente_id', id);
        
        if (dependientesError) console.warn('⚠️ Error al cargar dependientes:', dependientesError);
        console.log(`✅ ${dependientesData?.length || 0} dependientes cargados`);
        
        // Cargar notas
        const { data: notasData, error: notasError } = await supabaseClient
            .from('notas')
            .select('*')
            .eq('cliente_id', id)
            .order('created_at', { ascending: false });
        
        if (notasError) console.warn('⚠️ Error al cargar notas:', notasError);
        console.log(`✅ ${notasData?.length || 0} notas cargadas`);
        
        // Rellenar formulario
        rellenarFormulario(clienteData, polizaData, dependientesData, notasData);
        
        // Actualizar título
        const nombreCompleto = `${clienteData.nombres} ${clienteData.apellidos}`;
        document.getElementById('pageTitle').textContent = `✏️ Editando: ${nombreCompleto}`;
        
        // Restaurar botón
        if (btnSubmit) {
            btnSubmit.innerHTML = textoOriginal;
            btnSubmit.disabled = false;
        }
        
    } catch (error) {
        console.error('❌ Error al cargar cliente:', error);
        alert(`Error al cargar los datos: ${error.message}`);
        window.location.href = './polizas.html';
    }
}

/**
* Convierte CUALQUIER formato de fecha a mm/dd/aaaa
 * @param {string|Date} fecha - Fecha en cualquier formato
 * @returns {string} Fecha en formato mm/dd/aaaa
 */
function formatoUS(fecha) {
    if (!fecha) return '';
    if (typeof fecha === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) return fecha;
    
    let d;
    if (fecha instanceof Date) {
        d = fecha;
    } else if (typeof fecha === 'string') {
        if (fecha.includes('-')) {
            const partes = fecha.split('T')[0].split('-');
            d = new Date(partes[0], partes[1] - 1, partes[2]);
        } else {
            d = new Date(fecha);
        }
    } else {
        return '';
    }
    
    if (isNaN(d.getTime())) return '';
    
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    const anio = d.getFullYear();
    
    return `${mes}/${dia}/${anio}`;
}

// Para INPUTS type="date"
function formatoISO(fecha) {
    if (!fecha) return '';
    
    let d;
    if (fecha instanceof Date) {
        d = fecha;
    } else if (typeof fecha === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
            return fecha.split('T')[0];
        }
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
            const partes = fecha.split('/');
            return `${partes[2]}-${partes[0]}-${partes[1]}`;
        }
        d = new Date(fecha);
    } else {
        return '';
    }
    
    if (isNaN(d.getTime())) return '';
    
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    
    return `${anio}-${mes}-${dia}`;
}

// ============================================
// RELLENAR FORMULARIO
// ============================================

function rellenarFormulario(cliente, poliza, dependientes, notas) {
    console.log('📝 Rellenando formulario...');
    
    if (cliente.tipo_registro) document.getElementById('tipoRegistro').value = cliente.tipo_registro;
    if (cliente.fecha_registro) document.getElementById('fechaRegistro').value = formatoUS(cliente.fecha_registro);


    // CLIENTE - Datos personales
    if (cliente.nombres) document.getElementById('nombres').value = cliente.nombres;
    if (cliente.apellidos) document.getElementById('apellidos').value = cliente.apellidos;
    if (cliente.email) document.getElementById('email').value = cliente.email;
    if (cliente.telefono1) document.getElementById('telefono1').value = formatearTelefono(cliente.telefono1);
    if (cliente.telefono2) {
        document.getElementById('telefono2').value = formatearTelefono(cliente.telefono2);
    }
    
    // Fecha de nacimiento en formato mm/dd/aaaa
    if (cliente.fecha_nacimiento) document.getElementById('fechaNacimiento').value = formatoISO(cliente.fecha_nacimiento)

    if (cliente.genero) document.getElementById('genero').value = cliente.genero;
    if (cliente.ssn) document.getElementById('ssn').value = formatearSSN(cliente.ssn);
    if (cliente.estado_migratorio) document.getElementById('estadoMigratorio').value = cliente.estado_migratorio;
    if (cliente.nacionalidad) document.getElementById('nacionalidad').value = cliente.nacionalidad;
    if (cliente.ocupacion) document.getElementById('ocupacion').value = cliente.ocupacion;
    if (cliente.ingreso_anual) document.getElementById('ingresos').value = cliente.ingreso_anual;
    
    // Dirección
    if (cliente.direccion) document.getElementById('direccion').value = cliente.direccion;
    if (cliente.casa_apartamento) document.getElementById('casaApartamento').value = cliente.casa_apartamento;
    if (cliente.condado) document.getElementById('condado').value = cliente.condado;
    if (cliente.ciudad) document.getElementById('ciudad').value = cliente.ciudad;
    if (cliente.estado) document.getElementById('estado').value = cliente.estado;
    if (cliente.codigo_postal) document.getElementById('codigoPostal').value = cliente.codigo_postal;
    if (cliente.aplica) document.getElementById('aplica').value = cliente.aplica;
    if (cliente.operador_nombre) document.getElementById('operadorNombre').value = cliente.operador_nombre;
    // PÓLIZA
    if (poliza) {
        if (poliza.compania) document.getElementById('compania').value = poliza.compania;
        if (poliza.plan) document.getElementById('plan').value = poliza.plan;
        if (poliza.prima) document.getElementById('prima').value = poliza.prima;
        if (poliza.credito_fiscal) document.getElementById('creditoFiscal').value = poliza.credito_fiscal;
        if (poliza.tipo_venta) document.getElementById('tipoVenta').value = poliza.tipo_venta;
        if (poliza.enlace_poliza) document.getElementById('enlacePoliza').value = poliza.enlace_poliza;
        if (poliza.member_id) document.getElementById('memberId').value = poliza.member_id;
        if (poliza.portal_npn) document.getElementById('portalNPN').value = poliza.portal_npn;
        if (poliza.clave_seguridad) document.getElementById('claveSeguridad').value = poliza.clave_seguridad;
        if (poliza.observaciones) document.getElementById('observaciones').value = poliza.observaciones;
        
        // Fechas de cobertura en formato mm/dd/aaaa
        if (poliza.fecha_inicial_cobertura) {
            const fechaInicialUS = convertirAFormatoUS(poliza.fecha_inicial_cobertura);
            const displayInicial = document.getElementById('displayFechaInicial');
            const inputInicial = document.getElementById('fechaInicialCobertura');
            if (displayInicial) displayInicial.textContent = fechaInicialUS;
            if (inputInicial) inputInicial.value = poliza.fecha_inicial_cobertura;
        }
        
        if (poliza.fecha_final_cobertura) {
            const fechaFinalUS = convertirAFormatoUS(poliza.fecha_final_cobertura);
            const displayFinal = document.getElementById('displayFechaFinal');
            const inputFinal = document.getElementById('fechaFinalCobertura');
            if (displayFinal) displayFinal.textContent = fechaFinalUS;
            if (inputFinal) inputFinal.value = poliza.fecha_final_cobertura;
        }
        
        if (poliza.fecha_efectividad) {
            const fechaEfectividadUS = convertirAFormatoUS(poliza.fecha_efectividad);
            const displayEfectividad = document.getElementById('displayFechaEfectividad');
            const inputEfectividad = document.getElementById('fechaEfectividad');
            if (displayEfectividad) displayEfectividad.textContent = fechaEfectividadUS;
            if (inputEfectividad) inputEfectividad.value = poliza.fecha_efectividad;
        }
    }
    
    // DEPENDIENTES
    if (dependientes && dependientes.length > 0) {
        dependientes.forEach(dep => {
            agregarDependienteExistente(dep);
        });
    }
    
    // NOTAS
    if (notas && notas.length > 0) {
        mostrarNotasExistentes(notas);
    }
    
    console.log('✅ Formulario rellenado');
}

function agregarDependienteExistente(dep) {
    dependientesCount++;
    const container = document.getElementById('dependientesContainer');
    
    // Quitar empty state
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const dependienteHTML = `
        <div class="dependiente-item" id="dependiente-${dependientesCount}" data-id="${dep.id}">
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
                        <input type="text" name="dep_nombres_${dependientesCount}" value="${dep.nombres || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Apellidos <span class="required">*</span></label>
                        <input type="text" name="dep_apellidos_${dependientesCount}" value="${dep.apellidos || ''}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Fecha de Nacimiento <span class="required">*</span></label>
                        <input type="date" name="dep_fecha_nacimiento_${dependientesCount}" value="${dep.fecha_nacimiento || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Género <span class="required">*</span></label>
                        <select name="dep_genero_${dependientesCount}" required>
                            <option value="">Seleccionar...</option>
                            <option value="masculino" ${dep.genero === 'masculino' ? 'selected' : ''}>Masculino</option>
                            <option value="femenino" ${dep.genero === 'femenino' ? 'selected' : ''}>Femenino</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>SSN</label>
                        <input type="text" name="dep_ssn_${dependientesCount}" 
                               value="${dep.ssn ? formatearSSN(dep.ssn) : ''}"
                               placeholder="###-##-####" 
                               oninput="this.value = formatearSSN(this.value)">
                    </div>
                    <div class="form-group">
                        <label>Estado Migratorio</label>
                        <select name="dep_estado_migratorio_${dependientesCount}">
                            <option value="">Seleccionar...</option>
                            <option value="ciudadano" ${dep.estado_migratorio === 'ciudadano' ? 'selected' : ''}>Ciudadano</option>
                            <option value="residente" ${dep.estado_migratorio === 'residente' ? 'selected' : ''}>Residente Permanente</option>
                            <option value="visa" ${dep.estado_migratorio === 'visa' ? 'selected' : ''}>Visa</option>
                            <option value="otro" ${dep.estado_migratorio === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Relación</label>
                        <select name="dep_relacion_${dependientesCount}">
                            <option value="">Seleccionar...</option>
                            <option value="hijo/a" ${dep.relacion === 'hijo/a' ? 'selected' : ''}>Hijo/a</option>
                            <option value="conyuge" ${dep.relacion === 'conyuge' ? 'selected' : ''}>Cónyuge</option>
                            <option value="padre/madre" ${dep.relacion === 'padre/madre' ? 'selected' : ''}>Padre/Madre</option>
                            <option value="otro" ${dep.relacion === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', dependienteHTML);
    actualizarContadorDependientes();
}

function mostrarNotasExistentes(notas) {
    const thread = document.getElementById('notasThread');
    const emptyState = thread.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    notas.forEach(nota => {
        const notaHTML = `
            <div class="nota-card" data-id="${nota.id}">
                <div class="nota-header">
                    <div class="nota-info">
                        <span class="nota-usuario">${nota.usuario_nombre || nota.usuario_email}</span>
                        <span class="nota-fecha">${formatearFechaUS(nota.created_at)}</span>
                    </div>
                    <button type="button" class="btn-remove-nota" onclick="eliminarNota('${nota.id}')">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
                <div class="nota-mensaje">${nota.mensaje || ''}</div>
                ${nota.imagenes && nota.imagenes.length > 0 ? `
                    <div class="nota-imagenes">
                        ${nota.imagenes.map(img => `
                            <img src="${img}" alt="Imagen adjunta" style="max-width: 150px; border-radius: 8px; margin: 5px; cursor: pointer;" onclick="verImagenCompleta('${img}')">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        thread.insertAdjacentHTML('beforeend', notaHTML);
    });
    
    actualizarContadorNotas();
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
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
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
// VALIDACIÓN EN TIEMPO REAL
// ============================================

function inicializarValidacionTiempoReal() {
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            validarEmail(this);
        });
    }
    
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
    
    const ssn = document.getElementById('ssn');
    if (ssn) {
        ssn.addEventListener('input', function() {
            this.value = formatearSSN(this.value);
        });
        ssn.addEventListener('blur', function() {
            validarSSN(this);
        });
    }
    
    const cp = document.getElementById('codigoPostal');
    if (cp) {
        cp.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 5);
        });
        cp.addEventListener('blur', function() {
            validarCodigoPostal(this);
        });
    }
    
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

function formatearTelefono(valor) {
    const numeros = valor.replace(/\D/g, '');
    const limitado = numeros.slice(0, 10);
    
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
    const formBanco = document.getElementById('formBanco');
    const formTarjeta = document.getElementById('formTarjeta');
    
    if (formBanco) formBanco.style.display = 'none';
    if (formTarjeta) formTarjeta.style.display = 'none';
    
    if (tipo === 'banco' && formBanco) {
        formBanco.style.display = 'block';
    } else if (tipo === 'tarjeta' && formTarjeta) {
        formTarjeta.style.display = 'block';
    }
}

function limpiarMetodoPago() {
    document.querySelectorAll('[name="metodoPago"]').forEach(radio => {
        radio.checked = false;
    });
    
    const formBanco = document.getElementById('formBanco');
    const formTarjeta = document.getElementById('formTarjeta');
    
    if (formBanco) formBanco.style.display = 'none';
    if (formTarjeta) formTarjeta.style.display = 'none';
    
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
// DOCUMENTOS
// ============================================

function agregarDocumento() {
    documentosCount++;
    const container = document.getElementById('documentosContainer');
    
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
    const fileSize = (file.size / 1024).toFixed(2);
    const fileType = file.type;
    
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

async function enviarNota() {
    const textarea = document.getElementById('nuevaNota');
    const mensaje = textarea.value.trim();
    
    if (!mensaje && imagenesNotaSeleccionadas.length === 0) {
        alert('Escribe un mensaje o adjunta una imagen');
        return;
    }
    
    try {
        // Obtener usuario actual
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            alert('Debes estar autenticado para agregar notas');
            return;
        }
        
        // Guardar nota en BD
        const notaData = {
            cliente_id: clienteId,
            mensaje: mensaje,
            imagenes: imagenesNotaSeleccionadas,
            usuario_email: user.email,
            usuario_nombre: user.user_metadata?.nombre || user.email
        };
        
        const { data: nuevaNota, error } = await supabaseClient
            .from('notas')
            .insert([notaData])
            .select()
            .single();
        
        if (error) throw error;
        
        // Agregar visualmente
        const notaHTML = `
            <div class="nota-card" data-id="${nuevaNota.id}">
                <div class="nota-header">
                    <div class="nota-info">
                        <span class="nota-usuario">${nuevaNota.usuario_nombre}</span>
                        <span class="nota-fecha">Ahora</span>
                    </div>
                    <button type="button" class="btn-remove-nota" onclick="eliminarNota('${nuevaNota.id}')">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
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
        
    } catch (error) {
        console.error('Error al guardar nota:', error);
        alert('Error al guardar la nota: ' + error.message);
    }
}

async function eliminarNota(notaId) {
    if (!confirm('¿Eliminar esta nota?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('notas')
            .delete()
            .eq('id', notaId);
        
        if (error) throw error;
        
        // Remover visualmente
        const notaCard = document.querySelector(`[data-id="${notaId}"]`);
        if (notaCard) notaCard.remove();
        
        actualizarContadorNotas();
        
        // Mostrar empty state si no hay notas
        const thread = document.getElementById('notasThread');
        if (thread.querySelectorAll('.nota-card').length === 0) {
            thread.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">chat_bubble</span>
                    <p>No hay notas aún</p>
                    <small>Escribe la primera nota para este cliente</small>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error al eliminar nota:', error);
        alert('Error al eliminar la nota: ' + error.message);
    }
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

function verImagenCompleta(url) {
    window.open(url, '_blank');
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
    localStorage.setItem(`borrador_cliente_${clienteId}`, JSON.stringify(formData));
    
    const indicator = document.getElementById('autosaveIndicator');
    if (indicator) {
        indicator.style.opacity = '1';
        setTimeout(() => {
            indicator.style.opacity = '0.6';
        }, 2000);
    }
    
    console.log('💾 Borrador guardado automáticamente');
}

function guardarBorrador() {
    const formData = obtenerDatosFormulario();
    localStorage.setItem(`borrador_cliente_${clienteId}`, JSON.stringify(formData));
    alert('✅ Borrador guardado manualmente');
}

// ============================================
// SUBMIT - ACTUALIZAR CLIENTE
// ============================================

async function handleSubmit(event) {
    event.preventDefault();
    
    console.log('📤 Iniciando actualización...');
    
    if (!validarFormularioCompleto()) {
        alert('Por favor, completa todos los campos requeridos correctamente.');
        return;
    }
    
    const confirmacion = confirm('¿Actualizar este cliente y póliza?');
    if (!confirmacion) return;
    
    const btnSubmit = document.querySelector('.btn-submit');
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Actualizando...';
    btnSubmit.disabled = true;
    
    try {
        const formData = obtenerDatosFormulario();
        await actualizarCliente(clienteId, formData);
    } catch (error) {
        console.error('❌ Error:', error);
        alert(`Error al actualizar: ${error.message}`);
        
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

async function actualizarCliente(id, formData) {
    console.log('🔄 Actualizando cliente...');
    
    // Actualizar cliente
    const clienteData = {
        tipo_registro: formData.tipoRegistro,
        fecha_registro: formData.fechaRegistro,
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        genero: formData.genero,
        email: formData.email,
        telefono1: formData.telefono1,
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
        observaciones: formData.observaciones || null,
        updated_at: new Date().toISOString()
    };
    
    const { error: clienteError } = await supabaseClient
        .from('clientes')
        .update(clienteData)
        .eq('id', id);
    
    if (clienteError) throw clienteError;
    
    console.log('✅ Cliente actualizado');
    
    // Actualizar o crear póliza
    const polizaData = {
        cliente_id: id,
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
        observaciones: formData.observaciones || null,
        updated_at: new Date().toISOString()
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
            aplica: formData[`dep_aplica_${i}`] || null,
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
    
    if (polizaId) {
        // Actualizar póliza existente
        const { error: polizaError } = await supabaseClient
            .from('polizas')
            .update(polizaData)
            .eq('id', polizaId);
        
        if (polizaError) throw polizaError;
        console.log('✅ Póliza actualizada');
    } else {
        // Crear nueva póliza
        const numeroPoliza = await generarNumeroPoliza();
        polizaData.numero_poliza = numeroPoliza;
        
        const { data: nuevaPoliza, error: polizaError } = await supabaseClient
            .from('polizas')
            .insert([polizaData])
            .select()
            .single();
        
        if (polizaError) throw polizaError;
        polizaId = nuevaPoliza.id;
        console.log('✅ Póliza creada');
    }
    
    localStorage.removeItem(`borrador_cliente_${id}`);
    clearInterval(autosaveTimer);
    
    alert('✅ Cliente y póliza actualizados correctamente');
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
        localStorage.removeItem(`borrador_cliente_${clienteId}`);
        clearInterval(autosaveTimer);
        window.location.href = './polizas.html';
    }
}

// ============================================
// LOG INICIAL
// ============================================

console.log('%c✏️ CLIENTE_EDITAR.JS CORREGIDO', 'color: #00a8e8; font-size: 16px; font-weight: bold');
console.log('%c✅ Todas las correcciones aplicadas', 'color: #4caf50; font-weight: bold');
console.log('Correcciones:');
console.log('  ✓ Fechas en formato mm/dd/aaaa');
console.log('  ✓ Teléfono límite 10 caracteres');
console.log('  ✓ Fechas automáticas cargadas desde BD');
console.log('  ✓ Método de pago desplegables funcionando');
console.log('  ✓ Documentos sin tipo (solo archivo + notas)');
console.log('Funciones de edición:');
console.log('  ✓ Cargar datos existentes');
console.log('  ✓ Actualizar cliente y póliza');
console.log('  ✓ Cargar dependientes existentes');
console.log('  ✓ Cargar notas existentes');
console.log('  ✓ Eliminar notas guardadas en BD');