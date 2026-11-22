// ============ PANEL DEL REPARTIDOR ============
// Usa el núcleo compartido (Scripts-app.js → window.LE). Los cambios de
// estado se guardan en los mismos datos de prueba que ve el comercio.
(() => {
  'use strict';
  const { $, $$, ZONAS, ESTADOS, FINALES, MOTIVOS, money, formatPhone, escapeHTML, mapsUrl, waUrl,
          store, statusPill, timelineHTML, toast, openSheet, closeSheet, on } = window.LE;

  const COMERCIO = { nombre: 'Tienda Central', direccion: 'Cra 13 #45-20, Chapinero', zona: 'bogota', telefono: '3152004567' };

  // Orden de la ruta: lo que ya va en camino primero, luego lo recogido, luego lo por recoger
  const PRIORIDAD = { en_camino: 0, recogido: 1, por_recoger: 2 };
  const ruta = (all) => all.filter((o) => !FINALES.includes(o.estado))
    .sort((a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado] || a.codigo.localeCompare(b.codigo));
  const hechas = (all) => all.filter((o) => FINALES.includes(o.estado))
    .sort((a, b) => (b.historial.at(-1)?.[1] || '').localeCompare(a.historial.at(-1)?.[1] || ''));

  // Qué hace el repartidor en cada estado
  const PASO = {
    por_recoger: { accion: 'Recoger en', a: 'recogido', swipe: 'Desliza: ya lo recogí', ok: 'Pedido recogido' },
    recogido:    { accion: 'Entregar a', a: 'en_camino', swipe: 'Desliza: salir a entregar', ok: 'En camino al cliente' },
    en_camino:   { accion: 'Entregar a', a: 'entregado', swipe: 'Desliza: entregado', ok: '¡Entregado!' },
  };

  const icon = {
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.4Z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1-1.3 2 .9c-.3 1.3-1.4 2-2.7 1.8-3-.5-5.7-3.2-6.2-6.2-.2-1.3.5-2.4 1.8-2.7l.9 2Z"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5a7 7 0 1 1 14 0C19 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  // ---------- Render ----------
  function renderHero(all) {
    const done = all.filter((o) => o.estado === 'entregado');
    const pendientes = all.filter((o) => !FINALES.includes(o.estado));
    const v = {
      hechas: all.filter((o) => FINALES.includes(o.estado)).length,
      total: all.length,
      cobrado: done.reduce((s, o) => s + (o.cobro || 0), 0),
      pendiente: pendientes.reduce((s, o) => s + (o.cobro || 0), 0),
    };
    $$('[data-stat]').forEach((el) => { el.textContent = v[el.dataset.stat] ?? 0; });
    $$('[data-money]').forEach((el) => { el.textContent = money(v[el.dataset.money]); });
    // Barra del día: un segmento por pedido, coloreado por estado
    const order = [...hechas(all).reverse(), ...ruta(all)];
    $('#day-bar').innerHTML = order.map((o) => `<i data-tono="${ESTADOS[o.estado].tono}"></i>`).join('');
  }

  function nextCardHTML(o, idx, total) {
    const paso = PASO[o.estado];
    const recoger = o.estado === 'por_recoger';
    const destino = recoger ? COMERCIO : o;
    const titulo = recoger ? COMERCIO.nombre : o.nombre;
    const tel = recoger ? COMERCIO.telefono : o.telefono;
    const cobro = o.cobro > 0
      ? `<div class="cash"><span>${recoger ? 'Cobrarás al entregar' : 'Cobrar al cliente'}</span><strong>${money(o.cobro)}</strong></div>`
      : `<div class="cash paid"><span>Pedido ya pagado</span><strong>No cobrar</strong></div>`;
    return `
      <article class="next-card" data-id="${o.id}" data-estado="${o.estado}">
        <div class="next-top">${statusPill(o.estado)}<span class="next-code">${o.codigo} · Parada ${idx + 1} de ${total}</span></div>
        <p class="next-action">${paso.accion}</p>
        <h3 class="next-name">${escapeHTML(titulo)}</h3>
        <p class="next-address">${escapeHTML(destino.direccion)} <span class="zone-tag">${ZONAS[destino.zona]?.nombre || ''}</span></p>
        ${recoger ? `<p class="next-for">Para: <b>${escapeHTML(o.nombre)}</b> · ${escapeHTML(o.direccion)}</p>` : ''}
        ${!recoger && o.notas ? `<p class="next-note">${escapeHTML(o.notas)}</p>` : ''}
        ${cobro}
        <div class="quick-actions">
          <a class="quick" href="tel:+57${tel}">${icon.phone}<span>Llamar</span></a>
          <a class="quick" href="${waUrl(tel)}" target="_blank" rel="noopener">${icon.wa}<span>WhatsApp</span></a>
          <a class="quick" href="${mapsUrl(destino)}" target="_blank" rel="noopener">${icon.map}<span>Cómo llegar</span></a>
        </div>
        <div class="swipe" data-to="${paso.a}">
          <span class="swipe-fill" aria-hidden="true"></span>
          <span class="swipe-label">${paso.swipe}</span>
          <button type="button" class="swipe-knob" aria-label="${paso.swipe.replace('Desliza: ', 'Confirmar: ')}">${icon.arrow}</button>
        </div>
        ${o.estado === 'en_camino' ? '<button type="button" class="btn btn-ghost btn-block fail-btn" data-action="open-fail">No se pudo entregar</button>' : ''}
      </article>`;
  }

  function stopHTML(o, i, current) {
    const recoger = o.estado === 'por_recoger';
    return `
      <li class="stop-item${current ? ' current' : ''}" data-estado="${o.estado}">
        <button type="button" class="stop-btn" data-action="open-stop" data-id="${o.id}" aria-haspopup="dialog">
          <span class="stop-num" aria-hidden="true">${FINALES.includes(o.estado) ? (o.estado === 'entregado' ? '✓' : '!') : i + 1}</span>
          <span class="stop-info">
            <span class="stop-name">${escapeHTML(o.nombre)}</span>
            <span class="stop-sub">${recoger ? 'Recoger en ' + COMERCIO.nombre : escapeHTML(o.direccion)} · ${ZONAS[o.zona]?.nombre || ''}</span>
          </span>
          <span class="stop-side">${o.cobro > 0 ? `<span class="stop-amount">${money(o.cobro)}</span>` : ''}${statusPill(o.estado)}</span>
        </button>
      </li>`;
  }

  let lastNextId = null;
  function render() {
    const all = store.all();
    renderHero(all);
    const r = ruta(all);
    const h = hechas(all);

    const next = r[0];
    const slot = $('#next-slot');
    if (next) {
      slot.innerHTML = nextCardHTML(next, 0, r.length);
      $('#next-meta').textContent = `${r.length} pendiente${r.length === 1 ? '' : 's'}`;
      bindSwipe($('.swipe', slot), next);
      if (lastNextId && lastNextId !== next.id) window.LoEntregoMotion?.nextChanged($('.next-card', slot));
      lastNextId = next.id;
    } else {
      const cobrado = all.filter((o) => o.estado === 'entregado').reduce((s, o) => s + (o.cobro || 0), 0);
      slot.innerHTML = `
        <div class="next-card route-done">
          <span class="isotipo isotipo-done" aria-hidden="true"></span>
          <h3 class="next-name">¡Ruta completada!</h3>
          <p class="next-address">Entrega <b>${money(cobrado)}</b> en efectivo a ${COMERCIO.nombre}.</p>
        </div>`;
      $('#next-meta').textContent = '';
      lastNextId = null;
    }

    $('#stop-list').innerHTML = r.map((o, i) => stopHTML(o, i, i === 0)).join('');
    $('#route-count').textContent = r.length;
    $('#done-list').innerHTML = h.map((o, i) => stopHTML(o, i, false)).join('');
    $('#done-count').textContent = h.length;
    $('#done-group').hidden = h.length === 0;

    if (currentStop && $('#sheet-stop').dataset.state === 'open') renderStop(currentStop);
  }

  // ---------- Deslizar para confirmar ----------
  function bindSwipe(swipe, order) {
    if (!swipe) return;
    const knob = $('.swipe-knob', swipe);
    const fill = $('.swipe-fill', swipe);
    let startX = 0, x = 0, max = 0, dragging = false;

    const setX = (v) => {
      x = Math.max(0, Math.min(max, v));
      knob.style.transform = `translateX(${x}px)`;
      fill.style.transform = `scaleX(${(x + knob.offsetWidth) / swipe.offsetWidth})`;
      swipe.style.setProperty('--p', max ? x / max : 0);
    };
    const reset = () => {
      swipe.classList.add('snap');
      setX(0);
      setTimeout(() => swipe.classList.remove('snap'), 300);
    };
    const complete = () => {
      swipe.classList.add('snap', 'done');
      setX(max);
      navigator.vibrate?.(30);
      setTimeout(() => advance(order, swipe.dataset.to), 220);
    };

    knob.addEventListener('pointerdown', (e) => {
      dragging = true;
      max = swipe.offsetWidth - knob.offsetWidth - 8;
      startX = e.clientX - x;
      knob.setPointerCapture(e.pointerId);
      swipe.classList.remove('snap');
    });
    knob.addEventListener('pointermove', (e) => { if (dragging) setX(e.clientX - startX); });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (x >= max * 0.85) complete(); else reset();
    };
    knob.addEventListener('pointerup', end);
    knob.addEventListener('pointercancel', end);
    // Teclado / lectores de pantalla: Enter o Espacio confirman
    knob.addEventListener('click', (e) => {
      if (e.detail === 0) { max = swipe.offsetWidth - knob.offsetWidth - 8; complete(); }
    });
  }

  async function advance(order, estado) {
    const o = store.setEstado(order.id, estado);
    if (!o) return;
    if (estado === 'entregado') {
      $('#done-msg').textContent = o.cobro > 0 ? `¡Entregado! +${money(o.cobro)}` : '¡Entregado!';
      await window.LoEntregoMotion?.celebrate($('#done-layer'));
      toast(`Entregado · ${o.codigo}`);
    } else {
      toast(`${PASO[order.estado].ok} · ${o.codigo}`);
    }
  }

  // ---------- No se pudo entregar ----------
  let failId = null;
  function openFail() {
    const card = $('.next-card[data-id]');
    if (!card) return;
    failId = card.dataset.id;
    const o = store.get(failId);
    $('#fail-sub').textContent = `${o.codigo} · ${o.nombre}. Le avisaremos al comercio.`;
    $('#reason-options').innerHTML = Object.entries(MOTIVOS).map(([k, v]) => `
      <label class="reason"><input type="radio" name="motivo" value="${k}"><span>${v}</span></label>`).join('');
    $('#fail-submit').disabled = true;
    openSheet('sheet-fail');
  }

  // ---------- Detalle de parada ----------
  let currentStop = null;
  function renderStop(id) {
    const o = store.get(id);
    if (!o) return;
    $('#stop-detail').innerHTML = `
      <div class="ticket">
        <div>${statusPill(o.estado)}<span class="ticket-code">${o.codigo}</span></div>
        <h2 class="ticket-name" id="sd-nombre">${escapeHTML(o.nombre)}</h2>
        <p class="ticket-amount"><span>${o.cobro > 0 ? 'Cobrar al cliente' : 'Pedido ya pagado'}</span> <strong>${money(o.cobro)}</strong></p>
      </div>
      <span class="sheet-section-label">Seguimiento</span>
      <div class="detail-list">${timelineHTML(o)}</div>
      <span class="sheet-section-label">Entrega</span>
      <dl class="detail-list">
        <div class="detail-row"><div><dt>Dirección</dt><dd><a href="${mapsUrl(o)}" target="_blank" rel="noopener">${escapeHTML(o.direccion)}</a></dd></div></div>
        <div class="detail-row"><div><dt>Zona</dt><dd>${ZONAS[o.zona]?.nombre || '—'}</dd></div></div>
        <div class="detail-row"><div><dt>Celular</dt><dd><a href="tel:+57${o.telefono}">${formatPhone(o.telefono)}</a></dd></div></div>
        <div class="detail-row"><div><dt>Notas</dt><dd>${escapeHTML(o.notas) || 'Sin notas'}</dd></div></div>
        ${o.estado === 'no_entregado' ? `<div class="detail-row"><div><dt>Motivo</dt><dd>${MOTIVOS[o.motivo] || '—'}</dd></div></div>` : ''}
      </dl>`;
  }

  // ---------- Acciones ----------
  on('open-fail', openFail);
  on('open-stop', (el) => { currentStop = el.dataset.id; renderStop(currentStop); openSheet('sheet-stop'); });
  document.addEventListener('le:orders', render);

  document.addEventListener('DOMContentLoaded', () => {
    render();
    const form = $('#fail-form');
    form.addEventListener('change', () => { $('#fail-submit').disabled = !form.motivo.value; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!failId || !form.motivo.value) return;
      const o = store.setEstado(failId, 'no_entregado', { motivo: form.motivo.value });
      closeSheet($('#sheet-fail'));
      toast(`Novedad reportada · ${o.codigo}`, 'error');
    });
  });
})();
