# Scripts de seguridad (Supabase)

Se ejecutan a mano en el SQL Editor de Supabase, uno por uno, tras leer la
cabecera de cada archivo. Todos usan transacción e son idempotentes y traen su
bloque de reversión comentado. Haz una copia/backup antes de empezar.

## Orden recomendado y qué probar tras cada uno

| # | Script | Probar en la app |
|---|--------|------------------|
| 1 | `01_permisos_escalada.sql` | Login; como admin, cambiar un permiso de rol y de usuario (debe guardar). Como usuario sin permiso de edición, debe fallar. |
| 2 | `02_usuarios_lectura.sql` | Login y pantallas que muestran nombres de otros usuarios (asignaciones, historial). |
| 3 | `03_nota_archivos_rls.sql` | Notas: ver, subir y borrar adjuntos. La app no usa esta tabla desde el frontend. |
| 4 | `04_revocar_anon_funciones.sql` | Login, registro/recuperación de contraseña (RPC previas al login), navegación general. Ninguna RPC se usa sin sesión (`v_excepciones` vacío); ver PASO 1 de la cabecera. |
| 5 | `05_politicas_anon_abiertas.sql` | Historial de estados, observaciones de movimientos, creación de pólizas pendientes. |
| 6 | `06_search_path.sql` | Recorrido general; revisar funciones que usen extensiones (ver cabecera). |
| 7 | `07_vista_security_invoker.sql` | Pantalla que usa `v_propietario_sin_cruce`. |
| 8 | `08_renovar_poliza_fecha.sql` | Renovación: antes del 20 oct del año de efectividad debe dar error; después renueva; "Continuar renovación" sigue funcionando. |

Sugerencia: 1, 2, 5, 7 y 3 son de bajo riesgo; 4 y 6 afectan a muchas funciones,
ejecútalos en un momento de poco uso y con la app abierta en otra pestaña para
probar enseguida.

## Fuera de alcance

El bucket `documentos` de Storage es público y NO se cambia aquí: hacerlo privado
exige cambiar el frontend para usar URLs firmadas (`createSignedUrl`), de lo
contrario se romperían los enlaces a documentos existentes. Queda como tarea
aparte.
