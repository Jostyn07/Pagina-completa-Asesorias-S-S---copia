// Variables globales
let clienteIdSeleccionado = null;
let polizaIdSeleccionada = null;
let datosOriginales = null;
let quillNota = null;
let autosaveTimer = null;
const AUTOSAVE_INTERVAL = 30000; // 30 segundos

// ====================================
// BUSQUEDA DE CLIENTES
// ====================================

let timerBusqueda = null;

async function buscarClientes(termino) {
    const select = document.getElementById('selectCliente');

    // Si solo tiene dos caracteres el bsucador, se limpia el buscador
    if (!termino || termino.length < 2) {
        select.innerHTML = '<option value=""> Escribe para buscar </option>';
        select.disabled = true
        return;
    }

    // Cancela el timer anterior
    timerBusqueda = setTimeout(async () => {
        try {
            const palabras = termino.trim().split(/\s+/);
            // Busca nombres y apellidos
            let query = supabaseClient
                .from('clientes')
                .select('id, nombres, apellidos, email, telefono1')
                .eq('archivado', false)
                .limit(20);

            if (palabras.length === 1) {
                query = query.or(`nombres.ilike.%${palabras[0]}%, apellidos.ilike.%${palabras[0]}%`)
            } else {
                query = query.ilike('nombres', `%${palabras[0]}%`)
                             .ilike('apellidos', `%${palabras[1]}%`)
            }

            const {data, error } = await query;

            if (error) throw error;

            if (!data || data.length === 0) {
                select.innerHTML = '<option value = "">Sin resultado</option>'
                
                select.disabled = true;
                return
            }

            // poblar el selecto con los resultados
            select.innerHTML = '<option value = "">Selecciona un cliente</option>';
            data.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = `${cliente.nombres} ${cliente.apellidos} - ${cliente.telefono1 || cliente.email || ''}`;
                select.appendChild(option);
            });

            select.disabled = false

        } catch (error) {
            console.error('Error buscando clientes: ' ,error)
            mostrarNotificacion('Error al buscar clientes', 'error')
        }
    },400);
}

// =========================================
// SELECCIONAR CLIENTE
// =========================================

async function seleccionarCliente(clienteId) {
    if (!clienteId) return;

    try {
        mostrarNotificacion('Cargando información', 'info')

        const { data: cliente, error } = await supabaseClient
            .from('clientes')
            .select(`
                *,
                polizas (*),
                metodos_pago (*)
                `)
                .eq('id', clienteId)
                .single();

        if (error) throw error;

        // Guardar ID Global
        clienteIdSeleccionado = cliente.id;

        // Tomar la póliza mas reciente
        const polizas = cliente.polizas || [];
        const polizaActiva = polizas.sort((a,b) =>
            new Date(b.created_at) - new Date(a.created_at)
        ) [0];

        polizaIdSeleccionada = polizaActiva?.id || null;
        // Se guarda snapshot antes de cualquier cambio
        datosOriginales = {
            cliente: { ...cliente },
            poliza: polizaActiva ? { ...polizaActiva } : {}
        };

        // Poblar el formulario con los datos
        poblarFormulario(cliente, polizaActiva);

        // Cargar dependientes en sus tarjetas
        if (cliente.dependendientes && cliente.dependendientes.length > 0) {
            cliente.dependeintes.forEach(dep => {
                agregarDependienteExistente(dep);
            });
        }

        // Calcular fechas automaticas del próximo mes
        calcularFechasAutomaticas();

        // Mostrar confirmación visual
        const estado = document.getElementById('busquedaEstado');
        const texto = document.getElementById('busquedaEstadoTexto');
        if (estado) estado.style.display = 'flex';
        if (texto) texto.textContent = `${cliente.nombres} ${cliente.apellidos} cargando`;

        mostrarNotificacion('Cliente Cargado correctamente', 'success');
    } catch (error) {
        console.error('Error al cargar cliente: ', error);
        mostrarNotificacion('Error al cargar cliente: ' + error.message, 'error' )
    }
}

// =====================================
// POBLAR FORMULARIO
// =====================================

