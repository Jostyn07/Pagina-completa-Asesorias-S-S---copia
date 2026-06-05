// Estado global
let tableroConfig = null;
let tableroCeldas = {};
let celdaSeleccionada = null;
let puedeEditar = false;
let esAdminTablero = false;

let saveTimer = null;
let pendingGuardar = {}

// Arrastre para configurar tamaño de celdas (pan)
let panActivo = false;
let panStartX = 0;
let panStartY = 0;
let panScrollX = 0;
let panScrollY = 0;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    await cargarRolUsuario();

    if (!datosUsuario) {
        window.location.href= '../index.html'
        return
    }

    // Determinar permisos
    esAdminTablero = datosUsuario.rol === 'admin';
    puedeEditar = esAdminTablero || datosUsuario.puede_editar_tablero === true;

    // Mostrar / ocultar secciones
    if (!puedeEditar) {
        document.getElementById('noBanner').style.display = 'flex';
        deshabilitarToolbar();
    }

    if (esAdminTablero) {
        document.getElementById('seccionAdmin').style.display = 'flex';
    }

    // Iniciar pan
    iniciarPan();

    // cargar datos
    await cargarTablero();
});

// cargar datos desde supabase
async function cargarTablero() {
    try {
        mostrarGuardando('Cargando...');

        // config
        const { data: configs, error: errCfg } = await supabaseClient
            .from('tablero_config')
            .select('*')
            .limit(1);

        if (errCfg) throw errCfg;
        tableroConfig = configs[0];

        // celda
        const { data: celdas, error: errCeldas } = await supabaseClient
            .from('tablero_celdas')
            .select('*');
        
        if(errCeldas) throw errCeldas;

        // poblar mapa de celdas
        tableroCeldas = {};
        (celdas || []).forEach(c => {
            tableroCeldas[`${c.fila}-${c.columna}`] = {
                contenido: c.contenido || '',
                color_fondo: c.color_fondo || '',
                color_texto: c.color_texto || '',
                tamano_texto: c.tamano_texto || 14,
                negrita: c.negrita || false,
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
            </div>`
    }
}

// Render tabla
function renderizarTabla() {
    const { num_filas, num_columnas, cabeceras} = tableroConfig;
    const wrap = document.getElementById('tableroTableWrap');

    let html = `<table class="tablero-table" id="tableroTable">`;

    // THEAD
    html += `<thead><tr>`;
    html += `<th class="row-number" style="top:0; left:0; position: sticky; z-index:3;"></th>`

    for (let c = 0; c < num_columnas; c++) {
        const nombre = (cabeceras && cabeceras[c]) ? cabeceras[c] : `Col ${c+1}`;
        html += `<th>
            <div class="header-cell-inner">
                <span class="header-editable" id="header-${c}" ${esAdminTablero ? 'contenteditable = "true"' : ''} onblur="guardarCabecera(${c}, this)" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur()}">${escapeHtml(nombre)}</span>
                ${esAdminTablero ? `<button class="btn-del-col" onclick="eliminarColumna(${c})" title="Eliminar columna">
                    <span class="material-symbols-rounded">close</span>

                </button>` : '' }
            </div>
        </th>`;
    }

    // th vacío para botón añadir col (solo admin)
    if (esAdminTablero) {
        html += `<th class="add-col-th">
            <button class="btn-add-small" onclick="agregarColumna()" title="Añadir columna">
                <span class="material-symbols-rounded">add</span>
            </button>
        </th>`;
    }


    // TBODY

    html += `<tbody>`;

    for(let f = 0; f < num_filas; f++) {
        html += `<tr id="fila-${f}">`;

        // Número de fila
        html += `<td class="row-number" style="position:sticky; left: 0;">${f + 1}
            ${esAdminTablero ? `<button class="btn-del-row" onclick="eliminarFila(${f})" title="Eliminar fila">
                    <span class="material-symbols-rounded">close</span>
                </button>` : ''}
        </td>`;

        for (let c = 0; c < num_columnas; c++) {
            html += construirCeldaHtml(f,c);
        }

        // td vacío para columna de add-col
        if (esAdminTablero) {
            html += `<td style="border: 1px dashed var(--border-color, #e2e8f0); background: var(--bg-primary, #f8fafc);"></td>`;
        }

        html += `</tr>`
    }
    html += `</tbody></table>`


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

    wrap.innerHTML = html;
    
    asignarEventosCeldas()
}

function construirCeldaHtml(fila, col) {
    const key = `${fila}-${col}`;
    const dato = tableroCeldas[key] || {};
    const cont = dato.contenido || '';
    const bg = dato.color_fondo || '';
    const fg = dato.color_texto || '';
    const tam = dato.tamano_texto || 14;
    const bold = dato.negrita ? 'font-weight:700;' : '';

    const style = [
        bg ? `background-color:${bg};` : '',
        fg ? `color:${fg};` : '',
        `font-size: ${tam}px;`,
        bold
    ].join('');

    return `<td id="td-${fila}-${col}" data-fila="${fila}" data-col="${col}" onclick="seleccionarCelda(${fila}, ${col})">
        <span class="cell-content" id="cell-${fila}-${col}" style="${style}" ${puedeEditar ? 'contenteditable="true"' : ''} onblur="onCeldaBlur(${fila},${col},this)" onkeydown="onCeldaKeydown(event,${fila},${col})">${escapeHtml(cont)}</span>
    </td>`;
}

// Eventos de celdas
function asignarEventosCeldas() {
    
}

function seleccionarCelda(fila, col) {
    if (celdaSeleccionada) {
        const tdPrev = document.getElementById(`td-${celdaSeleccionada.fila}-${celdaSeleccionada.col}`);
        if (tdPrev) tdPrev.classList.remove('selected');
    }

    const td = document.getElementById(`td-${fila}-${col}`);
    if (!td) return;
    td.classList.add('selected');

    celdaSeleccionada = { fila, col, tdEl: td };

    // Actualizar toolbar con valore de la celda
    const key = `${fila}-${col}`;
    const dato = tableroCeldas[key] || {};
    actualizarToolbarConCelda(dato);
}

function actualizarToolbarConCelda(dato) {
    const bg = dato.color_fondo || '#ffffff';
    const fg = dato.color_texto || '#1e293b';
    const tam = dato.tamano_texto || 14;
    const bold = dato.negrita || false;

    document.getElementById('inputColorFondo').value = bg;
    document.getElementById('dotColorFondo').style.background = bg;
    
    document.getElementById('inputColorTexto').value = fg;
    document.getElementById('dotColorTexto').style.background = fg;

    const slectTam = document.getElementById('selectTamano');
    slectTam.value = tam.toString();

    const btnNeg = document.getElementById('btnNegrita');
    btnNeg.classList.toggle('active', bold);
}

function onCeldaBlur(fila, col, el) {
    const contenido = el.innerText || '';
    programarGuardadoCelda(fila, col, { contenido });
}

function onCeldaKeydown(event, fila, col) {
    // Tab -> siguiente celda
    if (event.key == 'Tab') {
        event.preventDefault()
        const numCols = tableroConfig.num_columnas;
        let nextCol = col + 1;
        let nextFila = fila;
        if (nextCol >= numCols) { nextCol = 0; nextFila++; }
        const nextCell = document.getElementById(`cell-${nextFila}-${nextCol}`);
        if (nextCell) { seleccionarCelda(nextFila, nextCol); nextCell.focus(); }
        return;
    }

    if (event.key === 'Escape') {
        document. getElementById(`cell-${fila}-${col}`)?.blur();
    }
}

// formato
function aplicarFormato(tipo) {
    if (!puedeEditar) return;
    if (!celdaSeleccionada) return;

    const { fila, col} = celdaSeleccionada;
    const key = `${fila}-${col}`;
    const dato = tableroCeldas[key] || {};
    const cel = document.getElementById(`cell-${fila}-${col}`);
    if(!cel) return;

    if (tipo === 'negrita') {
        dato.negrita = !dato.negrita;
        cel.style.fontWeight = dato.negrita ? '700' : '';
        document.getElementById('btnNegrita').classList.toggle('active', dato.negrita);
    }

    if (tipo == 'tamano') {
        const tam = parseInt(document.getElementById('selectTamano').value);
        dato.tamano_texto = tam;
        cel.style.fontSize = `${tam}px`;
    }

    if (tipo === 'colorFondo') {
        const color = document.getElementById('inputColorFondo').value;
        dato.color_fondo = color;
        cel.style.backgroundColor = color;
        document.getElementById('dotColorFondo').style.background = color;
    }

    if (tipo === 'colorTexto') {
        const color = document.getElementById('inputColorTexto').value;
        dato.color_texto = color;
        cel.style.color = color;
        document.getElementById('dotColorTexto').style.background = color;
    }

    if (tipo === 'limpiar') {
        dato.color_fondo = '';
        dato.color_texto = '';
        dato.tamano_texto = 14;
        dato.negrita = false;
        cel.style.backgroundColor = '';
        cel.style.color = '';
        cel.style.fontSize = '14px';
        cel.style.fontWeight = '';
        actualizarToolbarConCelda({});
    }

    tableroCeldas[key] = dato;
    programarGuardadoCelda(fila, col, dato);
}

// Guardar celdas cada 8 segundos
function programarGuardadoCelda(fila, col, cambios) {
    const key = `${fila}-${col}`;
    tableroCeldas[key] = { ...tableroCeldas[key], ...cambios };
    pendingGuardar[key] = { fila, col, ...tableroCeldas[key] };

    mostrarGuardando();

    clearTimeout(saveTimer);
    saveTimer = setTimeout(ejecutarGuardado, 800);
}

async function ejecutarGuardado() {
    if (Object.keys(pendingGuardar).length === 0) return;

    const batch = Object.values(pendingGuardar);
    pendingGuardar = {}

    try {
        const upserts = batch.map(d => ({
            fila: d.fila,
            columna: d.col,
            contenido: d.contenido || '',
            color_fondo: d.color_fondo || '',
            color_texto: d.color_texto || '',
            tamano_texto: d.tamano_texto || 14,
            negrita: d.negrita || false,
            updated_at: new Date().toISOString(),
            updated_by: datosUsuario.id
        }));

        const { error } = await supabaseClient
            .from('tablero_celdas')
            .upsert(upserts, { onConflict: 'fila,columna'});

        if (error) throw error;
        mostrarGuardado()
    } catch (err) {
        console.error('Error guardando celdas: ', err);
        mostrarGuardado('Error al guardar')
    }
}

// Cabeceras
async function guardarCabecera(col, el) {
    if (!esAdminTablero) return;
    const nuevo = el.innerText.trim() || `Col ${col + 1}`;
    tableroConfig.cabeceras[col] = nuevo;

    try {
        const { error } = await supabaseClient
            .from('tablero_config')
            .update({
                cabeceras: tableroConfig.cabeceras,
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

// Agregar / eliminar filas y columnas
async function agregarFila() {
    if (!esAdminTablero) return;
    tableroConfig.num_filas++;
    await guardarConfigEstructura();
    renderizarTabla()
}

async function agregarColumna() {
    if (!esAdminTablero) return;
    tableroConfig.cabeceras.push(`Col ${tableroConfig.num_columnas + 1}`);
    tableroConfig.num_columnas++;
    await guardarConfigEstructura();
    renderizarTabla()
}

async function eliminarFila(fila) {
    if (!esAdminTablero) return;
    if (!confirm(`¿Eliminar fila ${fila + 1}? Se borrarán todos sus datos.`)) return

    mostrarGuardando('Eliminando...')

    try {
        // Eliminar celdas de esa fila
        await supabaseClient
            .from('tablero_celdas')
            .delete()
            .eq('fila', fila);
        
        // Re-numerar celdas de filas posteriores
        const { data: celdasPosteriores } = await supabaseClient
            .from('tablero_celdas')
            .select('*')
            .gt('fila', fila);

        if (celdasPosteriores && celdasPosteriores.length > 0) {
            // Eliminar las posteriores y reinsertarlas con fila -1
            await supabaseClient
                .from('tablero_celdas')
                .delete()
                .gt('fila', fila);

            const renumeradas = celdasPosteriores.map(c => ({ ...c, fila: c.fila - 1, id: undefined }));
            if (renumeradas.length > 0) {
                await supabaseClient.from('tablero_celdas').insert(renumeradas);
            }
        }

        tableroConfig.num_filas--;

        // Actualizar mapa local
        const nuevoMapa = {};
        Object.entries(tableroCeldas).forEach(([key, val]) => {
            const [f, c] = key.split('-').map(Number);
            if (f === fila) return;
            const nuevaFila = f > fila ? f - 1 : f;
            nuevoMapa[`${nuevaFila}-${c}`] = val;
        });

        tableroCeldas = nuevoMapa;

        await guardarConfigEstructura();
        renderizarTabla();
        mostrarGuardado()
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
        // Eliminar celdas de esa columna
        await supabaseClient
            .from('tablero_celdas')
            .delete()
            .eq('columna', col);
        
        const { data: celdasPost } = await supabaseClient
            .from('tablero_celdas')
            .select('*')
            .gt('columna', col);
        
        if (celdasPost && celdasPost.length > 0) {
            await supabaseClient
                .from('tablero_celdas')
                .delete()
                .gt('columna', col);
            
            const renumeradas = celdasPost.map(c => ({ ...c, columna: c.columna - 1, id: undefined}));
            if (renumeradas.length > 0) {
                await supabaseClient.from('tablero_celdas').insert(renumeradas);
            }
        }

        tableroConfig.cabeceras.splice(col, 1);
        tableroConfig.num_columnas--;

        const nuevoMapa = {};
        Object.entries(tableroCeldas).forEach(([key, val]) => {
            const [f,c] = key.split('-').map(Number);
            if (c === col) return;
            const nuevaCol = c > col ? c - 1 : c;
            nuevoMapa[`${f}-${nuevaCol}`] = val;
        });
        tableroCeldas = nuevoMapa;

        await guardarConfigEstructura();
        renderizarTabla();
        mostrarGuardado();
    } catch (err) {
        console.error('Error eliminando columna: ', err)
        mostrarGuardado('Error')
    }
}

async function guardarConfigEstructura() {
    const { error } = await supabaseClient
        .from('tablero_config')
        .update({
            num_filas: tableroConfig.num_filas,
            num_columnas: tableroConfig.num_columnas,
            cabeceras: tableroConfig.cabeceras,
            updated_at: new Date().toISOString(),
            updated_by: datosUsuario.id
        })
        .eq('id', tableroConfig.id);
    
    if (error) console.error('Error guardando config:', error);
}

// PAN - Arrastrar para movel el tablero
function iniciarPan() {
    const area = document.getElementById('tableroScrollArea');
    if (!area) return;

    area.addEventListener('mousedown', e => {
        // Solo con boton medio o si no hay celda enfocada
        if (e.button === 1 || e.target.classList.contains('tablero-scroll-area') || e.target.classList.contains('tablero-table-wrap')) {
            panActivo = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            panScrollX = area.scrollLeft;
            panScrollY = area.scrollTop;
            area.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    window.addEventListener('mousemove', e => {
        if (!panActivo) return;
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        area.scrollLeft = panScrollX - dx;
        area.scrollTop = panScrollY - dy;
    });

    window.addEventListener('mouseup', () => {
        if (panActivo) {
            panActivo = false;
            area.style.cursor = '';
        }
    });
}

// Indicador de guardado
function mostrarGuardando(texto = 'Guardando...') {
    const ind = document.getElementById('saveIndicator');
    const txt = document.getElementById('saveText');
    if (!ind || !txt) return;
    ind.className = 'save-indicator saving';
    ind.querySelector('.material-symbols-rounded').textContent = 'sync';
    txt.textContent = texto;
}

function mostrarGuardado(texto = 'Guardado') {
    const ind = document.getElementById('saveIndicator')
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

// Utilidades
function deshabilitarToolbar() {
    document.querySelectorAll('.toolbar-btn, .toolbar-select, .color-preview-btn')
        .forEach(el => {
            el.disabled = true;
            el.style.opacity = '0.4';
            el.style.pointerEvents = 'none'
        });
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}