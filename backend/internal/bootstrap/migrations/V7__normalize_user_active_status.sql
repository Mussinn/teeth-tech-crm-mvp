-- The account lifecycle is binary for authentication. Preserve users and all
-- their historical relations while normalizing legacy operational statuses.
ALTER TABLE public.t_users DROP CONSTRAINT IF EXISTS chk_users_status;

UPDATE public.t_users
SET status = 'INACTIVE', updated_at = now()
WHERE status IN ('BUSY', 'BLOCKED', 'DISMISSED');

ALTER TABLE public.t_users
    ADD CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'INACTIVE'));
