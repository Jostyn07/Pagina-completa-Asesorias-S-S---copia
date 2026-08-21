const EMAIL_CUENTA_SERVICIO = 'asesoriasth-calendar-sync@landing-page-465315.iam.gserviceaccount.com';

const notyf = typeof Notyf !== 'undefined'
    ? new Notyf({ duration: 4000, position: { x: 'right', y: 'top' } })
    : null;

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof cargarRolUsuario === 'function') await cargarRolUsuario();
    await cargarEstadoCalendario();
    await inicializarCalendarioVisual();
    await cargarSelectorUsuarios();
});

// ── Cargar estado actual desde usuarios_calendar ──
async function cargarEstadoCalendario() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data, error } = await supabaseClient
            .from('usuarios_calendar')
            .select('*')
            .eq('usuario_id', user.id)
            .maybeSingle();

        if (error) throw error;

        renderizarEstado(data);

        if (data?.calendar_id) {
            document.getElementById('calCorreoGoogle').value = data.calendar_id;
        }
    } catch (error) {
        console.error('Error cargando estado de calendario:', error);
        renderizarEstado(null, true);
    }
}

function toggleInstrucciones() {
    const card = document.getElementById('calInstruccionesCard');
    const btn = document.getElementById('btnToggleInstrucciones');
    const visible = card.style.display !== 'none';

    card.style.display = visible ? 'none' : 'block';
    btn.innerHTML = visible
        ? '<span class="material-symbols-rounded">help_outline</span> Ver instrucciones de conexión'
        : '<span class="material-symbols-rounded">expand_less</span> Ocultar instrucciones';
}

function renderizarEstado(registro, huboError = false) {
    const icono = document.getElementById('calEstadoIcono');
    const titulo = document.getElementById('calEstadoTitulo');
    const descripcion = document.getElementById('calEstadoDescripcion');
    const card = document.getElementById('calEstadoCard');

    card.classList.remove('cal-estado-ok', 'cal-estado-pendiente', 'cal-estado-error');

    if (huboError) {
        icono.textContent = 'error';
        titulo.textContent = 'No se pudo cargar el estado';
        descripcion.textContent = 'Intenta recargar la página.';
        card.classList.add('cal-estado-error');
        return;
    }

    if (!registro) {
        icono.textContent = 'link_off';
        titulo.textContent = 'Calendario no conectado';
        descripcion.textContent = 'Sigue los pasos abajo para conectar tu Google Calendar.';
        card.classList.add('cal-estado-pendiente');
        return;
    }

    if (registro.compartido) {
    icono.textContent = 'check_circle';
    titulo.textContent = 'Calendario conectado';
    descripcion.textContent = `Tus recordatorios se sincronizan con ${registro.calendar_id}`;
    card.classList.add('cal-estado-ok');

    // Ya está conectado: ocultar instrucciones por defecto, mostrar botón para volver a verlas
    document.getElementById('calInstruccionesCard').style.display = 'none';
    document.getElementById('btnToggleInstrucciones').style.display = 'flex';

    } else {
        icono.textContent = 'hourglass_top';
        titulo.textContent = 'Conexión pendiente de verificar';
        descripcion.textContent = registro.ultimo_error
            ? `Último intento falló: ${registro.ultimo_error}`
            : 'Guardaste tu correo, pero aún no se ha verificado el acceso.';
        card.classList.add('cal-estado-pendiente');

        // Aún no conectado: instrucciones visibles, sin botón de toggle
        document.getElementById('calInstruccionesCard').style.display = 'block';
        document.getElementById('btnToggleInstrucciones').style.display = 'none';
    }

}

// ── Guardar correo + verificar acceso real contra Google ──
async function guardarYVerificarCalendario() {
    const input = document.getElementById('calCorreoGoogle');
    const correo = input.value.trim();

    if (!correo || !correo.includes('@')) {
        alert('Ingresa un correo válido');
        return;
    }

    const btn = document.getElementById('btnGuardarCalendario');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Sin sesión activa');

        const { error } = await supabaseClient
            .from('usuarios_calendar')
            .upsert({
                usuario_id: user.id,
                calendar_id: correo,
                updated_at: new Date().toISOString()
            }, { onConflict: 'usuario_id' });

        if (error) throw error;

        btn.textContent = 'Verificando...';

        const { data: { session } } = await supabaseClient.auth.getSession();
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-verificar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        const resultado = await resp.json();

        if (resultado.ok) {
            notyf ? notyf.success('¡Calendario conectado correctamente!') : alert('¡Calendario conectado correctamente!');
        } else {
            notyf ? notyf.error(resultado.error || 'No se pudo verificar el acceso todavía.') : alert(resultado.error || 'No se pudo verificar el acceso todavía.');
        }

        await cargarEstadoCalendario();
        await inicializarCalendarioVisual();

    } catch (error) {
        console.error('Error guardando calendario:', error);
        alert('Error al guardar: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">link</span> Guardar y verificar';
    }
}

