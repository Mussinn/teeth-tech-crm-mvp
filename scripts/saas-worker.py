"""Host-side provisioner. Only this local process has access to Docker."""
from pathlib import Path
import base64,fcntl,json,os,secrets,subprocess,sys,time,threading,urllib.request,urllib.error,urllib.parse
ROOT=Path(__file__).resolve().parent.parent
SAAS=ROOT/'saas'
RUNTIME=SAAS/'.saas-runtime'
def config():
 values={}
 for line in (SAAS/'.env').read_text(encoding='utf-8').splitlines():
  if '=' in line and not line.startswith('#'):
   k,v=line.split('=',1);values[k]=v.strip().strip("'\"")
 return values

def api(cfg,path,data):
 req=urllib.request.Request(cfg['SAAS_INTERNAL_URL']+path,data=json.dumps(data).encode(),method='POST',headers={'Authorization':'Bearer '+cfg['SAAS_WORKER_SECRET'],'Content-Type':'application/json','Host':urllib.parse.urlparse(cfg['SAAS_PUBLIC_URL']).netloc})
 with urllib.request.urlopen(req,timeout=30) as response:
  raw=response.read();return json.loads(raw) if raw else None

def run(args,cwd=ROOT,**kw):
 return subprocess.run(args,cwd=cwd,check=True,timeout=600,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,**kw)

def lab_dir(job):
 slot=job['slot'];assert type(slot) is int and 1<=slot<=3
 assert job['slug']=='lab'+str(slot)
 target=RUNTIME/'labs'/job['slug'];target.mkdir(parents=True,exist_ok=True,mode=0o700)
 return target

def prepare(cfg,job,target):
 # Existing environment is never regenerated: passwords, storage keys and volumes survive retries.
 if (target/'compose.yaml').exists():
  saved=json.loads((target/'compose.yaml').read_text())
  assert saved['name']=='teethtech-pilot-'+job['slug']
  return
 assert job['adminHash'].startswith(('$2a$','$2b$')) and len(job['adminHash'])==60
 assert type(job['port']) is int and job['port']==int(cfg['SAAS_LAB_PORT_BASE'])+job['slot']
 values={'MVP_PORT':str(job['port']),'MVP_BIND_ADDRESS':'127.0.0.1','MVP_PUBLIC_URL':job['url'],'MVP_REQUIRE_HTTPS':str(job['url'].startswith('https://')).lower(),'MVP_FINANCE_ENABLED':'false','MVP_WAREHOUSE_ENABLED':'false','POSTGRES_PASSWORD':secrets.token_hex(24),'MINIO_ROOT_USER':'mvp-storage','MINIO_ROOT_PASSWORD':secrets.token_hex(24),'JWT_SECRET':base64.b64encode(secrets.token_bytes(48)).decode(),'MVP_ADMIN_PASSWORD':'','MVP_ADMIN_PASSWORD_HASH':job['adminHash'],'MVP_TRAINING_PASSWORD':secrets.token_hex(24)}
 (target/'.env').write_text(''.join(k+"='"+v+"'\n" for k,v in values.items()),encoding='utf-8')
 compose_env=os.environ.copy();compose_env.update(values)
 result=subprocess.run(['docker','compose','--env-file',str(target/'.env'),'-f',str(ROOT/'compose.yaml'),'config','--format','json'],env=compose_env,check=True,capture_output=True,text=True,timeout=30)
 doc=json.loads(result.stdout);doc['name']='teethtech-pilot-'+job['slug']
 for resource in ['volumes','networks']:
  for entry in doc.get(resource,{}).values():entry.pop('name',None)
 images={key:cfg['SAAS_'+key.upper()+'_IMAGE'] for key in ['backend','frontend','storage']}
 # Pin concrete image IDs for this installation; a later build cannot unexpectedly update it.
 for service,key in [('backend','backend'),('frontend','frontend'),('minio','storage')]:
  image=subprocess.run(['docker','image','inspect',images[key],'--format','{{.Id}}'],capture_output=True,text=True,check=True,timeout=30).stdout.strip()
  assert image.startswith('sha256:')
  pinned='teethtech-pilot-'+job['slug']+'-'+service+':'+image.split(':')[1][:16]
  run(['docker','tag',image,pinned])
  doc['services'][service].pop('build',None);doc['services'][service]['image']=pinned
  doc['services'][service]['pull_policy']='never'
 doc['services']['backend']['environment'].update(MVP_ADMIN_EMAIL=job['email'].replace('$','$$'),MVP_ADMIN_NAME=job['adminName'].replace('$','$$'),CORS_ALLOWED_ORIGINS=job['url'])
 gateway=doc['services']['gateway'];gateway['volumes']=[{'type':'bind','source':str(target/'nginx.conf'),'target':'/etc/nginx/conf.d/default.conf','read_only':True}]
 nginx=(ROOT/'nginx.conf').read_text().replace('map $http_upgrade',"map $http_x_forwarded_proto $pilot_proto { default $scheme; https https; }\nmap $http_upgrade").replace('X-Forwarded-Proto $scheme','X-Forwarded-Proto $pilot_proto')
 (target/'nginx.conf').write_text(nginx)
 # Reuse the verified full-backup implementation in an installation-specific directory.
 (target/'scripts').mkdir(exist_ok=True,mode=0o700)
 (target/'scripts/backup.py').write_text((ROOT/'scripts/backup.py').read_text(encoding='utf-8'),encoding='utf-8')
 staged=target/'compose.pending'
 staged.write_text(json.dumps(doc,indent=2),encoding='utf-8')
 staged.replace(target/'compose.yaml')

def execute(cfg,job):
 target=lab_dir(job);action=job['action'];assert action in ['CREATE','START','STOP']
 with (target/'.operations.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  if action=='CREATE':prepare(cfg,job,target)
  assert (target/'compose.yaml').exists()
  compose=['docker','compose','-p','teethtech-pilot-'+job['slug'],'-f',str(target/'compose.yaml')]
  if action=='STOP':run(compose+['stop'],cwd=target)
  else:run(compose+['up','-d','--wait','--wait-timeout','480'],cwd=target)

def main():
 os.umask(0o077);RUNTIME.mkdir(exist_ok=True,mode=0o700)
 for key in ['COMPOSE_PROJECT_NAME','COMPOSE_FILE','COMPOSE_ENV_FILES','COMPOSE_PROFILES']:os.environ.pop(key,None)
 lock=(RUNTIME/'worker.lock').open('w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 cfg=config();pending=None
 def heartbeat():
  while True:
   try:api(cfg,'/internal/heartbeat',{})
   except Exception:pass
   time.sleep(10)
 threading.Thread(target=heartbeat,daemon=True).start()
 while True:
  try:
   if pending:
    api(cfg,'/internal/jobs/'+str(pending['id'])+'/complete',{'lease':pending['lease'],'success':pending['success']});pending=None
   job=api(cfg,'/internal/jobs/claim',{})
   if job:
    print('Running',job['action'],job['slug'],flush=True)
    try:execute(cfg,job);success=True
    except Exception as error:
     # Never log Docker configuration, hashes, request bodies or credentials.
     print('Job failed:',type(error).__name__,flush=True);success=False
    pending={'id':job['id'],'lease':job['lease'],'success':success}
   else:time.sleep(5)
  except urllib.error.HTTPError as error:
   print('Portal request failed:',error.code,flush=True)
   if error.code==409:pending=None
   time.sleep(5)
  except Exception as error:print('Worker waiting:',type(error).__name__,flush=True);time.sleep(5)
if __name__=='__main__':main()
