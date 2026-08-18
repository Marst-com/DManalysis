-- DuoMarst Analytics — Supabase Schema
-- Run this in Supabase SQL editor before using SupabaseAdapter.
-- All tables use RLS disabled (backend uses service_role key).

-- Users
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'VIEWER',
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  refresh_token_hash TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Sites
CREATE TABLE IF NOT EXISTS sites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  domain     TEXT DEFAULT '',
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);
CREATE INDEX IF NOT EXISTS idx_sites_owner ON sites(owner_id);

-- Site Access (per-site RBAC)
CREATE TABLE IF NOT EXISTS site_access (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'VIEWER',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_site_access_site ON site_access(site_id);

-- API Keys (ingestion keys — hashed)
CREATE TABLE IF NOT EXISTS api_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  key_hash   TEXT UNIQUE NOT NULL,  -- SHA-256, never store raw key
  label      TEXT NOT NULL DEFAULT 'Default',
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_site ON api_keys(site_id);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  event_name      TEXT NOT NULL,
  session_id      TEXT,
  device_category TEXT,
  browser         TEXT,
  os              TEXT,
  region_coarse   TEXT,  -- ISO 3166-1 alpha-2 country code only
  referrer        TEXT,  -- origin only, no path/query (privacy)
  timestamp       BIGINT NOT NULL,  -- ms since epoch
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB
);
CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events(site_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_site_name ON events(site_id, event_name);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(site_id, session_id) WHERE session_id IS NOT NULL;

-- Audit Logs (append-only, never update/delete)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  site_id     UUID REFERENCES sites(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  result      TEXT NOT NULL DEFAULT 'SUCCESS',
  metadata    JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_site ON audit_logs(site_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, ts DESC);

-- Disable RLS (backend uses service_role key which bypasses RLS anyway)
-- Enable RLS only if you add client-side Supabase access in future
ALTER TABLE users       DISABLE ROW LEVEL SECURITY;
ALTER TABLE sites       DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_access DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys    DISABLE ROW LEVEL SECURITY;
ALTER TABLE events      DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs  DISABLE ROW LEVEL SECURITY;
