// ============================================
// VARIABLES GLOBALES
// ============================================

let clienteIdSeleccionado = null;
let polizaIdSeleccionada = null;
let datosOriginales = null;
let quillNota = null;
let autosaveTimer = null;
const AUTOSAVE_INTERVAL = 30000; // 30 segundos

// ============================================
// BÚSQUEDA DE CLIENTES
// ============================================

let timerBusqueda = null;

async function buscarClientes(termino) {
    const select = document.getElementById('selectCliente');

    if (!termino || termino.length < 2) {
        select.innerHTML = '<option value="">Escribe para buscar</option>';
        select.disabled = true;
        return;
    }

    clearTimeout(timerBusqueda);
    timerBusqueda = setTimeout(async () => {
        try {
            const palabras = termino.trim().split(/\s+/);
            let query = supabaseClient
                .from('clientes')
                .select('id, nombres, apellidos, email, telefono1')
                .eq('archivado', false)
                .limit(20);

            if (palabras.length === 1) {
                query = query.or(`nombres.ilike.%${palabras[0]}%,apellidos.ilike.%${palabras[0]}%`);
            } else {
                query = query.ilike('nombres', `%${palabras[0]}%`)
                             .ilike('apellidos', `%${palabras[1]}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                select.innerHTML = '<option value="">Sin resultados</option>';
                select.disabled = true;
                return;
            }

            select.innerHTML = '<option value="">Selecciona un cliente</option>';
            data.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = `${cliente.nombres} ${cliente.apellidos} — ${cliente.telefono1 || cliente.email || ''}`;
                select.appendChild(option);
            });
            select.disabled = false;

        } catch (error) {
            console.error('Error buscando clientes:', error);
            mostrarNotificacion('Error al buscar clientes', 'error');
        }
    }, 400);
}

// ============================================
// SELECCIONAR CLIENTE
// ============================================

async function seleccionarCliente(clienteId) {
    if (!clienteId) return;

    try {
        mostrarNotificacion('Cargando información...', 'info');

        const { data: cliente, error } = await supabaseClient
            .from('clientes')
            .select(`*, polizas(*), metodos_pago(*)`)
            .eq('id', clienteId)
            .single();

        if (error) throw error;

        // Guardar ID global
        clienteIdSeleccionado = cliente.id;

        // Tomar la póliza más reciente
        const polizas = cliente.polizas || [];
        const polizaActiva = polizas.sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        )[0] || null;

        polizaIdSeleccionada = polizaActiva?.id || null;

        // Snapshot antes de cualquier cambio
        datosOriginales = {
            cliente: { ...cliente },
            poliza: polizaActiva ? { ...polizaActiva } : {}
        };

        // Poblar formulario
        poblarFormulario(cliente, polizaActiva);

        // Cargar dependientes
        await cargarDependientes(clienteId);

        // Cargar notas
        await cargarNotas(clienteId);

        // Cargar método de pago
        if (cliente.metodos_pago && cliente.metodos_pago.length > 0) {
            cargarMetodoPago(cliente.metodos_pago[0]);
        }

        // Calcular fechas automáticas
        calcularFechasAutomaticas(polizaActiva);

        // Indicador visual
        const estado = document.getElementById('busquedaEstado');
        const texto = document.getElementById('busquedaEstadoTexto');
        if (estado) estado.style.display = 'flex';
        if (texto) texto.textContent = `${cliente.nombres} ${cliente.apellidos} cargado`;

        mostrarNotificacion('Cliente cargado correctamente', 'success');

    } catch (error) {
        console.error('Error al cargar cliente:', error);
        mostrarNotificacion('Error al cargar cliente: ' + error.message, 'error');
    }
}

// ============================================
// POBLAR FORMULARIO
// ============================================

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
    set('tipoRegistro',     cliente.tipo_registro);
    set('nombres',          cliente.nombres);
    set('apellidos',        cliente.apellidos);
    set('genero',           cliente.genero);
    set('email',            cliente.email);
    set('telefono1',        cliente.telefono1);
    set('telefono2',        cliente.telefono2);
    set('fechaNacimiento',  formatoUS(cliente.fecha_nacimiento));
    set('estadoMigratorio', cliente.estado_migratorio);
    set('ssn',              cliente.ssn);
    setCheck('tieneSsn',    cliente.tiene_social);
    set('ingresos',         cliente.ingreso_anual);
    set('ocupacion',        cliente.ocupacion);
    set('nacionalidad',     cliente.nacionalidad);
    set('aplica',           cliente.aplica);
    set('direccion',        cliente.direccion);
    set('casaApartamento',  cliente.casa_apartamento);
    set('condado',          cliente.condado);
    set('ciudad',           cliente.ciudad);
    set('estado',           cliente.estado);
    set('codigoPostal',     cliente.codigo_postal);
    set('poBox',            cliente.po_box);
    set('operadorNombre',   cliente.operador_nombre);
    set('ventaRealizadaPor',cliente.venta_realizada_por);

    // ── PÓLIZA ──
    if (poliza) {
        set('aplicantes',           poliza.aplicantes);
        set('compania',             poliza.compania);
        set('plan',                 poliza.plan);
        set('prima',                poliza.prima);
        set('creditoFiscal',        poliza.credito_fiscal);
        set('memberId',             poliza.member_id);
        set('claveSeguridad',       poliza.clave_seguridad);
        set('enlacePoliza',         poliza.enlace_poliza);
        set('nombreAgenteCompania', poliza.agente_nombre);
    }

    // PO Box
    if (cliente.po_box) {
        const checkbox = document.getElementById('tienePOBox');
        if (checkbox) {
            checkbox.checked = true;
            togglePOBox();
        }
    }
}

// ============================================
// CARGAR DEPENDIENTES DESDE BD
// ============================================

async function cargarDependientes(clienteId) {
    try {
        const { data, error } = await supabaseClient
            .from('dependientes')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) return;

        data.forEach(dep => agregarDependienteExistente(dep));

    } catch (error) {
        console.warn('Error cargando dependientes:', error);
    }
}

function agregarDependienteExistente(dep) {
    dependientesCount++;
    const container = document.getElementById('dependientesContainer');
    if (!container) return;

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const edad = calcularEdad(dep.fecha_nacimiento);
    const iniciales = ((dep.nombres || dep.nombre || '?').charAt(0) + (dep.apellidos || '?').charAt(0)).toUpperCase();

    const tarjeta = document.createElement('div');
    tarjeta.className = 'dependiente-card existente';
    tarjeta.id = `dependiente-${dependientesCount}`;
    tarjeta.dataset.depId = dep.id;

    tarjeta.innerHTML = `
        <input type="hidden" name="dep_nombres_${dependientesCount}" value="${dep.nombres || dep.nombre || ''}">
        <input type="hidden" name="dep_apellidos_${dependientesCount}" value="${dep.apellidos || ''}">
        <input type="hidden" name="dep_fecha_nacimiento_${dependientesCount}" value="${dep.fecha_nacimiento || ''}">
        <input type="hidden" name="dep_sexo_${dependientesCount}" value="${dep.sexo || ''}">
        <input type="hidden" name="dep_ssn_${dependientesCount}" value="${dep.ssn || ''}">
        <input type="hidden" name="dep_estado_migratorio_${dependientesCount}" value="${dep.estado_migratorio || ''}">
        <input type="hidden" name="dep_relacion_${dependientesCount}" value="${dep.relacion || ''}">
        <input type="hidden" name="dep_aplica_${dependientesCount}" value="${dep.aplica || ''}">

        <div class="dependiente-card-header">
            <div class="dependiente-card-info">
                <div class="dependiente-avatar">${iniciales}</div>
                <div class="dependiente-card-nombre">
                    <h4>${dep.nombres || dep.nombre || ''} ${dep.apellidos || ''}</h4>
                    <small>${edad} años • ${dep.sexo || ''} • ${dep.relacion || ''}</small>
                </div>
            </div>
            <div class="dependiente-card-acciones">
                <button type="button" class="btn-icon" onclick="editarDependiente(${dependientesCount})" title="Editar">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button type="button" class="btn-icon delete" onclick="eliminarDependienteCard(${dependientesCount}, '${dep.id}')" title="Eliminar">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
        </div>
    `;

    container.appendChild(tarjeta);
    actualizarContadorDependientes();
}

// ============================================
// MODAL DEPENDIENTE — GUARDAR
// ============================================

function guardarDependienteModal() {
    const nombres = document.getElementById('modal_dep_nombres').value.trim();
    const apellidos = document.getElementById('modal_dep_apellidos').value.trim();
    const fechaNacimiento = document.getElementById('modal_dep_fecha_nacimiento').value;
    const sexo = document.getElementById('modal_dep_sexo').value;

    if (!nombres || !apellidos || !fechaNacimiento || !sexo) {
        alert('Por favor completa todos los campos requeridos (*)');
        return;
    }

    const depCount = document.getElementById('modal_dep_count').value;

    const dependiente = {
        nombres,
        apellidos,
        fecha_nacimiento: fechaNacimiento,
        sexo,
        ssn:               document.getElementById('modal_dep_ssn').value.trim(),
        estado_migratorio: document.getElementById('modal_dep_estado_migratorio').value,
        relacion:          document.getElementById('modal_dep_relacion').value,
        aplica:            document.getElementById('modal_dep_aplica').value,
    };

    if (depCount) {
        actualizarTarjetaDependiente(depCount, dependiente);
    } else {
        dependientesCount++;
        crearTarjetaDependiente(dependientesCount, dependiente, null);
    }

    cerrarModalDependiente();
    actualizarContadorDependientes();
}

function crearTarjetaDependiente(count, dep, depId) {
    const container = document.getElementById('dependientesContainer');
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const edad = calcularEdad(dep.fecha_nacimiento);
    const iniciales = (dep.nombres.charAt(0) + dep.apellidos.charAt(0)).toUpperCase();
    const dataDepId = depId ? `data-dep-id="${depId}"` : '';

    const card = document.createElement('div');
    card.className = 'dependiente-card';
    card.id = `dependiente-${count}`;
    if (depId) card.dataset.depId = depId;

    card.innerHTML = `
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
                    <small>${edad} años • ${dep.sexo} • ${dep.relacion || ''}</small>
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
    `;

    container.appendChild(card);
}

function actualizarTarjetaDependiente(count, dep) {
    const card = document.getElementById(`dependiente-${count}`);
    if (!card) return;

    const set = (name, val) => {
        const el = card.querySelector(`[name="dep_${name}_${count}"]`);
        if (el) el.value = val || '';
    };

    set('nombres', dep.nombres);
    set('apellidos', dep.apellidos);
    set('fecha_nacimiento', dep.fecha_nacimiento);
    set('sexo', dep.sexo);
    set('ssn', dep.ssn);
    set('estado_migratorio', dep.estado_migratorio);
    set('relacion', dep.relacion);
    set('aplica', dep.aplica);

    const edad = calcularEdad(dep.fecha_nacimiento);
    const iniciales = (dep.nombres.charAt(0) + dep.apellidos.charAt(0)).toUpperCase();
    const avatarEl = card.querySelector('.dependiente-avatar');
    if (avatarEl) avatarEl.textContent = iniciales;
    const h4 = card.querySelector('h4');
    if (h4) h4.textContent = `${dep.nombres} ${dep.apellidos}`;
    const small = card.querySelector('small');
    if (small) small.textContent = `${edad} años • ${dep.sexo} • ${dep.relacion || ''}`;
}

function eliminarDependienteCard(count, depId) {
    if (!confirm('¿Eliminar este dependiente?')) return;
    const card = document.getElementById(`dependiente-${count}`);
    if (card) card.remove();
    actualizarContadorDependientes();
    const container = document.getElementById('dependientesContainer');
    if (container && !container.querySelector('.dependiente-card')) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">family_restroom</span>
                <p>No hay dependientes agregados</p>
                <small>Haz clic en "Agregar Dependiente" para comenzar</small>
            </div>`;
    }
}

function editarDependiente(count) {
    const card = document.getElementById(`dependiente-${count}`);
    if (!card) return;

    const get = (name) => card.querySelector(`[name="dep_${name}_${count}"]`)?.value || '';

    document.getElementById('modal_dep_count').value = count;
    document.getElementById('modal_dep_id').value = card.dataset.depId || '';
    document.getElementById('modal_dep_nombres').value = get('nombres');
    document.getElementById('modal_dep_apellidos').value = get('apellidos');
    document.getElementById('modal_dep_fecha_nacimiento').value = get('fecha_nacimiento');
    document.getElementById('modal_dep_sexo').value = get('sexo');
    document.getElementById('modal_dep_ssn').value = get('ssn');
    document.getElementById('modal_dep_estado_migratorio').value = get('estado_migratorio');
    document.getElementById('modal_dep_relacion').value = get('relacion');
    document.getElementById('modal_dep_aplica').value = get('aplica');

    document.getElementById('modalDependienteTitulo').textContent = 'Editar Dependiente';
    document.getElementById('modalDependiente').classList.add('active');
}

// ============================================
// CARGAR MÉTODO DE PAGO
// ============================================

function cargarMetodoPago(metodo) {
    if (!metodo) return;

    const radioTipo = document.querySelector(`[name="metodoPago"][value="${metodo.tipo}"]`);
    if (radioTipo) {
        radioTipo.checked = true;
        mostrarFormularioPago(metodo.tipo);
    }

    if (metodo.tipo === 'banco') {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        set('nombreBanco',   metodo.nombre_banco);
        set('numeroCuenta',  metodo.numero_cuenta);
        set('routingNumber', metodo.routing_number);
        set('nombreCuenta',  metodo.nombre_cuenta);
    } else if (metodo.tipo === 'tarjeta') {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        set('numeroTarjeta',   metodo.numero_tarjeta);
        set('nombreTarjeta',   metodo.nombre_tarjeta);
        set('fechaExpiracion', metodo.fecha_expiracion);
        set('cvv',             metodo.cvv);
        set('tipoTarjeta',     metodo.tipo_tarjeta);
    }
}

// ============================================
// FECHAS AUTOMÁTICAS
// ============================================

function calcularFechasAutomaticas(poliza) {
    const hoy = new Date();
    const proximoMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const mes  = String(proximoMes.getMonth() + 1).padStart(2, '0');
    const dia  = String(proximoMes.getDate()).padStart(2, '0');
    const anio = proximoMes.getFullYear();
    const fechaUS  = `${mes}/${dia}/${anio}`;
    const fechaISO = `${anio}-${mes}-${dia}`;

    // Fecha efectividad: siempre el 1 del próximo mes
    const spanEfec   = document.getElementById('displayFechaEfectividad');
    const hiddenEfec = document.getElementById('fechaEfectividad');
    if (spanEfec) spanEfec.textContent = fechaUS;
    if (hiddenEfec) hiddenEfec.value   = fechaISO;

    // Fecha inicio y final: vienen de la póliza existente del cliente
    if (poliza) {
        const spanInicio   = document.getElementById('displayFechaInicial');
        const hiddenInicio = document.getElementById('fechaInicialCobertura');
        const spanFinal    = document.getElementById('displayFechaFinal');
        const hiddenFinal  = document.getElementById('fechaFinalCobertura');

        const fInicio = formatoUS(poliza.fecha_inicial_cobertura);
        const fFinal  = formatoUS(poliza.fecha_final_cobertura);

        if (spanInicio) spanInicio.textContent = fInicio || '--/--/----';
        if (hiddenInicio) hiddenInicio.value   = poliza.fecha_inicial_cobertura || '';
        if (spanFinal) spanFinal.textContent   = fFinal  || '--/--/----';
        if (hiddenFinal) hiddenFinal.value     = poliza.fecha_final_cobertura  || '';
    }
}

// ============================================
// DETECTAR CAMPOS MODIFICADOS
// ============================================

function detectarCamposModificados(datosNuevos) {
    if (!datosOriginales) return '';

    const etiquetas = {
        nombres:                'Nombres',
        apellidos:              'Apellidos',
        genero:                 'Género',
        email:                  'Email',
        telefono1:              'Teléfono 1',
        telefono2:              'Teléfono 2',
        fecha_nacimiento:       'Fecha de Nacimiento',
        estado_migratorio:      'Estado Migratorio',
        ssn:                    'SSN',
        ingreso_anual:          'Ingreso Anual',
        ocupacion:              'Ocupación',
        nacionalidad:           'Nacionalidad',
        direccion:              'Dirección',
        ciudad:                 'Ciudad',
        estado:                 'Estado',
        codigo_postal:          'Código Postal',
        operador_nombre:        'Operador',
        venta_realizada_por:    'Venta Realizada Por',
        compania:               'Compañía',
        plan:                   'Plan',
        prima:                  'Prima',
        credito_fiscal:         'Crédito Fiscal',
        member_id:              'Member ID',
        clave_seguridad:        'Clave de Seguridad',
        enlace_poliza:          'Enlace Póliza',
    };

    const cambios = [];
    Object.keys(etiquetas).forEach(campo => {
        const anterior = String(datosOriginales.cliente[campo] ?? datosOriginales.poliza?.[campo] ?? '');
        const nuevo    = String(datosNuevos[campo] ?? '');
        if (anterior !== nuevo && nuevo !== '') {
            cambios.push(etiquetas[campo]);
        }
    });

    return cambios.join(' | ');
}

// ============================================
// OBTENER DATOS DEL FORMULARIO
// ============================================

function obtenerDatosFormulario() {
    const get    = (id) => document.getElementById(id)?.value?.trim() || '';
    const getNum = (id) => parseFloat(document.getElementById(id)?.value) || 0;

    return {
        // CLIENTE
        tipo_registro:           get('tipoRegistro'),
        nombres:                 get('nombres'),
        apellidos:               get('apellidos'),
        genero:                  get('genero'),
        email:                   get('email'),
        telefono1:               get('telefono1'),
        telefono2:               get('telefono2'),
        fecha_nacimiento:        get('fechaNacimiento'),
        estado_migratorio:       get('estadoMigratorio'),
        ssn:                     get('ssn'),
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

        // PÓLIZA
        aplicantes:              getNum('aplicantes'),
        compania:                get('compania'),
        plan:                    get('plan'),
        prima:                   getNum('prima'),
        credito_fiscal:          getNum('creditoFiscal'),
        member_id:               get('memberId'),
        clave_seguridad:         get('claveSeguridad'),
        enlace_poliza:           get('enlacePoliza'),
        agente_nombre:           get('nombreAgenteCompania'),

        // FECHAS (hidden ISO)
        fecha_efectividad:       get('fechaEfectividad'),
        fecha_inicial_cobertura: get('fechaInicialCobertura'),
        fecha_final_cobertura:   get('fechaFinalCobertura'),
    };
}

// ============================================
// OBTENER DEPENDIENTES DEL FORMULARIO
// ============================================

function obtenerDependientes() {
    const cards = document.querySelectorAll('.dependiente-card');
    const dependientes = [];

    cards.forEach(card => {
        const match = card.id.match(/dependiente-(\d+)/);
        if (!match) return;
        const count = match[1];
        const get = (name) => card.querySelector(`[name="dep_${name}_${count}"]`)?.value || '';

        dependientes.push({
            nombre:             get('nombres'),
            apellidos:          get('apellidos'),
            fecha_nacimiento:   get('fecha_nacimiento'),
            sexo:               get('sexo'),
            ssn:                get('ssn'),
            estado_migratorio:  get('estado_migratorio'),
            relacion:           get('relacion'),
            aplica:             get('aplica'),
        });
    });

    return dependientes;
}

// ============================================
// TIPO DE CAMBIO
// ============================================

function obtenerTipoCambio() {
    const tipo = document.getElementById('tipoRegistro')?.value?.toLowerCase() || '';
    if (tipo.includes('recuperad')) return 'recuperado';
    if (tipo.includes('cambio'))    return 'cambio_de_vida';
    return 'recuperado';
}

// ============================================
// GUARDAR Y ENVIAR
// ============================================

async function guardarYEnviar(e) {
    e.preventDefault();

    if (!clienteIdSeleccionado) {
        mostrarNotificacion('Primero selecciona un cliente', 'warning');
        return;
    }

    try {
        mostrarNotificacion('Guardando...', 'info');

        const { data: { session } } = await supabaseClient.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error('Sesión no encontrada');

        const { data: usuarioData } = await supabaseClient
            .from('usuarios')
            .select('nombre')
            .eq('email', user.email)
            .single();

        const nombreOperador = usuarioData?.nombre || user.email;
        const formData        = obtenerDatosFormulario();
        const camposModificados = detectarCamposModificados(formData);
        const tipoCambio      = obtenerTipoCambio();

        // 1. Guardar en polizas_pendientes
        const { error: errorPendiente } = await supabaseClient
            .from('polizas_pendientes')
            .insert({
                poliza_id:          polizaIdSeleccionada,
                cliente_id:         clienteIdSeleccionado,
                tipo_cambio:        tipoCambio,
                datos_anteriores:   datosOriginales,
                datos_nuevos:       formData,
                campos_modificados: camposModificados,
                fecha_efectividad:  formData.fecha_efectividad,
                creado_por:         nombreOperador,
            });
        if (errorPendiente) throw errorPendiente;

        // 2. Actualizar cliente
        const { error: errorCliente } = await supabaseClient
            .from('clientes')
            .update({
                nombres:           formData.nombres,
                apellidos:         formData.apellidos,
                email:             formData.email,
                telefono1:         formData.telefono1,
                telefono2:         formData.telefono2,
                genero:            formData.genero,
                direccion:         formData.direccion,
                casa_apartamento:  formData.casa_apartamento,
                condado:           formData.condado,
                ciudad:            formData.ciudad,
                estado:            formData.estado,
                codigo_postal:     formData.codigo_postal,
                po_box:            formData.po_box,
                estado_migratorio: formData.estado_migratorio,
                ssn:               formData.ssn,
                ingreso_anual:     formData.ingreso_anual,
                ocupacion:         formData.ocupacion,
                operador_nombre:   formData.operador_nombre,
                venta_realizada_por: formData.venta_realizada_por,
            })
            .eq('id', clienteIdSeleccionado);
        if (errorCliente) throw errorCliente;

        // 3. Actualizar póliza si existe
        if (polizaIdSeleccionada) {
            const { error: errorPoliza } = await supabaseClient
                .from('polizas')
                .update({
                    aplicantes:             formData.aplicantes,
                    compania:               formData.compania,
                    plan:                   formData.plan,
                    prima:                  formData.prima,
                    credito_fiscal:         formData.credito_fiscal,
                    member_id:              formData.member_id,
                    clave_seguridad:        formData.clave_seguridad,
                    enlace_poliza:          formData.enlace_poliza,
                    agente_nombre:          formData.agente_nombre,
                    fecha_efectividad:      formData.fecha_efectividad,
                    fecha_inicial_cobertura:formData.fecha_inicial_cobertura,
                    fecha_final_cobertura:  formData.fecha_final_cobertura,
                    modificado_por_nombre:  nombreOperador,
                    modificado_por_email:   user.email,
                })
                .eq('id', polizaIdSeleccionada);
            if (errorPoliza) throw errorPoliza;
        }

        // 4. Enviar a Google Sheets
        const dependientes = obtenerDependientes();
        await enviarAGoogleSheets({
            registradoPor:   nombreOperador,
            tipoCambio:      tipoCambio,
            camposModificados,
            fechaEfectiva:   formData.fecha_efectividad,

            nombreOperador:  formData.operador_nombre,
            nombre:          formData.nombres,
            apellidos:       formData.apellidos,
            genero:          formData.genero,
            email:           formData.email,
            telefono1:       formData.telefono1,
            telefono2:       formData.telefono2,
            fechaNacimiento: formData.fecha_nacimiento,
            estatus:         formData.estado_migratorio,
            social:          formData.ssn,
            ingresos:        formData.ingreso_anual,
            ocupacion:       formData.ocupacion,
            direccion:       formData.direccion,

            compania:        formData.compania,
            plan:            formData.plan,
            credito_fiscal:  formData.credito_fiscal,
            prima:           formData.prima,
            link:            formData.enlace_poliza,

            dependientes,
            tipoVenta:       tipoCambio === 'recuperado' ? 'Recuperado' : 'Cambio de vida',
        });

        mostrarNotificacion('Guardado y enviado correctamente', 'success');
        localStorage.removeItem('borrador_recuperado');

        setTimeout(() => {
            window.location.href = '../pages/polizas.html';
        }, 2000);

    } catch (error) {
        console.error('Error al guardar:', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

// ============================================
// GUARDAR BORRADOR MANUAL
// ============================================

function guardarBorrador() {
    if (!clienteIdSeleccionado) {
        mostrarNotificacion('Selecciona un cliente antes de guardar el borrador', 'warning');
        return;
    }
    const borrador = {
        clienteId:      clienteIdSeleccionado,
        polizaId:       polizaIdSeleccionada,
        datosOriginales,
        formData:       obtenerDatosFormulario(),
        timestamp:      new Date().toISOString()
    };
    localStorage.setItem('borrador_recuperado', JSON.stringify(borrador));
    mostrarNotificacion('Borrador guardado', 'success');
    const texto = document.getElementById('autosaveText');
    if (texto) texto.textContent = 'Borrador guardado ' +
        new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// AUTOGUARDADO
// ============================================

function inicializarAutoguardado() {
    autosaveTimer = setInterval(() => {
        if (!clienteIdSeleccionado) return;
        const borrador = {
            clienteId:      clienteIdSeleccionado,
            polizaId:       polizaIdSeleccionada,
            datosOriginales,
            formData:       obtenerDatosFormulario(),
            timestamp:      new Date().toISOString()
        };
        localStorage.setItem('borrador_recuperado', JSON.stringify(borrador));
        const texto = document.getElementById('autosaveText');
        if (texto) texto.textContent = 'Borrador guardado ' +
            new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }, AUTOSAVE_INTERVAL);
}

async function cargarBorradorAutomatico() {
    const borradorRaw = localStorage.getItem('borrador_recuperado');
    if (!borradorRaw) return;

    const borrador = JSON.parse(borradorRaw);
    const minutos = (new Date() - new Date(borrador.timestamp)) / 1000 / 60;

    if (minutos > 120) {
        localStorage.removeItem('borrador_recuperado');
        return;
    }

    const restaurar = confirm(`Hay un borrador guardado hace ${Math.round(minutos)} minutos. ¿Deseas restaurarlo?`);
    if (!restaurar) {
        localStorage.removeItem('borrador_recuperado');
        return;
    }

    clienteIdSeleccionado = borrador.clienteId;
    polizaIdSeleccionada  = borrador.polizaId;
    datosOriginales       = borrador.datosOriginales;

    if (datosOriginales) {
        poblarFormulario(datosOriginales.cliente, datosOriginales.poliza);
    }

    const estado = document.getElementById('busquedaEstado');
    const texto  = document.getElementById('busquedaEstadoTexto');
    if (estado) estado.style.display = 'flex';
    if (texto)  texto.textContent = 'Borrador restaurado';

    mostrarNotificacion('Borrador restaurado', 'success');
}

// ============================================
// CANCELAR FORMULARIO
// ============================================

function cancelarFormulario() {
    if (confirm('¿Cancelar y volver? Se perderán los cambios no guardados.')) {
        localStorage.removeItem('borrador_recuperado');
        clearInterval(autosaveTimer);
        window.location.href = '../pages/polizas.html';
    }
}

// ============================================
// NOTAS
// ============================================

async function agregarNota() {
    if (!clienteIdSeleccionado) {
        mostrarNotificacion('Selecciona un cliente primero', 'warning');
        return;
    }

    const contenidoQuill = quillNota ? quillNota.root.innerHTML : '';
    const textoPlano     = quillNota ? quillNota.getText().trim() : '';
    const mensaje        = contenidoQuill === '<p><br></p>' ? '' : contenidoQuill;

    if (!textoPlano && !mensaje.includes('<img')) {
        mostrarNotificacion('Escribe un mensaje o adjunta una imagen', 'warning');
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error('Sin sesión');

        const { data: nuevaNota, error } = await supabaseClient
            .from('notas')
            .insert([{
                cliente_id:     clienteIdSeleccionado,
                mensaje,
                usuario_email:  user.email,
                usuario_nombre: user.user_metadata?.nombre || user.email,
            }])
            .select()
            .single();

        if (error) throw error;

        const thread = document.getElementById('notasThread');
        const emptyState = thread?.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const notaHTML = `
            <div class="nota-card" data-nota-id="${nuevaNota.id}">
                <div class="nota-header">
                    <div class="nota-info">
                        <span class="nota-usuario">${nuevaNota.usuario_nombre}</span>
                        <span class="nota-fecha">Ahora</span>
                    </div>
                </div>
                <div class="nota-mensaje">${mensaje}</div>
            </div>`;

        if (thread) thread.insertAdjacentHTML('afterbegin', notaHTML);
        if (quillNota) quillNota.setText('');
        actualizarContadorNotas();
        mostrarNotificacion('Nota guardada', 'success');

    } catch (error) {
        console.error('Error al guardar nota:', error);
        mostrarNotificacion('Error al guardar nota', 'error');
    }
}

async function cargarNotas(clienteId) {
    try {
        const { data, error } = await supabaseClient
            .from('notas')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const thread = document.getElementById('notasThread');
        if (!thread) return;

        if (!data || data.length === 0) return;

        thread.innerHTML = '';
        data.forEach(nota => {
            const fecha = new Date(nota.created_at).toLocaleDateString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            thread.insertAdjacentHTML('beforeend', `
                <div class="nota-card" data-nota-id="${nota.id}">
                    <div class="nota-header">
                        <div class="nota-info">
                            <span class="nota-usuario">${nota.usuario_nombre || nota.usuario_email}</span>
                            <span class="nota-fecha">${fecha}</span>
                        </div>
                    </div>
                    <div class="nota-mensaje">${nota.mensaje}</div>
                </div>`);
        });
        actualizarContadorNotas();

    } catch (error) {
        console.warn('Error cargando notas:', error);
    }
}

function cancelarNota() {
    if (quillNota) quillNota.setText('');
}

// ============================================
// TABS
// ============================================

function inicializarTabs() {
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            cambiarTab(this.getAttribute('data-tab'));
        });
    });
    cambiarTab('info-general');
}

function cambiarTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
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

// ============================================
// VALIDACIÓN EN TIEMPO REAL
// ============================================

function inicializarValidacionTiempoReal() {
    const tel1 = document.getElementById('telefono1');
    const tel2 = document.getElementById('telefono2');
    const ssn  = document.getElementById('ssn');
    const email = document.getElementById('email');
    const cp   = document.getElementById('codigoPostal');

    if (tel1) tel1.addEventListener('input', function() { this.value = formatearTelefono(this.value); });
    if (tel2) tel2.addEventListener('input', function() { this.value = formatearTelefono(this.value); });
    if (ssn)  ssn.addEventListener('input',  function() { this.value = formatearSSN(this.value); });
    if (email) email.addEventListener('blur', function() { validarEmail(this); });
    if (cp)   cp.addEventListener('input',   function() { validarCodigoPostal(this); });
}

// ============================================
// QUILL
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
                [{ header: [1, 2, 3, false] }],
                [{ list: 'ordered' }, { list: 'bullet' }],
                [{ color: [] }, { background: [] }],
                ['link'],
                ['clean']
            ]
        }
    });
}

// ============================================
// INICIALIZACIÓN PRINCIPAL
// ============================================

document.addEventListener('DOMContentLoaded', async function() {

    // 1. Editor de notas
    inicializarQuill();

    // 2. Formulario → guardarYEnviar
    const form = document.getElementById('clienteForm');
    if (form) form.addEventListener('submit', guardarYEnviar);

    // 3. Tabs
    inicializarTabs();

    // 4. Validación en tiempo real
    inicializarValidacionTiempoReal();

    // 5. Autoguardado
    inicializarAutoguardado();

    // 6. Borrador
    await cargarBorradorAutomatico();

    // 7. Info usuario en header
    if (typeof cargarInfoUsuario === 'function') await cargarInfoUsuario();

    // 8. Menú admin
    if (typeof inicializarMenuAdmin === 'function') await inicializarMenuAdmin();

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