// ============================================
// CLIENTE_SHARED.JS
// Funciones compartidas entre:
// - cliente_crear.js
// - cliente_editar.js
// - cliente_recuperado-cambioDeVida.js
// ============================================


// ============================================
// FORMATO DE FECHAS
// ============================================

function formatoUS(fecha) {
    if (!fecha) return '';
    try {
        if (typeof fecha === 'string' && fecha.includes('-')) {
            const soloFecha = fecha.split('T')[0];
            const [anio, mes, dia] = soloFecha.split('-');
            return `${mes}/${dia}/${anio}`;
        }
        if (typeof fecha === 'string' && fecha.includes('/')) return fecha;
        if (fecha instanceof Date) {
            const anio = fecha.getFullYear();
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const dia = String(fecha.getDate()).padStart(2, '0');
            return `${mes}/${dia}/${anio}`;
        }
        return '';
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '';
    }
}

function formatoISO(fecha) {
    if (!fecha) return '';
    try {
        if (typeof fecha === 'string' && fecha.includes('/')) {
            const [mes, dia, anio] = fecha.split('/');
            return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        }
        if (typeof fecha === 'string' && fecha.includes('-')) {
            return fecha.split('T')[0];
        }
        if (fecha instanceof Date) {
            return fecha.toISOString().split('T')[0];
        }
        return '';
    } catch (error) {
        return '';
    }
}

function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return '';
    try {
        let fecha;
        if (fechaNacimiento.includes('/')) {
            const [mes, dia, anio] = fechaNacimiento.split('/');
            fecha = new Date(anio, mes - 1, dia);
        } else {
            fecha = new Date(fechaNacimiento);
        }
        const hoy = new Date();
        let edad = hoy.getFullYear() - fecha.getFullYear();
        const m = hoy.getMonth() - fecha.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < fecha.getDate())) edad--;
        return edad;
    } catch {
        return '';
    }
}


// ============================================
// FORMATO DE INPUTS
// ============================================

function formatearTelefono(valor) {
    const numeros = valor.replace(/\D/g, '').slice(0, 10);
    if (numeros.length === 0) return '';
    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 6) return `(${numeros.slice(0, 3)}) ${numeros.slice(3)}`;
    return `(${numeros.slice(0, 3)}) ${numeros.slice(3, 6)}-${numeros.slice(6, 10)}`;
}

function formatearSSN(valor) {
    const numeros = valor.replace(/\D/g, '').slice(0, 9);
    if (numeros.length === 0) return '';
    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 5) return `${numeros.slice(0, 3)}-${numeros.slice(3)}`;
    return `${numeros.slice(0, 3)}-${numeros.slice(3, 5)}-${numeros.slice(5, 9)}`;
}

function formatearMonto(input) {
    input.value = input.value.replace(/[^0-9.]/g, '');
}


// ============================================
// VALIDACIONES
// ============================================

function validarEmail(input) {
    const email = input.value;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !regex.test(email)) {
        input.setCustomValidity('Email inválido');
        input.reportValidity();
    } else {
        input.setCustomValidity('');
    }
}

function validarTelefono(input) {
    const tel = input.value.replace(/\D/g, '');
    if (tel && tel.length !== 10) {
        input.setCustomValidity('Teléfono debe tener 10 dígitos');
        input.reportValidity();
    } else {
        input.setCustomValidity('');
    }
}

function validarSSN(input) {
    const ssn = input.value.replace(/\D/g, '');
    if (ssn && ssn.length !== 9) {
        input.setCustomValidity('SSN debe tener 9 dígitos');
        input.reportValidity();
    } else {
        input.setCustomValidity('');
    }
}

function validarCodigoPostal(input) {
    const cp = input.value.replace(/\D/g, '');
    if (cp && cp.length !== 5) input.value = cp.slice(0, 5);
}


// ============================================
// TABS Y NAVEGACIÓN
// ============================================

function inicializarTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            cambiarTab(this.dataset.tab);
        });
    });
}

function cambiarTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    actualizarBotonSiguiente();
}

