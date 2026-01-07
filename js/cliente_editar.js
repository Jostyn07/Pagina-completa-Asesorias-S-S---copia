// ============================================
// CLIENTE_EDITAR.JS - VERSIÓN CORREGIDA COMPLETA
// ============================================

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
document.addEventListener('DOMContentLoaded', async function() {
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

    cargarInfoUsuario();
    
    // ✅ CARGAR TODOS LOS DATOS
    try {
        await cargarDatosCliente(clienteId);
        await cargarDocumentos(clienteId);
        await cargarNotas(clienteId);
        
        console.log('✅ Todos los datos cargados correctamente');
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
    }
    
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

/**
 * Convierte CUALQUIER formato de fecha a mm/dd/aaaa
 * SIN conversiones de zona horaria
 * @param {string|Date} fecha - Fecha en cualquier formato
 * @returns {string} Fecha en formato mm/dd/aaaa
 */
function formatoUS(fecha) {
    if (!fecha) return '';
    
    try {
        // Si es string en formato ISO (yyyy-mm-dd o yyyy-mm-ddTHH:MM:SS)
        if (typeof fecha === 'string' && fecha.includes('-')) {
            const soloFecha = fecha.split('T')[0]; // Quitar hora si existe
            const [anio, mes, dia] = soloFecha.split('-');
            return `${mes}/${dia}/${anio}`;
        }
        
        // Si es string en formato US (mm/dd/yyyy)
        if (typeof fecha === 'string' && fecha.includes('/')) {
            return fecha; // Ya está en formato US
        }
        
        // Si es Date object (último recurso)
        if (fecha instanceof Date) {
            const anio = fecha.getFullYear();
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const dia = String(fecha.getDate()).padStart(2, '0');
            return `${mes}/${dia}/${anio}`;
        }
        
        return '';
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '';
    }
}

/**
 * Convierte fecha a formato ISO (yyyy-mm-dd) para inputs type="date"
 * SIN conversiones de zona horaria
 * @param {string|Date} fecha - Fecha en cualquier formato
 * @returns {string} Fecha en formato yyyy-mm-dd
 */
function formatoISO(fecha) {
    if (!fecha) return '';
    
    try {
        // Si es string en formato ISO (yyyy-mm-dd o yyyy-mm-ddTHH:MM:SS)
        if (typeof fecha === 'string' && fecha.includes('-')) {
            return fecha.split('T')[0]; // Ya está en ISO, solo quitar hora
        }
        
        // Si es string en formato US (mm/dd/yyyy)
        if (typeof fecha === 'string' && fecha.includes('/')) {
            const [mes, dia, anio] = fecha.split('/');
            return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        }
        
        // Si es Date object (último recurso)
        if (fecha instanceof Date) {
            const anio = fecha.getFullYear();
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const dia = String(fecha.getDate()).padStart(2, '0');
            return `${anio}-${mes}-${dia}`;
        }
        
        return '';
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '';
    }
}

// ============================================
// APLICAR PERMISOS ESTADO EN MERCADO
// ============================================

async function aplicarPermisosEstadoMercado() {
    const camposEstadoMercado = [
        'fechaRevisionMercado',
        'estadoMercado',
        'nombreAgenteMercado',
        'estadoDocumentos'
    ];
    
    if (!esAdministrador()) {
        // Deshabilitar campos
        camposEstadoMercado.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.disabled = true;
                field.classList.add('campo-bloqueado');
                field.style.cursor = 'not-allowed';
            }
        });
        
        // Mostrar badge y mensaje de solo admin
        const badgeAdmin = document.getElementById('badgeAdminMercado');
        const mensajeNoAdmin = document.getElementById('mensajeNoAdmin');
        
        if (badgeAdmin) badgeAdmin.style.display = 'inline-flex';
        if (mensajeNoAdmin) mensajeNoAdmin.style.display = 'block';
        
        console.log('⚠️ Estado en Mercado bloqueado - Solo Administradores');
    } else {
        console.log('✅ Administrador - Acceso completo a Estado en Mercado');
    }
}

// ============================================
// CARGAR DATOS DEL CLIENTE
// ============================================

async function cargarDatosCliente(id) {
    try {
        await cargarRolUsuario();
                
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

        await cargarMetodoPago(clienteId);

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

            await cargarEstadoSeguimiento(polizaId);
        }
        
        // Cargar dependientes
        const { data: dependientesData, error: dependientesError } = await supabaseClient
            .from('dependientes')
            .select('*')
            .eq('cliente_id', id)
            .order('created_at', { ascending: true });
        
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
        
        // En la sección donde cargas los datos de la póliza

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

        await aplicarPermisosEstadoMercado();
        capturarDatosOriginales(clienteData , polizaData);
    
        if (document.querySelector('#historial.active')) {
            await cargarHistorial(id);
        }
        
        console.log('✅ Datos cargados correctamente');
        
    } catch (error) {
        console.error('❌ Error al cargar cliente:', error);
        alert(`Error al cargar los datos: ${error.message}`);
    }
}

/**
* Convierte CUALQUIER formato de fecha a mm/dd/aaaa
 * @param {string|Date} fecha - Fecha en cualquier formato
 * @returns {string} Fecha en formato mm/dd/aaaa
 */
function formatoUS(fecha) {
    if (!fecha) return '';
    
    try {
        let date;
        
        // Si ya es un objeto Date
        if (fecha instanceof Date) {
            date = fecha;
        }
        // Si es string en formato ISO (yyyy-mm-dd)
        else if (typeof fecha === 'string' && fecha.includes('-')) {
            const partes = fecha.split('T')[0].split('-');
            date = new Date(partes[0], partes[1] - 1, partes[2]);
        }
        // Si es string en formato US (mm/dd/yyyy)
        else if (typeof fecha === 'string' && fecha.includes('/')) {
            return fecha; // Ya está en formato US
        }
        else {
            date = new Date(fecha);
        }
        
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        const anio = date.getFullYear();
        
        return `${mes}/${dia}/${anio}`;
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '';
    }
}

/**
 * Convierte fecha a formato ISO (yyyy-mm-dd) para inputs type="date"
 * @param {string|Date} fecha - Fecha en cualquier formato
 * @returns {string} Fecha en formato yyyy-mm-dd
 */
function formatoISO(fecha) {
    if (!fecha) return '';
    
    try {
        let date;
        
        // Si ya es un objeto Date
        if (fecha instanceof Date) {
            date = fecha;
        }
        // Si es string en formato US (mm/dd/yyyy)
        else if (typeof fecha === 'string' && fecha.includes('/')) {
            const partes = fecha.split('/');
            date = new Date(partes[2], partes[0] - 1, partes[1]);
        }
        // Si es string en formato ISO
        else if (typeof fecha === 'string' && fecha.includes('-')) {
            return fecha.split('T')[0]; // Ya está en ISO, solo quitar hora
        }
        else {
            date = new Date(fecha);
        }
        
        const anio = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        
        return `${anio}-${mes}-${dia}`;
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '';
    }
}

// ============================================
// RELLENAR FORMULARIO
// ============================================

