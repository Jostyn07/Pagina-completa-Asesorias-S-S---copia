(function () {
    'use strict';

    function cargarAuditoria() {
        if (window.__auditoriaCargada || window.registrarEventoAuditoria) return;

        const actual = document.currentScript;
        const src = actual?.src || '';
        const auditoriaSrc = src.replace(/cargar_auditoria_global\.js([?#].*)?$/, 'auditoria.js');

        if (!auditoriaSrc || document.querySelector('script[data-auditoria-global]')) return;

        const script = document.createElement('script');
        script.src = auditoriaSrc;
        script.async = false;
        script.dataset.auditoriaGlobal = 'true';
        script.onload = () => { window.__auditoriaCargada = true; };
        document.head.appendChild(script);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cargarAuditoria, { once: true });
    } else {
        cargarAuditoria();
    }
})();