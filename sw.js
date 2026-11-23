const CACHE_VERSION = 'wedding-features-54';
const CACHE_NAME = `wedding-pwa-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  `./assets/css/app.css?v=${CACHE_VERSION}`,
  `./assets/js/app.js?v=${CACHE_VERSION}`,
  './assets/favicon.svg',
  './assets/apple-touch-icon.png',
  './assets/fonts/Paperlogy-7Bold.woff2',
  './assets/fonts/SUITE-Regular.woff2',
  './data/site.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('wedding-pwa-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isNetworkFirstRequest(request, url) {
  if (request.mode === 'navigate') return true;
  const p = url.pathname;
  return p.endsWith('/') || p.endsWith('/index.html') || p.endsWith('/manifest.webmanifest') || p.includes('/data/');
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (isNetworkFirstRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const direct = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
          if (direct) return direct;
          if (request.mode === 'navigate') {
            return (await cache.match('./index.html')) || (await cache.match('./'));
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === 'basic') {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        return new Response('', { status: 503, statusText: 'Offline' });
      }
    })
  );
});
