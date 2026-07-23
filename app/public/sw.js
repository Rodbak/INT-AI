// INT Till service worker — makes the app shell load offline so the till keeps
// working with no internet. API calls are never cached (the app handles offline
// selling itself via IndexedDB).
const CACHE = 'int-till-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (fonts, API on other host) pass through
  if (url.pathname.startsWith('/api/')) return;     // never cache API

  // Navigations: network-first, fall back to cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/index.html'))),
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((res) => {
        if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached),
    ),
  );
});
