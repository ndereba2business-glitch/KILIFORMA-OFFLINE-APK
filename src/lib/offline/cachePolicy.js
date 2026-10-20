// Pure decisions about what the offline layer may cache.
// Kept separate from the IndexedDB code so they can be tested without a browser.

// How long a cached read is still worth showing when the network is down.
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Cached reads older than this are shown, but the UI says they are stale.
export const STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes
// A "data on but no data" phone connects and then stalls. Waiting forever is
// what makes an app feel frozen, so reads give up and fall back to the cache.
export const READ_TIMEOUT_MS = 8000;
// Storage ceiling: roughly 400 table reads, oldest dropped first.
export const MAX_ENTRIES = 400;

const CACHEABLE_PATHS = ["/rest/v1/"];

/**
 * Can this request be answered from the cache when the network fails?
 * Only reads (GET) against Supabase's REST API. Never auth, storage, realtime
 * or edge functions -- those have side effects or are streamed.
 */
export function isCacheableRead(url, method = "GET") {
  if (String(method).toUpperCase() !== "GET") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!CACHEABLE_PATHS.some((p) => parsed.pathname.includes(p))) return false;
  // Counts and HEAD-style requests are cheap to repeat; they cache fine.
  return true;
}

/**
 * Cache key. The caller's credential is part of the key so that two people
 * sharing one phone can never see each other's rows: row-level security is
 * enforced by Postgres, but the cache sits in front of it.
 */
export function cacheKey(url, authorization = "") {
  const who = authorization ? authorization.slice(-24) : "anonymous";
  return `${who}::${url}`;
}

export function isExpired(storedAt, now = Date.now()) {
  return !storedAt || now - storedAt > MAX_AGE_MS;
}

export function isStale(storedAt, now = Date.now()) {
  return !storedAt || now - storedAt > STALE_AFTER_MS;
}

/** Drop the oldest entries once the store grows past MAX_ENTRIES. */
export function entriesToDrop(entries, limit = MAX_ENTRIES) {
  if (entries.length <= limit) return [];
  return [...entries]
    .sort((a, b) => a.storedAt - b.storedAt)
    .slice(0, entries.length - limit)
    .map((e) => e.key);
}
