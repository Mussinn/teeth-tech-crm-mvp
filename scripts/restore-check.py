"""Restore into new, temporary Docker volumes. Never overwrite a live installation."""
from pathlib import Path
import argparse,getpass,json,os,subprocess,tempfile,uuid,urllib.request,http.cookiejar
from saas_backups import verify

def main():
 os.umask(0o077)
 for key in ['COMPOSE_PROJECT_NAME','COMPOSE_FILE','COMPOSE_ENV_FILES','COMPOSE_PROFILES']:
  os.environ.pop(key,None)
 p=argparse.ArgumentParser()
 p.add_argument('--lab-backup',type=Path,required=True)
 p.add_argument('--images-backup',type=Path,required=True)
 p.add_argument('--control-backup',type=Path)
 p.add_argument('--email',help='Optional CRM login check; password from MVP_RESTORE_TEST_PASSWORD or hidden prompt')
 args=p.parse_args()
 source=args.lab_backup.resolve();images=args.images_backup.resolve()
 for directory in [source,images]+([args.control_backup.resolve()] if args.control_backup else []):verify(directory)
 subprocess.run(['docker','image','load','-i',str(images/'images.tar')],check=True,stdout=subprocess.DEVNULL)
 with tempfile.TemporaryDirectory(prefix='teethtech-restore-check-') as td:
  target=Path(td);doc=json.loads((source/'compose.yaml').read_text())
  doc['name']='teethtech-restore-check-'+uuid.uuid4().hex[:12]
  for resource in ['volumes','networks']:
   for entry in doc.get(resource,{}).values():
    if entry.get('external'):raise ValueError('External resource not allowed in restore check')
    entry.pop('name',None)
  for service in doc['services'].values():
   service.pop('container_name',None);service.pop('ports',None);service.pop('build',None)
   service['restart']='no'
   if service.get('volumes'):
    if any(v.get('type')=='bind' for v in service['volumes']) and service is not doc['services']['gateway']:
     raise ValueError('Unexpected host bind mount')
  doc['services']['gateway']['ports']=[{'target':80,'published':'0','host_ip':'127.0.0.1','protocol':'tcp'}]
  (target/'nginx.conf').write_text((source/'nginx.conf').read_text())
  doc['services']['gateway']['volumes']=[{'type':'bind','source':str(target/'nginx.conf'),'target':'/etc/nginx/conf.d/default.conf','read_only':True}]
  doc['services']['frontend']['environment']['MVP_REQUIRE_HTTPS']='false'
  config=target/'compose.json';config.write_text(json.dumps(doc))
  compose=['docker','compose','-f',str(config)]
  def run(command,**kw):return subprocess.run(compose+command,check=True,**kw)
  try:
   run(['up','-d','--wait','postgres','minio'],stdout=subprocess.DEVNULL)
   run(['stop','minio'],stdout=subprocess.DEVNULL)
   run(['cp',str(source/'storage')+'/.','minio:/data'],stdout=subprocess.DEVNULL)
   run(['run','--rm','--no-deps','--user','0','--entrypoint','sh','minio','-c','chown -R storage:storage /data'],stdout=subprocess.DEVNULL)
   with (source/'database.sql').open('rb') as f:
    run(['exec','-T','postgres','psql','-U','mvp','-d','teethtech_mvp','-v','ON_ERROR_STOP=1'],stdin=f,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   if args.control_backup:
    run(['exec','-T','postgres','psql','-U','mvp','-d','postgres','-c','CREATE ROLE saas'],stdout=subprocess.DEVNULL)
    with (args.control_backup/'control.sql').open('rb') as f:
     run(['exec','-T','postgres','psql','-U','mvp','-d','postgres','-v','ON_ERROR_STOP=1'],stdin=f,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    run(['exec','-T','postgres','psql','-U','mvp','-d','postgres','-c','SELECT count(*) FROM saas_labs'],stdout=subprocess.DEVNULL)
   run(['up','-d','--wait','--wait-timeout','180'],stdout=subprocess.DEVNULL)
   address=run(['port','gateway','80'],capture_output=True,text=True).stdout.strip()
   if not address.startswith('127.0.0.1:'):raise ValueError('Restore check must remain private')
   base='http://'+address
   assert urllib.request.urlopen(base+'/health',timeout=15).status==200
   assert urllib.request.urlopen(base+'/auth/login',timeout=15).status==200
   if args.email:
    password=os.environ.get('MVP_RESTORE_TEST_PASSWORD') or getpass.getpass('CRM password (not logged): ')
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    req=urllib.request.Request(base+'/api/backend/auth/sessions',data=json.dumps({'email':args.email,'password':password}).encode(),headers={'Origin':base,'Content-Type':'application/json'})
    assert opener.open(req,timeout=15).status==200
    for path in ['/api/backend/orders','/api/backend/personal-notes','/orders']:
     assert opener.open(base+path,timeout=15).status==200
   print('RESTORE CHECK PASSED: new isolated PostgreSQL/MinIO volumes, CRM readiness'+(', authenticated orders and notes' if args.email else '')+'.')
  finally:
   run(['down','--volumes'],stdout=subprocess.DEVNULL)

if __name__=='__main__':main()
