"""Produce a portable source release without runtime credentials or data."""
from pathlib import Path
import tarfile,zipfile
root=Path(__file__).resolve().parent.parent
out=root/'artifacts';out.mkdir(exist_ok=True)
exclude={'artifacts','bin','node_modules','.next','target','.git','.idea','.npm-cache','.npm-packs','__pycache__','.aws','.codex','.saas-runtime'}
files=[]
for p in root.rglob('*'):
 rel=p.relative_to(root)
 if any(part in exclude for part in rel.parts):continue
 if not p.is_file() or p.is_symlink():continue
 if p.name.startswith('.env') and p.name!='.env.example':continue
 if p.name in ('.DS_Store','.operations.lock') or p.suffix in ('.log','.tsbuildinfo','.key','.pem','.lic'):continue
 files.append(p)
with zipfile.ZipFile(out/'teeth-tech-crm-mvp.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for p in files:archive.write(p,Path('teeth-tech-crm-mvp')/p.relative_to(root))
with tarfile.open(out/'teeth-tech-crm-mvp.tar.gz','w:gz') as archive:
 for p in files:archive.add(p,arcname=Path('teeth-tech-crm-mvp')/p.relative_to(root),recursive=False)
print(f'Prepared {len(files)} files: artifacts/teeth-tech-crm-mvp.zip and .tar.gz; no .env/runtime data.')
