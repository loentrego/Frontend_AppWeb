// ============ PANEL DEL REPARTIDOR ============
// Usa el núcleo compartido (Scripts-app.js → window.LE). Los cambios de
// estado se guardan en los mismos datos de prueba que ve el comercio.
//
// Muestra TODOS los pedidos asignados a su perfil (sin recomendar uno).
// Al tocar un pedido se abre su hoja con todas las acciones.
(() => {
  'use strict';
  const { $, $$, ZONAS, ESTADOS, FINALES, MOTIVOS, money, formatPhone, escapeHTML, mapsUrl,
          store, statusPill, trackHTML, timelineHTML, toast, openSheet, closeSheet, on } = window.LE;

  const COMERCIO = { nombre: 'Tienda Central', direccion: 'Cra 13 #45-20, Chapinero', zona: 'bogota', telefono: '3152004567' };

  // Filtros
  const enCurso = (o) => o.estado === 'recogido' || o.estado === 'en_camino';
  const FILTROS = {
    pendientes: (o) => !FINALES.includes(o.estado),
    por_recoger: (o) => o.estado === 'por_recoger',
    curso: enCurso,
    completados: (o) => FINALES.includes(o.estado),
    todos: () => true,
  };
  const VACIOS = {
    pendientes: ['¡Ruta completada!', 'No tienes pedidos pendientes.'],
    por_recoger: ['Nada por recoger', 'Ya recogiste todos tus pedidos.'],
    curso: ['Nada en camino', 'Desliza "salir a entregar" en un pedido recogido.'],
    completados: ['Aún sin completar', 'Tus entregas del día aparecerán aquí.'],
    todos: ['Sin pedidos asignados', 'Cuando te asignen pedidos aparecerán aquí.'],
  };
  // Orden: por código (orden de asignación); los completados al final
  const ordenar = (list) => [...list].sort((a, b) =>
    (FINALES.includes(a.estado) - FINALES.includes(b.estado)) || a.codigo.localeCompare(b.codigo));

  // Qué hace el repartidor en cada estado
  const PASO = {
    por_recoger: { accion: 'Recoger en', a: 'recogido', swipe: 'Desliza: ya lo recogí', ok: 'Pedido recogido' },
    recogido:    { accion: 'Entregar a', a: 'en_camino', swipe: 'Desliza: salir a entregar', ok: 'En camino al cliente' },
    en_camino:   { accion: 'Entregar a', a: 'entregado', swipe: 'Desliza: entregado', ok: '¡Entregado!' },
  };

  const icon = {
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5a7 7 0 1 1 14 0C19 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  let filtro = 'pendientes';
  let currentId = null;

  // ---------- Encabezado ----------
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
  }

  // ---------- Lista de pedidos ----------
  function jobHTML(o) {
    const recoger = o.estado === 'por_recoger';
    const hint = FINALES.includes(o.estado) ? (o.estado === 'entregado' ? 'Entregado' : 'Novedad reportada')
      : recoger ? `Recoger en ${COMERCIO.nombre}` : 'Entregar al cliente';
    const cobro = o.cobro > 0 ? `<span class="job-amount">${money(o.cobro)}</span>` : '<span class="job-amount paid">Pagado</span>';
    return `
      <li>
        <button type="button" class="order-item job-item" data-action="open-job" data-id="${o.id}" data-estado="${o.estado}" aria-haspopup="dialog">
          <span class="job-main">
            <span class="job-hint">${hint}</span>
            <span class="job-name">${escapeHTML(o.nombre)}</span>
            <span class="job-sub">${escapeHTML(o.direccion)} · ${ZONAS[o.zona]?.nombre || ''}</span>
          </span>
          <span class="job-side">${cobro}<span class="job-code">${o.codigo}</span></span>
          <span class="job-track">${trackHTML(o)}${statusPill(o.estado)}</span>
        </button>
      </li>`;
  }

  function render({ animate = false } = {}) {
    // Solo los pedidos asignados a este repartidor (el admin puede reasignarlos)
    const all = store.all().filter((o) => (o.repartidor || 'r1') === 'r1');
    renderHero(all);
    const counts = Object.fromEntries(Object.keys(FILTROS).map((k) => [k, all.filter(FILTROS[k]).length]));
    $$('[data-count]').forEach((el) => { el.textContent = counts[el.dataset.count] ?? 0; });

    const list = $('#job-list');
    const visibles = ordenar(all.filter(FILTROS[filtro]));
    list.innerHTML = visibles.map(jobHTML).join('');
    $('#jobs-empty').hidden = visibles.length > 0;
    const cobrado = all.filter((o) => o.estado === 'entregado').reduce((s, o) => s + (o.cobro || 0), 0);
    const [t, sub] = VACIOS[filtro];
    $('#empty-title').textContent = t;
    $('#empty-sub').textContent = filtro === 'pendientes' && cobrado ? `Entrega ${money(cobrado)} en efectivo a ${COMERCIO.nombre}.` : sub;

    if (animate) window.LoEntregoMotion?.listChanged($$('.job-item', list));
    if (currentId && $('#sheet-job').dataset.state === 'open') renderJob(currentId);
  }

  // ---------- Hoja del pedido (todas las acciones) ----------
  function renderJob(id) {
    const o = store.get(id);
    if (!o) return;
    const paso = PASO[o.estado];
    const recoger = o.estado === 'por_recoger';
    const destino = recoger ? COMERCIO : o;
    const tel = recoger ? COMERCIO.telefono : o.telefono;
    const finalizado = FINALES.includes(o.estado);

    $('#job-detail').innerHTML = `
      <div class="ticket">
        <div>${statusPill(o.estado)}<span class="ticket-code">${o.codigo}</span></div>
        <p class="ticket-kicker">${paso ? paso.accion : (o.estado === 'entregado' ? 'Entregado a' : 'No entregado a')}</p>
        <h2 class="ticket-name" id="job-name">${escapeHTML(recoger ? COMERCIO.nombre : o.nombre)}</h2>
        <p class="ticket-amount"><span>${o.cobro > 0 ? (recoger ? 'Cobrarás al entregar' : 'Cobrar al cliente') : 'Pedido ya pagado'}</span> <strong>${o.cobro > 0 ? money(o.cobro) : 'No cobrar'}</strong></p>
      </div>

      <div class="job-where">
        <p class="job-address">${escapeHTML(destino.direccion)} <span class="zone-tag">${ZONAS[destino.zona]?.nombre || ''}</span></p>
        ${recoger ? `<p class="job-for">Para: <b>${escapeHTML(o.nombre)}</b> · ${escapeHTML(o.direccion)}</p>` : ''}
        ${!recoger && o.notas ? `<p class="job-note">${escapeHTML(o.notas)}</p>` : ''}
      </div>

      ${finalizado ? '' : `
      <div class="quick-actions">
        <a class="quick" href="tel:+57${tel}">${icon.phone}<span>Llamar</span></a>
        <a class="quick" href="${mapsUrl(destino)}" target="_blank" rel="noopener">${icon.map}<span>Cómo llegar</span></a>
      </div>
      <div class="swipe" data-to="${paso.a}">
        <span class="swipe-fill" aria-hidden="true"></span>
        <span class="swipe-label">${paso.swipe}</span>
        <button type="button" class="swipe-knob" aria-label="${paso.swipe.replace('Desliza: ', 'Confirmar: ')}">${icon.arrow}</button>
      </div>
      ${o.estado === 'en_camino' ? '<button type="button" class="btn btn-ghost btn-block fail-btn" data-action="open-fail">No se pudo entregar</button>' : ''}`}

      <span class="sheet-section-label">Seguimiento</span>
      <div class="detail-list">${timelineHTML(o)}</div>

      <span class="sheet-section-label">Datos del cliente</span>
      <dl class="detail-list">
        <div class="detail-row"><div><dt>Recibe</dt><dd>${escapeHTML(o.nombre)}</dd></div></div>
        <div class="detail-row"><div><dt>Celular</dt><dd><a href="tel:+57${o.telefono}">${formatPhone(o.telefono)}</a></dd></div></div>
        <div class="detail-row"><div><dt>Dirección de entrega</dt><dd>${escapeHTML(o.direccion)} · ${ZONAS[o.zona]?.nombre || ''}</dd></div></div>
        ${o.estado === 'no_entregado' ? `<div class="detail-row"><div><dt>Motivo</dt><dd>${MOTIVOS[o.motivo] || '—'}</dd></div></div>` : ''}
      </dl>`;

    if (!finalizado) bindSwipe($('#job-detail .swipe'), o);
  }

  function openJob(id) {
    currentId = id;
    renderJob(id);
    openSheet('sheet-job');
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
    const reset = () => { swipe.classList.add('snap'); setX(0); setTimeout(() => swipe.classList.remove('snap'), 300); };
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
    const end = () => { if (!dragging) return; dragging = false; if (x >= max * 0.85) complete(); else reset(); };
    knob.addEventListener('pointerup', end);
    knob.addEventListener('pointercancel', end);
    // Teclado / lectores de pantalla: Enter o Espacio confirman
    knob.addEventListener('click', (e) => { if (e.detail === 0) { max = swipe.offsetWidth - knob.offsetWidth - 8; complete(); } });
  }

  async function advance(order, estado) {
    const o = store.setEstado(order.id, estado);
    if (!o) return;
    if (estado === 'entregado') {
      closeSheet($('#sheet-job'));
      $('#done-msg').textContent = o.cobro > 0 ? `¡Entregado! +${money(o.cobro)}` : '¡Entregado!';
      await window.LoEntregoMotion?.celebrate($('#done-layer'));
      toast(`Entregado · ${o.codigo}`);
    } else {
      toast(`${PASO[order.estado].ok} · ${o.codigo}`);
    }
  }

  // ---------- No se pudo entregar ----------
  function openFail() {
    if (!currentId) return;
    const o = store.get(currentId);
    $('#fail-sub').textContent = `${o.codigo} · ${o.nombre}. Le avisaremos al comercio.`;
    $('#reason-options').innerHTML = Object.entries(MOTIVOS).map(([k, v]) => `
      <label class="reason"><input type="radio" name="motivo" value="${k}"><span>${v}</span></label>`).join('');
    $('#fail-submit').disabled = true;
    openSheet('sheet-fail');
  }

  function setFilter(f) {
    filtro = f;
    $$('[data-action="filter"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
  }

  // ---------- Acciones ----------
  on('open-job', (el) => openJob(el.dataset.id));
  on('open-fail', openFail);
  on('filter', (el) => { setFilter(el.dataset.filter); render({ animate: true }); });
  document.addEventListener('le:orders', () => render());

  document.addEventListener('DOMContentLoaded', () => {
    render();
    const form = $('#fail-form');
    form.addEventListener('change', () => { $('#fail-submit').disabled = !form.motivo.value; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentId || !form.motivo.value) return;
      const o = store.setEstado(currentId, 'no_entregado', { motivo: form.motivo.value });
      closeSheet($('#sheet-fail'));
      closeSheet($('#sheet-job'));
      toast(`Novedad reportada · ${o.codigo}`, 'error');
    });
  });
})();
