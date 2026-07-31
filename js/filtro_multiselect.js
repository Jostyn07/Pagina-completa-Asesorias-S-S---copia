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
    const idTrigger = `trigger${idBase}`;
    const idTexto = `texto${idBase}`;
    const idBuscador = `buscar${idBase}`;

    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) {
        console.error(`crearFiltroMultiSelect: no existe #${contenedorId}`);
        return null;
    }

    // Normaliza opciones a {value, label}
    function normalizar(lista) {
        return (lista || []).map(o => typeof o === 'string' ? { value: o, label: o } : o);
    }

    let opcionesActuales = normalizar(opciones);

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
                <div class="checkbox-list-scroll" id="lista${idBase}">${renderOpciones()}</div>
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
        return Array.from(elLista.querySelectorAll('input:checked')).map(cb => cb.value);
    }

    function setSeleccionados(valores) {
        elLista.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = valores.includes(cb.value);
        });
        actualizarTexto();
    }

    async function recargarOpciones() {
        if (!fetchOpciones) return;
        const nuevas = await fetchOpciones();
        opcionesActuales = normalizar(nuevas);
        const seleccionaPrevia = getSeleccionados();
        elLista.innerHTML = renderOpciones();
        setSeleccionados(seleccionaPrevia.filter(v => opcionesActuales.some(o => o.value === v)));
        engancharCheckboxes();
    }

    function engancharCheckboxes() {
        elLista.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                actualizarTexto();
                onCambio(getSeleccionados());
            });
        });
    }

    // Enganchar eventos fijos
    elTrigger.addEventListener('click', toggle);
    elPanel.querySelector('.btn-dropdown-clear').addEventListener('click', limpiar);
    elPanel.querySelector('.btn-dropdown-close').addEventListener('click', cerrar);
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

const filtroEstadoMigratorio = crearFiltroMultiSelect({
    contenedorId: 'filtroEstadoMigratorioGroup',
    label: 'Estado Migratorio',
    idBase: 'filtroEstadoMigratorio',
    opciones: ['Ciudadano', 'Residente Permanente', 'Permiso de trabajo', 'Asilo politico', 'I-94', 'Otro'],
    textoVacio: 'Seleccionar estados...',
    onCambio: () => { guardarFiltrosEnStorage(); aplicarFiltros();}
})

const filtroEstado = crearFiltroMultiSelect({
    contenedorId: 'filtroEstadoGroup',
    label: 'Filtrar por estado',
    idBase: 'filtroEstado',
    conBuscador: true,
    opciones: [
        { value: 'Alabama', label: 'Alabama (AL)' },
        { value: 'Arizona', label: 'Arizona (AZ)' },
        { value: 'Arkanzas', label: 'Arkanzas (AR)' },
        { value: 'Florida', label: 'Florida (FL)' },
        { value: 'Georgia', label: 'Georgia (GA)' },
        { value: 'Illinois', label: 'Illinois (IL)' },
        { value: 'Indiana', label: 'Indiana (IN)' },
        { value: 'Kansas', label: 'Kansas (KS)' },
        { value: 'Louisiana', label: 'Louisiana (LA)' },
        { value: 'Michigan', label: 'Michigan (MI)' },
        { value: 'Missouri', label: 'Missouri (MO)' },
        { value: 'Mississippi', label: 'Mississippi (MS)' },
        { value: 'Maryland', label: 'Maryland (MD)' },
        { value: 'North Carolina', label: 'North Carolina (NC)' },
        { value: 'New Jersey', label: 'New Jersey (NJ)' },
        { value: 'Ohio', label: 'Ohio (OH)' },
        { value: 'Oklahoma', label: 'Oklahoma (OK)' },
        { value: 'Pensilvania', label: 'Pensilvania (PA)' },
        { value: 'Carolina del Sur', label: 'Carolina del Sur (SC)' },
        { value: 'Tennessee', label: 'Tennessee (TN)' },
        { value: 'Texas', label: 'Texas (TX)' },
        { value: 'Utah', label: 'Utah (UT)' },
        { value: 'Virginia', label: 'Virginia (VA)' },
    ],
    textoVacio: 'Seleccionar estados...',
    onCambio: () => { guardarFiltrosEnStorage(); aplicarFiltros(); }
});

