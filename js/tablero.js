// Estado global
let tableroConfig   = null;
let tableroCeldas   = {};
let celdaSeleccionada = null;
let puedeEditar     = false;
let esAdminTablero  = false;
let modoEdicion     = false; // true = celda activa en escritura (doble clic / F2)

// Selección múltiple
let celdasSeleccionadas = new Set(); // Set de "fila-col"
let seleccionInicio     = null;      // celda ancla del arrastre
let mousePresionado     = false;

let saveTimer       = null;
let pendingGuardar  = {};

// Pan
let panActivo = false;
let panStartX = 0;
let panStartY = 0;
let panScrollX = 0;
let panScrollY = 0;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();

    if (!datosUsuario) {
        window.location.href = '../index.html';
        return;
    }

    esAdminTablero = datosUsuario.rol === 'admin';
    puedeEditar    = esAdminTablero || datosUsuario.puede_editar_tablero === true;

    if (!puedeEditar) {
        document.getElementById('noBanner').style.display = 'flex';
        deshabilitarToolbar();
    }

    if (esAdminTablero) {
        document.getElementById('seccionAdmin').style.display = 'flex';
    }

    // Tracking global del mouse para drag-to-select
    document.addEventListener('mousedown', (e) => { if (e.button === 0) mousePresionado = true; });
    document.addEventListener('mouseup',   (e) => {
        if (e.button === 0) {
            mousePresionado = false;
            const tabla = document.getElementById('tableroTable');
            if (tabla) tabla.style.userSelect = '';
        }
    });

    iniciarPan();
    iniciarNavegacionTeclado();
    await cargarTablero();
});

// ============================================
// CARGA DE DATOS
// ============================================

async function cargarTablero() {
    try {
        mostrarGuardando('Cargando...');

        const { data: configs, error: errCfg } = await supabaseClient
            .from('tablero_config')
            .select('*')
            .limit(1);

        if (errCfg) throw errCfg;
        tableroConfig = configs[0];
        if (!tableroConfig.celdas_combinadas) tableroConfig.celdas_combinadas = [];

        const { data: celdas, error: errCeldas } = await supabaseClient
            .from('tablero_celdas')
            .select('*');

        if (errCeldas) throw errCeldas;

        tableroCeldas = {};
        (celdas || []).forEach(c => {
            tableroCeldas[`${c.fila}-${c.columna}`] = {
                contenido:    c.contenido    || '',
                color_fondo:  c.color_fondo  || '',
                color_texto:  c.color_texto  || '',
                tamano_texto: c.tamano_texto || 14,
                negrita:      c.negrita      || false,
            };
        });

        renderizarTabla();
        mostrarGuardado();
    } catch (err) {
        console.error('Error cargando tablero: ', err);
        document.getElementById('tableroTableWrap').innerHTML =
            `<div style="padding: 40px; text-align:center; color: #e44;">
                <span class="material-symbols-rounded" style="font-size: 40px; display: block;">error</span>
                Error al cargar el tablero: ${err.message}
            </div>`;
    }
}

// ============================================
// RENDER
// ============================================

