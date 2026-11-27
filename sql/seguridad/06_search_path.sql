-- ============================================================================
-- 06_search_path.sql
-- QUÉ HACE: fija search_path = public, pg_temp en las funciones del esquema
--   public (no de extensiones) cuya proconfig no define search_path. Evita el
--   secuestro de funciones/tablas por un esquema temporal o un search_path
--   mutable. La lista se genera desde pg_proc dentro del bloque DO.
-- RIESGO: bajo-medio. Si alguna función usa objetos de otro esquema SIN
--   calificarlo (p. ej. unaccent, pg_trgm, pgcrypto/gen_random_bytes en el
--   esquema "extensions", o tablas de "auth"/"storage" sin prefijo), dejará de
--   encontrarlos. Revisar con la consulta de ANTES.
-- ANTES (lista y detección de posibles dependencias a extensions):
--   SELECT p.oid::regprocedure AS firma,
--          p.prosrc ~* '(unaccent|similarity|gen_random_bytes|crypt\(|digest\(|uuid_generate)' AS usa_extensions
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname='public' AND p.prokind IN ('f','p')
--     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')
--     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%')
--   ORDER BY 2 DESC, 1;
--   Para las que usen_extensions = true, añadir "extensions" a mano:
--   ALTER FUNCTION <firma> SET search_path = public, extensions, pg_temp;
--   y pon su nombre en v_excepciones abajo para que este script no las toque.
-- DESPUÉS: la consulta de ANTES debe devolver 0 filas; probar la app.
-- REVERSIÓN (comentada, por función):
--   -- ALTER FUNCTION <firma> RESET search_path;
-- ============================================================================
BEGIN;

DO $do$
DECLARE
  v_excepciones text[] := ARRAY[]::text[];  -- nombres de función a omitir
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
                      WHERE c LIKE 'search_path=%')
  LOOP
    IF r.proname = ANY (v_excepciones) THEN
      RAISE NOTICE 'OMITIDA: %', r.oid::regprocedure;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.oid::regprocedure);
    RAISE NOTICE 'search_path fijado: %', r.oid::regprocedure;
  END LOOP;
END
$do$;

COMMIT;
