// ============================================================================
// Ruta en el repo: js/renovacion.js
// FASE 2 — Renovación en dos pasos en la ficha del cliente
// Se carga en pages/cliente_editar.html (después de cliente_editar.js).
//
// Requiere sql/fase2b_renovacion_borrador.sql.
//
// 1. Póliza original → botón "Renovar" (o "Continuar renovación" si ya hay un
//    borrador). Crea la copia como BORRADOR (RPC renovar_poliza) y la abre.
// 2. Ficha del borrador → arriba "Realizando renovación a: …", abajo el botón
//    "Renovar" (guarda el formulario y llama a finalizar_renovacion).
//    "Guardar Borrador" guarda en la base de datos sin cerrar la renovación.
// 3. Si no se pulsa "Renovar", la renovación NO cuenta; la original queda
//    "En proceso" y su botón dice "Continuar renovación".
// ============================================================================

(function () {
  let polizaActual = null;
  let renovando = false;

  function sb() {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient; } catch (e) {}
    return null;
  }

  function idPolizaCargada() {
    try { return typeof polizaId !== 'undefined' ? polizaId : null; } catch (e) { return null; }
  }

  function anioRenovacion() {
    return new Date().getFullYear() + 1;
  }

  function aviso(mensaje, tipo) {
    if (typeof mostrarNotificacion === 'function') return mostrarNotificacion(mensaje, tipo);
    alert(mensaje);
  }

  // ---------- Estilos (una sola vez)
  function estilos() {
    if (document.getElementById('estilosRenovacion')) return;
    const css = document.createElement('style');
    css.id = 'estilosRenovacion';
    css.textContent = `
      .btn-renovar{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:8px;
        background:#7c3aed;color:#fff;font-weight:600;font-size:.9rem;cursor:pointer;transition:background .2s,opacity .2s}
      .btn-renovar:hover:not(:disabled){background:#6d28d9}
      .btn-renovar:disabled{opacity:.6;cursor:not-allowed}
      .btn-renovar .material-symbols-rounded{font-size:20px}
      .aviso-renovacion{display:flex;align-items:center;gap:10px;margin:12px 0 0;padding:10px 14px;border-radius:10px;font-size:.9rem}
      .aviso-renovacion.renovada{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
      .aviso-renovacion.es-renovacion{background:#ede9fe;color:#5b21b6;border:1px solid #ddd6fe}
      .aviso-renovacion.en-proceso{background:#fff7ed;color:#9b5c1c;border:1px solid #f5ddc1}
      [data-theme="dark"] .aviso-renovacion.en-proceso{background:#431407;color:#fed7aa;border-color:#9a3412}
      .aviso-renovacion a{color:inherit;font-weight:700;text-decoration:underline}
      .aviso-renovacion .material-symbols-rounded{font-size:20px}
      [data-theme="dark"] .aviso-renovacion.renovada{background:#14532d;color:#bbf7d0;border-color:#166534}
      [data-theme="dark"] .aviso-renovacion.es-renovacion{background:#3b0764;color:#ddd6fe;border-color:#5b21b6}
      /* Modal de confirmación (diseño Figma "Anuncio de renovación") */
      .modal-renovacion{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;
        background:rgba(38,51,77,.45);font-family:'Poppins',system-ui,sans-serif;animation:mrFade .15s ease}
      @keyframes mrFade{from{opacity:0}to{opacity:1}}
      @keyframes mrSube{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      .mr-caja{width:560px;max-width:100%;max-height:calc(100vh - 32px);overflow:auto;background:#fff;border:1px solid #e6ebf3;
        border-radius:14px;box-shadow:0 16px 48px rgba(38,51,77,.2);animation:mrSube .18s ease}
      .mr-encabezado{height:64px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e6ebf3}
      .mr-titulo{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:600;color:#25314b;margin:0}
      .mr-icono{width:32px;height:32px;border-radius:8px;background:#f1ebff;color:#7c3af5;display:flex;align-items:center;justify-content:center}
      .mr-icono .material-symbols-rounded{font-size:18px}
      .mr-cerrar{width:30px;height:30px;border:none;border-radius:6px;background:#f4f7fb;color:#25314b;cursor:pointer;
        display:flex;align-items:center;justify-content:center}
      .mr-cerrar:hover{background:#e6ebf3}
      .mr-cerrar .material-symbols-rounded{font-size:16px}
      .mr-cuerpo{padding:24px;display:flex;flex-direction:column;gap:16px}
      .mr-etiqueta{display:flex;align-items:center;gap:6px;color:#7c3af5;font-size:10px;font-weight:500;letter-spacing:.02em}
      .mr-etiqueta .material-symbols-rounded{font-size:15px}
      .mr-pregunta{margin:0;font-size:20px;font-weight:600;line-height:1.35;color:#25314b}
      .mr-datos{display:flex;gap:24px;padding:14px;border-radius:7px;background:#f4f7fb}
      .mr-datos>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
      .mr-datos small{font-size:10px;color:#8892a5}
      .mr-datos strong{font-size:13px;font-weight:600;color:#25314b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .mr-datos strong.morado{color:#7c3af5}
      .mr-advertencia{padding:16px;border-radius:9px;background:#fff7ed;border:1px solid #f5ddc1;display:flex;flex-direction:column;gap:10px}
      .mr-advertencia h4{margin:0;display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:#9b5c1c}
      .mr-advertencia h4 .material-symbols-rounded{font-size:17px}
      .mr-advertencia p{margin:0;font-size:11px;line-height:1.5;color:#25314b}
      .mr-advertencia p.final{font-weight:500;color:#9b5c1c}
      .mr-acciones{display:flex;align-items:center;gap:10px;padding:16px 24px 20px;border-top:1px solid #e6ebf3}
      .mr-nota{flex:1;min-width:0;font-size:10px;color:#8892a5}
      .mr-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:6px;font:inherit;font-size:13px;cursor:pointer;transition:background .15s,opacity .15s}
      .mr-btn.cancelar{background:#fff;border:1px solid #e6ebf3;color:#25314b;font-weight:500}
      .mr-btn.cancelar:hover{background:#f4f7fb}
      .mr-btn.confirmar{background:#7c3af5;border:1px solid #7c3af5;color:#fff;font-weight:600;box-shadow:0 4px 12px rgba(108,50,214,.22)}
      .mr-btn.confirmar:hover{background:#6d28d9}
      .mr-btn .material-symbols-rounded{font-size:16px}
      .mr-btn:focus-visible,.mr-cerrar:focus-visible{outline:2px solid #7c3af5;outline-offset:2px}
      @media (max-width:560px){.mr-datos{flex-direction:column;gap:10px}.mr-acciones{flex-wrap:wrap}.mr-nota{flex-basis:100%}}
    `;
    document.head.appendChild(css);
  }

  // ---------- Carga de la póliza y del permiso
  async function cargar(pid) {
    const cliente = sb();
    if (!cliente) return;

    const { data: poliza, error } = await cliente
      .from('polizas')
      .select('id, cliente_id, numero_poliza, estado_renovacion, poliza_renovada_id, cliente_renovado_id, poliza_origen_id')
      .eq('id', pid)
      .single();
    if (error || !poliza) {
      console.warn('[renovación] no se pudo leer la póliza:', error?.message);
      return;
    }
    polizaActual = poliza;

    await mostrarAvisos(poliza);

    if (poliza.estado_renovacion === 'Renovada') return; // ya renovada: sin botón
    if (poliza.estado_renovacion === 'Borrador') {        // ficha del borrador
      modoBorrador();
      return;
    }

    const { data: permitido, error: errPermiso } = await cliente.rpc('tiene_permiso', { p_clave: 'renovar_poliza' });
    if (errPermiso) {
      console.warn('[renovación] no se pudo validar el permiso:', errPermiso.message);
      return;
    }
    console.info('[renovación] póliza', poliza.numero_poliza, '| estado:', poliza.estado_renovacion, '| permiso renovar:', permitido);
    if (permitido) mostrarBoton(poliza.estado_renovacion === 'En proceso');
  }

  // ---------- Avisos de origen / destino
  async function mostrarAvisos(poliza) {
    const header = document.querySelector('.page-header');
    if (!header) return;
    document.querySelectorAll('.aviso-renovacion').forEach((e) => e.remove());

    if (poliza.estado_renovacion === 'Renovada' && poliza.cliente_renovado_id) {
      const div = document.createElement('div');
      div.className = 'aviso-renovacion renovada';
      div.innerHTML = `<span class="material-symbols-rounded">task_alt</span>
        <span>Esta póliza ya fue <strong>renovada</strong>.
        <a href="./cliente_editar.html?id=${encodeURIComponent(poliza.cliente_renovado_id)}">Ver la póliza nueva</a></span>`;
      header.insertAdjacentElement('afterend', div);
    }

    if (poliza.estado_renovacion === 'En proceso' && poliza.cliente_renovado_id) {
      const div = document.createElement('div');
      div.className = 'aviso-renovacion en-proceso';
      div.innerHTML = `<span class="material-symbols-rounded">pending</span>
        <span>Esta póliza tiene una <strong>renovación en proceso</strong> que aún no se ha terminado.
        <a href="./cliente_editar.html?id=${encodeURIComponent(poliza.cliente_renovado_id)}">Continuar renovación</a></span>`;
      header.insertAdjacentElement('afterend', div);
    }

    if (poliza.poliza_origen_id) {
      const { data: origen } = await sb()
        .from('polizas')
        .select('cliente_id, numero_poliza, fecha_efectividad')
        .eq('id', poliza.poliza_origen_id)
        .maybeSingle();
      const div = document.createElement('div');
      div.className = 'aviso-renovacion es-renovacion';
      const enlace = origen?.cliente_id
        ? `<a href="./cliente_editar.html?id=${encodeURIComponent(origen.cliente_id)}">Ver la póliza anterior${origen.numero_poliza ? ' (' + origen.numero_poliza + ')' : ''}</a>`
        : 'La póliza anterior no está disponible.';
      div.innerHTML = poliza.estado_renovacion === 'Borrador'
        ? `<span class="material-symbols-rounded">edit_note</span>
          <span><strong>Renovación en proceso.</strong> Revisa y completa los datos; la renovación solo queda hecha
          cuando pulses <strong>Renovar</strong> abajo. ${enlace}</span>`
        : `<span class="material-symbols-rounded">autorenew</span>
          <span>Esta póliza es una <strong>renovación</strong>. ${enlace}</span>`;
      if (poliza.estado_renovacion === 'Borrador') div.classList.add('en-proceso');
      header.insertAdjacentElement('afterend', div);
    }
  }

  // ---------- Botón
  function mostrarBoton(continuar) {
    if (document.getElementById('btnRenovarPoliza')) return;
    const izquierda = document.querySelector('.page-header .header-left');
    if (!izquierda) return;

    const btn = document.createElement('button');
    btn.id = 'btnRenovarPoliza';
    btn.type = 'button';
    btn.className = 'btn-renovar';
    if (continuar) {
      btn.innerHTML = `<span class="material-symbols-rounded">autorenew</span> Continuar renovación`;
      btn.title = 'Abrir la renovación que quedó sin terminar';
      btn.addEventListener('click', () => {
        if (polizaActual?.cliente_renovado_id) {
          window.location.href = `./cliente_editar.html?id=${encodeURIComponent(polizaActual.cliente_renovado_id)}`;
        } else {
          renovar(); // el servidor devuelve el borrador existente
        }
      });
    } else {
      btn.innerHTML = `<span class="material-symbols-rounded">autorenew</span> Renovar`;
      btn.title = `Renovar esta póliza para ${anioRenovacion()}`;
      btn.addEventListener('click', confirmarRenovacion);
    }

    const volver = izquierda.querySelector('.btn-back');
    if (volver) volver.insertAdjacentElement('afterend', btn);
    else izquierda.prepend(btn);
  }

  function escapar(t) {
    return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Ventana de confirmación con el diseño de Figma. Devuelve true si confirma.
  function pedirConfirmacion(anio, opciones) {
    const o = Object.assign({
      titulo: 'Confirmar renovación',
      pregunta: `¿Renovar esta póliza para ${anio}?`,
      datos: [
        ['Póliza actual', polizaActual.numero_poliza || 'Sin número', ''],
        ['Nueva efectividad', `01/01/${anio}`, ''],
        ['Nueva póliza', 'Se generará', 'morado'],
      ],
      advertencias: [
        `Se creará un BORRADOR con un cliente y una póliza nuevos, con efectividad 01/01/${anio}.`,
        'Se copian todos los datos actuales del cliente, sus dependientes, su método de pago y sus documentos, excepto la información del plan (plan, prima, crédito fiscal, member ID).',
      ],
      final: 'La renovación solo queda hecha cuando pulses "Renovar" en la ficha nueva. Mientras tanto, esta póliza quedará "En proceso".',
      nota: 'Cancelar vuelve a la edición sin renovar.',
      confirmar: 'Confirmar renovación',
    }, opciones || {});
    return new Promise((resolver) => {
      const anterior = document.activeElement;
      const modal = document.createElement('div');
      modal.className = 'modal-renovacion';
      modal.innerHTML = `
        <div class="mr-caja" role="dialog" aria-modal="true" aria-labelledby="mrTitulo">
          <div class="mr-encabezado">
            <h3 class="mr-titulo" id="mrTitulo">
              <span class="mr-icono"><span class="material-symbols-rounded">autorenew</span></span>
              ${escapar(o.titulo)}
            </h3>
            <button type="button" class="mr-cerrar" data-accion="cancelar" aria-label="Cerrar">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="mr-cuerpo">
            <div class="mr-etiqueta"><span class="material-symbols-rounded">error</span>REQUIERE CONFIRMACIÓN PARA CONTINUAR</div>
            <p class="mr-pregunta">${escapar(o.pregunta)}</p>
            <div class="mr-datos">
              ${o.datos.map(([k, v, c]) => `<div><small>${escapar(k)}</small><strong class="${c}">${escapar(v)}</strong></div>`).join('')}
            </div>
            <div class="mr-advertencia">
              <h4><span class="material-symbols-rounded">warning</span>Antes de confirmar</h4>
              ${o.advertencias.map((t) => `<p>${escapar(t)}</p>`).join('')}
              <p class="final">${escapar(o.final)}</p>
            </div>
          </div>
          <div class="mr-acciones">
            <span class="mr-nota">${escapar(o.nota)}</span>
            <button type="button" class="mr-btn cancelar" data-accion="cancelar">Cancelar</button>
            <button type="button" class="mr-btn confirmar" data-accion="confirmar">
              <span class="material-symbols-rounded">autorenew</span>${escapar(o.confirmar)}
            </button>
          </div>
        </div>`;

      function cerrar(valor) {
        document.removeEventListener('keydown', teclas, true);
        modal.remove();
        document.body.style.overflow = '';
        if (anterior && anterior.focus) anterior.focus();
        resolver(valor);
      }
      function teclas(e) {
        if (e.key === 'Escape') { e.preventDefault(); cerrar(false); }
        if (e.key === 'Tab') { // mantiene el foco dentro de la ventana
          const f = modal.querySelectorAll('button');
          const primero = f[0], ultimo = f[f.length - 1];
          if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
          else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
        }
      }

      modal.addEventListener('click', (e) => {
        if (e.target === modal) return cerrar(false); // clic fuera
        const b = e.target.closest('[data-accion]');
        if (b) cerrar(b.dataset.accion === 'confirmar');
      });
      document.addEventListener('keydown', teclas, true);
      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';
      modal.querySelector('.mr-btn.cancelar').focus();
    });
  }

  async function confirmarRenovacion() {
    if (renovando || !polizaActual) return;
    if (document.querySelector('.modal-renovacion')) return;
    estilos();
    const ok = await pedirConfirmacion(anioRenovacion());
    if (!ok) return;
    await renovar();
  }

  // ---------- Documentos: cada archivo se duplica en Storage para que el cliente
  // nuevo tenga su propia copia (si alguien borra uno, no afecta al otro).
  function rutaStorage(url) {
    try {
      const partes = new URL(url).pathname.split('/');
      const i = partes.indexOf('documentos');
      return i >= 0 ? decodeURIComponent(partes.slice(i + 1).join('/')) : null;
    } catch (e) { return null; }
  }

  async function copiarDocumentos(clienteOrigen, clienteNuevo) {
    const r = { total: 0, copiados: 0, fallidos: 0 };
    const cliente = sb();
    const { data: docs, error } = await cliente.from('documentos').select('*').eq('cliente_id', clienteOrigen);
    if (error) { console.warn('[renovación] no se pudieron leer los documentos:', error.message); return r; }
    r.total = (docs || []).length;

    for (const doc of docs || []) {
      try {
        const origen = rutaStorage(doc.url_archivo);
        if (!origen) throw new Error('URL de archivo no reconocida');
        const nombre = origen.split('/').pop();
        const destino = `${clienteNuevo}/${Date.now()}_ren_${nombre}`;

        const { error: errCopia } = await cliente.storage.from('documentos').copy(origen, destino);
        if (errCopia) throw errCopia;
        const { data: url } = cliente.storage.from('documentos').getPublicUrl(destino);

        const fila = { ...doc, cliente_id: clienteNuevo, url_archivo: url.publicUrl };
        delete fila.id; delete fila.created_at; delete fila.updated_at;
        const { error: errFila } = await cliente.from('documentos').insert(fila);
        if (errFila) {
          await cliente.storage.from('documentos').remove([destino]); // no dejar archivos huérfanos
          throw errFila;
        }
        r.copiados++;
      } catch (e) {
        r.fallidos++;
        console.warn('[renovación] documento no copiado:', doc.nombre_archivo, e?.message || e);
      }
    }
    return r;
  }

  async function renovar() {
    const btn = document.getElementById('btnRenovarPoliza');
    renovando = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-rounded">hourglass_top</span> Renovando...`;
    }

    try {
      const { data, error } = await sb().rpc('renovar_poliza', { p_poliza_id: String(polizaActual.id) });
      if (error) throw error;

      if (data.continuar) {
        aviso('Abriendo la renovación en proceso...', 'info');
      } else {
        if (btn) btn.innerHTML = `<span class="material-symbols-rounded">hourglass_top</span> Copiando documentos...`;
        const docs = await copiarDocumentos(polizaActual.cliente_id, data.cliente_id);
        const extra = docs.total
          ? ` Documentos copiados: ${docs.copiados} de ${docs.total}.` + (docs.fallidos ? ' Revisa los que faltan.' : '')
          : '';
        aviso(`Borrador de renovación creado (${data.numero_poliza}).${extra} Termínalo con el botón Renovar.`,
          docs.fallidos ? 'warning' : 'success');
      }
      setTimeout(() => {
        window.location.href = `./cliente_editar.html?id=${encodeURIComponent(data.cliente_id)}`;
      }, 900);
    } catch (e) {
      const msg = e?.message || 'No se pudo renovar la póliza.';
      aviso(msg, 'error');
      renovando = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-rounded">autorenew</span> Renovar`;
      }
      // Si ya estaba renovada (otro usuario se adelantó), se actualizan los avisos y se quita el botón
      if (/ya fue renovada/i.test(msg) && polizaActual) {
        btn?.remove();
        cargar(polizaActual.id);
      }
    }
  }

  // ---------- Ficha del borrador: título, botón "Renovar" y guardado en BD
  let guardandoBorrador = false;

  function nombreCliente() {
    const n = document.getElementById('nombres')?.value || '';
    const a = document.getElementById('apellidos')?.value || '';
    return `${n} ${a}`.trim();
  }

  function modoBorrador() {
    // Espera a que cliente_editar.js termine de pintar la ficha (título y botón restaurados)
    let intentos = 0;
    const espera = setInterval(() => {
      intentos++;
      const titulo = document.getElementById('pageTitle');
      const btn = document.querySelector('.btn-submit');
      const listo = titulo && /Editando/.test(titulo.textContent) && btn && !btn.disabled;
      if (!listo && intentos < 60) return;
      clearInterval(espera);

      if (titulo) titulo.textContent = `🔄 Realizando renovación a: ${nombreCliente()}`;
      if (btn) btn.innerHTML = '<span class="material-symbols-rounded">autorenew</span> Renovar';

      const borrador = document.getElementById('btnBorrador');
      if (borrador) {
        borrador.removeAttribute('onclick');
        borrador.addEventListener('click', async (e) => {
          e.preventDefault();
          const ok = await guardarFormularioEnBD(borrador, 'Guardando...');
          if (ok) {
            aviso('Borrador guardado. La renovación sigue en proceso.', 'success');
            setTimeout(() => location.reload(), 800); // recarga para no duplicar dependientes/documentos nuevos
          }
        });
      }
    }, 500);

    // El botón de abajo ("Renovar") termina la renovación en vez de "Actualizar Cliente"
    document.addEventListener('submit', async (e) => {
      if (e.target?.id !== 'clienteForm') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      await finalizarRenovacion();
    }, true);
  }

  // Guarda el formulario usando las mismas funciones de cliente_editar.js
  async function guardarFormularioEnBD(boton, texto) {
    if (guardandoBorrador) return false;
    guardandoBorrador = true;
    const original = boton?.innerHTML;
    if (boton) { boton.disabled = true; boton.innerHTML = `<span class="material-symbols-rounded">hourglass_top</span> ${texto}`; }
    try {
      const fd = obtenerDatosFormulario();
      await actualizarCliente(clienteId, fd);
      await actualizarPoliza(polizaId, fd);
      await guardarEstadoSeguimiento(polizaId, fd);
      await actualizarDependientes(clienteId, fd);
      await guardarDocumentosNuevos(clienteId);
      await guardarMesesPagados(clienteId);
      await guardarMetodoPago(clienteId);
      try { localStorage.removeItem(`borrador_cliente_${clienteId}`); } catch (e) {}
      guardandoBorrador = false;
      return true;
    } catch (e) {
      aviso('No se pudo guardar: ' + (e?.message || e), 'error');
      if (boton) { boton.disabled = false; boton.innerHTML = original; }
      guardandoBorrador = false;
      return false;
    }
  }

  async function finalizarRenovacion() {
    if (renovando || !polizaActual) return;
    if (typeof validarFormularioCompleto === 'function' && !validarFormularioCompleto()) return;
    if (document.querySelector('.modal-renovacion')) return;
    estilos();

    const anio = (polizaActual.numero_poliza || '').match(/POL-(\d{4})/)?.[1] || anioRenovacion();
    const ok = await pedirConfirmacion(anio, {
      titulo: 'Terminar renovación',
      pregunta: `¿Renovar a ${nombreCliente() || 'este cliente'} para ${anio}?`,
      datos: [
        ['Póliza nueva', polizaActual.numero_poliza || 'Sin número', 'morado'],
        ['Efectividad', `01/01/${anio}`, ''],
        ['Estado', 'Borrador → Renovada', ''],
      ],
      advertencias: [
        'Se guardarán todos los datos del formulario en la póliza nueva.',
        'La póliza anterior quedará marcada como "Renovada" y la renovación contará a tu nombre.',
      ],
      final: 'Después de confirmar no se puede deshacer desde la ficha.',
      nota: 'Cancelar vuelve a la edición; el borrador se mantiene.',
      confirmar: 'Renovar',
    });
    if (!ok) return;

    const btn = document.querySelector('.btn-submit');
    renovando = true;
    try {
      if (!(await guardarFormularioEnBD(btn, 'Guardando...'))) { renovando = false; return; }
      if (btn) btn.innerHTML = '<span class="material-symbols-rounded">hourglass_top</span> Renovando...';
      const { error } = await sb().rpc('finalizar_renovacion', { p_poliza_id: String(polizaActual.id) });
      if (error) throw error;
      try { clearInterval(autosaveTimer); } catch (e) {}
      aviso('Renovación terminada correctamente.', 'success');
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      renovando = false;
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-rounded">autorenew</span> Renovar'; }
      aviso(e?.message || 'No se pudo terminar la renovación.', 'error');
    }
  }

  // ---------- Espera a que cliente_editar.js cargue la póliza
  function iniciar() {
    console.info('[renovación] script cargado');
    if (new URLSearchParams(location.search).get('modo') === 'ver') return; // solo lectura
    estilos();
    let intentos = 0;
    const espera = setInterval(() => {
      intentos++;
      const pid = idPolizaCargada();
      if (pid) {
        clearInterval(espera);
        cargar(pid);
      } else if (intentos > 40) {
        clearInterval(espera); // ~20 s: el cliente no tiene póliza
        console.info('[renovación] no se encontró una póliza cargada en la ficha');
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();