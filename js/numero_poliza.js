// ============================================================================
// Ruta en el repo: js/numero_poliza.js
// Reemplaza generarNumeroPoliza() de cliente_crear.js y cliente_editar.js.
// El número lo calcula la base de datos (sql/siguiente_numero_poliza.sql) mirando
// todas las pólizas y como número, así no se repite aunque el usuario solo vea su cartera.
// Se carga DESPUÉS de cliente_crear.js / cliente_editar.js.
// ============================================================================

window.generarNumeroPoliza = async function generarNumeroPoliza() {
  const anio = new Date().getFullYear();
  const { data, error } = await supabaseClient.rpc('siguiente_numero_poliza', { p_anio: anio });
  if (error || !data) {
    // Sin número no se crea la póliza: es mejor detener que repetir un número
    console.error('[número de póliza]', error?.message);
    throw new Error('No se pudo generar el número de póliza. Intenta de nuevo.');
  }
  return data;
};