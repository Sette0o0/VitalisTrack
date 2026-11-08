"""Legacy UI smoke, restricted to explicit QA emulators. Never changes the clock.

Its worker inspection is diagnostic only. Full native/SQLite/server acceptance is
recorded by the Sprint 2 consolidated validation, not inferred from a log line.
"""
import argparse
import json
import re
import subprocess
import sys
import time
import uuid
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('serial', choices=['emulator-5580','emulator-5582'])
parser.add_argument('--package', required=True, choices=['com.vitalistrack.qa'])
parser.add_argument('--api-port', type=int, default=3020)
parser.add_argument('--worker-only', action='store_true')
args = parser.parse_args()
serial, package = args.serial, args.package
root = Path(__file__).resolve().parents[1] / 'artifacts' / ('sprint2-legacy-'+time.strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:8]) / serial
api = 'http://127.0.0.1:'+str(args.api_port)
token = None

def adb(*args, timeout=20):
    return subprocess.check_output(['adb', '-s', serial, *args], timeout=timeout, stderr=subprocess.STDOUT).decode(errors='replace')

if adb('shell','getprop','ro.kernel.qemu').strip() != '1':
    raise RuntimeError('Physical devices are refused')
if adb('shell','getprop','ro.build.version.sdk').strip() not in ('24','36'):
    raise RuntimeError('Only API 24/36 emulators are allowed')
if 'package:' not in adb('shell','pm','path',package):
    raise RuntimeError('Install the QA package before running this smoke')
root.mkdir(parents=True, exist_ok=False)
network_before = {name: adb('shell','settings','get','global',key).strip() for name,key in [('wifi','wifi_on'),('data','mobile_data')]}
camera_before = 'android.permission.CAMERA: granted=true' in adb('shell','dumpsys','package',package)

def network(enabled):
    command = ['svc', 'wifi', 'enable' if enabled else 'disable']
    if int(adb('shell', 'getprop', 'ro.build.version.sdk').strip()) < 26:
        adb('shell', 'su', '0', *command)
        adb('shell', 'su', '0', 'svc', 'data', 'enable' if enabled else 'disable')
    else:
        adb('shell', *command)
        adb('shell', 'svc', 'data', 'enable' if enabled else 'disable')

def request(path, body=None, profile=None):
    headers = {'content-type': 'application/json'}
    if token:
        headers['authorization'] = 'Bearer ' + token
    if profile:
        headers['x-profile-id'] = profile
    req = urllib.request.Request(api + path, json.dumps(body).encode() if body else None, headers=headers)
    return json.load(urllib.request.urlopen(req, timeout=20))['data']

def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/sprint2-ui.xml')
    data = adb('shell', 'cat', '/sdcard/sprint2-ui.xml')
    (root / 'last.xml').write_text(data)
    return ET.fromstring(data)

def find(label, field=False, scroll=True):
    for i in range(18 if scroll else 1):
        tree = dump()
        nodes = [n for n in tree.iter('node') if label in (n.get('text'), n.get('content-desc'), n.get('resource-id')) and (not field or n.get('class') == 'android.widget.EditText')]
        if nodes:
            return nodes[0]
        if scroll:
            direction = 'down' if i < 5 or i >= 10 else 'up'
            swipe(direction)
    raise RuntimeError('Control not found: ' + label)

def swipe(direction):
    size = adb('shell', 'wm', 'size')
    w, h = map(int, re.findall('(\\d+)x(\\d+)', size)[-1])
    x = w // 2
    y1, y2 = (int(h * 0.77), int(h * 0.3)) if direction == 'down' else (int(h * 0.3), int(h * 0.77))
    adb('shell', 'input', 'swipe', str(x), str(y1), str(x), str(y2), '350')

def tap(label, field=False, scroll=True):
    node = find(label, field, scroll)
    x1, y1, x2, y2 = map(int, re.findall('\\d+', node.get('bounds')))
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
    time.sleep(0.35)

def fill(label, value):
    tap(label, field=True)
    adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
    tree = dump()
    node = next((n for n in tree.iter('node') if n.get('class') == 'android.widget.EditText' and n.get('focused') == 'true'), None)
    if node is not None and node.get('text'):
        for _ in range(min(len(node.get('text')), 120)):
            adb('shell', 'input', 'keyevent', 'KEYCODE_DEL')
    adb('shell', 'input', 'text', value.replace(' ', '%s'))
    adb('shell', 'input', 'keyevent', '4')
    time.sleep(0.2)

def wait(label, seconds=30):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        tree = dump()
        if any((label in (n.get('text'), n.get('content-desc')) for n in tree.iter('node'))):
            return
        time.sleep(0.5)
    raise RuntimeError('Screen not reached: ' + label)

def link(path):
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'vitalistrack://' + path, package)
    time.sleep(1)

def capture(name):
    (root / (name + '.png')).write_bytes(subprocess.check_output(['adb', '-s', serial, 'exec-out', 'screencap', '-p']))
    (root / (name + '.xml')).write_text(adb('shell', 'cat', '/sdcard/sprint2-ui.xml'))

