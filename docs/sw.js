/* Cho phép trang chạy khi mất mạng: lưu sẵn mã nguồn của trang (không lưu dữ liệu kinh doanh – dữ liệu nằm trong IndexedDB của trình duyệt). */
var CACHE = 'tts-web-v12';
var FILES = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'huong_dan.html', 'huong_dan_xuat_du_lieu.html', 'huong_dan_doc_bao_cao.html', 'kiem_thu.html',
  'js/core.js', 'js/schema.js', 'js/store.js', 'js/importer.js', 'js/cube.js', 'js/excel.js', 'js/excel-report.js', 'js/secure.js',
  'js/metrics.js', 'js/charts.js', 'js/views.js', 'js/viewer.js', 'js/app.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
// Lấy từ bộ nhớ đệm trước (chạy ngay cả khi mất mạng), đồng thời cập nhật bản mới khi có mạng.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit || (req.mode === 'navigate' ? c.match('index.html') : undefined); });
      return hit || net;
    });
  }));
});
