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
    
    // ✅ CARGAR TODOS LOS DATOS
    try {
        await cargarDatosCliente(clienteId);
        await cargarDocumentos(clienteId);
        await cargarNotas(clienteId);
        
        console.log('✅ Todos los datos cargados correctamente');
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
        alert('Error al cargar los datos: ' + error.message);
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
        document.getElementById('tipoRegistro').value = cliente.tipo_registro || '';
        document.getElementById('fechaRegistro').value = formatoISO(cliente.fecha_registro);
        document.getElementById('nombres').value = cliente.nombres || '';
        document.getElementById('apellidos').value = cliente.apellidos || '';
        document.getElementById('genero').value = cliente.genero || '';
        document.getElementById('email').value = cliente.email || '';
        document.getElementById('telefono1').value = cliente.telefono1 || '';
        document.getElementById('telefono2').value = cliente.telefono2 || '';
        document.getElementById('fechaNacimiento').value = formatoISO(cliente.fecha_nacimiento);
        document.getElementById('estadoMigratorio').value = cliente.estado_migratorio || '';
        
        const ssnInput = document.getElementById('ssn');
        if (ssnInput && cliente.ssn) {
            ssnInput.value = formatearSSN(cliente.ssn);
        }
        
        document.getElementById('ingresos').value = cliente.ingreso_anual || 0;
        document.getElementById('ocupacion').value = cliente.ocupacion || '';
        document.getElementById('nacionalidad').value = cliente.nacionalidad || '';
        document.getElementById('aplica').value = cliente.aplica || '';
        document.getElementById('direccion').value = cliente.direccion || '';
        document.getElementById('casaApartamento').value = cliente.casa_apartamento || '';
        document.getElementById('condado').value = cliente.condado || '';
        document.getElementById('ciudad').value = cliente.ciudad || '';
        document.getElementById('estado').value = cliente.estado || '';
        document.getElementById('codigoPostal').value = cliente.codigo_postal || '';
        document.getElementById('operadorNombre').value = cliente.operador_nombre || '';
        document.getElementById('observaciones').value = cliente.observaciones || '';
    }
    
    // DATOS DE LA PÓLIZA
    if (poliza) {
        document.getElementById('compania').value = poliza.compania || '';
        document.getElementById('plan').value = poliza.plan || '';
        document.getElementById('prima').value = poliza.prima || 0;
        document.getElementById('creditoFiscal').value = poliza.credito_fiscal || 0;
        document.getElementById('memberId').value = poliza.member_id || '';
        document.getElementById('portalNpn').value = poliza.portal_npn || '';
        document.getElementById('claveSeguridad').value = poliza.clave_seguridad || '';
        document.getElementById('enlacePoliza').value = poliza.enlace_poliza || '';
        document.getElementById('tipoVenta').value = poliza.tipo_venta || '';
        
        // Fechas de la póliza
        const fechaEfectividadInput = document.getElementById('fechaEfectividad');
        if (fechaEfectividadInput && poliza.fecha_efectividad) {
            fechaEfectividadInput.value = formatoISO(poliza.fecha_efectividad);
        }
        
        const fechaInicialInput = document.getElementById('fechaInicialCobertura');
        if (fechaInicialInput && poliza.fecha_inicial_cobertura) {
            fechaInicialInput.value = formatoISO(poliza.fecha_inicial_cobertura);
        }
        
        const fechaFinalInput = document.getElementById('fechaFinalCobertura');
        if (fechaFinalInput && poliza.fecha_final_cobertura) {
            fechaFinalInput.value = formatoISO(poliza.fecha_final_cobertura);
        }
        
        // Displays de fechas en formato US
        const displayEfectividad = document.getElementById('displayFechaEfectividad');
        if (displayEfectividad && poliza.fecha_efectividad) {
            const fechaEfectividadUS = formatoUS(poliza.fecha_efectividad);
            displayEfectividad.textContent = fechaEfectividadUS;
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

// ============================================
// DEPENDIENTES - SISTEMA DE MODAL Y TARJETAS
// ============================================

// AGREGAR DEPENDIENTE EXISTENTE (Desde BD)
function agregarDependienteExistente(dep) {
    dependientesCount++;
    
    // Convertir sexo si viene en formato antiguo
    let sexoFormateado = dep.sexo;
    if (dep.sexo === 'M') sexoFormateado = 'masculino';
    if (dep.sexo === 'F') sexoFormateado = 'femenino';
    
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
// CARGAR DOCUMENTOS
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
                <div class="documento-item existente" data-doc-id="${doc.id}">
                    <div class="documento-header">
                        <span class="material-symbols-rounded">description</span>
                        <span class="documento-nombre">${doc.nombre_archivo}</span>
                        <button type="button" class="btn-remove" onclick="confirmarEliminarDocumento('${doc.id}')">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                    <div class="documento-body">
                        <div class="documento-info">
                            <p><strong>Tipo:</strong> ${doc.tipo_archivo || 'N/A'}</p>
                            <p><strong>Tamaño:</strong> ${(doc.tamanio / 1024).toFixed(2)} KB</p>
                            <p><strong>Subido:</strong> ${formatoUS(doc.created_at)}</p>
                            ${doc.notas ? `<p><strong>Notas:</strong> ${doc.notas}</p>` : ''}
                        </div>
                        <a href="${doc.url_archivo}" target="_blank" class="btn-ver-documento">
                            <span class="material-symbols-rounded">visibility</span>
                            Ver
                        </a>
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
        
        // 5. Remover del DOM
        const elemento = document.querySelector(`[data-doc-id="${docId}"]`);
        if (elemento) elemento.remove();
        
        // 6. Verificar si quedaron documentos
        const container = document.getElementById('documentosContainer');
        if (container.querySelectorAll('.documento-item').length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">upload_file</span>
                    <p>No hay documentos cargados</p>
                </div>
            `;
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
        <div class="documento-item" id="documento-${documentosCount}">
            <div class="documento-header">
                <span class="material-symbols-rounded">upload_file</span>
                <span class="documento-nombre">Documento #${documentosCount}</span>
                <button type="button" class="btn-remove" onclick="eliminarDocumento(${documentosCount})">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
            <div class="documento-body">
                <div class="form-group">
                    <label>Archivo</label>
                    <input type="file" name="doc_archivo_${documentosCount}" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onchange="previsualizarDocumento(${documentosCount}, this)">
                    <small class="help-text">PDF, JPG, PNG, DOC, DOCX (máx. 5MB)</small>
                </div>
                <div class="form-group">
                    <label>Notas (opcional)</label>
                    <textarea name="doc_notas_${documentosCount}" rows="2" placeholder="Descripción del documento..."></textarea>
                </div>
                <div class="documento-preview" id="preview-${documentosCount}"></div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', docHTML);
    actualizarContadorDocumentos();
}

function eliminarDocumento(id) {
    const elemento = document.getElementById(`documento-${id}`);
    if (elemento) elemento.remove();
    
    const container = document.getElementById('documentosContainer');
    if (container.querySelectorAll('.documento-item').length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">upload_file</span>
                <p>No hay documentos agregados</p>
            </div>
        `;
    }
    
    actualizarContadorDocumentos();
}

function previsualizarDocumento(id, input) {
    const preview = document.getElementById(`preview-${id}`);
    if (!preview) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileName = file.name;
        const fileSize = (file.size / 1024).toFixed(2);
        
        preview.innerHTML = `
            <div class="file-info">
                <span class="material-symbols-rounded">check_circle</span>
                <div>
                    <strong>${fileName}</strong>
                    <small>${fileSize} KB</small>
                </div>
            </div>
        `;
    } else {
        preview.innerHTML = '';
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
                            ${nota.imagenes.map(img => `
                                <img src="${img}" alt="Imagen" 
                                     style="max-width: 150px; border-radius: 8px; margin: 5px; cursor: pointer;" 
                                     onclick="verImagenCompleta('${img}')">
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
    const mensaje = textarea ? textarea.value.trim() : '';
    
    if (!mensaje && imagenesNotaSeleccionadas.length === 0) {
        alert('Escribe un mensaje o adjunta una imagen');
        return;
    }
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            alert('Debes estar autenticado');
            return;
        }
        
        const notaData = {
            cliente_id: clienteId,
            mensaje: mensaje || null,
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
        
        // Agregar al thread
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
                ${imagenesNotaSeleccionadas.length > 0 ? `
                    <div class="nota-imagenes">
                        ${imagenesNotaSeleccionadas.map(img => `
                            <img src="${img}" alt="Imagen" style="max-width: 150px; border-radius: 8px; margin: 5px;">
                        `).join('')}
                    </div>
                ` : ''}
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
        
        actualizarContadorNotas();
        console.log('✅ Nota agregada');
        
    } catch (error) {
        console.error('Error al agregar nota:', error);
        alert('Error al agregar nota: ' + error.message);
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
    // Tab por defecto
    cambiarTab('info-general');
}

function cambiarTab(tabName) {
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Desactivar todos los tabs
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activar tab seleccionado
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
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
    const bancario = document.getElementById('pago-bancario');
    const tarjeta = document.getElementById('pago-tarjeta');
    
    if (tipo === 'banco') {
        bancario.style.display = 'block';
        tarjeta.style.display = 'none';
    } else if (tipo === 'tarjeta') {
        bancario.style.display = 'none';
        tarjeta.style.display = 'block';
    }
}

function limpiarMetodoPago() {
    document.querySelectorAll('#tab-pago input, #tab-pago select').forEach(input => {
        input.value = '';
    });
    
    document.getElementById('pago-bancario').style.display = 'none';
    document.getElementById('pago-tarjeta').style.display = 'none';
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
        observaciones: formData.observaciones || null,
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
        agente_nombre: formData.agenteNombre || null,
        observaciones: formData.observaciones || null,
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
    const checkbox = document.getElementById('usaPOBox');
    const campoApartamento = document.getElementById('casaApartamento');
    
    if (checkbox && campoApartamento) {
        if (checkbox.checked) {
            campoApartamento.value = 'P.O. Box';
            campoApartamento.readOnly = true;
        } else {
            campoApartamento.value = '';
            campoApartamento.readOnly = false;
        }
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
}

function cancelarNota() {
    const textarea = document.getElementById('nuevaNota');
    if (textarea) textarea.value = '';
    imagenesNotaSeleccionadas = [];
    const preview = document.getElementById('imagenesPreview');
    if (preview) preview.innerHTML = '';
}

function previsualizarImagenesNota() {
    const input = document.getElementById('imagenNota');
    if (!input || !input.files) return;
    
    const preview = document.getElementById('imagenesPreview');
    if (!preview) return;
    
    Array.from(input.files).forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            imagenesNotaSeleccionadas.push(e.target.result);
            
            const imgHTML = `
                <div class="imagen-preview" id="preview-nota-${imagenesNotaSeleccionadas.length - 1}">
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" class="btn-remove-imagen" onclick="quitarImagenNota(${imagenesNotaSeleccionadas.length - 1})">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
            `;
            
            preview.insertAdjacentHTML('beforeend', imgHTML);
        };
        
        reader.readAsDataURL(file);
    });
    
    // Limpiar input
    input.value = '';
}

function quitarImagenNota(index) {
    imagenesNotaSeleccionadas.splice(index, 1);
    
    const preview = document.getElementById('imagenesPreview');
    if (preview) {
        preview.innerHTML = '';
        
        imagenesNotaSeleccionadas.forEach((img, i) => {
            const imgHTML = `
                <div class="imagen-preview" id="preview-nota-${i}">
                    <img src="${img}" alt="Preview">
                    <button type="button" class="btn-remove-imagen" onclick="quitarImagenNota(${i})">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
            `;
            preview.insertAdjacentHTML('beforeend', imgHTML);
        });
    }
}

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