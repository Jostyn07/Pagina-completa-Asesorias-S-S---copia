// ============================================
// IA_CHAT.JS — Asistente global S&S Asesorías
// Depende de: permisos.js, ia_contexto.js
// ============================================

let iaChatHistorial = [];
let iaTyping        = false;
let iaModuloActual  = 'general';
let iaContextoCache = null;

const IA_MODULOS = {
    'home.html':                           'home',
    'polizas.html':                        'polizas',
    'monitoreo.html':                      'monitoreo',
    'cliente_crear.html':                  'clientes',
    'cliente_editar.html':                 'clientes',
    'cliente_recuperado-cambioDeVida.html':'clientes',
    'clientes_archivados.html':            'archivados',
    'control_calidad.html':                'calidad',
    'historial_evaluacion.html':           'calidad',
    'graficas.html':                       'graficas',
    'para-revisar.html':                   'revision',
    'usuarios.html':                       'usuarios'
};

const IA_CHIPS = {
    home: [
        { label: '📊 Resumen del período',       texto: 'Dame un resumen de las pólizas y estadísticas del período actual.' },
        { label: '🏆 Ranking de operadores',      texto: 'Muéstrame el ranking actual de operadores por ventas.' },
        { label: '🎂 Cumplen años hoy',           texto: 'Muéstrame los clientes que cumplen años hoy.' },
        { label: '⚠️ Docs incompletos',          texto: 'Muéstrame los clientes con documentación incompleta o pendiente.' },
    ],
    polizas: [
        { label: '📋 Resumen de cartera',         texto: 'Dame un resumen general de la cartera de pólizas.' },
        { label: '📅 Próximas a vencer',          texto: 'Muéstrame los clientes con pólizas próximas a vencer en 30 días.' },
        { label: '❌ Canceladas recientes',       texto: 'Muéstrame los clientes con pólizas canceladas recientemente.' },
        { label: '🏢 Por compañía',               texto: '¿Cómo están distribuidas las pólizas por compañía aseguradora?' },
        { label: '📄 Docs pendientes',            texto: 'Muéstrame los clientes con documentación pendiente o incompleta.' },
    ],
    monitoreo: [
        { label: '👀 Estado actual',              texto: 'Dame un resumen del estado actual de todos los usuarios conectados.' },
        { label: '😴 Más tiempo inactivo',        texto: '¿Quién lleva más tiempo inactivo? Ordénalos de mayor a menor.' },
        { label: '🗂️ Páginas en uso',             texto: '¿En qué páginas están trabajando los usuarios ahora mismo?' },
        { label: '⚠️ Usuarios preocupantes',      texto: 'Identifica usuarios desconectados o inactivos en horario laboral.' },
    ],
    clientes: [
        { label: '📝 Resumen del cliente',        texto: 'Dame un resumen completo del cliente que estoy viendo ahora.' },
        { label: '📋 Docs pendientes',            texto: '¿Qué documentos están pendientes para este cliente?' },
        { label: '👨‍👩‍👧 Dependientes',           texto: 'Muéstrame el detalle de los dependientes registrados.' },
    ],
    archivados: [
        { label: '🔄 Candidatos a recuperar',     texto: 'Muéstrame los clientes archivados que podrían recuperarse.' },
        { label: '📦 Motivos de archivado',       texto: 'Analiza los motivos más frecuentes de archivado de clientes.' },
    ],
    calidad: [
        { label: '📊 Tendencia de evaluaciones',  texto: 'Analiza la tendencia de las evaluaciones de calidad recientes.' },
        { label: '⚠️ Áreas de mejora',            texto: 'Identifica las áreas donde más se repiten errores o bajas puntuaciones.' },
    ],
    graficas: [
        { label: '📈 Interpretar tendencia',      texto: 'Interpreta la tendencia de ventas que estoy viendo.' },
        { label: '🔍 Anomalías',                  texto: '¿Hay algún mes con comportamiento inusual en los datos?' },
    ],
    revision: [
        { label: '📋 Pendientes urgentes',        texto: 'Muéstrame los casos para revisar más urgentes o con más tiempo sin atender.' },
    ],
    usuarios: [
        { label: '👥 Resumen del equipo',         texto: 'Dame un resumen del equipo: roles, supervisores y operadores activos.' },
        { label: '🔐 Permisos especiales',        texto: '¿Qué usuarios tienen permisos especiales como monitoreo o IA?' },
    ],
    general: [
        { label: '📊 Resumen general',            texto: 'Dame un resumen general de la plataforma.' },
        { label: '❓ ¿Qué puedes hacer?',         texto: '¿Qué tipo de consultas puedes responder sobre mis datos?' },
    ]
};

