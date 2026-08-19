const EMAIL_CUENTA_SERVICIO = 'n8n-calendar-agent@test-clinic-450917.iam.gserviceaccount.com'

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof cargarRolUsuario === 'function') await cargarRolUsuario();
    await cargarEstadoCalendario();
});

// Cargar estado actual desde usuarios_calendar
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
        renderizarEstado(null, true)
    }
}

function renderizarEstado(registro, huboError = false) {
    const icono =  document.getElementById('calEstadoIcono');
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
    } else {
        icono.textContent = 'hourglass_top';
        titulo.textContent = 'Conexión pendiente de verificar';
        descripcion.textContent = registro.ultimo_error
            ? `Último intento falló: ${registro.ultimo_error}`
            : 'Guardaste tu correo, pero aún no se ha verificado el acceso.';
        card.classList.add('cal-estado-pendiente');
    }
}

function copiarEmailBot() {
    navigator.clipboard.writeText(EMAIL_CUENTA_SERVICIO)
        .then(() => notyf.success('Correo copiado'))
        .catch(() => alert('No se pudo copiar. Selecciónalo manualmente.'));
}

async function guardarYVerificarCalendario() {
    const input = document.getElementById('calCorreoGoogle');
    const correo = input.value.trim();

    if (!correo || !correo.includes('@')) {
        alert('Ingresa un correo válido');
        return
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

        notyf.success('Correo guardado. La verificación automática estará disponible pronto.')
        await cargarEstadoCalendario();
    } catch (error) {
        console.error('Error guardando calendario:', error);
        alert('Error al guardar: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML ='<span class="material-symbols-rounded">link</span> Guardar y verificar'
    }
}