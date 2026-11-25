/* X.ZON service worker: offline app shell only.
   - Caches the app's own files so it opens with no connection.
   - Never touches audio, Range requests, or any cross-origin request (Audius, Jamendo, Deezer, iTunes, radio, LRCLIB...).
   - Page loads are network-first, so a new version of the app is picked up as soon as you are online. */
const VERSION = 'xzon-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('xzon-shell-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;                       /* audio/video seeking: let the network handle it */
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            /* third-party music sources and APIs: untouched */

  if (req.mode === 'navigate') {                              /* the app itself: network first, cache as the offline fallback */
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)).catch(() => {}); }
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(                                              /* icons, manifest: cache first, refresh in the background */
    caches.match(req).then(hit => {
      const refresh = fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {}); }
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
