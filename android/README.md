# android/

Settings for packaging Kiliforma as an Android app (a Trusted Web Activity built with Bubblewrap).

The domain values below are migration targets, not proof that `kiliforma.com` is already configured. Attach and verify the domain in Vercel and update Supabase Auth URLs before building or publishing the Android app.
The full guide, including signing and Digital Asset Links, is `docs/play-store/android-release.md`.

**A signed bundle was built on 20 October 2026** and the Gradle project lives in this folder, but the project
files, the key store and the `.aab` are git-ignored on purpose: `bubblewrap init` regenerates the project, and
`bash android/post-init-fixes.sh --build` then re-applies the three fixes the build needs and produces both
`app-release.aab` and `app-release.apk`. Details: `docs/play-store/android-release.md` and
`docs/play-store/android-build-report.md`.

Files that are kept in git: this README, `twa-manifest.json` and `post-init-fixes.sh`. Files that are not:
`android.keystore`, `keystore.properties`, `SIGNING-KEY-CREDENTIALS.txt`, `app/`, `build/`, `*.aab`, `*.apk`.

## `twa-manifest.json`

| Setting | Value | Change it? |
| --- | --- | --- |
| `packageId` | `com.kiliforma.app` | **Decide before the first upload. It can never be changed afterwards.** It should be a reversed domain you control |
| `host`, `fullScopeUrl`, `webManifestUrl`, icon URLs | `kiliforma.com` | Target domain; verify DNS and Vercel before packaging. The app is tied to this address |
| `themeColor`, `backgroundColor` and their dark versions | The app's brand green, page colour, and dark page colour | Keep in step with `public/manifest.webmanifest` and `src/lib/theme.js` |
| `enableNotifications` | `false` | The app has in-app notifications only. Leave off: turning it on adds a notification permission that would have to be declared |
| `features.locationDelegation` | off | The app does not use location |
| `features.playBilling` | off | Nothing is sold in the app |
| `minSdkVersion` | **24** (Android 7) | Changed from 23 on 20 Oct 2026: `androidbrowserhelper:2.7.4` refuses to build below 24 |
| target SDK | not set here | It comes from Bubblewrap's template (API 36 in version 1.27.0). Confirm it in the generated `app/build.gradle` |
| `appVersionCode` | 1 | Must go up by at least 1 for every upload to Play |
| `signingKey.path` | `./android.keystore` | Created by `bubblewrap init`. **Never commit it.** |

Signing in with Google leaves the app's address for Supabase's and Google's pages and comes back. During
that trip Android shows a thin browser bar, which is how a Trusted Web Activity signals a different site.
That is expected and cannot be removed for sites you do not own.
