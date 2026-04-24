// ============================================
// CONFIGURACIÓN - CAMBIAR ESTA URL
// ============================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxKTFxk3D20mdGeHjNEyJgytgMXJo3rPPG2JBUuH0n8HKqes2BNE-VrTC_H3a1iIgTu/exec';

// ============================================
// FUNCIÓN PRINCIPAL PARA ENVIAR A GOOGLE SHEETS
// ============================================

/**
 * Envía los datos del formulario a Google Sheets
 * @param {Object} datosFormulario - Objeto con todos los datos del formulario
 * @returns {Promise} - Promesa que se resuelve cuando se envían los datos
 */
async function enviarAGoogleSheets(datosFormulario) {


    try {
        // Validar que la URL esté configurada
        if (GOOGLE_SHEETS_URL === 'TU_URL_DE_GOOGLE_APPS_SCRIPT_AQUI') {
            throw new Error('Debes configurar GOOGLE_SHEETS_URL con tu URL de Google Apps Script');
        }

        // Preparar los datos
        const datos = {
            // OPERADOR Y CONTROL
            nombreOperador:         datosFormulario.nombreOperador || '',
            registradoPor:          datosFormulario.registradoPor || datosFormulario.nombreOperador || '',
            fecha:                  datosFormulario.fecha || new Date().toISOString().split('T')[0],
            tipoVenta:              datosFormulario.tipoVenta || '',
            tipoRegistro:           datosFormulario.tipoRegistro || '',
            tipoModificacion:       datosFormulario.tipoModificacion || '',
            tipoCambio:             datosFormulario.tipoCambio || '',
            camposModificados:      datosFormulario.camposModificados || '',
            fechaEfectiva:          datosFormulario.fechaEfectiva || '',
            ventaRealizadaPor:      datosFormulario.ventaRealizadaPor || '',

            // DATOS PERSONALES
            nombre:                 datosFormulario.nombre || '',
            apellidos:              datosFormulario.apellidos || '',
            genero:                 datosFormulario.genero || datosFormulario.sexo || '',
            sexo:                   datosFormulario.sexo || datosFormulario.genero || '',
            fechaNacimiento:        datosFormulario.fechaNacimiento || '',
            nacionalidad:           datosFormulario.nacionalidad || '',
            aplica:                 datosFormulario.aplica || '',

            // CONTACTO
            correo:                 datosFormulario.correo || datosFormulario.email || '',
            email:                  datosFormulario.email || datosFormulario.correo || '',
            telefono1:              datosFormulario.telefono1 || '',
            telefono2:              datosFormulario.telefono2 || '',

            // DIRECCIÓN
            direccion:              datosFormulario.direccion || '',
            casaApartamento:        datosFormulario.casaApartamento || '',
            condado:                datosFormulario.condado || '',
            ciudad:                 datosFormulario.ciudad || '',
            estado:                 datosFormulario.estado || '',
            codigoPostal:           datosFormulario.codigoPostal || '',
            poBox:                  datosFormulario.poBox || '',

            // INFORMACIÓN LEGAL
            estatus:                datosFormulario.estatus || '',
            social:                 datosFormulario.social || '',

            // INFORMACIÓN LABORAL
            ingresos:               datosFormulario.ingresos || '',
            ocupacion:              datosFormulario.ocupacion || '',

            // PÓLIZA
            aplicantes:             datosFormulario.aplicantes || '',
            compania:               datosFormulario.compania || '',
            plan:                   datosFormulario.plan || '',
            prima:                  datosFormulario.prima || '',
            creditoFiscal:          datosFormulario.creditoFiscal || '',
            memberId:               datosFormulario.memberId || '',
            claveSeguridad:         datosFormulario.claveSeguridad || datosFormulario.clave || '',
            link:                   datosFormulario.link || '',
            agenteNombre:           datosFormulario.agenteNombre || '',

            // FECHAS
            fechaInicialCobertura:  datosFormulario.fechaInicialCobertura || '',
            fechaFinalCobertura:    datosFormulario.fechaFinalCobertura || '',

            // DEPENDIENTES
            cantidadDependientes:   datosFormulario.cantidadDependientes || (datosFormulario.dependientes || []).length || '',
            dependientes:           JSON.stringify(datosFormulario.dependientes || []),
        };

        // Enviar a Google Sheets
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors', // Importante para Google Apps Script
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(datos)
        });

        // Nota: Con mode 'no-cors', no podemos leer la respuesta
        // Asumimos que funcionó si no hubo error
        ;
        return { success: true, message: 'Datos enviados correctamente' };

    } catch (error) {
        console.error('❌ Error al enviar a Google Sheets:', error);
        return { success: false, message: error.message };
    }
}

// ============================================
// EJEMPLO DE USO CON UN FORMULARIO HTML
// ============================================

/**
 * Función para manejar el envío del formulario
 * Conecta esta función a tu botón de envío
 */
