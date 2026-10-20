// The offline layer, Facebook-Lite style.
//
// The app talks to Supabase through one fetch function. Wrapping that function
// means every screen gains offline behaviour without editing 176 call sites:
//
//   reads   -> try the network with a timeout; if the phone has "data on but no
//              data" (connected, no throughput), fall back to the last good
//              answer from IndexedDB and mark it stale in the UI
//   writes  -> never cached and never faked: they fail honestly, and the
//              existing screens keep the farmer's typing and say so
//
// The timeout matters as much as the cache. A phone with a live radio and no
// airtime does not fail fast -- it hangs. That is what makes an app feel dead.

import { READ_TIMEOUT_MS, cacheKey, isCacheableRead } from "./cachePolicy.js";
import { getCached, putCached } from "./responseCache.js";

export const NETWORK_EVENT = "kiliforma:network";

let lastState = { online: true, fromCache: false, cachedAt: null };

function announce(patch) {
  lastState = { ...lastState, ...patch };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NETWORK_EVENT, { detail: lastState }));
  }
}

export function networkState() {
  return lastState;
}

function timedSignal(timeoutMs) {
  if (typeof AbortController === "undefined" || !timeoutMs) return { signal: undefined, cancel: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function cachedResponse(row) {
  const body = row.body;
  const headers = {
    "content-type": "application/json",
    "x-kiliforma-cache": "hit",
    "x-kiliforma-cached-at": String(row.storedAt),
  };
  return new Response(body, { status: 200, statusText: "OK (offline cache)", headers });
}

/**
 * fetch replacement passed to supabase-js.
 * Everything it cannot improve is passed straight through, unchanged.
 */
export async function offlineFetch(input, init = {}) {
  const url = typeof input === "string" ? input : input?.url;
  const method = init.method || (typeof input !== "string" ? input?.method : "GET") || "GET";

  if (!isCacheableRead(url, method)) {
    // Auth, storage, realtime, edge functions: untouched, no timeout applied.
    return fetch(input, init);
  }

  const authorization = new Headers(init.headers).get("authorization") || "";
  const key = cacheKey(url, authorization);
  const { signal, cancel } = timedSignal(READ_TIMEOUT_MS);

  try {
    const response = await fetch(input, signal ? { ...init, signal } : init);
    cancel();
    // Only a successful read is worth keeping; an RLS denial is not data.
    if (response.ok) {
      response
        .clone()
        .text()
        .then((body) => putCached(key, body))
        .catch(() => {});
      announce({ online: true, fromCache: false, cachedAt: null });
    }
    return response;
  } catch (error) {
    cancel();
    const row = await getCached(key);
    if (row) {
      announce({ online: false, fromCache: true, cachedAt: row.storedAt });
      return cachedResponse(row);
    }
    announce({ online: false, fromCache: false, cachedAt: null });
    throw error;
  }
}

// The browser's own signal is unreliable (it reports "online" for a phone with
// no bundle), so it is a hint that triggers a fresh state announcement rather
// than the source of truth.
export function watchConnectivity() {
  if (typeof window === "undefined") return () => {};
  const sync = () => announce({ online: navigator.onLine });
  window.addEventListener("online", sync);
  window.addEventListener("offline", sync);
  const interval = setInterval(sync, 30000);
  return () => {
    window.removeEventListener("online", sync);
    window.removeEventListener("offline", sync);
    clearInterval(interval);
  };
}
