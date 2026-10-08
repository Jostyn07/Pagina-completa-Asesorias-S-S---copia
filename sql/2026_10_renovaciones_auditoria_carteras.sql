-- ================================================================
-- Asesorías S&S - Renovaciones, auditoría integral y acceso a carteras
-- Rama: feat/renovaciones-auditoria-carteras
-- ================================================================
-- PRINCIPIOS:
-- 1) Renovar es una operación transaccional: nuevo cliente + nueva póliza
--    y la póliza anterior queda marcada como renovada.
-- 2) El nuevo cliente NO comparte client_id con el anterior.
-- 3) Se copian datos maestros/dependientes/métodos de pago actuales.
--    NO se copian notas, movimientos, documentos, pagos históricos ni
--    historial: esos registros pertenecen al periodo/cliente anterior.
-- 4) La auditoría de actividad es independiente de historial_cambios y
--    auditoria_polizas. Registra vistas, acciones UI y mutaciones DB.
-- 5) Los eventos de auditoría se conservan exactamente un año mediante
--    expires_at + pg_cron.
-- 6) El acceso a carteras se concede explícitamente por propietario de
--    cartera o a todas las carteras cuyos propietarios tengan rol operador.

BEGIN;

-- ================================================================
-- 1. CAMPOS DE RENOVACIÓN EN PÓLIZAS
-- ================================================================

ALTER TABLE public.polizas
    ADD COLUMN IF NOT EXISTS estado_renovacion text NOT NULL DEFAULT 'pendiente',
    ADD COLUMN IF NOT EXISTS renovada_at timestamptz,
    ADD COLUMN IF NOT EXISTS renovada_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS renovacion_origen_poliza_id uuid REFERENCES public.polizas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS renovacion_origen_cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS renovacion_destino_poliza_id uuid REFERENCES public.polizas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS renovacion_destino_cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

UPDATE public.polizas
SET estado_renovacion = 'pendiente'
WHERE estado_renovacion IS NULL;

ALTER TABLE public.polizas
    DROP CONSTRAINT IF EXISTS polizas_estado_renovacion_check;

ALTER TABLE public.polizas
    ADD CONSTRAINT polizas_estado_renovacion_check
    CHECK (estado_renovacion IN ('pendiente','renovada','no_renovada'));

CREATE INDEX IF NOT EXISTS idx_polizas_estado_renovacion
    ON public.polizas(estado_renovacion);

CREATE INDEX IF NOT EXISTS idx_polizas_renovacion_destino
    ON public.polizas(renovacion_destino_poliza_id)
    WHERE renovacion_destino_poliza_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_polizas_renovacion_origen
    ON public.polizas(renovacion_origen_poliza_id)
    WHERE renovacion_origen_poliza_id IS NOT NULL;

-- ================================================================
-- 2. TABLA DE NEGOCIO DE RENOVACIONES
-- ================================================================

CREATE TABLE IF NOT EXISTS public.renovaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poliza_origen_id uuid NOT NULL REFERENCES public.polizas(id) ON DELETE RESTRICT,
    cliente_origen_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
    poliza_nueva_id uuid NOT NULL UNIQUE REFERENCES public.polizas(id) ON DELETE RESTRICT,
    cliente_nuevo_id uuid NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE RESTRICT,
    realizada_por_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    realizada_por_nombre text,
    realizada_por_email text,
    portal text,
    fecha_efectiva date NOT NULL DEFAULT DATE '2027-01-01',
    anio integer NOT NULL DEFAULT 2027,
    realizada_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renovaciones_anio
    ON public.renovaciones(anio);

CREATE INDEX IF NOT EXISTS idx_renovaciones_operador
    ON public.renovaciones(realizada_por_id);

CREATE INDEX IF NOT EXISTS idx_renovaciones_fecha
    ON public.renovaciones(realizada_en DESC);

ALTER TABLE public.renovaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS renovaciones_select ON public.renovaciones;
CREATE POLICY renovaciones_select
ON public.renovaciones
FOR SELECT
TO authenticated
USING (
    es_admin_general(auth.uid())
    OR tiene_permiso(auth.uid(), 'ver_ranking_renovaciones')
);

