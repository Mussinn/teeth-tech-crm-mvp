"""Consistent cold backup of PostgreSQL, MinIO data and private runtime configuration."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib,json,os,shutil,subprocess
root=Path(__file__).resolve().parent.parent
os.umask(0o077)
lock=(root/'.operations.lock').open('a')
if os.name=='nt':
 import msvcrt
 if not lock.tell():lock.write('0');lock.flush()
 lock.seek(0);msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
else:
 import fcntl
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
local_zone=timezone(timedelta(hours=5))
backup=root/'artifacts'/'backups'/('full-'+datetime.now(local_zone).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True,mode=0o700)
def run(args,**kw):return subprocess.run(['docker','compose']+args,cwd=root,check=True,**kw)
running=set(run(['ps','--services','--status','running'],capture_output=True,text=True).stdout.split())
stopped=[s for s in ['gateway','frontend','backend','minio'] if s in running]
try:
 if 'postgres' not in running:run(['up','-d','--wait','postgres'])
 if stopped:run(['stop']+stopped)
 with (backup/'database.sql').open('wb') as out:
  run(['exec','-T','postgres','sh','-c','pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"'],stdout=out)
 run(['cp','minio:/data',str(backup/'storage')])
 shutil.copyfile(root/'.env',backup/'config.env')
 files={}
 for p in backup.rglob('*'):
  if p.is_file():
   os.chmod(p,0o600)
   digest=hashlib.sha256()
   with p.open('rb') as source:
    for chunk in iter(lambda:source.read(1024*1024),b''):digest.update(chunk)
   files[p.relative_to(backup).as_posix()]=digest.hexdigest()
  elif p.is_dir():os.chmod(p,0o700)
 (backup/'manifest.json').write_text(json.dumps({'format':1,'createdAt':datetime.now(local_zone).isoformat(),'files':files},ensure_ascii=False,indent=2),encoding='utf-8')
 (backup/'COMPLETE').write_text('Database, attachments and runtime configuration saved.\n')
 print('Полная резервная копия:',backup)
finally:
 if stopped:run(['up','-d','--wait','--wait-timeout','180']+list(reversed(stopped)))
 if 'postgres' not in running:run(['stop','postgres'])
