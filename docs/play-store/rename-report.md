# Rename: Farmers Connect → Kiliforma

Done 20 October 2026 in `/home/user/kiliforma`. This is the record of exactly what changed, what was
deliberately left alone, and how it was verified.

## 1. Renamed

| Was | Now | Files |
| --- | --- | --- |
| Android application ID `ke.co.farmersconnect.app` | **`com.kiliforma.app`** | `android/twa-manifest.json`, `android/app/build.gradle` (twice), `public/.well-known/assetlinks.json`, docs |
| Java package `ke.co.farmersconnect.app` | **`com.kiliforma.app`** | sources moved to `android/app/src/main/java/com/kiliforma/app/` (`Application`, `LauncherActivity`, `DelegationService`) |
| Signing-key alias `farmersconnect-upload` | **`kiliforma-upload`** | changed inside the keystore with `keytool -changealias`, plus `android/keystore.properties`, `android/twa-manifest.json`, `android/SIGNING-KEY-CREDENTIALS.txt` |
| Supabase local CLI `project_id` `farmersconnect` | **`kiliforma`** | `supabase/config.toml` (local tooling only; the hosted project is untouched) |
| `# CLAUDE.md — farmers_connect` | `# CLAUDE.md — Kiliforma` | `CLAUDE.md` |
| Stale `"name": "Farmers Connect"` in the bundled web manifest | `"Kiliforma"` | `android/app/src/main/res/raw/web_app_manifest.json`, regenerated from `public/manifest.webmanifest` |
| Notification text "…is no longer on Farmers Connect." | "…is no longer on **Kiliforma**." | new migration `supabase/migrations/20261020120000_rebrand_account_deletion_notification.sql` |

The signing certificate is unchanged: same key, same SHA-256
`6C:83:45:9B:A5:39:52:74:8C:4D:91:24:DB:FD:E2:80:7F:D6:59:EC:4B:98:91:5F:4F:00:E6:D1:FF:F2:CC:B3`.

## 1a. The new mark and wordmark (same day)

The rooster artwork was replaced with the owner's new app icon and the wordmark changed from
"Farmers Connect" to **Kili/forma**:

- `src/components/brandMarkArt.js` now holds traced paths for the new mark (gold truss, green leaf, cream
  rivets on a `#172E1E` tile), produced by `scripts/trace-brand-mark.py` from the supplied JPEG.
- `BrandMark.jsx`, `Layout.jsx`, `SupplierShell.jsx`, `LandingNav.jsx`: the visible name is now Kili/forma.
- `public/favicon.svg` and `public/icons/*` were rebuilt (`node scripts/build-icons.mjs`).
- Android launcher / adaptive / splash / store icons were rebuilt from the same paths
  (`node scripts/build-android-icons.mjs`), and `mipmap-anydpi-v26/ic_launcher.xml` now paints the tile
  colour and uses the artwork as the foreground layer.

## 2. Deliberately not renamed

| Kept | Why |
| --- | --- |
| `farmers-connect-azure.vercel.app`, `farmers-connect-fidelis-ndereba-s-projects.vercel.app` (in `vercel.json`, `README.md`, `CLAUDE.md`, `FINAL_HANDOVER.md`) | Live Vercel hostnames this repository does not own. `vercel.json` forwards the second to `kiliforma.com`; renaming the string would silently kill that redirect |
| `github.com/ndereba2business-glitch/farmers_connect.git` (README clone URL) | The repository's own address on GitHub. Rename it on GitHub and this line changes with it |
| `userfarmersconnect@gmail.com` (in an already-applied migration) | It selects a real Supabase auth user. Editing the file would not rename the account, and would make the file disagree with production |
| The word "farmers" everywhere else (~150 places in `src/`) | It means the users — poultry farmers — not the brand |

## 3. Verification

| Check | Result |
| --- | --- |
| `npm run build` | passes |
| `npm run lint` | 31 problems (14 errors, 17 warnings) — the same baseline as before, none new |
| Unit tests (`node --test tests/unit/*.test.js`) | 71 tests, 68 pass, 3 fail. The 3 are the known `ERR_UNKNOWN_FILE_EXTENSION ".ts"` failures: Node 20 cannot import `supabase/functions/*/*.ts`. Nothing to do with the rename |
| `npm run test:e2e` | 218 tests, 215 pass, 3 fail — all three in `supplier-dashboard.test.js` (product delete/list flow in the mock backend). **Pre-existing**: they fail identically with my only source change reverted |
| `npm run check:secrets` | no secret in the built app |
| Android rebuild | `BUILD SUCCESSFUL`; `aapt2 dump badging` reports `package: name='com.kiliforma.app'`, label `Kiliforma`, launcher `com.kiliforma.app.LauncherActivity`, target SDK 36, min SDK 24 |
| Stale names inside the artifacts | `strings` over `AndroidManifest.xml` and `resources.pb` of the new `.aab`: no "farmers connect" |

Artifacts rebuilt and copied after the icon change: `deliverables/kiliforma-1.0.0-release.aab` (1.15 MB),
`deliverables/kiliforma-1.0.0-release.apk` (1.06 MB), plus the Play listing icon
`deliverables/kiliforma-play-store-icon-512.png`.

## 4. Two things to do

1. **Push the new migration** so the live app stops saying Farmers Connect in that one notification:
   `npx supabase db push`. Then `npm run test:security` and `npx supabase db advisors --linked`.
2. **Deploy the web app.** `https://kiliforma.com` still serves the old "Farmers Connect" build; the rename
   only reaches users when `main` is redeployed. The `assetlinks.json` with the new package name is in the
   repo but not published yet either.
