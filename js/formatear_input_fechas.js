// ============================================
// FORMATEO AUTOMÁTICO DE FECHAS EN INPUTS
// Formato: MM/DD/YYYY mientras escribe
// ============================================

/**
 * Inicializar formateo automático en todos los inputs de fecha
 */
function inicializarFormateoFechas() {
    // Buscar todos los inputs con clase 'fecha-input' o type='text' con data-type='date'
    const inputs = document.querySelectorAll('input[data-type="date"], input.fecha-input');
    
    inputs.forEach(input => {
        // Configurar placeholder
        if (!input.placeholder) {
            input.placeholder = 'MM/DD/YYYY';
        }
        
        // Agregar evento de input
        input.addEventListener('input', function(e) {
            formatearFechaMientrasEscribe(e.target);
        });
        
        // Agregar evento de blur para validar
        input.addEventListener('blur', function(e) {
            validarFechaCompleta(e.target);
        });
        
        // Prevenir pegar texto mal formateado
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const texto = (e.clipboardData || window.clipboardData).getData('text');
            const fechaLimpia = limpiarYFormatearFecha(texto);
            e.target.value = fechaLimpia;
            formatearFechaMientrasEscribe(e.target);
        });
    });
    
    console.log(`✅ Formateo automático activado en ${inputs.length} campos de fecha`);
}

/**
 * Formatear fecha mientras el usuario escribe
 */
function formatearFechaMientrasEscribe(input) {
    let valor = input.value;
    
    // Remover todo lo que no sea número
    valor = valor.replace(/\D/g, '');
    
    // Limitar a 8 dígitos (MMDDYYYY)
    if (valor.length > 8) {
        valor = valor.substring(0, 8);
    }
    
    // Aplicar formato MM/DD/YYYY
    let valorFormateado = '';
    
    if (valor.length > 0) {
        // Agregar mes (máximo 12)
        let mes = valor.substring(0, 2);
        if (parseInt(mes) > 12) {
            mes = '12';
        }
        valorFormateado = mes;
    }
    
    if (valor.length >= 3) {
        // Agregar día (máximo 31)
        let dia = valor.substring(2, 4);
        if (parseInt(dia) > 31) {
            dia = '31';
        }
        valorFormateado += '/' + dia;
    }
    
    if (valor.length >= 5) {
        // Agregar año
        valorFormateado += '/' + valor.substring(4, 8);
    }
    
    // Actualizar valor
    input.value = valorFormateado;
    
    // Agregar clase de válido/inválido
    if (valorFormateado.length === 10) {
        input.classList.add('fecha-completa');
    } else {
        input.classList.remove('fecha-completa');
    }
}

/**
 * Validar fecha completa cuando el usuario sale del campo
 */
function validarFechaCompleta(input) {
    const valor = input.value;
    
    // Si está vacío, remover clases
    if (!valor) {
        input.classList.remove('fecha-valida', 'fecha-invalida', 'fecha-completa');
        return;
    }
    
    // Verificar formato completo (MM/DD/YYYY)
    if (valor.length !== 10) {
        input.classList.add('fecha-invalida');
        input.classList.remove('fecha-valida');
        mostrarError(input, 'Fecha incompleta. Formato: MM/DD/YYYY');
        return;
    }
    
    // Validar fecha real
    const partes = valor.split('/');
    const mes = parseInt(partes[0]);
    const dia = parseInt(partes[1]);
    const anio = parseInt(partes[2]);
    
    // Validaciones básicas
    if (mes < 1 || mes > 12) {
        input.classList.add('fecha-invalida');
        input.classList.remove('fecha-valida');
        mostrarError(input, 'Mes inválido (01-12)');
        return;
    }
    
    if (dia < 1 || dia > 31) {
        input.classList.add('fecha-invalida');
        input.classList.remove('fecha-valida');
        mostrarError(input, 'Día inválido (01-31)');
        return;
    }
    
    if (anio < 1900 || anio > 2100) {
        input.classList.add('fecha-invalida');
        input.classList.remove('fecha-valida');
        mostrarError(input, 'Año inválido (1900-2100)');
        return;
    }
    
    // Validar fecha real (días por mes)
    const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    // Año bisiesto
    if ((anio % 4 === 0 && anio % 100 !== 0) || (anio % 400 === 0)) {
        diasPorMes[1] = 29;
    }
    
    if (dia > diasPorMes[mes - 1]) {
        input.classList.add('fecha-invalida');
        input.classList.remove('fecha-valida');
        mostrarError(input, `${obtenerNombreMes(mes)} solo tiene ${diasPorMes[mes - 1]} días`);
        return;
    }
    
    // Fecha válida
    input.classList.add('fecha-valida');
    input.classList.remove('fecha-invalida');
    removerError(input);
}

/**
 * Limpiar y formatear fecha pegada
 */
function limpiarYFormatearFecha(texto) {
    // Remover todo lo que no sea número
    let numeros = texto.replace(/\D/g, '');
    
    // Si tiene más de 8 dígitos, tomar solo los primeros 8
    if (numeros.length > 8) {
        numeros = numeros.substring(0, 8);
    }
    
    return numeros;
}

/**
 * Mostrar mensaje de error
 */
function mostrarError(input, mensaje) {
    // Buscar contenedor de error existente
    let errorDiv = input.parentElement.querySelector('.fecha-error');
    
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'fecha-error';
        input.parentElement.appendChild(errorDiv);
    }
    
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
}

/**
 * Remover mensaje de error
 */
function removerError(input) {
    const errorDiv = input.parentElement.querySelector('.fecha-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

/**
 * Obtener nombre del mes
 */
function obtenerNombreMes(mes) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes - 1];
}

/**
 * Convertir MM/DD/YYYY a YYYY-MM-DD para guardar en BD
 */
function convertirFechaParaBD(fechaUSA) {
    if (!fechaUSA || fechaUSA.length !== 10) return null;
    
    const partes = fechaUSA.split('/');
    const mes = partes[0].padStart(2, '0');
    const dia = partes[1].padStart(2, '0');
    const anio = partes[2];
    
    return `${anio}-${mes}-${dia}`;
}

/**
 * Convertir YYYY-MM-DD (BD) a MM/DD/YYYY para mostrar
 */
function convertirFechaParaMostrar(fechaBD) {
    if (!fechaBD) return '';
    
    const partes = fechaBD.split('-');
    if (partes.length !== 3) return '';
    
    const mes = partes[1];
    const dia = partes[2];
    const anio = partes[0];
    
    return `${mes}/${dia}/${anio}`;
}

// ============================================
// INICIALIZAR AL CARGAR LA PÁGINA
// ============================================
document.addEventListener('DOMContentLoaded', inicializarFormateoFechas);

// Si la página ya está cargada (cuando se inserta el script dinámicamente)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(inicializarFormateoFechas, 100);
}