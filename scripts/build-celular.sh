#!/usr/bin/env bash
set -euo pipefail

presentation_root=/home/rafael/Documentos/github/VitalisTrack
cd "$presentation_root"
export JAVA_HOME=/opt/java/default
export ANDROID_HOME=/var/android-sdk
export ANDROID_QA=true
export EXPO_PUBLIC_ANDROID_QA=true
export EXPO_PUBLIC_API_URL=http://127.0.0.1:3011
export NODE_ENV=development

pnpm install --frozen-lockfile
pnpm --filter @vitalis/contracts build
# Sem --clean: conserva a chave local usada para atualizar o APK existente.
pnpm -C app exec expo prebuild --platform android --no-install

# Somente o projeto Android gerado recebe a identidade do app de QA.
presentation_backup=$(mktemp -d /tmp/vitalis-phone-build.XXXXXX)
cp app/android/app/build.gradle "$presentation_backup/build.gradle"
cp app/android/app/src/main/res/values/strings.xml "$presentation_backup/strings.xml"
presentation_restore() {
    cp "$presentation_backup/build.gradle" "$presentation_root/app/android/app/build.gradle"
    cp "$presentation_backup/strings.xml" "$presentation_root/app/android/app/src/main/res/values/strings.xml"
    rm -r "$presentation_backup"
}
trap presentation_restore EXIT

python3 - <<'PY'
from pathlib import Path
import re
import xml.etree.ElementTree as ET
p = Path('app/android/app/build.gradle')
text, count = re.subn(r"applicationId\s+['\"]com\.vitalistrack\.(?:app|qa)['\"]", "applicationId 'com.vitalistrack.qa'", p.read_text())
if count != 1:
    raise SystemExit('applicationId inesperado; build interrompido.')
p.write_text(text)
p = Path('app/android/app/src/main/res/values/strings.xml')
tree = ET.parse(p)
label = tree.getroot().find("string[@name='app_name']")
if label is None:
    raise SystemExit('Nome do app ausente; build interrompido.')
label.text = 'VitalisTrack QA'
tree.write(p, encoding='utf-8', xml_declaration=True)
PY

export NODE_ENV=production
export BABEL_ENV=production
cd app/android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon --max-workers=2
cd "$presentation_root"
mkdir -p artifacts/android
presentation_hash=$(sha256sum app/android/app/build/outputs/apk/release/app-release.apk | cut -c1-8)
presentation_apk="artifacts/android/vitalis-celular-qa-${presentation_hash}-arm64.apk"
cp app/android/app/build/outputs/apk/release/app-release.apk "$presentation_apk"
echo "APK gerado: $presentation_root/$presentation_apk"
echo 'Para instalar a atualização mantendo os dados do app de QA:'
echo "/var/android-sdk/platform-tools/adb -d install -r $presentation_root/$presentation_apk"
