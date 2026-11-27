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

    // Valores que se agrupan como "Sin especificar" (se comparan sin acentos)
    const VACIOS = ['', '-', 'no especificada', 'no especificado', 'n/a', 'na', 'ninguna', 'otros',
        'republica', 'residente', 'empresario', 'in drive', 'indriver', 'jumm',
        'trabaja con una empresa de belleza'];

    // País canónico -> variantes (se comparan sin acentos)
    const PAISES = {
        'Cuba': ['cuba', 'cubana', 'cubano', 'cuabana', 'cuabano', 'cubaana', 'cuban', 'cubanos', 'cube', 'cubuna'],
        'México': ['mexico', 'mexicana', 'mexicano', 'maxicano', 'mexica', 'mexican0', 'mexicanos', 'mexican'],
        'Estados Unidos': ['estadounidense', 'estadounidences', 'estado unidense', 'estaunidense', 'americana', 'americano',
            'american', 'citizen', 'ciudadadano', 'ciudadano', 'ciudadana', 'usa', 'u.sa', 'u.s.a', 'us', 'eeuu', 'ee.uu',
            'estados unidos', 'united states', 'norte americana'],
        'Venezuela': ['venezuela', 'venezolana', 'venezolano', 'venenzuela', 'venezola', 'venzolana', 'venzuela'],
        'Nicaragua': ['nicaragua', 'nicaraguense', 'nicaraguenze', 'nicargua', 'nicarguense', 'nicarigua'],
        'Honduras': ['honduras', 'hondura', 'hondurena', 'hondureno', 'hoduras', 'honnduras'],
        'Colombia': ['colombia', 'colombiana', 'colombiano', 'colombino', 'calena'],
        'Guatemala': ['guatemala', 'guatemalteca', 'guatemalteco', 'guatemal'],
        'El Salvador': ['el salvador', 'salvador', 'salvadorena', 'salvadoreno'],
        'República Dominicana': ['republica dominicana', 'replubica dominicana', 'dominicana', 'dominicano'],
        'Puerto Rico': ['puerto rico', 'puero rico', 'puertorriquena', 'puertorriqueno', 'puertoriquena', 'puertoriqueno',
            'puerto riquena', 'puerto riqueno'],
        'Haití': ['haiti', 'haitiana', 'haitiano'],
        'Perú': ['peru', 'peruana', 'peruano'],
        'Ecuador': ['ecuador', 'ecuatoriana', 'ecuatoriano'],
        'Brasil': ['brasil', 'brazil', 'brasilena', 'brasileno', 'brasilera', 'brasilero'],
        'Chile': ['chile', 'chilena', 'chileno'],
        'Costa Rica': ['costa rica', 'costarricense', 'costarricenses'],
        'Argentina': ['argentina', 'argentino'],
        'España': ['espana', 'espanola', 'espanol'],
        'Panamá': ['panama', 'panamena', 'panameno'],
        'Uruguay': ['uruguay', 'uruguaya', 'uruguayo'],
        'Paraguay': ['paraguay', 'paraguaya', 'paraguayo'],
        'Bolivia': ['bolivia', 'boliviana', 'boliviano'],
        'China': ['china', 'chino'],
        'Italia': ['italia', 'italiano', 'italiana'],
        'Rusia': ['rusia', 'russia', 'ruso', 'rusa'],
        'Turquía': ['turquia', 'turco', 'turca'],
        'Tayikistán': ['tayikistan', 'tajikistana', 'tayiko'],
        'Angola': ['angola', 'angolena', 'angoleno'],
        'Guinea': ['guinea', 'guineana', 'guineano'],
        'Nigeria': ['nigeria', 'nigeriana', 'nigeriano'],
        'Senegal': ['senegal', 'senegales', 'senegalesa'],
        'República Democrática del Congo': ['republica democratica del congo']
    };

    const DICCIONARIO = new Map();
    Object.keys(PAISES).forEach(pais => {
        PAISES[pais].forEach(v => DICCIONARIO.set(sinAcentos(v), pais));
    });

    const CLAVES = Array.from(DICCIONARIO.keys());
    // Claves (3+ caracteres) de mayor a menor longitud para la regla del prefijo
    const CLAVES_PREFIJO = CLAVES.filter(k => k.length >= 3).sort((x, y) => y.length - x.length);

    const cache = new Map();

    function aTitulo(s) {
        return s.replace(/(^|\s)(\S)/g, (m, sep, c) => sep + c.toUpperCase());
    }

    // Distancia de Levenshtein con corte (devuelve max+1 si la supera)
    function levenshtein(a, b, max) {
        if (Math.abs(a.length - b.length) > max) return max + 1;
        let prev = [];
        for (let j = 0; j <= b.length; j++) prev[j] = j;
        for (let i = 1; i <= a.length; i++) {
            const cur = [i];
            let minFila = i;
            for (let j = 1; j <= b.length; j++) {
                const c = a[i - 1] === b[j - 1] ? 0 : 1;
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
                if (cur[j] < minFila) minFila = cur[j];
            }
            if (minFila > max) return max + 1;
            prev = cur;
        }
        return prev[b.length];
    }

    // Coincidencia aproximada: gana la menor distancia; empate entre países distintos -> null
    // (claves de 4-6 letras: distancia <= 1; de 7+ letras: distancia <= 2)
    function aproximar(valor) {
        let mejor = Infinity;
        let paises = new Set();
        for (const clave of CLAVES) {
            if (clave.length < 4) continue;
            const max = clave.length >= 7 ? 2 : 1;
            const d = levenshtein(valor, clave, max);
            if (d > max) continue;
            if (d < mejor) { mejor = d; paises = new Set(); }
            if (d === mejor) paises.add(DICCIONARIO.get(clave));
        }
        return paises.size === 1 ? Array.from(paises)[0] : null;
    }

    function resolver(limpio, comparable) {
        if (VACIOS.includes(comparable)) return 'Sin especificar';
        if (DICCIONARIO.has(comparable)) return DICCIONARIO.get(comparable);

        // Variante sin puntos (p. ej. "u.s." -> "us")
        const sinPuntos = comparable.replace(/\./g, '');
        if (DICCIONARIO.has(sinPuntos)) return DICCIONARIO.get(sinPuntos);

        // Plural final "s"
        if (comparable.length > 3 && comparable.endsWith('s')) {
            const singular = comparable.slice(0, -1);
            if (DICCIONARIO.has(singular)) return DICCIONARIO.get(singular);
        }

        // Empieza por un país conocido seguido de espacio, "/" o ","
        for (const clave of CLAVES_PREFIJO) {
            if (comparable.length > clave.length && comparable.startsWith(clave) &&
                /[ \/,]/.test(comparable[clave.length])) {
                return DICCIONARIO.get(clave);
            }
        }

        // Valores muy cortos o con dígitos no son países
        if (comparable.length <= 3 || /\d/.test(comparable)) return 'Sin especificar';

        const aprox = aproximar(comparable);
        if (aprox) return aprox;

        return aTitulo(limpio);
    }

    window.normalizarNacionalidad = function (texto) {
        const clave = texto === null || texto === undefined ? '' : String(texto);
        if (cache.has(clave)) return cache.get(clave);

        const limpio = limpiar(clave);
        const resultado = resolver(limpio, sinAcentos(limpio));

        cache.set(clave, resultado);
        return resultado;
    };
})();
