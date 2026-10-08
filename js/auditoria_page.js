(function () {
    'use strict';
    function escapeHtml(value) {
        return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
    }
    function formatDate(value) {
        if (!value) return '-';
        try { return new Date(value).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'medium'}); } catch { return value; }
    }
    async function verificarAccesoAuditoria() {
        try {
            await cargarRolUsuario();
            const permitido = typeof tienePermiso === 'function' && ((typeof esAdminGenearl === 'function' && esAdminGenearl()) || tienePermiso('ver_logs_auditoria'));
            if (!permitido) {
                document.getElementById('auditTbody').innerHTML = '<tr><td colspan="8" class="audit-empty">No tienes permiso para consultar la auditoría.</td></tr>';
                return false;
            }
            return true;
        } catch (e) { console.error(e); return false; }
    }
    async function cargarAuditoria() {
        const desde = document.getElementById('auditDesde')?.value || '';
        const hasta = document.getElementById('auditHasta')?.value || '';
        const accion = document.getElementById('auditAccion')?.value || '';
        const buscar = (document.getElementById('auditBuscar')?.value || '').trim().toLowerCase();
        let query = supabaseClient.from('auditoria_eventos').select('*').order('created_at',{ascending:false}).limit(500);
        if (desde) query = query.gte('created_at', `${desde}T00:00:00`);
        if (hasta) query = query.lt('created_at', `${hasta}T23:59:59.999`);
        if (accion) query = query.eq('accion', accion);
        const {data,error}=await query;
        if (error) {
            document.getElementById('auditTbody').innerHTML = '<tr><td colspan="8" class="audit-empty">'+escapeHtml(error.message)+'</td></tr>';
            return;
        }
        const filtrados=(data||[]).filter(item=>{
            if(!buscar) return true;
            const texto=[item.usuario_nombre,item.usuario_email,item.accion,item.recurso,item.cliente_nombre,item.poliza_numero,item.ruta,JSON.stringify(item.detalle||{})].join(' ').toLowerCase();
            return texto.includes(buscar);
        });
        const tbody=document.getElementById('auditTbody');
        if(!filtrados.length){ tbody.innerHTML='<tr><td colspan="8" class="audit-empty">No hay eventos para los filtros seleccionados.</td></tr>'; return; }
        tbody.innerHTML=filtrados.map(item=>{
            const detalle=escapeHtml(JSON.stringify(item.detalle||{},null,2));
            const cliente=item.cliente_id ? '<a href="./cliente_editar.html?id='+encodeURIComponent(item.cliente_id)+'">'+escapeHtml(item.cliente_nombre||item.cliente_id)+'</a>' : '-';
            return '<tr>'+
                '<td>'+escapeHtml(formatDate(item.created_at))+'</td>'+
                '<td><strong>'+escapeHtml(item.usuario_nombre||'-')+'</strong><br><small>'+escapeHtml(item.usuario_email||'')+'</small></td>'+
                '<td><span class="audit-badge">'+escapeHtml(item.accion)+'</span></td>'+
                '<td>'+escapeHtml(item.recurso||'-')+'<br><small>'+escapeHtml(item.metodo||'')+'</small></td>'+
                '<td>'+cliente+'</td>'+
                '<td>'+escapeHtml(item.poliza_numero||item.poliza_id||'-')+'</td>'+
                '<td>'+escapeHtml(item.ruta||'-')+'</td>'+
                '<td class="audit-detail">'+detalle+'</td>'+
            '</tr>';
        }).join('');
    }
    window.cargarAuditoria=cargarAuditoria;
    document.addEventListener('DOMContentLoaded',async()=>{
        const ok=await verificarAccesoAuditoria();
        if(!ok) return;
        const hoy=new Date();
        const haceUnAno=new Date();
        haceUnAno.setFullYear(hoy.getFullYear()-1);
        document.getElementById('auditDesde').value=haceUnAno.toISOString().slice(0,10);
        document.getElementById('auditHasta').value=hoy.toISOString().slice(0,10);
        await cargarAuditoria();
    });
})();