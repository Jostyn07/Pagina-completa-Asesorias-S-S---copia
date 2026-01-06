// ============================================
// PEGAR IMÁGENES CON CTRL+V EN NOTAS
// ============================================

/**
 * Inicializar funcionalidad de pegar imágenes
 * Agregar esto a cliente_editar.js
 */
function inicializarPegarImagenes() {
    const textarea = document.getElementById('nuevaNota');
    
    if (!textarea) {
        console.warn('⚠️ Textarea de notas no encontrado');
        return;
    }
    
    // Evento de paste
    textarea.addEventListener('paste', async function(e) {
        const items = e.clipboardData?.items;
        
        if (!items) return;
        
        // Buscar imágenes en el portapapeles
        let imagenEncontrada = false;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Si es una imagen
            if (item.type.indexOf('image') !== -1) {
                imagenEncontrada = true;
                e.preventDefault(); // Prevenir pegado de texto
                
                const blob = item.getAsFile();
                
                if (blob) {
                    await procesarImagenPegada(blob);
                }
            }
        }
        
        if (imagenEncontrada) {
            // Mostrar feedback visual
            mostrarNotificacion('✅ Imagen pegada correctamente', 'success');
        }
    });
    
    console.log('✅ Funcionalidad de pegar imágenes inicializada');
}

/**
 * Procesar imagen pegada desde el portapapeles
 */
async function procesarImagenPegada(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const base64 = e.target.result;
            
            // Agregar a las imágenes seleccionadas
            imagenesNotaSeleccionadas.push(base64);
            
            // Actualizar previsualización
            actualizarPrevisualizacionImagenes();
            
            // Actualizar contador
            actualizarContadorImagenes();
            
            resolve();

            const maxSize = 5 * 1024 * 1024
        };
        
        reader.onerror = function(error) {
            console.error('Error al procesar imagen:', error);
            mostrarNotificacion('❌ Error al procesar imagen', 'error');
            reject(error);
        };
        
        reader.readAsDataURL(blob);
    });
}

/**
 * Actualizar previsualización de imágenes
 */
function actualizarPrevisualizacionImagenes() {
    const preview = document.getElementById('imagenesPreview');
    
    if (!preview) return;
    
    // Limpiar previsualización
    preview.innerHTML = '';
    
    // Renderizar todas las imágenes
    imagenesNotaSeleccionadas.forEach((imagen, index) => {
        const imgHTML = `
            <div class="imagen-preview" id="preview-nota-${index}">
                <img src="${imagen}" alt="Preview ${index + 1}">
                <button type="button" class="btn-remove-imagen" onclick="quitarImagenNota(${index})">
                    <span class="material-symbols-rounded">close</span>
                </button>
                <div class="imagen-info">
                    Imagen ${index + 1}
                </div>
            </div>
        `;
        
        preview.insertAdjacentHTML('beforeend', imgHTML);
    });
}

/**
 * Actualizar contador de imágenes
 */
function actualizarContadorImagenes() {
    const contador = document.getElementById('archivosSeleccionados');
    
    if (!contador) return;
    
    const numImagenes = imagenesNotaSeleccionadas.length;
    
    if (numImagenes === 0) {
        contador.textContent = 'Ningún archivo seleccionado';
        contador.style.color = '#64748b';
        contador.style.fontWeight = 'normal';
    } else {
        contador.textContent = `${numImagenes} imagen${numImagenes > 1 ? 'es' : ''} adjunta${numImagenes > 1 ? 's' : ''}`;
        contador.style.color = '#10b981';
        contador.style.fontWeight = '600';
    }
}

/**
 * Mostrar notificación temporal
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    // Crear o actualizar notificación
    let notif = document.getElementById('notificacionPaste');
    
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'notificacionPaste';
        notif.className = 'notificacion-paste';
        document.body.appendChild(notif);
    }
    
    // Estilos según tipo
    const colores = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    notif.style.background = colores[tipo] || colores.info;
    notif.textContent = mensaje;
    notif.classList.add('show');
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
}

/**
 * Función mejorada para quitar imagen
 */
function quitarImagenNota(index) {
    // Remover del array
    imagenesNotaSeleccionadas.splice(index, 1);
    
    // Actualizar previsualización
    actualizarPrevisualizacionImagenes();
    
    // Actualizar contador
    actualizarContadorImagenes();
    
    // Feedback
    mostrarNotificacion('🗑️ Imagen eliminada', 'info');
}

/**
 * Función mejorada para previsualizar imágenes desde input file
 */
function previsualizarImagenesNota() {
    const input = document.getElementById('imagenNota');
    
    if (!input || !input.files || input.files.length === 0) return;
    
    Array.from(input.files).forEach((file) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            imagenesNotaSeleccionadas.push(e.target.result);
            actualizarPrevisualizacionImagenes();
            actualizarContadorImagenes();
        };
        
        reader.readAsDataURL(file);
    });
    
    // Limpiar input para permitir seleccionar el mismo archivo después
    input.value = '';
    
    // Feedback
    mostrarNotificacion(`✅ ${input.files.length} imagen${input.files.length > 1 ? 'es' : ''} agregada${input.files.length > 1 ? 's' : ''}`, 'success');
}

/**
 * Limpiar todas las imágenes
 */
function limpiarImagenesNota() {
    imagenesNotaSeleccionadas = [];
    actualizarPrevisualizacionImagenes();
    actualizarContadorImagenes();
    
    const input = document.getElementById('imagenNota');
    if (input) input.value = '';
}

/**
 * Función para cancelar nota (actualizada)
 */
function cancelarNota() {
    // Limpiar textarea
    const textarea = document.getElementById('nuevaNota');
    if (textarea) textarea.value = '';
    
    // Limpiar imágenes
    limpiarImagenesNota();
    
    mostrarNotificacion('❌ Nota cancelada', 'info');
}

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    inicializarPegarImagenes();
    
    // Agregar placeholder informativo
    const textarea = document.getElementById('nuevaNota');
    if (textarea) {
        const placeholderOriginal = textarea.placeholder;
        textarea.placeholder = placeholderOriginal + ' (Ctrl+V para pegar imágenes)';
    }
});

// Si el script se carga después del DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        inicializarPegarImagenes();
    }, 100);
}