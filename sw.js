// Офлайн-кэш оболочки приложения. При изменении файлов увеличивай VERSION.
const VERSION = "hrum-5";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "products.js", "manifest.webmanifest",
  "vendor/html5-qrcode.min.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/author.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Open Food Facts — всегда из сети
  if (url.hostname.endsWith("openfoodfacts.org")) return;
  // Шрифты — кэшируем при первом получении
  if (url.hostname.includes("fonts.g")) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Своё: сначала сеть (чтобы обновления приходили сразу), без сети — кэш
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
