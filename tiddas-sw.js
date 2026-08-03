const CACHE_NAME = 'tiddas-v74-offline';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(['./', './index.html']);
    } catch (_) {
      try { await cache.add('./'); } catch (__) {}
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Back4App et reseau : on laisse passer

  // Navigation : reseau d'abord, cache en secours (c'est ce qui fait marcher F5 hors ligne)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./', fresh.clone());
        return fresh;
      } catch (_) {
        const cache = await caches.open(CACHE);
        return (await cache.match('./')) || (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Autres ressources de meme origine : cache d'abord
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') cache.put(req, fresh.clone());
      return fresh;
    } catch (_) {
      return hit || Response.error();
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
