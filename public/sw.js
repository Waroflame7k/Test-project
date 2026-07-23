importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAuja6FDOcgQsO5BPBi00fWn75sFOBwm6w",
  authDomain: "test-project-8b41c.firebaseapp.com",
  projectId: "test-project-8b41c",
  storageBucket: "test-project-8b41c.firebasestorage.app",
  messagingSenderId: "757348999492",
  appId: "1:757348999492:web:882654cca97a0c7ac3b711",
});

firebase.messaging().onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || "Hồ sơ BĐS", {
    body: notification.body || "Bạn có một cập nhật mới.",
    data: payload.data || {},
  });
});

const CACHE_NAME = "ho-so-bds-v2";
const APP_SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((response) => response || caches.match("/"))));
});