function siguientePestana() {
    const tabs = Array.from(document.querySelectorAll('.tab-btn:not([style*="display: none"])'));
    const activeTab = document.querySelector('.tab-btn.active');
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
        cambiarTab(tabs[currentIndex + 1].dataset.tab);
    }
}

function actualizarBotonSiguiente() {
    const tabs = Array.from(document.querySelectorAll('.tab-btn:not([style*="display: none"])'));
    const activeTab = document.querySelector('.tab-btn.active');
    const currentIndex = tabs.indexOf(activeTab);
    const btnSiguiente = document.getElementById('btnSiguiente');
    if (btnSiguiente) {
        btnSiguiente.style.display = currentIndex < tabs.length - 1 ? 'inline-flex' : 'none';
    }
}

function validarPestanaActual(tab) {
    if (tab === 'info-general') return validarInfoGeneral();
    return true;
}

function validarInfoGeneral() {
    const requeridos = ['nombres', 'apellidos', 'email', 'telefono1'];
    return requeridos.every(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== '';
    });
}

function toggleSection(header) {
    const content = header.nextElementSibling;
    if (!content) return;
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    const icon = header.querySelector('.section-toggle');
    if (icon) icon.textContent = isOpen ? 'expand_more' : 'expand_less';
}

function togglePOBox() {
    const poBoxGroup = document.getElementById('poBoxGroup');
    const addressGroup = document.getElementById('addressGroup');
    const checkbox = document.getElementById('usarPOBox');
    if (!poBoxGroup || !addressGroup || !checkbox) return;
    if (checkbox.checked) {
        poBoxGroup.style.display = 'block';
        addressGroup.style.display = 'none';
    } else {
        poBoxGroup.style.display = 'none';
        addressGroup.style.display = 'block';
    }
}


// ============================================
// DEPENDIENTES
// ============================================

let dependientesCount = 0;

function agregarDependiente() {
    const modal = document.getElementById('modalDependiente');
    if (modal) {
        modal.style.display = 'flex';
        limpiarModalDependiente();
    }
}

function cerrarModalDependiente() {
    const modal = document.getElementById('modalDependiente');
    if (modal) modal.style.display = 'none';
}

