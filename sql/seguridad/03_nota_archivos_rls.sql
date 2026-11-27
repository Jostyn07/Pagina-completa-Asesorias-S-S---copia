-- ============================================================================
-- 03_nota_archivos_rls.sql
-- QUÉ HACE: activa Row Level Security en public.nota_archivos. Hoy tiene la
--   política "Ver archivos" pero RLS está desactivado, por lo que la política
--   no se aplica y la tabla es accesible con la clave anon.
-- ESTADO LEÍDO: la única política es "Ver archivos": SELECT, TO authenticated,
--   USING true. No hay políticas INSERT/UPDATE/DELETE.
-- USO EN LA APP: se buscó "nota_archivos" en todo js/ y pages/ y NO hay ningún
--   acceso desde el frontend (ni select, insert ni delete). Por tanto no hace
--   falta crear políticas de escritura: al activar RLS la escritura queda
--   bloqueada para clientes (anon/authenticated) y solo la podrían hacer
--   funciones SECURITY DEFINER o service_role (que saltan RLS). Si más adelante
--   la app sube/borra adjuntos, crear entonces políticas INSERT/DELETE
--   TO authenticated (idealmente limitadas al creador si hay columna de autor).
-- RIESGO: bajo (sin uso desde el frontend). Si alguna función/trigger no
--   SECURITY DEFINER escribe en la tabla, fallaría: comprobarlo con
--   SELECT proname FROM pg_proc WHERE prosrc ILIKE '%nota_archivos%';
-- ANTES (ejecutar y revisar roles y comandos de las políticas):
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public.nota_archivos'::regclass;
--   SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
--   WHERE schemaname='public' AND tablename='nota_archivos';
--   -> "Ver archivos" ya es TO authenticated: no hay que cambiarla.
-- DESPUÉS: relrowsecurity = true; probar que las notas se siguen viendo.
-- REVERSIÓN (comentada):
--   -- ALTER TABLE public.nota_archivos DISABLE ROW LEVEL SECURITY;
-- ============================================================================
BEGIN;

ALTER TABLE public.nota_archivos ENABLE ROW LEVEL SECURITY;

COMMIT;
