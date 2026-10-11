CREATE TABLE public.t_work_directions (
    id uuid NOT NULL,
    name varchar(255) NOT NULL,
    code varchar(100) NOT NULL,
    description varchar(500),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,
    CONSTRAINT t_work_directions_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX uq_work_direction_code_active
    ON public.t_work_directions (code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_work_direction_name_active
    ON public.t_work_directions (name) WHERE deleted_at IS NULL;

INSERT INTO public.t_work_directions
    (id, name, code, description, is_active, created_at, updated_at, deleted_at)
VALUES
    ('4ef06347-a847-5db2-99ea-1d871e00b7bf', 'Ортопедия', 'ORTHOPEDICS',
     'Ортопедические и протезные работы', true, now(), now(), NULL),
    ('1480d852-11df-55ad-a69e-967759646e7d', 'Ортодонтия', 'ORTHODONTICS',
     'Ортодонтические работы', true, now(), now(), NULL);

CREATE TABLE public.t_user_work_directions (
    user_id uuid NOT NULL REFERENCES public.t_users(id) ON DELETE CASCADE,
    work_direction_id uuid NOT NULL REFERENCES public.t_work_directions(id) ON DELETE CASCADE,
    CONSTRAINT t_user_work_directions_pkey PRIMARY KEY (user_id, work_direction_id)
);

ALTER TABLE public.t_order_tasks ADD COLUMN work_direction_id uuid;

-- Existing production data predates directions and represents the current
-- prosthetic/orthopedic production stream.
UPDATE public.t_order_tasks
SET work_direction_id = '4ef06347-a847-5db2-99ea-1d871e00b7bf'
WHERE work_direction_id IS NULL;

ALTER TABLE public.t_order_tasks ALTER COLUMN work_direction_id SET NOT NULL;
ALTER TABLE public.t_order_tasks
    ADD CONSTRAINT fk_order_task_work_direction
    FOREIGN KEY (work_direction_id) REFERENCES public.t_work_directions(id);
CREATE INDEX idx_order_tasks_work_direction ON public.t_order_tasks(work_direction_id);

-- Preserve the old dispatcher behaviour immediately after deployment. Admin
-- can narrow these scopes later through the user administration API.
INSERT INTO public.t_user_work_directions(user_id, work_direction_id)
SELECT ur.user_id, wd.id
FROM public.t_user_roles ur
JOIN public.t_roles r ON r.id = ur.role_id AND r.code = 'ROLE_DISPATCHER'
CROSS JOIN public.t_work_directions wd
ON CONFLICT DO NOTHING;
