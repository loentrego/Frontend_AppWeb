// ============ TEMA: claro / oscuro / automático ============
// Se carga en <head> (sin defer) para aplicar el tema antes de pintar
// y evitar el destello de tema incorrecto.
(() => {
  'use strict';

  const KEY = 'loentrego-theme';           // 'light' | 'dark' | 'auto'
  const VALID = ['light', 'dark', 'auto'];
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;

  const getPref = () => {
    try {
      const v = localStorage.getItem(KEY);
      return VALID.includes(v) ? v : 'auto';
    } catch { return 'auto'; }
  };

  const resolve = (pref) => (pref === 'auto' ? (media.matches ? 'dark' : 'light') : pref);

  function apply(pref = getPref()) {
    const theme = resolve(pref);
    root.dataset.theme = theme;
    root.dataset.themePref = pref;
    root.style.colorScheme = theme;

    // Color de la barra del navegador / app instalada
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0E0A2E' : '#3422A8';

    // Sincroniza cualquier selector de tema en la página
    document.querySelectorAll('[data-action="set-theme"]').forEach((btn) => {
      btn.setAttribute('aria-checked', String(btn.dataset.themeValue === pref));
    });
  }

  function setTheme(pref) {
    if (!VALID.includes(pref)) return;
    try { localStorage.setItem(KEY, pref); } catch { /* modo privado */ }
    apply(pref);
  }

  // En "auto", reaccionar cuando el sistema cambie de claro a oscuro
  media.addEventListener?.('change', () => { if (getPref() === 'auto') apply('auto'); });

  // Mantener sincronizadas varias pestañas abiertas
  window.addEventListener('storage', (e) => { if (e.key === KEY) apply(); });

  document.addEventListener('DOMContentLoaded', () => apply());
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="set-theme"]');
    if (btn) setTheme(btn.dataset.themeValue);
  });

  window.LoEntregoTheme = { set: setTheme, get: getPref };
  apply();

  // Oculta la app un instante mientras arrancan las animaciones de entrada
  // (Scripts-motion.js quita la clase). Respaldo por si algo falla.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('anim-pending');
    setTimeout(() => root.classList.remove('anim-pending'), 1500);
  }
})();
