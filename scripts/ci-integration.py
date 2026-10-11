"""Run all Go integration scenarios in an isolated disposable Compose project."""
from pathlib import Path
import os, subprocess, uuid
ROOT=Path(__file__).resolve().parent.parent

def main():
 env=os.environ.copy()
 for key in ('COMPOSE_PROJECT_NAME','COMPOSE_FILE','COMPOSE_ENV_FILES','COMPOSE_PROFILES'):
  env.pop(key,None)
 project='teethtech-ci-'+uuid.uuid4().hex[:12]
 compose=['docker','compose','--project-name',project,'--file',str(ROOT/'ci/compose.yaml')]
 def run(args,**kw):return subprocess.run(compose+args,env=env,cwd=ROOT,check=True,**kw)
 try:
  run(['up','-d','--build','--wait','--wait-timeout','240','postgres','storage'])
  run(['run','--rm','integration'])
 finally:
  run(['down','--volumes','--remove-orphans'])

if __name__=='__main__':main()
