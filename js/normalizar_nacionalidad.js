// Normalización de nacionalidades (texto libre en clientes.nacionalidad).
// normalizarNacionalidad(texto) devuelve el nombre canónico del PAÍS.
// Solo se usa para agrupar/filtrar en el frontend; no modifica la base de datos.

(function () {
    // Quita acentos y diéresis (NFD) para comparar
    function sinAcentos(s) {
        return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    // Trim, quita guiones/puntos/espacios sobrantes en los extremos,
    // colapsa espacios y pasa a minúsculas (conserva acentos)
    function limpiar(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/^[\s\-\.]+|[\s\-\.]+$/g, '')
            .replace(/\s+/g, ' ')
            .toLowerCase();
    }

    const VACIOS = ['', '-', 'no especificada', 'no especificado', 'n/a', 'na', 'ninguna'];

    // País canónico -> variantes (se comparan sin acentos)
    const PAISES = {
        'Cuba': ['cuba', 'cubana', 'cubano', 'cuabana'],
        'México': ['mexico', 'mexicana', 'mexicano'],
        'Estados Unidos': ['estadounidense', 'estadounidences', 'estado unidense', 'americana', 'americano',
            'ciudadano', 'ciudadana', 'usa', 'u.sa', 'u.s.a', 'us', 'eeuu', 'ee.uu', 'estados unidos'],
        'Venezuela': ['venezuela', 'venezolana', 'venezolano'],
        'Nicaragua': ['nicaragua', 'nicaraguense', 'nicaragüense'],
        'Honduras': ['honduras', 'hondura', 'hondureña', 'hondureño'],
        'Colombia': ['colombia', 'colombiana', 'colombiano'],
        'Guatemala': ['guatemala', 'guatemalteca', 'guatemalteco'],
        'El Salvador': ['el salvador', 'salvador', 'salvadoreña', 'salvadoreño'],
        'República Dominicana': ['republica dominicana', 'dominicana', 'dominicano'],
        'Puerto Rico': ['puerto rico', 'puertorriqueña', 'puertorriqueño', 'puertoriqueña', 'puertoriqueño'],
        'Haití': ['haiti', 'haitiana', 'haitiano'],
        'Perú': ['peru', 'peruana', 'peruano'],
        'Ecuador': ['ecuador', 'ecuatoriana', 'ecuatoriano'],
        'Brasil': ['brasil', 'brazil', 'brasileña', 'brasileño'],
        'Chile': ['chile', 'chilena', 'chileno'],
        'Costa Rica': ['costa rica', 'costarricense'],
        'Argentina': ['argentina', 'argentino'],
        'España': ['españa', 'espana', 'española', 'español'],
        'Panamá': ['panama', 'panameña', 'panameño'],
        'Uruguay': ['uruguay', 'uruguaya', 'uruguayo'],
        'Paraguay': ['paraguay', 'paraguaya', 'paraguayo'],
        'Bolivia': ['bolivia', 'boliviana', 'boliviano']
    };

    const DICCIONARIO = new Map();
    Object.keys(PAISES).forEach(pais => {
        PAISES[pais].forEach(v => DICCIONARIO.set(sinAcentos(v), pais));
    });

    const cache = new Map();

    function aTitulo(s) {
        return s.replace(/(^|\s)(\S)/g, (m, sep, c) => sep + c.toUpperCase());
    }

    window.normalizarNacionalidad = function (texto) {
        const clave = texto === null || texto === undefined ? '' : String(texto);
        if (cache.has(clave)) return cache.get(clave);

        const limpio = limpiar(clave);
        const comparable = sinAcentos(limpio);
        let resultado;

        if (VACIOS.includes(comparable)) {
            resultado = 'Sin especificar';
        } else if (DICCIONARIO.has(comparable)) {
            resultado = DICCIONARIO.get(comparable);
        } else {
            // Variante sin puntos (p. ej. "u.s." -> "us")
            const sinPuntos = comparable.replace(/\./g, '');
            resultado = DICCIONARIO.get(sinPuntos) || aTitulo(limpio);
        }

        cache.set(clave, resultado);
        return resultado;
    };
})();
