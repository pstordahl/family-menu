const CACHE = 'family-menu-v1';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js', '/firebaseConfig.js', '/manifest.webmanifest',
  '/assets/icon-192.png','/assets/icon-512.png'
];
self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('fetch', (e)=>{
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});