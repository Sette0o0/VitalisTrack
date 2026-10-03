#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK_AVAILABLE_KB="$(df -Pk "$TASK_ROOT" | awk 'NR==2 { print $4 }')"
TASK_REQUIRED_KB=$(( ${ANDROID_BUILD_FREE_GB:-15} * 1024 * 1024 ))
if (( TASK_AVAILABLE_KB < TASK_REQUIRED_KB )); then
  printf 'Compilação Android pendente: disponíveis %s KiB; necessários pelo menos %s KiB para SDK/NDK/Gradle e APKs.\n' "$TASK_AVAILABLE_KB" "$TASK_REQUIRED_KB" >&2
  exit 78
fi
cd "$TASK_ROOT/app"
export ANDROID_QA=true
export NODE_ENV=production
export BABEL_ENV=production
pnpm exec expo prebuild --platform android --no-install
cd android
./gradlew --no-daemon --max-workers=2 assembleDebug assembleRelease
mkdir -p "$TASK_ROOT/artifacts/android"
cp app/build/outputs/apk/debug/app-debug.apk "$TASK_ROOT/artifacts/android/vitalis-debug.apk"
cp app/build/outputs/apk/release/app-release.apk "$TASK_ROOT/artifacts/android/vitalis-release.apk"
