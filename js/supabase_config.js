const SUPABASE_URL = 'https://ycpdwjbfhktjrsroojtz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljcGR3amJmaGt0anJzcm9vanR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MzY1MjMsImV4cCI6MjA4MTQxMjUyM30.SxCcaUJ5wejZ-TiSvsTTV-mTm0DKBKODfIdxNqKR-0Q';

// =============================================
// CLIENTE DE SUPABASE (Variable segura)
// =============================================
let supabaseClient = null;

// Función de inicialización auto-ejecutable
(function initSupabase() {
    try {
        if (typeof window.supabase === 'undefined') {
            console.error('❌ CDN de Supabase no está cargado');
            return;
        }
        
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error('❌ Error al inicializar Supabase:', error);
    }
})();

// =============================================
// HELPER: Manejar errores
// =============================================
function handleSupabaseError(error) {
    console.error('❌ Error de Supabase:', error);
    alert('Error: ' + error.message);
    return null;
}

// =============================================
// HELPER: Obtener usuario actual
// =============================================
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) return handleSupabaseError(error);
        return user;
    } catch (error) {
        console.error('❌ Error al obtener usuario:', error);
        return null;
    }
}

// =============================================
// HELPER: Formato de fechas para SQL
// =============================================
function formatDateForSQL(fecha) {
    if (!fecha) return null;
    const date = new Date(fecha);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// =============================================
// CLIENTES: Crear
// =============================================
async function guardarClienteEnSupabase(formData) {
    try {

        // 1. Insertar cliente
        const { data: cliente, error: errorCliente } = await supabaseClient
            .from('clientes')
            .insert({
                tipo_registro: formData.tipoRegistro,
                fecha_registro: formatDateForSQL(formData.fechaRegistro),
                nombres: formData.nombres,
                apellidos: formData.apellidos,
                sexo: formData.sexo,
                fecha_nacimiento: formatDateForSQL(formData.fechaNacimiento),
                email: formData.email,
                telefono1: formData.telefono1,
                telefono2: formData.telefono2,
                ssn: formData.ssn,
                estado_migratorio: formData.estadoMigratorio,
                nacionalidad: formData.nacionalidad,
                ocupacion: formData.ocupacion,
                ingresos: parseFloat(formData.ingresos) || 0,
                aplica: formData.aplica === 'si',
                direccion: formData.direccion,
                casa_apartamento: formData.casaApartamento,
                ciudad: formData.ciudad,
                estado: formData.estado,
                condado: formData.condado,
                codigo_postal: formData.codigoPostal,
                tiene_po_box: formData.tienePOBox === true,
                po_box: formData.poBox
            })
            .select()
            .single();

        if (errorCliente) throw errorCliente;


        // 2. Insertar póliza
        const numeroPoliza = await generarNumeroPoliza();
        
        const { data: poliza, error: errorPoliza } = await supabaseClient
            .from('polizas')
            .insert({
                cliente_id: cliente.id,
                numero_poliza: numeroPoliza,
                compania: formData.compania,
                plan: formData.plan,
                prima: parseFloat(formData.prima),
                credito_fiscal: parseFloat(formData.creditoFiscal) || 0,
                tipo_venta: formData.tipoVenta,
                fecha_inicial_cobertura: formatDateForSQL(formData.fechaInicialCobertura),
                fecha_final_cobertura: formatDateForSQL(formData.fechaFinalCobertura),
                fecha_efectividad: formatDateForSQL(formData.fechaEfectividad),
                member_id: formData.memberId,
                portal_npn: formData.portalNPN,
                clave_seguridad: formData.claveSeguridad,
                enlace_poliza: formData.enlacePoliza,
                observaciones: formData.observaciones,
                operador_id: formData.operadorId
            })
            .select()
            .single();

        if (errorPoliza) throw errorPoliza;


        return { cliente, poliza };

    } catch (error) {
        console.error('❌ Error al guardar:', error);
        throw error;
    }
}

// =============================================
// CLIENTES: Obtener por ID
// =============================================
async function obtenerCliente(clienteId) {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select(`
                *,
                polizas (*),
                dependientes (*),
                metodos_pago (*),
                documentos (*),
                notas (
                    *,
                    autor:usuarios(*)
                )
            `)
            .eq('id', clienteId)
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('❌ Error al obtener cliente:', error);
        throw error;
    }
}

