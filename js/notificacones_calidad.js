// ============================================
// NOTIFICACIONES DE CONTROL DE CALIDAD
// ============================================

async function verificarNotificacionesCalidad() {
    if (!datosUsuario) return;
    // Admins no reciben notificaciones de sus propias evaluaciones
    if (esAdministrador()) return;

    const { data } = await supabaseClient
        .from('notificaciones_calidad')
        .select('*')
        .eq('operador_id', datosUsuario.id)
        .eq('leida', false)
        .order('created_at', { ascending: false })
        .limit(5);

    if (!data || data.length === 0) return;

    // Si hay varias, agrupar en una sola
    if (data.length > 1) {
        mostrarNotifCCAgrupada(data);
    } else {
        mostrarNotifCC(data[0]);
    }
}

function mostrarNotifCC(notif) {
    const id = `notif-cc-${notif.id}`;
    if (document.getElementById(id)) return;

    const esAprobada = notif.resultado === 'approved';
    const color = esAprobada ? '#22c55e' : '#ef4444';
    const icono = esAprobada ? 'check_circle' : 'cancel';
    const texto = esAprobada ? 'Aprobada ✅' : 'Rechazada ❌';

    const el = document.createElement('div');
    el.id = id;
    el.dataset.evalId = notif.evaluacion_id;
    el.style.cssText = `
        position: fixed; top: 70px; right: 16px;
        z-index: 9999; cursor: pointer;
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    el.innerHTML = `
        <div id="${id}-contenido" style="
            background: white;
            border-left: 4px solid ${color};
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            padding: 14px 16px;
            min-width: 280px; max-width: 320px;
            transition: all 0.35s ease;
        ">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span class="material-symbols-rounded" style="color:${color};font-size:1.3rem">${icono}</span>
                <strong style="font-size:0.9rem;color:#1e293b">Evaluación de Calidad</strong>
            </div>
            <p style="margin:0;font-size:0.83rem;color:#64748b">
                <strong style="color:#1e293b">${notif.cliente_nombre || 'Cliente'}</strong><br>
                Resultado: <span style="color:${color};font-weight:600">${texto}</span>
            </p>
            <small style="color:#94a3b8;font-size:0.75rem;display:block;margin-top:6px">
                Haz clic para ver la evaluación
            </small>
        </div>
    `;

    document.body.appendChild(el);

    // 3s → contraer a línea
    const timer = setTimeout(() => contraerNotifCC(el, color), 3000);

    el.addEventListener('click', () => {
        clearTimeout(timer);
        irAEvaluacionCC(notif, el);
    });

    el.addEventListener('mouseenter', () => {
        if (el.dataset.contraido === 'true') expandirNotifCC(el, color, notif.cliente_nombre, texto);
    });

    el.addEventListener('mouseleave', () => {
        if (el.dataset.contraido === 'true') {
            setTimeout(() => {
                if (el.dataset.contraido === 'true') contraerNotifCC(el, color);
            }, 1500);
        }
    });
}

function contraerNotifCC(el, color) {
    el.dataset.contraido = 'true';
    const contenido = el.querySelector('[id$="-contenido"]');
    if (!contenido) return;
    contenido.style.cssText = `
        background: ${color};
        width: 6px; height: 48px;
        border-radius: 3px;
        min-width: unset; padding: 0;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: all 0.35s ease;
    `;
}

function expandirNotifCC(el, color, clienteNombre, texto) {
    el.dataset.contraido = 'false';
    const contenido = el.querySelector('[id$="-contenido"]');
    if (!contenido) return;
    contenido.style.cssText = `
        background: white;
        border-left: 4px solid ${color};
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        padding: 14px 16px;
        min-width: 280px; max-width: 320px;
        transition: all 0.35s ease;
    `;
}

function mostrarNotifCCAgrupada(notifs) {
    const id = 'notif-cc-agrupada';
    if (document.getElementById(id)) return;

    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = `
        position: fixed; top: 70px; right: 16px;
        z-index: 9999; cursor: pointer;
        transition: all 0.4s ease;
    `;

    el.innerHTML = `
        <div id="${id}-contenido" style="
            background: white; border-left: 4px solid #6366f1;
            border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            padding: 14px 16px; min-width: 280px; max-width: 320px;
            transition: all 0.35s ease;
        ">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span class="material-symbols-rounded" style="color:#6366f1;font-size:1.3rem">verified</span>
                <strong style="font-size:0.9rem;color:#1e293b">Evaluaciones de Calidad</strong>
            </div>
            <p style="margin:0;font-size:0.83rem;color:#64748b">
                Tienes <strong style="color:#6366f1">${notifs.length} evaluaciones nuevas</strong>
            </p>
            <small style="color:#94a3b8;font-size:0.75rem;display:block;margin-top:6px">
                Haz clic para ver tu historial
            </small>
        </div>
    `;

    document.body.appendChild(el);
    setTimeout(() => {
        const c = document.getElementById(`${id}-contenido`);
        if (c) {
            c.style.cssText = `
                background: #6366f1; width: 6px; height: 48px;
                border-radius: 3px; min-width: unset; padding: 0;
                overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                transition: all 0.35s ease;
            `;
        }
    }, 3000);

    el.addEventListener('click', () => {
        el.remove();
        window.location.href = './historial_evaluacion.html';
    });
}

async function irAEvaluacionCC(notif, el) {
    await supabaseClient
        .from('notificaciones_calidad')
        .update({ leida: true })
        .eq('id', notif.id);
    el.remove();
    window.location.href = `./historial_evaluacion.html?eval=${notif.evaluacion_id}`;
}

// Llamar al cargar
document.addEventListener('DOMContentLoaded', async () => {
    // Esperar a que cargarRolUsuario() se ejecute primero
    setTimeout(verificarNotificacionesCalidad, 1500);
});