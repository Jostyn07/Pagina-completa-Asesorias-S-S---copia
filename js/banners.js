let bannersActivos = [];
let bannersMinimizados = new Set();
let bannerCheckTimers = null;
let todosLosOperadores = [];
let operadoresSeleccionados = new Set();
let audienciaSeleccionada = 'global';
let fuenteSeleccionada = 'Inter';
let colorFondoSeleccionado = '#6366f1';
let colorTextoSeleccionado = '#ffffff';

// ============================================
// PERSISTENCIA DE MINIMIZADOS — localStorage
// Duración: 30 minutos
// ============================================
const BANNER_LS_KEY    = 'ss_banners_minimizados';
const BANNER_LS_EXPIRY = 30 * 60 * 1000; // 30 min en ms

/**
 * Guarda el estado actual de bannersMinimizados en localStorage.
 * Cada entrada almacena el timestamp de cuando fue minimizada.
 */
function guardarMinimizadosLS() {
    try {
        const ahora = Date.now();
        // Leer el objeto existente (puede tener entradas de otros banners)
        const existing = JSON.parse(localStorage.getItem(BANNER_LS_KEY) || '{}');

        // Agregar / actualizar solo los que están en el Set actual
        bannersMinimizados.forEach(id => {
            // Si ya existía, conservar el timestamp original (no resetear el timer)
            if (!existing[id]) {
                existing[id] = ahora;
            }
        });

        // Eliminar del objeto los que ya NO están en el Set (se expandieron)
        Object.keys(existing).forEach(id => {
            if (!bannersMinimizados.has(id)) {
                delete existing[id];
            }
        });

        localStorage.setItem(BANNER_LS_KEY, JSON.stringify(existing));
    } catch (e) {
        console.warn('No se pudo guardar estado de banners en localStorage:', e);
    }
}

/**
 * Carga bannersMinimizados desde localStorage,
 * ignorando las entradas que hayan expirado (> 30 min).
 * Limpia automáticamente las expiradas.
 */
function cargarMinimizadosLS() {
    try {
        const stored = JSON.parse(localStorage.getItem(BANNER_LS_KEY) || '{}');
        const ahora  = Date.now();
        let   huboLimpieza = false;

        bannersMinimizados = new Set();

        Object.entries(stored).forEach(([id, timestamp]) => {
            if (ahora - timestamp < BANNER_LS_EXPIRY) {
                // Aún válido → restaurar
                bannersMinimizados.add(id);
            } else {
                // Expirado → limpiar
                delete stored[id];
                huboLimpieza = true;
            }
        });

        if (huboLimpieza) {
            localStorage.setItem(BANNER_LS_KEY, JSON.stringify(stored));
        }
    } catch (e) {
        console.warn('No se pudo leer estado de banners desde localStorage:', e);
        bannersMinimizados = new Set();
    }
}

/**
 * Elimina una entrada específica del localStorage
 * (se llama cuando se elimina un banner).
 */
function eliminarMinimizadoLS(id) {
    try {
        const stored = JSON.parse(localStorage.getItem(BANNER_LS_KEY) || '{}');
        delete stored[id];
        localStorage.setItem(BANNER_LS_KEY, JSON.stringify(stored));
    } catch (e) {
        console.warn('Error limpiando localStorage de banner:', e);
    }
}

// Inicialización

function esperarUsuarioEIniciarBanners(intentos = 0) {
    if (datosUsuario) {
        iniciarBanners();
        return;
    }

    if (intentos > 30) return; //Maximo 3 segundos
    setTimeout(() => esperarUsuarioEIniciarBanners(intentos + 1), 100);
}

async function iniciarBanners() {
    cargarMinimizadosLS(); // ← restaurar minimizados antes de renderizar
    await cargarBannerActivo();
    iniciarCheckExpiracion();
    suscribirBannersRealtime();
}

async function cargarBannerActivo() {
    if (!datosUsuario) return;

    try {
        const { data, error } = await supabaseClient
            .from('banners')
            .select('*')
            .eq('activo', true)
            .order('fecha_inicio', { ascending: true });

        if (error) throw error;

        bannersActivos = ( data || []).filter(b => bannerAplicaAlUsuario(b));
        renderizarBanners();
        actualizarBadgeBanners(bannersActivos.length);
    } catch (err) {
        console.error('Error cargando banners: ', err);
    }
}

