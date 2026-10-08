/* Auditoría central de actividad */
(function () {
    'use strict';
    const DEBOUNCE = 350;
    const lastEvents = new Map();
    const SENSITIVE = new Set(['password','token','refresh_token','access_token','cvv','numero_tarjeta','numero_cuenta','routing_number','ssn']);

    function ruta() { return window.location.pathname || ''; }
    function texto(v, max=100) { return String(v || '').replace(/\s+/g,' ').trim().slice(0,max); }

    function sanitizar(v, depth=0) {
        if (depth > 4) return '[truncado]';
        if (v === null || v === undefined) return v;
        if (Array.isArray(v)) return v.slice(0,30).map(x => sanitizar(x, depth+1));
        if (typeof v === 'object') {
            const out = {};
            Object.entries(v).slice(0,80).forEach(([k,val]) => {
                if (SENSITIVE.has(String(k).toLowerCase())) return;
                out[k] = sanitizar(val, depth+1);
            });
            return out;
        }
        if (typeof v === 'string') return texto(v,300);
        return v;
    }

    function repetido(key) {
        const now = Date.now();
        const prev = lastEvents.get(key) || 0;
        if (now - prev < DEBOUNCE) return true;
        lastEvents.set(key, now);
        return false;
    }

    function descripcion(el) {
        if (!el) return {};
        return {
            tag: el.tagName?.toLowerCase() || '',
            id: el.id || '',
            name: el.getAttribute?.('name') || '',
            audit_action: el.getAttribute?.('data-audit-action') || '',
            text: texto(el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.innerText || el.value || '')
        };
    }

    async function registrarEventoAuditoria({accion,recurso=null,recursoId=null,clienteId=null,polizaId=null,ruta: rutaEvento=ruta(),metodo='UI',detalle={}}) {
        try {
            if (!window.supabaseClient || !accion) return null;
            const {data,error} = await supabaseClient.rpc('registrar_evento_auditoria',{
                p_accion:String(accion).slice(0,120),
                p_recurso:recurso ? String(recurso).slice(0,120) : null,
                p_recurso_id:recursoId ? String(recursoId).slice(0,120) : null,
                p_cliente_id:clienteId || null,
                p_poliza_id:polizaId || null,
                p_ruta:rutaEvento ? String(rutaEvento).slice(0,300) : null,
                p_metodo:metodo ? String(metodo).slice(0,50) : null,
                p_detalle:sanitizar(detalle)
            });
            if (error) { console.warn('Auditoría no registrada:', error.message); return null; }
            return data;
        } catch (e) {
            console.warn('Error registrando auditoría:', e);
            return null;
        }
    }

    window.registrarEventoAuditoria = registrarEventoAuditoria;

    async function auditarVistaPagina() {
        if (repetido('page.view:'+ruta())) return;
        await registrarEventoAuditoria({
            accion:'page.view', recurso:'pagina', recursoId:ruta(), ruta:ruta(), metodo:'NAV',
            detalle:{href:window.location.href.split('?')[0], referrer:document.referrer ? document.referrer.split('?')[0] : null}
        });
    }

    function auditClick(e) {
        const el = e.target?.closest?.('button,a,[role="button"],input[type="checkbox"],input[type="radio"]');
        if (!el) return;
        const d=descripcion(el);
        const action=d.audit_action || 'ui.click';
        if (repetido(action+':'+d.id+':'+d.text)) return;
        registrarEventoAuditoria({accion:action,recurso:ruta(),ruta:ruta(),metodo:'CLICK',detalle:{elemento:d}});
    }

    function auditChange(e) {
        const el=e.target;
        if (!el) return;
        const isFilter=el.id?.toLowerCase().includes('filtro') || el.name?.toLowerCase().includes('filtro') || el.closest?.('.filtro-group,.analisis-tab-filtros,.contents__visualizacion');
        const isToggle=el.matches?.('input[type="checkbox"],input[type="radio"],select');
        if (!isFilter && !isToggle) return;
        if (el.type==='text' || el.type==='search') return;
        const d=descripcion(el);
        if (repetido('change:'+d.id+':'+el.value)) return;
        registrarEventoAuditoria({
            accion:isFilter?'ui.filter.change':'ui.control.change',
            recurso:ruta(),ruta:ruta(),metodo:'CHANGE',
            detalle:{elemento:d,seleccionado:(el.type==='checkbox'||el.type==='radio') ? !!el.checked : texto(el.value,120)}
        });
    }

    function auditSubmit(e) {
        const form=e.target;
        if (!form) return;
        registrarEventoAuditoria({
            accion:'ui.form.submit', recurso:'form', recursoId:form.id || form.getAttribute('name') || null,
            ruta:ruta(), metodo:'SUBMIT', detalle:{id:form.id || null, name:form.getAttribute('name') || null}
        });
    }

    function auditTabs(e) {
        const el=e.target?.closest?.('.tab-btn,.subtab-btn,.analisis-nav-tab,.analisis-filtro-btn');
        if (!el) return;
        const key=el.getAttribute('data-tab') || el.getAttribute('data-subtab') || el.getAttribute('data-vista') || texto(el.innerText,60);
        if (repetido('tab:'+key)) return;
        registrarEventoAuditoria({accion:'ui.tab.change',recurso:'navegacion',ruta:ruta(),metodo:'TAB',detalle:{tab:key,elemento:descripcion(el)}});
    }

    window.auditarClienteAbierto = async function({cliente,poliza=null,accion='cliente.view'}={}) {
        if (!cliente?.id) return;
        const key=actionKey(accion,cliente.id,poliza?.id);
        if (repetido(key)) return;
        await registrarEventoAuditoria({
            accion,recurso:'cliente',recursoId:cliente.id,clienteId:cliente.id,polizaId:poliza?.id || null,
            ruta:ruta(),metodo:'VIEW',
            detalle:{cliente_nombre:(cliente.nombres+' '+(cliente.apellidos||'')).trim(),numero_poliza:poliza?.numero_poliza || null,portal:cliente.portal || null}
        });
    };

    function actionKey(a,c,p){ return a+':'+c+':'+(p||''); }

    function init() {
        if (!window.supabaseClient) return;
        document.addEventListener('click',auditClick,true);
        document.addEventListener('click',auditTabs,true);
        document.addEventListener('change',auditChange,true);
        document.addEventListener('submit',auditSubmit,true);
        setTimeout(auditarVistaPagina,150);
    }

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
    else init();
})();