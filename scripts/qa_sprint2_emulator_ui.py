"""Shared QA-only Android UI primitives. Every ADB operation has an explicit emulator target."""
import json,os,re,subprocess,time,hashlib,xml.etree.ElementTree as ET,urllib.request,urllib.error
from pathlib import Path
SERIAL=os.environ.get('QA_SERIAL','')
assert SERIAL in ('emulator-5580','emulator-5582'),'Set QA_SERIAL to an authorized emulator; physical targets are refused'
ROOT=Path(__file__).resolve().parents[1]/'artifacts/sprint2-completa-20261108'
APP='com.vitalistrack.qa';OUT=ROOT/SERIAL;OUT.mkdir(parents=True,exist_ok=True)
EXPECTED_APK_SHA=json.loads((ROOT/os.environ.get('QA_APK_MANIFEST','apk-current.json')).read_text())['sha256']
API_PORT=3020
BRIDGE_PORT=3021

def adb(*args,binary=False,timeout=30):
 value=subprocess.check_output(['adb','-s',SERIAL,*args],stderr=subprocess.STDOUT,timeout=timeout)
 return value if binary else value.decode(errors='replace')
def verify_emulator():
 assert adb('shell','getprop','ro.kernel.qemu').strip()=='1','Refusing a physical device'
 assert adb('shell','getprop','ro.build.version.sdk').strip() in ('24','36')
verify_emulator()
def tree():
 focus=adb('shell','dumpsys','window')
 current=next((line for line in focus.splitlines() if 'mCurrentFocus=' in line),'')
 for _ in range(15):
  if current and 'null' not in current:break
  time.sleep(.1);focus=adb('shell','dumpsys','window');current=next((line for line in focus.splitlines() if 'mCurrentFocus=' in line),'')
 if 'com.vitalistrack.qa/' not in current:
  allowed=('com.vitalistrack.wellbeing.test/','com.android.documentsui/','com.google.android.documentsui/','com.android.intentresolver/','android/','com.android.permissioncontroller/','com.google.android.permissioncontroller/','com.android.settings/')
  popup=('PopupWindow:' in current and any('mFocusedApp=' in line and any(package.split('/')[0] in line for package in allowed) for line in focus.splitlines()))
  assert popup or any(package in current for package in allowed),'Refusing inspection outside QA test/system pickers: '+current
  for _ in range(3):
   result=adb('shell','uiautomator','dump','--compressed','/sdcard/vitalis-qa-picker.xml')
   if 'dumped to' in result:
    doc=ET.fromstring(adb('shell','cat','/sdcard/vitalis-qa-picker.xml'));ET.ElementTree(doc).write(OUT/'last.xml',encoding='unicode');return doc
   time.sleep(.5)
  raise RuntimeError('System picker hierarchy unavailable')
 for attempt in range(4):
  out=adb('shell','am','instrument','-w','-e','class','com.vitalistrack.wellbeing.QaDumpTest','com.vitalistrack.wellbeing.test/androidx.test.runner.AndroidJUnitRunner')
  if 'INSTRUMENTATION_STATUS: xml=' in out:
   raw=out.split('INSTRUMENTATION_STATUS: xml=',1)[1].split('\nINSTRUMENTATION_',1)[0].strip();root=ET.fromstring(raw);ET.ElementTree(root).write(OUT/'last.xml',encoding='unicode');return root
  time.sleep(.5)
 raise RuntimeError('QA hierarchy unavailable')
