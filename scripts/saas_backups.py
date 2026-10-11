"""Back up all provisioned labs; verify content before optional encrypted offsite transfer."""
from pathlib import Path
from datetime import datetime, timezone
import fcntl, hashlib, json, os, re, shutil, subprocess, tarfile

def verify(directory):
 directory=Path(directory)
 if directory.is_symlink() or not (directory/'COMPLETE').is_file():
  raise ValueError('Backup incomplete or symbolic link')
 manifest=json.loads((directory/'manifest.json').read_text())
 if manifest.get('format')!=1 or not manifest.get('files'):
  raise ValueError('Invalid manifest')
 listed=set(manifest['files'])
 actual=set()
 for path in directory.rglob('*'):
  if path.is_symlink():raise ValueError('Symlink in backup')
  if path.is_file() and path.relative_to(directory).as_posix() not in ('manifest.json','COMPLETE'):
   actual.add(path.relative_to(directory).as_posix())
 if actual!=listed:raise ValueError('Manifest does not cover all files')
 for name,expected in manifest['files'].items():
  relative=Path(name)
  if relative.is_absolute() or '..' in relative.parts:raise ValueError('Unsafe manifest path')
  digest=hashlib.sha256()
  with (directory/relative).open('rb') as source:
   for chunk in iter(lambda:source.read(1024*1024),b''):digest.update(chunk)
  if digest.hexdigest()!=expected:raise ValueError('Backup checksum mismatch: '+name)

def backup_all():
 import saasctl as ctl
 os.umask(0o077)
 ctl.RUNTIME.mkdir(exist_ok=True,mode=0o700)
 with (ctl.RUNTIME/'backup-all.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  cfg=ctl.settings()
  recipient=cfg.get('SAAS_BACKUP_AGE_RECIPIENT','')
  remote=cfg.get('SAAS_BACKUP_REMOTE','')
  if bool(recipient)!=bool(remote):raise ValueError('Configure both AGE recipient and backup remote')
  if remote:
   if not re.fullmatch(r'[A-Za-z0-9_.-]+@[A-Za-z0-9.-]+:/[A-Za-z0-9_./-]+',remote) or '..' in remote.split(':',1)[1].split('/'):
    raise ValueError('Remote must be user@host:/absolute/path')
   if not recipient.startswith('age1') or not shutil.which('age') or not shutil.which('rsync'):
    raise ValueError('Install age/rsync and configure an age public recipient')
  identifier=datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-%f')
  report={'format':1,'createdAt':datetime.now(timezone.utc).isoformat(),'backups':{},'errors':{},'offsite':'not-configured'}
  try:
   path=ctl.backup_control();verify(path);report['backups']['control']=str(path)
  except Exception as e:report['errors']['control']=type(e).__name__
  for slug in ['lab1','lab2','lab3']:
   if not (ctl.RUNTIME/'labs'/slug/'compose.yaml').is_file():continue
   try:
    path=ctl.backup(slug);verify(path);report['backups'][slug]=str(path)
   except Exception as e:report['errors'][slug]=type(e).__name__
  # A portable disaster-recovery set needs the actual images, not only local IDs.
  if not report['errors']:
   try:
    image_refs={'postgres:15-alpine'}
    for slug in ['lab1','lab2','lab3']:
     compose=ctl.RUNTIME/'labs'/slug/'compose.yaml'
     if compose.is_file():
      for service in json.loads(compose.read_text())['services'].values():
       if service.get('image'):image_refs.add(service['image'])
    bundle=ctl.RUNTIME/'image-backups'/identifier;bundle.mkdir(parents=True,mode=0o700)
    for image in image_refs:
     subprocess.run(['docker','image','inspect',image],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','image','save','--output',str(bundle/'images.tar')]+sorted(image_refs),check=True,timeout=1800)
    digest=hashlib.sha256()
    with (bundle/'images.tar').open('rb') as f:
     for chunk in iter(lambda:f.read(1024*1024),b''):digest.update(chunk)
    (bundle/'manifest.json').write_text(json.dumps({'format':1,'files':{'images.tar':digest.hexdigest()}}))
    (bundle/'COMPLETE').write_text('Docker images saved.\n')
    ctl.encrypt_snapshot(bundle)
    verify(bundle);report['backups']['images']=str(bundle)
   except Exception as e:report['errors']['images']=type(e).__name__
  # Do not upload a partial set or mark it successful.
  if remote and not report['errors']:
   folder=ctl.RUNTIME/'offsite';folder.mkdir(exist_ok=True,mode=0o700)
   encrypted=folder/(identifier+'.tar.age')
   try:
    with subprocess.Popen(['age','-r',recipient,'-o',str(encrypted)],stdin=subprocess.PIPE) as process:
     with tarfile.open(fileobj=process.stdin,mode='w|') as archive:
      for name,path in report['backups'].items():archive.add(path,arcname=name)
     process.stdin.close()
     if process.wait()!=0:raise RuntimeError('Encryption failed')
    subprocess.run(['rsync','--archive','--',''+str(encrypted),remote.rstrip('/')+'/'],check=True,timeout=1800)
    report['offsite']='uploaded-encrypted'
   except Exception as e:report['errors']['offsite']=type(e).__name__;report['offsite']='failed'
  reports=ctl.RUNTIME/'backup-reports';reports.mkdir(exist_ok=True,mode=0o700)
  (reports/(identifier+'.json')).write_text(json.dumps(report,indent=2))
  latest=reports/'latest.pending';latest.write_text(json.dumps(report,indent=2));latest.replace(reports/'latest.json')
  print('Backup set:',identifier,'successful:',','.join(report['backups']),'offsite:',report['offsite'])
  if report['errors']:raise SystemExit('Backup set failed: '+','.join(report['errors']))
  if not remote:print('WARNING: Local copies only. Configure encrypted offsite storage before live use.')
