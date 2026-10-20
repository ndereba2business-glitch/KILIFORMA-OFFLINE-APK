/* Kiliforma service worker: the app must open with no data at all.
 *
 * Three jobs, in order of importance:
 *   1. Opening the app offline (the shell: HTML, JS, CSS, icons, fonts)
 *   2. Serving static assets from disk first, so a slow phone is not blocked
 *   3. Never touching Supabase. Reads are cached by src/lib/offline/net.js,
 *      which knows who is signed in; this file knows nothing about accounts.
 *
 * Bump CACHE_VERSION when the shell changes shape; old caches are deleted on
 * activate.
 */
const CACHE_VERSION = "kiliforma-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll fails the whole install if one file 404s; add individually.
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isSupabase(url) {
  return /\.supabase\.co$/.test(url.hostname) || url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isSupabase(url)) return; // the app layer owns data caching

  // Navigations: network first, then the cached shell. This is what makes the
  // app open on a phone with the radio on and no bundle.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match("/index.html").then((hit) => hit || caches.match("/")))
    );
    return;
  }

  // Static assets from this origin: cache first, refresh in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
  }
});
