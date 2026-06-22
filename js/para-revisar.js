let todosLosRegistros = [];
let registrosFiltrados = [];
let filtroTipoActivo = null;
let mostrarRecuperados = false;
let filtrosAvanzados = {};
let esAdmin = false;

document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();
    esAdmin = esAdministador();
    await cargarRegistros();
    configurarBuscador();
});

async function cargarRegistros() {
    try {
        mostrarCarga(true);
        
        const { data, error } = await supabaseClient
            .from('revision_mercado')
            .select('*')
            .order('fecha_ingreso', { ascending: false });

        if (error) throw error
        
        todosLosRegistros = data || [];
        aplicarFiltros();
        actualizarContadores;

    } catch (error) {
        console.error('Error al cargar registros', error)
    } finally {
        mostrarCarga(false)
    }
}

function actualizarContadores() {
    const activos = todosLosRegistros.filter(r => r.recuperado !== 'Si');
    
    const robadas = activos.filter(r => r.estado_mercado === 'Robado').length;
    const canceladas = activos.filter(r => r.estado_mercado === 'Cancelado').length;
    const dobles = activos.filter(r => r.estado_mercado === 'Doble poliza').length
    const triples = activos.filter(r => r.estado_mercado === 'Triple poliza').length
    const noRegistran = activos.filter(r => r.estado_mercado === 'No registra').length

    document.getElementById('polizas-robadas').textContent = robadas;
    document.getElementById('polizas-canceladas-revision').textContent = canceladas;
    document.getElementById('polizas-dobles').textContent = dobles;
    document.getElementById('polizas-triples').textContent = triples;
    document.getElementById('polizas-no-registran').textContent = textContent
}

function filtrarPorTipo(tipo) {
    if (filtroTipoActivo === tipo) {
        filtroTipoActivo = null;
        document.querySelectorAll('.inf__cuadro').forEach(c => c.classList.remove('inf__cuadro--activo'))
    } else {
        filtroTipoActivo = tipo;
        document.querySelectorAll('.inf__cuadro').forEach(c => c.classList.remove('inf__cuadro-activo'));

        const idx = { robadas: 0, canceladas: 1, dobles: 2, triples: 3, 'no.registran': 4 };
        const cuadros = document.querySelectorAll('.inf__cuadro');
        if (cuadros[idx[tipo]]) cuadros[idx[tipo]].classList('inf__cuadro--activo');
    }
}