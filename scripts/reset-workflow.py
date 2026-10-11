"""Clear workflow configuration only in an empty MVP; save a database backup first."""
from pathlib import Path
from datetime import datetime
import os, subprocess
root=Path(__file__).resolve().parent.parent
compose=['docker','compose']
def run(args,**kwargs):
    return subprocess.run(compose+args,cwd=root,check=True,**kwargs)
backup=root/'artifacts'/'backups'/('before-workflow-reset-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True,mode=0o700)
run(['stop','gateway','frontend','backend'])
try:
    dump=run(['exec','-T','postgres','sh','-c','pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"'],capture_output=True)
    target=backup/'database.sql';target.write_bytes(dump.stdout);os.chmod(target,0o600)
    sql="""BEGIN;
SELECT pg_advisory_xact_lock(841337,1);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM t_orders) OR EXISTS(SELECT 1 FROM t_order_tasks) THEN
 RAISE EXCEPTION 'Refusing reset: remove training orders first; existing customer orders must be preserved'; END IF;
 IF (SELECT count(*) FROM t_order_statuses WHERE code IN ('TODO','WAITING_FOR_APPROVAL','ORDER_CLOSED')) <> 3 THEN
 RAISE EXCEPTION 'Required system statuses missing'; END IF;
END $$;
UPDATE t_work_types SET is_active=false,updated_at=now() WHERE id IN(SELECT work_type_id FROM t_workflow_steps);
DELETE FROM t_workflow_steps;
DELETE FROM t_order_statuses WHERE code NOT IN('TODO','WAITING_FOR_APPROVAL','ORDER_CLOSED');
COMMIT;
"""
    (backup/'reset.sql').write_text(sql);os.chmod(backup/'reset.sql',0o600)
    run(['exec','-T','postgres','sh','-c','psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'],input=sql,text=True)
finally:
    run(['up','-d','--wait','--wait-timeout','180'])
print('Workflow cleared. System statuses and employees preserved. Backup:',backup)
