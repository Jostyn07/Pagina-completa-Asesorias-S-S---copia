async function cargarOperadoresPorPortal(portal, selectIds = ["operadorNombre"]) {
    let query = supabaseClient 
        .from("usuarios")
        .select('id, nombre, portales')
        .eq("activo", true)
        .in("rol", ["operador", "supervisor", "admin", "admin_general"])
        .order("nombre");

    if (portal) {
        query = query.contains("portales", [portal]);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Error cargando operadores:", error);
        return;
    }

    selectIds.forEach((id) => {
        const select = document.getElementById(id)
        if (!select) return;

        const valorActual = select.value;
        select.innerHTML = 
            '<option value="">Selecciona...</option>' +
            (data || []).map((u) => `<option value="${u.nombre}">${u.nombre}</option>`).join("");

        // Si el operador que ya estaba elegido sigue en la nueva lista filtrada, se mantiene
        if ((data || []).some((u) => u.nombre === valorActual)) {
            select.value = valorActual;
        }
    });
}