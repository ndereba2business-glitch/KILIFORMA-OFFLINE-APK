// A small IndexedDB store for the last good answer to each Supabase read.
//
// No dependencies: IndexedDB is in every browser the app supports (including
// the Android WebView), and it holds far more than localStorage would.
// If IndexedDB is unavailable (private mode in some browsers), every function
// degrades to a no-op and the app simply behaves as it did before.

import { MAX_ENTRIES, entriesToDrop, isExpired } from "./cachePolicy.js";

const DB_NAME = "kiliforma-offline";
const DB_VERSION = 1;
const STORE = "responses";

let dbPromise = null;

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function getCached(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const request = tx(db, "readonly").get(key);
    request.onsuccess = () => {
      const row = request.result;
      if (!row || isExpired(row.storedAt)) return resolve(null);
      resolve(row);
    };
    request.onerror = () => resolve(null);
  });
}

export async function putCached(key, body) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    const request = tx(db, "readwrite").put({ key, body, storedAt: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
  await prune();
}

async function prune() {
  const db = await openDb();
  if (!db) return;
  const rows = await new Promise((resolve) => {
    const request = tx(db, "readonly").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  const doomed = entriesToDrop(rows, MAX_ENTRIES);
  if (!doomed.length) return;
  const store = tx(db, "readwrite");
  for (const key of doomed) store.delete(key);
}

/** Called on sign-out: one person's rows must not be readable by the next. */
export async function clearCache() {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    const request = tx(db, "readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

export async function cacheSize() {
  const db = await openDb();
  if (!db) return 0;
  return new Promise((resolve) => {
    const request = tx(db, "readonly").count();
    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => resolve(0);
  });
}
