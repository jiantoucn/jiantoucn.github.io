
const CACHE_NAME = 'weather-app-no-cache-v1';

// 安装阶段：跳过等待，立即激活
self.addEventListener('install', event => {
  self.skipWaiting();
});

// 激活阶段：立即接管，并清除所有旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 请求阶段：仅网络，不缓存
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
        // 如果离线且没有缓存，可能需要返回一个简单的离线页面，
        // 但既然要求"不保留缓存"，这里就直接失败即可，或者返回空。
        return new Response("Network error occurred");
    })
  );
});