def swipe(down=True):
 w,h=map(int,re.findall(r'(\d+)x(\d+)',adb('shell','wm','size'))[-1]);bounds=[0,0,w,h]
 try:
  nodes=[n for n in ET.parse(OUT/'last.xml').iter('node') if n.get('scrollable')=='true' and n.get('package')==APP]
  if nodes:bounds=max([list(map(int,re.findall(r'-?\d+',n.get('bounds')))) for n in nodes],key=lambda b:(b[2]-b[0])*(b[3]-b[1]))
 except (OSError,ET.ParseError):pass
 x1,y1,x2,y2=bounds;a,b=(.83,.2) if down else (.2,.83)
 adb('shell','input','swipe',str((x1+x2)//2),str(int(y1+(y2-y1)*a)),str((x1+x2)//2),str(int(y1+(y2-y1)*b)),'250')
def find(label,field=False,scroll=True):
 for i in range(36 if scroll else 1):
  w,h=map(int,re.findall(r'(\d+)x(\d+)',adb('shell','wm','size'))[-1])
  nodes=[n for n in tree().iter('node') if label in (n.get('text'),n.get('content-desc'),n.get('resource-id')) and (not field or n.get('class')=='android.widget.EditText')]
  nodes.sort(key=lambda n:0 if label in (n.get('content-desc'),n.get('resource-id')) else 1)
  for n in nodes:
   x1,y1,x2,y2=map(int,re.findall(r'-?\d+',n.get('bounds')))
   if 0<=x1<x2<=w and 0<=y1<y2<=h:return n
  if scroll:swipe(i<18)
 raise AssertionError('Control unavailable: '+label)
def tap_node(n):
 x1,y1,x2,y2=map(int,re.findall(r'-?\d+',n.get('bounds')));x=str((x1+x2)//2);y=str((y1+y2)//2)
 if n.get('package')=='com.android.documentsui' and adb('shell','getprop','ro.build.version.sdk').strip()=='24':
  result=adb('shell','am','instrument','-w','-e','class','com.vitalistrack.wellbeing.QaSystemTouchTest','-e','x',x,'-e','y',y,'com.vitalistrack.wellbeing.test/androidx.test.runner.AndroidJUnitRunner');assert 'OK (1 test)' in result,result
 else:adb('shell','input','tap',x,y)
 time.sleep(.3)
def tap(label,field=False,scroll=True):tap_node(find(label,field,scroll))
def fill(label,value):
 tap(label,field=True);adb('shell','input','keyevent','KEYCODE_MOVE_END')
 n=next((n for n in tree().iter('node') if n.get('focused')=='true' and n.get('class')=='android.widget.EditText'),None);count=min(len(n.get('text','')),150) if n is not None else 80
 if count:adb('shell','input','keyevent',*(['KEYCODE_DEL']*count))
 adb('shell','input','text',str(value).replace(' ','%s'))
 if re.search(r'\bmInputShown=true',adb('shell','dumpsys','input_method')):adb('shell','input','keyevent','4')
def wait(label,seconds=30):
 end=time.monotonic()+seconds
 while time.monotonic()<end:
  try:return find(label,scroll=False)
  except AssertionError:time.sleep(.5)
 raise AssertionError('Screen unavailable: '+label)
def has_text(part):return any(part in (n.get('text','')+' '+n.get('content-desc','')) for n in tree().iter('node'))
def wait_text(part,seconds=45):
 end=time.monotonic()+seconds;i=0
 while time.monotonic()<end:
  if has_text(part):return
  swipe(i%20<18);i+=1
 raise AssertionError('Text unavailable: '+part)
def link(path):adb('shell','am','start','-a','android.intent.action.VIEW','-d','vitalistrack://'+path,APP);time.sleep(.7)
def launch():adb('shell','am','start','-n',APP+'/com.vitalistrack.app.MainActivity');time.sleep(1)
def restart():adb('shell','am','force-stop',APP);launch()
def capture(name):
 # Only QA or the test receiver may be captured; Android pickers are inspected without screenshots.
 focus=adb('shell','dumpsys','window');assert any('mCurrentFocus=' in line and ('com.vitalistrack.qa/' in line or 'com.vitalistrack.wellbeing.test/' in line) for line in focus.splitlines())
 doc=tree();ET.ElementTree(doc).write(OUT/(name+'.xml'),encoding='unicode');(OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p',binary=True))
def api(path,body=None,token=None,profile=None,method=None):
 h={'content-type':'application/json','x-client-time-zone':'America/Sao_Paulo'}
 if token:h['authorization']='Bearer '+token
 if profile:h['x-profile-id']=profile
 req=urllib.request.Request(f'http://127.0.0.1:{API_PORT}'+path,data=None if body is None else json.dumps(body).encode(),headers=h,method=method)
 try:
  response=urllib.request.urlopen(req,timeout=20);data=json.load(response);return response.status,data.get('data',data)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def account():
 path=ROOT/os.environ.get('QA_ACCOUNT_FILE','.account.json');value=json.loads(path.read_text())
 status,data=api('/v1/auth/login',{'email':value['email'],'password':'qa-12345678'});assert status==200;value['tokens']=data['tokens'];path.write_text(json.dumps(value));path.chmod(0o600);return value
_installed_hash=None
def record(case,status='passed',**details):
 global _installed_hash
 if _installed_hash is None:
  apk=adb('shell','pm','path',APP).strip().split('package:')[-1]
  try:
   digest=adb('shell','sha256sum',apk).split()[0]
   assert re.fullmatch(r'[a-f0-9]{64}',digest)
  except (subprocess.CalledProcessError,AssertionError):
   import tempfile,zipfile
   with tempfile.TemporaryDirectory(prefix='vitalis-qa-apk-') as temp:
    target=Path(temp)/'base.apk';adb('pull',apk,str(target),timeout=90)
    with zipfile.ZipFile(target) as archive:archive.getinfo('AndroidManifest.xml')
    digest=hashlib.sha256(target.read_bytes()).hexdigest()
  _installed_hash=digest
 expected=EXPECTED_APK_SHA;assert _installed_hash==expected,(_installed_hash,expected)
 data={'case':case,'status':status,'serial':SERIAL,'apkSha256':_installed_hash,'at':time.time(),**details}
 with (ROOT/'checks.jsonl').open('a') as output:output.write(json.dumps(data,ensure_ascii=False)+'\n')
 print(json.dumps(data,ensure_ascii=False),flush=True)

def eventually(check,seconds=30):
 end=time.monotonic()+seconds
 while time.monotonic()<end:
  value=check()
  if value:return value
  time.sleep(.5)
 raise AssertionError('Expected state not reached')

def control(**options):
 req=urllib.request.Request('http://127.0.0.1:3021/__qa/control',data=json.dumps(options).encode(),headers={'content-type':'application/json'});return json.load(urllib.request.urlopen(req))
