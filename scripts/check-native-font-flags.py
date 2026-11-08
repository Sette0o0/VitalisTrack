#!/usr/bin/env python3
"""Compare the compiled app's renderer flags with RN 0.81.5 stable defaults."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
sdk = Path(os.environ.get('ANDROID_HOME', '/var/android-sdk'))
gradle = Path(os.environ.get('GRADLE_USER_HOME', str(Path.home() / '.gradle')))
cache = gradle / 'caches/modules-2/files-2.1'
aar = next((cache / 'com.facebook.react/react-android/0.81.5').glob('*/react-android-0.81.5-release.aar'))
kotlin = sorted((cache / 'org.jetbrains.kotlin/kotlin-stdlib').glob('*/*/kotlin-stdlib-*.jar'), key=lambda p: p.name != 'kotlin-stdlib-2.1.20.jar')
if not kotlin:
    raise SystemExit('Kotlin standard library missing from Gradle cache.')
classes = root / 'app/android/app/build/tmp/kotlin-classes/release'
if not (classes / 'com/vitalistrack/platform/VitalisReactNativeKt.class').exists():
    raise SystemExit('Compiled font-scale provider missing. Build release first.')
java = Path(os.environ['JAVA_HOME']) / 'bin' if os.environ.get('JAVA_HOME') else None
with tempfile.TemporaryDirectory(prefix='vitalis-native-flags-') as directory:
    temp = Path(directory)
    with zipfile.ZipFile(aar) as archive:
        (temp / 'react-android.jar').write_bytes(archive.read('classes.jar'))
    classpath = os.pathsep.join(map(str, [temp, classes, temp / 'react-android.jar', sdk / 'platforms/android-36/android.jar', *kotlin]))
    subprocess.run([str(java / 'javac') if java else shutil.which('javac'), '-cp', classpath,
                    '-d', str(temp), str(root / 'scripts/CheckNativeFontFlags.java')], check=True)
    subprocess.run([str(java / 'java') if java else shutil.which('java'), '-cp', classpath, 'CheckNativeFontFlags'], check=True)
