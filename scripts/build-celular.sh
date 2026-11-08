#!/usr/bin/env bash
set -euo pipefail

presentation_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$presentation_root"
export JAVA_HOME="${JAVA_HOME:-/opt/java/default}"
export ANDROID_HOME="${ANDROID_HOME:-/var/android-sdk}"
export ANDROID_QA=false
export EXPO_PUBLIC_ANDROID_QA=false
export ANDROID_ALLOW_LOCAL_HTTP="${ANDROID_ALLOW_LOCAL_HTTP:-true}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://127.0.0.1:3000}"
export NODE_ENV=development

pnpm install --frozen-lockfile
pnpm --filter @vitalis/contracts build
# Sem --clean: conserva a chave local usada para atualizar o aplicativo existente.
pnpm -C app exec expo prebuild --platform android --no-install

# RN's settings cache does not include the workspace's pnpm lockfile as an input.
# A versioned package patch can change native source paths without changing app/package.json.
# Regenerate only autolinking metadata; signing keys and installed application data are untouched.
python3 - <<'PY_CACHE'
from pathlib import Path
import shutil
cache = Path('app/android/build/generated/autolinking')
if cache.exists():
    shutil.rmtree(cache)
PY_CACHE

export NODE_ENV=production
export BABEL_ENV=production
cd app/android
# Gradle does not track EXPO_PUBLIC_* as bundle inputs. Rebuild explicitly,
# then assemble from that bundle; preserve signing keys and native caches.
./gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks -PreactNativeArchitectures="${ANDROID_ABIS:-arm64-v8a}" --no-daemon --max-workers=2
./gradlew :app:assembleRelease -PreactNativeArchitectures="${ANDROID_ABIS:-arm64-v8a}" --no-daemon --max-workers=2
cd "$presentation_root"
python3 scripts/check-native-font-flags.py
python3 scripts/verify-android-bundle.py app/android/app/build/outputs/apk/release/app-release.apk --api-url "$EXPO_PUBLIC_API_URL" --no-qa --package com.vitalistrack.app --font-scale
mkdir -p artifacts/android
presentation_hash=$(sha256sum app/android/app/build/outputs/apk/release/app-release.apk | cut -c1-8)
presentation_apk="artifacts/android/vitalis-celular-${presentation_hash}-${ANDROID_ABIS:-arm64-v8a}.apk"
cp app/android/app/build/outputs/apk/release/app-release.apk "$presentation_apk"
echo "APK gerado: $presentation_root/$presentation_apk"
echo 'Para atualizar o VitalisTrack mantendo seus dados (requer a mesma assinatura):'
printf '%q -d install -r %q\n' "$ANDROID_HOME/platform-tools/adb" "$presentation_root/$presentation_apk"
