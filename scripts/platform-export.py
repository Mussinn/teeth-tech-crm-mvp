"""Export only one laboratory's support and community records; no owner credentials."""
import argparse,os,subprocess
from pathlib import Path
os.umask(0o077)
p=argparse.ArgumentParser();p.add_argument('lab',choices=['lab1','lab2','lab3']);p.add_argument('destination',type=Path);a=p.parse_args();slot=int(a.lab[-1]);a.destination.mkdir(parents=True,exist_ok=False,mode=0o700)
root=Path(__file__).resolve().parent.parent
database='teethtech_saas'
if os.environ.get('MVP_PLATFORM_EXPORT_TEST')=='1':database='teethtech_platform_browser_test'
base=['docker','compose','exec','-T','postgres','psql','-U','saas','-d',database,'-v','ON_ERROR_STOP=1','-A','-t','-c']
queries={
 'tickets':f"SELECT (to_jsonb(t)-'requester')::text FROM saas_support_tickets t WHERE slot={slot} ORDER BY id",
 'messages':f"SELECT to_jsonb(m)::text FROM saas_support_messages m JOIN saas_support_tickets t ON t.id=m.ticket_id WHERE t.slot={slot} ORDER BY m.id",
 'attachments':f"SELECT jsonb_build_object('id',f.id,'ticketId',f.ticket_id,'name',f.filename,'mime',f.mime,'dataBase64',encode(f.data,'base64'))::text FROM saas_support_files f JOIN saas_support_tickets t ON t.id=f.ticket_id WHERE t.slot={slot} ORDER BY f.id",
 'profile':f"SELECT to_jsonb(p)::text FROM saas_community_profiles p WHERE slot={slot}",
 'posts':f"SELECT (to_jsonb(p)-'author')::text FROM saas_community_posts p WHERE slot={slot} ORDER BY id",
 'comments':f"SELECT to_jsonb(c)::text FROM saas_community_comments c WHERE slot={slot} ORDER BY id",
 'reports':f"SELECT to_jsonb(r)::text FROM saas_community_reports r WHERE slot={slot} ORDER BY id",
}
for name,query in queries.items():
 with (a.destination/(name+'.jsonl')).open('wb') as out:subprocess.run(base+[query],cwd=root/'saas',stdout=out,check=True)
subprocess.run(base+[f"INSERT INTO saas_events(slot,action) VALUES({slot},'LAB_DATA_EXPORT')"],cwd=root/'saas',check=True,stdout=subprocess.DEVNULL)
print('Laboratory platform data exported:',a.destination)
