const CACHE_NAME = 'poker-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://img.icons8.com/emoji/96/spade-suit.png',
  'https://img.icons8.com/emoji/32/spade-suit.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
