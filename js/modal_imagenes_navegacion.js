// ============================================
// MODAL DE IMÁGENES CON NAVEGACIÓN
// ============================================

// Variables globales para el modal
let modalImagenActual = 0;
let modalImagenesArray = [];

/**
 * Inicializar modal de imágenes
 */
function inicializarModalImagenes() {
    // Crear modal si no existe
    if (!document.getElementById('modalImagenVisor')) {
        const modalHTML = `
            <div id="modalImagenVisor" class="modal-imagen">
                <button class="modal-imagen-close" onclick="cerrarModalImagen()">
                    <span class="material-symbols-rounded">close</span>
                </button>
                
                <button class="modal-imagen-nav prev" onclick="navegarImagen(-1)" style="display: none;">
                    <span class="material-symbols-rounded">chevron_left</span>
                </button>
                
                <div class="modal-imagen-contenedor">
                    <img id="modalImagenImg" src="" alt="Imagen ampliada">
                </div>
                
                <button class="modal-imagen-nav next" onclick="navegarImagen(1)" style="display: none;">
                    <span class="material-symbols-rounded">chevron_right</span>
                </button>
                
                <div class="modal-imagen-contador" style="display: none;">
                    <span id="modalImagenNumero">1</span> / <span id="modalImagenTotal">1</span>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Event listeners
        const modal = document.getElementById('modalImagenVisor');
        
        // Cerrar al hacer clic en el fondo
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                cerrarModalImagen();
            }
        });
        
        // Cerrar con ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                cerrarModalImagen();
            }
            
            // Navegar con flechas
            if (modal.classList.contains('active')) {
                if (e.key === 'ArrowLeft') navegarImagen(-1);
                if (e.key === 'ArrowRight') navegarImagen(1);
            }
        });
        
        console.log('✅ Modal de imágenes inicializado');
    }
}

/**
 * Abrir modal con una imagen específica
 * @param {string} src - URL de la imagen
 * @param {Array} imagenesArray - Array opcional con todas las imágenes
 * @param {number} index - Índice de la imagen actual
 */
function abrirModalImagen(src, imagenesArray = null, index = 0) {
    const modal = document.getElementById('modalImagenVisor');
    const img = document.getElementById('modalImagenImg');
    const contador = modal.querySelector('.modal-imagen-contador');
    const navPrev = modal.querySelector('.modal-imagen-nav.prev');
    const navNext = modal.querySelector('.modal-imagen-nav.next');
    
    if (!modal || !img) {
        console.error('Modal no encontrado');
        return;
    }
    
    // Configurar imagen
    img.src = src;
    img.alt = `Imagen ${index + 1}`;
    
    // Guardar array de imágenes si existe
    if (imagenesArray && imagenesArray.length > 0) {
        modalImagenesArray = imagenesArray;
        modalImagenActual = index;
        
        // Mostrar controles solo si hay más de 1 imagen
        if (imagenesArray.length > 1) {
            navPrev.style.display = 'flex';
            navNext.style.display = 'flex';
            contador.style.display = 'block';
            actualizarContadorModal();
        } else {
            navPrev.style.display = 'none';
            navNext.style.display = 'none';
            contador.style.display = 'none';
        }
    } else {
        // Solo una imagen
        modalImagenesArray = [src];
        modalImagenActual = 0;
        navPrev.style.display = 'none';
        navNext.style.display = 'none';
        contador.style.display = 'none';
    }
    
    // Mostrar modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Cerrar modal de imagen
 */
function cerrarModalImagen() {
    const modal = document.getElementById('modalImagenVisor');
    
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Limpiar
        modalImagenesArray = [];
        modalImagenActual = 0;
    }
}

/**
 * Navegar entre imágenes
 * @param {number} direccion - -1 para anterior, 1 para siguiente
 */
function navegarImagen(direccion) {
    if (modalImagenesArray.length === 0) return;
    
    modalImagenActual += direccion;
    
    // Circular: volver al inicio/final
    if (modalImagenActual < 0) {
        modalImagenActual = modalImagenesArray.length - 1;
    } else if (modalImagenActual >= modalImagenesArray.length) {
        modalImagenActual = 0;
    }
    
    // Actualizar imagen
    const img = document.getElementById('modalImagenImg');
    if (img) {
        // Animación de transición
        img.style.opacity = '0';
        
        setTimeout(() => {
            img.src = modalImagenesArray[modalImagenActual];
            img.style.opacity = '1';
        }, 150);
    }
    
    actualizarContadorModal();
}

/**
 * Actualizar contador de imágenes en el modal
 */
function actualizarContadorModal() {
    const numeroSpan = document.getElementById('modalImagenNumero');
    const totalSpan = document.getElementById('modalImagenTotal');
    
    if (numeroSpan && totalSpan) {
        numeroSpan.textContent = modalImagenActual + 1;
        totalSpan.textContent = modalImagenesArray.length;
    }
}

// ============================================
// RENDERIZAR NOTAS CON THUMBNAILS
// ============================================

/**
 * Función mejorada para mostrar notas con thumbnails clickeables
 * REEMPLAZAR la función existente mostrarNotasExistentes() o cargarNotas()
 */
async function mostrarNotasConThumbnails(notas) {
    const thread = document.getElementById('notasThread');
    
    if (!thread) {
        console.error('❌ Container de notas no encontrado');
        return;
    }
    
    thread.innerHTML = '';
    
    if (!notas || notas.length === 0) {
        thread.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">chat_bubble</span>
                <p>No hay notas aún</p>
                <small>Escribe la primera nota para este cliente</small>
            </div>
        `;
        return;
    }
    
    notas.forEach(nota => {
        const notaHTML = document.createElement('div');
        notaHTML.className = 'nota-item';
        
        // Formatear fecha
        const fecha = new Date(nota.created_at);
        const fechaFormateada = fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Renderizar imágenes como thumbnails
        let imagenesHTML = '';
        if (nota.imagenes && nota.imagenes.length > 0) {
            imagenesHTML = `
                <div class="nota-imagenes">
                    ${nota.imagenes.map((img, index) => `
                        <div class="nota-imagen-thumb" 
                             onclick="abrirModalImagen('${img}', ${JSON.stringify(nota.imagenes).replace(/"/g, '&quot;')}, ${index})"
                             data-tooltip="Click para ampliar">
                            <span class="imagen-numero">${index + 1}</span>
                            <img src="${img}" 
                                 alt="Imagen ${index + 1}"
                                 loading="lazy"
                                 onload="this.classList.add('loaded')">
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        notaHTML.innerHTML = `
            <div class="nota-header">
                <div class="nota-autor">
                    <span class="material-symbols-rounded">account_circle</span>
                    <strong>${nota.created_by || 'Usuario'}</strong>
                </div>
                <span class="nota-fecha">${fechaFormateada}</span>
            </div>
            <div class="nota-cuerpo">
                ${nota.mensaje ? `<p>${nota.mensaje}</p>` : ''}
                ${imagenesHTML}
            </div>
        `;
        
        thread.appendChild(notaHTML);
    });
    
    console.log(`✅ ${notas.length} nota(s) renderizada(s) con thumbnails`);
}

