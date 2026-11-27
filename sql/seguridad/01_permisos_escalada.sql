-- ============================================================================
-- 01_permisos_escalada.sql
-- QUÉ HACE: aplicar_permiso_rol(...) y guardar_permiso_usuario(...) autorizaban
--   con p_actualizado_por, un valor enviado por el cliente (suplantable ->
--   escalada de privilegios). Este script reescribe ambas para usar auth.uid()
--   en la verificación (puede_editar_rol / puede_editar_a) y como
--   actualizado_por. El parámetro se conserva en la firma (el frontend no cambia)
--   pero se IGNORA. Además: SET search_path = public, pg_temp y permisos de
--   ejecución solo para authenticated.
--
-- CÓMO LO HACE: no tuve acceso de lectura a la BD, así que NO reproduzco el
--   cuerpo a mano (riesgo de romper lógica). Un bloque DO lee la definición
--   ACTUAL con pg_get_functiondef, sustituye dentro del CUERPO cada uso de
--   p_actualizado_por por auth.uid() (con cast si el parámetro es text) y
--   ejecuta el CREATE OR REPLACE resultante. Aborta (y revierte todo) si:
--   no encuentra el cuerpo, no cambió nada o el cuerpo ASIGNA a p_actualizado_por.
--
-- RIESGO: medio. Si el cuerpo usa p_actualizado_por de forma inusual, aborta.
--   Si auth.uid() es NULL (sin sesión) la verificación fallará: es lo deseado.
--
-- ANTES (verificar):
--   SELECT p.oid::regprocedure, pg_get_functiondef(p.oid), p.proconfig,
--          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('aplicar_permiso_rol','guardar_permiso_usuario');
-- DESPUÉS: repetir la consulta: el cuerpo debe contener auth.uid(), proconfig
--   debe tener search_path=public, pg_temp y anon_exec = false.
--   Prueba funcional: ver README.md (permisos).
--
-- REVERSIÓN: guarda ANTES la salida de pg_get_functiondef de la consulta de
--   arriba y vuelve a ejecutarla (es un CREATE OR REPLACE completo). Permisos:
--   GRANT EXECUTE ON FUNCTION <firma> TO anon, PUBLIC;  (no recomendado)
-- ============================================================================
BEGIN;

DO $do$
DECLARE
  r        record;
  v_def    text;
  v_pos    int;
  v_head   text;
  v_body   text;
  v_new    text;
  v_tipo   text;
  v_expr   text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, p.proargnames, p.proargtypes
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('aplicar_permiso_rol', 'guardar_permiso_usuario')
  LOOP
    -- Tipo del parámetro p_actualizado_por (uuid normalmente; text si se guardó como texto)
    SELECT format_type(t.typ, NULL) INTO v_tipo
    FROM unnest(r.proargtypes::oid[]) WITH ORDINALITY AS t(typ, ord)
    WHERE r.proargnames[t.ord] = 'p_actualizado_por';

    IF v_tipo IS NULL THEN
      RAISE EXCEPTION '% no tiene parámetro p_actualizado_por; revisar a mano', r.proname;
    END IF;
    v_expr := CASE WHEN v_tipo = 'uuid' THEN 'auth.uid()' ELSE 'auth.uid()::' || v_tipo END;

    v_def := pg_get_functiondef(r.oid);
    v_pos := strpos(v_def, E'AS $function$');
    IF v_pos = 0 THEN
      RAISE EXCEPTION 'No se encontró el cuerpo ($function$) de %; reescribir a mano', r.proname;
    END IF;
    v_head := substr(v_def, 1, v_pos - 1);   -- cabecera con la firma (se conserva)
    v_body := substr(v_def, v_pos);

    IF v_body ~* 'p_actualizado_por\s*:=' THEN
      RAISE EXCEPTION '% asigna a p_actualizado_por; reescribir a mano', r.proname;
    END IF;

    v_new := regexp_replace(v_body, '\mp_actualizado_por\M', v_expr, 'g');
    IF v_new = v_body THEN
      RAISE EXCEPTION '% no usa p_actualizado_por en el cuerpo; nada que cambiar (¿ya aplicado?)', r.proname;
    END IF;

    EXECUTE v_head || v_new;

    -- search_path fijo y permisos
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.oid::regprocedure);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', r.oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.oid::regprocedure);
    RAISE NOTICE 'Reescrita: %', r.oid::regprocedure;
  END LOOP;
END
$do$;

COMMIT;
