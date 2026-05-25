// ============================================
// IA_MONITOREO.JS — Chat con Claude integrado
// ============================================

const IA_KEY_STORAGE  = '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';
let iaChatHistorial   = [];
let iaTyping          = false;

const IA_SUGERENCIAS = [
    { label: '📊 Resumen del estado actual',        texto: 'Dame un resumen del estado actual de todos los usuarios.' },
    { label: '😴 ¿Quién lleva más tiempo inactivo?', texto: '¿Quién lleva más tiempo inactivo o desconectado? Ordénalos de mayor a menor tiempo.' },
    { label: '🗂️ Páginas con más usuarios',          texto: '¿En qué páginas hay más usuarios trabajando ahora mismo?' },
    { label: '⚠️ Usuarios que preocupan',            texto: 'Identifica usuarios en estado preocupante: llevan mucho tiempo sin actividad o están desconectados en horario laboral.' },
];

function inicializarIA() {
    inyectarIAPanel();
}

function inyectarIAPanel() {
    const panel = document.createElement('div');
    panel.id = 'iaMonitoreoWrap';
    panel.innerHTML = `
        <button class="ia-fab" id="iaFab" onclick="toggleIAPanel()" title="Analizar con IA">
            <span class="ia-fab-icon">✦</span>
            <span class="ia-fab-label">IA</span>
        </button>

        <div class="ia-panel" id="iaPanel">
            <div class="ia-panel-header">
                <div class="ia-panel-title">
                    <span class="ia-panel-icon">✦</span>
                    <div>
                        <strong>Análisis con IA</strong>
                        <small>Pregúntame sobre las estadísticas de monitoreo</small>
                    </div>
                </div>
                <div class="ia-panel-actions">
                    <button class="ia-icon-btn" onclick="limpiarChatIA()" title="Nueva conversación">
                        <span class="material-symbols-rounded">refresh</span>
                    </button>
                    <button class="ia-icon-btn" onclick="abrirConfigIA()" title="Configurar API Key">
                        <span class="material-symbols-rounded">key</span>
                    </button>
                    <button class="ia-icon-btn" onclick="toggleIAPanel()" title="Cerrar">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
            </div>

            <div class="ia-mensajes" id="iaMensajes">
                <div class="ia-bienvenida">
                    <div class="ia-bienvenida-icon">✦</div>
                    <p>Hola, soy Claude. Tengo acceso en tiempo real a los datos de monitoreo. ¿Qué quieres saber?</p>
                </div>
                <div class="ia-chips" id="iaChips">
                    ${IA_SUGERENCIAS.map((s, i) => `
                        <button class="ia-chip" data-idx="${i}" onclick="enviarSugerenciaIA(this)">
                            ${s.label}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="ia-input-area">
                <textarea
                    id="iaInput"
                    class="ia-textarea"
                    placeholder="Pregunta algo sobre los datos de monitoreo..."
                    rows="1"
                    onkeydown="iaKeydown(event)"
                    oninput="autoResizeIA(this)"
                ></textarea>
                <button class="ia-send-btn" id="iaSendBtn" onclick="enviarMensajeIA()">
                    <span class="material-symbols-rounded">send</span>
                </button>
            </div>
        </div>

        <div class="ia-config-overlay" id="iaConfigOverlay" style="display:none">
            <div class="ia-config-modal">
                <h3>🔑 API Key de Anthropic</h3>
                <p>Esta clave se guarda localmente en tu navegador y nunca se comparte.</p>
                <input
                    type="password"
                    id="iaApiKeyInput"
                    class="ia-config-input"
                    placeholder="sk-ant-api03-..."
                    autocomplete="off"
                />
                <div class="ia-config-btns">
                    <button class="ia-config-cancel" onclick="cerrarConfigIA()">Cancelar</button>
                    <button class="ia-config-save"   onclick="guardarApiKeyIA()">Guardar</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
}

function toggleIAPanel() {
    const panel   = document.getElementById('iaPanel');
    const fab     = document.getElementById('iaFab');
    const abierto = panel.classList.toggle('ia-panel-abierto');
    fab.classList.toggle('ia-fab-activo', abierto);
    if (abierto && !obtenerApiKeyIA()) abrirConfigIA();
}

