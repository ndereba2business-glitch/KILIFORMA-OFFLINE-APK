#!/usr/bin/env bash
# Builds the signed native Android APK (Capacitor shell).
#
#   bash mobile/build-apk.sh
#
# What this does, in order:
#   1. builds the web app from ../ into dist/
#   2. copies dist/ into the native project (cap copy)
#   3. renders the launcher, adaptive and splash icons from the brand artwork
#   4. assembles and signs app-release.apk
#
# Prerequisites (none of these are in the repository):
#   - Node 22 or newer ON PATH: Capacitor 8 refuses to run on Node 20.
#       curl -sL https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz | tar -xJ -C /opt
#       export PATH=/opt/node-v22.20.0-linux-x64/bin:$PATH
#   - JDK 21:                       sudo apt-get install openjdk-21-jdk-headless
#   - Android SDK, platform 36, build-tools 36.0.0
#       export ANDROID_HOME=/opt/android-sdk
#       echo "sdk.dir=$ANDROID_HOME" > mobile/android/local.properties
#   - mobile/android/keystore.properties (not committed; see the .example file)
#   - swap or >= 4 GB RAM; Gradle is killed at defaults on a 2 GB machine
set -euo pipefail
cd "$(dirname "$0")/.."

export ANDROID_HOME=${ANDROID_HOME:-/opt/android-sdk}
export ANDROID_SDK_ROOT=$ANDROID_HOME
export JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}
export GRADLE_USER_HOME=${GRADLE_USER_HOME:-/opt/gradle-home}

if ! node -e 'process.exit(process.versions.node.split(".")[0] >= 22 ? 0 : 1)'; then
  echo "ERROR: Capacitor 8 needs Node 22+. Current: $(node -v)" >&2
  exit 1
fi
if [ ! -f mobile/android/keystore.properties ]; then
  echo "ERROR: mobile/android/keystore.properties is missing." >&2
  echo "Copy mobile/android/keystore.properties.example and fill in the key store path and passwords." >&2
  exit 1
fi

echo "==> 1/4 building the web app"
npm run build

echo "==> 2/4 copying the web app into the native shell"
( cd mobile && npm ci --no-audit --no-fund && npx cap copy android )

echo "==> 3/4 rendering icons and splash screens"
( cd . && node scripts/build-android-icons.mjs )

echo "==> 4/4 assembling the signed APK"
( cd mobile/android && ./gradlew assembleRelease --no-daemon --console=plain )

APK=mobile/android/app/build/outputs/apk/release/app-release.apk
echo
echo "built: $APK  ($(du -m "$APK" | cut -f1) MB)"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs "$APK" | head -3
