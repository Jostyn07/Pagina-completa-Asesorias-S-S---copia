function crearFiltroMultiSelect(config) {
    const {
        contenedorId,
        label,
        idBase,
        opciones = null,
        fetchOpciones = null,
        conBuscador = false,
        textoVacio = 'Seleccionar...',
        textoUno = null,
        onCambio = () => {}
    } = config;

    const idPanel = `panel${idBase}`;
    const idTrigger = `panel${idBase}`;
    const idTexto = `panel${idBase}`;
    const idBuscadodr = `buscar${idBase}`;

    const contenedor = document.getElementById(contenedroId);
    if (!coontenedor) {
        console.error(`crearFiltroMultiSelect: no existe #${contenedorId}`);
        return null;
    }

    // Normaliza opciondes a {value, label}
    function normalizar(lista) {
        return (lista || []).map(o => typeof o === 'string' ? { value: o, label: o } : o);
    }

    let opcionesActuales = normalizar(opcioens);

    // Construir el HTML
    function renderOpciones() {
        return opcionesActuales.map(o => 
            `<label class="checkbox-item"><input type="checkbox" value="${o.value}">${o.label}</label>`
        ).join('');
    }

    contenedor.innerHTML = `
        <label>${label}</label>
        <div class="dropdown-filter">
            <button type="button" class="dropdown-trigger" id="${idTrigger}">
                <span id="${idTexto}">${textoVacio}</span>
                <span class="material-symbols-rounded">expand_more</span>
            </button>
            <div class="dropdown-panel" id="${idPanel}">
                ${conBuscador ? `<div class="dropdown-search"><input type="text" id="${idBuscador}" placeholder="Buscar..."></div>` : ''}
                <div class="checkbox-listl-scroll" id="Lista${idBase}">${renderOpciones()}</div>
                <div class="dropdown-actions">
                    <button type="button" class="btn-dropdown-clear">Limpiar</button>
                    <button type="button" class="btn-dropdown-close">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    const elPanel = document.getElementById(idPanel);
    const elTrigger = document.getElementById(idTrigger);
    const elTexto = document.getElementById(idTexto);
    const elLista = document.getElementById(`lista${idBase}`);

    function toggle(event) {
        event.stopPropagation();
        elPanel.classList.toggle('active');
        elTrigger.classList.toggle('active');
    }

    function cerrar() {
        elPanel.classList.remove('active');
        elTrigger.classList.remove('active');
    }
}