function rellenarFormulario(cliente, poliza, dependientes, notas) {
    console.log('📝 Rellenando formulario...');
    
    // DATOS DEL CLIENTE
    if (cliente) {
       if (cliente.tipo_registro) document.getElementById('tipoRegistro').value = cliente.tipo_registro || '';
       if (cliente.fecha_registro) document.getElementById('fechaRegistro').value = formatoUS(cliente.fecha_registro);
       document.getElementById('aplicantes').value = poliza.aplicantes || 1;
       if (cliente.nombres) document.getElementById('nombres').value = cliente.nombres || '';
       if (cliente.apellidos) document.getElementById('apellidos').value = cliente.apellidos || '';
       if (cliente.genero) document.getElementById('genero').value = cliente.genero || '';
       if (cliente.email) document.getElementById('email').value = cliente.email || '';
       if (cliente.telefono1) document.getElementById('telefono1').value = cliente.telefono1 || '';
       if (cliente.telefono2) document.getElementById('telefono2').value = cliente.telefono2 || '';
       if (cliente.fecha_nacimiento) document.getElementById('fechaNacimiento').value = formatoUS(cliente.fecha_nacimiento);
       if (cliente.estado_migratorio) document.getElementById('estadoMigratorio').value = cliente.estado_migratorio || '';
        
        const ssnInput = document.getElementById('ssn');
        if (ssnInput && cliente.ssn) {
            ssnInput.value = formatearSSN(cliente.ssn);
        }
        
       if (cliente.ingreso_anual) document.getElementById('ingresos').value = cliente.ingreso_anual || 0;
       if (cliente.ocupacion) document.getElementById('ocupacion').value = cliente.ocupacion || '';
       if (cliente.nacionalidad) document.getElementById('nacionalidad').value = cliente.nacionalidad || '';
       if (cliente.aplica) document.getElementById('aplica').value = cliente.aplica || '';
       if (cliente.direccion) document.getElementById('direccion').value = cliente.direccion || '';
       if (cliente.casa_apartamento) document.getElementById('casaApartamento').value = cliente.casa_apartamento || '';
       if (cliente.condado) document.getElementById('condado').value = cliente.condado || '';
       if (cliente.ciudad) document.getElementById('ciudad').value = cliente.ciudad || '';
       if (cliente.estado) document.getElementById('estado').value = cliente.estado || '';
       if (cliente.codigo_postal) document.getElementById('codigoPostal').value = cliente.codigo_postal || '';
       if (cliente.operador_nombre) document.getElementById('operadorNombre').value = cliente.operador_nombre || '';
    }
    
    // DATOS DE LA PÓLIZA
    if (poliza) {
       if(poliza.compania) document.getElementById('compania').value = poliza.compania || '';
       if(poliza.plan) document.getElementById('plan').value = poliza.plan || '';
       document.getElementById('prima').value = parseFloat(poliza.prima) || 0;
       if(poliza.credito_fiscal) document.getElementById('creditoFiscal').value = parseFloat(poliza.credito_fiscal) || 0;
       if(poliza.member_id) document.getElementById('memberId').value = poliza.member_id || '';
       if(poliza.portal_npn) document.getElementById('portalNpn').value = poliza.portal_npn || '';
       if(poliza.clave_seguridad) document.getElementById('claveSeguridad').value = poliza.clave_seguridad || '';
       if(poliza.enlace_poliza) document.getElementById('enlacePoliza').value = poliza.enlace_poliza || '';
       if(poliza.documentos_pendientes) document.getElementById('documentosPendientes').value = poliza.documentos_pendientes;
        
        // Fechas de la póliza
        const fechaEfectividadInput = document.getElementById('fechaEfectividad');
        if (fechaEfectividadInput && poliza.fecha_efectividad) {
            fechaEfectividadInput.value = formatoUS(poliza.fecha_efectividad);
        }
        
        const fechaInicialInput = document.getElementById('fechaInicialCobertura');
        if (fechaInicialInput && poliza.fecha_inicial_cobertura) {
            fechaInicialInput.value = formatoUS(poliza.fecha_inicial_cobertura);
        }
        
        const fechaFinalInput = document.getElementById('fechaFinalCobertura');
        if (fechaFinalInput && poliza.fecha_final_cobertura) {
            fechaFinalInput.value = formatoISO(poliza.fecha_final_cobertura);
        }
        
        // Displays de fechas en formato US
        const displayEfectividad = document.getElementById('displayFechaEfectividad').value = formatoUS(poliza.fecha_efectividad) || null;
        if (displayEfectividad && poliza.fecha_efectividad) {
            const fechaEfectividadUS = formatoUS(poliza.fecha_efectividad);
            displayEfectividad.textContent = fechaEfectividadUS;
        }

        const displayInicial = document.getElementById('displayFechaInicial');
        if (displayInicial && poliza.fecha_inicial_cobertura) {
            const fechaInicialUS = formatoUS(poliza.fecha_inicial_cobertura);
            displayInicial.textContent = fechaInicialUS;
        }

        const displayFinal = document.getElementById('displayFechaFinal');
        if (displayFinal && poliza.fecha_final_cobertura) {
            const fechaFinalUS = formatoUS(poliza.fecha_final_cobertura);
            displayFinal.textContent = fechaFinalUS;
        }

        if(poliza.fecha_plazo_documentos) document.getElementById('fechaPlazoDocumento').value = poliza.fecha_plazo_documentos;
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

// ============================================
// DEPENDIENTES - SISTEMA DE MODAL Y TARJETAS
// ============================================

// AGREGAR DEPENDIENTE EXISTENTE (Desde BD)
function agregarDependienteExistente(dep) {
    dependientesCount++;
    
    // Convertir sexo si viene en formato antiguo
    let sexoFormateado = dep.sexo;
    if (dep.sexo === 'M') sexoFormateado = 'Masculino';
    if (dep.sexo === 'F') sexoFormateado = 'Femenino';
    
    const dependiente = {
        nombres: dep.nombres,
        apellidos: dep.apellidos,
        fecha_nacimiento: dep.fecha_nacimiento,
        sexo: sexoFormateado,
        ssn: dep.ssn || '',
        estado_migratorio: dep.estado_migratorio || '',
        relacion: dep.relacion || '',
        aplica: dep.aplica || ''
    };
    
    crearTarjetaDependiente(dependientesCount, dependiente, dep.id);
    actualizarContadorDependientes();
}

// ABRIR MODAL PARA NUEVO DEPENDIENTE
function agregarDependiente() {
    // Limpiar formulario del modal
    document.getElementById('formDependiente').reset();
    document.getElementById('modal_dep_id').value = '';
    document.getElementById('modal_dep_count').value = '';
    
    // Cambiar título
    document.getElementById('modalDependienteTitulo').textContent = 'Agregar Dependiente';
    
    // Mostrar modal
    document.getElementById('modalDependiente').classList.add('active');
    
    // Focus en primer campo
    setTimeout(() => {
        document.getElementById('modal_dep_nombres').focus();
    }, 300);
}

// CERRAR MODAL
function cerrarModalDependiente() {
    document.getElementById('modalDependiente').classList.remove('active');
    document.getElementById('formDependiente').reset();
}

// GUARDAR DEPENDIENTE DESDE MODAL
function guardarDependienteModal() {
    // Validar campos requeridos
    const nombres = document.getElementById('modal_dep_nombres').value.trim();
    const apellidos = document.getElementById('modal_dep_apellidos').value.trim();
    const fechaNacimiento = document.getElementById('modal_dep_fecha_nacimiento').value;
    const sexo = document.getElementById('modal_dep_sexo').value;
    
    if (!nombres || !apellidos || !fechaNacimiento || !sexo) {
        alert('Por favor completa todos los campos requeridos (*)');
        return;
    }
    
    // Obtener datos
    const depId = document.getElementById('modal_dep_id').value;
    const depCount = document.getElementById('modal_dep_count').value;
    
    const dependiente = {
        nombres: nombres,
        apellidos: apellidos,
        fecha_nacimiento: fechaNacimiento,
        sexo: sexo,
        ssn: document.getElementById('modal_dep_ssn').value.trim(),
        estado_migratorio: document.getElementById('modal_dep_estado_migratorio').value,
        relacion: document.getElementById('modal_dep_relacion').value,
        aplica: document.getElementById('modal_dep_aplica').value
    };
    
    if (depCount) {
        // EDITAR existente
        actualizarTarjetaDependiente(depCount, dependiente, depId);
    } else {
        // NUEVO
        dependientesCount++;
        crearTarjetaDependiente(dependientesCount, dependiente, null);
    }
    
    // Cerrar modal
    cerrarModalDependiente();
    actualizarContadorDependientes();
}

// CREAR TARJETA DE DEPENDIENTE
function crearTarjetaDependiente(count, dep, depId) {
    const container = document.getElementById('dependientesContainer');
    
    // Quitar empty state si existe
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    // Calcular edad
    const edad = calcularEdad(dep.fecha_nacimiento);
    
    // Iniciales para avatar
    const iniciales = (dep.nombres.charAt(0) + dep.apellidos.charAt(0)).toUpperCase();
    
    // Clase existente si viene de BD
    const claseExistente = depId ? 'existente' : '';
    const dataDepId = depId ? `data-dep-id="${depId}"` : '';
    
    const cardHTML = `
        <div class="dependiente-card ${claseExistente}" 
             id="dependiente-${count}" 
             ${dataDepId}>
            
            <!-- Inputs ocultos para el submit -->
            <input type="hidden" name="dep_nombres_${count}" value="${dep.nombres}">
            <input type="hidden" name="dep_apellidos_${count}" value="${dep.apellidos}">
            <input type="hidden" name="dep_fecha_nacimiento_${count}" value="${dep.fecha_nacimiento}">
            <input type="hidden" name="dep_sexo_${count}" value="${dep.sexo}">
            <input type="hidden" name="dep_ssn_${count}" value="${dep.ssn || ''}">
            <input type="hidden" name="dep_estado_migratorio_${count}" value="${dep.estado_migratorio || ''}">
            <input type="hidden" name="dep_relacion_${count}" value="${dep.relacion || ''}">
            <input type="hidden" name="dep_aplica_${count}" value="${dep.aplica || ''}">
            
            <div class="dependiente-card-header">
                <div class="dependiente-card-info">
                    <div class="dependiente-avatar">${iniciales}</div>
                    <div class="dependiente-card-nombre">
                        <h4>${dep.nombres} ${dep.apellidos}</h4>
                        <small>${edad} años • ${dep.sexo === 'masculino' ? 'Masculino' : 'Femenino'}</small>
                    </div>
                </div>
                <div class="dependiente-card-acciones">
                    <button type="button" class="btn-icon" onclick="editarDependiente(${count})" title="Editar">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button type="button" class="btn-icon delete" onclick="eliminarDependienteCard(${count}, '${depId || ''}')" title="Eliminar">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
            
            <div class="dependiente-card-detalles">
                ${dep.ssn ? `
                    <div class="dependiente-detalle">
                        <label>SSN</label>
                        <span>${formatearSSN(dep.ssn)}</span>
                    </div>
                ` : ''}
                ${dep.estado_migratorio ? `
                    <div class="dependiente-detalle">
                        <label>Estado Migratorio</label>
                        <span>${dep.estado_migratorio}</span>
                    </div>
                ` : ''}
                ${dep.relacion ? `
                    <div class="dependiente-detalle">
                        <label>Relación</label>
                        <span>${dep.relacion}</span>
                    </div>
                ` : ''}
                ${dep.aplica ? `
                    <div class="dependiente-detalle">
                        <label>Aplica</label>
                        <span>${dep.aplica}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', cardHTML);
}

// CALCULAR EDAD
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

// EDITAR DEPENDIENTE
function editarDependiente(count) {
    // Obtener datos de los inputs ocultos
    const nombres = document.querySelector(`[name="dep_nombres_${count}"]`).value;
    const apellidos = document.querySelector(`[name="dep_apellidos_${count}"]`).value;
    const fechaNacimiento = document.querySelector(`[name="dep_fecha_nacimiento_${count}"]`).value;
    const sexo = document.querySelector(`[name="dep_sexo_${count}"]`).value;
    const ssn = document.querySelector(`[name="dep_ssn_${count}"]`).value;
    const estadoMigratorio = document.querySelector(`[name="dep_estado_migratorio_${count}"]`).value;
    const relacion = document.querySelector(`[name="dep_relacion_${count}"]`).value;
    const aplica = document.querySelector(`[name="dep_aplica_${count}"]`).value;
    
    // Obtener ID si existe (dependiente de BD)
    const elemento = document.getElementById(`dependiente-${count}`);
    const depId = elemento ? elemento.getAttribute('data-dep-id') : '';
    
    // Llenar modal
    document.getElementById('modal_dep_nombres').value = nombres;
    document.getElementById('modal_dep_apellidos').value = apellidos;
    document.getElementById('modal_dep_fecha_nacimiento').value = fechaNacimiento;
    document.getElementById('modal_dep_sexo').value = sexo;
    document.getElementById('modal_dep_ssn').value = ssn;
    document.getElementById('modal_dep_estado_migratorio').value = estadoMigratorio;
    document.getElementById('modal_dep_relacion').value = relacion;
    document.getElementById('modal_dep_aplica').value = aplica;
    
    // Guardar ID y count para actualizar
    document.getElementById('modal_dep_id').value = depId;
    document.getElementById('modal_dep_count').value = count;
    
    // Cambiar título
    document.getElementById('modalDependienteTitulo').textContent = 'Editar Dependiente';
    
    // Mostrar modal
    document.getElementById('modalDependiente').classList.add('active');
}

// ACTUALIZAR TARJETA EXISTENTE
function actualizarTarjetaDependiente(count, dep, depId) {
    const card = document.getElementById(`dependiente-${count}`);
    if (!card) return;
    
    // Actualizar inputs ocultos
    card.querySelector(`[name="dep_nombres_${count}"]`).value = dep.nombres;
    card.querySelector(`[name="dep_apellidos_${count}"]`).value = dep.apellidos;
    card.querySelector(`[name="dep_fecha_nacimiento_${count}"]`).value = dep.fecha_nacimiento;
    card.querySelector(`[name="dep_sexo_${count}"]`).value = dep.sexo;
    card.querySelector(`[name="dep_ssn_${count}"]`).value = dep.ssn || '';
    card.querySelector(`[name="dep_estado_migratorio_${count}"]`).value = dep.estado_migratorio || '';
    card.querySelector(`[name="dep_relacion_${count}"]`).value = dep.relacion || '';
    card.querySelector(`[name="dep_aplica_${count}"]`).value = dep.aplica || '';
    
    // Recrear tarjeta
    card.remove();
    crearTarjetaDependiente(count, dep, depId);
}

// ELIMINAR DEPENDIENTE
async function eliminarDependienteCard(count, depId) {
    if (!confirm('¿Eliminar este dependiente?')) return;
    
    try {
        // Si tiene depId, es un dependiente de BD
        if (depId) {
            console.log('🗑️ Eliminando dependiente de BD:', depId);
            
            const { error } = await supabaseClient
                .from('dependientes')
                .delete()
                .eq('id', depId);
            
            if (error) throw error;
            
            console.log('✅ Dependiente eliminado de BD');
        }
        
        // Remover del DOM
        const card = document.getElementById(`dependiente-${count}`);
        if (card) {
            card.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                card.remove();
                
                // Verificar si hay dependientes
                const container = document.getElementById('dependientesContainer');
                if (container.querySelectorAll('.dependiente-card').length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <span class="material-symbols-rounded">family_restroom</span>
                            <p>No hay dependientes agregados</p>
                            <small>Haz clic en "Agregar Dependiente" para comenzar</small>
                        </div>
                    `;
                }
                
                actualizarContadorDependientes();
            }, 300);
        }
        
    } catch (error) {
        console.error('❌ Error al eliminar dependiente:', error);
        alert('Error al eliminar: ' + error.message);
    }
}

// ACTUALIZAR CONTADOR
function actualizarContadorDependientes() {
    const total = document.querySelectorAll('.dependiente-card').length;
    const contador = document.getElementById('dependientesCounter');
    if (contador) {
        contador.textContent = `(${total})`;
    }
}

// ============================================
// DOCUMENTOS
// ============================================

async function cargarDocumentos(clienteId) {
    try {
        console.log('📥 Cargando documentos...');
        
        const { data: documentos, error } = await supabaseClient
            .from('documentos')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('documentosContainer');
        
        if (!documentos || documentos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">upload_file</span>
                    <p>No hay documentos cargados</p>
                    <small>Haz clic en "Agregar Documento" para comenzar</small>
                </div>
            `;
            console.log('✅ Sin documentos');
            return;
        }
        
        // Limpiar container
        container.innerHTML = '';
        
        // Mostrar cada documento
        documentos.forEach(doc => {
            const docHTML = `
                <div class="documento-card" data-doc-id="${doc.id}">
                    <div class="documento-icono">
                        <span class="material-symbols-rounded">description</span>
                    </div>
                    <div class="documento-info">
                        <h4 class="documento-nombre">${doc.nombre_archivo}</h4>
                        <div class="documento-meta">
                            <span class="documento-tipo">${doc.tipo_archivo || 'Archivo'}</span>
                            <span class="documento-tamano">${(doc.tamanio / 1024).toFixed(2)} KB</span>
                            <span class="documento-fecha">Subido: ${formatoUS(doc.created_at)}</span>
                        </div>
                    </div>
                    <div class="documento-acciones">
                        <a href="${doc.url_archivo}" target="_blank" class="btn-ver-doc">
                            <span class="material-symbols-rounded">visibility</span>
                            Ver
                        </a>
                        <button type="button" class="btn-eliminar-doc" onclick="confirmarEliminarDocumento('${doc.id}')">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', docHTML);
        });
        
        console.log(`✅ ${documentos.length} documento(s) cargado(s)`);
        
    } catch (error) {
        console.error('❌ Error al cargar documentos:', error);
    }
}

async function confirmarEliminarDocumento(docId) {
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
    
    try {
        // 1. Obtener info del documento
        const { data: doc, error: fetchError } = await supabaseClient
            .from('documentos')
            .select('url_archivo')
            .eq('id', docId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 2. Extraer path del Storage
        const url = new URL(doc.url_archivo);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.indexOf('documentos');
        const storagePath = pathParts.slice(bucketIndex + 1).join('/');
        
        // 3. Eliminar del Storage
        const { error: storageError } = await supabaseClient.storage
            .from('documentos')
            .remove([storagePath]);
        
        if (storageError) console.warn('Error al eliminar de Storage:', storageError);
        
        // 4. Eliminar de BD
        const { error: dbError } = await supabaseClient
            .from('documentos')
            .delete()
            .eq('id', docId);
        
        if (dbError) throw dbError;
        
        // 5. Remover del DOM con animación
        const elemento = document.querySelector(`[data-doc-id="${docId}"]`);
        if (elemento) {
            elemento.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                elemento.remove();
                
                // 6. Verificar si quedaron documentos
                const container = document.getElementById('documentosContainer');
                if (container.querySelectorAll('.documento-card').length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <span class="material-symbols-rounded">upload_file</span>
                            <p>No hay documentos cargados</p>
                            <small>Haz clic en "Agregar Documento" para comenzar</small>
                        </div>
                    `;
                }
            }, 300);
        }
        
        console.log('✅ Documento eliminado');
        
    } catch (error) {
        console.error('Error al eliminar documento:', error);
        alert('Error al eliminar el documento: ' + error.message);
    }
}

function agregarDocumento() {
    documentosCount++;
    const container = document.getElementById('documentosContainer');
    
    // Remover empty state si existe
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const docHTML = `
        <div class="documento-card nuevo" id="documento-${documentosCount}">
            <div class="documento-icono">
                <span class="material-symbols-rounded">upload_file</span>
            </div>
            <div class="documento-info">
                <h4 class="documento-nombre" id="nombre-doc-${documentosCount}">Documento #${documentosCount}</h4>
                <div class="documento-meta">
                    <input type="file" 
                           name="doc_archivo_${documentosCount}" 
                           id="file-${documentosCount}"
                           accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" 
                           onchange="previsualizarDocumento(${documentosCount}, this)"
                           style="display: none;">
                    <label for="file-${documentosCount}" class="btn-seleccionar-archivo">
                        <span class="material-symbols-rounded">attach_file</span>
                        Seleccionar archivo
                    </label>
                    <span class="documento-estado" id="estado-doc-${documentosCount}">No seleccionado</span>
                </div>
            </div>
            <div class="documento-acciones">
                <button type="button" class="btn-eliminar-doc" onclick="eliminarDocumento(${documentosCount})">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', docHTML);
    actualizarContadorDocumentos();
}

function eliminarDocumento(id) {
    const elemento = document.getElementById(`documento-${id}`);
    if (elemento) {
        elemento.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            elemento.remove();
            
            const container = document.getElementById('documentosContainer');
            if (container.querySelectorAll('.documento-card').length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="material-symbols-rounded">upload_file</span>
                        <p>No hay documentos agregados</p>
                        <small>Haz clic en "Agregar Documento" para comenzar</small>
                    </div>
                `;
            }
            
            actualizarContadorDocumentos();
        }, 300);
    }
}

