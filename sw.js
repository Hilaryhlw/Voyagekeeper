// VoyageKeeper Service Worker — offline-first v4
// Icons are inlined in HTML/manifest, so only 2 files needed for full offline
var CACHE = 'vk-v4';
var CORE = ['./index.html', './manifest.json'];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.all(CORE.map(function(url) {
        return c.add(url).catch(function() {});
      }));
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;

  // Google Fonts — network first, cache fallback
  if (url.indexOf('fonts.googleapis.com') !== -1 || url.indexOf('fonts.gstatic.com') !== -1) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        return res;
      }).catch(function(){ return caches.match(e.request); })
    );
    return;
  }

  // Everything else — cache first, update in background
  e.respondWith(
    caches.open(CACHE).then(function(c) {
      return c.match(e.request).then(function(cached) {
        var net = fetch(e.request).then(function(res) {
          if (res && res.status === 200) c.put(e.request, res.clone());
          return res;
        }).catch(function(){ return cached; });
        return cached || net;
      });
    })
  );
});