-- ================================================================
-- 3. AUDITORÍA INTEGRAL DE EVENTOS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.auditoria_eventos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    usuario_nombre text,
    usuario_email text,
    rol text,
    accion text NOT NULL,
    recurso text,
    recurso_id text,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    cliente_nombre text,
    poliza_id uuid REFERENCES public.polizas(id) ON DELETE SET NULL,
    poliza_numero text,
    ruta text,
    metodo text,
    detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 year')
);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_created_at
    ON public.auditoria_eventos(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_usuario
    ON public.auditoria_eventos(usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_accion
    ON public.auditoria_eventos(accion, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_cliente
    ON public.auditoria_eventos(cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_poliza
    ON public.auditoria_eventos(poliza_id, created_at DESC);

ALTER TABLE public.auditoria_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_eventos_select ON public.auditoria_eventos;
CREATE POLICY auditoria_eventos_select
ON public.auditoria_eventos
FOR SELECT
TO authenticated
USING (
    es_admin_general(auth.uid())
    OR tiene_permiso(auth.uid(), 'ver_logs_auditoria')
);

-- No se otorga INSERT directo a usuarios. Los registros entran por RPC
-- SECURITY DEFINER o por el trigger de auditoría.

-- ================================================================
-- 4. ACCESO MANUAL A CARTERAS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.portfolio_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    owner_user_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
    scope text NOT NULL DEFAULT 'user_portfolio',
    activo boolean NOT NULL DEFAULT true,
    granted_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    CONSTRAINT portfolio_access_scope_check
        CHECK (
            (scope = 'user_portfolio' AND owner_user_id IS NOT NULL)
            OR
            (scope = 'all_asesorias' AND owner_user_id IS NULL)
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_portfolio_access_user
    ON public.portfolio_access(operator_id, owner_user_id)
    WHERE scope = 'user_portfolio';

CREATE UNIQUE INDEX IF NOT EXISTS ux_portfolio_access_all_asesorias
    ON public.portfolio_access(operator_id)
    WHERE scope = 'all_asesorias' AND activo = true;

CREATE INDEX IF NOT EXISTS idx_portfolio_access_operator
    ON public.portfolio_access(operator_id, activo);

CREATE INDEX IF NOT EXISTS idx_portfolio_access_owner
    ON public.portfolio_access(owner_user_id, activo);

ALTER TABLE public.portfolio_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portfolio_access_select ON public.portfolio_access;
CREATE POLICY portfolio_access_select
ON public.portfolio_access
FOR SELECT
TO authenticated
USING (
    es_admin_general(auth.uid())
    OR tiene_permiso(auth.uid(), 'gestionar_carteras')
    OR operator_id = auth.uid()
);

-- ================================================================
-- 5. CATÁLOGO DE PERMISOS
-- ================================================================

INSERT INTO public.catalogo_permisos (clave, nombre, categoria, valor_por_defecto)
VALUES
    ('renovar_poliza', 'Renovar pólizas', 'Pólizas', false),
    ('ver_logs_auditoria', 'Ver logs de auditoría', 'Administración', false),
    ('gestionar_carteras', 'Gestionar accesos a carteras', 'Administración', false),
    ('ver_ranking_renovaciones', 'Ver ranking de renovaciones', 'Análisis', false)
ON CONFLICT (clave) DO UPDATE
SET nombre = EXCLUDED.nombre,
    categoria = EXCLUDED.categoria;

-- Operadores/supervisores pueden ejecutar renovaciones por defecto.
INSERT INTO public.permisos_rol (rol, portal, permiso_clave, valor, actualizado_por)
SELECT r.rol, 'TODOS', 'renovar_poliza', true, NULL
FROM (VALUES ('operador'), ('supervisor'), ('admin')) AS r(rol)
ON CONFLICT (rol, portal, permiso_clave)
DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now();

-- Administración: auditoría/carteras/ranking.
INSERT INTO public.permisos_rol (rol, portal, permiso_clave, valor, actualizado_por)
VALUES
    ('admin', 'TODOS', 'ver_logs_auditoria', true, NULL),
    ('admin', 'TODOS', 'gestionar_carteras', true, NULL),
    ('admin', 'TODOS', 'ver_ranking_renovaciones', true, NULL),
    ('supervisor', 'TODOS', 'ver_ranking_renovaciones', true, NULL)
ON CONFLICT (rol, portal, permiso_clave)
DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now();

-- ================================================================
-- 6. HELPERS DE ACCESO A CARTERA
-- ================================================================

CREATE OR REPLACE FUNCTION public.puede_acceder_cartera(
    p_operador_id uuid,
    p_usuario_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        CASE
            WHEN p_operador_id IS NULL OR p_usuario_id IS NULL THEN false
            WHEN p_usuario_id = p_operador_id THEN true
            WHEN es_admin_general(p_usuario_id) THEN true
            WHEN EXISTS (
                SELECT 1
                FROM public.portfolio_access pa
                WHERE pa.operator_id = p_usuario_id
                  AND pa.activo = true
                  AND (
                      (pa.scope = 'user_portfolio' AND pa.owner_user_id = p_operador_id)
                      OR
                      (
                          pa.scope = 'all_asesorias'
                          AND EXISTS (
                              SELECT 1
                              FROM public.usuarios owner_u
                              WHERE owner_u.id = p_operador_id
                                AND owner_u.rol = 'operador'
                                AND COALESCE(owner_u.activo, true)
                          )
                      )
                  )
            ) THEN true
            ELSE false
        END;
$$;

GRANT EXECUTE ON FUNCTION public.puede_acceder_cartera(uuid, uuid) TO authenticated;

-- Políticas adicionales y permisivas: no rompen las reglas actuales por portal;
-- simplemente agregan la nueva vía de acceso manual.
DROP POLICY IF EXISTS clientes_portfolio_grant_select ON public.clientes;
CREATE POLICY clientes_portfolio_grant_select
ON public.clientes
FOR SELECT
TO authenticated
USING (puede_acceder_cartera(operador_id, auth.uid()));

DROP POLICY IF EXISTS clientes_portfolio_grant_update ON public.clientes;
CREATE POLICY clientes_portfolio_grant_update
ON public.clientes
FOR UPDATE
TO authenticated
USING (puede_acceder_cartera(operador_id, auth.uid()))
WITH CHECK (puede_acceder_cartera(operador_id, auth.uid()));

DROP POLICY IF EXISTS polizas_portfolio_grant_select ON public.polizas;
CREATE POLICY polizas_portfolio_grant_select
ON public.polizas
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = polizas.cliente_id
          AND puede_acceder_cartera(c.operador_id, auth.uid())
    )
);

DROP POLICY IF EXISTS polizas_portfolio_grant_update ON public.polizas;
CREATE POLICY polizas_portfolio_grant_update
ON public.polizas
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = polizas.cliente_id
          AND puede_acceder_cartera(c.operador_id, auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = polizas.cliente_id
          AND puede_acceder_cartera(c.operador_id, auth.uid())
    )
);

-- ================================================================
-- 7. RPC PARA CONCEDER/REVOCAR ACCESO A CARTERAS
-- ================================================================

CREATE OR REPLACE FUNCTION public.otorgar_acceso_cartera(
    p_operator_id uuid,
    p_owner_user_id uuid DEFAULT NULL,
    p_scope text DEFAULT 'user_portfolio'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
    v_scope text := COALESCE(NULLIF(trim(p_scope), ''), 'user_portfolio');
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sesión requerida';
    END IF;

    IF NOT (es_admin_general(auth.uid()) OR tiene_permiso(auth.uid(), 'gestionar_carteras')) THEN
        RAISE EXCEPTION 'No tienes permiso para gestionar carteras';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = p_operator_id
          AND u.rol = 'operador'
          AND COALESCE(u.activo, true)
    ) THEN
        RAISE EXCEPTION 'El usuario operador indicado no es válido o está inactivo';
    END IF;

    IF v_scope = 'user_portfolio' THEN
        IF p_owner_user_id IS NULL THEN
            RAISE EXCEPTION 'Debes seleccionar el propietario de la cartera';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = p_owner_user_id
              AND COALESCE(u.activo, true)
        ) THEN
            RAISE EXCEPTION 'El propietario de la cartera no existe o está inactivo';
        END IF;

        INSERT INTO public.portfolio_access (
            operator_id, owner_user_id, scope, activo, granted_by, granted_at, revoked_at
        )
        VALUES (
            p_operator_id, p_owner_user_id, 'user_portfolio', true, auth.uid(), now(), NULL
        )
        ON CONFLICT (operator_id, owner_user_id)
        WHERE scope = 'user_portfolio'
        DO UPDATE SET
            activo = true,
            granted_by = auth.uid(),
            granted_at = now(),
            revoked_at = NULL
        RETURNING id INTO v_id;
    ELSIF v_scope = 'all_asesorias' THEN
        INSERT INTO public.portfolio_access (
            operator_id, owner_user_id, scope, activo, granted_by, granted_at, revoked_at
        )
        VALUES (
            p_operator_id, NULL, 'all_asesorias', true, auth.uid(), now(), NULL
        )
        ON CONFLICT (operator_id)
        WHERE scope = 'all_asesorias' AND activo = true
        DO UPDATE SET
            activo = true,
            granted_by = auth.uid(),
            granted_at = now(),
            revoked_at = NULL
        RETURNING id INTO v_id;
    ELSE
        RAISE EXCEPTION 'Scope de cartera no válido: %', v_scope;
    END IF;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.otorgar_acceso_cartera(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revocar_acceso_cartera(
    p_access_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sesión requerida';
    END IF;

    IF NOT (es_admin_general(auth.uid()) OR tiene_permiso(auth.uid(), 'gestionar_carteras')) THEN
        RAISE EXCEPTION 'No tienes permiso para gestionar carteras';
    END IF;

    UPDATE public.portfolio_access
    SET activo = false,
        revoked_at = now()
    WHERE id = p_access_id;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revocar_acceso_cartera(uuid) TO authenticated;

-- ================================================================
-- 8. RPC CENTRAL DE AUDITORÍA
-- ================================================================

CREATE OR REPLACE FUNCTION public.registrar_evento_auditoria(
    p_accion text,
    p_recurso text DEFAULT NULL,
    p_recurso_id text DEFAULT NULL,
    p_cliente_id uuid DEFAULT NULL,
    p_poliza_id uuid DEFAULT NULL,
    p_ruta text DEFAULT NULL,
    p_metodo text DEFAULT NULL,
    p_detalle jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_usuario record;
    v_cliente record;
    v_poliza record;
    v_ip text;
    v_ua text;
    v_detalle jsonb := COALESCE(p_detalle, '{}'::jsonb);
    v_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT id, nombre, email, rol
      INTO v_usuario
      FROM public.usuarios
     WHERE id = v_user_id;

    IF v_usuario.id IS NULL THEN
        RETURN NULL;
    END IF;

    IF p_cliente_id IS NOT NULL THEN
        SELECT id, concat_ws(' ', nombres, apellidos) AS nombre
          INTO v_cliente
          FROM public.clientes
         WHERE id = p_cliente_id;
    END IF;

    IF p_poliza_id IS NOT NULL THEN
        SELECT id, numero_poliza
          INTO v_poliza
          FROM public.polizas
         WHERE id = p_poliza_id;
    END IF;

    -- Jamás guardar secretos o credenciales en la bitácora semántica.
    v_detalle := v_detalle
        - 'password'
        - 'token'
        - 'refresh_token'
        - 'access_token'
        - 'cvv'
        - 'numero_tarjeta'
        - 'numero_cuenta'
        - 'routing_number'
        - 'ssn';

    BEGIN
        v_ip := current_setting('request.headers', true)::json->>'x-real-ip';
    EXCEPTION WHEN OTHERS THEN
        v_ip := NULL;
    END;

    BEGIN
        v_ua := current_setting('request.headers', true)::json->>'user-agent';
    EXCEPTION WHEN OTHERS THEN
        v_ua := NULL;
    END;

    INSERT INTO public.auditoria_eventos (
        usuario_id, usuario_nombre, usuario_email, rol,
        accion, recurso, recurso_id,
        cliente_id, cliente_nombre,
        poliza_id, poliza_numero,
        ruta, metodo, detalle, ip, user_agent,
        created_at, expires_at
    )
    VALUES (
        v_user_id,
        v_usuario.nombre,
        v_usuario.email,
        v_usuario.rol,
        p_accion,
        p_recurso,
        p_recurso_id,
        p_cliente_id,
        v_cliente.nombre,
        p_poliza_id,
        v_poliza.numero_poliza,
        p_ruta,
        p_metodo,
        v_detalle,
        v_ip,
        v_ua,
        now(),
        now() + interval '1 year'
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_evento_auditoria(
    text, text, text, uuid, uuid, text, text, jsonb
) TO authenticated;

-- ================================================================
-- 9. TRIGGER DE AUDITORÍA DB: CADA MUTACIÓN DE OPERADOR
-- ================================================================

CREATE OR REPLACE FUNCTION public.auditar_mutacion_operador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_row jsonb;
    v_old jsonb := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
    v_new jsonb := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
    v_resource_id text;
    v_cliente_id uuid;
    v_poliza_id uuid;
    v_changed jsonb := '[]'::jsonb;
BEGIN
    IF v_uid IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    v_row := CASE WHEN TG_OP = 'DELETE' THEN v_old ELSE v_new END;
    v_resource_id := COALESCE(v_row->>'id', v_row->>'usuario_id', v_row->>'clave');

    BEGIN
        IF TG_TABLE_NAME = 'clientes' THEN
            v_cliente_id := NULLIF(v_row->>'id','')::uuid;
        ELSE
            v_cliente_id := NULLIF(v_row->>'cliente_id','')::uuid;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_cliente_id := NULL;
    END;

    BEGIN
        IF TG_TABLE_NAME = 'polizas' THEN
            v_poliza_id := NULLIF(v_row->>'id','')::uuid;
            v_cliente_id := NULLIF(v_row->>'cliente_id','')::uuid;
        ELSE
            v_poliza_id := NULLIF(v_row->>'poliza_id','')::uuid;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_poliza_id := NULL;
    END;

    IF TG_OP = 'UPDATE' THEN
        SELECT COALESCE(jsonb_agg(k), '[]'::jsonb)
          INTO v_changed
          FROM jsonb_object_keys(v_new) AS k
         WHERE v_new -> k IS DISTINCT FROM v_old -> k;
    END IF;

    PERFORM public.registrar_evento_auditoria(
        lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
        TG_TABLE_NAME,
        v_resource_id,
        v_cliente_id,
        v_poliza_id,
        NULL,
        TG_OP,
        jsonb_build_object(
            'source', 'db_trigger',
            'operation', TG_OP,
            'changed_fields', v_changed
        )
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Nota: NO se audita la tabla auditoria_eventos para evitar recursividad.
DROP TRIGGER IF EXISTS trg_audit_clientes ON public.clientes;
CREATE TRIGGER trg_audit_clientes
AFTER INSERT OR UPDATE OR DELETE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_polizas ON public.polizas;
CREATE TRIGGER trg_audit_polizas
AFTER INSERT OR UPDATE OR DELETE ON public.polizas
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_dependientes ON public.dependientes;
CREATE TRIGGER trg_audit_dependientes
AFTER INSERT OR UPDATE OR DELETE ON public.dependientes
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_metodos_pago ON public.metodos_pago;
CREATE TRIGGER trg_audit_metodos_pago
AFTER INSERT OR UPDATE OR DELETE ON public.metodos_pago
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_documentos ON public.documentos;
CREATE TRIGGER trg_audit_documentos
AFTER INSERT OR UPDATE OR DELETE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_notas ON public.notas;
CREATE TRIGGER trg_audit_notas
AFTER INSERT OR UPDATE OR DELETE ON public.notas
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_movimientos ON public.movimientos;
CREATE TRIGGER trg_audit_movimientos
AFTER INSERT OR UPDATE OR DELETE ON public.movimientos
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_seguimientos ON public.seguimientos;
CREATE TRIGGER trg_audit_seguimientos
AFTER INSERT OR UPDATE OR DELETE ON public.seguimientos
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_permisos_rol ON public.permisos_rol;
CREATE TRIGGER trg_audit_permisos_rol
AFTER INSERT OR UPDATE OR DELETE ON public.permisos_rol
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_permisos_usuario ON public.permisos_usuario;
CREATE TRIGGER trg_audit_permisos_usuario
AFTER INSERT OR UPDATE OR DELETE ON public.permisos_usuario
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_portfolio_access ON public.portfolio_access;
CREATE TRIGGER trg_audit_portfolio_access
AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_access
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

DROP TRIGGER IF EXISTS trg_audit_renovaciones ON public.renovaciones;
CREATE TRIGGER trg_audit_renovaciones
AFTER INSERT OR UPDATE OR DELETE ON public.renovaciones
FOR EACH ROW EXECUTE FUNCTION public.auditar_mutacion_operador();

-- ================================================================
-- 10. RPC DE RENOVACIÓN COMPLETA
-- ================================================================

CREATE OR REPLACE FUNCTION public.renovar_poliza(
    p_poliza_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_user record;
    v_old_poliza public.polizas%ROWTYPE;
    v_old_cliente public.clientes%ROWTYPE;
    v_new_cliente public.clientes%ROWTYPE;
    v_new_poliza public.polizas%ROWTYPE;
    v_new_cliente_id uuid := gen_random_uuid();
    v_new_poliza_id uuid := gen_random_uuid();
    v_seq integer;
    v_new_numero text;
    v_renewal_id uuid;
    v_dep record;
    v_dep_new public.dependientes%ROWTYPE;
    v_mp record;
    v_mp_new public.metodos_pago%ROWTYPE;
    v_json jsonb;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sesión requerida';
    END IF;

    SELECT id, nombre, email, rol
      INTO v_user
      FROM public.usuarios
     WHERE id = v_uid;

    IF v_user.id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;

    IF NOT (
        es_admin_general(v_uid)
        OR tiene_permiso(v_uid, 'renovar_poliza')
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para renovar pólizas';
    END IF;

    SELECT *
      INTO v_old_poliza
      FROM public.polizas
     WHERE id = p_poliza_id
     FOR UPDATE;

    IF v_old_poliza.id IS NULL THEN
        RAISE EXCEPTION 'Póliza no encontrada';
    END IF;

    IF v_old_poliza.estado_renovacion = 'renovada'
       OR v_old_poliza.renovacion_destino_poliza_id IS NOT NULL
    THEN
        RAISE EXCEPTION 'Esta póliza ya tiene una renovación registrada';
    END IF;

    SELECT *
      INTO v_old_cliente
      FROM public.clientes
     WHERE id = v_old_poliza.cliente_id
     FOR UPDATE;

    IF v_old_cliente.id IS NULL THEN
        RAISE EXCEPTION 'Cliente de la póliza no encontrado';
    END IF;

    IF NOT (
        v_old_cliente.portal = ANY (COALESCE(portales_del_usuario(v_uid), ARRAY[]::text[]))
        OR puede_acceder_cartera(v_old_cliente.operador_id, v_uid)
        OR es_admin_general(v_uid)
    ) THEN
        RAISE EXCEPTION 'No tienes acceso a la cartera de este cliente';
    END IF;

    -- Secuencia de póliza 2027. El lock de transacción evita dos renovaciones
    -- simultáneas con el mismo número.
    PERFORM pg_advisory_xact_lock(hashtextextended('polizas-2027', 0));

    SELECT COALESCE(
        MAX(
            CASE
                WHEN numero_poliza ~ '^POL-2027-[0-9]+$'
                THEN substring(numero_poliza FROM '[0-9]+$')::integer
                ELSE 0
            END
        ), 0
    ) + 1
      INTO v_seq
      FROM public.polizas;

    v_new_numero := 'POL-2027-' || lpad(v_seq::text, 4, '0');

    -- ============================================================
    -- NUEVO CLIENTE
    -- ============================================================

    INSERT INTO public.clientes (
        id,
        tipo_registro,
        fecha_registro,
        nombres,
        apellidos,
        fecha_nacimiento,
        genero,
        ssn,
        estado_migratorio,
        email,
        telefono1,
        telefono2,
        direccion,
        ciudad,
        estado,
        codigo_postal,
        ocupacion,
        ingreso_anual,
        operador_nombre,
        agente_nombre,
        aplica,
        tipo_modificacion,
        nacionalidad,
        casa_apartamento,
        condado,
        operador_id,
        operador_email,
        archivado,
        archivado_por,
        archivado_fecha,
        motivo_archivo,
        po_box,
        tiene_po_box,
        venta_realizada_por,
        tiene_social,
        caso_especial,
        portal,
        tipo_declaracion,
        condiciones_medicas
    )
    VALUES (
        v_new_cliente_id,
        'Renovacion',
        v_old_cliente.fecha_registro,
        v_old_cliente.nombres,
        v_old_cliente.apellidos,
        v_old_cliente.fecha_nacimiento,
        v_old_cliente.genero,
        v_old_cliente.ssn,
        v_old_cliente.estado_migratorio,
        v_old_cliente.email,
        v_old_cliente.telefono1,
        v_old_cliente.telefono2,
        v_old_cliente.direccion,
        v_old_cliente.ciudad,
        v_old_cliente.estado,
        v_old_cliente.codigo_postal,
        v_old_cliente.ocupacion,
        v_old_cliente.ingreso_anual,
        v_old_cliente.operador_nombre,
        v_old_cliente.agente_nombre,
        v_old_cliente.aplica,
        NULL,
        v_old_cliente.nacionalidad,
        v_old_cliente.casa_apartamento,
        v_old_cliente.condado,
        v_old_cliente.operador_id,
        v_old_cliente.operador_email,
        false,
        NULL,
        NULL,
        NULL,
        v_old_cliente.po_box,
        v_old_cliente.tiene_po_box,
        v_user.nombre,
        v_old_cliente.tiene_social,
        v_old_cliente.caso_especial,
        v_old_cliente.portal,
        v_old_cliente.tipo_declaracion,
        v_old_cliente.condiciones_medicas
    )
    RETURNING * INTO v_new_cliente;

    -- ============================================================
    -- NUEVA PÓLIZA: JSONB sobre el tipo compuesto para no romperse
    -- si la tabla gana nuevos campos en futuras migraciones.
    -- ============================================================

    v_json :=
        to_jsonb(v_old_poliza)
        || jsonb_build_object(
            'id', v_new_poliza_id,
            'cliente_id', v_new_cliente_id,
            'numero_poliza', v_new_numero,
            'fecha_efectividad', DATE '2027-01-01',
            'fecha_inicial_cobertura', DATE '2027-01-01',
            'created_at', now(),
            'updated_at', now(),
            'modificado_por_nombre', v_user.nombre,
            'modificado_por_email', v_user.email,
            'estado_renovacion', 'pendiente',
            'renovada_at', NULL,
            'renovada_por', NULL,
            'renovacion_origen_poliza_id', v_old_poliza.id,
            'renovacion_origen_cliente_id', v_old_cliente.id,
            'renovacion_destino_poliza_id', NULL,
            'renovacion_destino_cliente_id', NULL
        );

    v_json := v_json - 'tipo_registro';

    SELECT *
      INTO v_new_poliza
      FROM jsonb_populate_record(NULL::public.polizas, v_json);

    INSERT INTO public.polizas
    SELECT v_new_poliza.*;

    -- ============================================================
    -- DEPENDIENTES: nuevas filas, nuevo client_id.
    -- ============================================================

    FOR v_dep IN
        SELECT to_jsonb(d) AS data
          FROM public.dependientes d
         WHERE d.cliente_id = v_old_cliente.id
    LOOP
        SELECT *
          INTO v_dep_new
          FROM jsonb_populate_record(
              NULL::public.dependientes,
              v_dep.data || jsonb_build_object(
                  'id', gen_random_uuid(),
                  'cliente_id', v_new_cliente_id
              )
          );

        INSERT INTO public.dependientes
        SELECT v_dep_new.*;
    END LOOP;

    -- ============================================================
    -- MÉTODOS DE PAGO: se copian registros actuales para que el
    -- operador no tenga que digitarlos otra vez.
    -- ============================================================

    FOR v_mp IN
        SELECT to_jsonb(m) AS data
          FROM public.metodos_pago m
         WHERE m.cliente_id = v_old_cliente.id
           AND COALESCE(m.activo, true) = true
    LOOP
        SELECT *
          INTO v_mp_new
          FROM jsonb_populate_record(
              NULL::public.metodos_pago,
              v_mp.data || jsonb_build_object(
                  'id', gen_random_uuid(),
                  'cliente_id', v_new_cliente_id
              )
          );

        INSERT INTO public.metodos_pago
        SELECT v_mp_new.*;
    END LOOP;

    -- ============================================================
    -- MARCAR PÓLIZA ORIGEN COMO RENOVADA
    -- ============================================================

    UPDATE public.polizas
       SET estado_renovacion = 'renovada',
           renovada_at = now(),
           renovada_por = v_uid,
           renovacion_destino_poliza_id = v_new_poliza_id,
           renovacion_destino_cliente_id = v_new_cliente_id,
           updated_at = now(),
           modificado_por_nombre = v_user.nombre,
           modificado_por_email = v_user.email
     WHERE id = v_old_poliza.id;

    -- ============================================================
    -- REGISTRO DE NEGOCIO
    -- ============================================================

    INSERT INTO public.renovaciones (
        poliza_origen_id,
        cliente_origen_id,
        poliza_nueva_id,
        cliente_nuevo_id,
        realizada_por_id,
        realizada_por_nombre,
        realizada_por_email,
        portal,
        fecha_efectiva,
        anio
    )
    VALUES (
        v_old_poliza.id,
        v_old_cliente.id,
        v_new_poliza_id,
        v_new_cliente_id,
        v_uid,
        v_user.nombre,
        v_user.email,
        v_old_cliente.portal,
        DATE '2027-01-01',
        2027
    )
    RETURNING id INTO v_renewal_id;

    -- Evento semántico explícito: aparece como "RENOVACIÓN" en auditoría.
    PERFORM public.registrar_evento_auditoria(
        'poliza.renovada',
        'renovaciones',
        v_renewal_id::text,
        v_old_cliente.id,
        v_old_poliza.id,
        NULL,
        'RPC',
        jsonb_build_object(
            'cliente_origen_id', v_old_cliente.id,
            'cliente_nuevo_id', v_new_cliente_id,
            'poliza_origen_id', v_old_poliza.id,
            'poliza_nueva_id', v_new_poliza_id,
            'numero_poliza_nueva', v_new_numero,
            'fecha_efectividad', '2027-01-01',
            'portal', v_old_cliente.portal
        )
    );

    RETURN jsonb_build_object(
        'ok', true,
        'renovacion_id', v_renewal_id,
        'cliente_origen_id', v_old_cliente.id,
        'cliente_nuevo_id', v_new_cliente_id,
        'poliza_origen_id', v_old_poliza.id,
        'poliza_nueva_id', v_new_poliza_id,
        'numero_poliza_nueva', v_new_numero,
        'fecha_efectividad', '2027-01-01'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.renovar_poliza(uuid) TO authenticated;

-- ================================================================
-- 11. RANKING DE RENOVACIONES
-- ================================================================

CREATE OR REPLACE FUNCTION public.obtener_ranking_renovaciones(
    p_anio integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer
)
RETURNS TABLE (
    posicion integer,
    operador_id uuid,
    operador_nombre text,
    total_renovaciones bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sesión requerida';
    END IF;

    IF NOT (
        es_admin_general(auth.uid())
        OR tiene_permiso(auth.uid(), 'ver_ranking_renovaciones')
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para ver el ranking';
    END IF;

    RETURN QUERY
    WITH r AS (
        SELECT
            coalesce(realizada_por_id, '00000000-0000-0000-0000-000000000000'::uuid) AS operador_id,
            coalesce(realizada_por_nombre, realizada_por_email, 'Sin usuario') AS operador_nombre,
            count(*)::bigint AS total_renovaciones
        FROM public.renovaciones
        WHERE anio = p_anio
        GROUP BY 1, 2
    )
    SELECT
        row_number() OVER (ORDER BY total_renovaciones DESC, operador_nombre ASC)::integer,
        operador_id,
        operador_nombre,
        total_renovaciones
    FROM r
    ORDER BY total_renovaciones DESC, operador_nombre ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_ranking_renovaciones(integer) TO authenticated;

-- ================================================================
-- 12. RETENCIÓN DE AUDITORÍA: 1 AÑO
-- ================================================================

CREATE OR REPLACE FUNCTION public.limpiar_auditoria_eventos_expirados()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count bigint;
BEGIN
    DELETE FROM public.auditoria_eventos
     WHERE expires_at < now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.limpiar_auditoria_eventos_expirados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpiar_auditoria_eventos_expirados() TO postgres;

DO $$
DECLARE
    v_exists boolean;
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        SELECT EXISTS (
            SELECT 1
            FROM cron.job
            WHERE jobname = 'cleanup-auditoria-eventos-1-anio'
        ) INTO v_exists;

        IF NOT v_exists THEN
            PERFORM cron.schedule(
                'cleanup-auditoria-eventos-1-anio',
                '15 3 * * *',
                $$SELECT public.limpiar_auditoria_eventos_expirados();$$
            );
        END IF;
    END IF;
END;
$$;

COMMIT;