function previsualizarDocumento(id, input) {
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const nombreElemento = document.getElementById(`nombre-doc-${id}`);
    const estadoElemento = document.getElementById(`estado-doc-${id}`);
    
    if (nombreElemento) {
        nombreElemento.textContent = file.name;
    }
    
    if (estadoElemento) {
        const fileSize = (file.size / 1024).toFixed(2);
        estadoElemento.textContent = `${fileSize} KB`;
        estadoElemento.classList.add('seleccionado');
    }
}

function actualizarContadorDocumentos() {
    const total = document.querySelectorAll('.documento-card').length;
    const contador = document.getElementById('documentosCounter');
    if (contador) {
        contador.textContent = `(${total})`;
    }
}

// ============================================
// CARGAR NOTAS
// ============================================

async function cargarNotas(clienteId) {
    try {
        console.log('📥 Cargando notas...');
        
        const { data: notas, error } = await supabaseClient
            .from('notas')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const thread = document.getElementById('notasThread');
        
        if (!notas || notas.length === 0) {
            thread.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">chat_bubble</span>
                    <p>No hay notas aún</p>
                </div>
            `;
            console.log('✅ Sin notas');
            return;
        }
        
        // Limpiar thread
        thread.innerHTML = '';
        
        // Mostrar cada nota
        notas.forEach(nota => {
            const notaHTML = `
                <div class="nota-card" data-nota-id="${nota.id}">
                    <div class="nota-header">
                        <div class="nota-info">
                            <span class="nota-usuario">${nota.usuario_nombre || nota.usuario_email}</span>
                            <span class="nota-fecha">${formatoUS(nota.created_at)}</span>
                        </div>
                        <button type="button" class="btn-remove-nota" onclick="confirmarEliminarNota('${nota.id}')">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                    <div class="nota-mensaje">${nota.mensaje || ''}</div>
                    ${nota.imagenes && nota.imagenes.length > 0 ? `
                        <div class="nota-imagenes">
                            ${nota.imagenes.map((img, index) => `
                                <div class="nota-imagen-thumb" 
                                    onclick="abrirModalImagen('${img}', ${JSON.stringify(nota.imagenes).replace(/"/g, '&quot;')}, ${index})"
                                    data-tooltip="Click para ampliar">
                                    <span class="imagen-numero">${index + 1}</span>
                                    <img src="${img}" 
                                        alt="Imagen ${index + 1}"
                                        loading="lazy"
                                        onload="this.classList.add('loaded')">
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            thread.insertAdjacentHTML('beforeend', notaHTML);
        });
        
        actualizarContadorNotas();
        console.log(`✅ ${notas.length} nota(s) cargada(s)`);
        
    } catch (error) {
        console.error('❌ Error al cargar notas:', error);
    }
}

function mostrarNotasExistentes(notas) {
    // Esta función ya no se usa porque cargarNotas() hace todo
    console.log('mostrarNotasExistentes llamada (deprecada)');
}

async function agregarNota(clienteId) {
    const textarea = document.getElementById('nuevaNota');
    let mensaje = textarea ? textarea.value.trim() : '';
    
    // Validar que haya contenido
    if (!mensaje && imagenesNotaSeleccionadas.length === 0) {
        mostrarNotificacion('⚠️ Escribe un mensaje o adjunta una imagen', 'warning');
        return;
    }
    
    // Si solo hay imágenes sin mensaje, crear mensaje automático
    if (!mensaje && imagenesNotaSeleccionadas.length > 0) {
        mensaje = `📎 ${imagenesNotaSeleccionadas.length} imagen${imagenesNotaSeleccionadas.length > 1 ? 'es' : ''} adjunta${imagenesNotaSeleccionadas.length > 1 ? 's' : ''}`;
    }
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            mostrarNotificacion('❌ Debes estar autenticado', 'error');
            return;
        }
        
        const notaData = {
            cliente_id: clienteId,
            mensaje: mensaje, // Siempre tendrá valor
            imagenes: imagenesNotaSeleccionadas.length > 0 ? imagenesNotaSeleccionadas : null,
            usuario_email: user.email,
            usuario_nombre: user.user_metadata?.nombre || user.email
        };
        
        const { data: nuevaNota, error } = await supabaseClient
            .from('notas')
            .insert([notaData])
            .select()
            .single();
        
        if (error) throw error;

        await registrarNotaAgregada(clienteId, mensaje);
        
        let imagenesHTML = '';
        if (imagenesNotaSeleccionadas.length > 0) {
            const imagenesEscapadas = JSON.stringify(imagenesNotaSeleccionadas).replace(/"/g, '&quot;');
            
            imagenesHTML = `
                <div class="nota-imagenes">
                    ${imagenesNotaSeleccionadas.map((img, index) => `
                        <div class="nota-imagen-thumb" 
                             onclick="abrirModalImagen('${img}', ${imagenesEscapadas}, ${index})"
                             data-tooltip="Click para ampliar">
                            <span class="imagen-numero">${index + 1}</span>
                            <img src="${img}" 
                                 alt="Imagen ${index + 1}"
                                 loading="lazy"
                                 onload="this.classList.add('loaded')">
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        const notaHTML = `
            <div class="nota-card" data-nota-id="${nuevaNota.id}">
                <div class="nota-header">
                    <div class="nota-info">
                        <span class="nota-usuario">${nuevaNota.usuario_nombre}</span>
                        <span class="nota-fecha">Ahora</span>
                    </div>
                    <button type="button" class="btn-remove-nota" onclick="confirmarEliminarNota('${nuevaNota.id}')">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
                <div class="nota-mensaje">${mensaje}</div>
                ${imagenesHTML}
            </div>
        `;
        
        const thread = document.getElementById('notasThread');
        const emptyState = thread.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
        
        thread.insertAdjacentHTML('afterbegin', notaHTML);
        
        // Limpiar formulario
        if (textarea) textarea.value = '';
        imagenesNotaSeleccionadas = [];
        const preview = document.getElementById('imagenesPreview');
        if (preview) preview.innerHTML = '';
        
        // Actualizar contadores
        if (typeof actualizarContadorImagenes === 'function') {
            actualizarContadorImagenes();
        }
        if (typeof actualizarContadorNotas === 'function') {
            actualizarContadorNotas();
        }
        
        mostrarNotificacion('✅ Nota agregada correctamente', 'success');
        console.log('✅ Nota agregada');
        
    } catch (error) {
        console.error('❌ Error al agregar nota:', error);
        mostrarNotificacion('❌ Error al agregar nota: ' + error.message, 'error');
    }
}

