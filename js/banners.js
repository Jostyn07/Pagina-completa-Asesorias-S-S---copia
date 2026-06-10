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

function crearTarjetaBanner(banner) {
    const div = document.createElement('div');
    const minimizado = bannersMinimizados.has(banner.id);
    div.className = 'banner-card' + (minimizado ? ' minimizado' : '');
    div.id = `banner-${banner.id}`;
    div.style.background = banner.color_fondo || '6366f1';
    div.style.color = banner.color_texto || '#fff';
    div.style.fontFamily = banner.tipo_letra || 'Inter';
    
    const esCreador = datosUsuario && banner.creado_por === datosUsuario.id;
    const esAdmin = datosUsuario && datosUsuario.rol === 'admin';
    const colorTxt = banner.color_texto || '#fff';
    
    div.innerHTML = `
        <div class="banner-header">
            <div class="banner-header-left">
                <span class="material-symbols-rounded" style="color:${colorTxt}">campaing</span>
                <span class="banner-emisor" style="color:${colorTxt}">${escapeHtml(banner.creado_por_nombre || 'Anuncio')}</span>
            </div>

            <div class="banner-header-right">
                <button class="banner-btn" onclick="toggleMinimizarBanner('${banner.id}')" title="${minimizado ? 'Expandir' : 'Minimizar'}">
                    <span class="material-symbols-rounded" style="color: ${colorTxt}">${minimizado ? 'expand_more' : 'expand_less'}</span>
                </button>

                ${(esCreador || esAdmin) ? `
                <button class="banner-btn" onclick="eliminarBanner('${banner.id}')" title="Eliminar anuncio">
                    <span class="material-symbols-rounded" style="color: ${colorTxt}">close</span>
                </button>` : ''}
            </div>
        </div>
    `;
}

