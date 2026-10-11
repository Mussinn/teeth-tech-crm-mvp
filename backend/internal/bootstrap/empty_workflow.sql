SELECT pg_advisory_xact_lock(841337,1);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM t_orders WHERE id NOT IN ('826e9a85-d55e-56d7-979e-c4e980e24aff','2b39c49c-517e-5c47-822d-8e97623ac746','43ae1bc0-4b32-5a1b-86bd-a6303ebdae2a','cb533aa4-9912-5989-950f-8a9f2c952e36','46f6624e-5afd-564f-bc66-ed24aa7f60cb','7b4c1f89-8e1e-5de9-a244-d8532afdd2f3')) THEN RAISE EXCEPTION 'Only a new workspace or an empty database may be reset'; END IF;
 IF EXISTS(SELECT 1 FROM t_order_statuses WHERE code IN ('TODO','WAITING_FOR_APPROVAL','ORDER_CLOSED') AND NOT is_active) THEN RAISE EXCEPTION 'System statuses must be active'; END IF;
END $$;
-- Remove only the six immutable seeded order IDs; never customer orders.
DELETE FROM t_orders;
UPDATE t_work_types SET is_active=false,updated_at=now() WHERE id IN(SELECT work_type_id FROM t_workflow_steps);
DELETE FROM t_workflow_steps;
DELETE FROM t_order_statuses WHERE code NOT IN('TODO','WAITING_FOR_APPROVAL','ORDER_CLOSED');

-- Hide unused seeded services in a fresh workspace; preserve historical rows.
UPDATE t_work_types SET is_active=false,deleted_at=now(),updated_at=now() WHERE deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM t_order_tasks t WHERE t.work_type_id=t_work_types.id);
