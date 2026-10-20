// The decisions the offline layer makes, without a browser.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ENTRIES,
  STALE_AFTER_MS,
  cacheKey,
  entriesToDrop,
  isCacheableRead,
  isExpired,
  isStale,
} from "../../src/lib/offline/cachePolicy.js";

const REST = "https://abc.supabase.co/rest/v1/batches?select=*";

test("only Supabase table reads are cached", () => {
  assert.equal(isCacheableRead(REST), true);
  assert.equal(isCacheableRead(REST, "GET"), true);
  // writes have side effects and must never be answered from a cache
  assert.equal(isCacheableRead(REST, "POST"), false);
  assert.equal(isCacheableRead(REST, "PATCH"), false);
  assert.equal(isCacheableRead(REST, "DELETE"), false);
});

test("auth, storage, realtime and edge functions are left alone", () => {
  assert.equal(isCacheableRead("https://abc.supabase.co/auth/v1/token?grant_type=password"), false);
  assert.equal(isCacheableRead("https://abc.supabase.co/storage/v1/object/lab-results/x.pdf"), false);
  assert.equal(isCacheableRead("https://abc.supabase.co/functions/v1/clucky"), false);
  assert.equal(isCacheableRead("https://abc.supabase.co/realtime/v1/websocket"), false);
});

test("rubbish input does not throw", () => {
  assert.equal(isCacheableRead("not a url"), false);
  assert.equal(isCacheableRead(undefined), false);
  assert.equal(isCacheableRead("", "GET"), false);
});

test("two signed-in people on one phone never share cached rows", () => {
  const alice = cacheKey(REST, "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaALICE");
  const bob = cacheKey(REST, "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBOBBY");
  assert.notEqual(alice, bob);
  assert.equal(alice, cacheKey(REST, "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaALICE"), "stable for the same caller");
  // signed out: still a key, just a shared one
  assert.equal(cacheKey(REST, ""), cacheKey(REST));
});

test("a cache entry survives long enough to matter, then expires", () => {
  const now = Date.now();
  assert.equal(isExpired(now, now), false);
  assert.equal(isExpired(now - 6 * 24 * 60 * 60 * 1000, now), false, "6 days old is still usable");
  assert.equal(isExpired(now - 8 * 24 * 60 * 60 * 1000, now), true, "8 days old is dropped");
  assert.equal(isExpired(null, now), true);
});

test("data shown after 15 minutes is marked stale", () => {
  const now = Date.now();
  assert.equal(isStale(now - 60 * 1000, now), false);
  assert.equal(isStale(now - STALE_AFTER_MS - 1000, now), true);
});

test("the store keeps its size by dropping the oldest first", () => {
  const entries = Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => ({ key: `k${i}`, storedAt: i }));
  const dropped = entriesToDrop(entries);
  assert.equal(dropped.length, 5);
  assert.deepEqual(dropped, ["k0", "k1", "k2", "k3", "k4"]);
  assert.deepEqual(entriesToDrop(entries.slice(0, MAX_ENTRIES)), [], "nothing dropped below the limit");
});
