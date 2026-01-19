const CACHE_NAME = 'kho-giay-mobile-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@zxing/library@0.20.0',
  'https://esm.sh/react@^19.2.3',
  'https://esm.sh/react-dom@^19.2.3',
  'https://esm.sh/idb-keyval@6',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0',
  'https://i.postimg.cc/8zF3c24h/image.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Try to cache all, but don't fail if some optional assets fail
      return cache.addAll(ASSETS).catch(err => {
         console.warn("Some assets failed to cache:", err);
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Handle External CDNs (Tailwind, ESM.sh, Google Fonts, Unpkg)
  // We explicitly try to use CORS to ensure we get a valid 200 response for caching.
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        
        const fetchPromise = fetch(event.request, { 
          mode: 'cors', // Force CORS to avoid opaque responses where possible
          credentials: 'omit'
        }).then((networkResponse) => {
          // Store in cache only if valid response
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          console.warn('External fetch failed: ' + url.href, err);
          // Return nothing here; the cachedResponse will be used if available
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 2. Handle Local App Assets (Stale-While-Revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
           const responseClone = networkResponse.clone();
           caches.open(CACHE_NAME).then((cache) => {
             cache.put(event.request, responseClone);
           });
        }
        return networkResponse;
      }).catch(() => {
         // Network failed, fall back to offline page if we had one, or just fail
      });
      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});