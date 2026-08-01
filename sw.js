/* =====================================================================
   Alex Launcher — Service Worker
   Caches the app shell (HTML/CSS/JS/icons) so the launcher opens
   instantly and works offline. Firebase/network requests are always
   passed straight through (never cached) so auth & data stay fresh.
   Bump CACHE_VERSION whenever you change any cached file so returning
   users automatically pick up the new version.
   ===================================================================== */
const CACHE_VERSION = 'alex-launcher-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/firebase-config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin requests (Firebase Auth/Firestore, Google Fonts, etc.)
  // — always go to the network so login/cloud sync stay live.
  if (url.origin !== self.location.origin) {
    return;
  }

  // App shell: cache-first, falling back to network, and updating the cache in the background.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline: fall back to whatever's cached

      return cached || networkFetch;
    })
  );
});
