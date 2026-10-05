"""Operações de UI apenas nos emuladores isolados desta execução de QA."""
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

SERIAL = os.environ.get("QA_SERIAL", "emulator-5554")
assert SERIAL in ("emulator-5554", "emulator-5556")
OUT = Path(__file__).parent
APP = "com.vitalistrack.app"


def adb(*args, binary=False):
    for attempt in range(3):
        try:
            return subprocess.check_output(["adb", "-s", SERIAL, *args], text=not binary, timeout=30)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            if attempt == 2: raise
            time.sleep(1)


def tree():
    for _ in range(3):
        result = adb("shell", "uiautomator", "dump", "--compressed", "/sdcard/vitalis-qa.xml")
        if "dumped to" in result:
            return ET.fromstring(adb("shell", "cat", "/sdcard/vitalis-qa.xml"))
        time.sleep(.5)
    raise AssertionError("Sem hierarquia atual: não reutilizar XML anterior")


def texts():
    return [(n.get("text"), n.get("content-desc"), n.get("resource-id"), n.get("bounds"))
            for n in tree().iter("node") if n.get("text") or n.get("content-desc") or n.get("resource-id")]


def find(value, attr=None):
    keys = [attr] if attr else ["text", "content-desc", "resource-id"]
    for n in tree().iter("node"):
        if any(n.get(k) == value for k in keys):
            x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds")))
            if x2 > x1 and y2 > y1:
                return n
    return None


def tap(value, attr=None):
    n = find(value, attr)
    if n is None:
        raise AssertionError(f"Elemento não encontrado: {value}")
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds")))
    adb("shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2))
    time.sleep(.25)


def swipe(up=True):
    width, height = map(int, re.search(r"Physical size: (\d+)x(\d+)", adb("shell", "wm", "size")).groups())
    adb("shell", "input", "swipe", str(width//2), str(int(height*(.78 if up else .30))), str(width//2), str(int(height*(.30 if up else .78))), "250")


def visible(value, attr=None, attempts=7):
    for _ in range(attempts):
        if find(value, attr) is not None:
            return
        swipe()
    raise AssertionError(f"Elemento não encontrado após rolagem: {value}")


def fill(value, text, clear=False):
    attr = "resource-id" if find(value, "resource-id") is not None else "content-desc"
    visible(value, attr)
    tap(value, attr)
    if clear:
        adb("shell", "input", "keyevent", "123")
        adb("shell", "input", "keyevent", *(["67"] * 80))
    adb("shell", "input", "text", text.replace(" ", "%s"))
    keyboard = adb("shell", "dumpsys", "input_method")
    if re.search(r"(?:mInputShown|mIsInputViewShown|inputShown)=true", keyboard):
        adb("shell", "input", "keyevent", "4")
    time.sleep(.2)


def capture(name):
    xml = tree()
    ET.ElementTree(xml).write(OUT / f"{name}.xml", encoding="unicode")
    adb("shell", "screencap", "-p", "/sdcard/vitalis-qa.png")
    adb("pull", "/sdcard/vitalis-qa.png", str(OUT / f"{name}.png"))
    return [(n.get("text"), n.get("content-desc")) for n in xml.iter("node") if n.get("text") or n.get("content-desc")]


def tap_in_card(name, action):
    candidates = [n for n in tree().iter('node')
                  if any(c.get('text') == name for c in n.iter('node'))
                  and any(c.get('content-desc') == action for c in n.iter('node'))]
    assert candidates, (name, action)
    card = min(candidates, key=lambda n: len(list(n.iter('node'))))
    button = next(c for c in card.iter('node') if c.get('content-desc') == action)
    x1,y1,x2,y2 = map(int,re.findall(r'\d+',button.get('bounds')))
    assert x2 > x1 and y2 > y1
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
    time.sleep(.3)
