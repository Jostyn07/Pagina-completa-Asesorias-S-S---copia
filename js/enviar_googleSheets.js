// ============================================
// CONFIGURACIÓN
// ============================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxKTFxk3D20mdGeHjNEyJgytgMXJo3rPPG2JBUuH0n8HKqes2BNE-VrTC_H3a1iIgTu/exec';

// ============================================
// ENVIAR A GOOGLE SHEETS
// ============================================

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

        await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        return { success: true, message: 'Datos enviados correctamente' };

    } catch (error) {
        console.error('❌ Error al enviar a Google Sheets:', error);
        return { success: false, message: error.message };
    }
}

// ============================================
// BORRADOR - ENVÍO AUTOMÁTICO CADA 30 SEGUNDOS
// ============================================

let intervaloBorrador = null;

function iniciarGuardadoBorrador(pagina, obtenerDatos) {
    detenerGuardadoBorrador();

    // Guardar inmediatamente al iniciar
    enviarBorrador(pagina, obtenerDatos);

    // Luego cada 30 segundos
    intervaloBorrador = setInterval(() => {
        enviarBorrador(pagina, obtenerDatos);
    }, 30000);
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

        await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`✅ Borrador guardado - ${new Date().toLocaleTimeString()}`);

    } catch (error) {
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