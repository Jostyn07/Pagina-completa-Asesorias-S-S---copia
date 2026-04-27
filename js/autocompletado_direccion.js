// ============================================
// AUTOCOMPLETADO DE DIRECCIÓN - Geoapify
// API Key: 591b3289801144a2bd51aeba45002ce4
// Rellena: dirección, condado, ciudad, estado, codigoPostal
// ============================================

(function () {

    const GEOAPIFY_KEY = '591b3289801144a2bd51aeba45002ce4';

    // ==========================================
    // ESTILOS DEL DROPDOWN
    // ==========================================

    const estilos = document.createElement('style');
    estilos.textContent = `
        .autocomplete-wrapper {
            position: relative;
        }
        .autocomplete-dropdown {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: white;
            border: 1px solid var(--border-color, #e2e8f0);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 9999;
            max-height: 280px;
            overflow-y: auto;
        }
        .autocomplete-item {
            padding: 10px 14px;
            cursor: pointer;
            font-size: 14px;
            border-bottom: 1px solid var(--border-color, #f0f0f0);
            display: flex;
            align-items: flex-start;
            gap: 8px;
        }
        .autocomplete-item:last-child {
            border-bottom: none;
        }
        .autocomplete-item:hover {
            background: var(--primary-light, #f0f4ff);
        }
        .autocomplete-item .ac-icon {
            color: var(--primary-color, #6366f1);
            font-size: 18px;
            margin-top: 1px;
            flex-shrink: 0;
        }
        .autocomplete-item .ac-texto-principal {
            font-weight: 500;
            color: var(--text-color, #1a202c);
            line-height: 1.3;
        }
        .autocomplete-item .ac-texto-secundario {
            font-size: 12px;
            color: var(--text-muted, #718096);
            margin-top: 2px;
            line-height: 1.3;
        }
        .autocomplete-cargando {
            padding: 12px 14px;
            font-size: 13px;
            color: var(--text-muted, #718096);
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .autocomplete-sin-resultados {
            padding: 12px 14px;
            font-size: 13px;
            color: var(--text-muted, #718096);
            text-align: center;
        }
    `;
    document.head.appendChild(estilos);

    let timeoutBusqueda = null;
    let dropdownActual = null;
    let abortController = null;

    // ==========================================
    // INICIALIZAR EN EL CAMPO DIRECCIÓN
    // ==========================================

    function inicializarAutocompletado() {
        const campoDireccion = document.getElementById('direccion');
        if (!campoDireccion) return;

        // Envolver en wrapper si no lo está
        if (!campoDireccion.parentElement.classList.contains('autocomplete-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.classList.add('autocomplete-wrapper');
            campoDireccion.parentNode.insertBefore(wrapper, campoDireccion);
            wrapper.appendChild(campoDireccion);
        }

        // Escuchar escritura
        campoDireccion.addEventListener('input', () => {
            clearTimeout(timeoutBusqueda);
            const query = campoDireccion.value.trim();

            if (query.length < 3) {
                cerrarDropdown();
                return;
            }

            // Esperar 400ms después de que el usuario deje de escribir
            timeoutBusqueda = setTimeout(() => buscarDirecciones(query, campoDireccion), 400);
        });

        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-wrapper')) {
                cerrarDropdown();
            }
        });

        // Cerrar con ESC
        campoDireccion.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') cerrarDropdown();
        });
    }

    // ==========================================
    // BUSCAR DIRECCIONES EN GEOAPIFY
    // ==========================================

    async function buscarDirecciones(query, campo) {
        // Cancelar request anterior si existe
        if (abortController) abortController.abort();
        abortController = new AbortController();

        mostrarCargando(campo);

        try {
            const url = `https://api.geoapify.com/v1/geocode/autocomplete?` + new URLSearchParams({
                text: query,
                apiKey: GEOAPIFY_KEY,
                limit: 6,
                lang: 'es',
                format: 'json'
            });

            const res = await fetch(url, {
                method: 'GET',
                signal: abortController.signal
            });

            const data = await res.json();
            const resultados = data.results || [];

            if (!resultados.length) {
                mostrarSinResultados(campo);
                return;
            }

            mostrarResultados(resultados, campo);

        } catch (error) {
            if (error.name === 'AbortError') return; // Request cancelado, ignorar
            console.error('Error buscando dirección:', error);
            cerrarDropdown();
        }
    }

    // ==========================================
    // MOSTRAR RESULTADOS EN DROPDOWN
    // ==========================================

    function mostrarResultados(resultados, campo) {
        cerrarDropdown();

        const dropdown = document.createElement('div');
        dropdown.classList.add('autocomplete-dropdown');

        resultados.forEach(resultado => {
            // Geoapify devuelve los campos ya separados
            const calle     = resultado.street || '';
            const numero    = resultado.housenumber || '';
            const ciudad    = resultado.city || resultado.town || resultado.village || resultado.municipality || '';
            const estado    = resultado.state || resultado.state_code || '';
            const cp        = resultado.postcode || '';
            const pais      = resultado.country || '';

            const textoPrincipal = [numero, calle].filter(Boolean).join(' ') 
                || resultado.address_line1 
                || resultado.formatted?.split(',')[0] 
                || '';

            const textoSecundario = [ciudad, estado, cp, pais].filter(Boolean).join(', ');

            const item = document.createElement('div');
            item.classList.add('autocomplete-item');
            item.innerHTML = `
                <span class="material-symbols-rounded ac-icon">location_on</span>
                <div>
                    <div class="ac-texto-principal">${textoPrincipal}</div>
                    <div class="ac-texto-secundario">${textoSecundario}</div>
                </div>
            `;

            item.addEventListener('click', () => seleccionarDireccion(resultado, campo));
            dropdown.appendChild(item);
        });

        campo.parentElement.appendChild(dropdown);
        dropdownActual = dropdown;
    }

    // ==========================================
    // SELECCIONAR DIRECCIÓN Y RELLENAR CAMPOS
    // ==========================================

    function seleccionarDireccion(resultado, campoDireccion) {
        // Geoapify ya devuelve los campos bien separados
        const numero        = resultado.housenumber || '';
        const calle         = resultado.street || '';
        const condadoVal    = resultado.county || '';
        const ciudadVal     = resultado.city || resultado.town || resultado.village || resultado.municipality || '';
        const estadoVal     = resultado.state || '';
        const estadoCodigo  = resultado.state_code || '';
        const cpVal         = resultado.postcode?.substring(0, 5) || '';

        // Rellenar dirección principal
        const direccionCompleta = [numero, calle].filter(Boolean).join(' ');
        campoDireccion.value = direccionCompleta || resultado.address_line1 || campoDireccion.value;

        // Rellenar condado
        const campoCondado = document.getElementById('condado');
        if (campoCondado && condadoVal) campoCondado.value = condadoVal;

        // Rellenar ciudad
        const campoCiudad = document.getElementById('ciudad');
        if (campoCiudad && ciudadVal) campoCiudad.value = ciudadVal;

        // Rellenar estado (es un <select>, buscar por código o nombre)
        const campoEstado = document.getElementById('estado');
        if (campoEstado && (estadoCodigo || estadoVal)) {
            const opciones = Array.from(campoEstado.options);
            const match = opciones.find(op =>
                op.value.toLowerCase() === estadoCodigo.toLowerCase() ||
                op.value.toLowerCase() === estadoVal.toLowerCase()   ||
                op.text.toLowerCase()  === estadoVal.toLowerCase()
            );
            if (match) campoEstado.value = match.value;
        }

        // Rellenar código postal
        const campoCP = document.getElementById('codigoPostal');
        if (campoCP && cpVal) campoCP.value = cpVal;

        cerrarDropdown();

        // Disparar eventos change para que el sistema detecte los cambios
        ['direccion', 'condado', 'ciudad', 'estado', 'codigoPostal'].forEach(id => {
            document.getElementById(id)?.dispatchEvent(new Event('change', { bubbles: true }));
            document.getElementById(id)?.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Enfocar el siguiente campo (casaApartamento)
        document.getElementById('casaApartamento')?.focus();
    }

    // ==========================================
    // HELPERS
    // ==========================================

    function mostrarCargando(campo) {
        cerrarDropdown();
        const dropdown = document.createElement('div');
        dropdown.classList.add('autocomplete-dropdown');
        dropdown.innerHTML = `
            <div class="autocomplete-cargando">
                <span class="material-symbols-rounded" style="font-size:16px;animation:spin 1s linear infinite;">refresh</span>
                Buscando direcciones...
            </div>
        `;
        campo.parentElement.appendChild(dropdown);
        dropdownActual = dropdown;
    }

    function mostrarSinResultados(campo) {
        cerrarDropdown();
        const dropdown = document.createElement('div');
        dropdown.classList.add('autocomplete-dropdown');
        dropdown.innerHTML = `
            <div class="autocomplete-sin-resultados">
                No se encontraron direcciones
            </div>
        `;
        campo.parentElement.appendChild(dropdown);
        dropdownActual = dropdown;

        // Cerrar automáticamente después de 2 segundos
        setTimeout(cerrarDropdown, 2000);
    }

    function cerrarDropdown() {
        if (dropdownActual) {
            dropdownActual.remove();
            dropdownActual = null;
        }
    }

    // ==========================================
    // INICIALIZAR CUANDO EL DOM ESTÉ LISTO
    // ==========================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarAutocompletado);
    } else {
        inicializarAutocompletado();
    }

})();