function limpiarModalDependiente() {
    ['depNombre', 'depApellidos', 'depFechaNacimiento', 'depGenero',
     'depParentesco', 'depSSN', 'depEstadoMigratorio', 'depAplica'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function actualizarContadorDependientes() {
    const cards = document.querySelectorAll('.dependiente-card');
    const contador = document.getElementById('dependientesCounter');
    if (contador) contador.textContent = `(${cards.length})`;
}


// ============================================
// DOCUMENTOS
// ============================================

let documentosCount = 0;

function agregarDocumento() {
    documentosCount++;
    const container = document.getElementById('documentosContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'documento-item';
    div.id = `documento-${documentosCount}`;
    div.innerHTML = `
        <input type="file" name="doc_archivo_${documentosCount}" id="file-${documentosCount}" style="display:none;" onchange="previsualizarDocumento(${documentosCount}, this)">
        <input type="text" name="doc_notas_${documentosCount}" placeholder="Descripción del documento">
        <label for="file-${documentosCount}" class="btn-seleccionar-archivo">
            <span class="material-symbols-rounded">attach_file</span>
            Seleccionar archivo
        </label>
        <span id="nombre-archivo-${documentosCount}">Ningún archivo</span>
        <button type="button" onclick="eliminarDocumento(${documentosCount})">
            <span class="material-symbols-rounded">delete</span>
        </button>
    `;
    container.appendChild(div);
    actualizarContadorDocumentos();
}

function eliminarDocumento(id) {
    const doc = document.getElementById(`documento-${id}`);
    if (doc) doc.remove();
    actualizarContadorDocumentos();
}

function previsualizarDocumento(id, input) {
    const span = document.getElementById(`nombre-archivo-${id}`);
    if (span && input.files[0]) span.textContent = input.files[0].name;
}

function actualizarContadorDocumentos() {
    const items = document.querySelectorAll('.documento-item');
    const contador = document.getElementById('documentosCounter');
    if (contador) contador.textContent = `(${items.length})`;
}


// ============================================
// MÉTODO DE PAGO
// ============================================

// function mostrarFormularioPago(tipo) {
//     document.querySelectorAll('.pago-form').forEach(f => f.style.display = 'none');
//     if (tipo) {
//         const form = document.getElementById(`pago-${tipo}`);
//         if (form) form.style.display = 'block';
//     }
// }

// function limpiarMetodoPago() {
//     const select = document.getElementById('tipoPago');
//     if (select) select.value = '';
//     document.querySelectorAll('.pago-form').forEach(f => f.style.display = 'none');
//     document.querySelectorAll('.pago-form input').forEach(i => i.value = '');
// }


// ============================================
// NOTAS — QUILL
// ============================================

function actualizarContadorNotas() {
    const total = document.querySelectorAll('.nota-card').length;
    const contador = document.getElementById('notasCounter');
    if (contador) contador.textContent = `(${total})`;
}

function cancelarNota() {
    if (typeof quillNota !== 'undefined' && quillNota) quillNota.setText('');
}

async function subirImagenQuill(file) {
    try {
        if (file.size > 5 * 1024 * 1024) {
            mostrarNotificacion('Imagen muy grande (Max 5MB)', 'warning');
            return;
        }
        mostrarNotificacion('Subiendo imagen...', 'info');

        quillNota.focus();
        const range = quillNota.getSelection() || { index: quillNota.getLength() - 1 };
        const index = range.index;

        const nombreLimpio = file.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_');

        const timestamp = Date.now();
        const path = `notas/${clienteId || 'temp'}/${timestamp}_${nombreLimpio}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('documentos')
            .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage
            .from('documentos')
            .getPublicUrl(path);

        if (index > 0) {
            quillNota.insertText(index, '\n');
            quillNota.insertEmbed(index + 1, 'image', urlData.publicUrl);
            quillNota.insertText(index + 2, '\n');
            quillNota.setSelection(index + 3);
        } else {
            quillNota.insertEmbed(index, 'image', urlData.publicUrl);
            quillNota.insertText(index + 1, '\n');
            quillNota.setSelection(index + 2);
        }

        mostrarNotificacion('✅ Imagen subida', 'success');

    } catch (error) {
        console.error('Error al subir imagen:', error);
        mostrarNotificacion('Error al subir imagen', 'error');
    }
}

function procesarImagenesEnNotas(contenedor) {
    const imgs = contenedor.querySelectorAll('.nota-mensaje img');
    imgs.forEach((img) => {
        img.style.width = '150px';
        img.style.height = '150px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.cursor = 'pointer';
        img.style.margin = '4px';

        const notaCard = img.closest('.nota-card');
        const todasLasImgs = Array.from(
            notaCard.querySelectorAll('.nota-mensaje img')
        ).map(i => i.src);

        const index = todasLasImgs.indexOf(img.src);

        img.addEventListener('click', function() {
            abrirVisorImagenes(todasLasImgs, index);
        });
    });
}

function abrirVisorImagenes(imagenes, indexInicial) {
    const visorExistente = document.getElementById('visorImagenes');
    if (visorExistente) document.body.removeChild(visorExistente);

    let actual = indexInicial;

    const modal = document.createElement('div');
    modal.id = 'visorImagenes';
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.88);
        display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
        <button id="visorCerrar" style="position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.5);border:none;color:white;font-size:1.4rem;cursor:pointer;z-index:10000;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;">✕</button>
        <button id="visorPrev" style="position:absolute;left:24px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;font-size:3rem;cursor:pointer;${imagenes.length <= 1 ? 'display:none' : ''}">‹</button>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;max-width:90vw;">
            <img id="visorImg" src="${imagenes[actual]}" style="max-width:85vw;max-height:80vh;border-radius:10px;object-fit:contain;display:block;">
            <span id="visorContador" style="color:white;font-size:0.85rem;opacity:0.7;">${actual + 1} / ${imagenes.length}</span>
        </div>
        <button id="visorNext" style="position:absolute;right:24px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;font-size:3rem;cursor:pointer;${imagenes.length <= 1 ? 'display:none' : ''}">›</button>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    function actualizar() {
        document.getElementById('visorImg').src = imagenes[actual];
        document.getElementById('visorContador').textContent = `${actual + 1} / ${imagenes.length}`;
    }

    document.getElementById('visorCerrar').onclick = cerrar;
    modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });

    document.getElementById('visorPrev').onclick = function() {
        actual = actual === 0 ? imagenes.length - 1 : actual - 1;
        actualizar();
    };
    document.getElementById('visorNext').onclick = function() {
        actual = actual === imagenes.length - 1 ? 0 : actual + 1;
        actualizar();
    };

    function onKey(e) {
        if (e.key === 'Escape') cerrar();
        if (e.key === 'ArrowLeft') { actual = actual === 0 ? imagenes.length - 1 : actual - 1; actualizar(); }
        if (e.key === 'ArrowRight') { actual = actual === imagenes.length - 1 ? 0 : actual + 1; actualizar(); }
    }
    document.addEventListener('keydown', onKey);

    function cerrar() {
        if (!document.body.contains(modal)) return;
        document.body.removeChild(modal);
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onKey);
    }
}


// ============================================
// AUTH Y USUARIO
// ============================================

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && userMenu && !userMenu.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

async function cerrarSesion() {
    if (!confirm('¿Estás seguro de que deseas cerrar sesión?')) return;
    try {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../index.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert('Error al cerrar sesión: ' + error.message);
    }
}

async function cargarInfoUsuario() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const user = session?.user;

        if (!user) {
            window.location.href = '../index.html';
            return;
        }

        const email = user.email || 'usuario@ejemplo.com';
        const metadata = user.user_metadata || {};
        let nombreCompleto = metadata.full_name || metadata.name || metadata.display_name || email.split('@')[0];
        const primerNombre = nombreCompleto.split(' ')[0];

        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.querySelector('.user-avatar');
        const nombreUsuario = document.querySelector('.nombre-usuario');

        if (userName) userName.textContent = primerNombre;
        if (userEmail) userEmail.textContent = email;
        if (nombreUsuario) nombreUsuario.textContent = primerNombre;

        if (userAvatar) {
            if (metadata.avatar_url || metadata.picture) {
                userAvatar.src = metadata.avatar_url || metadata.picture;
            } else {
                const iniciales = obtenerIniciales(nombreCompleto);
                const colorFondo = generarColorDesdeTexto(email);
                userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(iniciales)}&background=${colorFondo}&color=fff&size=80&bold=true`;
            }
            userAvatar.alt = nombreCompleto;
        }
    } catch (error) {
        console.error('Error al cargar info de usuario:', error);
    }
}

function obtenerIniciales(nombre) {
    if (!nombre) return 'U';
    const palabras = nombre.trim().split(' ').filter(p => p.length > 0);
    if (palabras.length === 0) return 'U';
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

function generarColorDesdeTexto(texto) {
    if (!texto) return '667eea';
    const colores = ['667eea','764ba2','f093fb','4facfe','43e97b','fa709a','fee140','30cfd0','a8edea','ff6b6b'];
    let hash = 0;
    for (let i = 0; i < texto.length; i++) hash = texto.charCodeAt(i) + ((hash << 5) - hash);
    return colores[Math.abs(hash) % colores.length];
}


// ============================================
// NOTIFICACIONES
// ============================================

function mostrarNotificacion(mensaje, tipo = 'info') {
    let notif = document.getElementById('notificacionGlobal');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'notificacionGlobal';
        notif.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            padding: 16px 24px; border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            font-weight: 600; font-size: 0.95rem;
            z-index: 10001; opacity: 0;
            transform: translateX(400px);
            transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            color: white;
        `;
        document.body.appendChild(notif);
    }
    const colores = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    notif.style.background = colores[tipo] || colores.info;
    notif.textContent = mensaje;
    notif.style.opacity = '1';
    notif.style.transform = 'translateX(0)';
    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateX(400px)';
    }, 3000);
}