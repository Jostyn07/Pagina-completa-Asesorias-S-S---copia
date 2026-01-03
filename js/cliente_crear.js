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

    cargarInfoUsuario();

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
// NAVEGACIÓN CON BOTÓN SIGUIENTE
// ============================================

function siguientePestana() {
    const tabsEnOrden = [
        'info-general',
        'dependientes',
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
        { id: 'prima', nombre: 'Prima' }
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

async function guardarMetodoPago(clienteId) {    
    try {
        const tipoSeleccionado = document.querySelector('[name="metodoPago"]:checked');
        
        if (!tipoSeleccionado) {
            return;
        }
        
        const tipo = tipoSeleccionado.value;        
        let metodoPagoData = {
            cliente_id: clienteId,
            tipo: tipo,
            usar_misma_direccion: document.getElementById('usarMismaDireccion')?.checked !== false,
            activo: true
        };
        
        if (tipo === 'banco') {
            metodoPagoData.nombre_banco = document.getElementById('nombreBanco')?.value || null;
            metodoPagoData.numero_cuenta = document.getElementById('numeroCuenta')?.value || null;
            metodoPagoData.routing_number = document.getElementById('routingNumber')?.value || null;
            metodoPagoData.nombre_cuenta = document.getElementById('nombreCuenta')?.value || null;
        } else if (tipo === 'tarjeta') {
            metodoPagoData.numero_tarjeta = document.getElementById('numeroTarjeta')?.value || null;
            metodoPagoData.nombre_tarjeta = document.getElementById('nombreTarjeta')?.value || null;
            metodoPagoData.fecha_expiracion = document.getElementById('fechaExpiracion')?.value || null;
            metodoPagoData.cvv = document.getElementById('cvv')?.value || null;
            metodoPagoData.tipo_tarjeta = document.getElementById('tipoTarjeta')?.value || null;
        }
                
        const { data, error } = await supabaseClient
            .from('metodos_pago')
            .insert([metodoPagoData])
            .select();
        
        
        if (error) {
            throw error;
        }
        
        
    } catch (error) {

    }
}

// ============================================
// DEPENDIENTES - SISTEMA DE MODAL Y TARJETAS
// ============================================

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
        actualizarTarjetaDependiente(depCount, dependiente);
    } else {
        // NUEVO
        dependientesCount++;
        crearTarjetaDependiente(dependientesCount, dependiente);
    }
    
    // Cerrar modal
    cerrarModalDependiente();
    actualizarContadorDependientes();
}