async function confirmarEliminarNota(notaId) {
    if (!confirm('¿Eliminar esta nota?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('notas')
            .delete()
            .eq('id', notaId);
        
        if (error) throw error;
        
        // Remover del DOM
        const elemento = document.querySelector(`[data-nota-id="${notaId}"]`);
        if (elemento) elemento.remove();
        
        // Verificar si quedaron notas
        const thread = document.getElementById('notasThread');
        if (thread.querySelectorAll('.nota-card').length === 0) {
            thread.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">chat_bubble</span>
                    <p>No hay notas aún</p>
                </div>
            `;
        }
        
        actualizarContadorNotas();
        console.log('✅ Nota eliminada');
        
    } catch (error) {
        console.error('Error al eliminar nota:', error);
        alert('Error al eliminar nota: ' + error.message);
    }
}

function actualizarContadorNotas() {
    const total = document.querySelectorAll('.nota-card').length;
    const contador = document.getElementById('notasCounter');
    if (contador) {
        contador.textContent = `(${total})`;
    }
}

function verImagenCompleta(url) {
    window.open(url, '_blank');
}

// ============================================
// TABS Y NAVEGACIÓN
// ============================================

function inicializarTabs() {
    // ✅ FIX ERROR #1: Agregar event listeners
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            cambiarTab(tabName);
        });
    });
    
    // Tab por defecto
    cambiarTab('info-general');
    
    console.log('✅ Tabs inicializados correctamente');
}

function cambiarTab(tabName) {
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // ✅ FIX ERROR #2: Cambiar de '.tab-item' a '.tab-btn'
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activar tab seleccionado
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    if (tabName === 'historial' && clienteId) {
        cargarHistorial(clienteId);
    }
}

function siguientePestana() {
    const tabsEnOrden = [
        'info-general',
        'dependientes',
        'estado',
        'pago',
        'documentos',
        'notas',
    ];
    
    // Obtener pestaña actual
    const tabActual = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
    const indexActual = tabsEnOrden.indexOf(tabActual);
    
    if (indexActual === -1 || indexActual >= tabsEnOrden.length - 1) {
        // Ya está en la última pestaña
        alert('Ya estás en la última pestaña. Haz click en "Guardar Cliente" para finalizar.');
        return;
    }
    
    // Validar pestaña actual antes de avanzar
    if (!validarPestanaActual(tabActual)) {
        return; // No avanzar si hay errores
    }
    
    // Avanzar a la siguiente pestaña
    const siguienteTab = tabsEnOrden[indexActual + 1];
    cambiarTab(siguienteTab);
    
    // Actualizar botón si es la última pestaña
    actualizarBotonSiguiente();
}

function validarPestanaActual(tab) {
    switch(tab) {
        case 'info-general':
            return validarInfoGeneral();
        case 'dependientes':
            return true; // Dependientes son opcionales
        case 'documentos':
            return true; // Documentos son opcionales
        case 'notas':
            return true; // Notas son opcionales
        case 'metodos-pago':
            return true; // Método de pago es opcional
        default:
            return true;
    }
}

function validarInfoGeneral() {
    const camposRequeridos = [
        { id: 'tipoRegistro', nombre: 'Tipo de registro'},
        { id: 'nombres', nombre: 'Nombres' },
        { id: 'apellidos', nombre: 'Apellidos' },
        { id: 'genero', nombre: 'Género' },
        { id: 'email', nombre: 'Correo electrónico' },
        { id: 'telefono1', nombre: 'Teléfono' },
        { id: 'fechaNacimiento', nombre: 'Fecha de nacimiento' },
        { id: 'estadoMigratorio', nombre: 'Estado migratorio' },
        { id: 'direccion', nombre: 'Dirección' },
        { id: 'ciudad', nombre: 'Ciudad' },
        { id: 'estado', nombre: 'Estado' },
        { id: 'codigoPostal', nombre: 'Código postal' },
        { id: 'compania', nombre: 'Compañía' },
        { id: 'plan', nombre: 'Plan' },
        { id: 'prima', nombre: 'Prima' },
        { id: 'aplica', nombre: 'Tipo de registro'}
    ];
    
    for (const campo of camposRequeridos) {
        const elemento = document.getElementById(campo.id);
        if (!elemento || !elemento.value || elemento.value.trim() === '') {
            alert(`El campo "${campo.nombre}" es requerido antes de continuar`);
            elemento?.focus();
            return false;
        }
    }
    
    return true;
}

function actualizarBotonSiguiente() {
    const btnSiguiente = document.getElementById('btnSiguiente');
    const tabActual = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
    
    if (tabActual === 'metodos-pago') {
        // Última pestaña
        btnSiguiente.textContent = 'Finalizar';
        btnSiguiente.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Finalizar';
    } else {
        btnSiguiente.innerHTML = '<span class="material-symbols-rounded">arrow_forward</span> Siguiente';
    }
}

function toggleSection(header) {
    const section = header.parentElement;
    section.classList.toggle('collapsed');
}

function toggleSection(header) {
    const section = header.parentElement;
    section.classList.toggle('collapsed');
}

// ============================================
// VALIDACIÓN EN TIEMPO REAL
// ============================================

function inicializarValidacionTiempoReal() {
    // Teléfonos
    const telefono1 = document.getElementById('telefono1');
    const telefono2 = document.getElementById('telefono2');
    
    if (telefono1) {
        telefono1.addEventListener('input', function() {
            this.value = formatearTelefono(this.value);
        });
    }
    
    if (telefono2) {
        telefono2.addEventListener('input', function() {
            this.value = formatearTelefono(this.value);
        });
    }
    
    // SSN
    const ssn = document.getElementById('ssn');
    if (ssn) {
        ssn.addEventListener('input', function() {
            this.value = formatearSSN(this.value);
        });
    }
    
    // Email
    const email = document.getElementById('email');
    if (email) {
        email.addEventListener('blur', function() {
            validarEmail(this);
        });
    }
    
    // Código postal
    const codigoPostal = document.getElementById('codigoPostal');
    if (codigoPostal) {
        codigoPostal.addEventListener('input', function() {
            validarCodigoPostal(this);
        });
    }
    
    // Montos
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('input', function() {
            formatearMonto(this);
        });
    });
}

function formatearTelefono(valor) {
    const numeros = valor.replace(/\D/g, '').slice(0, 10);
    if (numeros.length === 0) return '';
    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 6) return `(${numeros.slice(0, 3)}) ${numeros.slice(3)}`;
    return `(${numeros.slice(0, 3)}) ${numeros.slice(3, 6)}-${numeros.slice(6, 10)}`;
}

function formatearSSN(valor) {
    const numeros = valor.replace(/\D/g, '').slice(0, 9);
    if (numeros.length === 0) return '';
    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 5) return `${numeros.slice(0, 3)}-${numeros.slice(3)}`;
    return `${numeros.slice(0, 3)}-${numeros.slice(3, 5)}-${numeros.slice(5, 9)}`;
}

function formatearMonto(input) {
    // Permitir solo números y punto decimal
    input.value = input.value.replace(/[^0-9.]/g, '');
}

function validarEmail(input) {
    const email = input.value;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (email && !regex.test(email)) {
        input.setCustomValidity('Email inválido');
        input.reportValidity();
    } else {
        input.setCustomValidity('');
    }
}

function validarTelefono(input) {
    const tel = input.value.replace(/\D/g, '');
    
    if (tel && tel.length !== 10) {
        input.setCustomValidity('Teléfono debe tener 10 dígitos');
        input.reportValidity();
    } else {
        input.setCustomValidity('');
    }
}

function validarSSN(input) {
    const ssn = input.value.replace(/\D/g, '');
    
    if (ssn && ssn.length !== 9) {
        input.setCustomValidity('SSN debe tener 9 dígitos');
        input.reportValidity();
    } else {
        input.setCustomValidity('');
    }
}

function validarCodigoPostal(input) {
    const cp = input.value.replace(/\D/g, '');
    
    if (cp && cp.length !== 5) {
        input.value = cp.slice(0, 5);
    }
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
// AUTOGUARDADO
// ============================================

function inicializarAutoguardado() {
    autosaveTimer = setInterval(guardarBorradorSilencioso, AUTOSAVE_INTERVAL);
}

function guardarBorradorSilencioso() {
    try {
        const formData = obtenerDatosFormulario();
        localStorage.setItem(`borrador_cliente_${clienteId}`, JSON.stringify(formData));
        console.log('💾 Borrador guardado automáticamente');
    } catch (error) {
        console.error('Error al guardar borrador:', error);
    }
}

function guardarBorrador() {
    guardarBorradorSilencioso();
    alert('✅ Borrador guardado');
}

// ============================================
// SUBMIT Y ACTUALIZACIÓN
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
        
        // 1. Actualizar cliente
        await actualizarCliente(clienteId, formData);
        
        // 2. Actualizar póliza
        await actualizarPoliza(polizaId, formData);

        // Actualizar estado y seguimiento
        await guardarEstadoSeguimiento(polizaId);
        
        // 3. Actualizar dependientes
        await actualizarDependientes(clienteId, formData);
        
        // 4. Guardar documentos NUEVOS
        await guardarDocumentosNuevos(clienteId);
        
        // Limpiar borrador
        localStorage.removeItem(`borrador_cliente_${clienteId}`);
        clearInterval(autosaveTimer);
        
        alert('✅ Cliente y póliza actualizados correctamente');
        window.location.href = './polizas.html';
        
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

// ============================================
// ACTUALIZAR CLIENTE
// ============================================

async function actualizarCliente(id, formData) {
    console.log('🔄 Actualizando cliente...');
   
    const clienteData = {
        tipo_registro: formData.tipoRegistro,
        fecha_registro: formData.fechaRegistro,
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        genero: formData.genero,
        email: formData.email,
        telefono1: formData.telefono1 ? formData.telefono1.replace(/\D/g, '') : null,
        telefono2: formData.telefono2 ? formData.telefono2.replace(/\D/g, '') : null,
        fecha_nacimiento: formData.fechaNacimiento,
        estado_migratorio: formData.estadoMigratorio,
        ssn: formData.ssn ? formData.ssn.replace(/\D/g, '') : null,
        ingreso_anual: parseFloat(formData.ingresos) || 0,
        ocupacion: formData.ocupacion || null,
        nacionalidad: formData.nacionalidad || null, // ✅ CORREGIDO
        aplica: formData.aplica,
        direccion: formData.direccion,
        casa_apartamento: formData.casaApartamento,
        condado: formData.condado,
        ciudad: formData.ciudad,
        estado: formData.estado,
        codigo_postal: formData.codigoPostal,
        operador_nombre: formData.operadorNombre || null,
        agente_nombre: formData.agenteNombre || null,
        updated_at: new Date().toISOString()
    };
    
    const { error: clienteError } = await supabaseClient
        .from('clientes')
        .update(clienteData)
        .eq('id', id);
    
    if (clienteError) throw clienteError;
    
    console.log('✅ Cliente actualizado');
}

// ============================================
// ACTUALIZAR PÓLIZA
// ============================================

async function actualizarPoliza(polizaId, formData) {
    console.log('🔄 Actualizando póliza...');
    
    const polizaData = {
        aplicantes: parseInt(document.getElementById('aplicantes').value) || 1,
        compania: formData.compania,
        plan: formData.plan,
        prima: parseFloat(formData.prima) || 0,
        credito_fiscal: parseFloat(formData.creditoFiscal) || 0,
        fecha_efectividad: formData.displayFechaEfectividad || formData.fechaEfectividad,
        fecha_inicial_cobertura: formData.fechaInicialCobertura,
        fecha_final_cobertura: formData.fechaFinalCobertura,
        member_id: formData.memberId || null,
        portal_npn: formData.portalNpn || null,
        clave_seguridad: formData.claveSeguridad || null,
        enlace_poliza: formData.enlacePoliza || null,
        operador_nombre: formData.operadorNombre || null,
        agente_nombre: formData.agenteNombre || null,
        observaciones: formData.observaciones || null,
        documentos_pendientes: formData.documentosPendientes || '-',
        fecha_plazo_documentos: formData.fechaPlazoDocumento || '--/--/----',
        updated_at: new Date().toISOString()
    };
    
    if (polizaId) {
        // Actualizar póliza existente
        const { error } = await supabaseClient
            .from('polizas')
            .update(polizaData)
            .eq('id', polizaId);
        
        if (error) throw error;
        console.log('✅ Póliza actualizada');
    } else {
        // Crear nueva póliza
        const numeroPoliza = await generarNumeroPoliza();
        polizaData.numero_poliza = numeroPoliza;
        polizaData.cliente_id = clienteId;
        
        const { data: nuevaPoliza, error } = await supabaseClient
            .from('polizas')
            .insert([polizaData])
            .select()
            .single();
        
        if (error) throw error;
        polizaId = nuevaPoliza.id;
        console.log('✅ Póliza creada');
    }
}

// ============================================
// ✅ ACTUALIZAR DEPENDIENTES (UPDATE + INSERT)
// ============================================

async function actualizarDependientes(clienteId, formData) {
    console.log('💾 Actualizando dependientes...');
    
    const dependientesActualizar = [];
    const dependientesInsertar = [];
    
    // Recorrer todos los dependientes en el formulario
    for (let i = 1; i <= dependientesCount; i++) {
        const elemento = document.getElementById(`dependiente-${i}`);
        if (!elemento) continue; // Fue eliminado
        
        const nombres = formData[`dep_nombres_${i}`];
        if (!nombres) continue; // Vacío
        
        const depData = {
            nombres: nombres,
            apellidos: formData[`dep_apellidos_${i}`] || '',
            fecha_nacimiento: formData[`dep_fecha_nacimiento_${i}`] || null,
            sexo: formData[`dep_sexo_${i}`] || null, // ✅ CORREGIDO
            ssn: formData[`dep_ssn_${i}`] ? formData[`dep_ssn_${i}`].replace(/\D/g, '') : null,
            estado_migratorio: formData[`dep_estado_migratorio_${i}`] || null,
            relacion: formData[`dep_relacion_${i}`] || null,
            aplica: formData[`dep_aplica_${i}`] || null
        };
        
        // Verificar si es existente o nuevo
        const depId = elemento.getAttribute('data-dep-id');
        
        if (depId) {
            // ACTUALIZAR existente
            dependientesActualizar.push({
                id: depId,
                ...depData,
                updated_at: new Date().toISOString()
            });
        } else {
            // INSERTAR nuevo
            dependientesInsertar.push({
                cliente_id: clienteId,
                ...depData
            });
        }
    }
    
    // Ejecutar actualizaciones
    for (const dep of dependientesActualizar) {
        const { id, ...updateData } = dep;
        const { error } = await supabaseClient
            .from('dependientes')
            .update(updateData)
            .eq('id', id);
        
        if (error) throw error;
    }
    
    // Ejecutar inserciones
    if (dependientesInsertar.length > 0) {
        const { error } = await supabaseClient
            .from('dependientes')
            .insert(dependientesInsertar);
        
        if (error) throw error;
    }
    
    console.log(`✅ ${dependientesActualizar.length} dependiente(s) actualizado(s)`);
    console.log(`✅ ${dependientesInsertar.length} dependiente(s) nuevo(s)`);
}

// CARGAR MÉTODO DE PAGO EXISTENTE
async function cargarMetodoPago(clienteId) {
    try {
        console.log('💳 Cargando método de pago...');
        
        const { data: metodos, error } = await supabaseClient
            .from('metodos_pago')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('activo', true)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // No hay método de pago registrado
                console.log('ℹ️ Sin método de pago registrado');
                return;
            }
            throw error;
        }
        
        if (!metodos) {
            console.log('ℹ️ Sin método de pago');
            return;
        }
        
        // Marcar el tipo de método de pago
        const radioTipo = document.querySelector(`[name="metodoPago"][value="${metodos.tipo}"]`);
        if (radioTipo) {
            radioTipo.checked = true;
            mostrarFormularioPago(metodos.tipo);
        }
        
        // Llenar campos según el tipo
        if (metodos.tipo === 'banco') {
            // Datos bancarios
            document.getElementById('nombreBanco').value = metodos.nombre_banco || '';
            document.getElementById('numeroCuenta').value = metodos.numero_cuenta || '';
            document.getElementById('routingNumber').value = metodos.routing_number || '';
            document.getElementById('nombreCuentaBanco').value = metodos.nombre_cuenta || '';
            
        } else if (metodos.tipo === 'tarjeta') {
            // Datos de tarjeta
            document.getElementById('numeroTarjeta').value = metodos.numero_tarjeta || '';
            document.getElementById('nombreTarjeta').value = metodos.nombre_tarjeta || '';
            document.getElementById('fechaExpiracion').value = metodos.fecha_expiracion || '';
            document.getElementById('cvv').value = metodos.cvv || '';
            
            const tipoTarjeta = document.getElementById('tipoTarjeta');
            if (tipoTarjeta && metodos.tipo_tarjeta) {
                tipoTarjeta.value = metodos.tipo_tarjeta;
            }
        }
        
        // Checkbox de usar misma dirección
        const usarMismaDireccion = document.getElementById('usarMismaDireccion');
        if (usarMismaDireccion) {
            usarMismaDireccion.checked = metodos.usar_misma_direccion !== false;
        }
        
        console.log(`✅ Método de pago cargado: ${metodos.tipo}`);
        
    } catch (error) {
        console.error('❌ Error al cargar método de pago:', error);
    }
}

// GUARDAR O ACTUALIZAR MÉTODO DE PAGO
async function guardarMetodoPago(clienteId) {
    try {
        // Verificar si hay un método seleccionado
        const tipoSeleccionado = document.querySelector('[name="metodoPago"]:checked');
        
        if (!tipoSeleccionado) {
            console.log('ℹ️ Sin método de pago seleccionado');
            return;
        }
        
        const tipo = tipoSeleccionado.value;
        let metodoPagoData = {
            cliente_id: clienteId,
            tipo: tipo,
            usar_misma_direccion: document.getElementById('usarMismaDireccion')?.checked !== false,
            activo: true
        };
        
        // Recopilar datos según el tipo
        if (tipo === 'banco') {
            metodoPagoData.nombre_banco = document.getElementById('nombreBanco')?.value || null;
            metodoPagoData.numero_cuenta = document.getElementById('numeroCuenta')?.value || null;
            metodoPagoData.routing_number = document.getElementById('routingNumber')?.value || null;
            metodoPagoData.nombre_cuenta = document.getElementById('nombreCuenta')?.value || null;
            
            // Limpiar campos de tarjeta
            metodoPagoData.numero_tarjeta = null;
            metodoPagoData.nombre_tarjeta = null;
            metodoPagoData.fecha_expiracion = null;
            metodoPagoData.cvv = null;
            metodoPagoData.tipo_tarjeta = null;
            
        } else if (tipo === 'tarjeta') {
            metodoPagoData.numero_tarjeta = document.getElementById('numeroTarjeta')?.value || null;
            metodoPagoData.nombre_tarjeta = document.getElementById('nombreTarjeta')?.value || null;
            metodoPagoData.fecha_expiracion = document.getElementById('fechaExpiracion')?.value || null;
            metodoPagoData.cvv = document.getElementById('cvv')?.value || null;
            metodoPagoData.tipo_tarjeta = document.getElementById('tipoTarjeta')?.value || null;
            
            // Limpiar campos de banco
            metodoPagoData.nombre_banco = null;
            metodoPagoData.numero_cuenta = null;
            metodoPagoData.routing_number = null;
            metodoPagoData.nombre_cuenta = null;
        }
        
        // Verificar si ya existe un método de pago para este cliente
        const { data: existente, error: errorBuscar } = await supabaseClient
            .from('metodos_pago')
            .select('id')
            .eq('cliente_id', clienteId)
            .eq('activo', true)
            .maybeSingle();
        
        if (errorBuscar) throw errorBuscar;
        
        if (existente) {
            // ACTUALIZAR método existente
            const { error: errorUpdate } = await supabaseClient
                .from('metodos_pago')
                .update(metodoPagoData)
                .eq('id', existente.id);
            
            if (errorUpdate) throw errorUpdate;
            
            console.log('✅ Método de pago actualizado');
            
        } else {
            // INSERTAR nuevo método
            const { error: errorInsert } = await supabaseClient
                .from('metodos_pago')
                .insert([metodoPagoData]);
            
            if (errorInsert) throw errorInsert;
            
            console.log('✅ Método de pago guardado');
        }
        
    } catch (error) {
        console.error('❌ Error al guardar método de pago:', error);
        throw error;
    }
}

// ELIMINAR MÉTODO DE PAGO
async function eliminarMetodoPago(clienteId) {
    try {
        if (!confirm('¿Eliminar el método de pago actual?')) return;
        
        const { error } = await supabaseClient
            .from('metodos_pago')
            .update({ activo: false })
            .eq('cliente_id', clienteId)
            .eq('activo', true);
        
        if (error) throw error;
        
        // Limpiar formulario
        limpiarMetodoPago();
        
        console.log('✅ Método de pago eliminado');
        alert('Método de pago eliminado correctamente');
        
    } catch (error) {
        console.error('❌ Error al eliminar método de pago:', error);
        alert('Error al eliminar el método de pago');
    }
}

// ============================================
// ✅ GUARDAR DOCUMENTOS NUEVOS (Solo los nuevos)
// ============================================

async function guardarDocumentosNuevos(clienteId) {
    console.log('💾 Guardando documentos nuevos...');
    
    const documentosGuardados = [];
    
    // Solo procesar documentos NUEVOS (no los existentes)
    for (let i = 1; i <= documentosCount; i++) {
        const elemento = document.getElementById(`documento-${i}`);
        if (!elemento) continue;
        if (elemento.classList.contains('existente')) continue; // ✅ Saltar existentes
        
        const fileInput = document.querySelector(`[name="doc_archivo_${i}"]`);
        const notasInput = document.querySelector(`[name="doc_notas_${i}"]`);
        
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) continue;
        
        const archivo = fileInput.files[0];
        const notas = notasInput ? notasInput.value : '';
        
        try {
            // Subir archivo a Storage
            const timestamp = Date.now();
            const nombreArchivo = `${clienteId}/${timestamp}_${archivo.name}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('documentos')
                .upload(nombreArchivo, archivo, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                console.error('Error al subir archivo:', uploadError);
                continue;
            }
            
            // Obtener URL pública
            const { data: urlData } = supabaseClient.storage
                .from('documentos')
                .getPublicUrl(nombreArchivo);
            
            documentosGuardados.push({
                cliente_id: clienteId,
                nombre_archivo: archivo.name,
                url_archivo: urlData.publicUrl,
                tipo_archivo: archivo.type,
                tamanio: archivo.size,
                notas: notas || null
            });
            
        } catch (error) {
            console.error(`Error procesando documento ${i}:`, error);
        }
    }
    
    // Guardar en BD
    if (documentosGuardados.length > 0) {
        const { error } = await supabaseClient
            .from('documentos')
            .insert(documentosGuardados);
        
        if (error) throw error;
        
        console.log(`✅ ${documentosGuardados.length} documento(s) nuevo(s) guardado(s)`);
    }
}

// ============================================
// HELPERS
// ============================================

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

function togglePOBox() {
    const checkbox = document.getElementById('tienePOBox');
    const poBoxGroup = document.getElementById('poBoxGroup');
    
    if (checkbox && poBoxGroup) {
        poBoxGroup.style.display = checkbox.checked ? 'block' : 'none';
    }
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
// NOTAS ADICIONALES
// ============================================

async function enviarNota() {
    await agregarNota(clienteId);
}

async function eliminarNota(notaId) {
    await confirmarEliminarNota(notaId);
    await registrarNotaEliminada(clienteId, notaId);
}

function cancelarNota() {
    const textarea = document.getElementById('nuevaNota');
    if (textarea) textarea.value = '';
    
    imagenesNotaSeleccionadas = []; 
    
    const preview = document.getElementById('imagenesPreview');
    if (preview) preview.innerHTML = '';
    
    actualizarContadorImagenes();
    
    const input = document.getElementById('notaImagen');
    if (input) input.value = '';
}

function previsualizarImagenesNota() {
    const input = document.getElementById('notaImagen'); // ✅ ID correcto
    
    if (!input || !input.files || input.files.length === 0) return;
    
    Array.from(input.files).forEach((file) => {
        // Validar tamaño (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            mostrarNotificacion('⚠️ ' + file.name + ' es muy grande (máx 5MB)', 'warning');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            imagenesNotaSeleccionadas.push(e.target.result);
            actualizarPrevisualizacionImagenes();
            actualizarContadorImagenes();
        };
        
        reader.readAsDataURL(file);
    });
    
    // Limpiar input para permitir seleccionar el mismo archivo después
    input.value = '';
    
    // Feedback
    const numArchivos = input.files.length;
    mostrarNotificacion(`✅ ${numArchivos} imagen${numArchivos > 1 ? 'es' : ''} agregada${numArchivos > 1 ? 's' : ''}`, 'success');
}

function quitarImagenNota(index) {
    imagenesNotaSeleccionadas.splice(index, 1);
    actualizarPrevisualizacionImagenes();
    actualizarContadorImagenes();
    mostrarNotificacion('🗑️ Imagen eliminada', 'info');
}

// ============================================
// MENÚ DE USUARIO
// ============================================

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('active');
}