const filtroMesPagado = crearFiltroMultiSelect({
    contenedorId: 'filtroMesPagadoGroup',
    label: 'Mes pagado',
    idBase: 'filtroMesPagado',
    opciones: [
        { value: 'enero', label: 'Enero' },
        { value: 'febrero', label: 'Febrero' },
        { value: 'marzo', label: 'Marzo' },
        { value: 'abril', label: 'Abril' },
        { value: 'mayo', label: 'Mayo' },
        { value: 'junio', label: 'Junio' },
        { value: 'julio', label: 'Julio' },
        { value: 'agosto', label: 'Agosto' },
        { value: 'septiembre', label: 'Septiembre' },
        { value: 'octubre', label: 'Octubre' },
        { value: 'noviembre', label: 'Noviembre' },
        { value: 'diciembre', label: 'Diciembre' },
    ],
    textoVacio: 'Seleccionar meses...',
    onCambio: () => { guardarFiltrosEnStorage(); aplicarFiltros(); }
});

const filtroTipoModificacion = crearFiltroMultiSelect({
    contenedorId: 'filtroTipoModificacionGroup',
    label: 'Tipo de modifiación',
    idBase: 'filtroTipoModificacion',
    opciones: ['Recuperada', 'Cambio de vida', 'Cancelada'],
    textoVacio: 'Seleccionar tipos...',
    onCambio: () => { guardarFiltrosEnStorage(); aplicarFiltros(); }
});

const filtroModificadoPor = crearFiltroMultiSelect({
    contenedorId: 'filtroModificadoPorGroup',
    label: 'Modificado por',
    idBase: 'filtroModificadoPor',
    conBuscador: true,
    fetchOpciones: () => [...new Set(todasLasPolizas.map(p => p.modificado_por_nombre).filter(Boolean))].sort(),
    textoVacio: 'Seleccionar...',
    onCambio: () => { guardarFiltrosEnStorage(); aplicarFiltros(); }
});

const filtroDocumentos = crearFiltroMultiSelect({
    contenedorId: 'filtroDocumentosGroup',
    label: 'Documentos',
    idBase: 'filtroDocumentos',
    conBuscador: true,
    opciones: [
        'Pendiente',
        'Incompleto (Ciudadania)',
        'Incompleto (Estado migratorio)',
        'Incompleto (Income)',
        'Incompleto (Medicaid)',
        'Incompleto (SSN)',
        'Incompleto (Cobertura medica)',
        'Incompleto (Income y estado migratorio)',
        { value: 'Incompleto (SSN e income)', label: 'SSN e income' },
        'Incompleto (Ciudadania y SSN)',
        'Incompleto (Income y estado migratorio y SSN)',
        'Incompleto (Income y estado migratorio y Ciudadania)',
        'Incompleto (A la espera de verificación)',
        'Rechazado',
        'Documentos completos',
    ],
    textoVacio: 'Seleccionar...',
    onCambio: () => { guardarFiltrosEnStorage(); aplicarFiltros(); }
});

const filtroAgenteMercado = crearFiltroMultiSelect({
    contenedorId: 'filtroAgenteMercadoGroup',
    label: 'Agente (Mercado)',
    idBase: 'filtroAgenteMercado',
    conBuscador: true,
    opciones: [
        { value: '__null__', label: 'Pendiente' },
        'Benigno Aquino Reyes - 21344017',
        'Sebastian Guichardo - 20497412',
        'Leslie Lopez - 20464969',
        'Mari Carmen Mejia Suero - 21283514',
        'Joel Nieves - 19952518',
        'Jose Nicolas Ramirez - 20533134',
        'Rafael Martinez - 4079217499',
        { value: 'Cristofer Nunez - 195587961', label: 'Cristofer Núñez - 195587961' },
    ],
    textoVacio: 'Todos',
    onCambio: () => { guardarFiltrosEnStorage(); aplicarFiltros(); }
});

const filtroEstadoAgente35 = crearFiltroMultiSelect({
    contenedorId: 'filtroEstadoAgente35Group',
    label: 'Estado agente 3.5',
    idBase: 'filtroEstadoAgente35',
    opciones: ['Procesado', 'Pendiente', 'New aplication', 'Policy change', 'Cambio necesario'],
    textoVacio: 'Todos',
    onCambio: () => { guardarFiltrosEnStorage(); aplicarFiltros(); }
});

const filtroPortalAvanzado = crearFiltroMultiSelect({
    contenedorId: 'filtroPortalAvanzadoGroup',
    label: 'Portal',
    idBase: 'filtroPortalAvanzado',
    conBuscador: true,
    fetchOpciones: () => [...new Set(todasLasPolizas.map(p => p.cliente?.portal).filter(Boolean))].sort(),
    textoVacio: 'Seleccionar portal...',
    onCambio: () => { guardarFiltrosEnStorage(); aplicarFiltros(); }
});