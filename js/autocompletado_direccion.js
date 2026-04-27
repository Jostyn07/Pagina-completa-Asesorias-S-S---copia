// ============================================
// AUTOCOMPLETADO DE DIRECCIÓN - Nominatim (OpenStreetMap)
// Sin API Key requerida
// Rellena: condado, ciudad, estado, codigoPostal
// ============================================

(function() {

    // Estilos del dropdown
    const estilos = document.createElement('style');
    estilos.textContent = `
        .autocomplete-wrapper {
            position: relative;
        }
        .autocomplete-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid var(--border-color, #e2e8f0);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 9999;
            max-height: 250px;
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
        .autocomplete-item .icon {
            color: var(--primary-color, #6366f1);
            font-size: 16px;
            margin-top: 1px;
            flex-shrink: 0;
        }
        .autocomplete-item .texto-principal {
            font-weight: 500;
            color: var(--text-color, #1a202c);
        }
        .autocomplete-item .texto-secundario {
            font-size: 12px;
            color: var(--text-muted, #718096);
            margin-top: 2px;
        }
        .autocomplete-cargando {
            padding: 12px 14px;
            font-size: 13px;
            color: var(--text-muted, #718096);
            text-align: center;
        }
    `;
    document.head.appendChild(estilos);

    let timeoutBusqueda = null;
    let dropdownActual = null;

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

            if (query.length < 5) {
                cerrarDropdown();
                return;
            }

            // Esperar 600ms después de que el usuario deje de escribir
            timeoutBusqueda = setTimeout(() => buscarDirecciones(query, campoDireccion), 600);
        });

        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-wrapper')) {
                cerrarDropdown();
            }
        });
    }

    // ==========================================
    // BUSCAR DIRECCIONES EN NOMINATIM
    // ==========================================

    async function buscarDirecciones(query, campo) {
        mostrarCargando(campo);

        try {
            // Buscar solo en USA
            const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
                q: query,
                format: 'json',
                addressdetails: 1,
                limit: 6,
                'accept-language': 'es'
            });

            const res = await fetch(url, {
                headers: { 'Accept-Language': 'es' }
            });

            const resultados = await res.json();

            if (!resultados.length) {
                cerrarDropdown();
                return;
            }

            mostrarResultados(resultados, campo);

        } catch (error) {
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
            const addr = resultado.address;

            // Construir texto legible
            const calle = addr.road || addr.pedestrian || addr.footway || '';
            const numero = addr.house_number || '';
            const ciudad = addr.city || addr.town || addr.village || addr.municipality || '';
            const estado = addr.state || '';
            const cp = addr.postcode || '';

            const textoPrincipal = [numero, calle].filter(Boolean).join(' ') || resultado.display_name.split(',')[0];
            const textoSecundario = [ciudad, estado, cp].filter(Boolean).join(', ');

            const item = document.createElement('div');
            item.classList.add('autocomplete-item');
            item.innerHTML = `
                <span class="material-symbols-rounded icon">location_on</span>
                <div>
                    <div class="texto-principal">${textoPrincipal}</div>
                    <div class="texto-secundario">${textoSecundario}</div>
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
        const addr = resultado.address;

        // Construir dirección principal (calle + número)
        const numero = addr.house_number || '';
        const calle  = addr.road || addr.pedestrian || addr.footway || '';
        const direccionCompleta = [numero, calle].filter(Boolean).join(' ');

        // Extraer datos
        const condado    = addr.county || '';
        const ciudad     = addr.city || addr.town || addr.village || addr.municipality || '';
        const estadoVal  = addr.state || '';
        const cp         = addr.postcode?.substring(0, 5) || '';

        // Rellenar campo dirección
        campoDireccion.value = direccionCompleta || campoDireccion.value;

        // Rellenar condado
        const campoCondado = document.getElementById('condado');
        if (campoCondado && condado) campoCondado.value = condado;

        // Rellenar ciudad
        const campoCiudad = document.getElementById('ciudad');
        if (campoCiudad && ciudad) campoCiudad.value = ciudad;

        // Rellenar estado (select)
        const campoEstado = document.getElementById('estado');
        if (campoEstado && estadoVal) {
            // Buscar por nombre completo o abreviatura
            const opciones = Array.from(campoEstado.options);
            const match = opciones.find(op =>
                op.value.toLowerCase() === estadoVal.toLowerCase() ||
                op.text.toLowerCase() === estadoVal.toLowerCase()
            );
            if (match) campoEstado.value = match.value;
        }

        // Rellenar código postal
        const campoCP = document.getElementById('codigoPostal');
        if (campoCP && cp) campoCP.value = cp;

        cerrarDropdown();

        // Disparar eventos change para que el sistema detecte los cambios
        ['direccion', 'condado', 'ciudad', 'estado', 'codigoPostal'].forEach(id => {
            document.getElementById(id)?.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    // ==========================================
    // HELPERS
    // ==========================================

    function mostrarCargando(campo) {
        cerrarDropdown();
        const dropdown = document.createElement('div');
        dropdown.classList.add('autocomplete-dropdown');
        dropdown.innerHTML = `<div class="autocomplete-cargando">
            <span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;">search</span>
            Buscando direcciones...
        </div>`;
        campo.parentElement.appendChild(dropdown);
        dropdownActual = dropdown;
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