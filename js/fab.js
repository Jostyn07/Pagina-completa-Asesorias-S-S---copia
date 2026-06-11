let fabAbierto = false;
let fabBadgeRecordatorios = 0;
let fabBadgeBanners = 0;

// Inicialización

function iniciarFAB() {
    const container = document.createElement('div');
    container.className = 'fab-container';
    container.id = 'fabContainer';

    container.innerHTML = `
        <!-- Sub-botones (se muestran al abrir) -->
        <div class="fab-actions" id="fabActions">
            <div class="fab-action-item">
                <span class="fab-action-label">Asistente IA</span>
                <button class="fab-action-btn fab-btn-ia" onclick="abrirIA()" title="Asistente IA">
                    <span class="material-symbols-rounded">smart_toy</span>
                </button>
            </div>

            <!-- Banners -->
            <div class="fab-action-item" id="fabItemBanner" style="display:none">
                <span class="fab-action-label">Anuncios</span>
                <button class="fab-action-btn fab-btn-banners" onclick="abrirGestorBanners()" title="Anuncios">
                    <span class="material-symbols-rounded">campaign</span>
                    <span class="fab-sub-badge hidden" id="subBadgeBanners">0</span>
                </button>
            </div>

            <div class="fab-action-item">
                <span class="fab-action-label">Recordatorios</span>
                <button class="fab-action-btn fab-btn-recordatorios" onclick="abrirDrawerRecordatorios()" title="Recordatorios">
                    <span class="material-symbols-rounded">task_alt</span>
                    <span class="fab-sub-badge hidden" id="subBadgeRecordatorios">0</span>
                </button>
            </div>
        </div>

        <!-- Boton principla -->
        <button class="fab-main" id="fabMain" onclick="toggleFAB()" title="Menu">
            <span class="material-symbols-rounded">menu</span>
            <span class="fab-badge hidden" id="fabBadgeTotal">0</span>
        </button>
    `;

    document.body.appendChild(container);

    document.addEventListener('click', (e) => {
        if (fabAbierto && !container.contains(e.target)) {
            cerrarFAB()
        }
    })

    // Mostrar boton de banner segun el rol
    esperarUsuarioYVerificarFAB()
}

function toggleFAB() {
    fabAbierto ? cerrarFAB() : abrirFAB();
}

function abrirFAB() {
    fabAbierto = true;
    document.getElementById('fabContainer').classList.add('open');
    document.getElementById('fabContainer').style.zIndex = "9999";

}

function cerrarFAB() {
    fabAbierto = false;
    document.getElementById('fabContainer').classList.remove('open');
    document.getElementById('fabContainer').style.zIndex = "1";
}


// Permisos
function verificarPermisoBanner() {

    if (!datosUsuario) return;
    const puedeCrear = datosUsuario.puede_crear_banner === true || datosUsuario.rol === 'admin';


    const itemBanner = document.getElementById('fabItemBanner');
    if (itemBanner) {
        itemBanner.style.display = puedeCrear ? 'flex' : 'none';
    }
}

function esperarUsuarioYVerificarFAB(intentos = 0) {
    if (datosUsuario) {
        verificarPermisoBanner();
        return;
    }
    if (intentos > 30) return; // máximo 3 segundos
    setTimeout(() => esperarUsuarioYVerificarFAB(intentos + 1), 100);
}

// Badges
function actualizarBadgeRecordatorios(cantidad) {
    fabBadgeRecordatorios = cantidad || 0;
    actualizarBadgeTotal();

    const sub = document.getElementById('subBadgeRecordatorios');
    if (!sub) return;

    if (fabBadgeRecordatorios > 0) {
        sub.textContent = fabBadgeRecordatorios;
        sub.classList.remove('hidden');
    } else {
        sub.classList.add('hidden')
    }
}

function actualizarBadgeBanners(cantidad) {
    fabBadgeBanners = cantidad || 0;
    actualizarBadgeTotal();

    const sub = document.getElementById('subBadgeBanners');
    if(!sub) return;

    if (fabBadgeBanners > 0) {
        sub.textContent = fabBadgeBanners;
        sub.classList.remove('hidden');
    } else {
        sub.classList.add('hidden');
    }
}

function actualizarBadgeTotal() {
    const total = fabBadgeRecordatorios + fabBadgeBanners;
    const badge = document.getElementById('fabBadgeTotal');
    if (!badge) return;

    if (total > 0) {
        badge.textContent = total > 99 ? '99+' : total
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Cada sub-boton

function abrirIA() {
    cerrarFAB();

    if (typeof toggleChat === 'function') {
        toggleChat()
    }
}

document.addEventListener('DOMContentLoaded', () => {
    iniciarFAB();
})