// CREAR TARJETA DE DEPENDIENTE
function crearTarjetaDependiente(count, dep) {
    const container = document.getElementById('dependientesContainer');
    
    // Quitar empty state si existe
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    // Calcular edad
    const edad = calcularEdad(dep.fecha_nacimiento);
    
    // Iniciales para avatar
    const iniciales = (dep.nombres.charAt(0) + dep.apellidos.charAt(0)).toUpperCase();
    
    const cardHTML = `
        <div class="dependiente-card" id="dependiente-${count}">
            
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
                    <button type="button" class="btn-icon delete" onclick="eliminarDependiente(${count})" title="Eliminar">
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
    
    // Llenar modal
    document.getElementById('modal_dep_nombres').value = nombres;
    document.getElementById('modal_dep_apellidos').value = apellidos;
    document.getElementById('modal_dep_fecha_nacimiento').value = fechaNacimiento;
    document.getElementById('modal_dep_sexo').value = sexo;
    document.getElementById('modal_dep_ssn').value = ssn;
    document.getElementById('modal_dep_estado_migratorio').value = estadoMigratorio;
    document.getElementById('modal_dep_relacion').value = relacion;
    document.getElementById('modal_dep_aplica').value = aplica;
    
    // Guardar count para actualizar
    document.getElementById('modal_dep_count').value = count;
    
    // Cambiar título
    document.getElementById('modalDependienteTitulo').textContent = 'Editar Dependiente';
    
    // Mostrar modal
    document.getElementById('modalDependiente').classList.add('active');
}

// ACTUALIZAR TARJETA EXISTENTE
function actualizarTarjetaDependiente(count, dep) {
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
    crearTarjetaDependiente(count, dep);
}

// ELIMINAR DEPENDIENTE
function eliminarDependiente(count) {
    if (!confirm('¿Eliminar este dependiente?')) return;
    
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
        { id: 'tipoRegistro', nombre: 'Tipo de registro'},
        { id: 'nombres', nombre: 'Nombres' },
        { id: 'apellidos', nombre: 'Apellidos' },
        { id: 'genero', nombre: 'Género' },
        { id: 'email', nombre: 'Correo electrónico' },
        { id: 'telefono1', nombre: 'Teléfono' },
        { id: 'fechaNacimiento', nombre: 'Fecha de nacimiento' },
        { id: 'estadoMigratorio', nombre: 'Estado migratorio' },
        { id: 'nacionalidad', nombre: 'Nacionalidad' },
        { id: 'aplica', nombre: '¿Aplica para el seguro?'},
        { id: 'direccion', nombre: 'Dirección' },
        { id: 'condado', nombre: 'Condado'},
        { id: 'ciudad', nombre: 'Ciudad' },
        { id: 'estado', nombre: 'Estado' },
        { id: 'codigoPostal', nombre: 'Código postal' },
        { id: 'compania', nombre: 'Compañía' },
        { id: 'plan', nombre: 'Plan' },
        { id: 'prima', nombre: 'Prima' },
        { id: 'tipoVenta', nombre: 'Tipo de venta' },
        { id: 'operadorNombre', nombre: 'operador' },
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

function obtenerUsuarioId() {
    return usuarioActual?.id || null;
}

function obtenerUsuarioEmail() {
    return usuarioActual?.email || null;
}

// ============================================
// CREAR CLIENTE
// ============================================

async function crearCliente(formData) {
    console.log('📝 Creando cliente...');
    
    const clienteData = {
        tipo_registro: formData.tipoRegistro,
        fecha_registro: formData.fechaRegistro,
        operador_id: obtenerUsuarioId(),
        operador_email: obtenerUsuarioEmail(),
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
        nacionalidad: formData.nacionalidad || null,
        aplica: formData.aplica,
        direccion: formData.direccion,
        casa_apartamento: formData.casaApartamento,
        condado: formData.condado,
        ciudad: formData.ciudad,
        estado: formData.estado,
        codigo_postal: formData.codigoPostal,
        operador_nombre: formData.operadorNombre || null,
        agente_nombre: formData.portalNPN || null,
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

    await guardarMetodoPago(cliente.id);

    const numeroPoliza = await generarNumeroPoliza();
    
    const polizaData = {
        cliente_id: cliente.id,
        aplicantes: parseInt(document.getElementById('aplicantes').value) || 1,
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
                sexo: formData[`dep_sexo_${i}`] || null,
                ssn: formData[`dep_ssn_${i}`] ? formData[`dep_ssn_${i}`].replace(/\D/g, '') : null,
                estado_migratorio: formData[`dep_estado_migratorio_${i}`] || null,
                relacion: formData[`dep_relacion_${i}`] || null,
                aplica: formData[`dep_aplica_${i}`] || null,
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
            alert('Escribe un mensaje o adjunta una imagen');
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
            const { data: nuevaNota, error } = await supabaseClient
                .from('notas')
                .insert([notaData])
                .select()
                .single();
            
            if (error) throw error;
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
// CANCELAR
// ============================================

function cancelarFormulario() {
    if (confirm('¿Cancelar y volver? Se perderán los cambios no guardados.')) {
        localStorage.removeItem('borrador_cliente');
        clearInterval(autosaveTimer)
        window.location.href = './polizas.html';
    }
}