const MODULO_LABELS = {
    home: 'Tablero', polizas: 'Pólizas', monitoreo: 'Monitoreo',
    clientes: 'Clientes', archivados: 'Archivados', calidad: 'Calidad',
    graficas: 'Gráficas', revision: 'Para revisar', usuarios: 'Usuarios', general: 'General'
};

// ── Inicializar ───────────────────────────────
function inicializarIAChat() {
    if (typeof puedeUsarIA === 'function' && !puedeUsarIA()) return;

    const pagina   = window.location.pathname.split('/').pop();
    iaModuloActual = IA_MODULOS[pagina] || 'general';

    inyectarIAChatPanel();
}

// ── Panel HTML ────────────────────────────────
function inyectarIAChatPanel() {
    const chips = IA_CHIPS[iaModuloActual] || IA_CHIPS.general;

    const wrap = document.createElement('div');
    wrap.id = 'iaChatWrap';
    wrap.innerHTML = `
        <button class="ia-fab" id="iaFab" onclick="toggleIAChat()" title="Asistente IA">
            <span class="ia-fab-icon">✦</span>
            <span class="ia-fab-label">IA</span>
        </button>

        <div class="ia-panel" id="iaPanel">
            <div class="ia-panel-header">
                <div class="ia-panel-title">
                    <span class="ia-panel-icon">✦</span>
                    <div>
                        <strong>Asistente S&S</strong>
                        <small id="iaModuloLabel">${MODULO_LABELS[iaModuloActual] || 'General'}</small>
                    </div>
                </div>
                <div class="ia-panel-actions">
                    <button class="ia-icon-btn" id="iaBtnRefresh" onclick="refrescarContextoIA()" title="Refrescar datos">
                        <span class="material-symbols-rounded">sync</span>
                    </button>
                    <button class="ia-icon-btn" onclick="limpiarIAChat()" title="Nueva conversación">
                        <span class="material-symbols-rounded">refresh</span>
                    </button>
                    <button class="ia-icon-btn" onclick="abrirConfigIA()" title="API Key">
                        <span class="material-symbols-rounded">key</span>
                    </button>
                    <button class="ia-icon-btn" onclick="toggleIAChat()" title="Cerrar">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
            </div>

            <div class="ia-contexto-bar" id="iaContextoBar" style="display:none">
                <span class="material-symbols-rounded ia-spin">sync</span>
                <span>Cargando datos...</span>
            </div>

            <div class="ia-mensajes" id="iaMensajes">
                <div class="ia-bienvenida">
                    <div class="ia-bienvenida-icon">✦</div>
                    <p>Hola <strong>${datosUsuario?.nombre?.split(' ')[0] || ''}</strong>, tengo acceso a tus datos en tiempo real. ¿Qué quieres analizar?</p>
                </div>
                <div class="ia-chips" id="iaChips">
                    ${chips.map((c, i) => `
                        <button class="ia-chip" data-idx="${i}" data-modulo="${iaModuloActual}" onclick="enviarChipIA(this)">
                            ${c.label}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="ia-input-area">
                <textarea
                    id="iaInput"
                    class="ia-textarea"
                    placeholder="Pregunta algo sobre tus datos..."
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
                <p>Se guarda en tu navegador y nunca se comparte.</p>
                <input type="password" id="iaApiKeyInput" class="ia-config-input"
                    placeholder="sk-ant-api03-..." autocomplete="off"/>
                <div class="ia-config-btns">
                    <button class="ia-config-cancel" onclick="cerrarConfigIA()">Cancelar</button>
                    <button class="ia-config-save" onclick="guardarApiKeyIA()">Guardar</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(wrap);
}

// ── Abrir / cerrar ────────────────────────────
async function toggleIAChat() {
    const panel  = document.getElementById('iaPanel');
    const fab    = document.getElementById('iaFab');
    const abierto = panel.classList.toggle('ia-panel-abierto');
    fab.classList.toggle('ia-fab-activo', abierto);

    if (abierto) {
        if (!obtenerApiKeyIA()) { abrirConfigIA(); return; }
        if (!iaContextoCache) await cargarContextoIA();
    }
}

async function cargarContextoIA() {
    const bar = document.getElementById('iaContextoBar');
    if (bar) bar.style.display = 'flex';
    try {
        iaContextoCache = await construirContextoIA(iaModuloActual);
    } catch (e) {
        console.error('❌ Contexto IA:', e);
        iaContextoCache = null;
    } finally {
        if (bar) bar.style.display = 'none';
    }
}

async function refrescarContextoIA() {
    iaContextoCache = null;
    const icono = document.querySelector('#iaBtnRefresh .material-symbols-rounded');
    if (icono) icono.classList.add('ia-spin');
    await cargarContextoIA();
    if (icono) icono.classList.remove('ia-spin');
    mostrarToastIA('✅ Datos actualizados');
}

