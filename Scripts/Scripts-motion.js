// =====================================================================
//  LoEntrego · AppWeb — Animaciones (GSAP)
//  Requiere, antes de este archivo: libs/gsap/gsap.min.js, ScrollTrigger,
//  SplitText, DrawSVGPlugin y MotionPathPlugin.
//
//  Idea: "Cada entrega, en movimiento". La ruta punteada se dibuja y un
//  paquete lima la recorre; la interfaz entra en cascada y los pedidos
//  "avanzan" por su mini-ruta. Solo se anima transform y opacity.
// =====================================================================
(() => {
  'use strict';
  const root = document.documentElement;
  const reveal = () => root.classList.remove('anim-pending');

  // Si GSAP no cargó, la app se muestra normal, sin animaciones.
  if (!window.gsap) { reveal(); return; }

  gsap.registerPlugin(
    ...[window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin, window.MotionPathPlugin].filter(Boolean)
  );

  // ------------------------------------------------------------------
  //  PERILLAS — ajusta aquí la sensación sin tocar el resto del código
  // ------------------------------------------------------------------
  const K = {
    ease: 'power4.out',       // curva de entrada (power3.out = más suave)
    entrada: 0.85,            // duración de las entradas (s)
    stagger: 0.06,            // separación entre elementos en cascada (s)
    trazoRuta: 1.5,           // cuánto tarda en dibujarse la ruta (s)
    viajeCometa: 2.8,         // cuánto tarda el cometa de luz en recorrer la ruta (s)
    largoCometa: 16,          // largo de la estela del cometa (% de la ruta)
    pausaCometa: 2.2,         // pausa entre un cometa y el siguiente (s)
    ondas: 1.6,               // duración de las ondas al llegar al destino (s)
    saltoCaja: 7,             // cada cuántos segundos "salta" la caja del encabezado
    contadores: 1.2,          // duración de los números que suben (s)
    llenadoRuta: 1.1,         // duración del llenado de las mini-rutas (s)
    salida: 0.55,             // transición al salir del login (s)
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fontsReady = () => Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((res) => setTimeout(res, 700)),
  ]);

  // Durante la entrada se apagan las transiciones CSS (chocan con GSAP
  // cuando lee los valores finales); se reactivan al terminar.
  function lock(tl) {
    root.classList.add('is-animating');
    const release = () => root.classList.remove('is-animating');
    tl.eventCallback('onComplete', release);
    setTimeout(release, (tl.duration() + 0.5) * 1000); // seguridad
    return tl;
  }

  // ------------------------------------------------------------------
  //  Ruta: se dibuja y el paquete la recorre en bucle
  // ------------------------------------------------------------------
  // Qué fracción de la ruta está más cerca de un punto (para sincronizar las ondas)
  function fractionAt(path, x, y) {
    const len = path.getTotalLength();
    let best = 0, bestD = Infinity;
    for (let i = 0; i <= 200; i++) {
      const p = path.getPointAtLength((len * i) / 200);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = i / 200; }
    }
    return best;
  }

  function routeIntro(svg, tl, at = 0) {
    if (!svg) return;
    const mask = $('.route-mask', svg);
    const path = $('.route-line', svg);
    const pins = $$('.route-stop, .route-dot', svg);
    const grid = $('.route-grid', svg);
    const comet = $$('.route-comet, .route-comet-glow', svg);
    const ripples = $$('.ripple', svg);
    const dot = $('.route-dot', svg);

    // Cuadrícula de "mapa": aparece y deriva muy despacio
    if (grid) {
      tl.from(grid, { autoAlpha: 0, duration: 1.4, ease: 'power2.out' }, at);
      gsap.to($('rect', grid), { x: 22, y: -22, duration: 18, ease: 'none', repeat: -1 });
    }
    if (mask && window.DrawSVGPlugin) {
      tl.from(mask, { drawSVG: '0%', duration: K.trazoRuta, ease: 'power2.inOut' }, at);
    }
    if (pins.length) {
      tl.from(pins, {
        scale: 0, transformOrigin: '50% 50%',
        duration: 0.55, stagger: 0.18, ease: 'back.out(3)',
      }, at + K.trazoRuta * 0.55);
    }

    // Cometa de luz: un tramo lima recorre la línea y, al pasar por el
    // destino, el punto late y suelta ondas expansivas.
    if (comet.length && path && window.DrawSVGPlugin) {
      const L = K.largoCometa / 100;
      const f = dot ? fractionAt(path, +dot.getAttribute('cx'), +dot.getAttribute('cy')) : 0.7;
      const hit = 0.35 + K.viajeCometa * Math.max(0, f - L) / (1 - L); // segundo en que la cabeza llega al destino

      gsap.set(comet, { drawSVG: '0% 0%' });
      gsap.set($('.route-comet', svg), { opacity: 1 });
      gsap.set($('.route-comet-glow', svg), { opacity: 0.2 });   // halo tenue (perilla)
      const loop = gsap.timeline({ repeat: -1, repeatDelay: K.pausaCometa, delay: at + K.trazoRuta * 0.85 });
      loop
        .fromTo(comet, { drawSVG: '0% 0%' }, { drawSVG: '0% ' + (L * 100) + '%', duration: 0.35, ease: 'none' })
        .to(comet, { drawSVG: (100 - L * 100) + '% 100%', duration: K.viajeCometa, ease: 'none' })
        .to(comet, { drawSVG: '100% 100%', duration: 0.35, ease: 'none' });

      if (ripples.length) {
        loop.fromTo(ripples,
          { scale: 1, opacity: 0.8, transformOrigin: '50% 50%' },
          { scale: 6, opacity: 0, duration: K.ondas, ease: 'power2.out', stagger: 0.22 }, hit);
      }
      if (dot) {
        loop.fromTo(dot, { scale: 1, transformOrigin: '50% 50%' },
          { scale: 1.7, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 }, hit);
      }

      // No gastar batería si la pestaña no está visible
      document.addEventListener('visibilitychange', () => (document.hidden ? loop.pause() : loop.resume()));
    }
  }

  // Caja del encabezado: un saltito con "aplaste" al caer
  function boxHop(el) {
    if (!el) return;
    return gsap.timeline()
      .to(el, { y: -9, scaleY: 1.06, scaleX: 0.95, duration: 0.22, ease: 'power2.out', transformOrigin: '50% 100%' })
      .to(el, { y: 0, scaleY: 1, scaleX: 1, duration: 0.5, ease: 'bounce.out' })
      .to(el, { scaleY: 0.9, scaleX: 1.08, duration: 0.08, ease: 'power1.out' }, '-=0.42')
      .to(el, { scaleY: 1, scaleX: 1, duration: 0.25, ease: 'back.out(3)' }, '-=0.34');
  }

  // ------------------------------------------------------------------
  //  LOGIN
  // ------------------------------------------------------------------
  function loginIntro() {
    const tl = gsap.timeline({ defaults: { ease: K.ease, duration: K.entrada } });
    const h1 = $('.login-copy h1');
    let words = [h1];
    if (h1 && window.SplitText) {
      const split = SplitText.create(h1, { type: 'words,lines', mask: 'lines', aria: 'auto' });
      words = split.words;
    }

    tl.from('.login-logo', { y: 18, autoAlpha: 0, duration: 0.7 }, 0.05)
      .from(words, { yPercent: 115, duration: 0.9, stagger: K.stagger }, 0.2)
      .from('.login-panel', { yPercent: 18, autoAlpha: 0, duration: 1 }, 0.3)
      .from(['.login-panel-head', ...$$('.login-form .field'), '.login-form .btn', '.login-foot'],
        { y: 20, autoAlpha: 0, stagger: K.stagger }, 0.55);

    routeIntro($('.login-hero .route-art'), tl, 0.1);
    return lock(tl);
  }

  // Transición de salida del login antes de ir al panel
  function leave() {
    return new Promise((resolve) => {
      gsap.timeline({ defaults: { ease: 'power3.in', duration: K.salida }, onComplete: resolve })
        .to('.login-panel', { yPercent: 12, autoAlpha: 0 }, 0)
        .to(['.login-copy', '.login-logo'], { y: -24, autoAlpha: 0, stagger: 0.05 }, 0.05)
        .to('.login-hero .route-art', { scale: 1.08, autoAlpha: 0.4, transformOrigin: '80% 50%' }, 0);
      setTimeout(resolve, K.salida * 1000 + 400); // seguridad
    });
  }

  // ------------------------------------------------------------------
  //  PANEL DEL COMERCIO
  // ------------------------------------------------------------------
  const scroller = () => $('.app-scroll');

  function countUp(els) {
    els.forEach((el) => {
      const target = parseInt(el.textContent, 10) || 0;
      const o = { v: 0 };
      gsap.to(o, {
        v: target, duration: K.contadores, ease: 'power2.out', delay: 0.35,
        onUpdate: () => { el.textContent = Math.round(o.v); },
      });
    });
  }

  function animateOrders(items, delay = 0) {
    if (!items.length) return;
    gsap.fromTo(items,
      { y: 22, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', stagger: K.stagger, delay, overwrite: true, clearProps: 'transform' });
    gsap.from(items.map((i) => $('.track-fill', i)).filter(Boolean), {
      scaleX: 0, transformOrigin: 'left center', duration: K.llenadoRuta, ease: 'power3.inOut',
      stagger: K.stagger, delay: delay + 0.2,
    });
    gsap.from(items.map((i) => $('.track-node.end', i)).filter(Boolean), {
      scale: 0, duration: 0.5, ease: 'back.out(3)', stagger: K.stagger, delay: delay + 0.2 + K.llenadoRuta * 0.85,
    });
  }

  function appIntro() {
    const tl = gsap.timeline({ defaults: { ease: K.ease, duration: K.entrada } });

    tl.from('.app-header .brand-mark', { y: -46, rotation: -18, autoAlpha: 0, duration: 1, ease: 'bounce.out', transformOrigin: '50% 100%' }, 0)
      .from(['.app-header .eyebrow', '.app-header .app-title'], { y: 12, autoAlpha: 0, stagger: 0.06 }, 0.08)
      .from('.avatar-btn', { scale: 0, autoAlpha: 0, duration: 0.6, ease: 'back.out(2.5)' }, 0.2)
      .from(['.stat-total', '.stat-split'], { y: 28, scale: 0.96, autoAlpha: 0, stagger: 0.1 }, 0.2)
      .from('.app-panel', { y: 70, autoAlpha: 0, duration: 1 }, 0.3)
      .from('.app-panel .card', { y: 30, autoAlpha: 0 }, 0.45)
      .from('.orders .section-head', { y: 16, autoAlpha: 0 }, 0.6);

    routeIntro($('.app-hero .route-art'), tl, 0.15);
    lock(tl);
    // Saltito periódico de la caja (se pausa con la pestaña oculta)
    const mark = $('.app-header .brand-mark');
    const hop = gsap.delayedCall(K.saltoCaja, () => { boxHop(mark); hop.restart(true); });
    document.addEventListener('visibilitychange', () => (document.hidden ? hop.pause() : hop.resume()));
    countUp($$('.stats [data-stat]'));

    // Pedidos: los visibles entran ya; los de abajo, al hacer scroll
    const items = $$('.order-item');
    if (window.ScrollTrigger && scroller()) {
      gsap.set(items, { autoAlpha: 0, y: 22 });
      ScrollTrigger.batch(items, {
        scroller: scroller(),
        start: 'top 95%',
        once: true,
        onEnter: (batch) => animateOrders(batch),
      });

      // Parallax suave: la ruta del encabezado se queda atrás al bajar
      gsap.to('.app-hero .route-art', {
        yPercent: 30, ease: 'none',
        scrollTrigger: { scroller: scroller(), trigger: '.app-hero', start: 'top top', end: 'bottom top', scrub: true },
      });
      gsap.fromTo('.stats', { scale: 1, opacity: 1 }, {
        scale: 0.96, opacity: 0.65, transformOrigin: '50% 0%', ease: 'none', immediateRender: false,
        scrollTrigger: { scroller: scroller(), trigger: '.app-hero', start: 'top top', end: 'bottom top', scrub: true },
      });
    } else {
      animateOrders(items, 0.6);
    }
    return tl;
  }

  // Un pedido recién creado entra con rebote y el total "late"
  function orderAdded(id) {
    const item = $(`.order-item[data-id="${id}"]`);
    if (!item) return;
    item.removeAttribute('data-new');
    gsap.fromTo(item,
      { y: -18, scale: 0.96, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.8, ease: 'back.out(1.8)', clearProps: 'transform' });
    gsap.from($('.track-fill', item), { scaleX: 0, transformOrigin: 'left center', duration: K.llenadoRuta, ease: 'power3.inOut', delay: 0.25 });
    boxHop($('.app-header .brand-mark'));
    gsap.fromTo('.stat-total', { scale: 1.07 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)' });
    gsap.fromTo('.stat-total .stat-value', { yPercent: -30, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
  }

  // Cascada del contenido al abrir una hoja inferior
  function sheetOpened(overlay) {
    const parts = $$('.order-detail-head, .account-header, .detail-row, .pdf-card, .settings-group, .sheet-action', overlay);
    gsap.fromTo(parts,
      { y: 18, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', stagger: 0.04, delay: 0.1, overwrite: true, clearProps: 'transform' });
  }

  // ------------------------------------------------------------------
  //  Arranque (con versión sin movimiento si el sistema lo pide)
  // ------------------------------------------------------------------
  const noop = () => Promise.resolve();
  window.LoEntregoMotion = { leave: noop, orderAdded: () => {}, sheetOpened: () => {} };

  const start = async () => {
    // Movimiento reducido (accesibilidad): todo visible, sin animar
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { reveal(); return; }
    window.LoEntregoMotion = { leave, orderAdded, sheetOpened };

    await fontsReady();
    try {
      if ($('.login')) loginIntro();
      if ($('.app')) appIntro();
    } finally {
      reveal();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
