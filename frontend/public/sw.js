// CabinBridge service worker
//
// Network-first for the app shell and code: a cached development build must
// never be able to pin an old UI. The previous cache-first worker cached Vite
// modules, so refreshing kept serving stale code even after edits. Cached
// responses are still used when the network is unavailable, which is all the
// offline demo needs.

const CACHE_NAME = 'cabinbridge-v4';
const OFFLINE_ASSETS = ['/', '/index.html', '/phrases.json', '/manifest.json', '/cabin-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(OFFLINE_ASSETS.map(async (url) => {
      try { await cache.add(url); } catch { /* optional static asset */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const stale = keys.filter((key) => key !== CACHE_NAME);
    await Promise.all(stale.map((key) => caches.delete(key)));
    await self.clients.claim();
    // One-time migration: when a previous cache-first worker is replaced,
    // reload controlled pages so they pick up the fresh network-first shell.
    if (stale.length) {
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(clients.map(async (client) => {
        try { await client.navigate(client.url); } catch { /* tab may be closing */ }
      }));
    }
  })());
});

function isCacheable(response) {
  return Boolean(response && response.ok && response.type === 'basic');
}

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = (await cache.match('/index.html')) || (await cache.match('/'));
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response) && !request.url.includes('?')) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return;

  const isNavigation = request.mode === 'navigate';
  const isCode = url.pathname.startsWith('/src/')
    || url.pathname.startsWith('/@')
    || url.pathname.startsWith('/node_modules/')
    || url.pathname.startsWith('/assets/')
    || /\.(?:js|mjs|tsx?|css|html)$/.test(url.pathname);

  if (isNavigation) {
    event.respondWith(networkFirst(request, '/index.html'));
  } else if (isCode) {
    event.respondWith(networkFirst(request, request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});
