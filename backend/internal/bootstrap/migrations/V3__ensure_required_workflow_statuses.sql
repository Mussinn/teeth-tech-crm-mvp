-- Every seeded workflow must contain the common lifecycle statuses:
-- TODO -> ... -> WAITING_FOR_APPROVAL -> ORDER_CLOSED.
--
-- V2 already starts every workflow with TODO and ends it with ORDER_CLOSED.
-- For workflows that skip approval, replace the final transition to
-- ORDER_CLOSED with a transition to WAITING_FOR_APPROVAL, then let a
-- dispatcher close the approved order.

WITH required_statuses AS (
    SELECT
        (
            SELECT id
            FROM public.t_order_statuses
            WHERE code = 'WAITING_FOR_APPROVAL'
        ) AS waiting_id,
        (
            SELECT id
            FROM public.t_order_statuses
            WHERE code = 'ORDER_CLOSED'
        ) AS closed_id
),
rewired_terminal_steps AS (
    UPDATE public.t_workflow_steps AS terminal_step
    SET
        to_status_id = required_statuses.waiting_id,
        updated_at = now()
    FROM required_statuses
    WHERE terminal_step.to_status_id = required_statuses.closed_id
      AND terminal_step.deleted_at IS NULL
      AND NOT EXISTS (
          SELECT 1
          FROM public.t_workflow_steps AS existing_step
          WHERE existing_step.work_type_id = terminal_step.work_type_id
            AND existing_step.deleted_at IS NULL
            AND (
                existing_step.from_status_id = required_statuses.waiting_id
                OR existing_step.to_status_id = required_statuses.waiting_id
            )
      )
    RETURNING terminal_step.work_type_id, terminal_step.sort_order
)
INSERT INTO public.t_workflow_steps (
    id,
    work_type_id,
    from_status_id,
    to_status_id,
    required_role,
    sort_order,
    created_at,
    updated_at,
    deleted_at,
    material_report_required,
    allow_unplanned_materials
)
SELECT
    public.uuid_generate_v4(),
    rewired.work_type_id,
    required_statuses.waiting_id,
    required_statuses.closed_id,
    'ROLE_DISPATCHER',
    rewired.sort_order + 1,
    now(),
    now(),
    NULL,
    false,
    false
FROM rewired_terminal_steps AS rewired
CROSS JOIN required_statuses;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.t_work_types AS work_type
        WHERE work_type.is_active = true
          AND work_type.deleted_at IS NULL
          AND EXISTS (
              SELECT 1
              FROM public.t_workflow_steps AS step
              WHERE step.work_type_id = work_type.id
                AND step.deleted_at IS NULL
          )
          AND EXISTS (
              SELECT 1
              FROM (
                  VALUES
                      ('TODO'),
                      ('WAITING_FOR_APPROVAL'),
                      ('ORDER_CLOSED')
              ) AS required_status(code)
              WHERE NOT EXISTS (
                  SELECT 1
                  FROM public.t_workflow_steps AS step
                  JOIN public.t_order_statuses AS from_status
                    ON from_status.id = step.from_status_id
                  JOIN public.t_order_statuses AS to_status
                    ON to_status.id = step.to_status_id
                  WHERE step.work_type_id = work_type.id
                    AND step.deleted_at IS NULL
                    AND required_status.code IN (from_status.code, to_status.code)
              )
          )
    ) THEN
        RAISE EXCEPTION
            'Active workflows must contain TODO, WAITING_FOR_APPROVAL and ORDER_CLOSED';
    END IF;
END
$$;
