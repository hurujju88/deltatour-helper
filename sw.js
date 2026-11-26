/* 델타투어 보조 — 오프라인 캐시 (v8, 체크리스트 순서·도착+3일·취소 이동·복원 유지) */
var CACHE = 'deltatour-helper-v12';
var ASSETS = [
  './',
  './index.html',
  './app.js?v=11',
  './parse.js?v=11',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon-180.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // 프록시·외부 요청은 그대로 통과

  event.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return hit || caches.match('./index.html');
      });
      // 문서는 네트워크 우선(업데이트 반영), 그 외는 캐시 우선 + 백그라운드 갱신
      if (req.mode === 'navigate') return network;
      return hit || network;
    })
  );
});
