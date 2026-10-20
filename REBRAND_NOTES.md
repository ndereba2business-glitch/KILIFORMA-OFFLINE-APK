# Kiliforma rebrand notes

This source ZIP has been rebranded from Farmers Connect to Kiliforma.

## Updated in the source
- Visible application name and brand references in the React app, login/onboarding screens, landing page, supplier/contact messages, and legal-policy app-name constant.
- HTML title and description, PWA manifest name/description, package metadata and auth-URL check default.
- Android Trusted Web Activity display name and target host URLs.
- Tests and project documentation where old public-facing brand/domain references were used.
- The split landing-page wordmark now reads “Kiliforma”.

## Renamed on 20 October 2026

The first pass left the technical identifiers as they were. They were renamed in full on 20 October 2026,
before anything was uploaded to Google Play, so none of it is permanent yet:

| Was | Now | Where |
| --- | --- | --- |
| Android application ID `ke.co.farmersconnect.app` | `com.kiliforma.app` | `android/twa-manifest.json`, `android/app/build.gradle`, the Java package (`android/app/src/main/java/com/kiliforma/app/`), `public/.well-known/assetlinks.json` |
| Signing-key alias `farmersconnect-upload` | `kiliforma-upload` | `android/android.keystore` (`keytool -changealias`), `android/keystore.properties`, `android/twa-manifest.json`, `android/SIGNING-KEY-CREDENTIALS.txt` |
| Supabase local CLI `project_id` `farmersconnect` | `kiliforma` | `supabase/config.toml` (local tooling only; the hosted project is untouched) |

One user-facing string was also renamed: the notification a farmer gets when their vet deletes their account
said "is no longer on Farmers Connect". Applied migrations are never edited, so it is changed by a new
migration, `supabase/migrations/20261020120000_rebrand_account_deletion_notification.sql`, which replaces
`delete_account_data` with the same body and the new wording. **It has to be pushed** (`npx supabase db push`)
before the live app says Kiliforma there.

The application ID can still be changed freely until the first Play upload. After that it cannot change ever;
changing it means rebuilding, re-publishing `assetlinks.json`, and publishing a new app entry.

## Visual identity (20 October 2026)

The rooster artwork is gone, replaced by the owner's new app icon: a "K" built as a gold roof truss with white
rivets, crossed by a green leaf, on a dark forest-green tile (`#172E1E`). The wordmark beside it is now split
**Kili / forma** instead of **Farmers / Connect**.

| What | Where |
| --- | --- |
| Traced vectors of the artwork (gold, green, cream layers) | `src/components/brandMarkArt.js` |
| The in-app mark, the lockup and its two-tone wordmark | `src/components/BrandMark.jsx` |
| Navigation, sidebar, supplier shell and landing-page wordmarks | `Layout.jsx`, `SupplierShell.jsx`, `LandingNav.jsx` |
| Favicon and PWA icons | `public/favicon.svg`, `public/icons/*.png` — rebuilt with `node scripts/build-icons.mjs` |
| Android launcher, adaptive, splash and store icons | `android/app/src/main/res/**`, `android/store_icon.png` — rebuilt with `node scripts/build-android-icons.mjs` |

The artwork was vectorised rather than redrawn: `scripts/trace-brand-mark.py` finds the tile in the supplied
JPEG, separates its four colours and traces each layer with potrace, so the app, the website, the favicon and
the Android icons all draw the same paths from one file. Re-run it against a new picture to update them.

The Android icons needed their own generator because `bubblewrap init` downloads them from the live site,
which still serves the pre-rebrand build — a freshly generated project would have brought the rooster back.

## Intentionally not changed
- Supabase project linkage, environment variable names, database schema, migrations, credentials, auth logic, storage, and Edge Functions' behavior.
- **External addresses that this repository does not own**, which would break if renamed:
  - `farmers-connect-azure.vercel.app` and `farmers-connect-fidelis-ndereba-s-projects.vercel.app` — live Vercel hostnames. `vercel.json` still forwards the second one to `kiliforma.com`; renaming the string there would silently stop the redirect.
  - `https://github.com/ndereba2business-glitch/farmers_connect.git` — the repository's own clone URL in `README.md`.
- **One real account address**: `userfarmersconnect@gmail.com` in
  `supabase/migrations/20260916200000_secure_admin_role.sql`. It selects an existing Supabase auth user; the
  migration is already applied and changing the address in the file would not rename the account and would make
  the file disagree with production.
- The existing rooster artwork used by the logo/favicon/app icons. It contains no Farmers Connect text, but it remains poultry-oriented; replace it with a Kiliforma agriculture-wide mark in a separate visual-identity pass if desired.

## Before deploying
1. Add `kiliforma.com` to the existing Vercel project and complete Vercel's DNS verification instructions at the domain registrar.
2. In Supabase Authentication URL Configuration, add `https://kiliforma.com/**` to allowed redirect URLs. Keep the old Vercel production URL during the transition. Set the Site URL to `https://kiliforma.com` only after the domain is working.
3. Review email templates and any external OAuth provider authorized redirect settings.
4. Run `npm ci`, `npm run build`, `npm run lint`, and `npm run test:unit` in a normal development environment. The build could not be completed in this packaging environment because dependency installation timed out. Three unit-test files also fail to load TypeScript modules under the available Node runtime; other tests ran.
5. Verify login, email confirmation, Google sign-in, password reset, Clucky AI, farmer/vet/supplier dashboards, marketplace, community and admin before treating the migration as complete.

This ZIP does not itself change Vercel, DNS, Supabase dashboard settings, the live database, or the live deployment. The old production URL remains the fallback until the new domain is configured and tested.
