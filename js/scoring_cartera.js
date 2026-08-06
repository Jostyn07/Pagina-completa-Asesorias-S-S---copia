const CARTERA_NOMBRES_MESES = [
    'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'
]

function carteraEstadoMesPagado(valor) {
    const v = (valor || '').toLowerCase();
    return v.includes('si') && !v.includes('no');
}

function carteraContarMesesPagoPendiente(metodosPagoCliente, fechaEfectividad) {
    if (!metodosPagoCliente) return 0;

    const limiteYM = fechaEfectividad ? parsearFechaComoYM(fechaEfectividad) : null;

    const hoy = new Date();
    let cursorYM = hoy.getFullYear() * 12 + hoy.getMonth();

    if (hoy.getDate() >= 15) {
        cursorYM += 1
    }

    let consecutivos = 0;

    for (let i = 0; i < 12; i++) {
        if (limiteYM !== null && cursorYM < limiteYM) break;

        const mesIdx = ((cursorYM % 12) + 12) % 12;
        const campo = `pago_${CARTERA_NOMBRES_MESES[mesIdx]}`;
        const valor = metodosPagoCliente[campo];

        if (carteraEstadoMesPagado(valor)) break;

        consecutivos++;
        cursorYM--;
    }

    return consecutivos;
}

function carteraPuntajePorMesesPendientes(n) {
    if (n <= 0) return 0;
    if (n === 1) return 15;
    if (n === 2) return 30;
    if (n === 3) return 60;
    return 70;
}

function carteraCalcularEdad(fechaNacimiento) {
    const hoy  = new Date();
    const nac  = new Date(fechaNacimiento);
    const años = hoy.getFullYear() - nac.getFullYear();
    const mes  = hoy.getMonth() - nac.getMonth();
    return mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())
        ? años - 1 + (12 + mes) / 12
        : años + mes / 12;
}

