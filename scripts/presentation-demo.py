"""Private local presentation installation, independent of all SaaS laboratories."""
from pathlib import Path
import json,os,secrets,subprocess,sys,time,urllib.request,signal
root=Path(__file__).resolve().parent.parent
runtime=root/'saas/.saas-runtime/presentation-demo';runtime.mkdir(parents=True,exist_ok=True,mode=0o700)
os.umask(0o077)
config=runtime/'compose.json'
command=sys.argv[1] if len(sys.argv)>1 else 'start'
if command not in ('start','stop','reset'):raise SystemExit('Use start, stop or reset (reset removes only presentation data)')
if not config.exists():
 dbpass=secrets.token_hex(24);storagepass=secrets.token_hex(24)
 services={
 'postgres':{'image':'postgres:15-alpine','ports':['127.0.0.1:18432:5432'],'environment':{'POSTGRES_USER':'mvp','POSTGRES_DB':'teethtech_mvp','POSTGRES_PASSWORD':dbpass},'volumes':['database:/var/lib/postgresql/data'],'healthcheck':{'test':['CMD','pg_isready','-U','mvp','-d','teethtech_mvp'],'interval':'2s','retries':30}},
 'minio':{'image':'teethtech-pilot-storage:v1','environment':{'MINIO_ROOT_USER':'presentation','MINIO_ROOT_PASSWORD':storagepass},'command':['server','/data','--console-address',':9001'],'volumes':['files:/data'],'healthcheck':{'test':['CMD','wget','-q','--spider','http://127.0.0.1:9000/minio/health/live'],'interval':'2s','retries':30}},
 'backend':{'image':'teethtech-pilot-backend:v1','environment':{'HTTP_ADDR':':8081','DATABASE_URL':'postgres://mvp:'+dbpass+'@postgres:5432/teethtech_mvp?sslmode=disable','AWS_S3_ENDPOINT':'http://minio:9000','AWS_S3_ACCESS_KEY':'presentation','AWS_S3_SECRET_KEY':storagepass,'AWS_S3_BUCKET_NAME':'presentation-files','JWT_SECRET':secrets.token_hex(32),'MVP_ADMIN_PASSWORD':'DemoLab2026!','MVP_TRAINING_PASSWORD':'DemoTeam2026!','MVP_FINANCE_ENABLED':'false','MVP_WAREHOUSE_ENABLED':'false','CORS_ALLOWED_ORIGINS':'http://localhost:18190,http://127.0.0.1:18190','TRUSTED_PROXY_CIDRS':'172.16.0.0/12,192.168.0.0/16'},'depends_on':{'postgres':{'condition':'service_healthy'},'minio':{'condition':'service_healthy'}},'healthcheck':{'test':['CMD','wget','-q','--spider','http://localhost:8081/api/v1/actuator/health/readiness'],'interval':'2s','retries':60}},
 'frontend':{'image':'teethtech-pilot-frontend:v1','environment':{'BACKEND_API_BASE_URL':'http://backend:8081/api/v1','MVP_REQUIRE_HTTPS':'false'},'depends_on':{'backend':{'condition':'service_healthy'}},'healthcheck':{'test':['CMD','node','-e',"fetch('http://127.0.0.1:3000/auth/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],'interval':'2s','retries':60}},
 'gateway':{'image':'nginx:alpine','ports':['127.0.0.1:18190:80'],'volumes':[str(root/'nginx.conf')+':/etc/nginx/conf.d/default.conf:ro'],'depends_on':{'frontend':{'condition':'service_healthy'}},'healthcheck':{'test':['CMD-SHELL','wget -q --spider http://127.0.0.1/auth/login'],'interval':'2s','retries':30}}
 }
 config.write_text(json.dumps({'name':'teethtech-presentation-demo','services':services,'volumes':{'database':{},'files':{}}},indent=2));config.chmod(0o600)
compose=['docker','compose','-f',str(config)]
pidfile=runtime/'portal.pid'
if command in ('stop','reset') and pidfile.exists():
 try:os.kill(int(pidfile.read_text()),signal.SIGTERM)
 except ProcessLookupError:pass
 pidfile.unlink(missing_ok=True)
if command=='stop':subprocess.run(compose+['stop'],check=True)
elif command=='reset':subprocess.run(compose+['down','--volumes'],check=True);(runtime/'seed.json').unlink(missing_ok=True)
else:
 subprocess.run(compose+['up','-d','--pull','never','--wait','--wait-timeout','180'],check=True)
 doc=json.loads(config.read_text());dbpass=doc['services']['postgres']['environment']['POSTGRES_PASSWORD']
 def sql(query,database='postgres'):
  return subprocess.run(compose+['exec','-T','postgres','psql','-U','mvp','-d',database,'-v','ON_ERROR_STOP=1','-At','-c',query],check=True,capture_output=True,text=True).stdout.strip()
 if sql("SELECT count(*) FROM pg_database WHERE datname='presentation_saas'")=='0':sql('CREATE DATABASE presentation_saas')
 envfile=runtime/'portal-config.json'
 if not envfile.exists():envfile.write_text(json.dumps({'SAAS_DATABASE_URL':'postgres://mvp:'+dbpass+'@127.0.0.1:18432/presentation_saas?sslmode=disable','SAAS_HTTP_ADDR':'127.0.0.1:18192','SAAS_PUBLIC_URL':'http://localhost:18192','SAAS_BASE_DOMAIN':'localhost','SAAS_OWNER_EMAIL':'owner@demo.local','SAAS_OWNER_PASSWORD':'DemoOwner2026!','SAAS_OWNER_PASSWORD_HASH':'','SAAS_LAB_PORT_BASE':'18189','SAAS_WORKER_SECRET':secrets.token_hex(32)}))
 alive=False
 if pidfile.exists():
  try:os.kill(int(pidfile.read_text()),0);alive=True
  except ProcessLookupError:pass
 if not alive:
  env=os.environ.copy();env.update(json.loads(envfile.read_text()))
  log=(runtime/'portal.log').open('ab')
  proc=subprocess.Popen([str(root/'saas/.saas-runtime/portal')],env=env,cwd=root,stdout=log,stderr=log,start_new_session=True);pidfile.write_text(str(proc.pid));log.close()
 for n in range(100):
  try:
   if urllib.request.urlopen('http://localhost:18192/health',timeout=2).status==200:break
  except Exception:time.sleep(.2)
 else:raise SystemExit('Presentation SaaS portal startup failed; inspect private log')
 sql("INSERT INTO saas_labs(slot,name,contact_email,invite_hash,invite_expires_at,status,trial_ends_at) VALUES(1,'Демо · TeethTech Lab','chief@demo.local','demo-local-only',now()+interval '1 day','READY',now()+interval '365 days') ON CONFLICT(slot) DO UPDATE SET trial_ends_at=now()+interval '365 days'",'presentation_saas')
 print('Presentation SaaS CRM: http://lab1.localhost:18192; owner: http://localhost:18192')
 print('Local presentation CRM: http://localhost:18190 (fictional data only).')
