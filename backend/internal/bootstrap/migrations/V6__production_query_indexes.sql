CREATE INDEX IF NOT EXISTS idx_orders_patient_history
    ON public.t_orders (patient_card_id, created_at DESC, id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_tasks_order_active
    ON public.t_order_tasks (order_id, created_at DESC, id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_tasks_direction_status_active
    ON public.t_order_tasks (work_direction_id, status_id, updated_at DESC, id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_tasks_recent_active
    ON public.t_order_tasks (updated_at DESC, id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_work_directions_direction_user
    ON public.t_user_work_directions (work_direction_id, user_id);

CREATE INDEX IF NOT EXISTS idx_clinic_cards_role_name_active
    ON public.t_clinic_user_cards (clinic_id, role, lower(full_name), id)
    WHERE deleted_at IS NULL;