// =============================================
// CLIENTES: Actualizar
// =============================================
async function actualizarCliente(clienteId, datosActualizados) {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .update(datosActualizados)
            .eq('id', clienteId)
            .select()
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('❌ Error al actualizar:', error);
        throw error;
    }
}

// =============================================
// PÓLIZAS: Generar número único
// =============================================
async function generarNumeroPoliza() {
    const año = new Date().getFullYear();
    
    // Contar pólizas del año
    const { count } = await supabaseClient
        .from('polizas')
        .select('*', { count: 'exact', head: true })
        .like('numero_poliza', `POL-${año}-%`);
    
    const siguiente = (count || 0) + 1;
    return `POL-${año}-${String(siguiente).padStart(3, '0')}`;
}

// =============================================
// PÓLIZAS: Listar todas
// =============================================
async function listarPolizas(filtros = {}) {
    try {
        let query = supabaseClient
            .from('polizas')
            .select(`
                *,
                cliente:clientes(nombres, apellidos, telefono1, email),
                operador:usuarios(nombre)
            `)
            .order('created_at', { ascending: false });

        // Aplicar filtros opcionales
        if (filtros.estado) {
            query = query.eq('estado', filtros.estado);
        }
        if (filtros.operador_id) {
            query = query.eq('operador_id', filtros.operador_id);
        }
        if (filtros.desde) {
            query = query.gte('created_at', filtros.desde);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('❌ Error al listar pólizas:', error);
        throw error;
    }
}

// =============================================
// DEPENDIENTES: Agregar
// =============================================
async function agregarDependiente(clienteId, dependienteData) {
    try {
        const { data, error } = await supabaseClient
            .from('dependientes')
            .insert({
                cliente_id: clienteId,
                nombres: dependienteData.nombres,
                apellidos: dependienteData.apellidos,
                fecha_nacimiento: formatDateForSQL(dependienteData.fechaNacimiento),
                genero: dependienteData.genero,
                relacion: dependienteData.relacion,
                ssn: dependienteData.ssn,
                aplicante: dependienteData.aplicante === 'si'
            })
            .select()
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('❌ Error al agregar dependiente:', error);
        throw error;
    }
}

// =============================================
// DEPENDIENTES: Guardar múltiples
// =============================================
async function guardarDependientes(clienteId) {
    const dependientes = [];
    const container = document.getElementById('dependientesContainer');
    const cards = container.querySelectorAll('.dependiente-card');
    
    for (const card of cards) {
        const id = card.id.split('-')[1];
        const dependienteData = {
            nombres: card.querySelector(`[name="dependiente_${id}_nombres"]`).value,
            apellidos: card.querySelector(`[name="dependiente_${id}_apellidos"]`).value,
            fechaNacimiento: card.querySelector(`[name="dependiente_${id}_fechaNacimiento"]`).value,
            genero: card.querySelector(`[name="dependiente_${id}_genero"]`).value,
            relacion: card.querySelector(`[name="dependiente_${id}_relacion"]`).value,
            ssn: card.querySelector(`[name="dependiente_${id}_ssn"]`).value,
            aplicante: card.querySelector(`[name="dependiente_${id}_aplicante"]`).value
        };
        
        const resultado = await agregarDependiente(clienteId, dependienteData);
        dependientes.push(resultado);
    }
    
    return dependientes;
}

// =============================================
// MÉTODO DE PAGO: Guardar
// =============================================
async function guardarMetodoPago(clienteId, metodoPago) {
    try {
        const { data, error } = await supabaseClient
            .from('metodos_pago')
            .insert({
                cliente_id: clienteId,
                tipo: metodoPago.tipo,
                nombre_banco: metodoPago.nombreBanco,
                numero_cuenta: metodoPago.numeroCuenta,
                routing_number: metodoPago.routingNumber,
                nombre_cuenta: metodoPago.nombreCuenta,
                numero_tarjeta: metodoPago.numeroTarjeta,
                nombre_tarjeta: metodoPago.nombreTarjeta,
                fecha_expiracion: metodoPago.fechaExpiracion,
                cvv: metodoPago.cvv,
                tipo_tarjeta: metodoPago.tipoTarjeta,
                usar_misma_direccion: metodoPago.usarMismaDireccion
            })
            .select()
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('❌ Error al guardar método de pago:', error);
        throw error;
    }
}

// =============================================
// DOCUMENTOS: Subir
// =============================================
async function subirDocumento(clienteId, archivo, nombrePersonalizado) {
    try {
        // 1. Generar nombre único
        const timestamp = Date.now();
        const extension = archivo.name.split('.').pop();
        const nombreArchivo = `${timestamp}.${extension}`;
        const rutaStorage = `clientes/${clienteId}/${nombreArchivo}`;


        // 2. Subir archivo a Storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('documentos-clientes')
            .upload(rutaStorage, archivo);

        if (uploadError) throw uploadError;

        // 3. Guardar referencia en tabla documentos
        const { data: documento, error: docError } = await supabaseClient
            .from('documentos')
            .insert({
                cliente_id: clienteId,
                nombre: nombrePersonalizado,
                nombre_archivo: archivo.name,
                ruta_storage: rutaStorage,
                tipo_mime: archivo.type,
                tamano_bytes: archivo.size
            })
            .select()
            .single();

        if (docError) throw docError;

        return documento;

    } catch (error) {
        console.error('❌ Error al subir documento:', error);
        throw error;
    }
}

// =============================================
// DOCUMENTOS: Obtener URL firmada
// =============================================
async function obtenerUrlDocumento(rutaStorage) {
    try {
        const { data, error } = await supabaseClient.storage
            .from('documentos-clientes')
            .createSignedUrl(rutaStorage, 3600); // URL válida por 1 hora

        if (error) throw error;

        return data.signedUrl;

    } catch (error) {
        console.error('❌ Error al obtener URL:', error);
        throw error;
    }
}

// =============================================
// NOTAS: Agregar
// =============================================
async function agregarNota(clienteId, contenido, imagenes = []) {
    try {
        // 1. Subir imágenes si hay
        const imagenesSubidas = [];
        for (const imagen of imagenes) {
            const timestamp = Date.now();
            const extension = imagen.name.split('.').pop();
            const nombreImagen = `${timestamp}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
            const rutaImagen = `notas/${clienteId}/${nombreImagen}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('documentos-clientes')
                .upload(rutaImagen, imagen);

            if (!uploadError) {
                imagenesSubidas.push(rutaImagen);
            }
        }

        // 2. Guardar nota
        const user = await getCurrentUser();
        
        const { data, error } = await supabaseClient
            .from('notas')
            .insert({
                cliente_id: clienteId,
                contenido: contenido,
                imagenes: imagenesSubidas,
                autor_id: user?.id || null
            })
            .select(`
                *,
                autor:usuarios(*)
            `)
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('❌ Error al agregar nota:', error);
        throw error;
    }
}

// =============================================
// BÚSQUEDA: Buscar clientes
// =============================================
async function buscarClientes(termino) {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select(`
                *,
                polizas (*)
            `)
            .or(`nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,email.ilike.%${termino}%`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('❌ Error en búsqueda:', error);
        throw error;
    }
}

// =============================================
// Log de inicio
// =============================================
