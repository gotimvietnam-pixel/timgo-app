const CACHE_NAME = 'timgo-v3.1';
const OFFLINE_URL = '/';

// Pre-cache essential assets on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon-512.png',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Clean old caches on activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy: network-first for HTML/JS/CSS, cache-first for fonts/tiles
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Skip: API calls (Nominatim, OSRM, Supabase, Google Maps)
  if (url.hostname.includes('nominatim') || url.hostname.includes('osrm') ||
      url.hostname.includes('supabase') || url.hostname.includes('openstreetmap') || url.hostname.includes('google.com')) return;

  // Cache-first for Google Fonts & Leaflet CDN (rarely changes)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('unpkg.com')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for app assets (HTML, JS, CSS) — always get fresh, fallback to cache
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match(OFFLINE_URL)))
  );
});
