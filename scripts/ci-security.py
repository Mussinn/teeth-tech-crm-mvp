"""Run npm audits; fail on runtime findings or unreviewed/expired high development findings."""
from pathlib import Path
from datetime import date
import argparse,json,subprocess,sys
ROOT=Path(__file__).resolve().parent.parent

def evaluate(runtime,development,policy,today):
 for report in (runtime,development):
  if report.get('error') or not report.get('metadata'):
   raise ValueError('Security advisory service failed; refusing a clean result')
 runtime_vulns=runtime.get('vulnerabilities',{})
 blocked={name for name,v in runtime_vulns.items() if v.get('severity') in ('high','critical')}
 if blocked:raise ValueError('Runtime high/critical advisories: '+', '.join(sorted(blocked)))
 exceptions=policy.get('developmentOnly',{})
 vulnerabilities=development.get('vulnerabilities',{})
 accepted=set()
 def advisories(name,seen):
  if name in seen:return []
  found=[]
  for value in vulnerabilities[name].get('via',[]):
   if isinstance(value,str):
    if value not in vulnerabilities:raise ValueError('Incomplete advisory chain')
    found.extend(advisories(value,seen|{name}))
   else:found.append(value)
  return found
 for name,v in vulnerabilities.items():
  if v.get('severity') not in ('high','critical'):continue
  chain=advisories(name,set())
  if not chain:raise ValueError('Unexplained dependency finding: '+name)
  for entry in chain:
   identifier=entry.get('url','').rsplit('/',1)[-1]
   allowed=exceptions.get(identifier)
   if not allowed or today>date.fromisoformat(allowed['reviewBy']):
    raise ValueError('Unreviewed or expired development advisory: '+identifier)
   # A finding must not leak into the production dependency audit.
   if name in runtime_vulns:raise ValueError('Development exception appears in runtime: '+name)
   accepted.add(identifier)
 return sorted(accepted)

def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'artifacts/production-audit');args=p.parse_args()
 args.output.mkdir(parents=True,exist_ok=True)
 reports={}
 for scope,flags in [('runtime',['--omit=dev']),('development',[])]:
  result=subprocess.run(['npm','audit','--json',*flags],cwd=ROOT/'frontend',capture_output=True,text=True)
  if result.returncode not in (0,1):raise ValueError('npm audit failed for '+scope)
  report=json.loads(result.stdout);reports[scope]=report
  (args.output/('npm-'+scope+'-audit.json')).write_text(json.dumps(report,indent=2))
 policy=json.loads((ROOT/'ci/audit-policy.json').read_text())
 accepted=evaluate(reports['runtime'],reports['development'],policy,date.today())
 print('Runtime high/critical audit: passed')
 for identifier in accepted:print('Reviewed development-only exception:',identifier,'expires',policy['developmentOnly'][identifier]['reviewBy'])

if __name__=='__main__':
 try:main()
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
