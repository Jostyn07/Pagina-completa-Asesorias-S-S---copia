-- ============================================================================
-- 04_revocar_anon_funciones.sql
-- QUÉ HACE: para TODAS las funciones SECURITY DEFINER del esquema public (que
--   no pertenezcan a una extensión) ejecutables por anon:
--     * normales:  REVOKE EXECUTE ... FROM anon, PUBLIC;  GRANT ... TO authenticated;
--     * triggers (devuelven trigger o se llaman trg_*): REVOKE de anon, PUBLIC y
--       authenticated (los triggers no necesitan EXECUTE de los clientes).
--   Se calcula con la firma exacta (oid::regprocedure). Idempotente.
--
-- EXCEPCIONES: el array v_excepciones del bloque DO (vacío por defecto) lista
--   nombres de función que se SALTAN porque podrían usarse antes del login
--   (p. ej. validar un código de invitación, comprobar si existe un correo,
--   formularios públicos, "olvidé mi contraseña"). REVISA la consulta del
--   PASO 1 y añade ahí los nombres necesarios, o quedarán sin acceso para anon.
--
-- REVISIÓN DE USO SIN SESIÓN: js/main.js (login) no llama a ninguna RPC antes de
--   iniciar sesión. Se revisaron todos los .rpc( de js/: pages/login.html solo
--   carga main.js, auth_cache.js y menu_trazabilidad.js (esta última pide
--   tiene_permiso solo si existe el menú lateral, que el login no tiene; y si lo
--   llamara sin sesión simplemente no mostraría el menú). auditoria.js comprueba
--   la sesión antes de llamar a registrar_evento. Conclusión: ninguna RPC
--   requiere anon, por eso v_excepciones queda vacío.
--
-- RIESGO: MEDIO. Cualquier RPC llamada sin sesión dejará de funcionar. Las
--   funciones usadas dentro de políticas RLS siguen funcionando para
--   authenticated (reciben GRANT).
--
-- PASO 1 (solo lectura, ejecutar primero y revisar; es la lista de afectadas):
--   SELECT p.oid::regprocedure AS firma, p.prorettype::regtype AS retorna,
--          (p.prorettype = 'trigger'::regtype OR p.proname LIKE 'trg\_%') AS es_trigger
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind IN ('f','p')
--     AND has_function_privilege('anon', p.oid, 'EXECUTE')
--     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
--   ORDER BY 3 DESC, 1;
--   Para ver dónde se usan antes del login, buscar en js/ los .rpc('nombre') de
--   páginas como login/registro.
--
-- VERIFICACIÓN DESPUÉS (debe devolver 0 filas, salvo las excepciones):
--   SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.prosecdef
--     AND has_function_privilege('anon', p.oid, 'EXECUTE')
--     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e');
--
-- REVERSIÓN: por cada función afectada (salida del PASO 1 guardada antes):
--   -- GRANT EXECUTE ON FUNCTION <firma> TO anon, PUBLIC;
--   o, para volver a un estado abierto en bloque, repetir el bloque DO cambiando
--   REVOKE por GRANT y FROM por TO.
-- ============================================================================
BEGIN;

DO $do$
DECLARE
  -- Nombres (sin esquema ni argumentos) que se dejan INTACTOS para revisión manual.
  -- Ejemplo: ARRAY['validar_invitacion','existe_correo']
  v_excepciones text[] := ARRAY[]::text[];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           (p.prorettype = 'trigger'::regtype OR p.proname LIKE 'trg\_%') AS es_trigger
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind IN ('f', 'p')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    IF r.proname = ANY (v_excepciones) THEN
      RAISE NOTICE 'OMITIDA (excepción): %', r.oid::regprocedure;
      CONTINUE;
    END IF;

    IF r.es_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.oid::regprocedure);
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', r.oid::regprocedure);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.oid::regprocedure);
    END IF;
    RAISE NOTICE 'Revocada de anon%: %', CASE WHEN r.es_trigger THEN ' y authenticated (trigger)' ELSE '' END, r.oid::regprocedure;
  END LOOP;
END
$do$;

COMMIT;
