CREATE TABLE public.mvp_file_uploads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.t_order_tasks(id),
 user_id uuid NOT NULL REFERENCES public.t_users(id), file_name varchar(255) NOT NULL,
 content_type varchar(100) NOT NULL, storage_path varchar(512) NOT NULL UNIQUE,
 upload_id text NOT NULL, total_parts integer NOT NULL CHECK(total_parts BETWEEN 1 AND 10000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mvp_file_parts (
 upload_id uuid NOT NULL REFERENCES public.mvp_file_uploads(id) ON DELETE CASCADE,
 part_number integer NOT NULL CHECK(part_number BETWEEN 1 AND 10000), etag text NOT NULL,
 file_size bigint NOT NULL CHECK(file_size >= 0), PRIMARY KEY(upload_id,part_number)
);
