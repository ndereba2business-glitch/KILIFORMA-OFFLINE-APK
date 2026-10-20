# Native Android shell (Capacitor) — build notes

A second way to ship Kiliforma as an app, next to the Trusted Web Activity in `android/`.
Built and signed on 20 October 2026.

```
mobile/android/app/build/outputs/apk/release/app-release.apk   5.2 MB
deliverables/kiliforma-native-1.0.0.apk                        copy of the above
```

## What it is, and how it differs from the TWA

|  | Trusted Web Activity (`android/`) | Capacitor shell (`mobile/`) |
| --- | --- | --- |
| What runs | Chrome opens `https://kiliforma.com` | An Android WebView opens a **copy of the app bundled inside the APK** |
| Size | 1.06 MB (AAB) / 1.06 MB (APK) | 5.2 MB |
| Needs the website up | **Yes** — the app *is* the site | **No** — it loads `assets/public/index.html` |
| Browser bar | Hidden only once `assetlinks.json` is published at the domain | **Never appears** — nothing to delegate |
| Updates | Deploy to Vercel = every phone updates instantly | Requires a new APK; no OTA channel installed |
| Google sign-in | Works (real Chrome session) | **Broken by Google** — see below |
| Play submission | Same package id, same key | Same package id, same key |

Both use application id `com.kiliforma.app` and the **same signing key**, so Android treats them as one
app: installing one over the other replaces it, and data is kept.

## How it was built

```bash
bash mobile/build-apk.sh        # web build -> cap copy -> icons -> gradle assembleRelease
```

Verified with the Android build tools:

```
package: name='com.kiliforma.app' versionCode='1' versionName='1.0.0'
targetSdkVersion:'36'  minSdkVersion:'24'  compileSdkVersion:'36'
application-label:'Kiliforma'
launchable-activity: com.kiliforma.app.MainActivity
Signer #1 certificate SHA-256: 6c83459ba53952748c4d9124dbfde2807fd659ec4b98915f4f00e6d1fff2ccb3
```

Versions: Capacitor 8.5.3, Gradle 8.14.3, Android Gradle Plugin from the template, JDK 21, SDK 36.

## Things that had to be right, and why

| Setting | Value | Reason |
| --- | --- | --- |
| `webDir` | `../dist` | The native project does not carry its own copy of the source; `cap copy` pulls the built app in |
| `server.androidScheme` | `https` | Served from `https://localhost`, so secure-context APIs (crypto, service worker) behave like the web |
| `server.errorPath` | `index.html` | React Router uses the history API. Without this, a reload on `/marketplace` inside the WebView would show a blank error page |
| `captureInput` | `true` | The camera opens for `<input type="file" accept="image/*">` — the farm gallery and listing photos work unchanged |
| `allowMixedContent` | `false` | The app talks to Supabase over HTTPS only |
| `minifyEnabled` | `false` | Capacitor's proguard rules are tuned for the JS bridge; R8 breaks it unless the rules are maintained |
| `Gradle jvmargs` | `-Xmx1536m`, swap | At defaults on a 2 GB machine the daemon is killed mid-build |
| Node | **22+** | Capacitor 8 refuses to run on Node 20 (the web app itself is fine on 20) |

**`.gitignore` needed anchoring.** Entries like `android/app/` also match `mobile/android/app/` — the
Capacitor module, which is source and must be committed. Every Android path is now anchored with a leading
slash (`/android/app/`). This would have silently dropped the whole native project from the first commit.

## The one important caveat: Google sign-in

Google refuses OAuth inside an embedded WebView (`403 disallowed_useragent`). In this shell, the "Continue
with Google" button will fail. Email/password and phone sign-in work normally.

Two ways to fix it, either is small:

1. **Recommended:** intercept the OAuth click and open the system browser with a URL scheme return —
   `@capacitor/browser` + `@capacitor/app`. The app regains the session through the Supabase deep link.
2. Hide the Google button inside the shell and keep email/password there, leaving Google for the TWA/web.

Until one of those is done, the TWA remains the better choice for anyone who signs in with Google.

## Never run on a device

There is no `/dev/kvm` in this sandbox, so no Android emulator could run. The APK is signed and structurally
verified, and the web bundle inside it is the same build that passes the browser tests — but **the app has
never been opened on Android hardware**. Install it and check: launch, login, photo upload, back button,
and the same pages on a slow connection.
