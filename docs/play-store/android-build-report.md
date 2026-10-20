# Android build report — 20 October 2026

The first signed Android artifact for Kiliforma was produced on this date. This file records exactly what
was built, with what tools, what had to be fixed to get there, and what is still open. It is written for
whoever repeats the build, including the owner working alone.

## 1. What exists now

| Artifact | Path | Notes |
| --- | --- | --- |
| Signed app bundle (upload to Play) | `android/app/build/outputs/bundle/release/app-release.aab` (1.2 MB) | Copy kept as `kiliforma-1.0.0-release.aab` |
| Signed APK (install on a phone) | `android/app/build/outputs/apk/release/app-release.apk` (1.1 MB) | `adb install app-release.apk` |
| Signing key | `android/android.keystore` | PKCS12, alias `kiliforma-upload`, 10 000 days |
| Signing passwords | `android/SIGNING-KEY-CREDENTIALS.txt` | **Move to a password manager, then delete.** Git-ignored |
| Digital Asset Links | `public/.well-known/assetlinks.json` | Upload-key fingerprint only; Play signing fingerprint missing |

Verified with the Android build tools, not assumed:

```
package: name='com.kiliforma.app' versionCode='1' versionName='1.0.0'
targetSdkVersion:'36'   minSdkVersion:'24'   compileSdkVersion='36'
application-label:'Kiliforma'
launchable-activity: com.kiliforma.app.LauncherActivity
Signer #1 certificate SHA-256 digest: 6c83459ba53952748c4d9124dbfde2807fd659ec4b98915f4f00e6d1fff2ccb3
```

Source of the values: `android/twa-manifest.json` (`packageId`, `host`, colours, icons) and
`public/manifest.webmanifest`. Icons fetched from `https://kiliforma.com/icons/`; the shipped
`icon-512.png` was byte-identical to the one in `public/icons/`.

## 2. Tools used

| Tool | Version | Where |
| --- | --- | --- |
| Node.js | 20.20.2 | build machine |
| Bubblewrap CLI | 1.27.x (`@bubblewrap/cli`) | global npm install |
| JDK | OpenJDK 21.0.12 (Debian) | `openjdk-21-jdk-headless` |
| Android SDK platform | android-36 | command-line tools |
| Android build-tools | 36.0.0 | command-line tools |
| Android Gradle Plugin | 8.9.1 (from the Bubblewrap template) | `build.gradle` |
| Gradle | 8.11.1 (wrapper) | `gradle/wrapper/gradle-wrapper.properties` |

`bubblewrap init` is interactive and could not be driven reliably from a script here, so the project was
generated straight from the same library the CLI uses:

```js
const { TwaGenerator, TwaManifest } = require('@bubblewrap/cli/node_modules/@bubblewrap/core');
await new TwaGenerator().createTwaProject(androidDir, new TwaManifest(twaManifestJson), log);
```

The values passed were the ones already committed in `android/twa-manifest.json`, so the generated project
matches the repository's prepared settings. On the owner's own machine `bubblewrap init` is still the normal
route and produces the same project.

## 2a. Rebuild after the rename (20 October 2026, same day)

Everything named after Farmers Connect that is *this project's own* was renamed, and the bundle was rebuilt:

| Was | Now |
| --- | --- |
| application ID `ke.co.farmersconnect.app` | `com.kiliforma.app` |
| Java package `ke.co.farmersconnect.app` | `com.kiliforma.app` (sources moved to `android/app/src/main/java/com/kiliforma/app/`) |
| signing-key alias `farmersconnect-upload` | `kiliforma-upload` (changed inside the keystore with `keytool -changealias`, same key, same fingerprint) |
| `package_name` in `public/.well-known/assetlinks.json` | `com.kiliforma.app` |

Re-verified after the rebuild:

```
package: name='com.kiliforma.app' versionCode='1' versionName='1.0.0'
targetSdkVersion:'36'   minSdkVersion:'24'   compileSdkVersion='36'
application-label:'Kiliforma'
launchable-activity: com.kiliforma.app.LauncherActivity
Signer #1 certificate SHA-256 digest: 6c83459ba53952748c4d9124dbfde2807fd659ec4b98915f4f00e6d1fff2ccb3
```

