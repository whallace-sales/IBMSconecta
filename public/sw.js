const CACHE_NAME = 'igreja-conecta-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/icon.png',
    '/logo.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Best effort cache
            return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Cache error', err));
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Navigation strategy: Network First -> Cache -> Offline Fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request))
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Assets strategy: Cache First -> Network
    if (event.request.destination === 'image' ||
        event.request.destination === 'style' ||
        event.request.destination === 'script' ||
        event.request.destination === 'font') {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        if (event.request.url.startsWith('http')) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
    } else {
        // Default: Network First
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    }
});
