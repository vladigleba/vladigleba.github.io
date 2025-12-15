
const CACHE_NAME = 'vgb-site-cache-1765756789656';
const ASSETS_TO_CACHE = [
  '/',
  '/styles.css',
  '/assets/js/core.js',
  // images
  '/assets/images/favicon.svg',
  '/assets/images/icons.svg',
  '/assets/images/social-default.png',
  // categories
  '/basics/',
  '/gospel/',
  '/prophecy/',
  '/offline/',
];

// disable service worker caching on localhost for development
const isLocalhost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

if (!isLocalhost) {
  // pre-cache assets for offline use
  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache =>
        cache.addAll(ASSETS_TO_CACHE)
      ).then(() => self.skipWaiting()) // activate new SW AFTER cache is ready
    );
  });

  // delete outdated cache versions
  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(
          keys
            // filter caches to delete
            .filter(key => key.startsWith('vgb-site-cache-') && key !== CACHE_NAME)
            // || key.startsWith('google-fonts-cache')) // run if fonts change
            .map(key => caches.delete(key))
        )
      ).then(() => self.clients.claim()) // control all open tabs after cleanup
    );
  });

  // cache-first: serve cache if exists, else fetch from network and cache it
  self.addEventListener('fetch', event => {
    const url = event.request.url;

    // cache Google Fonts CSS and font files in a dedicated cache
    if (
      url.startsWith('https://fonts.googleapis.com/') ||
      url.startsWith('https://fonts.gstatic.com/')
    ) {
      event.respondWith(
        caches.open('google-fonts-cache').then(cache =>
          cache.match(event.request).then(response => {
            if (response) return response;
            return fetch(event.request).then(networkResponse => {
              if (networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            });
          })
        )
      );
      return;
    }

    // all other requests
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) return response;

        // not in cache, fetch from network and cache it
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => {
          // fallback to offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/offline/');
          }
        });
      })
    );
  });
}

// stale-while-revalidate: serve cached files immediately, update cache in background
// even if the cached content is still current
