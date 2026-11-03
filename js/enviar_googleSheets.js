// ============================================
// Ruta en el repo: js/enviar_googleSheets.js
// CONFIGURACIÓN
// ============================================
const GOOGLE_SHEETS_URL_EVELYN_MORILLO = 'https://script.google.com/macros/s/AKfycbzHI1hZBhts44n87V2I_OYm4hufTKBgR4vPkS9JwDVq2Qq9l7AC9aF30wdI9joeDwKy/exec';
const GOOGLE_SHEETS_URL_OTROS_PORTALES = 'https://script.google.com/macros/s/AKfycbxdhFcO73xI4DgGoZ_kOuQ0p_jYvU4TPt6eg6VPfa8XHB6bDGkRQjpnZiapBXsfROospg/exec'
// ============================================
// ENVIAR A GOOGLE SHEETS
// ============================================

function obtenerUrlGoogleSheets(portal) {
    if (portal === 'Evelyn Morillo') {
        return GOOGLE_SHEETS_URL_EVELYN_MORILLO;
    }
    if (['Dante SY', 'Isabel SY'].includes(portal)) {
        return GOOGLE_SHEETS_URL_OTROS_PORTALES;
    }
    return null
}

async function enviarAGoogleSheets(datosFormulario) {
    try {
        const datos = {
            // CONTROL
            registradoPor:          datosFormulario.registradoPor       || datosFormulario.nombreOperador || '',
            nombreOperador:         datosFormulario.nombreOperador       || '',
            fecha:                  datosFormulario.fecha                || new Date().toISOString().split('T')[0],
            tipoVenta:              datosFormulario.tipoVenta            || '',
            tipoRegistro:           datosFormulario.tipoRegistro         || '',
            tipoModificacion:       datosFormulario.tipoModificacion     || '',
            tipoCambio:             datosFormulario.tipoCambio           || '',
            camposModificados:      datosFormulario.camposModificados    || '',
            fechaEfectiva:          datosFormulario.fechaEfectiva        || '',
            ventaRealizadaPor:      datosFormulario.ventaRealizadaPor    || '',

            // DATOS PERSONALES
            nombre:                 datosFormulario.nombre               || '',
            apellidos:              datosFormulario.apellidos            || '',
            genero:                 datosFormulario.genero               || datosFormulario.sexo || '',
            sexo:                   datosFormulario.sexo                 || datosFormulario.genero || '',
            fechaNacimiento:        datosFormulario.fechaNacimiento      || '',
            nacionalidad:           datosFormulario.nacionalidad         || '',
            aplica:                 datosFormulario.aplica               || '',

            // CONTACTO
            correo:                 datosFormulario.correo               || datosFormulario.email || '',
            email:                  datosFormulario.email                || datosFormulario.correo || '',
            telefono1:              datosFormulario.telefono1            || '',
            telefono2:              datosFormulario.telefono2            || '',

            // DIRECCIÓN
            direccion:              datosFormulario.direccion            || '',
            casaApartamento:        datosFormulario.casaApartamento      || '',
            condado:                datosFormulario.condado              || '',
            ciudad:                 datosFormulario.ciudad               || '',
            estado:                 datosFormulario.estado               || '',
            codigoPostal:           datosFormulario.codigoPostal         || '',
            poBox:                  datosFormulario.poBox                || '',

            // INFORMACIÓN LEGAL
            estatus:                datosFormulario.estatus              || '',
            social:                 datosFormulario.social               || '',

            // INFORMACIÓN LABORAL
            ingresos:               datosFormulario.ingresos             || '',
            ocupacion:              datosFormulario.ocupacion            || '',

            // PÓLIZA
            aplicantes:             datosFormulario.aplicantes           || '',
            compania:               datosFormulario.compania             || '',
            plan:                   datosFormulario.plan                 || '',
            prima:                  datosFormulario.prima                || '',
            creditoFiscal:          datosFormulario.creditoFiscal        || '',
            memberId:               datosFormulario.memberId             || '',
            claveSeguridad:         datosFormulario.claveSeguridad       || datosFormulario.clave || '',
            link:                   datosFormulario.link                 || '',
            agenteNombre:           datosFormulario.agenteNombre         || '',

            // FECHAS PÓLIZA
            fechaInicialCobertura:  datosFormulario.fechaInicialCobertura || '',
            fechaFinalCobertura:    datosFormulario.fechaFinalCobertura   || '',

            // DEPENDIENTES
            cantidadDependientes:   datosFormulario.cantidadDependientes || (datosFormulario.dependientes || []).length || '',
            dependientes:           datosFormulario.dependientes         || [],
        };

        const url = obtenerUrlGoogleSheets(datosFormulario.portal);

        if (!url) {
            console.warn('Borrador no guradado: portal seleccionado todavía.')
            return;
        }

        // El envío final no espera a que termine ningún borrador
        detenerGuardadoBorrador();

        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(datos)
        });

        return { success: true, message: 'Datos enviados correctamente' };

    } catch (error) {
        console.error('❌ Error al enviar a Google Sheets:', error);
        return { success: false, message: error.message };
    }
}