function poblarFormulario(cliente, poliza) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = val === 'Si' || val === true;
    };

    // ── CLIENTE ──
    set('tipoRegistro',      cliente.tipo_registro);
    set('casoEspecial',      cliente.caso_especial);
    set('tipoModificacion',  cliente.tipo_modificacion);
    set('nombres',           cliente.nombres);
    set('apellidos',         cliente.apellidos);
    set('genero',            cliente.genero);
    set('email',             cliente.email);
    set('telefono1',         cliente.telefono1);
    set('telefono2',         cliente.telefono2);
    set('fechaNacimiento',   formatoUS(cliente.fecha_nacimiento));
    set('estadoMigratorio',  cliente.estado_migratorio);
    set('ssn',               cliente.ssn);
    setCheck('tieneSsn',     cliente.tiene_social);
    set('ingresos',          cliente.ingreso_anual);
    set('ocupacion',         cliente.ocupacion);
    set('nacionalidad',      cliente.nacionalidad);
    set('aplica',            cliente.aplica);
    set('direccion',         cliente.direccion);
    set('casaApartamento',   cliente.casa_apartamento);
    set('condado',           cliente.condado);
    set('ciudad',            cliente.ciudad);
    set('estado',            cliente.estado);
    set('codigoPostal',      cliente.codigo_postal);
    set('poBox',             cliente.po_box);
    set('operadorNombre',    cliente.operador_nombre);
    set('ventaRealizadaPor', cliente.venta_realizada_por);

    // ── PÓLIZA ──
    if (poliza) {
        set('aplicantes',          poliza.aplicantes);
        set('compania',            poliza.compania);
        set('plan',                poliza.plan);
        set('prima',               poliza.prima);
        set('creditoFiscal',       poliza.credito_fiscal);
        set('memberId',            poliza.member_id);
        set('claveSeguridad',      poliza.clave_seguridad);
        set('enlacePoliza',        poliza.enlace_poliza);
        set('nombreAgenteCompania',poliza.agente_nombre);

        // Fecha final se mantiene — las otras las calcula calcularFechasAutomaticas()
        set('fechaFinalCobertura', formatoUS(poliza.fecha_final_cobertura));
    }

    // Fecha inicio — mostrar y guardar tal cual
    const fechaInicio = formatoUS(poliza.fecha_inicial_cobertura);
    const spanInicio = document.getElementById('displayFechaInicial');
    const hiddenInicio = document.getElementById('fechaInicialCobertura');
    if (spanInicio) spanInicio.textContent = fechaInicio || '--/--/----';
    if (hiddenInicio) hiddenInicio.value = poliza.fecha_inicial_cobertura || '';

    // Fecha final — mostrar y guardar tal cual
    const fechaFinal = formatoUS(poliza.fecha_final_cobertura);
    const spanFinal = document.getElementById('displayFechaFinal');
    const hiddenFinal = document.getElementById('fechaFinalCobertura');
    if (spanFinal) spanFinal.textContent = fechaFinal || '--/--/----';
    if (hiddenFinal) hiddenFinal.value = poliza.fecha_final_cobertura || '';

    // Si tiene PO Box, mostrar ese campo
    if (cliente.po_box) {
        const checkbox = document.getElementById('tienePOBox');
        if (checkbox) {
            checkbox.checked = true;
            togglePOBox();
        }
    }
}

// =========================================
// 
// =========================================

function agregarDependienteExistente(dep) {
    dependientesCount++;
    const container = document.getElementById('dependientesContainer')
    if(!container) return;

    const tarjeta = document.createElement('div');
    tarjeta.className = 'dependiente-card';
    tarjeta.id = `dependiente-card-${dependientesCount}`;
    tarjeta.dataset.depId = dep.id;

    tarjeta.innerHTML = `
        <div class = "dependiente-info">
            <strong>${dep.nombre} ${dep.apellidos || ''}</strong>
            <span>${dep.parentesco || ''} - ${calcularEdad(dep.fecha_nacimiento)} años</span>
        </div>
        <button type="button" onclick = "editarDependiente(${dependientesCount}">
            <span class="material-symbols-rounded">edit</span>
        </button>
    `;

    container.appendChild(tarjeta);
    actualizarContadorDependientes()
}