// ── Enviar mensaje ────────────────────────────
async function enviarMensajeIA(textoForzado) {
    if (iaTyping) return;

    const apiKey  = obtenerApiKeyIA();
    if (!apiKey) { abrirConfigIA(); return; }

    const inputEl = document.getElementById('iaInput');
    const texto   = textoForzado ?? inputEl.value.trim();
    if (!texto) return;

    if (!textoForzado) inputEl.value = '';
    autoResizeIA(inputEl);
    ocultarChipsIA();
    agregarMensajeIADOM('user', texto);
    iaChatHistorial.push({ role: 'user', content: texto });

    iaTyping = true;
    actualizarBtnSendIA(true);
    const typingEl = mostrarTypingIA();

    if (!iaContextoCache) await cargarContextoIA();

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
                max_tokens: datosUsuario?.rol === 'admin' ? 2048 : 1024,
                system:     construirSystemPromptSeguro(iaContextoCache),
                messages:   iaChatHistorial
            })
        });

        typingEl.remove();

        if (!response.ok) {
            const err     = await response.json().catch(() => ({}));
            const detalle = err?.error?.message || `HTTP ${response.status}`;
            if (response.status === 401) {
                agregarMensajeIADOM('error', `❌ API Key inválida. (${detalle})`);
                abrirConfigIA();
            } else {
                agregarMensajeIADOM('error', `❌ Error: ${detalle}`);
            }
            console.error('❌ Anthropic:', response.status, err);
            iaChatHistorial.pop();
            return;
        }

        const data      = await response.json();
        const respuesta = data.content?.[0]?.text || 'Sin respuesta.';
        iaChatHistorial.push({ role: 'assistant', content: respuesta });
        agregarMensajeIADOM('assistant', respuesta);

    } catch (error) {
        typingEl?.remove();
        agregarMensajeIADOM('error', `❌ Error de red: ${error.message}`);
        iaChatHistorial.pop();
        console.error('❌ Fetch IA:', error);
    } finally {
        iaTyping = false;
        actualizarBtnSendIA(false);
    }
}

function enviarChipIA(btnEl) {
    const idx   = parseInt(btnEl.dataset.idx, 10);
    const mod   = btnEl.dataset.modulo || iaModuloActual;
    const texto = (IA_CHIPS[mod] || IA_CHIPS.general)[idx]?.texto;
    if (!texto) return;
    btnEl.disabled = true;
    enviarMensajeIA(texto);
}

// ── Renderizar clientes con links ─────────────
function renderizarClientesIA(jsonStr) {
    try {
        const clientes = JSON.parse(jsonStr.trim());
        if (!Array.isArray(clientes) || clientes.length === 0) return '';

        const items = clientes.map(c => `
            <a href="./cliente_editar.html?id=${encodeURIComponent(c.id)}"
               class="ia-cliente-card"
               target="_blank"
               onclick="event.stopPropagation()">
                <span class="ia-cliente-avatar">${obtenerInicialesIA(c.nombre)}</span>
                <div class="ia-cliente-info">
                    <strong>${escapeIAHtml(c.nombre || 'Sin nombre')}</strong>
                    ${c.info ? `<small>${escapeIAHtml(c.info)}</small>` : ''}
                </div>
                <span class="material-symbols-rounded ia-cliente-arrow">open_in_new</span>
            </a>
        `).join('');

        return `<div class="ia-clientes-lista">${items}</div>`;

    } catch (e) {
        console.warn('⚠️ IA: no se pudo parsear bloque <clientes>', e);
        return '';
    }
}

function obtenerInicialesIA(nombre) {
    if (!nombre) return '?';
    const p = nombre.trim().split(' ').filter(Boolean);
    if (p.length === 1) return p[0][0].toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ── Formato de respuesta ──────────────────────
function formatearRespuestaIA(texto) {
    // 1. Extraer y renderizar bloques <clientes>
    let html = texto.replace(
        /<clientes>([\s\S]*?)<\/clientes>/g,
        (_, json) => `__CLIENTES__${btoa(encodeURIComponent(json))}__`
    );

    // 2. Escapar HTML del texto restante
    html = escapeIAHtml(html);

    // 3. Restaurar bloques de clientes ya renderizados
    html = html.replace(
        /&lt;clientes&gt;([\s\S]*?)&lt;\/clientes&gt;/g, ''
    );
    html = html.replace(
        /__CLIENTES__(.*?)__/g,
        (_, b64) => renderizarClientesIA(decodeURIComponent(atob(b64)))
    );

    // 4. Markdown inline
    const lineas  = html.split('\n');
    const result  = [];
    let enLista   = false;

    for (const linea of lineas) {
        // Saltear líneas que ya son HTML de clientes
        if (linea.includes('ia-clientes-lista') || linea.includes('ia-cliente-card')) {
            result.push(linea);
            continue;
        }
        if (/^[•\-\*]\s+/.test(linea)) {
            if (!enLista) { result.push('<ul>'); enLista = true; }
            result.push(`<li>${linea.replace(/^[•\-\*]\s+/, '')}</li>`);
        } else {
            if (enLista) { result.push('</ul>'); enLista = false; }
            result.push(linea.trim() === '' ? '<br>' : `<p>${linea}</p>`);
        }
    }
    if (enLista) result.push('</ul>');

    return result.join('')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,     '<em>$1</em>')
        .replace(/`(.+?)`/g,       '<code>$1</code>');
}

