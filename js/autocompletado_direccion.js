// ============================================
// AUTOCOMPLETADO DE DIRECCIÓN - Google Places API
// Con session tokens para minimizar costos
// Rellena: dirección, condado, ciudad, estado, codigoPostal
// ============================================

(function () {

    const GOOGLE_API_KEY = 'AIzaSyCeugZ-srhj6GKF_6BNe9LLv26HvBL1qYQ';

    // ==========================================
    // CARGAR GOOGLE PLACES API DINÁMICAMENTE
    // ==========================================

    function cargarGooglePlacesAPI() {
        return new Promise((resolve, reject) => {
            if (window.google?.maps?.places) {
                resolve();
                return;
            }

            window.__googlePlacesCallback = () => resolve();

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&callback=__googlePlacesCallback&loading=async`;
            script.async = true;
            script.defer = true;
            script.onerror = () => reject(new Error('Error cargando Google Places API'));
            document.head.appendChild(script);
        });
    }

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
            max-height: 300px;
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
        .autocomplete-footer {
            padding: 6px 10px;
            text-align: right;
            border-top: 1px solid var(--border-color, #f0f0f0);
        }
        .autocomplete-footer img {
            height: 14px;
            opacity: 0.6;
        }
    `;
    document.head.appendChild(estilos);

    let timeoutBusqueda = null;
    let dropdownActual = null;
    let autocompleteService = null;
    let placesService = null;
    let sessionToken = null;

    // ==========================================
    // INICIALIZAR
    // ==========================================

    async function inicializarAutocompletado() {
        const campoDireccion = document.getElementById('direccion');
        if (!campoDireccion) return;

        try {
            await cargarGooglePlacesAPI();

            autocompleteService = new google.maps.places.AutocompleteService();
            placesService = new google.maps.places.PlacesService(document.createElement('div'));
            renovarSessionToken();

            // Envolver en wrapper
            if (!campoDireccion.parentElement.classList.contains('autocomplete-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.classList.add('autocomplete-wrapper');
                campoDireccion.parentNode.insertBefore(wrapper, campoDireccion);
                wrapper.appendChild(campoDireccion);
            }

            campoDireccion.addEventListener('input', () => {
                clearTimeout(timeoutBusqueda);
                const query = campoDireccion.value.trim();

                if (query.length < 3) {
                    cerrarDropdown();
                    return;
                }

                timeoutBusqueda = setTimeout(() => buscarDirecciones(query, campoDireccion), 300);
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.autocomplete-wrapper')) cerrarDropdown();
            });

            campoDireccion.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') cerrarDropdown();
            });

        } catch (error) {
            console.error('Error inicializando Google Places:', error);
        }
    }

    // ==========================================
    // SESSION TOKEN - Agrupa requests en una sesión
    // Google cobra UNA sesión en lugar de N requests individuales
    // ==========================================

    function renovarSessionToken() {
        sessionToken = new google.maps.places.AutocompleteSessionToken();
    }

    // ==========================================
    // BUSCAR DIRECCIONES
    // ==========================================

    function buscarDirecciones(query, campo) {
        mostrarCargando(campo);

        autocompleteService.getPlacePredictions(
            {
                input: query,
                sessionToken: sessionToken,
                types: ['address'],
            },
            (predicciones, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !predicciones?.length) {
                    mostrarSinResultados(campo);
                    return;
                }
                mostrarResultados(predicciones, campo);
            }
        );
    }

    // ==========================================
    // MOSTRAR RESULTADOS
    // ==========================================

    function mostrarResultados(predicciones, campo) {
        cerrarDropdown();

        const dropdown = document.createElement('div');
        dropdown.classList.add('autocomplete-dropdown');

        predicciones.forEach(prediccion => {
            const textoPrincipal  = prediccion.structured_formatting?.main_text || prediccion.description;
            const textoSecundario = prediccion.structured_formatting?.secondary_text || '';

            const item = document.createElement('div');
            item.classList.add('autocomplete-item');
            item.innerHTML = `
                <span class="material-symbols-rounded ac-icon">location_on</span>
                <div>
                    <div class="ac-texto-principal">${textoPrincipal}</div>
                    <div class="ac-texto-secundario">${textoSecundario}</div>
                </div>
            `;

            item.addEventListener('click', () => seleccionarDireccion(prediccion.place_id, campo));
            dropdown.appendChild(item);
        });

        // Footer requerido por los términos de Google
        const footer = document.createElement('div');
        footer.classList.add('autocomplete-footer');
        footer.innerHTML = `<img src="https://developers.google.com/maps/documentation/images/powered_by_google_on_white.png" alt="Powered by Google">`;
        dropdown.appendChild(footer);

        campo.parentElement.appendChild(dropdown);
        dropdownActual = dropdown;
    }

    // ==========================================
    // SELECCIONAR Y RELLENAR CAMPOS
    // getDetails termina la sesión → Google cobra solo UNA sesión completa
    // Solo pedimos address_components y formatted_address para no pagar extra
    // ==========================================

    function seleccionarDireccion(placeId, campoDireccion) {
        placesService.getDetails(
            {
                placeId: placeId,
                fields: ['address_components', 'formatted_address'],
                sessionToken: sessionToken,
            },
            (lugar, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !lugar) {
                    console.error('Error obteniendo detalles:', status);
                    return;
                }

                // Renovar token para la próxima búsqueda
                renovarSessionToken();

                const componentes = lugar.address_components || [];
                const get      = (tipo) => componentes.find(c => c.types.includes(tipo))?.long_name  || '';
                const getShort = (tipo) => componentes.find(c => c.types.includes(tipo))?.short_name || '';

                const numero    = get('street_number');
                const calle     = get('route');
                const ciudad    = get('locality') || get('sublocality') || get('postal_town');
                const condado   = get('administrative_area_level_2');
                const estado    = get('administrative_area_level_1');
                const estadoCod = getShort('administrative_area_level_1');
                const cp        = get('postal_code');

                // Rellenar dirección
                campoDireccion.value = [numero, calle].filter(Boolean).join(' ')
                    || lugar.formatted_address.split(',')[0];

                // Rellenar condado
                const campoCondado = document.getElementById('condado');
                if (campoCondado && condado) campoCondado.value = condado;

                // Rellenar ciudad
                const campoCiudad = document.getElementById('ciudad');
                if (campoCiudad && ciudad) campoCiudad.value = ciudad;

                // Rellenar estado (select)
                const campoEstado = document.getElementById('estado');
                if (campoEstado && (estado || estadoCod)) {
                    const opciones = Array.from(campoEstado.options);
                    const match = opciones.find(op =>
                        op.value.toLowerCase() === estadoCod.toLowerCase() ||
                        op.value.toLowerCase() === estado.toLowerCase()    ||
                        op.text.toLowerCase()  === estado.toLowerCase()
                    );
                    if (match) campoEstado.value = match.value;
                }

                // Rellenar código postal
                const campoCP = document.getElementById('codigoPostal');
                if (campoCP && cp) campoCP.value = cp.substring(0, 5);

                cerrarDropdown();

                // Disparar eventos de cambio
                ['direccion', 'condado', 'ciudad', 'estado', 'codigoPostal'].forEach(id => {
                    document.getElementById(id)?.dispatchEvent(new Event('change', { bubbles: true }));
                    document.getElementById(id)?.dispatchEvent(new Event('input',  { bubbles: true }));
                });

                // Mover foco al siguiente campo
                document.getElementById('casaApartamento')?.focus();
            }
        );
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
                <span class="material-symbols-rounded" style="font-size:16px;">search</span>
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
                No se encontraron direcciones. Escríbela manualmente.
            </div>
        `;
        campo.parentElement.appendChild(dropdown);
        dropdownActual = dropdown;
        setTimeout(cerrarDropdown, 2500);
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