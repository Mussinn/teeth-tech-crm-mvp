CREATE TABLE mvp_task_completions (
 id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES t_order_tasks(id),
 order_id uuid NOT NULL REFERENCES t_orders(id),order_number varchar(50),work_name text NOT NULL,
 quantity integer NOT NULL,employee_id uuid NOT NULL REFERENCES t_users(id), employee_name text NOT NULL,
 closed_by uuid NOT NULL REFERENCES t_users(id),closed_by_name text NOT NULL,
 from_status text NOT NULL,to_status text NOT NULL,terminal boolean NOT NULL,
 completed_at timestamptz NOT NULL
);
CREATE INDEX mvp_completions_employee_time ON mvp_task_completions(employee_id,completed_at DESC);
CREATE INDEX mvp_completions_time ON mvp_task_completions(completed_at DESC);
CREATE TABLE mvp_bootstrap (id integer PRIMARY KEY CHECK(id=1));
