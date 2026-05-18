// VoyageKeeper Service Worker v5 — offline-first, icon-aggressive caching
var CACHE = 'vk-v5';
// Cache ALL 5 files including both icons
var CORE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // Cache each file individually so one failure doesn't block others
      return Promise.all(CORE.map(function(url) {
        return c.add(url).catch(function(err) {
          console.warn('Failed to cache:', url, err);
        });
      }));
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;

  // Fonts: network first, cache fallback
  if (url.indexOf('fonts.googleapis.com') !== -1 || url.indexOf('fonts.gstatic.com') !== -1) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        return res;
      }).catch(function() { return caches.match(e.request); })
    );
    return;
  }

  // Icons: cache first always (critical for home screen)
  if (url.indexOf('icon-') !== -1) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          caches.open(CACHE).then(function(c) { c.put(e.request, res.clone()); });
          return res;
        });
      })
    );
    return;
  }

  // Everything else: cache first, update in background
  e.respondWith(
    caches.open(CACHE).then(function(c) {
      return c.match(e.request).then(function(cached) {
        var net = fetch(e.request).then(function(res) {
          if (res && res.status === 200) c.put(e.request, res.clone());
          return res;
        }).catch(function() { return cached; });
        return cached || net;
      });
    })
  );
});
