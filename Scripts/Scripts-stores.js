// ============ PANEL DEL COMERCIO ============
// Usa el núcleo compartido (Scripts-app.js → window.LE).
(() => {
  'use strict';
  const { $, $$, ZONAS, ESTADOS, FINALES, MOTIVOS, money, parseMoney, formatPhone, isPhoneCO, escapeHTML,
          store, statusPill, trackHTML, timelineHTML, toast, openSheet, closeSheet, on } = window.LE;

  let filtro = 'todos';
  let currentId = null;

  // ---------- Filtros ----------
  const enCurso = (o) => o.estado === 'recogido' || o.estado === 'en_camino';
  const FILTROS = {
    todos: () => true,
    por_recoger: (o) => o.estado === 'por_recoger',
    curso: enCurso,
    entregado: (o) => o.estado === 'entregado',
    no_entregado: (o) => o.estado === 'no_entregado',
  };
  const VACIOS = {
    todos: ['Aún no tienes pedidos hoy', 'Toca “Nuevo pedido” para crear el primero.'],
    por_recoger: ['Nada por recoger', 'Todos tus pedidos ya salieron.'],
    curso: ['Nada en camino ahora', 'Aquí verás los pedidos que van rumbo a tu cliente.'],
    entregado: ['Aún sin entregas hoy', 'Los pedidos entregados aparecerán aquí.'],
    no_entregado: ['Sin novedades', 'Ningún pedido ha fallado hoy. 🎉'],
  };

  // ---------- Render ----------
  function orderItemHTML(o) {
    const cobro = o.cobro > 0
      ? `<span class="order-amount">${money(o.cobro)}</span>`
      : `<span class="order-amount paid">Pagado</span>`;
    return `
      <li>
        <button type="button" class="order-item" data-action="open-order" data-id="${o.id}" data-estado="${o.estado}" aria-haspopup="dialog">
          <span class="order-info">
            <span class="order-name">${escapeHTML(o.nombre)}</span>
            <span class="order-sub">${escapeHTML(o.direccion)} · ${ZONAS[o.zona]?.nombre || ''}</span>
          </span>
          <span class="order-side">${cobro}<span class="order-code">${o.codigo}</span></span>
          <span class="order-track">${trackHTML(o)}${statusPill(o.estado)}</span>
        </button>
      </li>`;
  }

  function render({ newId = null, animate = false } = {}) {
    const all = store.all();
    // Stats y contadores
    const counts = Object.fromEntries(Object.keys(FILTROS).map((k) => [k, all.filter(FILTROS[k]).length]));
    const stats = { total: all.length, curso: counts.por_recoger + counts.curso, entregado: counts.entregado };
    $$('[data-stat]').forEach((el) => { el.textContent = stats[el.dataset.stat] ?? 0; });
    $$('[data-count]').forEach((el) => { el.textContent = counts[el.dataset.count] ?? 0; });

    // Lista
    const list = $('#order-list');
    const visibles = all.filter(FILTROS[filtro]);
    list.innerHTML = visibles.map(orderItemHTML).join('');
    const empty = $('#orders-empty');
    empty.hidden = visibles.length > 0;
    [$('#empty-title').textContent, $('#empty-sub').textContent] = VACIOS[filtro];

    if (newId) window.LoEntregoMotion?.orderAdded(newId);
    else if (animate) window.LoEntregoMotion?.listChanged($$('.order-item', list));

    // Si el detalle está abierto, refrescarlo (p. ej. el repartidor cambió el estado)
    if (currentId && $('#sheet-order').dataset.state === 'open') renderDetail(currentId);
  }

  // ---------- Detalle ----------
  function renderDetail(id) {
    const o = store.get(id);
    if (!o) return;
    const puedeEliminar = o.estado === 'por_recoger';
    const editBtn = (label) => `<button type="button" class="edit-btn" data-action="edit-field" aria-label="Editar ${label}"${puedeEliminar ? '' : ' disabled hidden'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg></button>`;
    $('#order-detail').innerHTML = `
      <div class="ticket">
        <div>${statusPill(o.estado)}<span class="ticket-code">${o.codigo}</span></div>
        <h2 class="ticket-name" id="od-nombre">${escapeHTML(o.nombre)}</h2>
        <p class="ticket-amount"><span>${o.cobro > 0 ? 'Cobro contraentrega' : 'Pedido ya pagado'}</span> <strong>${money(o.cobro)}</strong></p>
      </div>

      <span class="sheet-section-label">Seguimiento</span>
      <div class="detail-list">${timelineHTML(o)}</div>

      <span class="sheet-section-label">Entrega</span>
      <dl class="detail-list">
        <div class="detail-row"><div><dt>Dirección</dt><dd>${escapeHTML(o.direccion)}</dd></div>${editBtn('dirección')}</div>
        <div class="detail-row"><div><dt>Zona</dt><dd>${ZONAS[o.zona]?.nombre || '—'} · envío ${money(ZONAS[o.zona]?.tarifa)}</dd></div></div>
        <div class="detail-row"><div><dt>Celular de quien recibe</dt><dd><a href="tel:+57${o.telefono}">${formatPhone(o.telefono)}</a></dd></div>${editBtn('celular')}</div>
        <div class="detail-row"><div><dt>Notas</dt><dd>${escapeHTML(o.notas) || 'Sin notas'}</dd></div>${editBtn('notas')}</div>
        ${o.estado === 'no_entregado' ? `<div class="detail-row"><div><dt>Motivo</dt><dd>${MOTIVOS[o.motivo] || '—'}</dd></div></div>` : ''}
      </dl>

      <div class="pdf-card">
        <span class="pdf-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg></span>
        <div class="pdf-info"><p class="pdf-name">Guía de envío</p><p class="pdf-sub">PDF · ${o.codigo}</p></div>
        <button type="button" class="btn btn-primary pdf-download-btn" data-action="download-guide">Descargar</button>
      </div>

      <button type="button" class="btn btn-danger btn-block sheet-action" data-action="delete-order" ${puedeEliminar ? '' : 'disabled'}>Eliminar pedido</button>
      ${puedeEliminar ? '' : '<p class="btn-hint">Solo se puede eliminar antes de que lo recojan.</p>'}`;
  }

  function openOrder(id) {
    currentId = id;
    renderDetail(id);
    openSheet('sheet-order');
  }

  function deleteOrder(btn) {
    if (!('confirm' in btn.dataset)) {
      btn.dataset.confirm = '';
      btn.textContent = 'Toca de nuevo para confirmar';
      setTimeout(() => { delete btn.dataset.confirm; btn.textContent = 'Eliminar pedido'; }, 3000);
      return;
    }
    store.remove(currentId);
    closeSheet($('#sheet-order'));
    toast('Pedido eliminado');
  }

  // ---------- Formulario ----------
  const RULES = {
    direccion: (v) => v.length >= 6 || 'Escribe la dirección completa (calle, número y detalles)',
    nombre: (v) => v.length >= 3 || 'Escribe el nombre de quien recibe',
    telefono: (v) => isPhoneCO(v) || 'Celular de 10 dígitos que empiece por 3',
  };

  function validateField(input) {
    const rule = RULES[input.name];
    const field = input.closest('.field');
    if (!rule || !field) return true;
    const result = rule(input.value.trim());
    const ok = result === true;
    field.dataset.state = ok ? '' : 'error';
    input.setAttribute('aria-invalid', String(!ok));
    const hint = $('.field-hint', field);
    if (hint) hint.textContent = ok ? '' : result;
    return ok;
  }

  function renderZones() {
    $('#zone-options').innerHTML = Object.entries(ZONAS).map(([k, z], i) => `
      <div class="zone-option">
        <input type="radio" name="zona" id="z-${k}" value="${k}"${i === 0 ? ' checked' : ''}>
        <label for="z-${k}"><b>${z.nombre}</b><small>${money(z.tarifa)}</small></label>
      </div>`).join('');
  }

  function updateSummary(form) {
    const z = ZONAS[form.zona.value] || ZONAS.bogota;
    $('#sum-zona').textContent = z.nombre;
    $('#sum-tarifa').textContent = money(z.tarifa);
    $('#sum-cobro').textContent = money(parseMoney(form.cobro.value));
  }

  function resetForm(form) {
    form.reset();
    $$('.field', form).forEach((f) => { f.dataset.state = ''; });
    $$('.field-hint', form).forEach((h) => { h.textContent = ''; });
    updateSummary(form);
  }

  function handleCreate(form) {
    const invalid = $$('.field-input', form).filter((i) => !validateField(i));
    if (invalid.length) {
      invalid[0].focus();
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      return;
    }
    const btn = $('#order-submit');
    const label = $('.btn-text', btn);
    btn.setAttribute('aria-busy', 'true');
    label.textContent = 'Creando…';

    const d = Object.fromEntries(new FormData(form));
    setTimeout(() => { // simula la latencia de la API
      const o = store.add({
        nombre: d.nombre.trim(), direccion: d.direccion.trim(), zona: d.zona,
        telefono: d.telefono.replace(/\D/g, ''), cobro: parseMoney(d.cobro), notas: d.notas.trim(),
      });
      btn.removeAttribute('aria-busy');
      label.textContent = 'Crear pedido';
      closeSheet($('#sheet-new'));
      resetForm(form);
      if (filtro !== 'todos' && filtro !== 'por_recoger') setFilter('todos');
      render({ newId: o.id });
      $('.app-scroll').scrollTo({ top: $('.orders').offsetTop - 120, behavior: 'smooth' });
      toast(`Pedido ${o.codigo} creado para ${o.nombre.split(' ')[0]}`);
    }, 450);
  }

  function setFilter(f) {
    filtro = f;
    $$('[data-action="filter"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
  }

  // ---------- Acciones ----------
  on('open-order', (el) => openOrder(el.dataset.id));
  on('delete-order', (el) => deleteOrder(el));
  on('filter', (el) => { setFilter(el.dataset.filter); render({ animate: true }); });

  document.addEventListener('le:orders', () => render());

  // ---------- Inicio ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderZones();
    render();

    const form = $('#order-form');
    updateSummary(form);
    form.addEventListener('submit', (e) => { e.preventDefault(); handleCreate(form); });
    form.addEventListener('change', () => updateSummary(form));
    form.addEventListener('focusout', (e) => {
      if (e.target.matches('.field-input') && e.target.value) validateField(e.target);
    });
    form.addEventListener('input', (e) => {
      const input = e.target;
      if (input.dataset.format === 'money') {
        const n = parseMoney(input.value);
        input.value = n ? money(n) : '';
      }
      if (input.dataset.format === 'phone') input.value = formatPhone(input.value);
      if (input.closest('.field')?.dataset.state === 'error') validateField(input);
      updateSummary(form);
    });

    // El botón flotante se compacta al bajar por la lista
    const scroller = $('.app-scroll');
    const fab = $('.fab');
    let last = 0;
    scroller.addEventListener('scroll', () => {
      const y = scroller.scrollTop;
      if (y > last + 4 && y > 80) fab.dataset.compact = '';
      else if (y < last - 4) delete fab.dataset.compact;
      last = y;
    }, { passive: true });

    // Al abrir "Nuevo pedido", enfocar el primer campo útil
    document.addEventListener('le:sheet-open', (e) => {
      if (e.detail.id === 'sheet-new') setTimeout(() => $('#f-direccion').focus({ preventScroll: true }), 350);
    });
  });
})();