function renderizarTabla() {
    const { num_filas, num_columnas, cabeceras } = tableroConfig;
    const wrap = document.getElementById('tableroTableWrap');

    let html = `<table class="tablero-table" id="tableroTable">`;

    // THEAD
    html += `<thead><tr>`;
    html += `<th class="row-number" style="top:0; left:0; position: sticky; z-index:3;"></th>`;

    for (let c = 0; c < num_columnas; c++) {
        const nombre = (cabeceras && cabeceras[c]) ? cabeceras[c] : `Col ${c + 1}`;
        html += `<th>
            <div class="header-cell-inner">
                <span class="header-editable" id="header-${c}"
                    ${esAdminTablero ? 'contenteditable="true"' : ''}
                    onblur="guardarCabecera(${c}, this)"
                    onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur()}"
                >${escapeHtml(nombre)}</span>
                ${esAdminTablero ? `<button class="btn-del-col" onclick="eliminarColumna(${c})" title="Eliminar columna">
                    <span class="material-symbols-rounded">close</span>
                </button>` : ''}
            </div>
        </th>`;
    }

    if (esAdminTablero) {
        html += `<th class="add-col-th">
            <button class="btn-add-small" onclick="agregarColumna()" title="Añadir columna">
                <span class="material-symbols-rounded">add</span>
            </button>
        </th>`;
    }

    // TBODY
    html += `</thead><tbody>`;

    for (let f = 0; f < num_filas; f++) {
        html += `<tr id="fila-${f}">`;
        html += `<td class="row-number" style="position:sticky; left: 0;">${f + 1}
            ${esAdminTablero ? `<button class="btn-del-row" onclick="eliminarFila(${f})" title="Eliminar fila">
                <span class="material-symbols-rounded">close</span>
            </button>` : ''}
        </td>`;

        for (let c = 0; c < num_columnas; c++) {
            html += construirCeldaHtml(f, c);
        }

        if (esAdminTablero) {
            html += `<td style="border: 1px dashed var(--border-color, #e2e8f0); background: var(--bg-primary, #f8fafc);"></td>`;
        }

        html += `</tr>`;
    }

    if (esAdminTablero) {
        html += `<tr class="add-row-btn-row">
            <td colspan="${num_columnas + 2}">
                <button class="btn-add-small" onclick="agregarFila()">
                    <span class="material-symbols-rounded">add</span>
                    Agregar fila
                </button>
            </td>
        </tr>`;
    }

    html += `</tbody></table>`;
    wrap.innerHTML = html;
    asignarEventosCeldas();
}

function construirCeldaHtml(fila, col) {
    // Si esta celda fue absorbida por una combinación vecina, no se renderiza
    if (esCeldaAbsorbida(fila, col)) return '';

    const key  = `${fila}-${col}`;
    const dato = tableroCeldas[key] || {};
    const cont = dato.contenido    || '';
    const bg   = dato.color_fondo  || '';
    const fg   = dato.color_texto  || '';
    const tam  = dato.tamano_texto || 14;
    const bold = dato.negrita ? 'font-weight:700;' : '';

    const style = [
        bg   ? `background-color:${bg};` : '',
        fg   ? `color:${fg};`            : '',
        `font-size:${tam}px;`,
        bold
    ].join('');

    const merge      = getCeldaCombinada(fila, col);
    const colspanAtr = (merge && merge.colspan > 1) ? `colspan="${merge.colspan}"` : '';
    const rowspanAtr = (merge && merge.rowspan > 1) ? `rowspan="${merge.rowspan}"` : '';

    // ondblclick para entrar a edición; onclick removido — lo maneja asignarEventosCeldas
    const dblclick = puedeEditar ? `ondblclick="entrarModoEdicion(${fila},${col})"` : '';

    return `<td id="td-${fila}-${col}" data-fila="${fila}" data-col="${col}"
               ${colspanAtr} ${rowspanAtr} tabindex="-1" ${dblclick}>
        <span class="cell-content"
              id="cell-${fila}-${col}"
              style="${style}"
              onblur="onCeldaBlur(${fila},${col},this)"
              onkeydown="onCeldaKeydown(event,${fila},${col})">${escapeHtml(cont)}</span>
    </td>`;
}

// ============================================
// EVENTOS — DRAG-TO-SELECT
// ============================================

function asignarEventosCeldas() {
    const tabla = document.getElementById('tableroTable');
    if (!tabla) return;

    // Mousedown sobre cualquier celda → iniciar selección
    tabla.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const td = e.target.closest('td[data-fila]');
        if (!td || modoEdicion) return;

        const fila = parseInt(td.dataset.fila);
        const col  = parseInt(td.dataset.col);
        seleccionarCelda(fila, col);

        // Evitar selección de texto del navegador al arrastrar
        tabla.style.userSelect = 'none';
    });

    // Mouseover mientras se arrastra → extender selección
    tabla.addEventListener('mouseover', (e) => {
        if (!mousePresionado || !seleccionInicio || modoEdicion) return;
        const td = e.target.closest('td[data-fila]');
        if (!td) return;

        const fila = parseInt(td.dataset.fila);
        const col  = parseInt(td.dataset.col);

        // Solo extender si la celda cambió respecto a la actual
        if (fila !== celdaSeleccionada?.fila || col !== celdaSeleccionada?.col) {
            extenderSeleccionHasta(fila, col);
        }
    });
}

// ============================================
// SELECCIÓN
// ============================================