// Cerrar menú al hacer click fuera
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');
    
    if (dropdown && userMenu && !userMenu.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

async function cerrarSesion() {
    const confirmacion = confirm('¿Estás seguro de que deseas cerrar sesión?');
    
    if (!confirmacion) return;
    
    try {
        // Cerrar sesión en Supabase
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) throw error;
        
        // Limpiar localStorage
        localStorage.clear();
        
        // Redirigir al login
        window.location.href = '../index.html';
        
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert('Error al cerrar sesión: ' + error.message);
    }
}

// Cargar información del usuario
async function cargarInfoUsuario() {
    try {
        // Obtener usuario autenticado
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error) throw error;
        
        if (!user) {
            console.warn('⚠️ No hay usuario autenticado');
            // Redirigir al login si no hay usuario
            window.location.href = '../index.html';
            return;
        }
        
        console.log('✅ Usuario cargado:', user);
        
        // Extraer información del usuario
        const email = user.email || 'usuario@ejemplo.com';
        const metadata = user.user_metadata || {};
        
        // Intentar obtener el nombre de diferentes fuentes
        let nombreCompleto = metadata.full_name || 
                            metadata.name || 
                            metadata.display_name ||
                            email.split('@')[0];
        
        // Si el nombre tiene formato "nombre apellido", tomar solo el primer nombre
        const primerNombre = nombreCompleto.split(' ')[0];
        
        // Actualizar elementos del DOM
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.querySelector('.user-avatar');
        
        if (userName) {
            userName.textContent = primerNombre;
        }
        
        if (userEmail) {
            userEmail.textContent = email;
        }
        
        // Actualizar avatar
        if (userAvatar) {
            // Si el usuario tiene foto de perfil en metadata
            if (metadata.avatar_url || metadata.picture) {
                userAvatar.src = metadata.avatar_url || metadata.picture;
            } else {
                // Generar avatar con iniciales
                const iniciales = obtenerIniciales(nombreCompleto);
                const colorFondo = generarColorDesdeTexto(email);
                userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(iniciales)}&background=${colorFondo}&color=fff&size=80&bold=true`;
            }
            
            userAvatar.alt = nombreCompleto;
        }
        
        console.log('✅ Información de usuario actualizada');
        
    } catch (error) {
        console.error('❌ Error al cargar info de usuario:', error);
        // No redirigir si es solo un error de carga
    }
}

// Obtener iniciales del nombre
function obtenerIniciales(nombre) {
    if (!nombre) return 'U';
    
    const palabras = nombre.trim().split(' ').filter(p => p.length > 0);
    
    if (palabras.length === 0) return 'U';
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    
    // Tomar primera letra de primer y último nombre
    return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

// Generar color consistente desde un texto (para el avatar)
function generarColorDesdeTexto(texto) {
    if (!texto) return '667eea';
    
    // Lista de colores agradables
    const colores = [
        '667eea', // Morado
        '764ba2', // Morado oscuro
        'f093fb', // Rosa
        '4facfe', // Azul claro
        '43e97b', // Verde
        'fa709a', // Rosa fuerte
        'fee140', // Amarillo
        '30cfd0', // Turquesa
        'a8edea', // Menta
        'ff6b6b'  // Rojo suave
    ];
    
    // Generar hash simple del texto
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
        hash = texto.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Seleccionar color basado en el hash
    const index = Math.abs(hash) % colores.length;
    return colores[index];
}

// Llamar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    cargarInfoUsuario();
});

// ============================================
// TAB ESTADO Y SEGUIMIENTO
// ============================================

// Variables globales para seguimientos
let seguimientosCount = 0;
let seguimientosData = [];

// ============================================
// CARGAR ESTADO Y SEGUIMIENTO
// ============================================

async function cargarEstadoSeguimiento(polizaId) {
    try {
        console.log('📊 Cargando estado y seguimiento...');
        
        const { data: poliza, error } = await supabaseClient
            .from('polizas')
            .select('*')
            .eq('id', polizaId)
            .single();
        
        if (error) throw error;
        
        if (poliza) {
            // ===== 1) ESTADO EN COMPAÑÍA =====
            if (poliza.fecha_revision_compania) {
                document.getElementById('fechaRevisionCompania').value = formatoUS(poliza.fecha_revision_compania);
            }
            if (poliza.nombre_agente_compania) {
                document.getElementById('nombreAgenteCompania').value = poliza.nombre_agente_compania;
            }
            if (poliza.estado_compania) {
                document.getElementById('estadoCompania').value = poliza.estado_compania;
                actualizarBadgeEstado('badgeEstadoCompania', poliza.estado_compania);
            }
            
            // ===== 2) ESTADO EN MERCADO =====
            if (poliza.fecha_revision_mercado) {
                document.getElementById('fechaRevisionMercado').value = formatoISO(poliza.fecha_revision_mercado);
            }
            if (poliza.estado_mercado) {
                document.getElementById('estadoMercado').value = poliza.estado_mercado;
                actualizarBadgeEstado('badgeEstadoMercado', poliza.estado_mercado);
            }
            if (poliza.nombre_agente_mercado) {
                document.getElementById('nombreAgenteMercado').value = poliza.nombre_agente_mercado;
            }
            if (poliza.estado_documentos) {
                document.getElementById('estadoDocumentos').value = poliza.estado_documentos;
                actualizarBadgeEstado('badgeEstadoDocumentos', poliza.estado_documentos);
            }
            
            console.log('✅ Estado y seguimiento cargado');
        }
        
        // Cargar seguimientos
        await cargarSeguimientos(polizaId);
        
        // Cargar historial
        await cargarHistorialEstados(polizaId);
        
    } catch (error) {
        console.error('❌ Error al cargar estado:', error);
    }
}

// ============================================
// ACTUALIZAR BADGES DE ESTADO
// ============================================

function actualizarBadgeEstado(badgeId, estado) {
    const badge = document.getElementById(badgeId);
    if (!badge) return;
    
    // Remover clases anteriores
    badge.className = 'badge';
    
    // Agregar clase del estado
    badge.classList.add(estado);
    
    // Textos para estados generales
    const textosGenerales = {
        'pendiente': 'Pendiente',
        'en_revision': 'En Revisión',
        'aprobado': 'Aprobado',
        'rechazado': 'Rechazado',
        'cancelado': 'Cancelado',
        'activo': 'Activo'
    };
    
    // Textos para estados de documentos
    const textosDocumentos = {
        'pendiente': 'Pendiente',
        'incompleto': 'Incompleto',
        'en_verificacion': 'A la espera de verificación',
        'completo': 'Documentos completos'
    };
    
    // Determinar qué textos usar
    const textos = badgeId === 'badgeEstadoDocumentos' ? textosDocumentos : textosGenerales;
    
    badge.textContent = textos[estado] || 'Sin estado';
}

// Listeners para actualizar badges en tiempo real
document.addEventListener('DOMContentLoaded', function() {
    const estadoCompania = document.getElementById('estadoCompania');
    const estadoMercado = document.getElementById('estadoMercado');
    const estadoDocumentos = document.getElementById('estadoDocumentos');
    
    if (estadoCompania) {
        estadoCompania.addEventListener('change', function() {
            actualizarBadgeEstado('badgeEstadoCompania', this.value);
        });
    }
    
    if (estadoMercado) {
        estadoMercado.addEventListener('change', function() {
            actualizarBadgeEstado('badgeEstadoMercado', this.value);
        });
    }
    
    if (estadoDocumentos) {
        estadoDocumentos.addEventListener('change', function() {
            actualizarBadgeEstado('badgeEstadoDocumentos', this.value);
        });
    }
});

// ============================================
// GUARDAR ESTADO Y SEGUIMIENTO
// ============================================

async function guardarEstadoSeguimiento(polizaId) {
    try {
        console.log('💾 Guardando estado y seguimiento...');
        
        const estadoData = {
            // 1) Estado en Compañía
            fecha_revision_compania: document.getElementById('fechaRevisionCompania')?.value || null,
            nombre_agente_compania: document.getElementById('nombreAgenteCompania')?.value || null,
            estado_compania: document.getElementById('estadoCompania')?.value || null,

            updated_at: new Date().toISOString(),
        };
            // 2) Estado en Mercado
        if (esAdministrador()) {
            estadoData.fecha_revision_mercado = document.getElementById('fechaRevisionMercado')?.value || null;
            estadoData.estado_mercado = document.getElementById('estadoMercado')?.value || null;
            estadoData.nombre_agente_mercado = document.getElementById('nombreAgenteMercado')?.value || null;
            estadoData.observacion_mercado = document.getElementById('observacionMercado')?.value || null;
            estadoData.estado_documentos = document.getElementById('estadoDocumentos')?.value || null;
            
            console.log('✅ Admin - Guardando Estado en Mercado');
        } else {
            console.log('⚠️ Operador - Estado en Mercado NO se guardará');
        }
                
        const { error } = await supabaseClient
            .from('polizas')
            .update(estadoData)
            .eq('id', polizaId);
        
        if (error) throw error;
        
        console.log('✅ Estado y seguimiento guardado');
        
        // Registrar cambio en historial
        await registrarCambioEstado(polizaId, estadoData);
        
    } catch (error) {
        console.error('❌ Error al guardar estado:', error);
        throw error;
    }
}

// ============================================
// 3) SEGUIMIENTOS
// ============================================

async function cargarSeguimientos(polizaId) {
    try {
        const { data: seguimientos, error } = await supabaseClient
            .from('seguimientos')
            .select('*')
            .eq('poliza_id', polizaId)
            .order('fecha_seguimiento', { ascending: false });
        
        if (error && error.code !== 'PGRST116') {
            console.warn('⚠️ Error al cargar seguimientos:', error);
            return;
        }
        
        const container = document.getElementById('seguimientosContainer');
        if (!container) return;
        
        if (!seguimientos || seguimientos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">assignment</span>
                    <p>No hay seguimientos registrados</p>
                    <small>Click en "Agregar Seguimiento" para crear uno nuevo</small>
                </div>
            `;
            return;
        }
        
        // Renderizar seguimientos
        container.innerHTML = seguimientos.map(seg => renderSeguimientoCard(seg)).join('');
        
        // Guardar en memoria
        seguimientosData = seguimientos;
        
    } catch (error) {
        console.error('Error al cargar seguimientos:', error);
    }
}

