-- Remove only the deterministic UI demo orders seeded by V2. Soft deletion
-- keeps foreign-key history intact while excluding these rows from operational
-- queries and dashboards.
UPDATE public.t_order_tasks task
SET deleted_at = COALESCE(task.deleted_at, now()),
    updated_at = now()
FROM public.t_orders demo_order
WHERE task.order_id = demo_order.id
  AND demo_order.order_number LIKE 'TT-UI-%'
  AND task.deleted_at IS NULL;

UPDATE public.t_orders
SET deleted_at = COALESCE(deleted_at, now()),
    is_active = false,
    updated_at = now()
WHERE order_number LIKE 'TT-UI-%'
  AND deleted_at IS NULL;
