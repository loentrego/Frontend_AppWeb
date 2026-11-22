// ============ SERVICE WORKER · LoEntrego AppWeb ============
// Estrategias:
//  · Páginas (HTML): red primero → caché si no hay conexión.
//  · CSS/JS/imágenes/fuentes: caché primero y se actualiza en segundo plano.
//  · API (app.loentrego.com/api) y peticiones que no son GET: nunca se cachean.
//
// Al cambiar archivos importantes, sube CACHE_VERSION para limpiar la caché vieja.
const CACHE_VERSION = 'v5';
const CACHE = `loentrego-app-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './Pages/Pages-stores.html',
  './Styles/Styles-base.css',
  './Styles/Styles-index.css',
  './Styles/Styles-stores.css',
  './Scripts/Scripts-theme.js',
  './Scripts/Scripts-index.js',
  './Scripts/Scripts-stores.js',
  './Scripts/Scripts-pwa.js',
  './Scripts/Scripts-motion.js',
  './libs/gsap/gsap.min.js',
  './libs/gsap/ScrollTrigger.min.js',
  './libs/gsap/SplitText.min.js',
  './libs/gsap/DrawSVGPlugin.min.js',
  './libs/gsap/MotionPathPlugin.min.js',
  './img/LoEntrego2026-wordmark.png',
  './img/isotipo.png',
  './img/Minilogo-transparencia.png',
  './img/Minilogo-loentrego-2026.png',
  './img/icons/icon-192.png',
  './img/icons/icon-512.png',
  './manifest.webmanifest',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('loentrego-app-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return; // API y terceros: directo a la red

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request, { ignoreSearch: true }))
        || (await cache.match('./index.html'))
        || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  // La versión (?v=) forma parte de la clave: al subirla, se descarga lo nuevo.
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

// Permite que la página pida activar una versión nueva al instante
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