function renderSeguimientoCard(seg) {
    const iconosMedio = {
        'telefono': 'phone',
        'email': 'email',
        'whatsapp': 'chat',
        'sms': 'sms',
    };
    
    const icono = iconosMedio[seg.medio_comunicacion] || 'contact_support';
    
    return `
        <div class="seguimiento-card" data-seg-id="${seg.id}">
            <div class="seguimiento-header">
                <div class="seguimiento-info">
                    <div class="seguimiento-fecha">
                        <span class="material-symbols-rounded">event</span>
                        ${formatoUS(seg.fecha_seguimiento)}
                    </div>
                    <div class="seguimiento-medio ${seg.medio_comunicacion}">
                        <span class="material-symbols-rounded">${icono}</span>
                        ${formatearMedioComunicacion(seg.medio_comunicacion)}
                    </div>
                </div>
                <div class="seguimiento-actions-btn">
                    <button class="btn-edit-seg" onclick="editarSeguimiento('${seg.id}')" title="Editar">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button class="btn-delete-seg" onclick="eliminarSeguimiento('${seg.id}')" title="Eliminar">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
            <div class="seguimiento-observacion">
                ${seg.observacion}
            </div>
            ${seg.created_at ? `
                <div class="seguimiento-meta">
                    <div class="seguimiento-meta-item">
                        <span class="material-symbols-rounded">schedule</span>
                        <span>Registrado: ${formatoUS(seg.created_at)}</span>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function formatearMedioComunicacion(medio) {
    const medios = {
        'telefono': 'Teléfono',
        'email': 'Email',
        'whatsapp': 'WhatsApp',
        'sms': 'SMS',
    };
    return medios[medio] || medio;
}

// ============================================
// MODAL DE SEGUIMIENTO
// ============================================

function agregarSeguimiento() {
    // Limpiar formulario
    document.getElementById('formSeguimiento').reset();
    document.getElementById('modal_seg_id').value = '';
    
    // Cambiar título
    document.getElementById('modalSeguimientoTitulo').textContent = 'Agregar Seguimiento';
    
    // Establecer fecha de hoy
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('modal_seg_fecha').value = hoy;
    
    // Mostrar modal
    document.getElementById('modalSeguimiento').classList.add('active');
}

function cerrarModalSeguimiento() {
    document.getElementById('modalSeguimiento').classList.remove('active');
    document.getElementById('formSeguimiento').reset();
}

async function guardarSeguimientoModal() {
    const form = document.getElementById('formSeguimiento');
    
    if (!form.checkValidity()) {
        alert('Por favor, completa todos los campos requeridos');
        return;
    }
    
    const segId = document.getElementById('modal_seg_id').value;
    const seguimiento = {
        poliza_id: polizaId,
        fecha_seguimiento: document.getElementById('modal_seg_fecha').value,
        medio_comunicacion: document.getElementById('modal_seg_medio').value,
        observacion: document.getElementById('modal_seg_observacion').value
    };
    
    try {
        if (segId) {
            // ACTUALIZAR existente
            const { error } = await supabaseClient
                .from('seguimientos')
                .update(seguimiento)
                .eq('id', segId);
            
            if (error) throw error;
            
            console.log('✅ Seguimiento actualizado');
        } else {
            // INSERTAR nuevo
            const { error } = await supabaseClient
                .from('seguimientos')
                .insert([seguimiento]);
            
            if (error) throw error;
            
            console.log('✅ Seguimiento creado');
        }
        
        // Recargar seguimientos
        await cargarSeguimientos(polizaId);
        
        // Cerrar modal
        cerrarModalSeguimiento();
        
    } catch (error) {
        console.error('Error al guardar seguimiento:', error);
        alert('Error al guardar el seguimiento: ' + error.message);
    }
}

async function editarSeguimiento(segId) {
    try {
        const { data: seg, error } = await supabaseClient
            .from('seguimientos')
            .select('*')
            .eq('id', segId)
            .single();
        
        if (error) throw error;
        
        // Llenar formulario
        document.getElementById('modal_seg_id').value = seg.id;
        document.getElementById('modal_seg_fecha').value = formatoISO(seg.fecha_seguimiento);
        document.getElementById('modal_seg_medio').value = seg.medio_comunicacion;
        document.getElementById('modal_seg_observacion').value = seg.observacion;
        
        // Cambiar título
        document.getElementById('modalSeguimientoTitulo').textContent = 'Editar Seguimiento';
        
        // Mostrar modal
        document.getElementById('modalSeguimiento').classList.add('active');
        
    } catch (error) {
        console.error('Error al cargar seguimiento:', error);
        alert('Error al cargar el seguimiento');
    }
}

async function eliminarSeguimiento(segId) {
    if (!confirm('¿Eliminar este seguimiento?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('seguimientos')
            .delete()
            .eq('id', segId);
        
        if (error) throw error;
        
        // Animar eliminación
        const card = document.querySelector(`[data-seg-id="${segId}"]`);
        if (card) {
            card.classList.add('removing');
            setTimeout(() => {
                cargarSeguimientos(polizaId);
            }, 300);
        }
        
        console.log('✅ Seguimiento eliminado');
        
    } catch (error) {
        console.error('Error al eliminar seguimiento:', error);
        alert('Error al eliminar el seguimiento');
    }
}

// ============================================
// HISTORIAL DE ESTADOS
// ============================================

async function cargarHistorialEstados(polizaId) {
    try {
        const { data: historial, error } = await supabaseClient
            .from('historial_estados')
            .select('*')
            .eq('poliza_id', polizaId)
            .order('created_at', { ascending: false });
        
        if (error && error.code !== 'PGRST116') {
            console.warn('⚠️ Tabla historial_estados no existe o sin datos');
            return;
        }
        
        const container = document.getElementById('historialEstados');
        if (!container) return;
        
        if (!historial || historial.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">event_note</span>
                    <p>No hay cambios de estado registrados</p>
                </div>
            `;
            return;
        }
        
        // Renderizar historial
        container.innerHTML = historial.map(item => `
            <div class="timeline-item">
                <div class="timeline-dot ${item.estado_nuevo}"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <div class="timeline-title">
                            <span class="badge ${item.estado_nuevo}">${formatearEstado(item.estado_nuevo)}</span>
                            <span>${item.tipo === 'compania' ? 'Compañía' : item.tipo === 'mercado' ? 'Mercado' : 'Documentos'}</span>
                        </div>
                        <div class="timeline-date">${formatoUS(item.created_at)}</div>
                    </div>
                    ${item.notas ? `<div class="timeline-description">${item.notas}</div>` : ''}
                    ${item.agente_nombre ? `
                        <div class="timeline-meta">
                            <div class="timeline-meta-item">
                                <span class="material-symbols-rounded">person</span>
                                <span>${item.agente_nombre}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
    }
}

function formatearEstado(estado) {
    const textos = {
        'pendiente': 'Pendiente',
        'en_revision': 'En Revisión',
        'aprobado': 'Aprobado',
        'rechazado': 'Rechazado',
        'cancelado': 'Cancelado',
        'activo': 'Activo',
        'incompleto': 'Incompleto',
        'en_verificacion': 'En Verificación',
        'completo': 'Completo'
    };
    return textos[estado] || estado;
}

async function registrarCambioEstado(polizaId, estadoData) {
    try {
        // Obtener estado anterior
        const { data: polizaAnterior } = await supabaseClient
            .from('polizas')
            .select('estado_compania, estado_mercado, estado_documentos')
            .eq('id', polizaId)
            .single();
        
        const cambios = [];
        
        // Verificar cambio en compañía
        if (estadoData.estado_compania && estadoData.estado_compania !== polizaAnterior?.estado_compania) {
            cambios.push({
                poliza_id: polizaId,
                tipo: 'compania',
                estado_anterior: polizaAnterior?.estado_compania,
                estado_nuevo: estadoData.estado_compania,
                agente_nombre: estadoData.nombre_agente_compania,
                notas: null
            });
        }
        
        // Verificar cambio en mercado
        if (estadoData.estado_mercado && estadoData.estado_mercado !== polizaAnterior?.estado_mercado) {
            cambios.push({
                poliza_id: polizaId,
                tipo: 'mercado',
                estado_anterior: polizaAnterior?.estado_mercado,
                estado_nuevo: estadoData.estado_mercado,
                agente_nombre: estadoData.nombre_agente_mercado,
                notas: estadoData.observacion_mercado
            });
        }
        
        // Verificar cambio en documentos
        if (estadoData.estado_documentos && estadoData.estado_documentos !== polizaAnterior?.estado_documentos) {
            cambios.push({
                poliza_id: polizaId,
                tipo: 'documentos',
                estado_anterior: polizaAnterior?.estado_documentos,
                estado_nuevo: estadoData.estado_documentos,
                agente_nombre: estadoData.nombre_agente_mercado,
                notas: null
            });
        }
        
        // Insertar cambios en historial
        if (cambios.length > 0) {
            const { error } = await supabaseClient
                .from('historial_estados')
                .insert(cambios);
            
            if (error && error.code !== '42P01') {
                console.warn('⚠️ No se pudo guardar historial:', error);
            }
        }
        
    } catch (error) {
        console.warn('⚠️ Error al registrar historial:', error);
    }
}

// ============================================
// ARCHIVAR CLIENTE (SOLO ADMIN)
// ============================================

let clienteIdParaArchivar = null;

// Mostrar botón archivar
async function mostrarBotonArchivar() {
    const btnArchivar = document.getElementById('btnArchivarCliente');
    
    if (!btnArchivar) return;
    
    if (!rolUsuario) {
        await cargarRolUsuario();
    }
    
    if (esAdministrador()) {
        btnArchivar.style.display = 'flex';
    }
}

// Confirmar archivado
function confirmarArchivarCliente() {
    if (!esAdministrador()) {
        alert('⚠️ No tienes permisos para archivar clientes');
        return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    clienteIdParaArchivar = urlParams.get('id');
    
    if (!clienteIdParaArchivar) {
        alert('❌ Error: No se encontró el ID del cliente');
        return;
    }
    
    document.getElementById('motivoArchivo').value = '';
    
    const modal = document.getElementById('modalArchivarCliente');
    if (modal) modal.style.display = 'flex';
}

// Cerrar modal
function cerrarModalArchivar() {
    const modal = document.getElementById('modalArchivarCliente');
    if (modal) modal.style.display = 'none';
    clienteIdParaArchivar = null;
}

// Ejecutar archivado
async function ejecutarArchivarCliente() {
    if (!esAdministrador()) {
        alert('⚠️ No tienes permisos');
        cerrarModalArchivar();
        return;
    }
    
    if (!clienteIdParaArchivar) {
        alert('❌ Error: No se encontró el ID');
        cerrarModalArchivar();
        return;
    }
    
    try {
        const motivo = document.getElementById('motivoArchivo').value;
        const usuarioData = JSON.parse(localStorage.getItem('usuario'));
        
        const { error } = await supabaseClient
            .from('clientes')
            .update({
                archivado: true,
                archivado_por: usuarioData?.nombre || 'Admin',
                archivado_fecha: new Date().toISOString(),
                motivo_archivo: motivo || null
            })
            .eq('id', clienteIdParaArchivar);
        
        if (error) throw error;
        
        cerrarModalArchivar();
        alert('✅ Cliente archivado exitosamente');
        window.location.href = './polizas.html';
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al archivar cliente: ' + error.message);
    }
}

// Llamar al cargar
document.addEventListener('DOMContentLoaded', async function() {
    await mostrarBotonArchivar();
});

// ============================================
// MANEJO DE SUB-PESTAÑAS DE SEGUIMIENTO
// ============================================

/**
 * Inicializar sub-pestañas de seguimiento (Agente 3.5, Estado Compañía, etc.)
 */
function inicializarSubPestanas() {
    const botonesSubPestanas = document.querySelectorAll('.tab-btn-poliza');
    
    botonesSubPestanas.forEach(boton => {
        boton.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            cambiarSubPestana(target);
        });
    });
    
    console.log('✅ Sub-pestañas de seguimiento inicializadas');
}

/**
 * Cambiar entre sub-pestañas
 */
function cambiarSubPestana(targetTab) {
    // Desactivar todos los botones
    document.querySelectorAll('.tab-btn-poliza').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Ocultar todo el contenido
    document.querySelectorAll('.tab-poliza').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activar el botón seleccionado
    const botonActivo = document.querySelector(`.tab-btn-poliza[data-target="${targetTab}"]`);
    if (botonActivo) {
        botonActivo.classList.add('active');
    }
    
    // Mostrar el contenido seleccionado
    const contenidoActivo = document.querySelector(`.tab-poliza[data-tab="${targetTab}"]`);
    if (contenidoActivo) {
        contenidoActivo.classList.add('active');
    }
}

// ============================================
// FUNCIONES AGENTE 3.5
// ============================================

/**
 * Cargar datos de Agente 3.5 en el formulario
 */
function cargarAgente35(poliza) {
    if (!poliza) return;
    
    // Cargar estado
    const selectEstado = document.getElementById('agente35_estado');
    if (selectEstado && poliza.agente35_estado) {
        selectEstado.value = poliza.agente35_estado;
    }
    
    // Cargar notas
    const textareaNotas = document.getElementById('agente35_notas');
    if (textareaNotas) {
        textareaNotas.value = poliza.agente35_notas || '';
    }
    
    // Cargar fecha de actualización
    const inputFecha = document.getElementById('agente35_fecha');
    if (inputFecha) {
        if (poliza.agente35_fecha_actualizacion) {
            inputFecha.value = formatearFechaHora(poliza.agente35_fecha_actualizacion);
        } else {
            inputFecha.value = 'Sin actualizar';
        }
    }
    
    // Cargar quién actualizó
    const inputActualizadoPor = document.getElementById('agente35_actualizado_por');
    if (inputActualizadoPor) {
        inputActualizadoPor.value = poliza.agente35_actualizado_por || 'Sin actualizar';
    }
    
    console.log('✅ Datos de Agente 3.5 cargados');
}

/**
 * Obtener datos de Agente 3.5 del formulario para guardar
 */
function obtenerDatosAgente35() {
    const estado = document.getElementById('agente35_estado')?.value || null;
    const notas = document.getElementById('agente35_notas')?.value || null;
    
    // Obtener usuario actual
    const usuarioData = localStorage.getItem('usuario');
    const usuario = usuarioData ? JSON.parse(usuarioData) : null;
    
    return {
        agente35_estado: estado,
        agente35_notas: notas,
        agente35_fecha_actualizacion: estado ? new Date().toISOString() : null,
        agente35_actualizado_por: estado ? (usuario?.nombre || usuario?.email || 'Usuario') : null
    };
}

/**
 * Formatear fecha con hora (MM/DD/YYYY HH:MM)
 */
function formatearFechaHora(fecha) {
    if (!fecha) return '-';
    
    try {
        const date = new Date(fecha);
        
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        const anio = date.getFullYear();
        const hora = String(date.getHours()).padStart(2, '0');
        const minutos = String(date.getMinutes()).padStart(2, '0');
        
        return `${mes}/${dia}/${anio} ${hora}:${minutos}`;
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '-';
    }
}

/**
 * Obtener badge HTML para el estado de Agente 3.5
 */
function obtenerBadgeAgente35(estado) {
    if (!estado) {
        return '<span class="badge-agente35 sin-estado">Sin estado</span>';
    }
    
    const badges = {
        'Procesado': '<span class="badge-agente35 procesado">✓ Procesado</span>',
        'Pendiente': '<span class="badge-agente35 pendiente">⏳ Pendiente</span>',
        'Cambio necesario': '<span class="badge-agente35 cambio">⚠ Cambio necesario</span>'
    };
    
    return badges[estado] || '<span class="badge-agente35 sin-estado">-</span>';
}

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    inicializarSubPestanas();
});

// También inicializar si el script se carga después del DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(inicializarSubPestanas, 100);
}

/**
 * Actualizar previsualizacion de imagenes
 */
function actualizarPrevisualizacionImagenes() {
    const preview = document.getElementById('imagenesPreview');
    
    if (!preview) return;
    
    // Limpiar previsualizacion
    preview.innerHTML = '';
    
    // Renderizar todas las imagenes
    imagenesNotaSeleccionadas.forEach((imagen, index) => {
        const imgHTML = `
            <div class="imagen-preview" id="preview-nota-${index}">
                <img src="${imagen}" alt="Preview ${index + 1}">
                <button type="button" class="btn-remove-imagen" onclick="quitarImagenNota(${index})">
                    <span class="material-symbols-rounded">close</span>
                </button>
                <div class="imagen-info">
                    Imagen ${index + 1}
                </div>
            </div>
        `;
        
        preview.insertAdjacentHTML('beforeend', imgHTML);
    });
}

/**
 * Actualizar contador de imagenes
 */
function actualizarContadorImagenes() {
    const contador = document.getElementById('archivosSeleccionados');
    
    if (!contador) return;
    
    const numImagenes = imagenesNotaSeleccionadas.length;
    
    if (numImagenes === 0) {
        contador.textContent = 'Ningún archivo seleccionado';
        contador.style.color = '#64748b';
        contador.style.fontWeight = 'normal';
    } else {
        contador.textContent = `${numImagenes} imagen${numImagenes > 1 ? 'es' : ''} adjunta${numImagenes > 1 ? 's' : ''}`;
        contador.style.color = '#10b981';
        contador.style.fontWeight = '600';
    }
}

/**
 * Mostrar notificacion temporal
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    let notif = document.getElementById('notificacionPaste');
    
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'notificacionPaste';
        notif.className = 'notificacion-paste';
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            font-weight: 600;
            font-size: 0.95rem;
            z-index: 10001;
            opacity: 0;
            transform: translateX(400px);
            transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            color: white;
        `;
        document.body.appendChild(notif);
    }
    
    const colores = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    notif.style.background = colores[tipo] || colores.info;
    notif.textContent = mensaje;
    notif.style.opacity = '1';
    notif.style.transform = 'translateX(0)';
    
    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateX(400px)';
    }, 3000);
}

// ============================================
// SISTEMA DE HISTORIAL DE CAMBIOS
// Agregar a cliente_editar.js
// ============================================

// Variables globales para el historial
let datosOriginalesCliente = {};
let datosOriginalesPoliza = {};
let historialPaginaActual = 1;
let historialPorPagina = 20;

/**
 * Capturar datos originales al cargar el cliente
 * Llamar en cargarDatosCliente()
 */
function capturarDatosOriginales(cliente, poliza) {
    // Clonar profundamente los datos originales
    datosOriginalesCliente = JSON.parse(JSON.stringify(cliente || {}));
    datosOriginalesPoliza = JSON.parse(JSON.stringify(poliza || {}));
    
    console.log('📸 Datos originales capturados');
}

/**
 * Comparar valores y determinar cambios
 */
function compararCambios(datosOriginales, datosNuevos, seccion) {
    const cambios = [];
    
    // Obtener todas las claves únicas
    const todasLasClaves = new Set([
        ...Object.keys(datosOriginales),
        ...Object.keys(datosNuevos)
    ]);
    
    todasLasClaves.forEach(campo => {
        const valorAnterior = datosOriginales[campo];
        const valorNuevo = datosNuevos[campo];
        
        // Ignorar campos de sistema
        const camposIgnorados = ['id', 'created_at', 'updated_at', 'cliente_id'];
        if (camposIgnorados.includes(campo)) return;
        
        // Normalizar valores nulos
        const anterior = valorAnterior === null || valorAnterior === undefined ? '' : String(valorAnterior);
        const nuevo = valorNuevo === null || valorNuevo === undefined ? '' : String(valorNuevo);
        
        // Si hay diferencia, registrar
        if (anterior !== nuevo) {
            cambios.push({
                campo: campo,
                valorAnterior: anterior,
                valorNuevo: nuevo,
                seccion: seccion
            });
        }
    });
    
    return cambios;
}

/**
 * Registrar cambio en el historial
 */
async function registrarCambio(clienteId, tipoCambio, seccion, cambios) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            console.warn('⚠️ Usuario no autenticado, no se puede registrar cambio');
            return;
        }
        
        // Obtener información del usuario
        const { data: usuarioData } = await supabaseClient
            .from('usuarios')
            .select('nombre')
            .eq('email', user.email)
            .single();
        
        const usuarioNombre = usuarioData?.nombre || user.email;
        
        // Registrar cada cambio individualmente
        const registros = cambios.map(cambio => ({
            cliente_id: clienteId,
            tipo_cambio: tipoCambio,
            seccion: cambio.seccion || seccion,
            campo_modificado: formatearNombreCampo(cambio.campo),
            valor_anterior: cambio.valorAnterior || null,
            valor_nuevo: cambio.valorNuevo || null,
            usuario_nombre: usuarioNombre,
            usuario_email: user.email,
            created_at: new Date().toISOString()
        }));
        
        // Insertar en la base de datos
        const { error } = await supabaseClient
            .from('historial_cambios')
            .insert(registros);
        
        if (error) throw error;
        
        console.log(`✅ ${cambios.length} cambio(s) registrado(s) en historial`);
        
        // Recargar historial si estamos en ese tab
        if (document.querySelector('#historial.active')) {
            await cargarHistorial(clienteId);
        }
        
    } catch (error) {
        console.error('❌ Error al registrar cambio en historial:', error);
    }
}