function bannerAplicaAlUsuario(banner) {
    if (banner.audiencia === 'global') return true;
    
    if (banner.audiencia === 'seleccionados') {
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
        verificarYSonarBanner(banner.id);
    });
}

function crearTarjetaBanner(banner) {
    const div = document.createElement('div');
    const minimizado = bannersMinimizados.has(banner.id);
    div.className = 'banner-card' + (minimizado ? ' minimizado' : '');
    div.id = `banner-${banner.id}`;
    div.style.background = banner.color_fondo || '#6366f1';
    div.style.color = banner.color_texto || '#ffffff';
    div.style.fontFamily = banner.tipo_letra || 'Inter';
    
    const esCreador = datosUsuario && banner.creado_por === datosUsuario.id;
    const colorTxt = banner.color_texto || '#ffffff';
    
    div.innerHTML = `
        <div class="banner-header">
            <div class="banner-header-left">
                <span class="material-symbols-rounded" style="color:${colorTxt}; font-family:'Material Symbols Rounded'">campaign</span>
                <span class="banner-emisor" style="color:${colorTxt}">${escapeHtml(banner.creado_por_nombre || 'Anuncio')}</span>
            </div>

            <div class="banner-header-right">
                <button class="banner-btn" onclick="toggleMinimizarBanner('${banner.id}')" title="${minimizado ? 'Expandir' : 'Minimizar'}">
                    <span class="material-symbols-rounded" style="color: ${colorTxt}; font-family:'Material Symbols Rounded';">${minimizado ? 'expand_more' : 'expand_less'}</span>
                </button>

                ${(esCreador) ? `
                <button class="banner-btn" onclick="eliminarBanner('${banner.id}')" title="Eliminar anuncio">
                    <span class="material-symbols-rounded" style="color: ${colorTxt}; font-family:'Material Symbols Rounded'">close</span>
                </button>` : ''}
            </div>
        </div>

        <div class="banner-body">
            <p class="banner-mensaje" style="color:${colorTxt}">
                    ${escapeHtml(banner.mensaje)}
            </p>
            <div class="banner-footer" style="color:${colorTxt}">
                <span class="banner-tiempo">
                    <span class="material-symbols-rounded" style="font-family:'Material Symbols Rounded'">schedule</span>
                    ${calcularTiempoRestante(banner.fecha_fin)}
                </span>
                <span>${banner.audiencia === 'global' ? 'Para todos' : 'Mensaje personal'}</span>
            </div>
        </div>
    `;

    return div;
}

function calcularTiempoRestante(fechaFin) {
    const diffMs = new Date(fechaFin) - new Date();
    if (diffMs <= 0) {
        // Disparar limpieza inmediata sin esperar el intervalo
        setTimeout(() => cargarBannerActivo(), 1500);
        return 'Expirando...';
    }
    const diffMin = Math.floor(diffMs / 60000);
    const diffHoras = Math.floor(diffMin / 60);
    const diffDias = Math.floor(diffHoras / 24);

    if (diffDias > 0) return `${diffDias}d ${diffHoras % 24}h restantes`;
    if (diffHoras > 0) return `${diffHoras}h ${diffMin % 60}m restantes`;
    return `${diffMin}m restantes`;
}

function reproducirSonidoBanner() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Nota 1
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.frequency.setValueAtTime(520, ctx.currentTime);
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.3);

        // Nota 2 (más alta, medio segundo después)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(680, ctx.currentTime + 0.18);
        gain2.gain.setValueAtTime(0.0001, ctx.currentTime + 0.18);
        gain2.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.28);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc2.start(ctx.currentTime + 0.18);
        osc2.stop(ctx.currentTime + 0.55);

    } catch (err) {
        console.warn('No se pudo reproducir sonido:', err);
    }
}

function verificarYSonarBanner(bannerId) {
    const key = 'banners_sonados';
    const sonados = JSON.parse(sessionStorage.getItem(key) || '[]');

    if (sonados.includes(bannerId)) return; // Ya sonó en esta sesión

    sonados.push(bannerId);
    sessionStorage.setItem(key, JSON.stringify(sonados));
    reproducirSonidoBanner();
}

// Minimizar y expandir

