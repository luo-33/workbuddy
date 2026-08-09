// Workbuddy Service Worker v3.0.0 — Cleanup-only mode
// 自我卸载：之前注册的 SW 会立即 unregister，避免拦截新版本资源。
const CACHE_NAME = 'workbuddy-v3-cleanup';

// Install: clear all old caches and unregister self
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: unregister self immediately, delete all caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.map((name) => caches.delete(name))))
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
      .then(() => self.unregister())
      .catch(() => {})
  );
});

// Pass-through fetch: do not intercept any requests
self.addEventListener('fetch', () => {});