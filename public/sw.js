// Shudkara PWA Service Worker with Full Offline Support
// Assets and version are injected during Vite production build

const CACHE_VERSION = '__CACHE_VERSION__';
const VERSION = CACHE_VERSION.startsWith('__') ? 'shudkara-v-dev' : CACHE_VERSION;

const STATIC_CACHE = `shudkara-static-${VERSION}`;
const DYNAMIC_CACHE = `shudkara-dynamic-${VERSION}`;
const API_CACHE = `shudkara-api-${VERSION}`;

// Precache Assets placeholder - replaced by Vite build plugin
const INJECTED_ASSETS = null;
const DEFAULT_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icons.svg'
];

const PRECACHE_ASSETS = Array.isArray(INJECTED_ASSETS) ? INJECTED_ASSETS : DEFAULT_ASSETS;

// Install Event: cache all core static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: purge stale caches and claim clients immediately
self.addEventListener('activate', (e) => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!currentCaches.includes(key)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper to determine if request is an API request
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

// Helper to determine if request is an immutable hashed asset
function isHashedAsset(url) {
  return url.pathname.startsWith('/assets/');
}

// Helper for timeout-based fetch
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Fetch timed out'));
    }, ms);

    fetch(request).then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Fetch Event Handler
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1. Pass-through non-GET requests (client-side outbox manages offline mutations)
  if (e.request.method !== 'GET') {
    return;
  }

  // 2. Navigation Requests (e.g. user opens website or reloads)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      // Try network with timeout, fallback immediately to cached index.html
      fetchWithTimeout(e.request, 2000)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(e.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback: serve cached index.html or root
          const cached = await caches.match('/index.html', { cacheName: STATIC_CACHE })
            || await caches.match('/', { cacheName: STATIC_CACHE })
            || await caches.match(e.request);
          if (cached) return cached;
          return new Response('Offline: App shell not found in cache.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 3. API GET Requests (/api/*): Network-First with Cache Fallback
  if (isApiRequest(url)) {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(API_CACHE).then((c) => c.put(e.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed (offline): check API cache
          const cached = await caches.match(e.request, { cacheName: API_CACHE });
          if (cached) {
            const headers = new Headers(cached.headers);
            headers.set('X-Shudkara-Offline', 'true');
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers
            });
          }
          // If no cache, return synthetic offline JSON so fetch callers do not crash
          return new Response(JSON.stringify({ offline: true, error: 'Offline mode active.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Shudkara-Offline': 'true' }
          });
        })
    );
    return;
  }

  // 4. Immutable Bundled Assets (/assets/*): Cache-First Strategy
  if (isHashedAsset(url)) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Not in cache yet: fetch from network and store in dynamic cache
        return fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE).then((c) => c.put(e.request, clone));
            }
            return networkResponse;
          })
          .catch(async () => {
            // Extreme offline fallback: if exact hash file is missing, try matching any similar cached asset
            const ext = url.pathname.endsWith('.js') ? '.js' : url.pathname.endsWith('.css') ? '.css' : '';
            if (ext) {
              const allCaches = [STATIC_CACHE, DYNAMIC_CACHE];
              for (const cName of allCaches) {
                const c = await caches.open(cName);
                const keys = await c.keys();
                const matchKey = keys.find((k) => k.url.includes('/assets/') && k.url.endsWith(ext));
                if (matchKey) {
                  return c.match(matchKey);
                }
              }
            }
            return new Response('', { status: 404 });
          });
      })
    );
    return;
  }

  // 5. All other static requests (images, fonts, manifest, favicons): Stale-While-Revalidate
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((c) => c.put(e.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
