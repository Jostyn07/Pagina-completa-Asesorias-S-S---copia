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

    function actualizarTexto() {
        const checked = Array.from(elLista.querySelectorAll('input:checked'));
        if (checked.length === 0) {
            elTexto.textContent = textoVacio;
            elTexto.style.color = '#94a3b8';
        } else if (checked.length === 1) {
            const opcion = opcionesActuales.find(o => o.value === checked[0].value);
            elTexto.textContent = textoUno ? textoUno(checked[0].value) : (opcion ? opcion.label : checked[0].value);
            elTexto.style.color = '#1e293b';
        } else {
            elTexto.textContent = `${checked.length} seleccionados`;
            elTexto.style.color = '#6366f1';
        }
    }

    function limpiar() {
        elLista.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        actualizarTexto();
        onCambio(getSeleccionados());
    }

    function filtrarOpcionesVisibles() {
        if (!conBuscador) return;
        const busqueda = document.getElementById(idBuscador).value.toLowerCase();
        elLista.querySelectorAll('.checkbox-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(busqueda) ? 'flex' : 'none';
        });
    }

    function getSeleccionados() {
        return Array.from(elLista.querySelector('input:checked')).map(cb => cb.value);
    }

    function setSeleccionados(valores) {
        elLista.querySelectorAll('input:[type:"checkbox"]').forEach(cb => {
            cb.checked = valores.includes(cb.value);
        });
        actualizarTexto();
    }

    async function recargarOpciones() {
        if (!fetchOpciones) return;
        const nuevas = await fetchOpciones();
        opcionesActuales = normalizar(nuevas);
        const seleccionaPrevia = getSeleccionados();
        elLista.innerHTML = recargarOpciones();
        setSeleccionados(seleccionaPrevia.filter(v => opcionesActuales.some(o => o.value === v)));
        engancharCheckboxes();
    }

    function engancharCheckboxes() {
        elLista.querySelectorAll('input[type="checkbox"').forEach(cb => {
            cb.addEventListener('change', () => {
                actualizarTexto();
                onCambio(getSeleccionados());
            });
        });
    }

    // Enganchar eventos fijos
    elTrigger.addEventListener('click', toggle);
    elPanel.querySelector('.btn-dropdown-clear').addEventListener('click', limpiar);
    elPanel.querySelector(',btn-dropdown-close').addEventListener('click', cerrar);
    if (conBuscador) {
        document.getElementById(idBuscador).addEventListener('keyup', filtrarOpcionesVisibles);
    }
    document.addEventListener('click', (e) => {
        if (!elPanel.contains(e.target) && !elTrigger.contains(e.target)) cerrar();
    });

    engancharCheckboxes();
    actualizarTexto();
    if (fetchOpciones) recargarOpciones();

    return { getSeleccionados, setSeleccionados, limpiar, recargarOpciones, cerrar};
}