-- ============================================================================
-- 07_vista_security_invoker.sql
-- QUÉ HACE: la vista public.v_propietario_sin_cruce se ejecuta con los permisos
--   de su dueño (salta RLS). Con security_invoker = true respeta las políticas
--   RLS de quien consulta. Requiere PostgreSQL 15+ (Supabase lo cumple).
-- RIESGO: bajo-medio. Los usuarios que no tengan acceso por RLS a las tablas
--   base verán menos filas (o ninguna) en esa vista.
-- ANTES:   SELECT reloptions FROM pg_class WHERE oid='public.v_propietario_sin_cruce'::regclass;
-- DESPUÉS: reloptions = {security_invoker=true}; abrir la pantalla que usa la vista.
-- REVERSIÓN (comentada):
--   -- ALTER VIEW public.v_propietario_sin_cruce SET (security_invoker = false);
-- ============================================================================
BEGIN;

ALTER VIEW public.v_propietario_sin_cruce SET (security_invoker = true);

COMMIT;