/**
 * Formatear nombre de campo para mostrarlo bonito
 */
function formatearNombreCampo(campo) {
    const nombres = {
        // Cliente
        'nombre': 'Nombre',
        'email': 'Email',
        'telefono': 'Teléfono',
        'direccion': 'Dirección',
        'ciudad': 'Ciudad',
        'estado': 'Estado',
        'codigo_postal': 'Código Postal',
        'fecha_nacimiento': 'Fecha de Nacimiento',
        'genero': 'Género',
        'ocupacion': 'Ocupación',
        'notas_personales': 'Notas Personales',
        'operador_asignado': 'Operador Asignado',
        
        // Póliza
        'numero_poliza': 'Número de Póliza',
        'compania': 'Compañía',
        'tipo_plan': 'Tipo de Plan',
        'fecha_inicio': 'Fecha de Inicio',
        'fecha_vencimiento': 'Fecha de Vencimiento',
        'prima_mensual': 'Prima Mensual',
        'deducible': 'Deducible',
        'coaseguro': 'Coaseguro',
        'maximo_bolsillo': 'Máximo de Bolsillo',
        'estado_compania': 'Estado (Compañía)',
        'estado_mercado': 'Estado (Mercado)',
        'agente35_estado': 'Estado Agente 3.5',
        'agente35_notas': 'Notas Agente 3.5',
        'observaciones': 'Observaciones'
    };
    
    return nombres[campo] || campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Función para guardar cambios con registro en historial
 * MODIFICAR la función guardarCambios() existente
 */
async function guardarCambiosConHistorial() {
    try {
        // 1. Obtener datos actuales del formulario
        const datosCliente = obtenerDatosFormularioCliente();
        const datosPoliza = obtenerDatosFormularioPoliza();
        
        // 2. Comparar con datos originales
        const cambiosCliente = compararCambios(datosOriginalesCliente, datosCliente, 'Información Personal');
        const cambiosPoliza = compararCambios(datosOriginalesPoliza, datosPoliza, 'Póliza');
        
        // 3. Guardar en la base de datos (función original)
        const { error: errorCliente } = await supabaseClient
            .from('clientes')
            .update(datosCliente)
            .eq('id', clienteId);
        
        if (errorCliente) throw errorCliente;
        
        if (datosPoliza && Object.keys(datosPoliza).length > 0) {
            const { error: errorPoliza } = await supabaseClient
                .from('polizas')
                .update(datosPoliza)
                .eq('cliente_id', clienteId);
            
            if (errorPoliza) throw errorPoliza;
        }
        
        // 4. Registrar cambios en historial
        if (cambiosCliente.length > 0) {
            await registrarCambio(clienteId, 'cliente_editado', 'Información Personal', cambiosCliente);
        }
        
        if (cambiosPoliza.length > 0) {
            await registrarCambio(clienteId, 'poliza_editada', 'Póliza', cambiosPoliza);
        }
        
        // 5. Actualizar datos originales para la próxima edición
        capturarDatosOriginales(datosCliente, datosPoliza);
        
        // 6. Mostrar mensaje de éxito
        const totalCambios = cambiosCliente.length + cambiosPoliza.length;
        if (totalCambios > 0) {
            mostrarNotificacion(`✅ Guardado correctamente (${totalCambios} cambio${totalCambios > 1 ? 's' : ''})`, 'success');
        } else {
            mostrarNotificacion('ℹ️ No hay cambios para guardar', 'info');
        }
        
        console.log('✅ Cambios guardados y registrados en historial');
        
    } catch (error) {
        console.error('❌ Error al guardar cambios:', error);
        mostrarNotificacion('❌ Error al guardar: ' + error.message, 'error');
    }
}

/**
 * Obtener datos del formulario de cliente
 */
function obtenerDatosFormularioCliente() {
    return {
        nombre: document.getElementById('nombre')?.value || '',
        email: document.getElementById('email')?.value || '',
        telefono: document.getElementById('telefono')?.value || '',
        direccion: document.getElementById('direccion')?.value || '',
        ciudad: document.getElementById('ciudad')?.value || '',
        estado: document.getElementById('estado')?.value || '',
        codigo_postal: document.getElementById('codigoPostal')?.value || '',
        fecha_nacimiento: document.getElementById('fechaNacimiento')?.value || null,
        genero: document.getElementById('genero')?.value || '',
        ocupacion: document.getElementById('ocupacion')?.value || '',
        notas_personales: document.getElementById('notasPersonales')?.value || '',
        operador_asignado: document.getElementById('operadorAsignado')?.value || ''
    };
}

/**
 * Obtener datos del formulario de póliza
 */
function obtenerDatosFormularioPoliza() {
    return {
        numero_poliza: document.getElementById('numeroPoliza')?.value || '',
        compania: document.getElementById('compania')?.value || '',
        tipo_plan: document.getElementById('tipoPlan')?.value || '',
        fecha_inicio: document.getElementById('fechaInicio')?.value || null,
        fecha_vencimiento: document.getElementById('fechaVencimiento')?.value || null,
        prima_mensual: document.getElementById('primaMensual')?.value || '',
        deducible: document.getElementById('deducible')?.value || '',
        coaseguro: document.getElementById('coaseguro')?.value || '',
        maximo_bolsillo: document.getElementById('maximoBolsillo')?.value || '',
        estado_compania: document.getElementById('estadoCompania')?.value || '',
        estado_mercado: document.getElementById('estadoMercado')?.value || '',
        agente35_estado: document.getElementById('agente35Estado')?.value || '',
        agente35_notas: document.getElementById('agente35Notas')?.value || '',
        observaciones: document.getElementById('observaciones')?.value || ''
    };
}

/**
 * Registrar cambio de estado específico
 */
async function registrarCambioEstado(clienteId, tipoEstado, estadoAnterior, estadoNuevo) {
    const seccion = tipoEstado === 'compania' ? 'Estado Compañía' : 
                   tipoEstado === 'mercado' ? 'Estado Mercado' : 'Agente 3.5';
    
    await registrarCambio(clienteId, 'estado_cambiado', seccion, [{
        campo: `Estado (${seccion})`,
        valorAnterior: estadoAnterior,
        valorNuevo: estadoNuevo,
        seccion: seccion
    }]);
}

/**
 * Registrar nota agregada
 */
async function registrarNotaAgregada(clienteId, mensaje) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const { data: usuarioData } = await supabaseClient
            .from('usuarios')
            .select('nombre')
            .eq('email', user.email)
            .single();
        
        await supabaseClient
            .from('historial_cambios')
            .insert([{
                cliente_id: clienteId,
                tipo_cambio: 'nota_agregada',
                seccion: 'Notas',
                campo_modificado: 'Nueva Nota',
                valor_anterior: null,
                valor_nuevo: mensaje.substring(0, 100) + (mensaje.length > 100 ? '...' : ''),
                usuario_nombre: usuarioData?.nombre || user.email,
                usuario_email: user.email
            }]);
        
        console.log('✅ Nota agregada registrada en historial');
    } catch (error) {
        console.error('❌ Error al registrar nota en historial:', error);
    }
}

/**
 * Registrar nota eliminada
 */
async function registrarNotaEliminada(clienteId, notaId) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const { data: usuarioData } = await supabaseClient
            .from('usuarios')
            .select('nombre')
            .eq('email', user.email)
            .single();
        
        await supabaseClient
            .from('historial_cambios')
            .insert([{
                cliente_id: clienteId,
                tipo_cambio: 'nota_eliminada',
                seccion: 'Notas',
                campo_modificado: 'Nota Eliminada',
                valor_anterior: `ID: ${notaId}`,
                valor_nuevo: null,
                usuario_nombre: usuarioData?.nombre || user.email,
                usuario_email: user.email
            }]);
        
        console.log('✅ Nota eliminada registrada en historial');
    } catch (error) {
        console.error('❌ Error al registrar eliminación en historial:', error);
    }
}

