#!/usr/bin/env python3
"""Reject release APKs whose embedded configuration differs from this build."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
import platform
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('apk', type=Path)
parser.add_argument('--api-url', required=True)
qa_mode = parser.add_mutually_exclusive_group()
qa_mode.add_argument('--qa', action='store_true')
qa_mode.add_argument('--no-qa', action='store_true')
parser.add_argument('--package')
parser.add_argument('--font-scale', action='store_true')
args = parser.parse_args()
with zipfile.ZipFile(args.apk) as apk:
    bundle = apk.read('assets/index.android.bundle')
    # Hermes interns overlapping strings: byte substring matching can accept a
    # stale URL with a longer port/path. Compare decoded string-table entries.
    root = Path(__file__).resolve().parent.parent
    hermes_platform = {'Linux':'linux64-bin','Darwin':'osx-bin','Windows':'win64-bin'}[platform.system()]
    compiler = root / 'app/node_modules/react-native/sdks/hermesc' / hermes_platform / ('hermesc.exe' if platform.system() == 'Windows' else 'hermesc')
    strings = set()
    with tempfile.NamedTemporaryFile(suffix='.hbc') as temp:
        temp.write(bundle); temp.flush()
        proc = subprocess.Popen([str(compiler),'-dump-bytecode',temp.name],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
        try:
            entered = False
            for line in proc.stdout:
                if line.startswith('Global String Table:'):
                    entered = True
                    continue
                if entered and not line.strip():
                    break
                if entered:
                    match = re.match(r'^[is]\d+\[[^]]+\](?: #[A-Fa-f0-9]+)?: (.*)$',line.rstrip('\n'))
                    if match: strings.add(match.group(1))
        finally:
            proc.terminate(); proc.communicate()
    if args.api_url not in strings:
        raise SystemExit('APK recusado: endereço exato esperado ausente do bundle.')
    qa_marker = any(value.startswith('VITALIS_QA_READY ') for value in strings)
    if args.qa and not qa_marker:
        raise SystemExit('APK recusado: marcador de QA ausente do bundle.')
    if args.no_qa and qa_marker:
        raise SystemExit('APK recusado: marcador de QA presente no bundle do aplicativo normal.')
    abis = sorted({p.split('/')[1] for p in apk.namelist() if p.startswith('lib/')})
sdk = Path(os.environ.get('ANDROID_HOME', '/var/android-sdk'))
aapts = sorted(sdk.glob('build-tools/*/aapt'), key=lambda p: tuple(int(n) for n in re.findall(r'\d+',p.parent.name)))
if not aapts:
    raise SystemExit('Verificação interrompida: aapt não encontrado no Android SDK.')
badging = subprocess.check_output([str(aapts[-1]), 'dump', 'badging', str(args.apk)], text=True)
package = re.search(r"package: name='([^']+)'",badging).group(1)
expected = args.package or ('com.vitalistrack.qa' if args.qa else None)
if expected and package != expected:
    raise SystemExit('APK recusado: pacote diferente do esperado.')
minimum = int(re.search(r"sdkVersion:'(\d+)'",badging).group(1))
target = int(re.search(r"targetSdkVersion:'(\d+)'",badging).group(1))
if args.font_scale:
    manifest = subprocess.check_output([str(aapts[-1]), 'dump', 'xmltree', str(args.apk), 'AndroidManifest.xml'],text=True)
    activities = re.findall(r'^([ ]*)E: activity \(line=[^\n]+\)\n(.*?)(?=^\1E:|\Z)',manifest,re.M|re.S)
    main = next((body for _indent,body in activities if 'com.vitalistrack.app.MainActivity\"' in body),'')
    configs = re.findall(r'android:configChanges[^=]*=\(type 0x11\)0x([0-9a-fA-F]+)',main)
    if not any(int(value,16) & 0x40000000 for value in configs):
        raise SystemExit('APK recusado: tratamento de fontScale ausente do manifesto.')
if minimum != 24 or target != 36:
    raise SystemExit('APK recusado: minSdk/targetSdk diferentes de 24/36.')
print(json.dumps({'apk': str(args.apk), 'sha256': hashlib.sha256(args.apk.read_bytes()).hexdigest(),
                  'bundleSha256': hashlib.sha256(bundle).hexdigest(),
                  'package': package, 'minSdk':minimum, 'targetSdk':target, 'expectedApiUrl': args.api_url, 'qaMarker': qa_marker, 'abis': abis}, indent=2))
