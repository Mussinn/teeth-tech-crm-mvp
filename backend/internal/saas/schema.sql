CREATE TABLE IF NOT EXISTS saas_owner (id integer PRIMARY KEY CHECK(id=1), email text NOT NULL, password_hash text NOT NULL);
CREATE TABLE IF NOT EXISTS saas_sessions (token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS saas_labs (
 slot integer PRIMARY KEY CHECK(slot BETWEEN 1 AND 3), name text NOT NULL, contact_email text NOT NULL,
 invite_hash text UNIQUE NOT NULL, invite_expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'INVITED', admin_name text NOT NULL DEFAULT '', admin_hash text NOT NULL DEFAULT '',
 trial_days integer NOT NULL DEFAULT 30, trial_ends_at timestamptz, error text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), registered_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas_jobs (
 id bigserial PRIMARY KEY, slot integer NOT NULL REFERENCES saas_labs(slot), action text NOT NULL,
 state text NOT NULL DEFAULT 'PENDING', lease_hash text NOT NULL DEFAULT '', lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS saas_one_job ON saas_jobs(slot) WHERE state IN ('PENDING','RUNNING');
CREATE TABLE IF NOT EXISTS saas_events (id bigserial PRIMARY KEY, slot integer REFERENCES saas_labs(slot), action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS saas_worker (id integer PRIMARY KEY CHECK(id=1), last_seen timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS saas_support_tickets (
 id bigserial PRIMARY KEY, slot integer NOT NULL REFERENCES saas_labs(slot), requester text NOT NULL, title text NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','WAITING','RESOLVED')), page text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS saas_support_messages (
 id bigserial PRIMARY KEY, ticket_id bigint NOT NULL REFERENCES saas_support_tickets(id), author text NOT NULL, owner_reply boolean NOT NULL DEFAULT false,
 body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS saas_support_files (
 id bigserial PRIMARY KEY, ticket_id bigint NOT NULL REFERENCES saas_support_tickets(id), filename text NOT NULL, mime text NOT NULL, data bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS saas_support_lab ON saas_support_tickets(slot,updated_at DESC);
CREATE TABLE IF NOT EXISTS saas_community_profiles (
 slot integer PRIMARY KEY REFERENCES saas_labs(slot), public_name text NOT NULL, city text NOT NULL DEFAULT '', enabled boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS saas_community_posts (
 id bigserial PRIMARY KEY, slot integer NOT NULL REFERENCES saas_labs(slot), author text NOT NULL, category text NOT NULL,
 title text NOT NULL, body text NOT NULL, hidden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS saas_community_comments (
 id bigserial PRIMARY KEY, post_id bigint NOT NULL REFERENCES saas_community_posts(id), slot integer NOT NULL REFERENCES saas_labs(slot), body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS saas_community_reports (
 id bigserial PRIMARY KEY, post_id bigint NOT NULL REFERENCES saas_community_posts(id), slot integer NOT NULL REFERENCES saas_labs(slot), reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(post_id,slot));
CREATE TABLE IF NOT EXISTS saas_owner_mfa(id integer PRIMARY KEY CHECK(id=1),secret text NOT NULL,enabled boolean NOT NULL DEFAULT false,pending_until timestamptz NOT NULL,last_counter bigint NOT NULL DEFAULT -1);
