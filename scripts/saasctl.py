"""Manage isolated laboratory pilots on a Linux/macOS Docker host."""
from pathlib import Path
import argparse,getpass,json,os,platform,secrets,shutil,signal,subprocess,sys,time,urllib.parse,urllib.request
ROOT=Path(__file__).resolve().parent.parent
SAAS=ROOT/'saas';RUNTIME=SAAS/'.saas-runtime'
def settings():
 cfg={}
 for line in (SAAS/'.env').read_text(encoding='utf-8').splitlines():
  if '=' in line and not line.startswith('#'):
   k,v=line.split('=',1);cfg[k]=v.strip().strip("'\"")
 return cfg

def run(args,cwd=ROOT,**kwargs):return subprocess.run(args,cwd=cwd,check=True,**kwargs)

def setup(args):
 if (SAAS/'.env').exists():raise SystemExit('saas/.env already exists; settings preserved.')
 cfg={}
 for line in (SAAS/'.env.example').read_text().splitlines():
  if '=' in line and not line.startswith('#'):k,v=line.split('=',1);cfg[k]=v
 cfg.update(SAAS_PUBLIC_URL=args.public_url.rstrip('/'),SAAS_BASE_DOMAIN=args.base_domain,SAAS_OWNER_EMAIL=args.owner_email)
 for k in ['SAAS_OWNER_PASSWORD','SAAS_WORKER_SECRET','SAAS_DB_PASSWORD']:cfg[k]=secrets.token_hex(24)
 key=RUNTIME/'keys'/'backup.key';key.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
 if not key.exists():
  fd=os.open(key,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
  with os.fdopen(fd,'wb') as out:out.write(secrets.token_bytes(32))
 cfg['SAAS_BACKUP_KEY_FILE']=str(key.resolve())
 cfg['SAAS_DATABASE_URL']='postgres://saas:'+cfg['SAAS_DB_PASSWORD']+'@127.0.0.1:'+cfg['SAAS_DB_PORT']+'/teethtech_saas?sslmode=disable'
 if any("'" in v or '\n' in v or '\r' in v for v in cfg.values()):raise SystemExit('Invalid setting')
 (SAAS/'.env').write_text(''.join(k+"='"+v+"'\n" for k,v in cfg.items()),encoding='utf-8')
 print('Created saas/.env. Owner password: SAAS_OWNER_PASSWORD in this private file.')

def build():
 run(['docker','build','-t','teethtech-pilot-backend:v1',str(ROOT/'backend')])
 run(['docker','build','-t','teethtech-pilot-storage:v1',str(ROOT/'storage')])
 run(['docker','build','-t','teethtech-pilot-frontend:v1','--build-arg','NEXT_PUBLIC_API_URL=/api/backend','--build-arg','NEXT_PUBLIC_APP_NAME=TeethTech CRM','--build-arg','NEXT_PUBLIC_DEFAULT_LOCALE=ru',str(ROOT/'frontend')])
 arch='arm64' if platform.machine().lower() in ['arm64','aarch64'] else 'amd64';system='darwin' if sys.platform=='darwin' else 'linux'
 RUNTIME.mkdir(exist_ok=True,mode=0o700)
 run(['docker','build','-f',str(SAAS/'Dockerfile.portal'),'--build-arg','TARGETOS='+system,'--build-arg','TARGETARCH='+arch,'-t','teethtech-pilot-portal:build',str(ROOT/'backend')])
 container=run(['docker','create','teethtech-pilot-portal:build','/saas'],capture_output=True,text=True).stdout.strip()
 try:run(['docker','cp',container+':/saas',str(RUNTIME/'portal.next')])
 finally:run(['docker','rm',container],stdout=subprocess.DEVNULL)
 os.chmod(RUNTIME/'portal.next',0o700)
 (RUNTIME/'portal.next').replace(RUNTIME/'portal')

def alive(name):
 f=RUNTIME/(name+'.pid')
 if not f.exists():return False
 try:
  pid=int(f.read_text());cmd=subprocess.run(['ps','-p',str(pid),'-o','args='],capture_output=True,text=True).stdout
  marker=str(RUNTIME/'portal') if name=='portal' else str(ROOT/'scripts/saas-worker.py')
  return marker in cmd
 except (ValueError,OSError):return False

def start():
 cfg=settings();RUNTIME.mkdir(exist_ok=True,mode=0o700)
 if not (RUNTIME/'portal').exists():raise SystemExit('Run build first')
 run(['docker','compose','up','-d','--wait'],cwd=SAAS)
 env=os.environ.copy();env.update(cfg)
 for name,cmd in [('portal',[str(RUNTIME/'portal')]),('worker',[sys.executable,str(ROOT/'scripts/saas-worker.py')])]:
  if not alive(name):
   with (RUNTIME/(name+'.log')).open('ab') as log:process=subprocess.Popen(cmd,env=env,cwd=ROOT,stdout=log,stderr=log,start_new_session=True)
   (RUNTIME/(name+'.pid')).write_text(str(process.pid))
 print('Owner panel:',cfg['SAAS_PUBLIC_URL']);print('Private logs:',RUNTIME)
 for attempt in range(30):
  try:
   req=urllib.request.Request(cfg['SAAS_INTERNAL_URL']+'/health',headers={'Host':urllib.parse.urlparse(cfg['SAAS_PUBLIC_URL']).netloc})
   with urllib.request.urlopen(req,timeout=2) as response:
    if response.status==200:return
  except Exception:time.sleep(1)
 raise SystemExit('Portal did not become healthy. Check private portal.log before inviting users.')

def stop():
 for name in ['worker','portal']:
  if alive(name):os.kill(int((RUNTIME/(name+'.pid')).read_text()),signal.SIGTERM)
 print('Portal and worker stopped. Laboratory volumes retained.')

def edge():
 cfg=settings();u=urllib.parse.urlparse(cfg['SAAS_PUBLIC_URL'])
 if u.scheme!='https' or u.port:raise SystemExit('Set HTTPS public URL without port first')
 addresses=[u.hostname]+['lab'+str(n)+'.'+cfg['SAAS_BASE_DOMAIN'] for n in range(1,4)]
 if any(not a or any(x in a for x in '{}\n\r /;') for a in addresses):raise SystemExit('Invalid domain')
 RUNTIME.mkdir(exist_ok=True,mode=0o700);address=cfg['SAAS_HTTP_ADDR']
 if not address.startswith('127.0.0.1:'):raise SystemExit('Portal must listen on loopback')
 (RUNTIME/'Caddyfile').write_text(', '.join(addresses)+' {\n  reverse_proxy '+address+'\n}\n')
 print('Caddyfile:',RUNTIME/'Caddyfile');print('Set DNS for:',', '.join(addresses))

def encrypt_snapshot(directory):
 key=settings().get('SAAS_BACKUP_KEY_FILE','')
 if key:
  run([sys.executable,str(ROOT/'scripts/encrypt-backup.py'),str(directory),'--key',key,'--output',str(directory)+'.ttbk'])

def backup(slug):
 if slug not in ['lab1','lab2','lab3']:raise SystemExit('Unknown laboratory')
 target=RUNTIME/'labs'/slug
 if not (target/'compose.yaml').exists():raise SystemExit('Laboratory not provisioned')
 # Use the current implementation, including fixes for suspended installations.
 (target/'scripts/backup.py').write_text((ROOT/'scripts/backup.py').read_text(encoding='utf-8'),encoding='utf-8')
 run([sys.executable,str(target/'scripts/backup.py')],cwd=target)
 dest=sorted(path for path in (target/'artifacts/backups').glob('full-*') if path.is_dir() and (path/'COMPLETE').is_file())[-1]
 import hashlib
 manifest=json.loads((dest/'manifest.json').read_text())
 (dest/'COMPLETE').unlink()
 for name in ['compose.yaml','nginx.conf']:
  shutil.copyfile(target/name,dest/name);manifest['files'][name]=hashlib.sha256((dest/name).read_bytes()).hexdigest()
 (dest/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
 (dest/'COMPLETE').write_text('Laboratory database, files and configuration saved.\n')
 encrypt_snapshot(dest)
 return dest

def backup_control():
 from datetime import datetime,timezone
 target=RUNTIME/'backups'/datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-%f');target.mkdir(parents=True,mode=0o700)
 with (target/'control.sql').open('wb') as out:run(['docker','compose','exec','-T','postgres','pg_dump','-U','saas','teethtech_saas'],cwd=SAAS,stdout=out)
 shutil.copyfile(SAAS/'.env',target/'config.env')
 import hashlib
 files={name:hashlib.sha256((target/name).read_bytes()).hexdigest() for name in ['control.sql','config.env']}
 (target/'manifest.json').write_text(json.dumps({'format':1,'files':files},indent=2))
 (target/'COMPLETE').write_text('Control database and private configuration saved.\n')
 encrypt_snapshot(target)
 print('Control backup:',target)
 return target

def repair_images(slug):
 import fcntl
 target=RUNTIME/'labs'/slug;path=target/'compose.yaml'
 with (target/'.operations.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  doc=json.loads(path.read_text())
  if doc['name']!='teethtech-pilot-'+slug:raise SystemExit('Unexpected laboratory project')
  compose=['docker','compose','-f',str(path)]
  for service,spec in doc['services'].items():
   image=spec.get('image')
   if not image:continue
   probe=subprocess.run(['docker','image','inspect',image,'--format','{{.Id}}'],capture_output=True,text=True)
   if probe.returncode:
    # Recover a private runtime image from its existing container before it is recreated.
    container=run(compose+['ps','--all','--quiet',service],cwd=target,capture_output=True,text=True).stdout.strip()
    if not container:raise SystemExit('Missing image and container for '+service+'; stop and recover the version from a backup')
    recovered='teethtech-private-recovery-'+slug+'-'+service+':'+secrets.token_hex(8)
    run(['docker','commit',container,recovered],stdout=subprocess.DEVNULL)
    image=recovered
    probe=run(['docker','image','inspect',image,'--format','{{.Id}}'],capture_output=True,text=True)
   identifier=probe.stdout.strip().split(':')[1][:16]
   pinned='teethtech-pilot-'+slug+'-'+service+':'+identifier
   run(['docker','tag',image,pinned]);spec['image']=pinned;spec['pull_policy']='never'
  pending=target/'compose.pending';pending.write_text(json.dumps(doc,indent=2));pending.replace(path)
 print('Image versions retained for',slug,'. Recovered runtime images are private and may contain environment secrets; never publish them.')

def update_frontend(slug, services=("frontend",)):
 repair_images(slug)
 backup(slug)
 import fcntl
 target=RUNTIME/'labs'/slug;path=target/'compose.yaml'
 with (target/'.operations.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  old=path.read_text();doc=json.loads(old)
  for service in services:
   image=run(['docker','image','inspect',settings()['SAAS_'+service.upper()+'_IMAGE'],'--format','{{.Id}}'],capture_output=True,text=True).stdout.strip()
   pinned='teethtech-pilot-'+slug+'-'+service+':'+image.split(':')[1][:16]
   run(['docker','tag',image,pinned]);doc['services'][service]['image']=pinned;doc['services'][service]['pull_policy']='never'
  running=run(['docker','compose','-f',str(path),'ps','--services','--status','running'],cwd=target,capture_output=True,text=True).stdout.split()
  pending=target/'compose.pending';pending.write_text(json.dumps(doc,indent=2));pending.replace(path)
  try:
   active=[service for service in services if service in running]
   if active:run(['docker','compose','-f',str(path),'up','-d','--no-deps','--wait','--wait-timeout','180',*active],cwd=target)
   if active and 'gateway' in running:run(['docker','compose','-f',str(path),'exec','-T','gateway','nginx','-s','reload'],cwd=target)
  except Exception:
   pending.write_text(old);pending.replace(path)
   if active:run(['docker','compose','-f',str(path),'up','-d','--no-deps','--wait',*active],cwd=target)
   if active and 'gateway' in running:run(['docker','compose','-f',str(path),'exec','-T','gateway','nginx','-s','reload'],cwd=target)
   raise
 print('Application services '+', '.join(services)+' updated for',slug,'; previous version retained. Stopped installations remain stopped.')

def main():
 os.umask(0o077)
 for key in ['COMPOSE_PROJECT_NAME','COMPOSE_FILE','COMPOSE_ENV_FILES','COMPOSE_PROFILES']:os.environ.pop(key,None)
 p=argparse.ArgumentParser();subs=p.add_subparsers(dest='command',required=True)
 a=subs.add_parser('setup');a.add_argument('--public-url',default='http://localhost:8099');a.add_argument('--base-domain',default='localhost');a.add_argument('--owner-email',default='owner@teethtech.kz')
 for name in ['build','start','stop','status','edge-config','backup-control','systemd-config','backup-all','backup-timer-config']:subs.add_parser(name)
 a=subs.add_parser('verify-backup');a.add_argument('path',type=Path)
 a=subs.add_parser('export-data');a.add_argument('lab',choices=['lab1','lab2','lab3'])
 for name in ['repair-images','update-frontend','update-application']:
  a=subs.add_parser(name);a.add_argument('lab',choices=['lab1','lab2','lab3'])
 a=subs.add_parser('backup');a.add_argument('lab',choices=['lab1','lab2','lab3']);args=p.parse_args()
 if args.command=='setup':setup(args)
 elif args.command=='build':build()
 elif args.command=='start':start()
 elif args.command=='stop':stop()
 elif args.command=='edge-config':edge()
 elif args.command=='systemd-config':
  RUNTIME.mkdir(exist_ok=True,mode=0o700)
  quote=lambda x:json.dumps(str(x)).replace('%','%%')
  for name,cmd in [('portal',quote(RUNTIME/'portal')),('worker',quote(sys.executable)+' '+quote(ROOT/'scripts/saas-worker.py'))]:
   unit='[Unit]\nDescription=TeethTech pilot '+name+'\nAfter=network-online.target docker.service\nWants=network-online.target\n\n[Service]\nType=simple\nUser='+getpass.getuser()+'\nWorkingDirectory='+quote(ROOT)+'\nEnvironmentFile='+quote(SAAS/'.env')+'\nExecStart='+cmd+'\nRestart=always\nRestartSec=5\nUMask=0077\n\n[Install]\nWantedBy=multi-user.target\n'
   (RUNTIME/('teethtech-'+name+'.service')).write_text(unit)
  print('Generated systemd units in',RUNTIME)
 elif args.command=='backup':backup(args.lab)
 elif args.command=='repair-images':repair_images(args.lab)
 elif args.command=='update-frontend':update_frontend(args.lab)
 elif args.command=='update-application':update_frontend(args.lab,('backend','frontend'))
 elif args.command=='verify-backup':
  from saas_backups import verify
  verify(args.path);print('Backup integrity verified:',args.path)
 elif args.command=='export-data':
  from saas_backups import verify
  import tarfile
  source=backup(args.lab);verify(source)
  dest=RUNTIME/'exports';dest.mkdir(exist_ok=True,mode=0o700)
  platform_data=dest/(args.lab+'-'+source.name+'-platform')
  run([sys.executable,str(ROOT/'scripts/platform-export.py'),args.lab,str(platform_data)])
  output=dest/(args.lab+'-'+source.name+'.tar.gz')
  with tarfile.open(output,'w:gz') as archive:
   archive.add(source/'database.sql',arcname='database.sql')
   archive.add(source/'storage',arcname='storage')
   archive.add(platform_data,arcname='platform')
  print('Private laboratory data export:',output)
  print('Contains personal/business data and application SQL including user password hashes; no .env, storage keys or compose configuration. Send only to the verified laboratory administrator via an encrypted channel.')
 elif args.command=='backup-all':
  from saas_backups import backup_all
  backup_all()
 elif args.command=='backup-timer-config':
  RUNTIME.mkdir(exist_ok=True,mode=0o700)
  quote=lambda x:json.dumps(str(x)).replace('%','%%')
  service='[Unit]\nDescription=TeethTech all laboratory backups\nAfter=docker.service teethtech-portal.service\n\n[Service]\nType=oneshot\nUser='+getpass.getuser()+'\nWorkingDirectory='+quote(ROOT)+'\nEnvironmentFile='+quote(SAAS/'.env')+'\nExecStart='+quote(sys.executable)+' '+quote(ROOT/'scripts/saasctl.py')+' backup-all\nUMask=0077\nTimeoutStartSec=3600\n'
  timer='[Unit]\nDescription=Daily TeethTech backups\n\n[Timer]\nOnCalendar=*-*-* 03:00:00 Asia/Aqtobe\nPersistent=true\nRandomizedDelaySec=300\n\n[Install]\nWantedBy=timers.target\n'
  (RUNTIME/'teethtech-backup.service').write_text(service)
  (RUNTIME/'teethtech-backup.timer').write_text(timer)
  print('Generated daily backup units in',RUNTIME)
 elif args.command=='backup-control':
  backup_control()
 elif args.command=='status':
  print('Portal:', 'running' if alive('portal') else 'stopped');print('Worker:', 'running' if alive('worker') else 'stopped');run(['docker','compose','ps'],cwd=SAAS)
if __name__=='__main__':main()
