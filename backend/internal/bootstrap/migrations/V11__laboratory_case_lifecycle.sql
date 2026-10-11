CREATE TABLE mvp_lab_cases (
 order_id uuid PRIMARY KEY REFERENCES t_orders(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 0,
 state jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mvp_lab_case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES t_orders(id) ON DELETE CASCADE,
 event_type text NOT NULL,
 actor_id uuid NOT NULL REFERENCES t_users(id),
 actor_name text NOT NULL,
 details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX mvp_lab_case_events_order_time ON mvp_lab_case_events(order_id,created_at DESC,id);
