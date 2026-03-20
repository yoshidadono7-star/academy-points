const CACHE_NAME = 'academy-points-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/student.html',
  '/parent.html',
  '/db.js',
  '/firebase-config.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).then(res => {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          const responseToCache = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return res;
        });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
});
