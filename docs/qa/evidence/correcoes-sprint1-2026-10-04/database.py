"""Snapshot de QA sem tokens (SecureStore não é lido). Requer adb root no AVD descartável."""
import json
import sqlite3
import sys
from pathlib import Path
from android_ui import adb, APP, OUT, SERIAL

label = sys.argv[1]
adb("shell", "am", "force-stop", APP)
target = Path("/tmp/vitalis-sprint1-fixes") / f"database-{SERIAL}-{label}"
target.mkdir(exist_ok=True)
for name in ("vitalis.db", "vitalis.db-wal", "vitalis.db-shm"):
    adb("pull", f"/data/user/0/{APP}/files/SQLite/{name}", str(target/name))
db = sqlite3.connect(target/"vitalis.db")
states = [(key,json.loads(value)) for key,value in db.execute("SELECT key,value FROM kv WHERE key LIKE '%:app-state'")]
queues = [(owner,json.loads(mutation)) for owner,mutation in db.execute("SELECT user_id,mutation FROM outbox_v2 ORDER BY sequence")]
workouts = [(key,json.loads(value)) for key,value in db.execute("SELECT key,value FROM kv WHERE key LIKE '%:active-workout'") if value and value != 'null']
report = {"serial": SERIAL, "states": states, "queue": queues, "workouts": workouts}
(OUT / f"database-{SERIAL}-{label}.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
print(json.dumps({"states":len(states),"queueCount":len(queues),"entities":[row[1]["entity"] for row in queues]}))
adb("shell", "am", "start", "-n", f"{APP}/.MainActivity")
