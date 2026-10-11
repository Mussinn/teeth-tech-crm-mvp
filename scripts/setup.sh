#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ]; then echo '.env уже существует, настройки сохранены.'; exit 0; fi
umask 077
python3 - <<'CONFIG'
import secrets,base64
from pathlib import Path
s=Path('.env.example').read_text()
for name in ['POSTGRES_PASSWORD','MINIO_ROOT_PASSWORD','MVP_ADMIN_PASSWORD','MVP_TRAINING_PASSWORD']:
 s=s.replace(name+'=\n',name+'='+secrets.token_hex(20)+'\n')
s=s.replace('JWT_SECRET=\n','JWT_SECRET='+base64.b64encode(secrets.token_bytes(48)).decode()+'\n')
Path('.env').write_text(s)
CONFIG
echo 'Создан .env с отдельными случайными паролями. Администратор: admin@teethtech.kz. Пароль: MVP_ADMIN_PASSWORD в .env.'