One more stale name turned up and was fixed at the same time: `android/app/src/main/res/raw/web_app_manifest.json`,
the copy of the web app manifest that Bubblewrap downloads at init, still said "Farmers Connect" because it
came from the **live** site, which has not been redeployed with the rebrand. It was regenerated from this
repository's `public/manifest.webmanifest`, so the bundle no longer carries the old name anywhere.

The signing certificate is unchanged — only the alias and the package name changed. External addresses the
project does not own (`farmers-connect-azure.vercel.app`, the old Vercel preview host in `vercel.json`, the
GitHub clone URL) and one real Supabase account address in an applied migration were deliberately left alone;
`REBRAND_NOTES.md` lists them and why.

## 3. What had to change — three real defects in the generated project

| # | Change | Symptom without it |
| --- | --- | --- |
| 1 | `jcenter()` → `mavenCentral()` in the root `build.gradle` | jcenter is shut down; Android Gradle Plugin cannot be resolved |
| 2 | `minSdkVersion` 23 → **24** in `app/build.gradle` and `twa-manifest.json` | `processReleaseMainManifest` fails: `uses-sdk:minSdkVersion 23 cannot be smaller than version 24 declared in library [com.google.androidbrowserhelper:androidbrowserhelper:2.7.4]` |
| 3 | Removed `package="com.kiliforma.app"` from `app/src/main/AndroidManifest.xml` | Only a warning under AGP 8, but it will be an error later. The namespace comes from `build.gradle` |

Two more things were needed on a machine with 2 GB of RAM:

- `org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m` in `android/gradle.properties`. With the default
  heap the Gradle daemon was killed during R8 shrinking ("Gradle build daemon disappeared unexpectedly").
- 4 GB of swap enabled before the build.

All of the above live in `android/post-init-fixes.sh`, which is idempotent:

```bash
bash android/post-init-fixes.sh           # re-apply the fixes to a regenerated project
bash android/post-init-fixes.sh --build   # fix, then build .aab and .apk
```

## 4. How the web app was checked alongside the build

`npm ci && npm run dev` in the repository root serves the app at `http://localhost:5173`, pointed at the
production Supabase project (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `.env`, both public by
design). The landing page renders correctly and the app's own `manifest.webmanifest` is what the TWA was
generated from.

**One thing to know:** `https://kiliforma.com` still serves the **pre-rebrand** build. Its
`manifest.webmanifest` says `"name": "Farmers Connect"` and its bundle is the old one, while this repository
says Kiliforma. The domain is attached, but the rebranded build is not deployed to it yet. Since a TWA opens
whatever the domain serves, the Android app will show the old branding until that merge is deployed.

## 5. Still open before a Play upload

1. **Move the key material.** `android/android.keystore` and `android/SIGNING-KEY-CREDENTIALS.txt` into a
   password manager plus one offline backup, then delete the text file. Consider changing both passwords
   first: they have been in a chat.
2. **Play App Signing.** When the app is created in Play Console, copy the SHA-256 of the *app signing key*
   into `public/.well-known/assetlinks.json` (replace or append to the upload-key fingerprint) and deploy.
   Until then an app installed from Play keeps the browser bar.
3. **Deploy the rebrand** so the domain serves the Kiliforma build the manifest describes.
4. **Publish `assetlinks.json`** and check it with Google's statement-list endpoint — the file is only
   correct once that address returns JSON and not the app's HTML page.
5. **Install the APK on a real phone.** Nothing has been run on Android hardware; the app has never been
   opened as an Android app.
6. **Play Console paperwork** — listing, Data safety, content rating, audience, ads, app access, reviewer
   accounts — is unchanged and still open (`LAUNCH_CHECKLIST.md` sections 3.2, 4.4, 6 onwards).
7. **Policies.** Privacy Policy and Terms are still unpublished; Play requires a published policy
   (`VITE_POLICIES_PUBLISHED`).
8. **Application ID.** `com.kiliforma.app` was used because it is what the repository prepared. It is
   permanent after the first upload. If a different ID is wanted, change it now and rebuild.
