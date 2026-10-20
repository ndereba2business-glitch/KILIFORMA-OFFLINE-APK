// Registers the shell cache, production builds only.
//
// Not in development: a service worker sitting in front of Vite's dev server
// serves stale modules and makes hot reload lie. Not in the test suite either --
// the end-to-end tests run against the dev server and talk to a mock backend.
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A failed registration must never block the app; offline opening is a
      // bonus, not a requirement.
    });
  });
}