function seleccionarCelda(fila, col) {
    if (celdaSeleccionada && modoEdicion) {
        salirModoEdicion(celdaSeleccionada.fila, celdaSeleccionada.col);
    }

    limpiarSeleccion();

    celdaSeleccionada   = { fila, col };
    seleccionInicio     = { fila, col };
    celdasSeleccionadas = new Set([`${fila}-${col}`]);

    const td = document.getElementById(`td-${fila}-${col}`);
    if (!td) return;
    td.classList.add('selected');
    td.focus();

    const dato = tableroCeldas[`${fila}-${col}`] || {};
    actualizarToolbarConCelda(dato);
    actualizarBotonesMultiSelect();
}

function limpiarSeleccion() {
    celdasSeleccionadas.forEach(key => {
        const [f, c] = key.split('-');
        document.getElementById(`td-${f}-${c}`)?.classList.remove('selected', 'selected-range');
    });
    celdasSeleccionadas = new Set();
}

function marcarCeldasSeleccionadas() {
    const keys = [...celdasSeleccionadas];
    const anclaKey = `${seleccionInicio.fila}-${seleccionInicio.col}`;

    keys.forEach(key => {
        const [f, c] = key.split('-');
        const td = document.getElementById(`td-${f}-${c}`);
        if (!td) return;
        if (key === anclaKey) {
            td.classList.add('selected');
            td.classList.remove('selected-range');
        } else {
            td.classList.add('selected-range');
            td.classList.remove('selected');
        }
    });
}

function extenderSeleccionHasta(fila, col) {
    if (!seleccionInicio) return;

    limpiarSeleccion();

    const minF = Math.min(seleccionInicio.fila, fila);
    const maxF = Math.max(seleccionInicio.fila, fila);
    const minC = Math.min(seleccionInicio.col,  col);
    const maxC = Math.max(seleccionInicio.col,  col);

    celdasSeleccionadas = new Set();
    for (let f = minF; f <= maxF; f++) {
        for (let c = minC; c <= maxC; c++) {
            if (!esCeldaAbsorbida(f, c)) {
                celdasSeleccionadas.add(`${f}-${c}`);
            }
        }
    }

    // La celda activa (para toolbar) siempre es la ancla
    celdaSeleccionada = { fila: seleccionInicio.fila, col: seleccionInicio.col };
    marcarCeldasSeleccionadas();
    actualizarBotonesMultiSelect();
}

function actualizarBotonesMultiSelect() {
    const btnCombinar    = document.getElementById('btnCombinar');
    const btnDescombinar = document.getElementById('btnDescombinar');
    if (!btnCombinar || !btnDescombinar) return;

    const count = celdasSeleccionadas.size;

    // "Combinar" → visible cuando 2+ celdas seleccionadas y el usuario puede editar
    btnCombinar.style.display = (puedeEditar && count >= 2) ? 'flex' : 'none';

    // "Separar" → visible cuando se seleccionó exactamente 1 celda combinada
    if (count === 1 && celdaSeleccionada) {
        const merge = getCeldaCombinada(celdaSeleccionada.fila, celdaSeleccionada.col);
        btnDescombinar.style.display = (puedeEditar && merge) ? 'flex' : 'none';
    } else {
        btnDescombinar.style.display = 'none';
    }
}

// ============================================
// CELDAS COMBINADAS
// ============================================

function getCeldaCombinada(fila, col) {
    return (tableroConfig.celdas_combinadas || [])
        .find(m => m.fila === fila && m.col === col) || null;
}

function esCeldaAbsorbida(fila, col) {
    for (const m of (tableroConfig.celdas_combinadas || [])) {
        if (m.fila === fila && m.col === col) continue; // es la celda principal → no está absorbida
        if (fila >= m.fila && fila < m.fila + m.rowspan &&
            col  >= m.col  && col  < m.col  + m.colspan) {
            return true;
        }
    }
    return false;
}