function calcularScoringCartera(poliza) {
    let score = 0;
    const factores = [];

    const cliente      = poliza.clientes || poliza.cliente || {};
    const seguimientos = (poliza.seguimientos || [])
        .sort((a, b) => new Date(b.fecha_seguimiento) - new Date(a.fecha_seguimiento));

    // Factor 1: Documentos pendientes / vencidos
    const docStatus = (poliza.estado_documentos || '').toLowerCase();
    const docPlazo  = poliza.fecha_plazo_documentos;
    let docDiasParaVencer = null;
 
    if (docStatus.includes('incompleto') || docStatus.includes('pendiente')) {
        if (docPlazo) {
            const dias = Math.ceil((new Date(docPlazo) - new Date()) / 86400000);
            docDiasParaVencer = dias
            if (dias < 0) {
                score += 35;
                factores.push('Documentos vencidos');
            } else if (dias < 15) {
                score += 30;
                factores.push(`Docs. vencen en ${dias} días`);
            } else if (dias < 30) {
                score += 20;
                factores.push(`Docs. vencen en ${dias} días`);
            } else {
                score += 10;
                factores.push('Documentos pendientes');
            }
        } else {
            score += 10;
            factores.push('Documentos incompletos');
        }
    }

    // Factor 2: Pago del mes actual
    const metodosPagoCliente = Array.isArray(cliente.metodos_pago)
        ? (cliente.metodos_pago[0] || {})
        : (cliente.metodos_pago || {});

    const primaMensual = parseFloat(poliza?.prima || 0);
    let mesesPagoPendiente = 0;

    if (primaMensual > 0) {
    mesesPagoPendiente = carteraContarMesesPagoPendiente(metodosPagoCliente, poliza.fecha_efectividad);
    const puntajePago = carteraPuntajePorMesesPendientes(mesesPagoPendiente)

        if (puntajePago > 0) {
            score += puntajePago;

            let etiquetaPago;
            if (mesesPagoPendiente === 1) {
                etiquetaPago = new Date().getDate() > 15
                    ? 'Pago del mes próximo pendiente'
                    : 'Pago del mes actual pendiente'
            } else {
                etiquetaPago = `${mesesPagoPendiente} meses de pago pendientes`
            }
            factores.push(etiquetaPago)
        }
    }

    // Factor 3: Imposible de contactar
    let imposibleContactar = false;
    let contactoSinResuesta = false;

    if (seguimientos.length >= 3) {
        const ultimos3 = seguimientos.slice(0, 3);
        if (ultimos3.every(s => s.seguimiento_efectivo === 'No')) {
            imposibleContactar = true;
            score += 25;
            factores.push('Imposible contactar (3 intentos)');
        }
    } else if (seguimientos.length > 0 && seguimientos[0].seguimiento_efectivo === 'No') {
        contactoSinResuesta = true;
        score += 10;
        factores.push('Último contacto sin respuesta');
    }

    // Factor 4: Días sin contacto
    let diasSinContacto = null;
    let sinSeguimientos = false;
    if (seguimientos.length > 0) {
        diasSinContacto = Math.floor(
            (new Date() - new Date(seguimientos[0].fecha_seguimiento)) / 86400000
        );
        if (diasSinContacto > 60) {
            score += 30;
            factores.push(`Sin contacto ${diasSinContacto} días`);
        } else if (diasSinContacto > 30) {
            score += 15;
            factores.push(`Sin contacto ${diasSinContacto} días`);
        }
    } else {
        sinSeguimientos = true;
        score += 25;
        factores.push('Sin seguimientos registrados');
    }

    // Factor 5: Palabras clave en notas (riesgo básico, antes de IA)
    const notas = seguimientos.map(s => s.observacion || '').join(' ').toLowerCase();
    const senalAbandono = /cancelar|cambiar|competencia|caro|costoso|otra agencia|no quiere|no puede pagar|quiere salir/.test(notas)
    if (senalAbandono) {
        score += 25;
        factores.push('Señales de abandono en notas');
    }

    // Factor 6: Próximo a los 65 años (Medicare)
    if (cliente.fecha_nacimiento) {
        const edad = carteraCalcularEdad(cliente.fecha_nacimiento);
        if (edad >= 64.5) {
            score += 15;
            factores.push('Próximo a Medicare (≥64.5 años)');
        }
    }

    // Factor 7: Estatus migratorio temporal
    const migStatus = (cliente.estado_migratorio || '').toLowerCase();
    if (/temporal|asilo|daca|tps|ead|otro|I-94/.test(migStatus)) {
        score += 15;
        factores.push('Estatus migratorio temporal');
    }

    // Factor 8: Ingresos inestables
    const ocupacion = (cliente.ocupacion || '').toLowerCase();
    if (/independiente|1099|temporal|desempleado|freelance/.test(ocupacion)) {
        score += 10;
        factores.push('Ingresos inestables');
    }

    const finalScore = Math.min(100, score);
    let nivel = 'verde';
    if (finalScore >= 61)      nivel = 'rojo';
    else if (finalScore >= 26) nivel = 'amarillo';

    return {
        score: finalScore,
        nivel,
        factores,
        metricas: {
            mesesPagoPendiente,
            docDiasParaVencer,
            imposibleContactar,
            contactoSinResuesta,
            diasSinContacto,
            sinSeguimientos,
            senalAbandono
        }
    };
}

// Obtener lo que se mostrara de primero
function obtenerFactorPrincipalCartera(factores, mesesPagoPendiente) {
    if (mesesPagoPendiente >= 2) {
        const f = factores.find(f => f.includes ('meses de pago pendiente'));
        if (f) return f;
    }

    const fDoc = factores.find(f => f.includes('Documentos') || f.startsWith('Docs.'))
    if (fDoc) return fDoc;

    const fSeg = factores.find(f => f.includes('seguimiento') || f.includes('contact'))
    if(fSeg) return fSeg;

    return factores[0] || null;
}