-- ============================================================================
-- 02_usuarios_lectura.sql
-- QUÉ HACE: la política "Usuarios pueden ver nombres de otros usuarios" en
--   public.usuarios es SELECT para el rol public (incluye anon) con USING true:
--   cualquiera sin sesión podía listar usuarios. Se restringe a TO authenticated.
--   ALTER POLICY ... TO conserva USING y demás; es idempotente.
-- NOTA: USING (true) se mantiene para no romper la app. Idealmente, exponer
--   solo id/nombre mediante una vista (security_invoker) y quitar esta política
--   abierta, porque authenticated sigue viendo TODAS las columnas (email, rol...).
-- RIESGO: bajo. Solo afecta a peticiones sin sesión (anon).
-- ANTES:   SELECT policyname, roles, cmd, qual FROM pg_policies
--          WHERE schemaname='public' AND tablename='usuarios';
-- DESPUÉS: la política debe mostrar roles = {authenticated}.
-- REVERSIÓN (comentada):
--   -- ALTER POLICY "Usuarios pueden ver nombres de otros usuarios" ON public.usuarios TO public;
-- ============================================================================
BEGIN;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'usuarios'
               AND policyname = 'Usuarios pueden ver nombres de otros usuarios') THEN
    ALTER POLICY "Usuarios pueden ver nombres de otros usuarios"
      ON public.usuarios TO authenticated;
  ELSE
    RAISE NOTICE 'La política no existe (¿otro nombre?). Revisar pg_policies.';
  END IF;
END
$do$;

COMMIT;
