let fabAbierto = false;
let fabBadgeRecordatorios = 0;
let fabBadgeBanners = 0;

// Inicialización

function iniciarFAB() {
    const container = document.createElement('div');
    container.className = 'fab-container';
    container.id = 'fabCointainer';

    container.innerHTML = `
        <!-- Sub-botones (se muestran al abrir) -->
        <div class="fab-actions" id="fabActions">
            <div class="fab-actions-item">
                <span class="fab-action-label">Asistente IA</span>
                <button class="fab-action-btn fab-btn-ia" onclick="abrirIA() title="Asistente IA">
                    <span class="material-symbols-rounded">smart_toy</span>
                </button>
            </div>

            <!-- Banners -->
            <div class="fab-actions-item" id="fabItemBanner" style="none">
                <span class="fab-action-label">Anuncios</span>
                <button class="fab-action-btn fab-btn-banners" onclick="abrirGestorBanners()" title="Anuncios">
                    <span class="material-symbols-rounded">campaing</span>
                    <span class="fab-sub-badge hidden" id="subBadgeBanners">0</span>
                </button>
            </div>

            <div class="fab-actions-item">
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

    document.body.appendChild('container');

    document.addEventListener('click', (e) => {
        if (fabAbierto && !container.contains(e.target)) {
            cerrarFAB()
        }
    })
}