#!/usr/bin/env bash
# Apply the three fixes the first real build needed, then build.
#
# `bubblewrap init` regenerates android/ from its template, which brings back
# jcenter(), minSdkVersion 23 and a signing config that has to be wired by the
# CLI. This script re-applies what the working build uses, so a regenerated
# project builds again without re-deriving any of it. It is safe to re-run.
#
# Usage:  bash android/post-init-fixes.sh          (fix only)
#         bash android/post-init-fixes.sh --build  (fix, then build .aab + .apk)

set -euo pipefail
cd "$(dirname "$0")"

# 1. jcenter() has been shut down; mavenCentral() serves the same artifacts.
sed -i 's/jcenter()/mavenCentral()/g' build.gradle

# 2. com.google.androidbrowserhelper:androidbrowserhelper:2.7.4 declares
#    minSdkVersion 24. With 23 the manifest merger fails outright.
sed -i 's/minSdkVersion 23/minSdkVersion 24/' app/build.gradle
python3 - <<'PY'
import json
p = 'twa-manifest.json'
d = json.load(open(p))
d['minSdkVersion'] = 24
json.dump(d, open(p, 'w'), indent=2)
open(p, 'a').write('\n')
PY

# 3. The namespace comes from build.gradle now; the package attribute is ignored
#    (and warned about) by AGP 8.
sed -i 's/ package="com.kiliforma.app"//' app/src/main/AndroidManifest.xml

# 4. Signing: read android/keystore.properties if it exists.
python3 - <<'PY'
p = 'app/build.gradle'
s = open(p).read()
if 'keystorePropertiesFile' not in s:
    s = s.replace("""android {
    compileSdkVersion""", """// Signing details live in android/keystore.properties, which is not committed.
def keystorePropertiesFile = rootProject.file('keystore.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    compileSdkVersion""", 1)
    s = s.replace("""    buildTypes {
        release {
            minifyEnabled true
        }
    }""", """    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            minifyEnabled true
            signingConfig signingConfigs.release
        }
    }""", 1)
    open(p, 'w').write(s)
PY

# 5. A 2 GB machine builds this only with a small heap and some swap.
if [ ! -f gradle.properties ]; then
  cat > gradle.properties <<PROPS
org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8
org.gradle.parallel=false
org.gradle.daemon=false
android.useAndroidX=true
android.nonTransitiveRClass=true
PROPS
fi

# 6. `bubblewrap init` takes the launcher and splash icons from the live site,
#    which still serves the pre-rebrand artwork. Render them from the repository
#    instead (needs the Playwright browser the e2e tests already use).
if [ -d ../node_modules ] || [ -n "${NODE_PATH:-}" ]; then
  ( cd .. && node scripts/build-android-icons.mjs ) || \
    echo "WARNING: could not regenerate the icons; the launcher icon will be the site's artwork" >&2
fi

echo "post-init fixes applied"

if [ "${1:-}" = "--build" ]; then
  ./gradlew bundleRelease assembleRelease --no-daemon --console=plain
  echo "built: app/build/outputs/bundle/release/app-release.aab"
  echo "       app/build/outputs/apk/release/app-release.apk"
fi
