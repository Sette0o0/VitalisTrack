#!/usr/bin/env bash
set -euo pipefail

# Seleciona somente o aparelho USB; emuladores não são usados.
presentation_adb=/var/android-sdk/platform-tools/adb
presentation_scrcpy=/home/rafael/.codex/visualizations/2026/10/04/01a1043a-9691-7b90-bff0-5984c4ba4cd5/tools/scrcpy-linux-x86_64-v4.1/scrcpy

if [[ ! -x "$presentation_adb" || ! -x "$presentation_scrcpy" ]]; then
    echo 'O adb ou a versão portátil do scrcpy não está disponível neste computador.' >&2
    exit 1
fi

"$presentation_adb" -d get-state >/dev/null
"$presentation_adb" -d shell pm path com.vitalistrack.qa >/dev/null

# O APK de QA acessa a API local por esta ponte USB.
if python3 - <<'PY'
import urllib.request
try:
    with urllib.request.urlopen('http://127.0.0.1:3012/ready', timeout=3) as response:
        assert response.status == 200
except Exception:
    raise SystemExit(1)
PY
then
    "$presentation_adb" -d reverse tcp:3011 tcp:3012
else
    echo 'API ou banco de QA indisponível: os fluxos online precisam de ambos. O espelhamento continuará.' >&2
fi

"$presentation_adb" -d shell am start -n com.vitalistrack.qa/com.vitalistrack.app.MainActivity

export ADB="$presentation_adb"
exec "$presentation_scrcpy" --select-usb --no-control --no-audio \
    --max-size=1920 --max-fps=30 --window-height=900 \
    --window-title='VitalisTrack - Celular' "$@"