async function manejarEnvioFormulario(event) {
    // Prevenir envío normal del formulario
    if (event) event.preventDefault();

    // Mostrar indicador de carga
    mostrarCargando(true);

    try {
        // Obtener datos del formulario
        const datosFormulario = {
            nombreOperador: document.getElementById('nombreOperador')?.value,
            fecha: document.getElementById('fecha')?.value,
            tipoVenta: document.getElementById('tipoVenta')?.value,
            clave: document.getElementById('clave')?.value,
            parentesco: document.getElementById('parentesco')?.value,
            nombre: document.getElementById('nombre')?.value,
            apellidos: document.getElementById('apellidos')?.value,
            sexo: document.getElementById('sexo')?.value,
            correo: document.getElementById('correo')?.value,
            telefono1: document.getElementById('telefono1')?.value,
            telefono2: document.getElementById('telefono2')?.value,
            fechaNacimiento: document.getElementById('fechaNacimiento')?.value,
            estatus: document.getElementById('estatus')?.value,
            social: document.getElementById('social')?.value,
            ingresos: document.getElementById('ingresos')?.value,
            ocupacion: document.getElementById('ocupacion')?.value,
            nacionalidad: document.getElementById('nacionalidad')?.value,
            aplica: document.getElementById('aplica')?.value,
            cantidadDependientes: document.getElementById('cantidadDependientes')?.value,
            direccion: document.getElementById('direccion')?.value,
            compania: document.getElementById('compania')?.value,
            plan: document.getElementById('plan')?.value,
            creditoFiscal: document.getElementById('creditoFiscal')?.value,
            prima: document.getElementById('prima')?.value,
            link: document.getElementById('link')?.value,
            observacion: document.getElementById('observacion')?.value
        };

        // Enviar a Google Sheets
        const resultado = await enviarAGoogleSheets(datosFormulario);

        if (resultado.success) {
            mostrarMensaje('✅ Datos guardados correctamente en Google Sheets', 'success');
            
            // Opcional: Limpiar formulario
            // document.getElementById('miFormulario').reset();
        } else {
            mostrarMensaje('⚠️ Hubo un problema al guardar los datos', 'warning');
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('❌ Error al procesar el formulario', 'error');
    } finally {
        mostrarCargando(false);
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function mostrarCargando(mostrar) {
    const boton = document.getElementById('btnEnviar');
    if (boton) {
        boton.disabled = mostrar;
        boton.textContent = mostrar ? 'Enviando...' : 'Enviar';
    }
}

function mostrarMensaje(mensaje, tipo) {
    // Puedes personalizar esto según tu diseño
    alert(mensaje);
    
    // O usar un toast/notificación más elegante
    // ;
}

// ============================================
// INICIALIZACIÓN
// ============================================

// Conectar el formulario al enviarse
document.addEventListener('DOMContentLoaded', function() {
    const formulario = document.getElementById('miFormulario');
    if (formulario) {
        formulario.addEventListener('submit', manejarEnvioFormulario);
    }

    // O conectar directamente a un botón
    const botonEnviar = document.getElementById('btnEnviar');
    if (botonEnviar) {
        botonEnviar.addEventListener('click', manejarEnvioFormulario);
    }
});

// ============================================
// VERSIÓN SIMPLIFICADA (ALTERNATIVA)
// ============================================
// await enviarAGoogleSheets({
//     // OPERADOR Y CONTROL
//     registradoPor:          nombreOperador,
//     tipoCambio:             tipoCambio,
//     tipoVenta:              tipoCambio === 'recuperado' ? 'Recuperado' : 'Cambio de vida',
//     tipoModificacion:       formData.tipo_modificacion,
//     tipoRegistro:           formData.tipo_registro,
//     camposModificados,
//     fechaEfectiva:          formData.fecha_efectividad,
//     ventaRealizadaPor:      formData.venta_realizada_por,

//     // DATOS PERSONALES
//     nombreOperador:         formData.operador_nombre,
//     nombre:                 formData.nombres,
//     apellidos:              formData.apellidos,
//     genero:                 formData.genero,
//     fechaNacimiento:        formData.fecha_nacimiento,
//     nacionalidad:           formData.nacionalidad,
//     aplica:                 formData.aplica,

//     // CONTACTO
//     email:                  formData.email,
//     telefono1:              formData.telefono1,
//     telefono2:              formData.telefono2,

//     // DIRECCIÓN
//     direccion:              formData.direccion,
//     casaApartamento:        formData.casa_apartamento,
//     condado:                formData.condado,
//     ciudad:                 formData.ciudad,
//     estado:                 formData.estado,
//     codigoPostal:           formData.codigo_postal,
//     poBox:                  formData.po_box,

//     // INFORMACIÓN LEGAL
//     estatus:                formData.estado_migratorio,
//     social:                 formData.ssn,

//     // INFORMACIÓN LABORAL
//     ingresos:               formData.ingreso_anual,
//     ocupacion:              formData.ocupacion,

//     // PÓLIZA
//     aplicantes:             formData.aplicantes,
//     compania:               formData.compania,
//     plan:                   formData.plan,
//     prima:                  formData.prima,
//     creditoFiscal:          formData.credito_fiscal,
//     memberId:               formData.member_id,
//     claveSeguridad:         formData.clave_seguridad,
//     link:                   formData.enlace_poliza,
//     agenteNombre:           formData.agente_nombre,

//     // FECHAS
//     fechaInicialCobertura:  formData.fecha_inicial_cobertura,
//     fechaFinalCobertura:    formData.fecha_final_cobertura,

//     // DEPENDIENTES
//     dependientes,
// });