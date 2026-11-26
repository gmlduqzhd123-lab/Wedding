const CACHE_VERSION = 'wedding-features-60';
const CACHE_NAME = `wedding-pwa-${CACHE_VERSION}`;

const CORE_PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  `./assets/css/app.css?v=${CACHE_VERSION}`,
  `./assets/js/app.js?v=${CACHE_VERSION}`,
  `./assets/js/content.js?v=${CACHE_VERSION}`,
  `./assets/js/travel.js?v=${CACHE_VERSION}`,
  `./assets/js/calendar.js?v=${CACHE_VERSION}`,
  `./assets/js/dom.js?v=${CACHE_VERSION}`,
  `./assets/js/ui-shell.js?v=${CACHE_VERSION}`,
  `./assets/js/bgm.js?v=${CACHE_VERSION}`,
  `./assets/js/invitation-card.js?v=${CACHE_VERSION}`,
  `./assets/js/invitation-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/story-album-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/photo-viewer.js?v=${CACHE_VERSION}`,
  './assets/favicon.svg',
  './assets/apple-touch-icon.png',
  './assets/fonts/Paperlogy-7Bold.woff2',
  './assets/fonts/SUITE-Regular.woff2',
  './data/guest-site.json'
];

const PLANNER_PRECACHE_URLS = [
  `./assets/css/planner.css?v=${CACHE_VERSION}`,
  `./assets/js/preferences.js?v=${CACHE_VERSION}`,
  `./assets/js/storage.js?v=${CACHE_VERSION}`,
  `./assets/js/planning.js?v=${CACHE_VERSION}`,
  `./assets/js/home-dashboard-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/manager-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/studio-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/travel-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/ceremony-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/guest-ledger-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/gift-ledger-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/wedding-day-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/prenatal-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/planning-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/life-planning-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/editor-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/charts.js?v=${CACHE_VERSION}`,
  `./assets/js/search-ui.js?v=${CACHE_VERSION}`,
  `./assets/js/qrcode.js?v=${CACHE_VERSION}`,
  './data/site.json',
  './data/studios.json',
  './assets/luna-makeup-map.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(CORE_PRECACHE_URLS.map(url => cache.add(url))))
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

self.addEventListener('message', event => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (type === 'WARM_PLANNER_CACHE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async cache => {
        for (const url of PLANNER_PRECACHE_URLS) {
          const hit = await cache.match(url);
          if (!hit) await cache.add(url).catch(() => {});
        }
      })
    );
  }
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