async function combinarCeldas() {
    if (!puedeEditar || celdasSeleccionadas.size < 2) return;

    let minF = Infinity, maxF = -Infinity, minC = Infinity, maxC = -Infinity;
    celdasSeleccionadas.forEach(key => {
        const [f, c] = key.split('-').map(Number);
        minF = Math.min(minF, f); maxF = Math.max(maxF, f);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    });

    const rowspan = maxF - minF + 1;
    const colspan = maxC - minC + 1;

    if (!tableroConfig.celdas_combinadas) tableroConfig.celdas_combinadas = [];

    // Eliminar combinaciones previas que queden dentro del nuevo rango
    tableroConfig.celdas_combinadas = tableroConfig.celdas_combinadas.filter(m =>
        !(m.fila >= minF && m.fila <= maxF && m.col >= minC && m.col <= maxC)
    );

    tableroConfig.celdas_combinadas.push({ fila: minF, col: minC, rowspan, colspan });

    mostrarGuardando('Combinando...');
    await guardarConfigEstructura();
    renderizarTabla();
    mostrarGuardado();

    seleccionarCelda(minF, minC);
}

async function descombinarCelda() {
    if (!puedeEditar || !celdaSeleccionada) return;

    const { fila, col } = celdaSeleccionada;
    if (!tableroConfig.celdas_combinadas) return;

    tableroConfig.celdas_combinadas = tableroConfig.celdas_combinadas.filter(
        m => !(m.fila === fila && m.col === col)
    );

    mostrarGuardando('Separando...');
    await guardarConfigEstructura();
    renderizarTabla();
    mostrarGuardado();

    seleccionarCelda(fila, col);
}

// ============================================
// MODO EDICIÓN
// ============================================

function actualizarToolbarConCelda(dato) {
    const bg   = dato.color_fondo  || '#ffffff';
    const fg   = dato.color_texto  || '#1e293b';
    const tam  = dato.tamano_texto || 14;
    const bold = dato.negrita      || false;

    document.getElementById('inputColorFondo').value = bg;
    document.getElementById('dotColorFondo').style.background = bg;

    document.getElementById('inputColorTexto').value = fg;
    document.getElementById('dotColorTexto').style.background = fg;

    document.getElementById('selectTamano').value = tam.toString();
    document.getElementById('btnNegrita').classList.toggle('active', bold);
}

function onCeldaBlur(fila, col, el) {
    if (modoEdicion && celdaSeleccionada?.fila === fila && celdaSeleccionada?.col === col) {
        salirModoEdicion(fila, col);
    }
}

function onCeldaKeydown(event, fila, col) {
    if (event.key === 'Escape') {
        event.preventDefault();
        salirModoEdicion(fila, col);
        return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        salirModoEdicion(fila, col);
        moverACelda(fila + 1, col);
        return;
    }
    if (event.key === 'Tab') {
        event.preventDefault();
        salirModoEdicion(fila, col);
        let nextCol  = col + 1;
        let nextFila = fila;
        if (nextCol >= tableroConfig.num_columnas) { nextCol = 0; nextFila++; }
        moverACelda(nextFila, nextCol);
        return;
    }
}

function moverACelda(fila, col) {
    if (fila < 0 || fila >= tableroConfig.num_filas)    return;
    if (col  < 0 || col  >= tableroConfig.num_columnas) return;
    seleccionarCelda(fila, col);
}

function entrarModoEdicion(fila, col, charInicial = null) {
    if (!puedeEditar) return;

    modoEdicion = true;
    const cel = document.getElementById(`cell-${fila}-${col}`);
    const td  = document.getElementById(`td-${fila}-${col}`);
    if (!cel || !td) return;

    cel.contentEditable = 'true';
    td.classList.add('editing');
    cel.focus();

    if (charInicial) {
        cel.innerText = charInicial;
    }

    const range = document.createRange();
    const sel   = window.getSelection();
    range.selectNodeContents(cel);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

function salirModoEdicion(fila, col) {
    if (!modoEdicion) return;

    modoEdicion = false;
    const cel = document.getElementById(`cell-${fila}-${col}`);
    const td  = document.getElementById(`td-${fila}-${col}`);
    if (!cel) return;

    const contenido = cel.innerText || '';
    cel.contentEditable = 'false';
    td?.classList.remove('editing');

    programarGuardadoCelda(fila, col, { contenido });
    td?.focus();
}

function limpiarCelda(fila, col) {
    if (!puedeEditar) return;

    // Aplicar a todas las celdas seleccionadas
    const celdas = celdasSeleccionadas.size > 0
        ? [...celdasSeleccionadas]
        : [`${fila}-${col}`];

    celdas.forEach(key => {
        const [f, c] = key.split('-').map(Number);
        const cel = document.getElementById(`cell-${f}-${c}`);
        if (cel) cel.innerText = '';
        programarGuardadoCelda(f, c, { contenido: '' });
    });
}

// ============================================
// NAVEGACIÓN TECLADO
// ============================================

function iniciarNavegacionTeclado() {
    document.addEventListener('keydown', (e) => {
        if (!celdaSeleccionada) return;
        if (modoEdicion) return;

        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        if (document.activeElement?.contentEditable === 'true') return;

        const { fila, col } = celdaSeleccionada;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                moverACelda(fila - 1, col);
                break;
            case 'ArrowDown':
                e.preventDefault();
                moverACelda(fila + 1, col);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                moverACelda(fila, col - 1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                moverACelda(fila, col + 1);
                break;
            case 'Tab':
                e.preventDefault();
                let nextCol  = col + 1;
                let nextFila = fila;
                if (nextCol >= tableroConfig.num_columnas) { nextCol = 0; nextFila++; }
                moverACelda(nextFila, nextCol);
                break;
            case 'Enter':
            case 'F2':
                e.preventDefault();
                entrarModoEdicion(fila, col);
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                limpiarCelda(fila, col);
                break;
            default:
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    entrarModoEdicion(fila, col, e.key);
                }
        }
    });
}

