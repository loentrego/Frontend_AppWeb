// =====================================================================
//  LoEntrego · AppWeb — Animaciones (GSAP)
//  Requiere, antes de este archivo: libs/gsap/gsap.min.js, ScrollTrigger,
//  SplitText y DrawSVGPlugin.
//
//  Idea: "Cada entrega, en movimiento". En el login, una red de calles con
//  cometas lima (animada en CSS) aparece en la esquina, lejos del texto.
//  Pensado para uso diario: la entrada completa solo se ve la primera vez
//  de cada sesión, y los bucles se detienen tras unas pocas repeticiones.
//  Solo se anima transform y opacity.
// =====================================================================
(() => {
  'use strict';
  const root = document.documentElement;
  const reveal = () => root.classList.remove('anim-pending');

  // Si GSAP no cargó, la app se muestra normal, sin animaciones.
  if (!window.gsap) { reveal(); return; }
  gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin].filter(Boolean));

  // ------------------------------------------------------------------
  //  PERILLAS — ajusta aquí la sensación sin tocar el resto del código
  // ------------------------------------------------------------------
  const K = {
    ease: 'power4.out',   // curva de entrada (power3.out = más suave)
    entrada: 0.85,        // duración de las entradas (s)
    stagger: 0.06,        // separación entre elementos en cascada (s)
    saltosCaja: 3,        // saltitos de la caja del encabezado antes de quedarse quieta
    cadaSalto: 8,         // cada cuántos segundos salta (s)
    contadores: 1.1,      // duración de los números que suben (s)
    llenadoRuta: 1,       // duración del llenado de las mini-rutas (s)
    salida: 0.55,         // transición al salir del login (s)
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fontsReady = () => Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((res) => setTimeout(res, 700)),
  ]);

  // ¿Primera vez en esta sesión que se abre esta pantalla?
  function firstVisit(page) {
    const key = 'le-intro:' + page;
    try {
      if (sessionStorage.getItem(key)) return false;
      sessionStorage.setItem(key, '1');
    } catch { /* sin almacenamiento: siempre completa */ }
    return true;
  }

  // Las transiciones CSS chocan con GSAP cuando lee los valores finales:
  // se apagan durante la entrada y se reactivan al terminar.
  function lock(tl) {
    root.classList.add('is-animating');
    const release = () => root.classList.remove('is-animating');
    tl.eventCallback('onComplete', release);
    setTimeout(release, (tl.duration() + 0.5) * 1000);
    return tl;
  }

  // Bucles largos se pausan si la pestaña no está visible
  const pausable = [];
  document.addEventListener('visibilitychange', () => pausable.forEach((t) => (document.hidden ? t.pause() : t.resume())));

  // ------------------------------------------------------------------
  //  LOGIN
  // ------------------------------------------------------------------
  function loginIntro(full) {
    const tl = gsap.timeline({ defaults: { ease: K.ease, duration: K.entrada } });
    const h1 = $('.login-copy h1');
    let words = [h1];
    if (h1 && window.SplitText) words = SplitText.create(h1, { type: 'words,lines', mask: 'lines', aria: 'auto' }).words;

    if (full) {
      tl.from('.login-logo', { y: 18, autoAlpha: 0, duration: 0.7 }, 0.05)
        .from(words, { yPercent: 115, duration: 0.9, stagger: K.stagger }, 0.2)
        .from('.login-panel', { yPercent: 18, autoAlpha: 0, duration: 1 }, 0.3)
        .from(['.login-panel-head', ...$$('.login-form .field'), '.login-form .btn', '.login-foot'],
          { y: 20, autoAlpha: 0, stagger: K.stagger }, 0.55);
    } else {
      tl.from(words, { yPercent: 115, duration: 0.7, stagger: 0.04 }, 0)
        .from('.login-panel', { y: 24, autoAlpha: 0, duration: 0.5 }, 0);
    }
    tl.from('.login-hero .city-art', { autoAlpha: 0, duration: 1.2, ease: 'power2.out' }, full ? 0.2 : 0);
    return lock(tl);
  }

  function leave() {
    return new Promise((resolve) => {
      gsap.timeline({ defaults: { ease: 'power3.in', duration: K.salida }, onComplete: resolve })
        .to('.login-panel', { yPercent: 12, autoAlpha: 0 }, 0)
        .to(['.login-copy', '.login-logo'], { y: -24, autoAlpha: 0, stagger: 0.05 }, 0.05)
        .to('.login-hero .city-art', { autoAlpha: 0 }, 0);
      setTimeout(resolve, K.salida * 1000 + 400);
    });
  }

  // ------------------------------------------------------------------
  //  PANELES (comercio y repartidor)
  // ------------------------------------------------------------------
  const scroller = () => $('.app-scroll');

  function boxHop(el) {
    if (!el) return gsap.timeline();
    return gsap.timeline()
      .to(el, { y: -9, scaleY: 1.06, scaleX: 0.95, duration: 0.22, ease: 'power2.out', transformOrigin: '50% 100%' })
      .to(el, { y: 0, scaleY: 1, scaleX: 1, duration: 0.5, ease: 'bounce.out' })
      .to(el, { scaleY: 0.9, scaleX: 1.08, duration: 0.08, ease: 'power1.out' }, '-=0.42')
      .to(el, { scaleY: 1, scaleX: 1, duration: 0.25, ease: 'back.out(3)' }, '-=0.34');
  }

  function countUp(els, delay = 0.35) {
    els.forEach((el) => {
      const raw = el.textContent;
      const target = parseInt(raw.replace(/\D/g, ''), 10) || 0;
      const fmt = raw.trim().startsWith('$') ? (v) => '$' + Math.round(v).toLocaleString('es-CO') : (v) => Math.round(v);
      const o = { v: 0 };
      gsap.to(o, { v: target, duration: K.contadores, ease: 'power2.out', delay, onUpdate: () => { el.textContent = fmt(o.v); } });
    });
  }

  function fillTracks(items, delay = 0) {
    const fills = items.map((i) => $('.track-fill', i)).filter(Boolean);
    const nodes = items.flatMap((i) => $$('.track-node', i));
    if (fills.length) gsap.from(fills, { scaleX: 0, duration: K.llenadoRuta, ease: 'power3.inOut', stagger: K.stagger, delay: delay + 0.15 });
    if (nodes.length) gsap.from(nodes, { scale: 0, duration: 0.4, ease: 'back.out(3)', stagger: 0.03, delay });
  }

  function animateItems(items, delay = 0) {
    if (!items.length) return;
    gsap.fromTo(items, { y: 22, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', stagger: K.stagger, delay, overwrite: true, clearProps: 'transform' });
    fillTracks(items, delay);
  }

  function appIntro(full) {
    const tl = gsap.timeline({ defaults: { ease: K.ease, duration: K.entrada } });
    const mark = $('.app-header .brand-mark');

    if (full) {
      tl.from(mark, { y: -46, rotation: -18, autoAlpha: 0, duration: 1, ease: 'bounce.out', transformOrigin: '50% 100%' }, 0)
        .from(['.app-header .eyebrow', '.app-header .app-title'], { y: 12, autoAlpha: 0, stagger: 0.06 }, 0.08)
        .from('.avatar-btn', { scale: 0, autoAlpha: 0, duration: 0.6, ease: 'back.out(2.5)' }, 0.2)
        .from($$('.app-hero > :not(.app-header)'), { y: 28, scale: 0.97, autoAlpha: 0, stagger: 0.1 }, 0.2)
        .from('.app-panel', { y: 70, autoAlpha: 0, duration: 1 }, 0.3);
      const blocks = $$('.app-panel .section-head, .app-panel .filters, .next-card');
      if (blocks.length) tl.from(blocks, { y: 20, autoAlpha: 0, stagger: 0.08 }, 0.45);
      if ($('.fab')) tl.from('.fab', { scale: 0, rotation: -90, autoAlpha: 0, duration: 0.7, ease: 'back.out(2)' }, 0.8);
      countUp($$('.app-hero [data-stat], .app-hero [data-money]'));
    } else {
      tl.from('.app-panel', { y: 18, autoAlpha: 0, duration: 0.4, ease: 'power3.out' }, 0);
    }
    lock(tl);

    // Saltitos de la caja del encabezado (pocos, para no cansar)
    if (full && mark) {
      const hops = gsap.timeline({ repeat: K.saltosCaja - 1, repeatDelay: K.cadaSalto, delay: K.cadaSalto });
      hops.add(boxHop(mark));
      pausable.push(hops);
    }

    // Elementos de lista: los visibles entran ya; los de abajo, al hacer scroll
    const items = $$('.order-item, .stop-item');
    if (window.ScrollTrigger && scroller()) {
      gsap.set(items, { autoAlpha: 0, y: 22 });
      ScrollTrigger.batch(items, { scroller: scroller(), start: 'top 96%', once: true, onEnter: (b) => animateItems(b, full ? 0.5 : 0) });
    } else {
      animateItems(items, 0.3);
    }
    return tl;
  }

  // ---------- Reacciones ----------
  function orderAdded(id) {
    const all = $$('.order-item');
    const item = $(`.order-item[data-id="${id}"]`);
    gsap.set(all.filter((i) => i !== item), { autoAlpha: 1, y: 0 });
    if (!item) return;
    gsap.fromTo(item, { y: -18, scale: 0.96, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.8, ease: 'back.out(1.8)', clearProps: 'transform', delay: 0.2 });
    fillTracks([item], 0.35);
    boxHop($('.app-header .brand-mark'));
    gsap.fromTo('.stat-total', { scale: 1.07 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)', clearProps: 'transform' });
  }

  function listChanged(items) {
    if (!items.length) return;
    gsap.fromTo(items, { y: 10, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out', stagger: 0.04, overwrite: true, clearProps: 'transform' });
    fillTracks(items, 0.05);
  }

  function sheetOpened(overlay) {
    const parts = $$('.ticket, .job-where, .quick-actions, .swipe, .fail-btn, .account-header, .sheet-title, .sheet-sub, .sheet-section-label, .detail-list, .pdf-card, .settings-group, .sheet-action, .order-form > *, .reason-list > *', overlay);
    if (!parts.length) return;
    gsap.fromTo(parts, { y: 16, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out', stagger: 0.035, delay: 0.08, overwrite: true, clearProps: 'transform' });
  }

  // Repartidor: entrega confirmada → check que se dibuja y estallido lima
  function celebrate(layer) {
    if (!layer) return Promise.resolve();
    return new Promise((resolve) => {
      const ring = $('.done-ring', layer);
      const check = $('.done-check', layer);
      const bits = $$('.done-bit', layer);
      const msg = $('.done-msg', layer);
      const tl = gsap.timeline({ onComplete: resolve })
        .set(layer, { autoAlpha: 1 })
        .fromTo($('.done-badge', layer), { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(2)' });
      if (window.DrawSVGPlugin) {
        tl.fromTo(ring, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5, ease: 'power2.inOut' }, 0.05)
          .fromTo(check, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.35, ease: 'power3.out' }, 0.4);
      }
      tl.fromTo(bits, { x: 0, y: 0, scale: 0, autoAlpha: 1 }, {
          x: (i) => Math.cos((i / bits.length) * Math.PI * 2) * 95,
          y: (i) => Math.sin((i / bits.length) * Math.PI * 2) * 95,
          scale: 1, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.01,
        }, 0.45)
        .fromTo(msg, { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: 'power3.out' }, 0.55)
        .to(layer, { autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, '+=0.7');
      setTimeout(resolve, 3200); // seguridad
    });
  }

  // Repartidor: la tarjeta de "siguiente parada" cambia
  function nextChanged(card) {
    if (!card) return;
    gsap.fromTo(card, { x: 40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', clearProps: 'transform' });
  }

  // ------------------------------------------------------------------
  //  Arranque (sin movimiento si el sistema lo pide)
  // ------------------------------------------------------------------
  const noop = () => {};
  window.LoEntregoMotion = {
    leave: () => Promise.resolve(), orderAdded: noop, listChanged: noop, sheetOpened: noop,
    celebrate: () => Promise.resolve(), nextChanged: noop, countUp: noop,
  };

  const start = async () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { reveal(); return; }
    window.LoEntregoMotion = { leave, orderAdded, listChanged, sheetOpened, celebrate, nextChanged, countUp };
    await fontsReady();
    try {
      const page = $('.login') ? 'login' : ($('.app')?.dataset.role || 'app');
      const full = firstVisit(page);
      if ($('.login')) loginIntro(full);
      if ($('.app')) appIntro(full);
    } finally {
      reveal();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
