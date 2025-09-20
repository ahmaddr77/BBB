// File: /service-worker.js
const CACHE_NAME = 'app-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/styles.css',
  '/assets/main.js',
  '/manifest.json'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS_TO_CACHE)));
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