def check_background():
    jobs = adb('shell','dumpsys','jobscheduler')
    relevant = [line for line in jobs.splitlines() if package in line and 'SystemJobService' in line]
    (root/'jobscheduler-qa.txt').write_text('\n'.join(relevant))
    result = {'serial':serial,'package':package,'backgroundJobRegistered':bool(relevant),'forcedJob':None,'backgroundCompleted':None,'status':'blocked','reason':'Legacy inspection cannot prove native completion; use persisted WorkManager, JS, SQLite and server evidence. Clock unchanged.'}
    (root/'background-checks.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result),flush=True)
    return result

def main():
    global token
    network(True)
    adb('logcat', '-c')
    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'monkey', '-p', package, '1')
    time.sleep(2)
    tree = dump()
    if not any((n.get('content-desc') == 'E-mail' for n in tree.iter('node'))):
        link('profile')
        tap('Sair da conta')
        wait('Entre na sua conta')
    email = f's2-{serial}-{uuid.uuid4().hex[:8]}@example.com'
    account = request('/v1/auth/register', {'name': 'QA Sprint 2', 'email': email, 'password': 'qa-12345678', 'passwordConfirmation': 'qa-12345678'})
    token = account['tokens']['accessToken']
    owner = account['profile']['id']
    (root / 'account.json').write_text(json.dumps({'userId': owner, 'email': email}))
    fill('E-mail', email)
    fill('Senha', 'qa-12345678')
    tap('Entrar')
    wait('Seu resumo')
    print(serial, 'login passed', flush=True)
    capture('01-home')
    tap('Perfil')
    wait('Perfis de saúde')
    fill('Nome do novo perfil', 'Familiar QA')
    tap('Cadastrar perfil')
    family = None
    for _ in range(30):
        family = next((p for p in request('/v1/profiles') if not p['isPrimary']), None)
        if family:
            break
        time.sleep(1)
    if not family:
        raise RuntimeError('Secondary profile did not synchronize')
    tap('Familiar QA')
    time.sleep(1)
    print(serial, 'profile created/selected', flush=True)
    link('water')
    wait('Hidratação')
    tap('water-200')
    wait('200 mL')
    capture('02-secondary-water')
    for _ in range(30):
        if len(request('/v1/water', profile=family['id'])) == 1:
            break
        time.sleep(1)
    assert len(request('/v1/water', profile=owner)) == 0
    assert len(request('/v1/water', profile=family['id'])) == 1
    network(False)
    time.sleep(2)
    tap('water-200')
    wait('400 mL')
    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'monkey', '-p', package, '1')
    wait('Seu resumo')
    link('water')
    wait('400 mL')
    capture('03-offline-restored')
    network(True)
    for _ in range(35):
        if len(request('/v1/water', profile=family['id'])) == 2:
            break
        time.sleep(1)
    assert len(request('/v1/water', profile=family['id'])) == 2
    print(serial, 'offline restart and reconnect passed', flush=True)
    link('profile/nutrition')
    wait('Perfil nutricional')
    fill('Restrições alimentares', 'lactose')
    tap('Salvar perfil nutricional')
    for _ in range(20):
        nutrition = request('/v1/nutrition-profile', profile=family['id'])
        if nutrition:
            break
        time.sleep(1)
    assert nutrition['restrictions'] == ['lactose']
    link('meals/recipes')
    wait('Minhas receitas')
    tap('Cadastrar receita')
    fill('Nome da receita', 'Arroz QA')
    fill('Ingredientes', 'Arroz e agua')
    fill('Modo de preparo', 'Cozinhar')
    tap('Salvar receita')
    for _ in range(20):
        recipes = request('/v1/recipes', profile=family['id'])
        if recipes:
            break
        time.sleep(1)
    assert recipes[0]['name'] == 'Arroz QA'
    capture('04-recipes')
    link('meals/foods')
    wait('Buscar online')
    capture('05-foods')
    adb('shell', 'pm', 'grant', package, 'android.permission.CAMERA')
    tap('Escanear código de barras')
    find('Fechar câmera')
    capture('06-scanner')
    tap('Fechar câmera')
    print(serial, 'nutrition/recipes/native camera passed', flush=True)
    background = check_background()
    report = {'serial': serial, 'api': adb('shell', 'getprop', 'ro.build.version.sdk').strip(), 'login': True, 'profiles': True, 'isolation': True, 'offlineRestart': True, 'reconnectedRows': 2, 'nutrition': True, 'recipes': True, 'nativeCameraOpened': True, 'backgroundJobRegistered': True, 'forcedJob': background['forcedJob'], 'backgroundCompleted': background['backgroundCompleted'], 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    (root / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)
if __name__ == '__main__':
    try:
        if '--worker-only' in sys.argv:
            check_background()
        else:
            main()
    finally:
        for name,value in network_before.items():
            if value in ('0','1'):
                try: adb('shell','svc',name,'enable' if value=='1' else 'disable')
                except Exception: pass
        if not camera_before:
            try: adb('shell','pm','revoke',package,'android.permission.CAMERA')
            except Exception: pass