// ============================================
// FORMATO
// ============================================

function aplicarFormato(tipo) {
    if (!puedeEditar) return;

    // Aplicar a todas las celdas del rango seleccionado
    const celdas = celdasSeleccionadas.size > 0
        ? [...celdasSeleccionadas]
        : (celdaSeleccionada ? [`${celdaSeleccionada.fila}-${celdaSeleccionada.col}`] : []);

    if (celdas.length === 0) return;

    // Para negrita: si TODAS ya tienen bold → quitar; de lo contrario → poner
    let nuevaNegrita;
    if (tipo === 'negrita') {
        const todasBold = celdas.every(k => tableroCeldas[k]?.negrita);
        nuevaNegrita = !todasBold;
        document.getElementById('btnNegrita').classList.toggle('active', nuevaNegrita);
    }

    celdas.forEach(key => {
        const [fila, col] = key.split('-').map(Number);
        const dato = tableroCeldas[key] || {};
        const cel  = document.getElementById(`cell-${fila}-${col}`);
        if (!cel) return;

        if (tipo === 'negrita') {
            dato.negrita = nuevaNegrita;
            cel.style.fontWeight = nuevaNegrita ? '700' : '';
        }
        if (tipo === 'tamano') {
            const tam = parseInt(document.getElementById('selectTamano').value);
            dato.tamano_texto = tam;
            cel.style.fontSize = `${tam}px`;
        }
        if (tipo === 'colorFondo') {
            const color = document.getElementById('inputColorFondo').value;
            dato.color_fondo = color;
            cel.style.backgroundColor = color;
        }
        if (tipo === 'colorTexto') {
            const color = document.getElementById('inputColorTexto').value;
            dato.color_texto = color;
            cel.style.color = color;
        }
        if (tipo === 'limpiar') {
            dato.color_fondo  = '';
            dato.color_texto  = '';
            dato.tamano_texto = 14;
            dato.negrita      = false;
            cel.style.backgroundColor = '';
            cel.style.color           = '';
            cel.style.fontSize        = '14px';
            cel.style.fontWeight      = '';
        }

        tableroCeldas[key] = dato;
        programarGuardadoCelda(fila, col, dato);
    });

    // Actualizar dots de color (basado en la celda ancla)
    if (tipo === 'colorFondo') {
        const color = document.getElementById('inputColorFondo').value;
        document.getElementById('dotColorFondo').style.background = color;
    }
    if (tipo === 'colorTexto') {
        const color = document.getElementById('inputColorTexto').value;
        document.getElementById('dotColorTexto').style.background = color;
    }
    if (tipo === 'limpiar') {
        actualizarToolbarConCelda({});
    }
}

// ============================================
// GUARDADO
// ============================================

function programarGuardadoCelda(fila, col, cambios) {
    const key = `${fila}-${col}`;
    tableroCeldas[key]  = { ...tableroCeldas[key], ...cambios };
    pendingGuardar[key] = { fila, col, ...tableroCeldas[key] };

    mostrarGuardando();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(ejecutarGuardado, 800);
}

