/**
 * Guia Mão de Obra — service worker.
 *
 * Strategy
 *   - App shell precached → instant start and offline browsing of the UI.
 *   - Navigations: network-first (3 s timeout) → cached page → cached index.
 *   - Same-origin static files: stale-while-revalidate.
 *   - Firebase SDK from gstatic (versioned URLs): cache-first.
 *   - APIs (Firestore, Auth, Storage, Functions, Mercado Pago): never cached.
 *
 * Bump VERSION on every deploy that changes shell files.
 */
const VERSION = 'gmo-v3';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  '/',
  '/index.html',
  '/signup.html',
  '/css/app.css',
  '/js/app.js',
  '/js/firebase-config.js',
  '/manifest.webmanifest',
  '/assets/icon.svg',
  '/assets/icon-192.png',
  '/assets/apple-touch-icon.png',
];

const NEVER_CACHE = [
  /googleapis\.com/, /firebaseio\.com/, /cloudfunctions\.net/, /run\.app/,
  /mercadopago\.com/, /mercadolibre\.com/, /mlstatic\.com/, /\/api\//, /__\//,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await Promise.race([fetch(request), timeout(3000)]);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await caches.match(request, { ignoreSearch: true }))
      || (await caches.match('/index.html'))
      || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => cached);
  return cached || network;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(RUNTIME)).put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (NEVER_CACHE.some((rx) => rx.test(url.href))) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(cacheFirst(request));
  }
});