function obtenerApiKeyIA() {
    return localStorage.getItem(IA_KEY_STORAGE) || '';
}

function abrirConfigIA() {
    const overlay = document.getElementById('iaConfigOverlay');
    const input   = document.getElementById('iaApiKeyInput');
    input.value   = obtenerApiKeyIA();
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
}

function cerrarConfigIA() {
    document.getElementById('iaConfigOverlay').style.display = 'none';
}

function guardarApiKeyIA() {
    const key = document.getElementById('iaApiKeyInput').value.trim();
    if (!key) { alert('Ingresa una API key válida'); return; }
    localStorage.setItem(IA_KEY_STORAGE, key);
    cerrarConfigIA();
    mostrarToastIA('✅ API Key guardada correctamente');
}

function construirSystemPrompt() {
    const ahora = new Date().toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' });

    const activos       = sesionesActuales.filter(s => s.estado === 'activo').length;
    const inactivos     = sesionesActuales.filter(s => s.estado === 'inactivo').length;
    const desconectados = sesionesActuales.filter(s => s.estado === 'desconectado').length;

    const sesionesDetalle = sesionesActuales.map(s => {
        const min = s.ultima_actividad
            ? Math.round((Date.now() - new Date(s.ultima_actividad).getTime()) / 60000)
            : null;
        return {
            nombre:           s.usuario_nombre || 'Desconocido',
            estado:           s.estado || 'desconectado',
            pagina_actual:    s.pagina_actual || 'N/A',
            ultima_actividad: s.ultima_actividad
                ? `hace ${min === 0 ? 'menos de 1' : min} min (${new Date(s.ultima_actividad).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})`
                : 'Sin registro'
        };
    });

    return `Eres un asistente de análisis integrado en la plataforma S&S Asesorías, especializado en interpretar datos de monitoreo de actividad de usuarios.

Responde siempre en español. Sé conciso, directo y usa formato claro con emojis moderados. Cuando presentes listas usa viñetas (•). Si no tienes datos suficientes para responder algo, dilo claramente.

FECHA Y HORA ACTUAL: ${ahora}

ESTADÍSTICAS GENERALES:
- Activos: ${activos}
- Inactivos: ${inactivos}
- Desconectados: ${desconectados}
- Total usuarios: ${sesionesActuales.length}

DETALLE DE SESIONES (datos en tiempo real):
${JSON.stringify(sesionesDetalle, null, 2)}

Definiciones de estados:
- "activo": interactuó en los últimos 5 minutos.
- "inactivo": pestaña abierta pero sin interacción en más de 5 minutos.
- "desconectado": sin sesión registrada o cerró la aplicación.`;
}

async function enviarMensajeIA(textoForzado) {
    if (iaTyping) return;

    const apiKey = obtenerApiKeyIA();
    if (!apiKey) { abrirConfigIA(); return; }

    const inputEl = document.getElementById('iaInput');
    const texto   = textoForzado ?? inputEl.value.trim();
    if (!texto) return;

    if (!textoForzado) inputEl.value = '';
    autoResizeIA(inputEl);
    ocultarChipsIA();
    agregarMensajeDOM('user', texto);
    iaChatHistorial.push({ role: 'user', content: texto });

    iaTyping = true;
    actualizarBtnSend(true);
    const typingEl = mostrarTypingIA();

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model:      'claude-sonnet-4-6',
                max_tokens: 1024,
                system:     construirSystemPrompt(),
                messages:   iaChatHistorial
            })
        });

        typingEl.remove();

        if (!response.ok) {
            const err     = await response.json().catch(() => ({}));
            const detalle = err?.error?.message || `HTTP ${response.status}`;
            if (response.status === 401) {
                agregarMensajeDOM('error', `❌ API Key inválida o sin permisos. (${detalle})`);
                abrirConfigIA();
            } else {
                agregarMensajeDOM('error', `❌ Error al consultar la IA: ${detalle}`);
            }
            console.error('❌ Anthropic API error:', response.status, err);
            iaChatHistorial.pop();
            return;
        }

        const data      = await response.json();
        const respuesta = data.content?.[0]?.text || 'Sin respuesta.';
        iaChatHistorial.push({ role: 'assistant', content: respuesta });
        agregarMensajeDOM('assistant', respuesta);

    } catch (error) {
        typingEl?.remove();
        agregarMensajeDOM('error', `❌ Error de red: ${error.message}`);
        iaChatHistorial.pop();
        console.error('❌ Error fetch IA:', error);
    } finally {
        iaTyping = false;
        actualizarBtnSend(false);
    }
}