// ── DOM helpers ───────────────────────────────
function agregarMensajeIADOM(rol, texto) {
    const cont = document.getElementById('iaMensajes');
    const div  = document.createElement('div');
    div.className = `ia-msg ia-msg-${rol}`;

    if (rol === 'assistant') {
        div.innerHTML = `
            <div class="ia-msg-avatar">✦</div>
            <div class="ia-msg-burbuja">${formatearRespuestaIA(texto)}</div>`;
    } else if (rol === 'user') {
        div.innerHTML = `<div class="ia-msg-burbuja">${escapeIAHtml(texto)}</div>`;
    } else {
        div.innerHTML = `<div class="ia-msg-burbuja ia-msg-error-burbuja">${texto}</div>`;
    }

    cont.appendChild(div);
    cont.scrollTop = cont.scrollHeight;
}

function mostrarTypingIA() {
    const cont = document.getElementById('iaMensajes');
    const div  = document.createElement('div');
    div.className = 'ia-msg ia-msg-assistant';
    div.innerHTML = `
        <div class="ia-msg-avatar">✦</div>
        <div class="ia-msg-burbuja ia-typing">
            <span></span><span></span><span></span>
        </div>`;
    cont.appendChild(div);
    cont.scrollTop = cont.scrollHeight;
    return div;
}

function ocultarChipsIA() {
    const c = document.getElementById('iaChips');
    if (c) c.style.display = 'none';
}

function limpiarIAChat() {
    iaChatHistorial = [];
    iaContextoCache = null;
    const chips = IA_CHIPS[iaModuloActual] || IA_CHIPS.general;
    document.getElementById('iaMensajes').innerHTML = `
        <div class="ia-bienvenida">
            <div class="ia-bienvenida-icon">✦</div>
            <p>Conversación reiniciada. ¿Qué quieres analizar?</p>
        </div>
        <div class="ia-chips" id="iaChips">
            ${chips.map((c, i) => `
                <button class="ia-chip" data-idx="${i}" data-modulo="${iaModuloActual}" onclick="enviarChipIA(this)">
                    ${c.label}
                </button>
            `).join('')}
        </div>`;
}

function actualizarBtnSendIA(cargando) {
    const btn = document.getElementById('iaSendBtn');
    if (!btn) return;
    btn.disabled  = cargando;
    btn.innerHTML = cargando
        ? '<span class="material-symbols-rounded ia-spin">autorenew</span>'
        : '<span class="material-symbols-rounded">send</span>';
}

function mostrarToastIA(msg) {
    const t = document.createElement('div');
    t.className   = 'ia-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ── API Key ───────────────────────────────────
const IA_KEY_STORAGE = 'ss_anthropic_key';

function obtenerApiKeyIA()  { return localStorage.getItem(IA_KEY_STORAGE) || ''; }

function abrirConfigIA() {
    const o = document.getElementById('iaConfigOverlay');
    const i = document.getElementById('iaApiKeyInput');
    if (!o || !i) return;
    i.value = obtenerApiKeyIA();
    o.style.display = 'flex';
    setTimeout(() => i.focus(), 100);
}

function cerrarConfigIA() {
    const o = document.getElementById('iaConfigOverlay');
    if (o) o.style.display = 'none';
}

function guardarApiKeyIA() {
    const key = document.getElementById('iaApiKeyInput').value.trim();
    if (!key) { alert('Ingresa una API key válida'); return; }
    localStorage.setItem(IA_KEY_STORAGE, key);
    cerrarConfigIA();
    mostrarToastIA('✅ API Key guardada');
}

// ── Utils ─────────────────────────────────────
function escapeIAHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function iaKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensajeIA(); }
}

function autoResizeIA(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const intentar = setInterval(() => {
        if (typeof puedeUsarIA === 'function' && datosUsuario) {
            clearInterval(intentar);
            inicializarIAChat();
        }
    }, 200);
    setTimeout(() => clearInterval(intentar), 5000);
});