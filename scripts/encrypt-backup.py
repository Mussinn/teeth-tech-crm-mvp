"""Create a private authenticated encrypted archive for transfer to separate storage.
Never include the recovery key in the backup or send it to the backup destination.
"""
import argparse,os,secrets,subprocess,tarfile
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('backup',nargs='?',type=Path)
p.add_argument('--key',required=True,type=Path)
p.add_argument('--output',type=Path)
p.add_argument('--generate-key',action='store_true')
a=p.parse_args();key=a.key.resolve()
if a.generate_key:
 key.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
 fd=os.open(key,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
 with os.fdopen(fd,'wb') as f:f.write(secrets.token_bytes(32))
 print('Ключ создан. Сохраните отдельную защищённую копию ключа; без него восстановление невозможно.');raise SystemExit
if not a.backup or not a.output:p.error('backup and --output required')
backup=a.backup.resolve();output=a.output.resolve()
if not backup.is_dir():p.error('backup directory does not exist')
if key==backup or backup in key.parents:p.error('recovery key must be outside the backup')
if not key.is_file() or len(key.read_bytes())!=32 or key.stat().st_mode&0o077:p.error('key must be 32 bytes with permissions 0600')
if output.exists() or backup in output.parents:p.error('output must be new and outside backup directory')
output.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
args=['docker','run','--rm','-i','--network','none','--user',str(os.getuid())+':'+str(os.getgid()),'-v',str(key)+':/backup.key:ro','-v',str(output.parent)+':/out','--entrypoint','backupcrypt','teethtech-pilot-backend:v1','-key','/backup.key','-out','/out/'+output.name]
process=subprocess.Popen(args,stdin=subprocess.PIPE)
try:
 with tarfile.open(fileobj=process.stdin,mode='w|') as archive:archive.add(backup,arcname=backup.name)
 process.stdin.close()
 if process.wait()!=0:raise RuntimeError('encrypted backup failed')
 print('Зашифрованная копия:',output)
except BaseException:
 process.kill();process.wait();output.unlink(missing_ok=True);raise
