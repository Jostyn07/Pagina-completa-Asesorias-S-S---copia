-- ============================================================================
-- 05_politicas_anon_abiertas.sql
-- QUÉ HACE: políticas abiertas al rol public (incluye anon) pasan a
--   TO authenticated, SIN cambiar su USING/WITH CHECK (ALTER POLICY ... TO):
--     historial_estados          SELECT e INSERT
--     movimientos_observaciones  SELECT
--     polizas_pendientes         INSERT
--   Se localizan por tabla+comando desde pg_policies (no hace falta saber el
--   nombre) y solo se tocan las que incluyen public o anon. Idempotente.
-- RIESGO: bajo-medio. Si algún flujo escribe estas tablas sin sesión (p. ej.
--   un formulario público que crea polizas_pendientes) dejará de funcionar.
-- ANTES:   SELECT tablename, policyname, cmd, roles, qual, with_check
--          FROM pg_policies WHERE schemaname='public'
--          AND tablename IN ('historial_estados','movimientos_observaciones','polizas_pendientes');
-- DESPUÉS: la misma consulta: roles = {authenticated} en esas políticas.
-- REVERSIÓN (comentada; sustituir nombres reales según la consulta ANTES):
--   -- ALTER POLICY "<nombre>" ON public.<tabla> TO public;
-- ============================================================================
BEGIN;

DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (roles && ARRAY['public', 'anon']::name[])
      AND (   (tablename = 'historial_estados'         AND cmd IN ('SELECT', 'INSERT'))
           OR (tablename = 'movimientos_observaciones' AND cmd = 'SELECT')
           OR (tablename = 'polizas_pendientes'        AND cmd = 'INSERT'))
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated',
                   r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'Restringida a authenticated: %.% (% / %)',
                 r.schemaname, r.tablename, r.policyname, r.cmd;
  END LOOP;
END
$do$;

COMMIT;
