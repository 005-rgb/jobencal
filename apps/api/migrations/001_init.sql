-- Initial JOBENAPP schema. Kept as SQL so the production migration is auditable.
CREATE TYPE user_role AS ENUM ('user', 'editor', 'admin');
CREATE TYPE token_type AS ENUM ('verify_email', 'reset_password', 'magic_link');
CREATE TYPE publish_st AS ENUM ('draft', 'published', 'archived');
CREATE TYPE content_kind AS ENUM ('explanation', 'example', 'faq', 'legal_note');
CREATE TYPE holiday_kind AS ENUM ('nasional', 'cuti_bersama');
CREATE TYPE msg_status AS ENUM ('new', 'read', 'replied', 'spam');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'user',
  email_verified_at timestamptz,
  totp_secret_enc text,
  totp_enabled boolean NOT NULL DEFAULT false,
  recovery_hashes text[] NOT NULL DEFAULT '{}',
  failed_logins smallint NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  csrf_secret text NOT NULL,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type token_type NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE consents (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  anon_id text,
  purpose text NOT NULL CHECK (purpose IN ('analytics', 'ads', 'save_history')),
  granted boolean NOT NULL,
  policy_ver text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id smallserial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE tools (
  id serial PRIMARY KEY,
  category_id smallint NOT NULL REFERENCES categories(id),
  slug text NOT NULL,
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  engine_key text NOT NULL,
  rate_keys text[] NOT NULL DEFAULT '{}',
  seo_title text,
  seo_description text,
  status publish_st NOT NULL DEFAULT 'draft',
  sort_order smallint NOT NULL DEFAULT 0,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE TABLE tool_contents (
  id serial PRIMARY KEY,
  tool_id integer NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  kind content_kind NOT NULL,
  title text NOT NULL DEFAULT '',
  body_md text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE INDEX tool_contents_tool_idx ON tool_contents (tool_id, kind, sort_order);

CREATE TABLE tool_relations (
  tool_id integer REFERENCES tools(id) ON DELETE CASCADE,
  related_tool_id integer REFERENCES tools(id) ON DELETE CASCADE,
  sort_order smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (tool_id, related_tool_id),
  CHECK (tool_id <> related_tool_id)
);

CREATE TABLE tool_spec_versions (
  id serial PRIMARY KEY,
  tool_id integer NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  version integer NOT NULL,
  formula_definition jsonb NOT NULL,
  rounding_rule jsonb NOT NULL,
  exception_rules jsonb NOT NULL DEFAULT '{}',
  source_refs jsonb NOT NULL CHECK (jsonb_typeof(source_refs) = 'array'),
  effective_from date NOT NULL,
  effective_to date,
  owner_team text NOT NULL,
  created_by uuid REFERENCES users(id),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  source_checked_at date NOT NULL,
  review_due_at date,
  status publish_st NOT NULL DEFAULT 'draft',
  published_by uuid REFERENCES users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tool_id, version),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (status <> 'published' OR (
    created_by IS NOT NULL AND reviewed_by IS NOT NULL
    AND reviewed_by <> created_by AND reviewed_at IS NOT NULL
    AND published_by IS NOT NULL AND published_at IS NOT NULL
    AND jsonb_array_length(source_refs) > 0
  ))
);

CREATE TABLE rate_versions (
  id serial PRIMARY KEY,
  rate_key text NOT NULL,
  version integer NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  data jsonb NOT NULL,
  source_url text NOT NULL,
  source_note text NOT NULL DEFAULT '',
  source_refs jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(source_refs) = 'array'),
  source_checked_at date NOT NULL,
  formula_type text NOT NULL DEFAULT 'standard',
  rounding_rule jsonb NOT NULL DEFAULT '{}',
  exception_rules jsonb NOT NULL DEFAULT '{}',
  owner_team text NOT NULL,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  review_due_at date,
  status publish_st NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES users(id),
  published_by uuid REFERENCES users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rate_key, version),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (status <> 'published' OR (
    created_by IS NOT NULL AND reviewed_by IS NOT NULL
    AND reviewed_by <> created_by AND reviewed_at IS NOT NULL
    AND published_by IS NOT NULL AND published_at IS NOT NULL
  ))
);
CREATE UNIQUE INDEX rate_pub_uq ON rate_versions (rate_key, effective_from)
  WHERE status = 'published';

CREATE TABLE rate_test_cases (
  id serial PRIMARY KEY,
  rate_key text NOT NULL,
  tool_id integer NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  spec_version_id integer NOT NULL REFERENCES tool_spec_versions(id),
  rate_version_id integer REFERENCES rate_versions(id),
  name text NOT NULL,
  input jsonb NOT NULL,
  expected jsonb NOT NULL,
  source_ref text NOT NULL,
  regulation_ref text NOT NULL DEFAULT '',
  is_edge_case boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  verified_by uuid REFERENCES users(id),
  tolerance numeric NOT NULL DEFAULT 0 CHECK (tolerance >= 0)
);

CREATE TABLE regions (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('provinsi', 'kabupaten', 'kota')),
  parent_id integer REFERENCES regions(id)
);

CREATE TABLE minimum_wages (
  region_id integer NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  year smallint NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  source_url text NOT NULL,
  PRIMARY KEY (region_id, year)
);

CREATE TABLE holidays (
  id serial PRIMARY KEY,
  day date NOT NULL,
  name text NOT NULL,
  kind holiday_kind NOT NULL,
  source_url text NOT NULL,
  UNIQUE (day, name)
);
CREATE INDEX holidays_year_idx ON holidays (day);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX projects_user_idx ON projects (user_id) WHERE deleted_at IS NULL;

CREATE TABLE calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id integer NOT NULL REFERENCES tools(id),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  input jsonb NOT NULL,
  result_summary jsonb NOT NULL,
  rate_version_ids integer[] NOT NULL DEFAULT '{}',
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX calc_user_idx ON calculations (user_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX calc_project_idx ON calculations (project_id) WHERE project_id IS NOT NULL;

CREATE TABLE contact_messages (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status msg_status NOT NULL DEFAULT 'new',
  ip_hash text,
  handled_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analytics_events (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (event IN ('view', 'calculate', 'copy', 'share', 'download')),
  tool_id integer REFERENCES tools(id) ON DELETE SET NULL,
  path text NOT NULL,
  visitor_key text NOT NULL,
  device text,
  referrer_host text
);
CREATE INDEX analytics_time_idx ON analytics_events (occurred_at);
CREATE INDEX analytics_tool_idx ON analytics_events (tool_id, occurred_at);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  diff jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON audit_logs (entity_type, entity_id);

CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL CHECK (hits >= 0),
  window_start timestamptz NOT NULL
);
