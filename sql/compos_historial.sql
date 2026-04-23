-- ============================================
-- aplicar_cambios_pendientes
-- Registra TODOS los 43 campos en historial_cambios
-- ============================================

CREATE OR REPLACE FUNCTIO aplicar_cambios_pendientes()
RETURNS TABLE (
    cambios_aplicados INT,
    errores_encontrados INT,
    detalles TEXT
)

LANGUAGE plpgsql
AS $$
DECLARE
    cambio RECORD;
    contador_aplicador INT := 0;
    contador_errores INT := 0;
    detalle_errores TEXT := '';
BEGIN
    -- Buscar todos los cambios pendientes cuya fecha de efectividad ya pasó
    FOR cambio INT
        SELECT * FROM polizas_pendientes
        WHERE estado = 'pendiente'
        AND fecha_efectividad <= CURRENT_DATE
        ORDER BY fecha_efectividad ASC
    LOOP
        BEGIN 

        -- ======================================
        -- ACTULIZAR TABLA CLIENTES
        -- ======================================
        UPDATE clientes SET
            -- Datos personales
            nombres             = COALESCE(cambio.datos_nuevos ->> 'nombres', nombres),
            apellidos           = COALESCE(cambio.datos_nuevos ->> 'apellidos', apellidos),
            genero              = COALESCE(cambio.datos_nuevos ->> 'genero', genero),
            fecha_nacimiento    = COALESCE(cambio.datos_nuevos ->> 'fecha_nacimiento', fecha_nacimiento),

            -- Contacto
            email       = COALESCE(cambio.datos_nuevos ->> 'email', email),
            telefono1   = COALESCE(cambio.datos_nuevos ->> 'telefono1', telefono1),
            telefono2   = COALESCE(cambio.datos_nuevos ->> 'telefono2', telefono2),

            -- Dirección
            direccion           = COALESCE(cambio.datos_nuevos ->> 'direccion', direccion),
            casa_apartamento    = COALESCE(cambio.datos_nuevos ->> 'casa_apartamento', casa_apartamento),
            condado             = COALESCE(cambio.datos_nuevos ->> 'condado', condado),
            ciudad              = COALESCE(cambio.datos_nuevos ->> 'ciudad', ciudad),
            estado              = COALESCE(cambio.datos_nuevos ->> 'estado', estado),
            codigo_postal       = COALESCE(cambio.datos_nuevos ->> 'codigo_postal', codigo_postal),
            po_box              = COALESCE(cambio.datos_nuevos ->> 'po_box', po_box),

            -- Info legal
            estado_migratorio   = COALESCE(cambio.datos_nuevos ->> 'estado_migratorio', estado_migratorio)
            ssn                 = COALESCE(cambio.datos_nuevos ->> 'ssn', ssn),
            nacionalidad        = COALESCE(cambio.datos_nuevos ->> 'nacionalidad', nacionalidad),

            -- Info laboral
            ingreso_anual       = COALESCE(cambio.datos_nuevos ->> 'ingreso_anual', ingreso_anual),
            ocupacion           = COALESCE(cambio.datos_nuevos ->> 'ocupacion', ocupacion),

            -- Operador
            operador_nombre         = COALESCE(cambio.datos_nuevos ->> 'operador_nombre', operador_nombre),
            venta_realizada_por     = COALESCE(cambio.datos_nuevos ->> 'venta_realizada_por', venta_realizada_por),

            -- Otros
            aplica                  = COALESCE(cambio.datos_nuevos ->> 'aplica', aplica),
            tipo_registro           = COALESCE(cambio.datos_nuevos ->> 'tipo_registro', tipo_registro),

            -- Metadata
            updated_at              = NOW()
        WHERE id = cambio.cliente_id;

        -- ==============================
        -- ACTUALIZAR TABLA POLIZAS
        -- ==============================
        UPDATE polizas SET
            aplicantes              = COALESCE((cambio.datos_nuevos ->> 'aplicantes')::INT, datos_nuevos),
            compania                = COALESCE(cambio.datos_nuevos ->> 'compania', compania),
            plan                    = COALESCE(cambio.datos_nuevos ->> 'plan', plan),
            prima                   = COALESCE((cambio.datos_nuevos ->> 'prima')::NUMERIC, prima),
            credito_fiscal          = COALESCE((cambio.datos_nuevos ->> 'credito_fiscal'):: NUMERIC, credito_fiscal),
            member_id               = COALESCE(cambio.datos_nuevos ->> 'member_id', member_id),
            clave_seguridad         = COALESCE(cambio.datos_nuevos ->> 'clave_Seguridad', clave_Seguridad),
            enlace_poliza           = COALESCE(cambio.datos_nuevos ->> 'enlace_poliza', enlace_poliza),
            agente_nombre           = COALESCE(cambio.datos_nuevos ->> 'agente_nombre', agente_nombre),
            fecha_efectividad       = COALESCE((cambio.datos_nuevos ->> 'fecha_efectividad'::DATE, fecha_efectividad)),
            fecha_inicial_cobertura = COALESCE((cambio.datos_nuevos ->> 'fecha_inicial_cobertura')::DATE, fecha_inicial_cobertura),
            fecha_final_cobertura   = COALESCE((cambio.datos_nuevos ->> 'fecha_final_cobertura'):: DATE, fecha_final_cobertura),
            updated_at              = NOW()
        WHERE id = cambio.polizas_id;

        -- ================================
        -- ACTUALIZAR MÉTODO DE PAGO
        -- ================================
        IF cambio.metodo_pago_nuevo IS NOT NULL THEN
            -- Desactivar métodos anteriores
            UPDATE metodos_pago
            SET activo = false
            WHERE cliente_id = cambio.cliente_id;

            -- Insertar nuevo método
            INSERT INTO metodos_pago (
                cliente_id,
                tipo,
                nombre_banco,
                numero_cuenta,
                numero_routing,
                tipo_cuenta,
                numero_tarjeta,
                fecha_expiracion,
                cvv,
                nombre_titular,
                activo
            ) VALUES (
                cambio.cliente_id,
                cambio.metodo_pago_nuevo ->> 'tipo',
                cambio.metodo_pago_nuevo ->> 'nombre_banco',
                cambio.metodo_pago_nuevo ->> 'numero_cuenta',
                cambio.metodo_pago_nuevo ->> 'numero_routing',
                cambio.metodo_pago_nuevo ->> 'tipo_cuenta',
                cambio.metodo_pago_nuevo ->> 'numero_tarjeta',
                cambio.metodo_pago_nuevo ->> 'fecha_expiración',
                cambio.metodo_pago_nuevo ->> 'cvv',
                cambio.metodo_pago_nuevo ->> 'nombre_titular',
                true
            );
        END IF

        -- ===========================
        -- INSERTAR DOCUMENTOS (Si existen)
        -- ===========================

        IF cambio.documetos_nuevos IS NOT NULL THEN
            INSERT INTO documentos (
                cliente_id,
                nombre_archivo,
                url_archivo,
                tipo_archivo,
                tamanio,
                uploaded_by,
                notas
            )
            SELECT
                cambio.cliente_id,
                doc ->> 'nombre_archivo',
                doc ->> 'url_archivo',
                doc ->> 'tipo_archivo',
                (doc ->> 'tamanio')::BIGINT,
                (SELECT id FROM usuario WHERE email = cambio.creado_por LIMIT 1),
                'Documento de ' || cambio.tipo_cambio || ' aplicado automaticamente'
            FROM jsonb_array_elements(cambio.documentos_nuevos) AS doc;
        END IF;

        -- ===========================
        -- INSERTAR DEPENDIENTES        
        -- ===========================
        IF cambio.dependientes_nuevos IS NOT NULL THEN
            INSERT INTO dependientes (
                cliente_id,
                nombre,
                apellidos,
                fecha_nacimiento,
                genero,
                relacion,
                ssn
            )
            SELECT
                cambio.cliente_id,
                dep ->> 'nombre',
                dep ->> 'apellidos',
                (dep ->> 'fecha_nacimiento')::DATE,
                dep ->> 'genero',
                dep - >> 'relacion',
                dep ->> 'ssn'
            FROM jsonb_array_elements(cambio.dependientes_nuevos) AS dep;
        END IF

        -- ===========================
        -- REGISTRAR EN HISTORIAL_CAMBIOS
        -- ===========================

        -- Registro general de aplicación
        INSERT INTO historial_cambios (
            cliente_id,
            tipo_cambio,
            seccion,
            compo_modificado,
            valor_anterior,
            valor_nuevo,
            usuario_nombre,
            usuario_email
        ) VALUES (
            cambio.cliente_id,
            CASE
                WHEN cambio.tipo_cambio = 'recuperado' THEN 'recuperado_aplicado'
                WHEN cambio.tipo_cambio = 'cambio_de_vida' THEN 'cambio_vida_aplicado'
                ELSE 'modificacion_aplicada'
            END,
            'Sistema',
            'Aplicación Automática',
            'Programado para ' || TO_CHAR(cambio.fecha_efectividad, 'DD/MM/YYYY')
            'Aplicado el ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI'),
            'Sistema Automático (pg_cron)',
            cambio.creado_por
        );

        -- ===========================
        -- DATOS PERSONALES
        -- ===========================
        
        -- Nombres
        IF cambio.datos_nuevos ? 'nombres' AND
            (cambio.datos_anterirores->'cliente'->>'nombres' IS DISTINCT FROM cambio.datos_nuevo->>'nombres') THEN
            INSERT INTO historial_cambios (cliente_id, tipo_cambio, seccion, campo_modificado, valor_anterior, valor_nuevo, usuario_nombre, usuario_email)
            VALUES (cambio.cliente_id, cambio.tipo_cambio, 'Datos Personales', 'Nombres',
                    cambio.datos_anterirores->'cliente'->>'nombres', cambio.datos_nuevos->>'nombres',
                    'Sistema Automático', cambio.creado_por);
        END IF

        -- Apellidos
        IF cambio.datos_nuevos ? 'apellidos' AND
            (cambio.datos_anterirores -> 'cliente' ->> 'apellidos' IS DISTINCT FROM cambio.datos_nuevo ->> 'nombres')
            INSERT INTO historial_cambios (cliente_id,, tipo_cambio, seccion, campo_modificado, valor_anterior, valor_nuevo, usuario_nombre, usuario_email)
            VALUES (cambio.cliente_id, cambio.tipo_cambiom 'Datos Personales', 'Apellidos',
                    cambio.datos_anterirores - > 'cliente' ->> 'apellidos', cambio.datos_nuevos ->> 'apellidos',
                    'Sistema Automático', cambio.creado_por);
        END IF;

        -- Genero