const CACHE_NAME = 'core-assets-1769061019826';
const FONT_CACHE = 'google-fonts-v1';
const IMAGE_CACHE = 'images-v1';
const CORE_ASSETS = [
  '/',
  '/styles.css',
  '/assets/js/core.js',
  '/offline/',
];
const PRECACHE_IMAGES = [
  '/assets/images/favicon.svg',
  '/assets/images/icons.svg',
];
const CACHE_CATEGORIES = [
  '/basics/',
  '/gospel/',
  '/prophecy/',
];
const isLocalhost = self.location.hostname === 'localhost' || 
                    self.location.hostname === '127.0.0.1';

// helper for cache-first
function cacheFirst(cacheName, request) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(cached => {
      if (cached) return cached;
      
      return fetch(request).then(response => {
        if (response?.ok) {
          const cloned = response.clone();
          cache.put(request, cloned);
        }
        return response;
      });
    })
  );
}

if (!isLocalhost) {
  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(CORE_ASSETS))
        .then(() => {
          return caches.open(IMAGE_CACHE)
            .then(cache => cache.addAll(PRECACHE_IMAGES))
            .catch(() => {});
        })
        .then(() => {
          return caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_CATEGORIES))
            .catch(() => {});
        })
        .then(() => self.skipWaiting()) // activate new SW immediately
    );
  });

  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys().then(keys => 
        Promise.all(keys
          .filter(key => 
            key !== CACHE_NAME && 
            key !== FONT_CACHE && 
            key !== IMAGE_CACHE)
          .map(key => caches.delete(key)))
      )
      .then(() => self.clients.claim()) // take control of all open tabs immediately
    );
  });

  self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    if (request.method !== 'GET') return;
    
    // only cache same-origin requests (except Google Fonts)
    const isFont = url.origin === 'https://fonts.googleapis.com';
    const isSameOrigin = url.origin === self.location.origin;
    
    if (!isFont && !isSameOrigin) return;

    // Google Fonts: cache CSS only, let browser handle font files
    if (isFont) {
      event.respondWith(
        caches.open(FONT_CACHE).then(cache =>
          cache.match(request).then(cached => {
            if (cached) return cached;
            
            return fetch(request).then(response => {
              if (response.ok || response.type === 'opaque') {
                const cloned = response.clone();
                cache.put(request, cloned);
              }
              return response;
            });
          })
        )
      );
      return;
    }

    // Images: cache-first
    if (request.destination === 'image') {
      event.respondWith(cacheFirst(IMAGE_CACHE, request));
      return;
    }

    // HTML navigation: network-first, fallback to cache, then offline page
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request).catch(() => 
          caches.match(request).then(cached => 
            cached || caches.match('/offline/')
          )
        )
      );
      return;
    }

    // CSS/JS: cache-first
    if (request.destination === 'style' || 
        request.destination === 'script') {
      event.respondWith(cacheFirst(CACHE_NAME, request));
      return;
    }
  });
}