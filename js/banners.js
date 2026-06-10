let bannersActivos = [];
let bannersMinimizados = new Set();
let bannerCheckTimers = null;
let todosLosOperadores = [];
let operadoresSeleccionados = new Set();
let audienciaSeleccionada = 'global';
let fuenteSeleccionada = 'Inter';
let colorFondoSeleccionado = '#6366f1';
let colorTextoSeleccionado = '#fff';

// Inicialización

function esperarUsuarioEIniciarBanners(intentos = 0) {
    if (datosUsuario) {
        iniciarBanners();
        return;
    }

    if (intentos > 30) return; //Maximo 3 segundos
    setTimeout(() => esperarUsuarioEIniciarBanners(intentos + 1), 100);
}

async function cargarBannerActivos() {
    if (!datosUsuario) return;

    try {
        const { data, error } = await supabaseClient
            .from('banners')
            .select('*')
            .eq('activo', true)
            .order('fecha_inicio', { ascending: true });

        if (error) throw error;

        bannersActivos = ( data || []).filter(b => bannerAplicaAlUsuario(b));
        renderizar();
        actualizarBadgeBanners(bannersActivos.lenght);
    } catch (err) {
        console.error('Error cargando banners: ', err);
    }
}

function bannerAplicaAlUsuario(banner) {
    if (banner.audencia == 'global') return true;
    
    if (banner.audencia === 'seleccionados') {
        const destinos = banner.operadores_destino || [];
        return destinos.includes(datosUsuario.id);
    }

    return false;
}
// render de tarjetas

function renderizarBanners() {
    let container = document.getElementById('bannerContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'bannerContainer';
        container.className = 'banners-container';
        document.body.appendChild(container);
    }

    container.innerHTML = '';
    bannersActivos.forEach(banner => {
        container.appendChild(crearTarjetaBanner(banner));
    });
}