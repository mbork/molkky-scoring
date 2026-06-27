/* ── config ──────────────────────────────────────────────────── */

const CACHE = 'molkky-v12';

/* Paths are relative to the worker's location, so this works unchanged
   under the GitHub Pages subpath (/molkky-scoring/). */
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

/* ── install: pre-cache the app shell ────────────────────────── */

self.addEventListener('install', (event) => {
  const precache = async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
  };
  event.waitUntil(precache());
  self.skipWaiting();
});

/* ── activate: drop caches from older versions ───────────────── */

self.addEventListener('activate', (event) => {
  const cleanup = async () => {
    const keys = await caches.keys();
    const stale = keys.filter((key) => key !== CACHE);
    await Promise.all(stale.map((key) => caches.delete(key)));
    await self.clients.claim();
  };
  event.waitUntil(cleanup());
});

/* ── fetch: serve from cache, fall back to network ───────────── */

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const respond = async () => {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    try {
      return await fetch(request);
    } catch (error) {
      const fallback = await caches.match('./');
      if (fallback) {
        return fallback;
      }
      throw error;
    }
  };
  event.respondWith(respond());
});
