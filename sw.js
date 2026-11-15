// Offline shell: cache-first for app files, network-only for the API.
const VERSION = 'whossup-v2.1.0';
const SHELL = ['./', 'index.html', 'css/app.css', 'lib/supabase.js', 'manifest.json',
  'js/app.js', 'js/store.js', 'js/api.js', 'js/demo.js', 'js/config.js', 'js/util.js', 'js/logic.js', 'js/ui.js',
  'js/views/calendar.js', 'js/views/plans.js', 'js/views/chat.js', 'js/views/money.js', 'js/views/crew.js', 'js/views/onboarding.js',
  'img/mark.png', 'img/logo.png', 'img/icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase, fonts: straight to network
  // Network first for HTML so deploys show up; cache first for everything else.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); }
    return r;
  })));
});