// ====================================
// FECHAS AUTOMATICAS
// ====================================

function calcularFechasAutomaticas() {
    const hoy = new Date();
    const proximoMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);

    const mes = String(proximoMes.getMonth() + 1).padStart(2, '0');
    const dia = String(proximoMes.getDate()).padStart(2, '0');
    const anio = proximoMes.getFullYear();

    const fechaUS  = `${mes}/${dia}/${anio}`;
    const fechaISO = `${anio}-${mes}-${dia}`;

    // Solo efectividad se calcula automáticamente
    const spanEfectiva = document.getElementById('displayFechaEfectividad');
    const hiddenEfectiva = document.getElementById('fechaEfectividad');
    if (spanEfectiva) spanEfectiva.textContent = fechaUS;
    if (hiddenEfectiva) hiddenEfectiva.value = fechaISO;

    // Inicio y final NO se tocan aquí — los pobla poblarFormulario()
}

// ==============================
// DETECTAR CAMPOS MODIFICADOS
// ==============================

function detectarCampoModificados(datosNuevos) {
    if (!datosOriginales) return ''

    // Mapa de campo técnico -> nombre legible
const etiquetas = {
    // ── CLIENTE ──
    tipo_registro:          'Tipo de Registro',
    caso_especial:          'Caso Especial',
    tipo_modificacion:      'Tipo de Modificación',
    nombres:                'Nombres',
    apellidos:              'Apellidos',
    genero:                 'Género',
    email:                  'Email',
    telefono1:              'Teléfono 1',
    telefono2:              'Teléfono 2',
    fecha_nacimiento:       'Fecha de Nacimiento',
    estado_migratorio:      'Estado Migratorio',
    ssn:                    'SSN',
    tiene_social:           'Tiene Social',
    ingreso_anual:          'Ingreso Anual',
    ocupacion:              'Ocupación',
    nacionalidad:           'Nacionalidad',
    aplica:                 'Aplica',
    direccion:              'Dirección',
    casa_apartamento:       'Casa / Apartamento',
    condado:                'Condado',
    ciudad:                 'Ciudad',
    estado:                 'Estado',
    codigo_postal:          'Código Postal',
    operador_nombre:        'Operador',
    venta_realizada_por:    'Venta Realizada Por',
    agente_nombre:          'Agente',

    // ── PÓLIZA ──
    aplicantes:             'Aplicantes',
    compania:               'Compañía',
    plan:                   'Plan',
    prima:                  'Prima',
    credito_fiscal:         'Crédito Fiscal',
    fecha_efectividad:      'Fecha de Efectividad',
    fecha_inicial_cobertura:'Fecha Inicio Cobertura',
    fecha_final_cobertura:  'Fecha Final Cobertura',
    member_id:              'Member ID',
    portal_npn:             'Portal NPN',
    clave_seguridad:        'Clave de Seguridad',
    enlace_poliza:          'Enlace Póliza',
    observaciones:          'Observaciones',
    documentos_pendientes:  'Documentos Pendientes',
    fecha_plazo_documentos: 'Plazo Documentos',
    agente35_estado:        'Estado Agente 3.5',
    agente35_notas:         'Notas Agente 3.5',
};

    const cambios = [];

    Object.keys(etiquetas).forEach(campo => {
        // Buscar el valor anterior en cliente o póliza
        const anterior = datosOriginales.cliente[campo] ?? datosOriginales.poliza?.[campo] ?? ''
        const nuevo = datosNuevos[campo] ?? '';

        // Solo registrar si de verdad cambio algo
    });

    return cambios.join(' | ');
}

// ====================================
// OBTENER DATOS DEL FORMULARIO
// ====================================

