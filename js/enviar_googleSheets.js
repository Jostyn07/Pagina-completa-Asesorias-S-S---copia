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
            nombreOperador: datosFormulario.nombreOperador || '',
            fecha: datosFormulario.fecha || new Date().toISOString().split('T')[0],
            tipoVenta: datosFormulario.tipoVenta || '',
            clave: datosFormulario.clave || '',
            parentesco: datosFormulario.parentesco || '',
            nombre: datosFormulario.nombre || '',
            apellidos: datosFormulario.apellidos || '',
            sexo: datosFormulario.sexo || '',
            correo: datosFormulario.correo || '',
            telefono1: datosFormulario.telefono1 || '',
            telefono2: datosFormulario.telefono2 || '',
            fechaNacimiento: datosFormulario.fechaNacimiento || '',
            estatus: datosFormulario.estatus || '',
            social: datosFormulario.social || '',
            ingresos: datosFormulario.ingresos || '',
            ocupacion: datosFormulario.ocupacion || '',
            nacionalidad: datosFormulario.nacionalidad || '',
            aplica: datosFormulario.aplica || '',
            cantidadDependientes: datosFormulario.cantidadDependientes || '',
            direccion: datosFormulario.direccion || '',
            compania: datosFormulario.compania || '',
            plan: datosFormulario.plan || '',
            creditoFiscal: datosFormulario.creditoFiscal || '',
            prima: datosFormulario.prima || '',
            link: datosFormulario.link || '',
            observacion: datosFormulario.observacion || ''
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
        console.log('✅ Datos enviados a Google Sheets');
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
    // console.log(`${tipo.toUpperCase()}: ${mensaje}`);
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

/**
 * Si ya tienes una función que maneja el envío del formulario,
 * simplemente agrega esta línea al final:
 */

// await enviarAGoogleSheets(tusDatos);

/**
 * Ejemplo:
 * 
 * async function guardarCliente() {
 *     // Tu código actual para guardar en Supabase
 *     const resultado = await supabase.table('clientes').insert(datos);
 *     
 *     // AGREGAR: Enviar también a Google Sheets
 *     await enviarAGoogleSheets(datos);
 *     
 *     // Resto de tu código...
 * }
 */