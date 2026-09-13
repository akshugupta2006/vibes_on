const CACHE = 'vibe-on-v4';
const STATIC = [
  '/', '/css/main.css',
  '/js/api.js', '/js/app.js', '/js/player.js',
  '/js/home.js', '/js/search.js', '/js/library.js', '/js/nowplaying.js',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Never cache API calls or audio streams
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Network-first for HTML (always fresh app shell)
      if (e.request.mode === 'navigate') {
        return fetch(e.request).catch(() => cached);
      }
      // Cache-first for static assets
      return cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