function toggleMinimizarBanner(id) {
    if (bannersMinimizados.has(id)) {
        bannersMinimizados.delete(id);
    } else {
        bannersMinimizados.add(id);
    }
    guardarMinimizadosLS(); // ← persistir cambio
    renderizarBanners();
}

async function  eliminarBanner(id) {
    if (!confirm('¿Eliminar este anuncio?')) return;

    try {
        const { error } = await supabaseClient
            .from('banners')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;

        bannersActivos = bannersActivos.filter(b => b.id !== id);
        bannersMinimizados.delete(id);
        eliminarMinimizadoLS(id); // ← limpiar localStorage
        renderizarBanners();
        actualizarBadgeBanners(bannersActivos.length);
    } catch (err) {
        console.error('Error eliminando banner', err);
    }
}

// Verificar expansion cada minuto

function iniciarCheckExpiracion() {
    if (bannerCheckTimers) clearInterval(bannerCheckTimers);
    bannerCheckTimers = setInterval(async () => {
        const ahora = new Date();

        // Limpiar entradas expiradas del localStorage en cada ciclo
        cargarMinimizadosLS();

        const expirados = bannersActivos.filter(b => new Date(b.fecha_fin) <= ahora)

        if (expirados.length > 0) {
            for (const b of expirados) {
                await supabaseClient
                    .from('banners')
                    .update({ activo: false })
                    .eq('id', b.id);
            }
            await cargarBannerActivo();
        } else {
            renderizarBanners();
        }
    }, 60000);
}

// Realtime

function suscribirBannersRealtime() {
    supabaseClient
        .channel('banners-realtime')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'banners'
        }, () => {
            cargarBannerActivo();
        })
        .subscribe();
}

// Modal de creacion

