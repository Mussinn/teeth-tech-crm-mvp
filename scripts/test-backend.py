"""Run autonomous Go integration tests against a dedicated disposable database."""
from pathlib import Path
import os,subprocess
root=Path(__file__).resolve().parent.parent
values={}
for line in (root/'.env').read_text().splitlines():
 if line and not line.startswith('#') and '=' in line:
  k,v=line.split('=',1);values[k]=v

def run(args,**kwargs):
 return subprocess.run(args,cwd=root,check=True,**kwargs)
base=['docker','compose','exec','-T','postgres','psql','-U','mvp','-d','postgres','-v','ON_ERROR_STOP=1','-c']
# The name is fixed and deliberately differs from the application's database.
run(base+['DROP DATABASE IF EXISTS teethtech_mvp_go_test WITH (FORCE)'])
run(base+['CREATE DATABASE teethtech_mvp_go_test'])
env=os.environ.copy()
env.update(MVP_TEST_DATABASE_URL='postgres://mvp:'+values['POSTGRES_PASSWORD']+'@postgres:5432/teethtech_mvp_go_test?sslmode=disable',AWS_S3_ENDPOINT='http://minio:9000',AWS_S3_ACCESS_KEY=values['MINIO_ROOT_USER'],AWS_S3_SECRET_KEY=values['MINIO_ROOT_PASSWORD'])
try:
 run(['docker','run','--rm','--network','teeth-tech-crm-mvp_default','-v',str(root/'backend')+':/src:ro','-v','teethtech-mvp-go-test-modules:/go/pkg/mod','-v','teethtech-mvp-go-test-cache:/root/.cache/go-build','-w','/src','-e','MVP_TEST_DATABASE_URL','-e','AWS_S3_ENDPOINT','-e','AWS_S3_ACCESS_KEY','-e','AWS_S3_SECRET_KEY','golang:1.26-alpine','go','test','-tags=mvp','-count=1','-v','./integration'],env=env)
finally:
 run(base+['DROP DATABASE IF EXISTS teethtech_mvp_go_test WITH (FORCE)'])
