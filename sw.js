// VoyageKeeper Service Worker v6 — offline-first
// What works offline:
//   ✓ Full app UI (index.html, all screens)
//   ✓ All typed data: itinerary, vault, journal, clocks, settings (localStorage)
//   ✓ Fonts (cached after first online visit)
//   ✓ Icons (cached, home screen works)
//   ✓ Last fetched weather (cached, shown with timestamp)
//   ✓ Real-time clocks (device clock, no internet needed)
// What requires internet:
//   ✗ Fresh weather data
//   ✗ GPS-based location detection
//   ✗ IP geolocation

var CACHE = 'vk-v6';
var CORE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: cache core files ──
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.all(CORE.map(function(url) {
        return c.add(url).catch(function(err) {
          console.warn('[SW] Failed to cache:', url, err);
        });
      }));
    })
  );
});

// ── ACTIVATE: remove old caches ──
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

// ── FETCH strategy ──
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;

  // External APIs (weather, IP geo): network only, never cache, never block
  // Let them fail silently — the app handles the error gracefully
  if (url.indexOf('open-meteo.com') !== -1 ||
      url.indexOf('ip-api.com') !== -1) {
    e.respondWith(
      fetch(e.request).catch(function() {
        // Return empty JSON so the app's .catch() fires cleanly
        return new Response('{}', {
          status: 200,
          headers: {'Content-Type': 'application/json'}
        });
      })
    );
    return;
  }

  // Google Fonts: network first, cache fallback
  if (url.indexOf('fonts.googleapis.com') !== -1 ||
      url.indexOf('fonts.gstatic.com') !== -1) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        return res;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // App files (index.html, icons, manifest): cache first, update in background
  e.respondWith(
    caches.open(CACHE).then(function(c) {
      return c.match(e.request).then(function(cached) {
        var networkFetch = fetch(e.request).then(function(res) {
          if (res && res.status === 200) {
            c.put(e.request, res.clone());
          }
          return res;
        }).catch(function() {
          return cached; // offline: serve from cache
        });
        // Serve cached immediately, update in background
        return cached || networkFetch;
      });
    })
  );
});