/**
 * Agregar eventos de clic a las imágenes existentes (para notas ya renderizadas)
 */
function agregarEventosClickImagenes() {
    // Buscar todas las notas con imágenes
    const notasItems = document.querySelectorAll('.nota-item');
    
    notasItems.forEach(notaItem => {
        const thumbnails = notaItem.querySelectorAll('.nota-imagen-thumb');
        
        if (thumbnails.length > 0) {
            // Obtener todas las imágenes de esta nota
            const imagenesNota = Array.from(thumbnails).map(thumb => {
                const img = thumb.querySelector('img');
                return img ? img.src : '';
            }).filter(Boolean);
            
            // Agregar evento a cada thumbnail
            thumbnails.forEach((thumb, index) => {
                thumb.style.cursor = 'pointer';
                
                thumb.addEventListener('click', function() {
                    const img = this.querySelector('img');
                    if (img) {
                        abrirModalImagen(img.src, imagenesNota, index);
                    }
                });
            });
        }
    });
    
    console.log('✅ Eventos de clic agregados a imágenes');
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Precargar imagen para transiciones suaves
 */
function precargarImagen(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Descargar imagen (opcional)
 */
function descargarImagen(src, nombre = 'imagen') {
    const link = document.createElement('a');
    link.href = src;
    link.download = `${nombre}_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    inicializarModalImagenes();
    
    // Si ya hay notas renderizadas, agregar eventos
    setTimeout(() => {
        agregarEventosClickImagenes();
    }, 500);
});

// Si el script se carga después del DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        inicializarModalImagenes();
        agregarEventosClickImagenes();
    }, 100);
}

// Exportar funciones globales
window.abrirModalImagen = abrirModalImagen;
window.cerrarModalImagen = cerrarModalImagen;
window.navegarImagen = navegarImagen;
window.inicializarModalImagenes = inicializarModalImagenes;
window.agregarEventosClickImagenes = agregarEventosClickImagenes;
window.mostrarNotasConThumbnails = mostrarNotasConThumbnails;