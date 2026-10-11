"""Authenticate and decrypt a .ttbk archive into a new private directory."""
import argparse,os,subprocess,tarfile,tempfile
from pathlib import Path
os.umask(0o077)
p=argparse.ArgumentParser(description=__doc__);p.add_argument('archive',type=Path);p.add_argument('--key',required=True,type=Path);p.add_argument('--destination',required=True,type=Path);a=p.parse_args()
source=a.archive.resolve();key=a.key.resolve();dest=a.destination.resolve()
if dest.exists():p.error('destination must not already exist')
if not source.is_file() or not key.is_file():p.error('archive and key must exist')
if len(key.read_bytes())!=32 or key.stat().st_mode&0o077:p.error('key must be 32 bytes with permissions 0600')
dest.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
with tempfile.TemporaryDirectory(prefix='teethtech-decrypt-',dir=dest.parent) as td:
 tmp=Path(td)
 args=['docker','run','--rm','--network','none','--user',str(os.getuid())+':'+str(os.getgid()),'-v',str(key)+':/backup.key:ro','-v',str(source)+':/input.ttbk:ro','-v',str(tmp)+':/out','--entrypoint','backupcrypt','teethtech-pilot-backend:v1','-mode','decrypt','-key','/backup.key','-in','/input.ttbk','-out','/out/archive.tar']
 subprocess.run(args,check=True)
 with tarfile.open(tmp/'archive.tar','r:') as archive:
  members=archive.getmembers()
  for m in members:
   if not (m.isfile() or m.isdir()) or Path(m.name).is_absolute() or '..' in Path(m.name).parts:raise ValueError('unsafe archive entry')
  dest.mkdir(mode=0o700)
  for m in members:m.mode=0o700 if m.isdir() else 0o600;m.uid=os.getuid();m.gid=os.getgid();m.uname='';m.gname=''
  archive.extractall(dest,members=members)
print('Authenticated backup restored to private directory:',dest)