// ============================================
// BORRADOR - cada 60 s, y SOLO si el formulario cambió desde el último envío
// (antes: cada 30 s siempre, aunque nadie hubiera escrito nada)
// ============================================

let intervaloBorrador = null;
let ultimoBorradorEnviado = '';

function iniciarGuardadoBorrador(pagina, obtenerDatos) {
    detenerGuardadoBorrador();
    ultimoBorradorEnviado = '';

    // Guardar inmediatamente al iniciar
    enviarBorrador(pagina, obtenerDatos);

    // Luego cada 60 segundos (si hubo cambios)
    intervaloBorrador = setInterval(() => {
        if (document.hidden) return;   // pestaña en segundo plano: no se envía
        enviarBorrador(pagina, obtenerDatos);
    }, 60000);
}

function detenerGuardadoBorrador() {
    if (intervaloBorrador) {
        clearInterval(intervaloBorrador);
        intervaloBorrador = null;
    }
}

async function enviarBorrador(pagina, obtenerDatos) {
    try {
        const datos = obtenerDatos();

        // Si no hay datos mínimos, no guardar
        if (!datos.nombres && !datos.nombre && !datos.apellidos && !datos.email) return;

        // Sin cambios desde el último envío: no se manda nada
        const huella = JSON.stringify(datos);
        if (huella === ultimoBorradorEnviado) return;

        const payload = {
            ...datos,
            esBorrador:         true,
            esBorradorStr:      'true',
            pagina:             pagina,
            registradoPor:      obtenerUsuarioActual(),
            nombre:             datos.nombres  || datos.nombre  || '',
            apellidos:          datos.apellidos                 || '',
            email:              datos.email                     || '',
            telefono1:          datos.telefono1                 || '',
            compania:           datos.compania                  || '',
            plan:               datos.plan                      || '',
            prima:              datos.prima                     || '',
            estadoFormulario:   calcularEstadoFormulario(datos)
        };

        const url = obtenerUrlGoogleSheets(datos.portalCliente);

        if (!url) {
            console.warn('Borrador no guradado: portal seleccionado todavía.')
            return;
        }

        ultimoBorradorEnviado = huella;
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });

        console.log(`✅ Borrador guardado - ${new Date().toLocaleTimeString()}`);

    } catch (error) {
        ultimoBorradorEnviado = '';
        console.error('❌ Error guardando borrador:', error);
    }
}

function obtenerUsuarioActual() {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        return usuario.nombre || usuario.email || 'Desconocido';
    } catch {
        return 'Desconocido';
    }
}

function calcularEstadoFormulario(datos) {
    const camposObligatorios = [
        'nombre', 'apellidos', 'email', 'telefono1',
        'compania', 'plan', 'prima', 'direccion'
    ];

    const completados = camposObligatorios.filter(campo =>
        datos[campo] && datos[campo] !== ''
    ).length;

    const porcentaje = Math.round((completados / camposObligatorios.length) * 100);
    return `${porcentaje}% (${completados}/${camposObligatorios.length} campos)`;
}