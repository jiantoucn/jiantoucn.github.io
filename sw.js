const CACHE_NAME = 'live2d-tracker-v1.33.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/live2d-controller.js',
  './js/camera-controller.js',
  './js/main.js',
  // 默认模型文件 (Kei Vowels Pro)
  './models/kei_en/kei_vowels_pro/runtime/kei_vowels_pro.model3.json',
  './models/kei_en/kei_vowels_pro/runtime/kei_vowels_pro.moc3',
  './models/kei_en/kei_vowels_pro/runtime/kei_vowels_pro.physics3.json',
  './models/kei_en/kei_vowels_pro/runtime/kei_vowels_pro.cdi3.json',
  './models/kei_en/kei_vowels_pro/runtime/kei_vowels_pro.motionsync3.json',
  './models/kei_en/kei_vowels_pro/runtime/kei_vowels_pro.2048/texture_00.png',
  // 小海豹模型文件
  './models/小海豹试用版/试用版(水印不可去除).model3.json',
  './models/小海豹试用版/试用版(水印不可去除).moc3',
  './models/小海豹试用版/试用版(水印不可去除).physics3.json',
  './models/小海豹试用版/试用版(水印不可去除).cdi3.json',
  './models/小海豹试用版/试用版(水印不可去除).8192/texture_00.png',
  './models/小海豹试用版/试用版(水印不可去除).8192/texture_01.png',
  // 艾玛模型文件
  './models/艾玛/艾玛.model3.json',
  './models/艾玛/艾玛.moc3',
  './models/艾玛/艾玛.physics3.json',
  './models/艾玛/艾玛.cdi3.json',
  './models/艾玛/艾玛.8192/texture_00.png',
  './models/艾玛/liulei.exp3.json',
  './models/艾玛/monvhua.exp3.json',
  './models/艾玛/taishou.exp3.json',
  './models/艾玛/Scene1.motion3.json',
  // 外部依赖
  'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js',
  'https://cdn.jsdelivr.net/npm/pixi.js@6.5.1/dist/browser/pixi.min.js',
  'https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/kalidokit@1.1.5/dist/kalidokit.umd.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
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
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
