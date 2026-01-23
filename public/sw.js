// Minimal service worker for PWA installability
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through
    event.respondWith(fetch(event.request));
});
