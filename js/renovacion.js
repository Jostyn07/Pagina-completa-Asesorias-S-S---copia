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
      .aviso-renovacion a{color:inherit;font-weight:700;text-decoration:underline}
      .aviso-renovacion .material-symbols-rounded{font-size:20px}
      [data-theme="dark"] .aviso-renovacion.renovada{background:#14532d;color:#bbf7d0;border-color:#166534}
      [data-theme="dark"] .aviso-renovacion.es-renovacion{background:#3b0764;color:#ddd6fe;border-color:#5b21b6}
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

    const { data: permitido } = await cliente.rpc('tiene_permiso', { p_clave: 'renovar_poliza' });
    if (permitido) mostrarBoton();
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
      div.innerHTML = `<span class="material-symbols-rounded">autorenew</span>
        <span>Esta póliza es una <strong>renovación</strong>. ${enlace}</span>`;
      header.insertAdjacentElement('afterend', div);
    }
  }

  // ---------- Botón
  function mostrarBoton() {
    if (document.getElementById('btnRenovarPoliza')) return;
    const izquierda = document.querySelector('.page-header .header-left');
    if (!izquierda) return;

    const btn = document.createElement('button');
    btn.id = 'btnRenovarPoliza';
    btn.type = 'button';
    btn.className = 'btn-renovar';
    btn.innerHTML = `<span class="material-symbols-rounded">autorenew</span> Renovar`;
    btn.title = `Renovar esta póliza para ${anioRenovacion()}`;
    btn.addEventListener('click', confirmarRenovacion);

    const volver = izquierda.querySelector('.btn-back');
    if (volver) volver.insertAdjacentElement('afterend', btn);
    else izquierda.prepend(btn);
  }

  async function confirmarRenovacion() {
    if (renovando || !polizaActual) return;
    const anio = anioRenovacion();
    const ok = confirm(
      `¿Renovar esta póliza para ${anio}?\n\n` +
      `Se creará un CLIENTE NUEVO y una PÓLIZA NUEVA con efectividad 01/01/${anio}.\n` +
      `Se copian todos los datos actuales del cliente, sus dependientes y su método de pago, ` +
      `excepto la información del plan (plan, prima, crédito fiscal, member ID).\n\n` +
      `Esta póliza quedará marcada como "Renovada" y no se podrá renovar de nuevo.`
    );
    if (!ok) return;
    await renovar();
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

      aviso(`Póliza renovada: ${data.numero_poliza}. Abriendo la póliza nueva...`, 'success');
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

  // ---------- Espera a que cliente_editar.js cargue la póliza
  function iniciar() {
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
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();