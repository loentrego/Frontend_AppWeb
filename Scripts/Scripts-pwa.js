// ============ PWA: registro del Service Worker ============
// Funciona desde cualquier carpeta: calcula la ruta de sw.js a partir
// de la ubicación de este script (Scripts/ → raíz del proyecto).
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  const script = document.currentScript;
  const swUrl = new URL('../sw.js', script ? script.src : location.href);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl.href)
      .catch((err) => console.warn('No se pudo registrar el Service Worker:', err));
  });
})();