function obtenerDatosFormulario() {
    const get = (id) => document.getElementById(id)?.value?.trim() || '';
    const getNum = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const getCheck = (id) => document.getElementById(id)?.checked || false;

    return {
        // ── CLIENTE ──
        tipo_registro:           get('tipoRegistro'),
        caso_especial:           get('casoEspecial'),
        tipo_modificacion:       get('tipoModificacion'),
        nombres:                 get('nombres'),
        apellidos:               get('apellidos'),
        genero:                  get('genero'),
        email:                   get('email'),
        telefono1:               get('telefono1'),
        telefono2:               get('telefono2'),
        fecha_nacimiento:        get('fechaNacimiento'),
        estado_migratorio:       get('estadoMigratorio'),
        ssn:                     get('ssn'),
        tiene_social:            getCheck('tieneSsn') ? 'Si' : 'No',
        ingreso_anual:           getNum('ingresos'),
        ocupacion:               get('ocupacion'),
        nacionalidad:            get('nacionalidad'),
        aplica:                  get('aplica'),
        direccion:               get('direccion'),
        casa_apartamento:        get('casaApartamento'),
        condado:                 get('condado'),
        ciudad:                  get('ciudad'),
        estado:                  get('estado'),
        codigo_postal:           get('codigoPostal'),
        po_box:                  get('poBox'),
        operador_nombre:         get('operadorNombre'),
        venta_realizada_por:     get('ventaRealizadaPor'),
        agente_nombre:           get('nombreAgenteCompania'),

        // ── PÓLIZA ──
        aplicantes:              getNum('aplicantes'),
        compania:                get('compania'),
        plan:                    get('plan'),
        prima:                   getNum('prima'),
        credito_fiscal:          getNum('creditoFiscal'),
        fecha_efectividad:       get('fechaEfectividad'),
        fecha_inicial_cobertura: get('fechaInicialCobertura'),
        fecha_final_cobertura:   get('fechaFinalCobertura'),
        member_id:               get('memberId'),
        clave_seguridad:         get('claveSeguridad'),
        enlace_poliza:           get('enlacePoliza'),

        fecha_efectividad:        get('fechaEfectividad'),        // hidden ISO
        fecha_inicial_cobertura:  get('fechaInicialCobertura'),   // hidden ISO
        fecha_final_cobertura:    get('fechaFinalCobertura'),      // hidden ISO
    };
}

// =================================
// OBTENER DEPENDIENTES
// =================================

function obtenerDependientes() {
    const cards = document.querySelectorAll('.dependiente-card');
    const dependientes = []

    cards.forEach(card => {
        
        dependientesCount.push({
            nombre: card.querySelector('[data-nombre]')?.dataset.nombre || '',
            apellidos: card.querySelector('[data-apellidos]')?.dataset.apellidos || '',
            relacion: card.querySelector('[data-relacion]')?.dataset.relacion || '',
            fechaNacimiento: card.querySelector('[data-fecha]')?.dataset.fecha || '',
            sexo: card.querySelector('[data-sexo]')?.dataset.sexo || '',
            social: card.querySelector('[data-social]')?.dataset.social || '',
            estatusMigratorio: card.querySelector('[data-aplica]')?.dataset.aplica || '',
        });
    });

    return dependientes
}

// =============================
// TIPO DE CAMBIO
// =============================

function obtenerTipoCambio() {
    const tipo = document.getElementById('tipoRegistro')?.value || '';
    if (tipo.toLowerCase().includes('recuperado')) return 'recuperado';
    if (tipo.toLowerCase().includes('cambio')) return 'cambio_de_vida';
    return 'recuperado';
}

// ==========================
// GUARDAR Y ENVIAR
// ==========================

