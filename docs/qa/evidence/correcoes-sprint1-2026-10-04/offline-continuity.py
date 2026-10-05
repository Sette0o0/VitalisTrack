"""Coletor do ensaio real: somente o AVD temporário explicitamente registrado em T0."""
import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).parent
manifest = OUT / 'offline-24h.json'
r = json.loads(manifest.read_text())
assert r['avd'] == 'VitalisFixAPI24' and r['serial'] == 'emulator-5556'

def adb(*args):
    return subprocess.check_output(['adb','-s',r['serial'],*args],text=True,timeout=30).strip()

assert r['avd'] in adb('emu','avd','name')
log_file = OUT / "offline-continuity.jsonl"
rows = log_file.read_text().splitlines() if log_file.exists() else []
previous = datetime.fromisoformat(json.loads(rows[-1])["at"]).timestamp() if rows else None
while True:
    if json.loads(manifest.read_text())['status'] != 'in_progress': break
    now = datetime.now(timezone.utc)
    try:
        airplane = adb('shell','settings','get','global','airplane_mode_on')
        network = next(x for x in adb('shell','dumpsys','connectivity').splitlines() if x.startswith('Active default network:'))
        boot = adb('shell','cat','/proc/sys/kernel/random/boot_id')
        device = int(adb('shell','date','+%s'))
        elapsed = now.timestamp() - datetime.fromisoformat(r['t0']).timestamp()
        row = {'at':now.isoformat(),'elapsedSeconds':round(elapsed,2),'airplane':airplane,
               'network':network,'bootId':boot,'deviceEpochSeconds':device}
        row['passed'] = airplane == '1' and network.endswith('none') and boot == r['bootId'] and abs(device-now.timestamp()) < 10
        if previous and now.timestamp()-previous > 120: row['passed']=False;row['reason']='gap_between_samples'
    except Exception as error:
        row = {'at':now.isoformat(),'passed':False,'reason':str(error)}
    with (OUT/'offline-continuity.jsonl').open('a') as f: f.write(json.dumps(row)+'\n')
    if not row['passed']:
        latest=json.loads(manifest.read_text());latest['status']='inconclusive';latest['continuityFailure']=row
        manifest.write_text(json.dumps(latest,indent=2)+'\n');break
    previous=now.timestamp()
    # Remain offline even after 24 h; the scheduled continuation performs the retest.
    time.sleep(60)
