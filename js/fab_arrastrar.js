(function () {
  'use strict';
  const MARGEN = 20;
  const UMBRAL = 6;
  const CLAVE = 'ss_fab_posicion';

  function iniciar() {
    const cont = document.getElementById('fabContainer');
    const btn = document.getElementById('fabMain');
    if (!cont || !btn || cont.dataset.arrastrable) return;
    cont.dataset.arrastrable = '1';

    // ---- posición guardada: { lado: 'izq'|'der'|'arriba'|'abajo', pct: 0..1 }
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) {}

    const tam = () => btn.getBoundingClientRect();

    function aplicar(p, animar) {
      if (!p) return;
      const r = tam();
      const W = window.innerWidth, H = window.innerHeight;
      const maxX = W - r.width - MARGEN, maxY = H - r.height - MARGEN;
      let x, y;
      if (p.lado === 'izq' || p.lado === 'der') {
        x = p.lado === 'izq' ? MARGEN : maxX;
        y = Math.min(Math.max(MARGEN, p.pct * H - r.height / 2), maxY);
      } else {
        y = p.lado === 'arriba' ? MARGEN : maxY;
        x = Math.min(Math.max(MARGEN, p.pct * W - r.width / 2), maxX);
      }
      cont.style.transition = animar ? 'left .25s ease, top .25s ease' : '';
      cont.style.left = x + 'px';
      cont.style.top = y + 'px';
      cont.style.right = 'auto';
      cont.style.bottom = 'auto';
      cont.classList.toggle('fab-izq', x + r.width / 2 < W / 2);
      cont.classList.toggle('fab-arriba', y + r.height / 2 < H / 2);
    }

    function pegarAlBorde(cx, cy) {
      const W = window.innerWidth, H = window.innerHeight;
      const d = { izq: cx, der: W - cx, arriba: cy, abajo: H - cy };
      const lado = Object.keys(d).reduce((a, b) => (d[a] <= d[b] ? a : b));
      return { lado, pct: (lado === 'izq' || lado === 'der') ? cy / H : cx / W };
    }

    // ---- arrastre
    let inicio = null, movido = false, off = { x: 0, y: 0 };

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const r = tam();
      inicio = { x: e.clientX, y: e.clientY };
      off = { x: e.clientX - r.left, y: e.clientY - r.top };
      movido = false;
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
    });

    btn.addEventListener('pointermove', (e) => {
      if (!inicio) return;
      if (!movido && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < UMBRAL) return;
      if (!movido) {
        movido = true;
        cont.classList.add('fab-arrastrando');
        if (typeof cerrarFAB === 'function' && cont.classList.contains('open')) cerrarFAB();
      }
      const r = tam();
      const x = Math.min(Math.max(0, e.clientX - off.x), window.innerWidth - r.width);
      const y = Math.min(Math.max(0, e.clientY - off.y), window.innerHeight - r.height);
      cont.style.transition = '';
      cont.style.left = x + 'px';
      cont.style.top = y + 'px';
      cont.style.right = 'auto';
      cont.style.bottom = 'auto';
      e.preventDefault();
    });

    function soltar(e) {
      if (!inicio) return;
      inicio = null;
      try { btn.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!movido) return;
      cont.classList.remove('fab-arrastrando');
      const r = tam();
      pos = pegarAlBorde(r.left + r.width / 2, r.top + r.height / 2);
      aplicar(pos, true);
      try { localStorage.setItem(CLAVE, JSON.stringify(pos)); } catch (err) {}
    }
    btn.addEventListener('pointerup', soltar);
    btn.addEventListener('pointercancel', soltar);

    // después de arrastrar, el clic no abre el menú
    btn.addEventListener('click', (e) => {
      if (movido) { e.stopImmediatePropagation(); e.preventDefault(); movido = false; }
    }, true);

    window.addEventListener('resize', () => aplicar(pos, false));
    aplicar(pos, false);
  }

  const css = document.createElement('style');
  css.textContent = `
    #fabMain { touch-action:none; }
    .fab-container.fab-arrastrando #fabMain { cursor:grabbing; transform:scale(1.08); }
    .fab-container.fab-izq { align-items:flex-start; }
    .fab-container.fab-izq .fab-actions { align-items:flex-start; left:0; }
    .fab-container.fab-izq .fab-action-item { flex-direction:row-reverse; justify-content:flex-end; }
    .fab-container.fab-arriba .fab-actions { bottom:auto; top:calc(100% + 12px); flex-direction:column; }`;
  document.head.appendChild(css);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 0));
  else setTimeout(iniciar, 0);
})();