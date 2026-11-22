// ============ PANEL DEL COMERCIO ============
// Estado local de demostración. Cuando exista el endpoint de pedidos,
// reemplazar `state.orders` por la respuesta de la API.
(() => {
  'use strict';

  // ---------- Estado ----------
  const state = {
    orders: [
      { id: 'p1', nombre: 'Andrea Gómez', direccion: 'Calle 72 #10-34', ciudad: 'Bogotá', telefono: '300 123 4567', cobro: 45000, notas: 'Entregar en portería, preguntar por Sr. Gómez', estado: 'pendiente' },
      { id: 'p2', nombre: 'Marcela Ortiz', direccion: 'Calle 116 #19-40', ciudad: 'Bogotá', telefono: '312 789 0123', cobro: 32000, notas: 'Dejar con el celador', estado: 'entregado' },
      { id: 'p3', nombre: 'Julián Ríos', direccion: 'Calle 145 #60-30', ciudad: 'Bogotá', telefono: '315 456 7890', cobro: 28000, notas: 'Tocar el timbre del apto 502', estado: 'pendiente' },
    ],
    currentOrderId: null,
    lastFocus: null,
  };

  const ESTADOS = {
    entregado: 'Entregado',
    pendiente: 'No entregado',
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- Utilidades ----------
  const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
  const parseMoney = (str) => Number(String(str).replace(/\D/g, '')) || 0;
  const findOrder = (id) => state.orders.find((o) => o.id === id);

  // ---------- Toast ----------
  function toast(msg, type = 'ok') {
    const region = $('#toast-region');
    if (!region) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.type = type;
    el.textContent = msg;
    region.append(el);
    setTimeout(() => {
      el.dataset.leaving = '';
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 2600);
  }

  // ---------- Render ----------
  function renderStats() {
    const total = state.orders.length;
    const entregado = state.orders.filter((o) => o.estado === 'entregado').length;
    const values = { total, entregado, pendiente: total - entregado };
    $$('[data-stat]').forEach((el) => { el.textContent = values[el.dataset.stat] ?? 0; });
  }

  function orderItemHTML(o) {
    return `
      <li>
        <button type="button" class="order-item" data-action="open-order" data-id="${o.id}" data-status="${o.estado}" aria-haspopup="dialog">
          <span class="order-info">
            <span class="order-name">${escapeHTML(o.nombre)}</span>
            <span class="order-sub">${escapeHTML(o.direccion)} · ${escapeHTML(o.ciudad)}</span>
          </span>
          <span class="order-amount">${money(o.cobro)}</span>
          <span class="order-track">
            <span class="track" aria-hidden="true">
              <span class="track-fill"></span>
              <span class="track-node start"></span>
              <span class="track-node end"></span>
            </span>
            <span class="status-pill" data-status="${o.estado}">${ESTADOS[o.estado]}</span>
          </span>
        </button>
      </li>`;
  }

  function renderOrders(newId) {
    const list = $('#order-list');
    const empty = $('#orders-empty');
    if (!list) return;
    list.innerHTML = state.orders.map(orderItemHTML).join('');
    if (empty) empty.hidden = state.orders.length > 0;
    if (newId) $(`[data-id="${newId}"]`, list)?.setAttribute('data-new', '');
    renderStats();
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Hojas (bottom sheets) ----------
  function openSheet(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    state.lastFocus = document.activeElement;
    overlay.dataset.state = 'open';
    $('.sheet', overlay)?.focus({ preventScroll: true });
    window.LoEntregoMotion?.sheetOpened(overlay);
  }

  function closeSheet(overlay) {
    if (!overlay) return;
    overlay.dataset.state = 'closed';
    const del = $('[data-action="delete-order"]', overlay);
    if (del) resetDelete(del);
    state.lastFocus?.focus?.({ preventScroll: true });
  }

  function openOrder(id) {
    const o = findOrder(id);
    if (!o) return;
    state.currentOrderId = id;
    const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
    set('#od-nombre', o.nombre);
    set('#od-cobro', money(o.cobro));
    set('#od-direccion', o.direccion);
    set('#od-ciudad', o.ciudad);
    set('#od-telefono', o.telefono);
    set('#od-notas', o.notas || 'Sin notas');
    const pill = $('#od-estado');
    if (pill) {
      pill.dataset.status = o.estado;
      pill.textContent = ESTADOS[o.estado];
    }
    openSheet('sheet-order');
  }

  // ---------- Eliminar (doble toque para confirmar) ----------
  function resetDelete(btn) {
    delete btn.dataset.confirm;
    btn.textContent = 'Eliminar pedido';
  }

  function deleteOrder(btn) {
    if (!('confirm' in btn.dataset)) {
      btn.dataset.confirm = '';
      btn.textContent = 'Toca de nuevo para confirmar';
      setTimeout(() => resetDelete(btn), 3000);
      return;
    }
    state.orders = state.orders.filter((o) => o.id !== state.currentOrderId);
    closeSheet(document.getElementById('sheet-order'));
    renderOrders();
    toast('Pedido eliminado');
  }

  // ---------- Formulario ----------
  const RULES = {
    direccion: (v) => v.length >= 5 || 'Escribe la dirección completa',
    ciudad: (v) => v.length >= 3 || 'Indica la ciudad',
    nombre: (v) => v.length >= 3 || 'Escribe el nombre de quien recibe',
    telefono: (v) => v.replace(/\D/g, '').length >= 7 || 'Revisa el número de contacto',
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

  function handleCreate(form) {
    const inputs = $$('.field-input', form);
    const invalid = inputs.filter((i) => !validateField(i));
    if (invalid.length) {
      invalid[0].focus();
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      toast('Revisa los campos marcados', 'error');
      return;
    }

    const btn = $('#order-submit');
    const label = btn && $('.btn-text', btn);
    btn?.setAttribute('aria-busy', 'true');
    if (label) label.textContent = 'Creando…';

    const data = Object.fromEntries(new FormData(form));
    const order = {
      id: 'p' + Date.now(),
      nombre: data.nombre.trim(),
      direccion: data.direccion.trim(),
      ciudad: data.ciudad.trim(),
      telefono: data.telefono.trim(),
      cobro: parseMoney(data.cobro),
      notas: data.notas.trim(),
      estado: 'pendiente',
    };

    // Simula la latencia de la API para dar feedback de carga.
    setTimeout(() => {
      state.orders.unshift(order);
      renderOrders(order.id);
      window.LoEntregoMotion?.orderAdded(order.id);
      form.reset();
      $('#f-ciudad').value = 'Bogotá';
      btn?.removeAttribute('aria-busy');
      if (label) label.textContent = 'Crear pedido';
      toast('Pedido creado para ' + order.nombre.split(' ')[0]);
      const scroller = $('.app-scroll');
      const orders = $('.orders');
      if (scroller && orders) scroller.scrollTo({ top: orders.offsetTop - scroller.offsetTop - 8, behavior: 'smooth' });
    }, 500);
  }

  // ---------- Acciones (delegación) ----------
  const actions = {
    'open-sheet': (el) => openSheet(el.dataset.target),
    'close-sheet': (el) => closeSheet(el.closest('.sheet-overlay')),
    'close-sheet-bg': (el, e) => { if (e.target === el) closeSheet(el); },
    'open-order': (el) => openOrder(el.dataset.id),
    'edit-field': () => toast('La edición estará disponible pronto'),
    'download-guide': () => toast('La descarga de guías estará disponible pronto'),
    'delete-order': (el) => deleteOrder(el),
    logout: () => {
      localStorage.removeItem('auth_token');
      window.location.href = '../index.html';
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el, e);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = $('.sheet-overlay[data-state="open"]');
    if (open) closeSheet(open);
  });

  // ---------- Inicio ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderOrders();

    const form = $('#order-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleCreate(form);
    });

    form.addEventListener('focusout', (e) => {
      if (e.target.matches('.field-input') && e.target.value) validateField(e.target);
    });
    form.addEventListener('input', (e) => {
      const input = e.target;
      if (input.dataset.format === 'money') {
        const n = parseMoney(input.value);
        input.value = n ? money(n) : '';
      }
      if (input.closest('.field')?.dataset.state === 'error') validateField(input);
    });
  });
})();
