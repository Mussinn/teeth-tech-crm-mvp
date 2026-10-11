CREATE TABLE IF NOT EXISTS mvp_implants (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), code varchar(255) NOT NULL DEFAULT '', name varchar(255) NOT NULL,
 description text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS mvp_implants_name ON mvp_implants(lower(name)) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS mvp_model_systems (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), code varchar(255) NOT NULL DEFAULT '', name varchar(255) NOT NULL,
 description text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS mvp_model_systems_name ON mvp_model_systems(lower(name)) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS mvp_tooth_sets (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), code varchar(255) NOT NULL DEFAULT '', name varchar(255) NOT NULL,
 description text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS mvp_tooth_sets_name ON mvp_tooth_sets(lower(name)) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS mvp_shade_systems (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), code varchar(255) NOT NULL DEFAULT '', name varchar(255) NOT NULL,
 description text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS mvp_shade_systems_name ON mvp_shade_systems(lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mvp_task_stage_history ON t_order_task_history(task_id,changed_at DESC) WHERE field_name='STATUS';