/**
 * Registrar cambio de operador
 */
async function registrarCambioOperador(clienteId, operadorAnterior, operadorNuevo) {
    await registrarCambio(clienteId, 'asignacion_cambiada', 'Asignación', [{
        campo: 'Operador Asignado',
        valorAnterior: operadorAnterior,
        valorNuevo: operadorNuevo,
        seccion: 'Asignación'
    }]);
}

// ============================================
// MOSTRAR HISTORIAL DE CAMBIOS
// Agregar a cliente_editar.js
// ============================================

/**
 * Cargar historial del cliente
 */
async function cargarHistorial(clienteId, pagina = 1) {
    try {
        console.log('📥 Cargando historial...');
        
        // Mostrar loading
        const timeline = document.getElementById('historialTimeline');
        const loading = document.getElementById('historialLoading');
        
        if (timeline) timeline.style.display = 'none';
        if (loading) loading.style.display = 'flex';
        
        // Calcular rango de paginación
        const desde = (pagina - 1) * historialPorPagina;
        const hasta = desde + historialPorPagina - 1;
        
        // Obtener historial de la base de datos
        const { data: cambios, error, count } = await supabaseClient
            .from('historial_cambios')
            .select('*', { count: 'exact' })
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false })
            .range(desde, hasta);
        
        if (error) throw error;
        
        // Ocultar loading
        if (loading) loading.style.display = 'none';
        if (timeline) timeline.style.display = 'block';
        
        // Mostrar historial
        if (!cambios || cambios.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">history</span>
                    <p>No hay historial de cambios</p>
                    <small>Los cambios se registrarán automáticamente</small>
                </div>
            `;
            
            // Actualizar contador
            const counter = document.getElementById('historialCounter');
            if (counter) counter.textContent = '(0)';
            
            return;
        }
        
        // Actualizar contador total
        const counter = document.getElementById('historialCounter');
        if (counter) counter.textContent = `(${count || cambios.length})`;
        
        // Agrupar cambios por fecha y usuario
        const cambiosAgrupados = agruparCambiosPorEvento(cambios);
        
        // Renderizar timeline
        renderizarTimeline(cambiosAgrupados);
        
        // Actualizar paginación
        actualizarPaginacion(pagina, count, historialPorPagina);
        
        // Llenar filtro de usuarios
        llenarFiltroUsuarios(cambios);
        
        console.log(`✅ ${cambios.length} cambio(s) en historial cargados`);
        
    } catch (error) {
        console.error('❌ Error al cargar historial:', error);
        const timeline = document.getElementById('historialTimeline');
        if (timeline) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">error</span>
                    <p>Error al cargar historial</p>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }
}

/**
 * Agrupar cambios por evento (mismo usuario, mismo momento)
 */
function agruparCambiosPorEvento(cambios) {
    const grupos = [];
    let grupoActual = null;
    
    cambios.forEach(cambio => {
        const fechaCambio = new Date(cambio.created_at);
        
        // Si es el mismo usuario y dentro de 1 minuto, agrupar
        if (grupoActual && 
            grupoActual.usuario_email === cambio.usuario_email &&
            grupoActual.tipo_cambio === cambio.tipo_cambio &&
            Math.abs(new Date(grupoActual.fecha) - fechaCambio) < 60000) {
            
            grupoActual.cambios.push(cambio);
        } else {
            // Nuevo grupo
            grupoActual = {
                id: cambio.id,
                tipo_cambio: cambio.tipo_cambio,
                seccion: cambio.seccion,
                usuario_nombre: cambio.usuario_nombre,
                usuario_email: cambio.usuario_email,
                fecha: cambio.created_at,
                cambios: [cambio]
            };
            grupos.push(grupoActual);
        }
    });
    
    return grupos;
}

/**
 * Renderizar timeline de historial
 */
function renderizarTimeline(grupos) {
    const timeline = document.getElementById('historialTimeline');
    
    if (!timeline) return;
    
    timeline.innerHTML = '';
    
    grupos.forEach(grupo => {
        const itemHTML = crearItemHistorial(grupo);
        timeline.insertAdjacentHTML('beforeend', itemHTML);
    });
}

/**
 * Crear HTML de un item de historial
 */
function crearItemHistorial(grupo) {
    const fecha = new Date(grupo.fecha);
    const fechaFormateada = formatearFechaHistorial(fecha);
    
    // Determinar icono según tipo de cambio
    const iconos = {
        'cliente_editado': 'edit',
        'poliza_editada': 'description',
        'estado_cambiado': 'swap_horiz',
        'nota_agregada': 'add_comment',
        'nota_eliminada': 'delete',
        'asignacion_cambiada': 'person_add'
    };
    
    const icono = iconos[grupo.tipo_cambio] || 'edit';
    
    // Determinar título según tipo de cambio
    const titulos = {
        'cliente_editado': 'Cliente Editado',
        'poliza_editada': 'Póliza Editada',
        'estado_cambiado': 'Estado Cambiado',
        'nota_agregada': 'Nota Agregada',
        'nota_eliminada': 'Nota Eliminada',
        'asignacion_cambiada': 'Operador Cambiado'
    };
    
    const titulo = titulos[grupo.tipo_cambio] || 'Cambio Realizado';
    
    // Renderizar cambios
    const cambiosHTML = grupo.cambios.map(cambio => {
        if (!cambio.valor_anterior && !cambio.valor_nuevo) return '';
        
        return `
            <div class="cambio-item">
                <div class="cambio-campo">${cambio.campo_modificado}</div>
                <div class="cambio-valores">
                    ${cambio.valor_anterior ? `<span class="cambio-anterior">${escaparHTML(cambio.valor_anterior)}</span>` : ''}
                    ${cambio.valor_anterior && cambio.valor_nuevo ? '<span class="cambio-flecha">→</span>' : ''}
                    ${cambio.valor_nuevo ? `<span class="cambio-nuevo">${escaparHTML(cambio.valor_nuevo)}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="historial-item tipo-${grupo.tipo_cambio}" data-tipo="${grupo.tipo_cambio}">
            <div class="historial-card">
                <div class="historial-header">
                    <div class="historial-icono">
                        <span class="material-symbols-rounded">${icono}</span>
                    </div>
                    <div class="historial-info">
                        <div class="historial-tipo">${titulo}</div>
                        <div class="historial-fecha">
                            <span class="material-symbols-rounded" style="font-size: 14px;">schedule</span>
                            ${fechaFormateada}
                        </div>
                        ${grupo.seccion ? `<span class="historial-seccion">${grupo.seccion}</span>` : ''}
                    </div>
                    <div class="historial-usuario">
                        <span class="material-symbols-rounded" style="font-size: 16px;">person</span>
                        ${grupo.usuario_nombre}
                    </div>
                </div>
                ${cambiosHTML ? `
                    <div class="historial-cambios">
                        ${cambiosHTML}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Formatear fecha para el historial
 */
function formatearFechaHistorial(fecha) {
    const ahora = new Date();
    const diferencia = ahora - fecha;
    
    // Menos de 1 minuto
    if (diferencia < 60000) {
        return 'Hace un momento';
    }
    
    // Menos de 1 hora
    if (diferencia < 3600000) {
        const minutos = Math.floor(diferencia / 60000);
        return `Hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
    }
    
    // Menos de 24 horas
    if (diferencia < 86400000) {
        const horas = Math.floor(diferencia / 3600000);
        return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
    }
    
    // Menos de 7 días
    if (diferencia < 604800000) {
        const dias = Math.floor(diferencia / 86400000);
        return `Hace ${dias} día${dias > 1 ? 's' : ''}`;
    }
    
    // Fecha completa
    return fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Escapar HTML para prevenir XSS
 */
function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

/**
 * Actualizar paginación
 */
function actualizarPaginacion(paginaActual, totalRegistros, porPagina) {
    const paginacion = document.getElementById('historialPaginacion');
    const btnAnterior = document.getElementById('btnAnterior');
    const btnSiguiente = document.getElementById('btnSiguiente');
    const spanPagina = document.getElementById('paginaActual');
    
    if (!paginacion) return;
    
    const totalPaginas = Math.ceil(totalRegistros / porPagina);
    
    if (totalPaginas <= 1) {
        paginacion.style.display = 'none';
        return;
    }
    
    paginacion.style.display = 'flex';
    
    if (btnAnterior) {
        btnAnterior.disabled = paginaActual === 1;
    }
    
    if (btnSiguiente) {
        btnSiguiente.disabled = paginaActual >= totalPaginas;
    }
    
    if (spanPagina) {
        spanPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;
    }
    
    historialPaginaActual = paginaActual;
}

/**
 * Cargar página de historial
 */
async function cargarHistorialPagina(direccion) {
    let nuevaPagina = historialPaginaActual;
    
    if (direccion === 'anterior') {
        nuevaPagina = Math.max(1, historialPaginaActual - 1);
    } else if (direccion === 'siguiente') {
        nuevaPagina = historialPaginaActual + 1;
    }
    
    await cargarHistorial(clienteId, nuevaPagina);
}

/**
 * Llenar filtro de usuarios
 */
function llenarFiltroUsuarios(cambios) {
    const filtroUsuario = document.getElementById('filtroUsuario');
    
    if (!filtroUsuario) return;
    
    // Obtener usuarios únicos
    const usuarios = [...new Set(cambios.map(c => c.usuario_nombre))];
    
    // Limpiar opciones existentes (excepto "Todos")
    filtroUsuario.innerHTML = '<option value="">Todos</option>';
    
    // Agregar usuarios
    usuarios.forEach(usuario => {
        const option = document.createElement('option');
        option.value = usuario;
        option.textContent = usuario;
        filtroUsuario.appendChild(option);
    });
}

/**
 * Mostrar/ocultar filtros
 */
function filtrarHistorial() {
    const filtros = document.getElementById('historialFiltros');
    if (filtros) {
        filtros.style.display = filtros.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Aplicar filtros de historial
 */
async function aplicarFiltrosHistorial() {
    try {
        const tipoCambio = document.getElementById('filtroTipoCambio')?.value || '';
        const usuario = document.getElementById('filtroUsuario')?.value || '';
        const desde = document.getElementById('filtroDesde')?.value || '';
        const hasta = document.getElementById('filtroHasta')?.value || '';
        
        // Construir query
        let query = supabaseClient
            .from('historial_cambios')
            .select('*', { count: 'exact' })
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false });
        
        if (tipoCambio) {
            query = query.eq('tipo_cambio', tipoCambio);
        }
        
        if (usuario) {
            query = query.eq('usuario_nombre', usuario);
        }
        
        if (desde) {
            query = query.gte('created_at', desde + 'T00:00:00');
        }
        
        if (hasta) {
            query = query.lte('created_at', hasta + 'T23:59:59');
        }
        
        const { data: cambios, error } = await query;
        
        if (error) throw error;
        
        // Renderizar resultados
        const timeline = document.getElementById('historialTimeline');
        
        if (!cambios || cambios.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">filter_list_off</span>
                    <p>No se encontraron cambios con estos filtros</p>
                    <small>Intenta ajustar los criterios de búsqueda</small>
                </div>
            `;
            return;
        }
        
        const cambiosAgrupados = agruparCambiosPorEvento(cambios);
        renderizarTimeline(cambiosAgrupados);
        
        mostrarNotificacion(`🔍 ${cambios.length} resultado(s) encontrado(s)`, 'info');
        
    } catch (error) {
        console.error('❌ Error al filtrar historial:', error);
        mostrarNotificacion('❌ Error al filtrar', 'error');
    }
}

/**
 * Limpiar filtros
 */
function limpiarFiltrosHistorial() {
    document.getElementById('filtroTipoCambio').value = '';
    document.getElementById('filtroUsuario').value = '';
    document.getElementById('filtroDesde').value = '';
    document.getElementById('filtroHasta').value = '';
    
    cargarHistorial(clienteId);
}

/**
 * Exportar historial a CSV
 */
async function exportarHistorial() {
    try {
        // Obtener TODO el historial (sin paginación)
        const { data: cambios, error } = await supabaseClient
            .from('historial_cambios')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!cambios || cambios.length === 0) {
            mostrarNotificacion('⚠️ No hay historial para exportar', 'warning');
            return;
        }
        
        // Crear CSV
        const headers = ['Fecha', 'Tipo', 'Sección', 'Campo', 'Valor Anterior', 'Valor Nuevo', 'Usuario'];
        const rows = cambios.map(c => [
            new Date(c.created_at).toLocaleString('es-ES'),
            c.tipo_cambio,
            c.seccion || '',
            c.campo_modificado,
            c.valor_anterior || '',
            c.valor_nuevo || '',
            c.usuario_nombre
        ]);
        
        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // Descargar
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `historial_cliente_${clienteId}_${Date.now()}.csv`;
        link.click();
        
        mostrarNotificacion('✅ Historial exportado correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error al exportar historial:', error);
        mostrarNotificacion('❌ Error al exportar', 'error');
    }
}

// Exportar funciones para uso global
window.inicializarSubPestanas = inicializarSubPestanas;
window.cambiarSubPestana = cambiarSubPestana;
window.cargarAgente35 = cargarAgente35;
window.obtenerDatosAgente35 = obtenerDatosAgente35;
window.obtenerBadgeAgente35 = obtenerBadgeAgente35;
window.formatearFechaHora = formatearFechaHora;

// ============================================
// LOG FINAL
// ============================================

console.log('%c✏️ CLIENTE_EDITAR.JS COMPLETO Y CORREGIDO', 'color: #00a8e8; font-size: 16px; font-weight: bold');
console.log('%c✅ Todas las correcciones aplicadas:', 'color: #4caf50; font-weight: bold');
console.log('  ✓ Funciones movidas FUERA de actualizarCliente()');
console.log('  ✓ Sistema de modal para dependientes');
console.log('  ✓ Tarjetas visuales para dependientes');
console.log('  ✓ actualizarDependientes() con UPDATE + INSERT');
console.log('  ✓ Campo sexo corregido (dep_sexo)');
console.log('  ✓ Campo nacionalidad corregido');
console.log('  ✓ DOMContentLoaded con async');
console.log('  ✓ Carga completa de datos al inicio');
console.log('  ✓ guardarDocumentosNuevos() solo sube nuevos');