// ── Cargar agenda de eventos próximos ──
let calendarioInstancia = null;

function inicializarCalendarioVisual(usuarioIdObjetivo = null) {
    const el = document.getElementById('calGrid');
    if (!el) return;

    if (calendarioInstancia) {
        calendarioInstancia.destroy();
    }

    calendarioInstancia = new FullCalendar.Calendar(el, {
        initialView: 'dayGridMonth',
        locale: 'es',
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        buttonText: { today: 'Hoy' },

        events: async (info, successCallback, failureCallBack) => {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-eventos`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        usuario_id_objetivo: usuarioIdObjetivo,
                        time_min: info.startStr,
                        time_max: info.endStr
                    })
                });

                const data = await resp.json();

                if (data.error || !data.eventos) {
                    successCallback([]);
                    return;
                }

                const eventosFormateados = data.eventos.map(ev => ({
                    title: ev.summary || '(Sin titulo)',
                    start: ev.start.dateTime || ev.start.date,
                    end: ev.end?.dateTime || ev.end?.date,
                    allDay: !ev.start.dateTime
                }));

                successCallback(eventosFormateados);
            } catch (error) {
                console.error('Error cargando eventos del calendario:', error);
                failureCallBack(error);
            }
        }
    });

    calendarioInstancia.render();
}

function formatearFechaEvento(fechaISO) {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-CO', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit'
    });
}

// ── Selector "Ver calendario de" ──
async function cargarSelectorUsuarios() {
    const contenedorSelector = document.getElementById('calSelectorUsuario');
    const select = document.getElementById('calUsuarioSeleccionado');

    const opciones = await obtenerPersonasVisiblesCalendario();

    if (!opciones || opciones.length <= 1) return;

    select.innerHTML = opciones.map(op =>
        `<option value="${op.id}">${op.nombre}</option>`
    ).join('');

    contenedorSelector.style.display = 'flex';
}

function cambiarUsuarioCalendario() {
    const select = document.getElementById('calUsuarioSeleccionado');
    const usuarioId = select.value;
    inicializarCalendarioVisual(usuarioId);
}

async function obtenerPersonasVisiblesCalendario() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return [];

    const { data: usuarioActual, error: errorActual } = await supabaseClient
        .from('usuarios')
        .select('id, nombre, rol, es_supervisor, portales')
        .eq('id', user.id)
        .single();

    if (errorActual || !usuarioActual) return [];

    let personas = [{ id: usuarioActual.id, nombre: `${usuarioActual.nombre} (yo)` }];

    if (usuarioActual.rol === 'admin_general') {
        const { data } = await supabaseClient
            .from('usuarios')
            .select('id, nombre')
            .eq('activo', true)
            .neq('id', usuarioActual.id)
            .order('nombre');
        personas = personas.concat(data || []);

    } else if (usuarioActual.rol === 'admin') {
        const misPortales = usuarioActual.portales || [];
        const { data } = await supabaseClient
            .from('usuarios')
            .select('id, nombre, portales')
            .eq('activo', true)
            .neq('id', usuarioActual.id)
            .order('nombre');
        personas = personas.concat(
            (data || []).filter(u => (u.portales || []).some(p => misPortales.includes(p)))
        );

    } else if (usuarioActual.es_supervisor) {
        const { data } = await supabaseClient
            .from('usuarios')
            .select('id, nombre')
            .eq('supervisor_id', usuarioActual.id)
            .eq('activo', true)
            .order('nombre');
        personas = personas.concat(data || []);
    }

    return personas;
}

function copiarEmailBot(idElemento) {
    const texto = document.getElementById(idElemento).textContent.trim();
    navigator.clipboard.writeText(texto)
        .then(() => notyf ? notyf.success('Correo copiado') : alert('Correo copiado'))
        .catch(() => alert('No se pudo copiar. Selecciónalo manualmente.'));
}