async function abrirGestorBanners() {
    cerrarFAB();

    // Reset estado del modal
    operadoresSeleccionados = new Set();
    audienciaSeleccionada = 'global';
    fuenteSeleccionada = 'Inter';
    colorFondoSeleccionado = '#6366f1'
    colorTextoSeleccionado = '#ffffff'

    await cargarOperadoresParaBanner();

    const overlay = document.createElement('div');
    overlay.className = 'banner-modal-overlay';
    overlay.id = 'bannerModalOverlay';

    overlay.innerHTML = `
        <div class="banner-modal" id="bannerModal">
            <div class="banner-modal-header">
                <div class="banner-modal-titulo">
                    <span class="material-symbols-rounded" style="font-family:'Material Symbols Rounded'">campaign</span>
                    Nuevo Anuncio
                </div>

                <button class="banner-modal-cerrar" onclick="cerrarGestorBanners()">
                    <span class="material-symbols-rounded" style="font-family:'Material Symbols Rounded'">close</span>
                </button>
            </div>

            <div class="banner-modal-body">
                <!-- Info si hay banner global activo -->
                    <div id="bannerActivoInfo"></div>
            
                <!-- Mensaje de error -->
                <div class="banner-error" id="bannerError">
                    <span class="material-symbols-rounded" style="font-family:'Material Symbols Rounded'">error</span>
                    <span id="bannerErrorTexto"></span>
                </div>
                
                <!-- Mensaje -->
                <div class="banner-campo">
                    <span class="banner-label">Mensaje</span>
                    <textarea class="banner-textarea" id="bannerMensaje" placeholder="Escribe el mensaje del anuncio..." oninput="actualizarPreviewBanner()" maxlength="300"></textarea>
                </div>
                
                <!-- Colores -->
                <div class="banner-campo">
                    <span class="banner-label">Colores</span>
                    <div class="banner-colores-row">
                        <div class="banner-color-item">
                            <span style="font-size: 0.75rem; color: var(--text-secondary)">Fondo</span>
                            <button class="banner-color-btn" onclick="document.getElementById('inputBannerFondo').click()">
                                <span class="banner-color-dot" id="dotBannerFondo" style="background:${colorFondoSeleccionado}"></span>
                                <span id="labelBannerFondo">${colorFondoSeleccionado}</span>
                            </button>
                            <input type="color" id="inputBannerFondo" class="banner-color-input" value="${colorFondoSeleccionado}" oninput="onColorBannerChange('fondo', this.value)">
                        </div>
                        <div class="banner-color-item">
                            <span style="font-size:0.75rem; color:var(--text-secondary)">Texto</span>
                            <button class="banner-color-btn" onclick="document.getElementById('inputBannerTexto').click()">
                                <span class="banner-color-dot" id="dotBannerTexto" style="background: ${colorTextoSeleccionado}"></span>
                                <span id="labelBannerTexto">${colorTextoSeleccionado}</span>
                            </button>
                            <input type="color" id="inputBannerTexto" class="banner-color-input" value="${colorTextoSeleccionado}" oninput="onColorBannerChange('texto', this.value)">
                        </div>
                    </div>
                </div>
                
                <!-- Tipo de letra -->
                <div class="banner-campo">
                    <span class="banner-label">Tipo de letra</span>
                    <div class="banner-fuentes" id="bannerFuentes">
                        <span class="banner-fuente-opcion activo" style="font-family:Inter" onclick="seleccionarFuente('Inter', this)">Normal</span>
                        <span class="banner-fuente-opcion" style="font-family: Georgia,serif" onclick="seleccionarFuente('Georgia, serif', this)">Serif</span>
                        <span class="banner-fuente-opcion" style="font-family: monospace" onclick="seleccionarFuente('monospace', this)">Mono</span>
                        <span class="banner-fuente-opcion" style="font-family: cursive" onclick="seleccionarFuente('cursive', this)">Cursiva</span>
                    </div>
                </div>

                <!-- Duración -->
                <div class="banner-campo">
                    <span class="banner-label">Duración</span>
                    <div class="banner-duracion-row">
                        <input type="number" class="banner-duracion-input"
                            id="bannerDuracion" min="1" max="1440" value="60"
                            oninput="actualizarPreviewBanner()">
                        <span class="banner-duracion-unidad">minutos</span>
                    </div>
                </div>

                <!-- Audiencia -->
                <div class="banner-campo">
                    <span class="banner-label">Dirigido a</span>
                    <div class="banner-audiencia-opciones">
                        <button class="banner-audiencia-btn activo"
                                id="btnAudienciaGlobal"
                                onclick="seleccionarAudiencia('global')">Todos</button>
                        <button class="banner-audiencia-btn"
                                id="btnAudienciaSeleccionados"
                                onclick="seleccionarAudiencia('seleccionados')">Seleccionar personas</button>
                    </div>
                </div>

                <!-- Lista de operadores -->
                <div class="banner-operadores-wrap" id="bannerOperadoresWrap">
                    <input type="text" class="banner-operadores-search" placeholder="Buscar operador..." oninput="filtrarOperadoresBanner(this.value)">
                    <div class="banner-operadores-lista" id="bannerOperadoresLista"></div>
                    <span class="banner-seleccionados-count" id="bannerSeleccionadosCount">0 seleccionados</span>
                </div>

                <!-- Preview -->
                <div class="banner-campo">
                    <div class="banner-preview-wrap">
                        <div class="banner-preview-label">Vista previa</div>
                        <div class="banner-preview-card" id="bannerPreviewCard"></div>
                    </div>
                </div>

            </div>

            <div class="banner-modal-footer">
                <button class="banner-btn-cancelar" onclick="cerrarGestorBanners()">
                    Cancelar
                </button>
                <button class="banner-btn-publicar" id="btnPublicarBanner" onclick="publicarBanner()">
                    <span class="material-symbols-rounded" style="font-family:'Material Symbols Rounded'">send</span>
                    Publicar anuncio
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    actualizarPreviewBanner();
    await verificarBannerGlobalActivo();
}

function cerrarGestorBanners(){
    document.getElementById('bannerModalOverlay')?.remove();
}

// Controles del modal

function onColorBannerChange(tipo, valor) {
    if (tipo === 'fondo') {
        colorFondoSeleccionado = valor;
        document.getElementById('dotBannerFondo').style.background = valor;
        document.getElementById('labelBannerFondo').textContent = valor;
    } else {
        colorTextoSeleccionado = valor;
        document.getElementById('dotBannerTexto').style.background = valor;
        document.getElementById('labelBannerTexto').textContent = valor
    }

    actualizarPreviewBanner();
}

function seleccionarFuente(fuente, el) {
    fuenteSeleccionada = fuente;
    document.querySelectorAll('.banner-fuente-opcion').forEach(o => {
        o.classList.remove('activo')}
    );
    el.classList.add('activo');
    actualizarPreviewBanner();
}

function seleccionarAudiencia(tipo) {
    audienciaSeleccionada = tipo;

    document.getElementById('btnAudienciaGlobal').classList.toggle('activo', tipo === 'global');
    document.getElementById('btnAudienciaSeleccionados').classList.toggle('activo', tipo === 'seleccionados');

    const wrap = document.getElementById('bannerOperadoresWrap');
    if (tipo === 'seleccionados') {
        wrap.classList.add('visible');
        renderizarOperadoresBanner(todosLosOperadores);
    } else {
        wrap.classList.remove('visible');
        operadoresSeleccionados = new Set();
    }

    actualizarPreviewBanner();
}

function filtrarOperadoresBanner(texto) {
    const filtrados = todosLosOperadores.filter(op => op.nombre.toLowerCase().includes(texto.toLowerCase()));
    renderizarOperadoresBanner(filtrados);
}

function renderizarOperadoresBanner(lista) {
    const contenedor = document.getElementById('bannerOperadoresLista');
    if (!contenedor) return;

    contenedor.innerHTML = lista.map(op => `
        <label class="banner-operador-item">
            <input type="checkbox" value="${op.id}" ${operadoresSeleccionados.has(op.id) ? 'checked' : ''} onchange="toggleOperadorBanner('${op.id}')"> ${escapeHtml(op.nombre)}
        </label>
    `).join('');
}

function toggleOperadorBanner(id) {
    if (operadoresSeleccionados.has(id)) {
        operadoresSeleccionados.delete(id);
    } else {
        operadoresSeleccionados.add(id);
    }

    actualizarContadorSeleccionados();
    actualizarPreviewBanner();
}

function actualizarContadorSeleccionados() {
    const count = operadoresSeleccionados.size;
    const el = document.getElementById('bannerSeleccionadosCount');
    if (!el) return;

    const todosSeleccionados = todosLosOperadores.length > 0 && count >= todosLosOperadores.length;

    el.textContent = todosSeleccionados ? 'Seleccionaste a todos - usa la opción "Todos"' : `${count} seleccionado${count !== 1 ? 's' : ''}`;
    el.classList.toggle('limit', todosSeleccionados);
}

function actualizarPreviewBanner() {
    const preview = document.getElementById('bannerPreviewCard');
    if (!preview) return;

    const mensaje = document.getElementById('bannerMensaje')?.value || 'Tu mensaje aquí...'
    const duracion = document.getElementById('bannerDuracion')?.value || 60;
    const ctxt = colorTextoSeleccionado;

    preview.style.backgroundColor = colorFondoSeleccionado;
    preview.style.color = ctxt;
    preview.style.fontFamily = fuenteSeleccionada;


    preview.innerHTML = `
        <div class="banner-header" style="background: rgba(0,0,0,0.15); padding:8px 12px;">
            <div class="banner-header-left">
                <span class="material-symbols-rounded" style="font-size: 16px; color:${ctxt}; font-family:'Material Symbols Rounded'">campaign</span>
                <span class="banner-emisor" style="color:${ctxt}">
                    ${escapeHtml(datosUsuario?.nombre || 'Tú')}
                </span>
            </div>
        </div>

        <div class="banner-body" style="padding:8px 12px;">
            <p class="banner-mensaje" style="color:${ctxt}; font-family:${fuenteSeleccionada}">
                ${escapeHtml(mensaje)}
            </p>
            <div class="banner-footer" style="color:${ctxt}">
                <span class="banner-tiempo">
                    <span class="material-symbols-rounded" style="font-family:'Material Symbols Rounded'">schedule</span>
                    ${duracion} min de duración
                </span>
            </div>    
        </div>
    `;
}

// Validación
async function verificarBannerGlobalActivo() {
    try {
        const { data, error } = await supabaseClient
            .from('banners')
            .select('id, creado_por, creado_por_nombre, audiencia')
            .eq('activo', true)
            .eq('audiencia', 'global')
            .limit(1);

        if (error) throw error;

        const infoEl = document.getElementById('bannerActivoInfo');
        if (!infoEl || !data || data.length === 0) return;
        
        const b = data [0]
        const esCreador = b.creado_por === datosUsuario?.id

        infoEl.innerHTML = `
            <div style="background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; padding: 10px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 4px;"> 
                <span class="material-symbols-rounded" style="font-size: 17px; flex-shrink: 0; font-family:'Material Symbols Rounded'">info</span>
                Hay un banner global activo de <strong style="margin: 0 3px;">${escapeHtml(b.creado_por_nombre)}</strong>
                ${esCreador ? 'Puede eliminarlo desde la pantalla' : ''}
                Solo puedes enviar a maximo 5 personas.
            </div>
        `;
    } catch (err) {
        console.error('Error verificando banner global: ', err);
    }
}

// Publicar

async function publicarBanner() {
    const mensaje = document.getElementById('bannerMensaje')?.value?.trim();
    const duracion = parseInt(document.getElementById('bannerDuracion')?.value);

    if (!mensaje) {
        mostrarErrorBanner('Elmensaje no puede estar vacio')
        return;
    }

    if (!duracion || duracion < 1) {
        mostrarErrorBanner('La duracion debe ser al menos de 1 minuto');
        return
    }

    if (audienciaSeleccionada === 'seleccionados' && operadoresSeleccionados.size === 0) {
        mostrarErrorBanner('Selecciona al menos un operador.');
        return
    } 

    // Bloquear si selecciono a todos
    if (audienciaSeleccionada === 'seleccionados' && todosLosOperadores.length > 0 && operadoresSeleccionados.size >= todosLosOperadores.length) {
        mostrarErrorBanner('Seleccionaste a todos. Usa la opcion "Todos" en su lugar.');
        return
    }

    // Verificar banner globales activos
    const { data: globalesActivos } = await supabaseClient
        .from('banners')
        .select('id')
        .eq('activo', true)
        .eq('audiencia', 'global')
        .limit(1);

    const hayGlobal = globalesActivos && globalesActivos.length > 0;

    // No dos banners globales
    if (audienciaSeleccionada === 'global' && hayGlobal) {
        mostrarErrorBanner('Ya hay un banner global activo. Espera a que expire o eliminalo primero.');
        return
    }

    // Con banner global activo, maximo 5 destinatarios
    if (hayGlobal && audienciaSeleccionada === 'seleccionados' && operadoresSeleccionados.size > 5) {
        mostrarErrorBanner('con un banner global activo solo puedes enviar a máximo 5 personas.');
        return;
    }

    // Publicar
    const btnPublicar = document.getElementById('btnPublicarBanner');
    btnPublicar.disabled = true;
    btnPublicar.textContent = 'Publicando...';

    try {
        const ahora = new Date();
        const fechaFin = new Date(ahora.getTime() + duracion * 60000);

        const { error } = await supabaseClient
            .from('banners')
            .insert({
                mensaje,
                color_fondo: colorFondoSeleccionado,
                color_texto: colorTextoSeleccionado,
                tipo_letra: fuenteSeleccionada,
                creado_por: datosUsuario.id,
                creado_por_nombre: datosUsuario.nombre || datosUsuario.email,
                audiencia: audienciaSeleccionada,
                operadores_destino: audienciaSeleccionada === 'seleccionados' ? [...operadoresSeleccionados] : [],
                duracion_minutos: duracion,
                fecha_inicio: ahora.toISOString(),
                fecha_fin: fechaFin.toISOString(),
                activo: true
            });

        if (error) throw error;

        cerrarGestorBanners();
        await cargarBannerActivo();
    } catch (err) {
        console.error('Error publicando banner: ', err);
        btnPublicar.disabled = false;
        btnPublicar.innerHTML = `
            <span class="material-symbols-rounded" style="font-family:'Material Symbols Rounded'">send</span>
            publicar anuncio
        `;
    }
}

function mostrarErrorBanner(texto) {
    const el = document.getElementById('bannerError');
    const textoEl = document.getElementById('bannerErrorTexto');
    if (!el || !textoEl) return;
    textoEl.textContent = texto;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 5000);
}

// Cargar operadores
async function cargarOperadoresParaBanner() {
    try {
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('id, nombre')
            .eq('activo', true)
            .neq('id', datosUsuario.id)
            .order('nombre')

        if (error) throw error;
        todosLosOperadores = data || [];
    } catch (err) {
        console.error('Error cargando operadores: ', err);
        todosLosOperadores = [];
    }
}

if (typeof escapeHtml === 'undefined') {
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

// Arranque
document.addEventListener('DOMContentLoaded', () => {
    esperarUsuarioEIniciarBanners();
});