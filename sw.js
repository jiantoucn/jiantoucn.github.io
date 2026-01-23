const CACHE_NAME = 'tools-nav-v1.0.0';
const ASSETS = [
    './',
    './index.html',
    './icon.png',
    'https://cdn.tailwindcss.com'
];

// 安装时缓存资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// 拦截请求并优先使用缓存
self.addEventListener('fetch', (event) => {
    // 仅拦截 http/https 请求，跳过 chrome-extension 等其他协议
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                // 如果是 HTML 请求且网络失败，可以尝试返回离线页面（这里暂时不处理，直接失败）
            });
        })
    );
});
