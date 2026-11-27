-- ============================================================================
-- 08_renovar_poliza_fecha.sql
-- QUÉ HACE: reescribe public.renovar_poliza(p_poliza_id text) (CREATE OR REPLACE
--   completo, basado en la definición leída de la BD el 2026-11-26) con solo:
--   (a) v_anio se declara sin valor inicial. Tras cargar v_poliza, hacer los
--       chequeos Borrador/Renovada y el bloque del borrador abierto (que sigue
--       devolviendo "continuar"), se calcula:
--         v_anio := año de efectividad + 1  (si la fecha es nula: año actual Bogotá + 1)
--       y v_inicio / v_fin se calculan ahí (antes estaban antes de cargar la póliza).
--   (b) Justo antes, el bloqueo: si fecha_efectividad no es nula y hoy
--       (America/Bogota) < 20 de octubre del año de efectividad ->
--       RAISE EXCEPTION 'Esta póliza solo se puede renovar a partir del 20 de octubre de su año de efectividad'
--       USING ERRCODE = '22023'.
--   Además: SECURITY DEFINER se mantiene, SET search_path TO 'public', 'pg_temp',
--   y REVOKE de anon/PUBLIC + GRANT a authenticated.
--
-- RIESGO: medio (función central de renovación). Si fecha_efectividad no es una
--   fecha convertible a date, el cast falla; la columna ya se usa como fecha.
--
-- ANTES:   SELECT pg_get_functiondef('public.renovar_poliza(text)'::regprocedure);
--          (guardar la salida; es igual al bloque de REVERSIÓN de abajo)
-- DESPUÉS: probar en la app: póliza con efectividad cuyo 20 oct ya pasó -> crea
--          borrador con año efectividad+1; póliza antes del 20 oct -> error
--          22023; póliza "En proceso" -> "Continuar renovación" sigue abriendo.
--
-- COHERENCIA CON EL FRONTEND: js/renovacion.js (renovacionHabilitada, línea ~146)
--   usa APERTURA_RENOVACION = { mes: 9, dia: 20 } (20 de octubre) sobre el AÑO de
--   fecha_efectividad, y no bloquea si la póliza está "En proceso" ni si no hay
--   fecha. Es la misma regla. Diferencia menor: el frontend compara con la hora
--   del navegador; el servidor usa America/Bogota (el servidor manda).
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.renovar_poliza(p_poliza_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid            uuid := auth.uid();
  v_operador       text;
  v_poliza         jsonb;
  v_cliente        jsonb;
  v_cliente_nuevo  jsonb;
  v_poliza_nueva   jsonb;
  v_abierta        record;
  v_anio           int;
  v_inicio         date;
  v_fin            date;
  v_fila           record;
  v_dependientes   int := 0;
  v_metodos        int := 0;
  v_cambios_pago   jsonb;

  excluir_cliente constant text[] := ARRAY[
    'id', 'created_at', 'updated_at', 'propietario_id',
    'archivado', 'archivado_por', 'archivado_fecha', 'motivo_archivo',
    'restaurado_por', 'restaurado_fecha'];

  excluir_poliza constant text[] := ARRAY[
    'id', 'created_at', 'updated_at', 'cliente_id', 'propietario_id',
    'plan', 'prima', 'credito_fiscal', 'member_id', 'enlace_poliza', 'numero_poliza',
    'estado_compania', 'estado_mercado', 'estado_documentos', 'documentos_pendientes',
    'notas_compania', 'observacion_compania', 'fecha_revision_compania',
    'fecha_revision_mercado', 'fecha_aprobacion_mercado', 'motivo_rechazo', 'notas_mercado', 'observacion_mercado',
    'agente35_estado', 'agente35_notas', 'agente35_fecha_actualizacion', 'agente35_actualizado_por',
    'fecha_plazo_documentos', 'pagado_hasta', 'observacion_pagos',
    'fecha_confirmacion', 'fecha_vencimiento',
    'cambio_mercado_programado_estado', 'cambio_mercado_programado_fecha',
    'modificado_por_nombre', 'modificado_por_email', 'ultimo_seguimiento',
    'estado_renovacion', 'renovada_en', 'poliza_renovada_id', 'cliente_renovado_id', 'poliza_origen_id'];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '28000';
  END IF;
  IF NOT public.tiene_permiso('renovar_poliza') THEN
    RAISE EXCEPTION 'No tienes permiso para renovar pólizas' USING ERRCODE = '42501';
  END IF;
  SELECT nombre INTO v_operador FROM public.usuarios WHERE id = v_uid;

  SELECT to_jsonb(p.*) INTO v_poliza
  FROM public.polizas p
  WHERE p.id::text = p_poliza_id
  FOR UPDATE;

  IF v_poliza IS NULL THEN
    RAISE EXCEPTION 'La póliza no existe' USING ERRCODE = 'P0002';
  END IF;

  IF v_poliza ->> 'estado_renovacion' = 'Borrador' THEN
    RAISE EXCEPTION 'Esta póliza es un borrador de renovación: termínala con el botón Renovar' USING ERRCODE = '22023';
  END IF;

  IF v_poliza ->> 'estado_renovacion' = 'Renovada'
     OR EXISTS (SELECT 1 FROM public.renovaciones r
                WHERE r.poliza_origen_id = p_poliza_id AND r.estado = 'completada') THEN
    RAISE EXCEPTION 'Esta póliza ya fue renovada' USING ERRCODE = '23505';
  END IF;

  -- Ya hay un borrador abierto: se retoma el mismo
  SELECT r.* INTO v_abierta
  FROM public.renovaciones r
  WHERE r.poliza_origen_id = p_poliza_id AND r.estado = 'en_proceso';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'continuar',  true,
      'cliente_id', v_abierta.cliente_destino_id,
      'poliza_id',  v_abierta.poliza_destino_id,
      'numero_poliza', (SELECT numero_poliza FROM public.polizas WHERE id::text = v_abierta.poliza_destino_id),
      'fecha_efectividad', v_abierta.fecha_efectividad);
  END IF;

  -- Bloqueo: solo se renueva desde el 20 de octubre del año de efectividad
  IF (v_poliza ->> 'fecha_efectividad') IS NOT NULL
     AND (now() AT TIME ZONE 'America/Bogota')::date
         < make_date(extract(year FROM (v_poliza ->> 'fecha_efectividad')::date)::int, 10, 20) THEN
    RAISE EXCEPTION 'Esta póliza solo se puede renovar a partir del 20 de octubre de su año de efectividad'
      USING ERRCODE = '22023';
  END IF;

  -- Año de la renovación = año de efectividad + 1 (sin fecha: año actual + 1)
  v_anio := coalesce(
              extract(year FROM (v_poliza ->> 'fecha_efectividad')::date)::int,
              extract(year FROM (now() AT TIME ZONE 'America/Bogota'))::int) + 1;
  v_inicio := make_date(v_anio, 1, 1);
  v_fin    := make_date(v_anio, 12, 31);

  SELECT to_jsonb(c.*) INTO v_cliente
  FROM public.clientes c
  WHERE c.id::text = v_poliza ->> 'cliente_id'
  FOR UPDATE;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'La póliza no tiene un cliente válido' USING ERRCODE = 'P0002';
  END IF;

  v_cliente_nuevo := public._copiar_fila(
    'clientes', v_cliente, excluir_cliente,
    jsonb_build_object(
      'tipo_registro',     'Renovacion',
      'tipo_modificacion', NULL,
      'fecha_registro',    to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD'),
      'archivado',         false));

  v_poliza_nueva := public._copiar_fila(
    'polizas', v_poliza, excluir_poliza,
    jsonb_build_object(
      'cliente_id',              v_cliente_nuevo -> 'id',
      'numero_poliza',           public._siguiente_numero_poliza(v_anio),
      'fecha_efectividad',       v_inicio,
      'fecha_inicial_cobertura', v_inicio,
      'fecha_final_cobertura',   v_fin,
      'estado_compania',         'pendiente',
      'estado_mercado',          'pendiente',
      'estado_renovacion',       'Borrador',
      'poliza_origen_id',        v_poliza ->> 'id'));

  IF to_regclass('public.dependientes') IS NOT NULL THEN
    FOR v_fila IN EXECUTE
      'SELECT to_jsonb(d.*) AS j FROM public.dependientes d WHERE d.cliente_id::text = $1'
      USING v_cliente ->> 'id'
    LOOP
      PERFORM public._copiar_fila('dependientes', v_fila.j, ARRAY['id', 'created_at', 'updated_at'],
        jsonb_build_object('cliente_id', v_cliente_nuevo -> 'id', 'poliza_id', v_poliza_nueva -> 'id'));
      v_dependientes := v_dependientes + 1;
    END LOOP;
  END IF;

  IF to_regclass('public.metodos_pago') IS NOT NULL THEN
    SELECT coalesce(jsonb_object_agg(column_name, 'No'), '{}'::jsonb) INTO v_cambios_pago
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'metodos_pago' AND column_name LIKE 'pago\_%';
    v_cambios_pago := v_cambios_pago || jsonb_build_object('fecha_pago', NULL, 'estado_pago', NULL);

    FOR v_fila IN EXECUTE
      'SELECT to_jsonb(m.*) AS j FROM public.metodos_pago m
        WHERE m.cliente_id::text = $1 AND coalesce((to_jsonb(m.*) ->> ''activo'')::boolean, true)'
      USING v_cliente ->> 'id'
    LOOP
      PERFORM public._copiar_fila('metodos_pago', v_fila.j, ARRAY['id', 'created_at', 'updated_at'],
        v_cambios_pago || jsonb_build_object('cliente_id', v_cliente_nuevo -> 'id', 'poliza_id', v_poliza_nueva -> 'id'));
      v_metodos := v_metodos + 1;
    END LOOP;
  END IF;

  INSERT INTO public.renovaciones
    (poliza_origen_id, cliente_origen_id, poliza_destino_id, cliente_destino_id,
     operador_id, operador_nombre, fecha_efectividad, estado, iniciada_en)
  VALUES
    (v_poliza ->> 'id', v_cliente ->> 'id', v_poliza_nueva ->> 'id', v_cliente_nuevo ->> 'id',
     v_uid, v_operador, v_inicio, 'en_proceso', now());

  -- Origen "En proceso" (guarda el enlace al borrador para "Continuar renovación")
  UPDATE public.polizas
  SET estado_renovacion   = 'En proceso',
      poliza_renovada_id  = v_poliza_nueva ->> 'id',
      cliente_renovado_id = v_cliente_nuevo ->> 'id'
  WHERE id::text = p_poliza_id;

  PERFORM public._insertar_evento(
    'poliza.renovacion_iniciar', 'polizas', v_poliza ->> 'id', v_cliente ->> 'id', v_poliza ->> 'id',
    NULL, 'rpc',
    jsonb_build_object(
      'poliza_nueva',  v_poliza_nueva ->> 'id',
      'cliente_nuevo', v_cliente_nuevo ->> 'id',
      'numero_poliza', v_poliza_nueva ->> 'numero_poliza',
      'dependientes',  v_dependientes,
      'metodos_pago',  v_metodos));

  RETURN jsonb_build_object(
    'continuar',         false,
    'cliente_id',        v_cliente_nuevo ->> 'id',
    'poliza_id',         v_poliza_nueva ->> 'id',
    'numero_poliza',     v_poliza_nueva ->> 'numero_poliza',
    'fecha_efectividad', v_inicio,
    'dependientes',      v_dependientes,
    'metodos_pago',      v_metodos);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.renovar_poliza(text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.renovar_poliza(text) TO authenticated;

COMMIT;

-- ============================================================================
-- REVERSIÓN: definición ORIGINAL completa. Para revertir, descomentar y ejecutar
-- dentro de BEGIN; ... COMMIT; (los GRANT/REVOKE de arriba pueden quedarse).
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.renovar_poliza(p_poliza_id text)
--  RETURNS jsonb
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
-- DECLARE
--   v_uid            uuid := auth.uid();
--   v_operador       text;
--   v_poliza         jsonb;
--   v_cliente        jsonb;
--   v_cliente_nuevo  jsonb;
--   v_poliza_nueva   jsonb;
--   v_abierta        record;
--   v_anio           int  := extract(year FROM (now() AT TIME ZONE 'America/Bogota'))::int + 1;
--   v_inicio         date;
--   v_fin            date;
--   v_fila           record;
--   v_dependientes   int := 0;
--   v_metodos        int := 0;
--   v_cambios_pago   jsonb;
--
--   excluir_cliente constant text[] := ARRAY[
--     'id', 'created_at', 'updated_at', 'propietario_id',
--     'archivado', 'archivado_por', 'archivado_fecha', 'motivo_archivo',
--     'restaurado_por', 'restaurado_fecha'];
--
--   excluir_poliza constant text[] := ARRAY[
--     'id', 'created_at', 'updated_at', 'cliente_id', 'propietario_id',
--     'plan', 'prima', 'credito_fiscal', 'member_id', 'enlace_poliza', 'numero_poliza',
--     'estado_compania', 'estado_mercado', 'estado_documentos', 'documentos_pendientes',
--     'notas_compania', 'observacion_compania', 'fecha_revision_compania',
--     'fecha_revision_mercado', 'fecha_aprobacion_mercado', 'motivo_rechazo', 'notas_mercado', 'observacion_mercado',
--     'agente35_estado', 'agente35_notas', 'agente35_fecha_actualizacion', 'agente35_actualizado_por',
--     'fecha_plazo_documentos', 'pagado_hasta', 'observacion_pagos',
--     'fecha_confirmacion', 'fecha_vencimiento',
--     'cambio_mercado_programado_estado', 'cambio_mercado_programado_fecha',
--     'modificado_por_nombre', 'modificado_por_email', 'ultimo_seguimiento',
--     'estado_renovacion', 'renovada_en', 'poliza_renovada_id', 'cliente_renovado_id', 'poliza_origen_id'];
-- BEGIN
--   IF v_uid IS NULL THEN
--     RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '28000';
--   END IF;
--   IF NOT public.tiene_permiso('renovar_poliza') THEN
--     RAISE EXCEPTION 'No tienes permiso para renovar pólizas' USING ERRCODE = '42501';
--   END IF;
--   SELECT nombre INTO v_operador FROM public.usuarios WHERE id = v_uid;
--
--   v_inicio := make_date(v_anio, 1, 1);
--   v_fin    := make_date(v_anio, 12, 31);
--
--   SELECT to_jsonb(p.*) INTO v_poliza
--   FROM public.polizas p
--   WHERE p.id::text = p_poliza_id
--   FOR UPDATE;
--
--   IF v_poliza IS NULL THEN
--     RAISE EXCEPTION 'La póliza no existe' USING ERRCODE = 'P0002';
--   END IF;
--
--   IF v_poliza ->> 'estado_renovacion' = 'Borrador' THEN
--     RAISE EXCEPTION 'Esta póliza es un borrador de renovación: termínala con el botón Renovar' USING ERRCODE = '22023';
--   END IF;
--
--   IF v_poliza ->> 'estado_renovacion' = 'Renovada'
--      OR EXISTS (SELECT 1 FROM public.renovaciones r
--                 WHERE r.poliza_origen_id = p_poliza_id AND r.estado = 'completada') THEN
--     RAISE EXCEPTION 'Esta póliza ya fue renovada' USING ERRCODE = '23505';
--   END IF;
--
--   -- Ya hay un borrador abierto: se retoma el mismo
--   SELECT r.* INTO v_abierta
--   FROM public.renovaciones r
--   WHERE r.poliza_origen_id = p_poliza_id AND r.estado = 'en_proceso';
--
--   IF FOUND THEN
--     RETURN jsonb_build_object(
--       'continuar',  true,
--       'cliente_id', v_abierta.cliente_destino_id,
--       'poliza_id',  v_abierta.poliza_destino_id,
--       'numero_poliza', (SELECT numero_poliza FROM public.polizas WHERE id::text = v_abierta.poliza_destino_id),
--       'fecha_efectividad', v_abierta.fecha_efectividad);
--   END IF;
--
--   SELECT to_jsonb(c.*) INTO v_cliente
--   FROM public.clientes c
--   WHERE c.id::text = v_poliza ->> 'cliente_id'
--   FOR UPDATE;
--
--   IF v_cliente IS NULL THEN
--     RAISE EXCEPTION 'La póliza no tiene un cliente válido' USING ERRCODE = 'P0002';
--   END IF;
--
--   v_cliente_nuevo := public._copiar_fila(
--     'clientes', v_cliente, excluir_cliente,
--     jsonb_build_object(
--       'tipo_registro',     'Renovacion',
--       'tipo_modificacion', NULL,
--       'fecha_registro',    to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD'),
--       'archivado',         false));
--
--   v_poliza_nueva := public._copiar_fila(
--     'polizas', v_poliza, excluir_poliza,
--     jsonb_build_object(
--       'cliente_id',              v_cliente_nuevo -> 'id',
--       'numero_poliza',           public._siguiente_numero_poliza(v_anio),
--       'fecha_efectividad',       v_inicio,
--       'fecha_inicial_cobertura', v_inicio,
--       'fecha_final_cobertura',   v_fin,
--       'estado_compania',         'pendiente',
--       'estado_mercado',          'pendiente',
--       'estado_renovacion',       'Borrador',
--       'poliza_origen_id',        v_poliza ->> 'id'));
--
--   IF to_regclass('public.dependientes') IS NOT NULL THEN
--     FOR v_fila IN EXECUTE
--       'SELECT to_jsonb(d.*) AS j FROM public.dependientes d WHERE d.cliente_id::text = $1'
--       USING v_cliente ->> 'id'
--     LOOP
--       PERFORM public._copiar_fila('dependientes', v_fila.j, ARRAY['id', 'created_at', 'updated_at'],
--         jsonb_build_object('cliente_id', v_cliente_nuevo -> 'id', 'poliza_id', v_poliza_nueva -> 'id'));
--       v_dependientes := v_dependientes + 1;
--     END LOOP;
--   END IF;
--
--   IF to_regclass('public.metodos_pago') IS NOT NULL THEN
--     SELECT coalesce(jsonb_object_agg(column_name, 'No'), '{}'::jsonb) INTO v_cambios_pago
--     FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'metodos_pago' AND column_name LIKE 'pago\_%';
--     v_cambios_pago := v_cambios_pago || jsonb_build_object('fecha_pago', NULL, 'estado_pago', NULL);
--
--     FOR v_fila IN EXECUTE
--       'SELECT to_jsonb(m.*) AS j FROM public.metodos_pago m
--         WHERE m.cliente_id::text = $1 AND coalesce((to_jsonb(m.*) ->> ''activo'')::boolean, true)'
--       USING v_cliente ->> 'id'
--     LOOP
--       PERFORM public._copiar_fila('metodos_pago', v_fila.j, ARRAY['id', 'created_at', 'updated_at'],
--         v_cambios_pago || jsonb_build_object('cliente_id', v_cliente_nuevo -> 'id', 'poliza_id', v_poliza_nueva -> 'id'));
--       v_metodos := v_metodos + 1;
--     END LOOP;
--   END IF;
--
--   INSERT INTO public.renovaciones
--     (poliza_origen_id, cliente_origen_id, poliza_destino_id, cliente_destino_id,
--      operador_id, operador_nombre, fecha_efectividad, estado, iniciada_en)
--   VALUES
--     (v_poliza ->> 'id', v_cliente ->> 'id', v_poliza_nueva ->> 'id', v_cliente_nuevo ->> 'id',
--      v_uid, v_operador, v_inicio, 'en_proceso', now());
--
--   -- Origen "En proceso" (guarda el enlace al borrador para "Continuar renovación")
--   UPDATE public.polizas
--   SET estado_renovacion   = 'En proceso',
--       poliza_renovada_id  = v_poliza_nueva ->> 'id',
--       cliente_renovado_id = v_cliente_nuevo ->> 'id'
--   WHERE id::text = p_poliza_id;
--
--   PERFORM public._insertar_evento(
--     'poliza.renovacion_iniciar', 'polizas', v_poliza ->> 'id', v_cliente ->> 'id', v_poliza ->> 'id',
--     NULL, 'rpc',
--     jsonb_build_object(
--       'poliza_nueva',  v_poliza_nueva ->> 'id',
--       'cliente_nuevo', v_cliente_nuevo ->> 'id',
--       'numero_poliza', v_poliza_nueva ->> 'numero_poliza',
--       'dependientes',  v_dependientes,
--       'metodos_pago',  v_metodos));
--
--   RETURN jsonb_build_object(
--     'continuar',         false,
--     'cliente_id',        v_cliente_nuevo ->> 'id',
--     'poliza_id',         v_poliza_nueva ->> 'id',
--     'numero_poliza',     v_poliza_nueva ->> 'numero_poliza',
--     'fecha_efectividad', v_inicio,
--     'dependientes',      v_dependientes,
--     'metodos_pago',      v_metodos);
-- END;
-- $function$;
