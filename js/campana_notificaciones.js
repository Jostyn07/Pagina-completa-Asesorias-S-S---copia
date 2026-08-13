let campanaAbierta = false;
let notificacionesCampana = [];
let camapanaUsuarioId = null;

function formatearFechaRelativa(fechaIso) {
    const fecha = newDate(fechaIso);
    const ahora = new Date();
    const diffMs = ahora - fecha;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Ahora mismo'
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffHoras = Math.floor(diffMin / 60);
    if (diffHoras < 24) return `hace ${diffHoras} h`;
    const diffDias = Math.floor(diffHoras / 24);
    return `Hace ${diffDias} d`; 
}

function iniciarCampana() {
    const container = document.createElement('div');
    container.className = 'campana-container';
    container.id = 'campanaContainer';

    container.innerHTML = `
        <button class="campana-btn" id="campanaBtn" onclick="toggleCampana()" title="Notificaciones">
            <span class="material-symbols-rounded">notifications</span>
            <span class="campana-badge hidden" id="campanaBadge">0</span>
        </button>

        <div class="campana-panel" id="campanaPanel">
            <div class="campana-panel-header">Notificaciones</div>
            <div id="campanaLista">
                <div class="campana-vacio">Cargando...</div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    document.addEventListener('click', (e) => {
        if (campanaAbierta && !container.contains(e.target)) {
            cerrarCampana();
        }
    });

    inicializarDatosCampana();
}

async function inicializarDatosCampana() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    campanaUsuarioId = user.id;
    await cargarNotificacionesCampana();
    suscribirCampanaRealtime();
}

async function cargarNotificacionesCampana() {
    if (!campanaUsuarioId) return;

    const { data, error } = await supabaseClient
        .from('notificaciones_app')
        .select('*')
        .eq('usuario_id', campanaUsuarioId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error cargando notificaciones', error);
        return
    }

    notificaionesCampana = data || [];
    renderizarCampana();
    actualizarBadgeCampana();
}

function renderizarCampana() {
    const contenedor = document.getElementById('campanaLista');
    if (!contenedor) return;

    if (notificacionesCampana.length === 0) {
        contenedor.innerHTML = `<div class="campana-vacio">No tienes notificaciones</div>`
        return;
    }

    contenedor.innerHTML = notificacionesCampana.map(n => `
        <div class="campana-item ${n.leida ? '' : 'no-leida'}" onclick="clickNotificacion('${n.id}')">
            <div class="campana-item-titulo">${n.titulo}</div>
            ${n.cuerpo ? `<div class="campana-item-cuerpo">${n.cuerpo}</div>` : ''}
            <div class="campana-item-fecha">${formatearFechaRelativa(n.created_at)}</div>
        </div>
    `).join('');
}

function actualizarBadgeCampana() {
    const noLeidas = notificacionesCampana.filter(n => !n.leida).length;
    const badge = document.getElementById('campanaBadge');
    if (!badge) return;

    if (noLeidas > 0) {
        badge.textContent = noLeidas > 99 ? '99+': noLeidas;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function toggleCampana() {
    campanaAbierta ? cerrarCampana() : abrirCampana();
}

function abrirCampana() {
    campanaAbierta = true;
    document.getElementById('campanaPanel').classList.add('open');
}

function cerrarCampana() {
    campanaAbierta = false;
    document.getElementById('campanaPanel').classList.remove('open');
}

let notyfCampana = null;

function iniciarNotyfCampana() {
    if (typeof Notyf === 'undefined') {
        console.error('Notyf no está cargado. Verifica que el CDN esté incluido antes de campana_notificaciones.js');
        return;
    }

    notyfCampana = new Notyf({
        duration: 6000,
        position: { x: 'right', y: 'top'},
        types: [
            {
                type: 'campana',
                background: '6366f1',
                icon: {
                    clasName: 'material-symbols-rounded',
                    tagName: 'span',
                    text: 'notifications'
                }
            }
        ]
    });
}

function mostrarToastNotificacion(notificacion) {
    if (!notyfCampana) return;

    const mensaje = notificacion.cuerpo
        ? `${notificacion.titulo} - ${notificacion.cuerpo}`
        : notificacion.titulo;

    const toast = notyfCampana.open({
        type: 'campana',
        message: mensaje
    });

    toast.on('click', () => {
        clickNotificacion(notificacion.id);
    });
}

function suscribirCampanaRealtime() {
    if (!campanaUsuarioId) return;

    supabaseClient
        .channel('notificaciones-app-realtime')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notificaciones_app',
            filter: `usuario_id=eq.${campanaUsuarioId}`
        }, (payload) => {
            const nueva = payload.new;
            notificaionesCampana.unshift(nueva);
            renderizarCampana();
            actualizarBadgeCampana();
            mostrarToastNotificacion(nueva);
        })
        .subscribe()
}

async function clickNotificacion(id) {
    const notificacion = notificacionesCampana.find(n => n.id === id);
    if (!notificacion) return;
    
    cerrarCampana();

    if(!notificacion.leida) {
        const { error } = await supabaseClient
            .from('notificaciones_app')
            .update({ leida: true})
            .eq('id', id);

        if (error) {
            console.error('Error marcando notificacion como leída:', error);
        } else {
            notificacion.leida = true;
            renderizarCampana();
            actualizarBadgeCampana();
        }
    }
    irNotificacion(notificacion.url)
}

function irNotificacion(url) {
    if (!url) return;

    if(url === 'recordatorios') {
        if (typeof abrirDrawerRecordatorios === 'function') {
            abrirDrawerRecordatorios();
        } else {
        console.error('Abrir drawer recordatorios no está disponible en está pagina')
        }
        return;
    } 
    window.location.href = url;
}

document.addEventListener('DOMContentLoaded', () => {
    iniciarNotyfCampana();
    inicializarDatosCampana();
    iniciarCampana();
})