async function ejecutarGuardado() {
    if (Object.keys(pendingGuardar).length === 0) return;

    const batch = Object.values(pendingGuardar);
    pendingGuardar = {};

    try {
        const upserts = batch.map(d => ({
            fila:         d.fila,
            columna:      d.col,
            contenido:    d.contenido    || '',
            color_fondo:  d.color_fondo  || '',
            color_texto:  d.color_texto  || '',
            tamano_texto: d.tamano_texto || 14,
            negrita:      d.negrita      || false,
            updated_at:   new Date().toISOString(),
            updated_by:   datosUsuario.id
        }));

        const { error } = await supabaseClient
            .from('tablero_celdas')
            .upsert(upserts, { onConflict: 'fila,columna' });

        if (error) throw error;
        mostrarGuardado();
    } catch (err) {
        console.error('Error guardando celdas: ', err);
        mostrarGuardado('Error al guardar');
    }
}

// ============================================
// CABECERAS
// ============================================

async function guardarCabecera(col, el) {
    if (!esAdminTablero) return;
    const nuevo = el.innerText.trim() || `Col ${col + 1}`;
    tableroConfig.cabeceras[col] = nuevo;

    try {
        const { error } = await supabaseClient
            .from('tablero_config')
            .update({
                cabeceras:  tableroConfig.cabeceras,
                updated_at: new Date().toISOString(),
                updated_by: datosUsuario.id
            })
            .eq('id', tableroConfig.id);

        if (error) throw error;
        mostrarGuardado();
    } catch (err) {
        console.error('Error guardando cabecera:', err);
    }
}

// ============================================
// AGREGAR / ELIMINAR FILAS Y COLUMNAS
// ============================================

async function agregarFila() {
    if (!esAdminTablero) return;
    tableroConfig.num_filas++;
    await guardarConfigEstructura();
    renderizarTabla();
}

async function agregarColumna() {
    if (!esAdminTablero) return;
    tableroConfig.cabeceras.push(`Col ${tableroConfig.num_columnas + 1}`);
    tableroConfig.num_columnas++;
    await guardarConfigEstructura();
    renderizarTabla();
}

async function eliminarFila(fila) {
    if (!esAdminTablero) return;
    if (!confirm(`¿Eliminar fila ${fila + 1}? Se borrarán todos sus datos.`)) return;

    mostrarGuardando('Eliminando...');

    try {
        await supabaseClient.from('tablero_celdas').delete().eq('fila', fila);

        const { data: celdasPosteriores } = await supabaseClient
            .from('tablero_celdas').select('*').gt('fila', fila);

        if (celdasPosteriores && celdasPosteriores.length > 0) {
            await supabaseClient.from('tablero_celdas').delete().gt('fila', fila);
            const renumeradas = celdasPosteriores.map(c => ({ ...c, fila: c.fila - 1, id: undefined }));
            if (renumeradas.length > 0) await supabaseClient.from('tablero_celdas').insert(renumeradas);
        }

        tableroConfig.num_filas--;

        const nuevoMapa = {};
        Object.entries(tableroCeldas).forEach(([key, val]) => {
            const [f, c] = key.split('-').map(Number);
            if (f === fila) return;
            const nuevaFila = f > fila ? f - 1 : f;
            nuevoMapa[`${nuevaFila}-${c}`] = val;
        });
        tableroCeldas = nuevoMapa;

        // Limpiar combinaciones que crucen esta fila y renumerar las posteriores
        tableroConfig.celdas_combinadas = (tableroConfig.celdas_combinadas || [])
            .filter(m => !(fila >= m.fila && fila < m.fila + m.rowspan))
            .map(m => ({ ...m, fila: m.fila > fila ? m.fila - 1 : m.fila }));

        await guardarConfigEstructura();
        renderizarTabla();
        mostrarGuardado();
    } catch (err) {
        console.error('Error eliminando fila: ', err);
        mostrarGuardado('Error');
    }
}