function enviarSugerenciaIA(btnEl) {
    const idx   = parseInt(btnEl.dataset.idx, 10);
    const texto = IA_SUGERENCIAS[idx]?.texto;
    if (!texto) return;
    btnEl.disabled = true;
    enviarMensajeIA(texto);
}

function agregarMensajeDOM(rol, texto) {
    const contenedor = document.getElementById('iaMensajes');
    const div = document.createElement('div');
    div.className = `ia-msg ia-msg-${rol}`;

    if (rol === 'assistant') {
        div.innerHTML = `
            <div class="ia-msg-avatar">✦</div>
            <div class="ia-msg-burbuja">${formatearRespuestaIA(texto)}</div>
        `;
    } else if (rol === 'user') {
        div.innerHTML = `<div class="ia-msg-burbuja">${escapeIAHtml(texto)}</div>`;
    } else {
        div.innerHTML = `<div class="ia-msg-burbuja ia-msg-error-burbuja">${texto}</div>`;
    }

    contenedor.appendChild(div);
    contenedor.scrollTop = contenedor.scrollHeight;
}

function mostrarTypingIA() {
    const contenedor = document.getElementById('iaMensajes');
    const div = document.createElement('div');
    div.className = 'ia-msg ia-msg-assistant ia-typing-wrap';
    div.innerHTML = `
        <div class="ia-msg-avatar">✦</div>
        <div class="ia-msg-burbuja ia-typing">
            <span></span><span></span><span></span>
        </div>
    `;
    contenedor.appendChild(div);
    contenedor.scrollTop = contenedor.scrollHeight;
    return div;
}

function ocultarChipsIA() {
    const chips = document.getElementById('iaChips');
    if (chips) chips.style.display = 'none';
}

function limpiarChatIA() {
    iaChatHistorial = [];
    const mensajes = document.getElementById('iaMensajes');
    mensajes.innerHTML = `
        <div class="ia-bienvenida">
            <div class="ia-bienvenida-icon">✦</div>
            <p>Conversación reiniciada. ¿Qué quieres analizar?</p>
        </div>
        <div class="ia-chips" id="iaChips">
            ${IA_SUGERENCIAS.map((s, i) => `
                <button class="ia-chip" data-idx="${i}" onclick="enviarSugerenciaIA(this)">
                    ${s.label}
                </button>
            `).join('')}
        </div>
    `;
}

function actualizarBtnSend(cargando) {
    const btn = document.getElementById('iaSendBtn');
    if (!btn) return;
    btn.disabled  = cargando;
    btn.innerHTML = cargando
        ? '<span class="material-symbols-rounded mon-spin">autorenew</span>'
        : '<span class="material-symbols-rounded">send</span>';
}

function mostrarToastIA(msg) {
    const t = document.createElement('div');
    t.className   = 'ia-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function formatearRespuestaIA(texto) {
    let html = escapeIAHtml(texto);
    const lineas    = html.split('\n');
    const resultado = [];
    let enLista     = false;

    for (let linea of lineas) {
        const esItem = /^[•\-\*]\s+(.+)$/.test(linea);
        if (esItem) {
            if (!enLista) { resultado.push('<ul>'); enLista = true; }
            resultado.push(`<li>${linea.replace(/^[•\-\*]\s+/, '')}</li>`);
        } else {
            if (enLista) { resultado.push('</ul>'); enLista = false; }
            resultado.push(linea.trim() === '' ? '<br>' : `<p>${linea}</p>`);
        }
    }
    if (enLista) resultado.push('</ul>');

    return resultado.join('')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,     '<em>$1</em>')
        .replace(/`(.+?)`/g,       '<code>$1</code>');
}

function escapeIAHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function iaKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensajeIA();
    }
}

function autoResizeIA(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

document.addEventListener('DOMContentLoaded', inicializarIA);