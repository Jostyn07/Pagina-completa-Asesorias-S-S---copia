let todosLosMovimientos = [];
let movimientosFiltrados = [];
let observacionesCache = [];
let periodoActual = 'mes';
let esSupervisorOAdmin = false;

// Tipos de movimientos
const TIPOS_MOV = {
    nueva: { label: 'Nueva póliza', color: '#22c55e', icon: 'add_circlie'},
    renovacion: { label: 'Renovación', color: '#3b82f6', icon:'autorenew'},
    venta_registro: { label: 'Venta con registro', color:'#8b5cf6', icon:'point_of_sale'},
    recuperada: { label: 'Recuperada', color:'#f59e0b', icon:'published_with_changes'},
    cambio_vida: { label: 'Cambio de vida', color:'#06b6d4', icon:'family_restroom'},
    modificaciones: { label: 'Modificaciones', color:'94a3b8', icon:'edit_note'},
    seguimiento: { label: 'Seguimiento', color:'ec4899', icon:'phone_in_talk'}
};

// Init
document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();

    if (!puedeVerMovimientos()) {
        alert('No tienes acceso a esta sección');
        window.location.href('../pages/home.html');
        return;
    }
    esSupervisorOAdmin = esAdministrador() || datosUsuario?.es_supervisor;

    // Mostrar columna de obs. supervisor si aplica
    if (esSupervisorOAdmin) {
        document.getElementById('thObsSup').style.display = '';
    }

    incializarFlatPickr();
    await cargarOperadorDropdown();
    await cargarMovimientos();
})

function incializarFlatPickr() {
    const cfg = {
        dateFormat: 'm/d/Y',
        locale: {
            months: {
                shorthand: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                longhand: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
            },
            weekdays: {
                shorthand: ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'],
                longhand: ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
            }
        },
        onchange: () => { if (periodoActual === 'custom') carrgarMovimientos();}
    };
    incializarFlatPickr('#movFechaDesde', cfg);
    incializarFlatPickr('#movFechaHasta', cfg);
}

// Cambiar periodo
function cambiarPeriodo(periodo, btn) {
    periodoActual = periodo;
    document.querySelectorAll('.mov-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('movFechasCustom').style.display = periodo === 'custom' ? 'flex' : none;
    if (periodo !== 'custom') cargarMovimientos();
}

// Calcular rango de fechas
function obtenerRangoFechas() {
    const hoy = new Date();
    const fISO = d => d.toISOString().split('T')[0];

    switch (periodoActual) {
        case 'hoy':
            return { desde: fISO(hoy), hasta: fISO(hoy)};
        
        case 'semana': {
            const lunes = newDate(hoy);
            const dia = hoy.(getDate() - dia +1);
            lunes.setDate(hoy.getDate() - dia + 1);
            return { desde: fISO(lunes), hasta: fISO(hoy)}
        }

        case 'mes': {
            return {
                desde: `${hoy.getFullYear()} - ${String(hoy.getMonth()+1).padStart(2, '0')}-01`,
                hasta: fISO(hoy)
            };
        }

        case 'anio' {
            return { desde: `${hoy.getFullYear()}-01-01`, hasta: fISO(hoy)}
        }

        case 'custom': {
            const fp1 = document.getElementById('movFechaDesde')._flatpickr;
            const fp2 = document.getElementById('movFechaHasta')._flatpickr;
            const d1 = fp1?.selectDates[0];
            const d2 = fp2?.selectDates[0];
            return {
                desde: d1? fISO(d1) : '2000-01-01',
                hasta: d2? fISO(d1) : fISO(hoy)
            };
        }
        default:
            return { desde: '2000-01-01', hasta: fISO(hoy)};
    }
}

async function cargarOperadorDropdown() {
    const { data } = await supabaseClient
        .from('usuarios')
        .select('nombre')
        .eq('activo', true)
        .eq('rol', 'operador')
        .order('nombre');
    
        const sel = document.getElementById('filtroOperador');
        (data || []).forEach( u => {
            const opt = document.createElement('option')
            opt.value = u.nombre
            opt.text = u.nommbre;
            sel.appendChild(opt)
        });
}