async function guardarYEnviar(e) {
    e.preventDefault();

    if (!clienteIdSeleccionado) {
        mostrarNotificacion('Primero selecciona un cliente', 'warning');
        return
    }

    try {
        mostrarNotificacion('Guardando...', 'info');
        // Obtener usuario actual
        const { data: { session } } = await supabaseClient.auth.getSession();
        const user = session?.user;

        const { data: usuarioData } = await supabaseClient
            .from('usuarios')
            .select('nombre')
            .eq('email', user.email)
            .single();
            
        const nombreOperador = usuarioData?.nombre || user.email;

        // Leer formulario
        const formData = obtenerDatosFormulario();

        // Detectar qué cambió}
        const camposModificados = detectarCamposModificados(formData);

        // fecha efectiva = 1 del próximo mes
        const hoy = new Date();
        const fechaEfectiva = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toISOString().split('T')[0];

        // Guardar en polizas_pendientes
        const { error: errorPendiente } = await supabaseClient
            .from('polizas_pendienes') 
            .insert({
                poliza_id: polizaIdSeleccionada,
                cliente_id: clienteIdSeleccionado,
                tipo_cambio: obtenerTipoCambio(),
                datos_anteriores: datosOriginales,
                datos_nuevos: formData,
                campos_modificados: camposModificados,
                fecha_efectividad: fechaEfectiva,
                creado_por: nombreOperador,
            });
        if (errorPendiente) throw errorPendiente;
        // Actualizar cliente en supabase
        const { error: erroCliente } = await supabaseClient
            .from('clientes')
            .update({
                nombres: formData.nombres,
                apellidos: formData.apellidos,
                email: formData.email,
                telefono1: formData.telefono1,
                telefono2: formData.telefono2,
                direccion: formData.direccion,
                ciudad: formData.ciudad,
                estado: formData.codigo_postal,
                genero: formData.genero,
                estado_migratorio: formData.estado_migratorio,
                ssn: formData.ssn,
                ingreso_anual: formData.ingreso_anual,
                ocupacion: formData.ocupacion,
                operador_nombre: formData.operador_nombre,
            })
            .eq('id', clienteIdSeleccionado);
        if (errorCliente) throw errorCliente;

        // Enviar a Google Sheets
        await enviarAGoogleSheets ({
            registradoPor: nommbreOperador,
            tipoCambio: obtenerTipoCambio(),
            camposModificados: camposModificados,
            fechaEfectiva: fechaEfectiva,

            // Datos del cliente
            nombreOperador: formData.operador_nombre,
            nombre: formData.nombre,
            apellidos: formData.apellidos,
            genero: formData.genero,
            email: formData.email,
            telefono1: formData.telefono1,
            telefono2: formData.telefono2,
            fechaNacimiento: formData.fecha_nacimiento,
            estatus: formData.estatus_migratorio,
            social: formData.ssn,
            ingresos: formData.ingreso_anual,
            ocupacion: formData.ocupacion,
            direccion: formData.direccion,

            // Datos de la poliza
            compania: formData.compania,
            plan: formData.plan,
            credito_fiscal: formData.credito_fiscal,
            prima: formData.prima,
            link: formData.enlace_poliza,

            // Dependientes
            dependeintes: obtenerDependientes(),

            // tipo de venta
            tipoVenta: obtenerTipoCambio() === 'recuperado' ? 'Recuperado' : 'Cambio de vida',
        });

        mostrarNotificacion('Guardado y enviado correctamente', 'success');

        // Limpiar borrador
        localStorage.removeItem('borrador_recuperado');
        setTimeout(() => {
            window.location.href = '../pages/polizas.html';
        }, 2000)
    } catch (error) {
        console.error('Error al guardar: ', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

// ======================
// Borrador
// ======================

function inicializarAutoguardado() {
    autosaveTimer = setInterval(() => {
        // Solo guarda si hay cliente seleccionado
        if (!clienteIdSeleccionado) return;
 
        const borrador = {
            clienteId: clienteIdSeleccionado,
            polizaId: polizaIdSeleccionada,
            datosOriginales: datosOriginales,
            formData: obtenerDatosFormulario(),
            timestamp: new Date().toISOString()
        };
 
        localStorage.setItem('borrador_recuperado', JSON.stringify(borrador));
 
        const texto = document.getElementById('autosaveText');
        if (texto) {
            texto.textContent = 'Borrador guardado ' +
                new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
 
    }, AUTOSAVE_INTERVAL);
}
 
async function cargarBorradorAutomatico() {
    const borradorRaw = localStorage.getItem('borrador_recuperado');
    if (!borradorRaw) return;
 
    const borrador = JSON.parse(borradorRaw);
    const tiempoGuardado = new Date(borrador.timestamp);
    const minutosTranscurridos = (new Date() - tiempoGuardado) / 1000 / 60;
 
    // Borradores de más de 2 horas se descartan
    if (minutosTranscurridos > 120) {
        localStorage.removeItem('borrador_recuperado');
        return;
    }
 
    const restaurar = confirm(
        `Hay un borrador de hace ${Math.round(minutosTranscurridos)} minutos. ¿Deseas restaurarlo?`
    );
 
    if (!restaurar) {
        localStorage.removeItem('borrador_recuperado');
        return;
    }
 
    // Restaurar IDs y datos originales
    clienteIdSeleccionado = borrador.clienteId;
    polizaIdSeleccionada = borrador.polizaId;
    datosOriginales = borrador.datosOriginales;
 
    // Repoblar el formulario con los datos guardados
    if (datosOriginales) {
        poblarFormulario(datosOriginales.cliente, datosOriginales.poliza);
    }
 
    // Mostrar confirmación visual
    const estado = document.getElementById('busquedaEstado');
    const texto = document.getElementById('busquedaEstadoTexto');
    if (estado) estado.style.display = 'flex';
    if (texto) texto.textContent = 'Borrador restaurado';
 
    mostrarNotificacion(' Borrador restaurado', 'success');
}
 
 
// ============================================
// INICIALIZACIÓN QUILL
// ============================================
 
function inicializarQuill() {
    const editorEl = document.getElementById('quillEditor');
    if (!editorEl) return;
 
    quillNota = new Quill('#quillEditor', {
        theme: 'snow',
        placeholder: 'Escribe tu nota aquí...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'header': [1, 2, 3, false] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet'}],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'font': [] }],
                ['link'],
                ['clean']
            ]
        }
    });
 
    // Botón de imagen del toolbar
    quillNota.getModule('toolbar').addHandler('image', function() {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();
        input.onchange = async function() {
            const file = input.files[0];
            if (file) await subirImagenQuill(file);
        };
    });
 
    // Detectar imagen pegada y subirla a Supabase
    quillNota.on('text-change', async function(delta, oldDelta, source) {
        if (source !== 'user') return;
        const imgs = quillNota.root.querySelectorAll('img[src^="data:image"]');
        if (imgs.length === 0) return;
        for (const img of imgs) {
            const base64 = img.getAttribute('src');
            const res = await fetch(base64);
            const blob = await res.blob();
            const file = new File([blob], `paste_${Date.now()}.png`, { type: blob.type });
            const path = `notas/${clienteIdSeleccionado || 'temp'}/${Date.now()}_paste.png`;
            const { error } = await supabaseClient.storage
                .from('documentos')
                .upload(path, file, { cacheControl: '3600', upsert: false });
            if (error) { console.error('Error subiendo imagen:', error); continue; }
            const { data: urlData } = supabaseClient.storage
                .from('documentos').getPublicUrl(path);
            img.setAttribute('src', urlData.publicUrl);
        }
    });
}
 
 
// ============================================
// INICIALIZACIÓN PRINCIPAL
// ============================================
 
document.addEventListener('DOMContentLoaded', async function() {
 
    // 1. Inicializar editor de notas
    inicializarQuill();
 
    // 2. Conectar formulario a guardarYEnviar
    const form = document.getElementById('clienteForm');
    if (form) form.addEventListener('submit', guardarYEnviar);
 
    // 3. Inicializar tabs de navegación
    inicializarTabs();
 
    // 4. Inicializar validación en tiempo real
    inicializarValidacionTiempoReal();
 
    // 5. Arrancar el autoguardado cada 30s
    inicializarAutoguardado();
 
    // 6. Verificar si hay borrador guardado
    await cargarBorradorAutomatico();
 
    // 7. Cargar info del usuario en el header
    await cargarInfoUsuario();
 
    // 8. Inicializar menú del admin
    if (typeof inicializarMenuAdmin === 'function') {
        await inicializarMenuAdmin();
    }
 
});

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