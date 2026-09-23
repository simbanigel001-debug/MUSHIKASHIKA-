// apps/crew-app/public/sw.js
const CACHE_NAME = 'mushikashika-v1';
const STATIC_ASSETS = [
  '/',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Offline Request Interceptor
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});

// Background Sync Event for Replay Queue
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-rank-events') {
    event.waitUntil(triggerQueueReplay());
  }
});

async function triggerQueueReplay() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'OFFLINE_REPLAY_TRIGGERED' });
  });
}
