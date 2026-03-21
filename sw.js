// Service Worker for HERO'S Points
// キャッシュ + FCM プッシュ通知対応

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const CACHE_NAME = 'academy-points-v2';
const urlsToCache = [
  '/index.html',
  '/student.html',
  '/db.js',
  '/firebase-config.js',
  '/manifest.json'
];

// ===== キャッシュ =====
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Firebase / CDNへのリクエストはキャッシュしない
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com') ||
      event.request.url.includes('jsdelivr.net')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const responseToCache = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return res;
      }).catch(() => caches.match('/student.html'));
    })
  );
});

// ===== FCM プッシュ通知 =====
// firebase-config.js の内容をService Worker内で直接初期化
const firebaseConfig = {
  apiKey: "AIzaSyBeY5L5bupgjiSVbsyOI8VkMcmGyeDfFdo",
  authDomain: "hero-s-points.firebaseapp.com",
  projectId: "hero-s-points",
  storageBucket: "hero-s-points.firebasestorage.app",
  messagingSenderId: "391139988281",
  appId: "1:391139988281:web:ae87b669e7a94bc12f0ee8"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// バックグラウンドでプッシュ通知を受信
messaging.onBackgroundMessage(payload => {
  const { title, body, icon, data } = payload.notification || {};
  const options = {
    body: body || '',
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data || {},
    vibrate: [200, 100, 200],
    tag: 'heros-notification',
    renotify: true,
    actions: [
      { action: 'open', title: '開く' },
      { action: 'close', title: '閉じる' }
    ]
  };
  return self.registration.showNotification(title || 'HERO\'S Points', options);
});

// 通知クリック時の処理
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/student.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('student.html') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
