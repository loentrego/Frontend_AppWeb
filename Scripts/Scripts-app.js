// =====================================================================
//  LoEntrego · AppWeb — Núcleo compartido (comercio y repartidor)
//
//  ⚠️ DATOS DE PRUEBA: mientras no exista el backend, los pedidos viven
//  en el navegador (localStorage) y los comparten el panel del comercio y
//  el del repartidor. Al conectar la API, reemplazar `store` por llamadas
//  a los endpoints; el resto de la interfaz no necesita cambiar.
// =====================================================================
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- Catálogos ----------
  // Zonas y tarifas: mismas que publica la web (Frontend_MainWeb)
  const ZONAS = {
    bogota: { nombre: 'Bogotá', tarifa: 10000 },
    funza: { nombre: 'Funza', tarifa: 10000 },
    soacha: { nombre: 'Soacha', tarifa: 10000 },
  };

  // Ciclo de vida del pedido. `paso` = posición en la mini-ruta (0..3)
  const ESTADOS = {
    por_recoger:  { label: 'Por recoger',  paso: 0, tono: 'wait' },
    recogido:     { label: 'Recogido',     paso: 1, tono: 'move' },
    en_camino:    { label: 'En camino',    paso: 2, tono: 'move' },
    entregado:    { label: 'Entregado',    paso: 3, tono: 'ok' },
    no_entregado: { label: 'No entregado', paso: -1, tono: 'fail' },
  };
  const FLUJO = ['por_recoger', 'recogido', 'en_camino', 'entregado'];
  const FINALES = ['entregado', 'no_entregado'];

  const MOTIVOS = {
    no_contesta: 'No contesta',
    direccion: 'Dirección errada',
    rechazado: 'Rechazó el pedido',
    ausente: 'No había nadie',
    otro: 'Otro motivo',
  };

  // ---------- Utilidades ----------
  const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
  const parseMoney = (v) => Number(String(v).replace(/\D/g, '')) || 0;
  const digits = (v) => String(v).replace(/\D/g, '');
  const formatPhone = (v) => {
    const d = digits(v).slice(0, 10);
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');
  };
  const isPhoneCO = (v) => /^3\d{9}$/.test(digits(v)); // celular colombiano
  const initials = (name) => String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const escapeHTML = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
  const mapsUrl = (o) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${o.direccion}, ${ZONAS[o.zona]?.nombre || ''}, Colombia`);

  // ---------- Datos de prueba (compartidos entre roles) ----------
  const KEY = 'loentrego-demo-v2';
  const SEED = [
    { id: 'p1', codigo: 'LOE-0001041', nombre: 'Marcela Ortiz', direccion: 'Calle 116 #19-40, apto 302', zona: 'bogota', telefono: '3127890123', cobro: 32000, notas: 'Dejar con el celador', estado: 'entregado',
      historial: [['por_recoger', '08:05'], ['recogido', '08:40'], ['en_camino', '08:52'], ['entregado', '09:31']] },
    { id: 'p2', codigo: 'LOE-0001042', nombre: 'Andrea Gómez', direccion: 'Calle 72 #10-34', zona: 'bogota', telefono: '3001234567', cobro: 45000, notas: 'Entregar en portería, preguntar por Sr. Gómez', estado: 'en_camino',
      historial: [['por_recoger', '08:12'], ['recogido', '08:40'], ['en_camino', '09:40']] },
    { id: 'p3', codigo: 'LOE-0001043', nombre: 'Julián Ríos', direccion: 'Carrera 15 #8-21, casa 4', zona: 'funza', telefono: '3154567890', cobro: 28000, notas: 'Tocar el timbre de la reja verde', estado: 'recogido',
      historial: [['por_recoger', '08:20'], ['recogido', '08:41']] },
    { id: 'p4', codigo: 'LOE-0001044', nombre: 'Sofía Herrera', direccion: 'Calle 13 #7-45', zona: 'soacha', telefono: '3205558877', cobro: 0, notas: '', estado: 'por_recoger',
      historial: [['por_recoger', '09:05']] },
    { id: 'p5', codigo: 'LOE-0001045', nombre: 'Daniel Castro', direccion: 'Av. Boyacá #63-20', zona: 'bogota', telefono: '3112223344', cobro: 61500, notas: 'Llamar antes de llegar', estado: 'por_recoger',
      historial: [['por_recoger', '09:18']] },
    { id: 'p6', codigo: 'LOE-0001040', nombre: 'Paula Medina', direccion: 'Calle 45 #22-10', zona: 'bogota', telefono: '3019876543', cobro: 19900, notas: '', estado: 'no_entregado', motivo: 'no_contesta',
      historial: [['por_recoger', '07:50'], ['recogido', '08:10'], ['en_camino', '08:15'], ['no_entregado', '08:48']] },
  ];

  // Pedidos guardados con el formato viejo (LE-1042) pasan a 3 letras + 7 números (LOE-0001042)
  const migrarCodigo = (o) => (o && /^LE-\d+$/.test(o.codigo) ? { ...o, codigo: 'LOE-' + o.codigo.slice(3).padStart(7, '0') } : o);

  const store = {
    all() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.some((o) => /^LE-\d+$/.test(o?.codigo))) { const m = list.map(migrarCodigo); localStorage.setItem(KEY, JSON.stringify(m)); return m; }
          return list;
        }
      } catch { /* sin almacenamiento */ }
      return structuredClone(SEED);
    },
    save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* modo privado */ }
      document.dispatchEvent(new CustomEvent('le:orders', { detail: list }));
    },
    get(id) { return this.all().find((o) => o.id === id); },
    add(order) {
      const list = this.all();
      const n = Math.max(1039, ...list.map((o) => parseInt(String(o.codigo).split('-')[1], 10) || 0)) + 1;
      const full = { id: 'p' + Date.now(), codigo: 'LOE-' + String(n).padStart(7, '0'), estado: 'por_recoger', historial: [['por_recoger', now()]], ...order };
      list.unshift(full);
      this.save(list);
      return full;
    },
    setEstado(id, estado, extra = {}) {
      const list = this.all();
      const o = list.find((x) => x.id === id);
      if (!o) return null;
      o.estado = estado;
      o.historial = [...(o.historial || []), [estado, now()]];
      Object.assign(o, extra);
      this.save(list);
      return o;
    },
    remove(id) { this.save(this.all().filter((o) => o.id !== id)); },
    reset() {
      try { localStorage.removeItem('loentrego-demo-extras-v1'); } catch { /* */ } // el admin vuelve a cargar sus pedidos extra
      this.save(structuredClone(SEED));
    },
  };

  // Otra pestaña (p. ej. el repartidor) cambió los pedidos
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) document.dispatchEvent(new CustomEvent('le:orders', { detail: store.all() }));
  });

  // ---------- Piezas de interfaz ----------
  function statusPill(estado) {
    const e = ESTADOS[estado] || ESTADOS.por_recoger;
    return `<span class="status-pill" data-tono="${e.tono}">${e.label}</span>`;
  }

  // Mini-ruta de 4 paradas: por recoger → recogido → en camino → entregado
  function trackHTML(o) {
    const fail = o.estado === 'no_entregado';
    const reached = fail
      ? Math.max(0, ...(o.historial || []).map(([e]) => ESTADOS[e]?.paso ?? 0))
      : ESTADOS[o.estado]?.paso ?? 0;
    const nodes = FLUJO.map((_, i) => {
      let cls = i <= reached ? 'done' : '';
      if (!fail && i === reached && o.estado !== 'entregado') cls += ' current';
      if (fail && i === 3) cls = 'fail';
      return `<span class="track-node ${cls}" style="--i:${i}"></span>`;
    }).join('');
    return `<span class="track" data-estado="${o.estado}" style="--progress:${reached / 3}" aria-hidden="true">
      <span class="track-fill"></span>${nodes}
    </span>`;
  }

  // Línea de tiempo vertical (detalle del pedido)
  function timelineHTML(o) {
    const hist = Object.fromEntries((o.historial || []).map(([e, h]) => [e, h]));
    const steps = o.estado === 'no_entregado'
      ? [...FLUJO.slice(0, 3).filter((e) => hist[e]), 'no_entregado']
      : FLUJO;
    return `<ol class="timeline">${steps.map((e) => {
      const done = Boolean(hist[e]);
      const cls = e === 'no_entregado' ? 'fail' : done ? 'done' : 'todo';
      const extra = e === 'no_entregado' && o.motivo ? ` · ${MOTIVOS[o.motivo] || ''}` : '';
      return `<li class="tl-step ${cls}"><span class="tl-dot" aria-hidden="true"></span>
        <span class="tl-label">${ESTADOS[e].label}${extra}</span>
        <span class="tl-time">${done ? hist[e] : '—'}</span></li>`;
    }).join('')}</ol>`;
  }

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

  // ---------- Hojas inferiores ----------
  let lastFocus = null;
  function openSheet(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    lastFocus = document.activeElement;
    overlay.dataset.state = 'open';
    $('.sheet', overlay)?.focus({ preventScroll: true });
    window.LoEntregoMotion?.sheetOpened(overlay);
    document.dispatchEvent(new CustomEvent('le:sheet-open', { detail: overlay }));
  }
  function closeSheet(overlay) {
    if (!overlay || overlay.dataset.state !== 'open') return;
    overlay.dataset.state = 'closed';
    document.dispatchEvent(new CustomEvent('le:sheet-close', { detail: overlay }));
    lastFocus?.focus?.({ preventScroll: true });
  }
  const closeAllSheets = () => $$('.sheet-overlay[data-state="open"]').forEach(closeSheet);

  // ---------- Acciones por delegación (data-action) ----------
  const actions = {
    'open-sheet': (el) => openSheet(el.dataset.target),
    'close-sheet': (el) => closeSheet(el.closest('.sheet-overlay')),
    'close-sheet-bg': (el, e) => { if (e.target === el) closeSheet(el); },
    'edit-field': () => toast('La edición estará disponible pronto'),
    'download-guide': () => toast('La descarga de guías estará disponible pronto'),
    'reset-demo': () => { store.reset(); toast('Datos de prueba restablecidos'); },
    logout: () => {
      localStorage.removeItem('auth_token');
      window.location.href = '../index.html';
    },
  };
  const on = (name, fn) => { actions[name] = fn; };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = $$('.sheet-overlay[data-state="open"]').pop();
    if (open) closeSheet(open);
  });

  // Carruseles de filtros: el degradado aparece solo del lado donde hay más contenido
  function bindFades(el) {
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.toggleAttribute('data-scrolled', el.scrollLeft > 2);
      el.toggleAttribute('data-end', el.scrollLeft >= max - 2);
    };
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
  document.addEventListener('DOMContentLoaded', () => $$('.filters').forEach(bindFades));

  window.LE = {
    $, $$, ZONAS, ESTADOS, FLUJO, FINALES, MOTIVOS,
    money, parseMoney, digits, formatPhone, isPhoneCO, initials, escapeHTML, now, mapsUrl,
    store, statusPill, trackHTML, timelineHTML, toast, openSheet, closeSheet, closeAllSheets, on,
  };
})();
