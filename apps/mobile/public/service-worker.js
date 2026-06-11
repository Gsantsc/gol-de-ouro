const CACHE_VERSION = "gol-de-ouro-pwa-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png"
];

const PRIVATE_OR_DYNAMIC_PATTERNS = [
  "supabase.co",
  "/auth/",
  "/rest/v1/",
  "/storage/v1/",
  "/realtime/v1/",
  "/predictions",
  "/ranking",
  "/profiles",
  "/groups"
];

const isPrivateOrDynamicRequest = (request) => {
  const url = new URL(request.url);
  if (request.method !== "GET") return true;
  return PRIVATE_OR_DYNAMIC_PATTERNS.some((pattern) => url.href.includes(pattern) || url.pathname.includes(pattern));
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (isPrivateOrDynamicRequest(request)) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const copy = response.clone();
        caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
