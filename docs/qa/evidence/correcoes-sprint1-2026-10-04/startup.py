"""Abertura a frio até cache carregado + layout React + dois frames, relógio do aparelho."""
import json
import re
import sys
import time
from android_ui import adb, APP, OUT, SERIAL

expected = sys.argv[1]
samples = []
for _ in range(10):
    adb("shell", "am", "force-stop", APP)
    adb("logcat", "-c")
    adb("shell", f"log -t VITALIS_QA_START begin && am start -n {APP}/.MainActivity")
    start_log = adb("logcat", "-d", "-v", "epoch", "-s", "VITALIS_QA_START")
    started = int(float(re.search(r"^\s*(\d+\.\d+) .*VITALIS_QA_START.*begin", start_log, re.M)[1]) * 1000)
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        log = adb("logcat", "-d", "-s", "ReactNativeJS")
        matches = re.findall(r"VITALIS_QA_READY (\{[^\n]+\})", log)
        found = [json.loads(m) for m in matches if json.loads(m)["screen"] == expected]
        if found:
            samples.append(found[0]["at"] - started)
            break
        time.sleep(.15)
    else:
        raise AssertionError("Sem sinal de tela utilizável")
    time.sleep(.4)
report = {"serial": SERIAL, "screen": expected, "samplesMs": samples,
          "maxMs": max(samples), "allUnder3Seconds": all(x < 3000 for x in samples),
          "method": "Device timestamp before am start; provider loaded, screen layout and two RAFs. KVM; headless software GPU; no physical-device certification."}
(OUT / f"startup-{SERIAL}-{expected}.json").write_text(json.dumps(report, indent=2)+"\n")
print(json.dumps(report))
