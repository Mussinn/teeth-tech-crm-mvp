"""Read-only server verification through the same cookie proxy used by employees."""
import json, os, sys, urllib.request, urllib.error, http.cookiejar
from pathlib import Path
from datetime import datetime, timezone, timedelta
config={}
for line in Path('.env').read_text().splitlines():
 if '=' in line and not line.startswith('#'):
  key,value=line.split('=',1);config[key]=value.strip().strip("\"'")
base=os.environ.get('MVP_SMOKE_URL','http://127.0.0.1:'+config.get('MVP_PORT','8090')).rstrip('/')
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,method='GET',body=None,expected=200):
 data=None if body is None else json.dumps(body).encode()
 headers={'Content-Type':'application/json'}
 if method not in ('GET','HEAD'):headers['Origin']=base
 req=urllib.request.Request(base+path,data=data,method=method,headers=headers)
 try:
  response=client.open(req,timeout=30);status=response.status;raw=response.read()
 except urllib.error.HTTPError as e:status=e.code;raw=e.read()
 if status!=expected:raise RuntimeError(f'{method} {path}: expected {expected}, got {status}')
 return json.loads(raw) if raw and raw[:1] in (b'{',b'[') else raw
request('/health');request('/auth/login')
password=os.environ.get('MVP_SMOKE_ADMIN_PASSWORD') or config.get('MVP_ADMIN_PASSWORD')
if not password and config.get('MVP_ADMIN_PASSWORD_HASH'):
 request('/api/backend/orders',expected=401)
 print('MVP availability OK: health, login page, access protection. Auth smoke skipped: provide MVP_SMOKE_ADMIN_PASSWORD for full verification.')
 sys.exit(0)
request('/api/backend/auth/sessions','POST',{'email':'admin@teethtech.kz','password':password})
assert any(c.name=='teethTechJwt' for c in jar),'Missing access cookie'
for path in ['/api/auth/session','/api/backend/orders','/api/backend/laboratory/cases','/api/backend/personal-notes','/training','/kpi']:
 request(path)
today=datetime.now(timezone(timedelta(hours=5))).date().isoformat()
report=request(f'/api/backend/kpi?from={today}&to={today}')
assert 'employees' in report and 'completions' in report
for path in ['/api/backend/finance','/api/backend/stock','/api/backend/salaries']:
 request(path,expected=404)
request('/api/auth/logout','POST')
request('/api/backend/orders',expected=401)
print('MVP smoke OK: health, login/cookies, orders, notes, KPI, training, disabled modules, logout.')
