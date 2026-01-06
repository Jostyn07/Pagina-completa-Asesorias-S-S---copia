// ============================================
// PEGAR IMAGENES CON CTRL+V EN NOTAS
// ============================================

/**
 * Inicializar funcionalidad de pegar imagenes con Ctrl+V
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
        
        // Buscar imagenes en el portapapeles
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
            if (typeof mostrarNotificacion === 'function') {
            }
        }
    });
    
    console.log('✅ Funcionalidad de pegar imagenes inicializada');
}

/**
 * Procesar imagen pegada desde el portapapeles
 */
async function procesarImagenPegada(blob) {
    // Validar tamaño (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (blob.size > maxSize) {
        if (typeof mostrarNotificacion === 'function') {
        }
        return;
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const base64 = e.target.result;
            
            // Agregar a las imagenes seleccionadas
            if (typeof imagenesNotaSeleccionadas !== 'undefined') {
                imagenesNotaSeleccionadas.push(base64);
            }
            
            // Actualizar previsualizacion
            if (typeof actualizarPrevisualizacionImagenes === 'function') {
                actualizarPrevisualizacionImagenes();
            }
            
            // Actualizar contador
            if (typeof actualizarContadorImagenes === 'function') {
                actualizarContadorImagenes();
            }
            
            resolve();
        };
        
        reader.onerror = function(error) {
            console.error('Error al procesar imagen:', error);
            if (typeof mostrarNotificacion === 'function') {
            }
            reject(error);
        };
        
        reader.readAsDataURL(blob);
    });
}

// ============================================
// INICIALIZACION
// ============================================

// Inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', function() {
    inicializarPegarImagenes();
    
    // Agregar placeholder informativo
    const textarea = document.getElementById('nuevaNota');
    if (textarea && !textarea.placeholder.includes('Ctrl+V')) {
        textarea.placeholder = textarea.placeholder + ' (Ctrl+V para pegar imagenes)';
    }
});

// Si el script se carga despues del DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        inicializarPegarImagenes();
    }, 100);
}