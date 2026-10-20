# Offline mode — how far it goes

Written 20 October 2026. This is phase 1 of the "works like Facebook Lite" work: **the app opens and
shows your own data with no connection**. It does not yet queue changes made offline.

## The scenario being solved

Not "airplane mode". The real Kenyan field case is: **the phone shows signal, the radio is connected, and
no request gets through** — no bundle, expired data, or a cell that is saturated. In that state:

- `navigator.onLine` returns `true`, so naive checks think everything is fine
- requests do not fail fast; they **hang** for 30–120 seconds, which is what makes an app feel frozen
- a web app that needs the network simply shows an empty screen or a spinner forever

Facebook Lite is not magic: it keeps a local copy of what you already saw, opens instantly from it, and
tells you when it is showing something old. That is what this does.

## What was built

| Piece | File | What it does |
| --- | --- | --- |
| App shell cache | `public/sw.js` | Service worker: caches the HTML/JS/CSS/icons so the app **opens** with no data at all. Network-first navigations, cache-first assets, old caches deleted on activate |
| Read cache | `src/lib/offline/net.js` | Wraps `fetch` under supabase-js: a read that stalls for **8 s** or fails is answered from the last good copy in IndexedDB |
| Cache store | `src/lib/offline/responseCache.js` | IndexedDB (`kiliforma-offline`): one row per request, pruned to the 400 most recent, 7-day expiry |
| Policy | `src/lib/offline/cachePolicy.js` | Pure decisions: what may be cached, the key, staleness, pruning. Unit-tested |
| Honest UI | `src/components/OfflineBanner.jsx` | "No connection — showing what was saved 12 min ago". Never pretends data is current |
| Sign-out safety | OfflineBanner | Cached rows are **erased on sign-out**, so the next person on a shared phone cannot read them |

### Why it is a `fetch` wrapper and not 176 edits

The app calls Supabase directly in **176 places** across the pages. Wrapping the single fetch function that
supabase-js uses gives every screen the same behaviour at once, without touching any of them:

```js
// src/lib/supabaseClient.js
createClient(url, key, { global: { fetch: offlineFetch } });
```

Reads (`GET /rest/v1/...`) are cached. **Writes are deliberately not touched** — they fail honestly, so the
screens that already tell the farmer "that did not save, your text is kept" keep working exactly as designed.

## What is proven, and how

| Check | Result |
| --- | --- |
| `tests/unit/offlineCache.test.js` | 7/7 — only reads cache; auth/storage/realtime/functions never do; keys are per-user; 7-day expiry; 15-min staleness; pruning drops oldest |
| `tests/e2e/offline.test.js` | 2/2 — seed a task, load it online, **abort every Supabase request**, reload: the task is still on screen and the banner is shown; and no banner appears when the network is healthy |
| The offline test fails without the cache | Verified: disabling `isCacheableRead` makes it fail. It is a real test, not a tautology |
| Regression: notifications, community, account, theme/layout | 71/71 pass with the wrapper in place |
| `npm run build` / `npm run lint` | Build clean; lint back to the 31-problem baseline, none new |

## What this does **not** do yet (phase 2 and 3)

1. **Nothing you change offline is saved.** Add a task with no signal and it is lost when you close the tab.
   Phase 2 is an outbox: queue the write in IndexedDB, show it as "pending", replay it when the connection
   returns, and surface conflicts instead of silently overwriting someone else's edit.
2. **Photos are not cached.** Marketplace and gallery images come from Supabase Storage. A cache-first
   strategy for images is small and worth doing.
3. **Clucky (the AI) needs a connection.** It is an edge function; nothing to cache but the last answers.
4. **No background sync.** A phone with the app closed will not flush a queue until WebAPK/Android support
   for Background Sync is used — Capacitor can also do it natively.
5. **No data-saver mode.** Facebook Lite compresses and defers aggressively; this app does not proxy or
   compress anything (the AI proxy already runs server-side; images could go through a resizing endpoint).
6. **Stale data can look current for 15 minutes.** The banner says "saved X ago", but a screen that never
   re-renders will not re-evaluate that phrase. Fine for records, not fine for prices.

## Where the cache lives, and what it costs

- IndexedDB inside the browser profile (TWA) or the WebView's data directory (Capacitor shell).
- Pruned to 400 reads, ~a few MB. It is cleared on sign-out and by "clear data" on Android.
- **It is plain text on the device.** Anything a farmer can see on screen is in there. That is the same
  trust model as a browser cache, and it is why sign-out clears it.

## How to try it

```bash
npm run build && npm run preview      # the service worker needs a production build
# open the app, log in, browse a page, then:
#   DevTools > Network > Offline, and reload  ->  app opens, data still there
#   or Chrome > Application > Service Workers to inspect the shell cache
```

In the Android shells the service worker is irrelevant — the WebView loads the bundle from disk — but the
read cache does the same job for the API, so the behaviour a farmer sees is the same in all three builds.