async function eliminarColumna(col) {
    if (!esAdminTablero) return;
    const nombreCol = tableroConfig.cabeceras[col] || `Col ${col + 1}`;
    if (!confirm(`¿Eliminar columna "${nombreCol}"? Se borrarán todos sus datos.`)) return;

    mostrarGuardando('Eliminando...');

    try {
        await supabaseClient.from('tablero_celdas').delete().eq('columna', col);

        const { data: celdasPost } = await supabaseClient
            .from('tablero_celdas').select('*').gt('columna', col);

        if (celdasPost && celdasPost.length > 0) {
            await supabaseClient.from('tablero_celdas').delete().gt('columna', col);
            const renumeradas = celdasPost.map(c => ({ ...c, columna: c.columna - 1, id: undefined }));
            if (renumeradas.length > 0) await supabaseClient.from('tablero_celdas').insert(renumeradas);
        }

        tableroConfig.cabeceras.splice(col, 1);
        tableroConfig.num_columnas--;

        const nuevoMapa = {};
        Object.entries(tableroCeldas).forEach(([key, val]) => {
            const [f, c] = key.split('-').map(Number);
            if (c === col) return;
            const nuevaCol = c > col ? c - 1 : c;
            nuevoMapa[`${f}-${nuevaCol}`] = val;
        });
        tableroCeldas = nuevoMapa;

        // Limpiar combinaciones que crucen esta columna y renumerar las posteriores
        tableroConfig.celdas_combinadas = (tableroConfig.celdas_combinadas || [])
            .filter(m => !(col >= m.col && col < m.col + m.colspan))
            .map(m => ({ ...m, col: m.col > col ? m.col - 1 : m.col }));

        await guardarConfigEstructura();
        renderizarTabla();
        mostrarGuardado();
    } catch (err) {
        console.error('Error eliminando columna: ', err);
        mostrarGuardado('Error');
    }
}

async function guardarConfigEstructura() {
    const { error } = await supabaseClient
        .from('tablero_config')
        .update({
            num_filas:         tableroConfig.num_filas,
            num_columnas:      tableroConfig.num_columnas,
            cabeceras:         tableroConfig.cabeceras,
            celdas_combinadas: tableroConfig.celdas_combinadas || [],
            updated_at:        new Date().toISOString(),
            updated_by:        datosUsuario.id
        })
        .eq('id', tableroConfig.id);

    if (error) console.error('Error guardando config:', error);
}

// ============================================
// PAN — Arrastrar para mover el tablero
// ============================================

function iniciarPan() {
    const area = document.getElementById('tableroScrollArea');
    if (!area) return;

    area.addEventListener('mousedown', e => {
        if (e.button === 1 ||
            e.target.classList.contains('tablero-scroll-area') ||
            e.target.classList.contains('tablero-table-wrap')) {
            panActivo  = true;
            panStartX  = e.clientX;
            panStartY  = e.clientY;
            panScrollX = area.scrollLeft;
            panScrollY = area.scrollTop;
            area.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    window.addEventListener('mousemove', e => {
        if (!panActivo) return;
        area.scrollLeft = panScrollX - (e.clientX - panStartX);
        area.scrollTop  = panScrollY - (e.clientY - panStartY);
    });

    window.addEventListener('mouseup', () => {
        if (panActivo) {
            panActivo = false;
            area.style.cursor = '';
        }
    });
}

// ============================================
// INDICADOR DE GUARDADO
// ============================================

function mostrarGuardando(texto = 'Guardando...') {
    const ind = document.getElementById('saveIndicator');
    const txt = document.getElementById('saveText');
    if (!ind || !txt) return;
    ind.className = 'save-indicator saving';
    ind.querySelector('.material-symbols-rounded').textContent = 'sync';
    txt.textContent = texto;
}

function mostrarGuardado(texto = 'Guardado') {
    const ind = document.getElementById('saveIndicator');
    const txt = document.getElementById('saveText');
    if (!ind || !txt) return;
    ind.className = 'save-indicator saved';
    ind.querySelector('.material-symbols-rounded').textContent = 'cloud_done';
    txt.textContent = texto;
    setTimeout(() => {
        if (ind) {
            ind.className = 'save-indicator';
            ind.querySelector('.material-symbols-rounded').textContent = 'cloud_done';
            txt.textContent = 'Guardado';
        }
    }, 2500);
}

// ============================================
// UTILIDADES
// ============================================

function deshabilitarToolbar() {
    document.querySelectorAll('.toolbar-btn, .toolbar-select, .color-preview-btn')
        .forEach(el => {
            el.disabled = true;
            el.style.opacity = '0.4';
            el.style.pointerEvents = 'none';
        });
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}