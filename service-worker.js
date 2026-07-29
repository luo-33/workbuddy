// Workbuddy Service Worker v2.0.0 — Multi-platform sync
const CACHE_NAME = 'workbuddy-v2';
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'manifest.json',
  'apple-touch-icon.jpg'
];

// Install: cache core assets immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first → cache; offline → cache-only
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.url.match(/\.(jpg|png|svg|ico|jpeg|webp)$/)) {
          return new Response('', { status: 200 });
        }
        return new Response('离线模式', {
          status: 200,
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
        });
      });
    })
  );
});

// ===== Background Sync =====
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-workbuddy-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SYNC_TRIGGER' });
    }
  } catch (e) {
    console.warn('[SW] Background sync failed:', e);
  }
}

// ===== Message Handler =====
self.addEventListener('message', (event) => {
  switch (event.data?.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'SYNC_NOW':
      // Forward to all clients to trigger sync
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SYNC_TRIGGER' }));
      });
      break;
  }
});
