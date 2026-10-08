(function () {
    'use strict';

    function escapeHtml(v) {
        return String(v ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    async function cargarRankingRenovaciones() {
        const card = document.getElementById('renovacionesRankingCard');
        const tbody = document.getElementById('tbodyRankingRenovaciones');
        const select = document.getElementById('selectAnioRenovaciones');
        if (!card || !tbody || !select) return;

        try {
            const permitido =
                typeof esAdminGenearl === 'function' && esAdminGenearl()
                || typeof tienePermiso === 'function' && tienePermiso('ver_ranking_renovaciones');

            if (!permitido) {
                card.style.display = 'none';
                return;
            }

            const anio = Number(select.value);
            const { data, error } = await supabaseClient.rpc('obtener_ranking_renovaciones', {
                p_anio: anio
            });

            if (error) throw error;

            const filas = data || [];

            tbody.innerHTML = filas.length
                ? filas.map(row => `
                    <tr>
                        <td style="font-weight:800;">#${escapeHtml(row.posicion)}</td>
                        <td>${escapeHtml(row.operador_nombre || 'Sin usuario')}</td>
                        <td style="font-weight:800;">${escapeHtml(row.total_renovaciones)}</td>
                    </tr>
                `).join('')
                : '<tr><td colspan="3" style="padding:24px;text-align:center;color:#94a3b8;">No hay renovaciones registradas para este año.</td></tr>';

            const total = filas.reduce((sum, row) => sum + Number(row.total_renovaciones || 0), 0);
            const totalEl = document.getElementById('totalRenovacionesAnio');
            if (totalEl) totalEl.textContent = total;

            card.style.display = '';
        } catch (error) {
            console.error('Error cargando ranking de renovaciones:', error);
            tbody.innerHTML = '<tr><td colspan="3" style="padding:24px;text-align:center;color:#ef4444;">No se pudo cargar el ranking.</td></tr>';
        }
    }

    window.cargarRankingRenovaciones = cargarRankingRenovaciones;

    document.addEventListener('DOMContentLoaded', () => {
        const select = document.getElementById('selectAnioRenovaciones');
        if (!select) return;

        const anioActual = new Date().getFullYear();
        select.value = String(anioActual);

        cargarRankingRenovaciones();

        select.addEventListener('change', cargarRankingRenovaciones);
    });
})();