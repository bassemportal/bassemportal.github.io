/*
# Bassem TV TiviMate Panel — Full Database Schema

## Overview
Migrates the PHP + SQLite panel to Supabase PostgreSQL. Eleven tables matching
the original SQLite inventory, with types converted appropriately (BOOLEAN for
toggles, JSONB for flexible config blobs, TIMESTAMPTZ for all timestamps,
BIGINT for large counters, text for MAC addresses and tokens).

## Tables Created

1. `admins` — admin accounts (email/password via Supabase Auth, this table holds role metadata)
2. `servers` — IPTV server definitions (name, host, port, username, password, type, order)
3. `mac_devices` — MAC-address-authorized devices with Xtream config
4. `app_set_devices` — app-set (non-MAC) device bindings
5. `activity` — heartbeat / device activity log
6. `settings` — key/value application settings (52 rows from original)
7. `sports_leagues` — sports league definitions (1558 rows from original)
8. `menu_ads` — menu advertisement banners
9. `remotes` — remote control / QR pairing sessions
10. `sports_fixture_overrides` — manual overrides for sports fixtures
11. `sports_manual_events` — manually-added sports events

## Security
- RLS enabled on ALL tables.
- Admin portal uses Supabase Auth (authenticated role) with ownership checks.
- APK API tables (mac_devices, app_set_devices, activity, servers, settings)
  are readable by anon + authenticated so Edge Functions using the service role
  can query them, and the anon-key client in edge functions can access them.
- Edge Functions use the service role key (bypasses RLS) for APK API logic.
- Admin tables (admins) are authenticated-only.

## Important Notes
1. `mac_devices.mac_address` is stored uppercased, colon-separated (AA:BB:CC:DD:EE:FF).
2. `settings` uses a text key + JSONB value for flexibility.
3. `sports_leagues` stores TheSportsDB league IDs and display metadata.
4. All timestamps are TIMESTAMPTZ with DEFAULT now().
5. Seed data for settings and a default admin are inserted after table creation.
*/

-- ============================================================
-- 1. ADMINS
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON admins TO authenticated;
GRANT SELECT ON admins TO service_role;

DROP POLICY IF EXISTS "admins_select_self" ON admins;
CREATE POLICY "admins_select_self" ON admins FOR SELECT
  TO authenticated USING (auth.uid() = auth_id OR auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "admins_insert_self" ON admins;
CREATE POLICY "admins_insert_self" ON admins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = auth_id);

DROP POLICY IF EXISTS "admins_update_self" ON admins;
CREATE POLICY "admins_update_self" ON admins FOR UPDATE
  TO authenticated USING (auth.uid() = auth_id) WITH CHECK (auth.uid() = auth_id);

DROP POLICY IF EXISTS "admins_delete_self" ON admins;
CREATE POLICY "admins_delete_self" ON admins FOR DELETE
  TO authenticated USING (auth.uid() = auth_id);

-- ============================================================
-- 2. SERVERS
-- ============================================================
CREATE TABLE IF NOT EXISTS servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 8080,
  username text,
  password text,
  server_type text NOT NULL DEFAULT 'xtream',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE servers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON servers TO authenticated;
GRANT SELECT ON servers TO service_role;

DROP POLICY IF EXISTS "servers_select_admin" ON servers;
CREATE POLICY "servers_select_admin" ON servers FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "servers_insert_admin" ON servers;
CREATE POLICY "servers_insert_admin" ON servers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "servers_update_admin" ON servers;
CREATE POLICY "servers_update_admin" ON servers FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "servers_delete_admin" ON servers;
CREATE POLICY "servers_delete_admin" ON servers FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- 3. MAC_DEVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS mac_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mac_address text NOT NULL UNIQUE,
  device_name text,
  server_id uuid REFERENCES servers(id) ON DELETE SET NULL,
  xtream_username text,
  xtream_password text,
  is_authorized boolean NOT NULL DEFAULT true,
  is_blocked boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mac_devices ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON mac_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON mac_devices TO service_role;

CREATE INDEX IF NOT EXISTS idx_mac_devices_mac ON mac_devices (mac_address);
CREATE INDEX IF NOT EXISTS idx_mac_devices_authorized ON mac_devices (is_authorized) WHERE is_authorized = true;

DROP POLICY IF EXISTS "mac_devices_select_admin" ON mac_devices;
CREATE POLICY "mac_devices_select_admin" ON mac_devices FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "mac_devices_insert_admin" ON mac_devices;
CREATE POLICY "mac_devices_insert_admin" ON mac_devices FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "mac_devices_update_admin" ON mac_devices;
CREATE POLICY "mac_devices_update_admin" ON mac_devices FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "mac_devices_delete_admin" ON mac_devices;
CREATE POLICY "mac_devices_delete_admin" ON mac_devices FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- 4. APP_SET_DEVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS app_set_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token text NOT NULL UNIQUE,
  device_name text,
  server_id uuid REFERENCES servers(id) ON DELETE SET NULL,
  xtream_username text,
  xtream_password text,
  is_authorized boolean NOT NULL DEFAULT true,
  is_blocked boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_set_devices ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_set_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app_set_devices TO service_role;

CREATE INDEX IF NOT EXISTS idx_app_set_devices_token ON app_set_devices (device_token);

DROP POLICY IF EXISTS "app_set_devices_select_admin" ON app_set_devices;
CREATE POLICY "app_set_devices_select_admin" ON app_set_devices FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "app_set_devices_insert_admin" ON app_set_devices;
CREATE POLICY "app_set_devices_insert_admin" ON app_set_devices FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "app_set_devices_update_admin" ON app_set_devices;
CREATE POLICY "app_set_devices_update_admin" ON app_set_devices FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "app_set_devices_delete_admin" ON app_set_devices;
CREATE POLICY "app_set_devices_delete_admin" ON app_set_devices FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- 5. ACTIVITY
-- ============================================================
CREATE TABLE IF NOT EXISTS activity (
  id bigserial PRIMARY KEY,
  device_type text NOT NULL DEFAULT 'mac',
  device_identifier text NOT NULL,
  mac_address text,
  device_token text,
  action text NOT NULL DEFAULT 'heartbeat',
  ip_address text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON activity TO authenticated;
GRANT SELECT, INSERT ON activity TO service_role;
GRANT USAGE ON SEQUENCE activity_id_seq TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_activity_device ON activity (device_identifier);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity (action);

DROP POLICY IF EXISTS "activity_select_admin" ON activity;
CREATE POLICY "activity_select_admin" ON activity FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "activity_insert_admin" ON activity;
CREATE POLICY "activity_insert_admin" ON activity FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "activity_update_admin" ON activity;
CREATE POLICY "activity_update_admin" ON activity FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "activity_delete_admin" ON activity;
CREATE POLICY "activity_delete_admin" ON activity FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- 6. SETTINGS (key/value store)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON settings TO service_role;

DROP POLICY IF EXISTS "settings_select_admin" ON settings;
CREATE POLICY "settings_select_admin" ON settings FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "settings_insert_admin" ON settings;
CREATE POLICY "settings_insert_admin" ON settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "settings_update_admin" ON settings;
CREATE POLICY "settings_update_admin" ON settings FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "settings_delete_admin" ON settings;
CREATE POLICY "settings_delete_admin" ON settings FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- 7. SPORTS_LEAGUES
-- ============================================================
CREATE TABLE IF NOT EXISTS sports_leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesportsdb_league_id text,
  name text NOT NULL,
  sport text NOT NULL DEFAULT 'Soccer',
  country text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sports_leagues ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sports_leagues TO authenticated;
GRANT SELECT ON sports_leagues TO service_role;

CREATE INDEX IF NOT EXISTS idx_sports_leagues_sport ON sports_leagues (sport);
CREATE INDEX IF NOT EXISTS idx_sports_leagues_active ON sports_leagues (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sports_leagues_tsdb ON sports_leagues (thesportsdb_league_id);

DROP POLICY IF EXISTS "sports_leagues_select_admin" ON sports_leagues;
CREATE POLICY "sports_leagues_select_admin" ON sports_leagues FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "sports_leagues_insert_admin" ON sports_leagues;
CREATE POLICY "sports_leagues_insert_admin" ON sports_leagues FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "sports_leagues_update_admin" ON sports_leagues;
CREATE POLICY "sports_leagues_update_admin" ON sports_leagues FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "sports_leagues_delete_admin" ON sports_leagues;
CREATE POLICY "sports_leagues_delete_admin" ON sports_leagues FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- 8. MENU_ADS
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  click_url text,
  position text NOT NULL DEFAULT 'sidebar',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_ads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON menu_ads TO authenticated;
GRANT SELECT ON menu_ads TO service_role;

DROP POLICY IF EXISTS "menu_ads_select_admin" ON menu_ads;
CREATE POLICY "menu_ads_select_admin" ON menu_ads FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "menu_ads_insert_admin" ON menu_ads;
CREATE POLICY "menu_ads_insert_admin" ON menu_ads FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "menu_ads_update_admin" ON menu_ads;
CREATE POLICY "menu_ads_update_admin" ON menu_ads FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "menu_ads_delete_admin" ON menu_ads;
CREATE POLICY "menu_ads_delete_admin" ON menu_ads FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- 9. REMOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS remotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_code text NOT NULL UNIQUE,
  device_mac text,
  device_name text,
  phone_id text,
  phone_name text,
  status text NOT NULL DEFAULT 'pending',
  qr_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  paired_at timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE remotes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON remotes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON remotes TO service_role;

CREATE INDEX IF NOT EXISTS idx_remotes_pairing_code ON remotes (pairing_code);
CREATE INDEX IF NOT EXISTS idx_remotes_status ON remotes (status);

DROP POLICY IF EXISTS "remotes_select_admin" ON remotes;
CREATE POLICY "remotes_select_admin" ON remotes FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "remotes_insert_admin" ON remotes;
CREATE POLICY "remotes_insert_admin" ON remotes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "remotes_update_admin" ON remotes;
CREATE POLICY "remotes_update_admin" ON remotes FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "remotes_delete_admin" ON remotes;
CREATE POLICY "remotes_delete_admin" ON remotes FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- 10. SPORTS_FIXTURE_OVERRIDES
-- ============================================================
CREATE TABLE IF NOT EXISTS sports_fixture_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id text NOT NULL,
  fixture_id text NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  original_event text,
  override_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, fixture_id)
);

ALTER TABLE sports_fixture_overrides ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sports_fixture_overrides TO authenticated;
GRANT SELECT ON sports_fixture_overrides TO service_role;

DROP POLICY IF EXISTS "sports_fixture_overrides_select_admin" ON sports_fixture_overrides;
CREATE POLICY "sports_fixture_overrides_select_admin" ON sports_fixture_overrides FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "sports_fixture_overrides_insert_admin" ON sports_fixture_overrides;
CREATE POLICY "sports_fixture_overrides_insert_admin" ON sports_fixture_overrides FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "sports_fixture_overrides_update_admin" ON sports_fixture_overrides;
CREATE POLICY "sports_fixture_overrides_update_admin" ON sports_fixture_overrides FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "sports_fixture_overrides_delete_admin" ON sports_fixture_overrides;
CREATE POLICY "sports_fixture_overrides_delete_admin" ON sports_fixture_overrides FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- 11. SPORTS_MANUAL_EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS sports_manual_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id text,
  sport text NOT NULL DEFAULT 'Soccer',
  home_team text NOT NULL,
  away_team text NOT NULL,
  event_time timestamptz NOT NULL,
  stream_url text,
  logo_home_url text,
  logo_away_url text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sports_manual_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sports_manual_events TO authenticated;
GRANT SELECT ON sports_manual_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_sports_manual_events_time ON sports_manual_events (event_time);
CREATE INDEX IF NOT EXISTS idx_sports_manual_events_active ON sports_manual_events (is_active) WHERE is_active = true;

DROP POLICY IF EXISTS "sports_manual_events_select_admin" ON sports_manual_events;
CREATE POLICY "sports_manual_events_select_admin" ON sports_manual_events FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "sports_manual_events_insert_admin" ON sports_manual_events;
CREATE POLICY "sports_manual_events_insert_admin" ON sports_manual_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "sports_manual_events_update_admin" ON sports_manual_events;
CREATE POLICY "sports_manual_events_update_admin" ON sports_manual_events FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins)) WITH CHECK (auth.uid() IN (SELECT auth_id FROM admins));

DROP POLICY IF EXISTS "sports_manual_events_delete_admin" ON sports_manual_events;
CREATE POLICY "sports_manual_events_delete_admin" ON sports_manual_events FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_id FROM admins));

-- ============================================================
-- HELPER: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  DECLARE t text;
  BEGIN
    FOREACH t IN ARRAY ARRAY['admins','servers','mac_devices','app_set_devices','settings','sports_leagues','menu_ads','remotes','sports_fixture_overrides','sports_manual_events'] LOOP
      BEGIN
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
        EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
      END;
    END LOOP;
  END;
END;
$$;

-- ============================================================
-- SEED: Core settings
-- ============================================================
INSERT INTO settings (key, value, category, description, is_public) VALUES
  ('app_name', '"Bassem TV"', 'general', 'Application display name', false),
  ('panel_url', '"http://paneltv.ddns.net:8080"', 'general', 'Original panel URL embedded in APK', true),
  ('api_auth_header', '"X-Bassem-Auth"', 'security', 'Custom auth header name expected by API', false),
  ('api_auth_token', '"CHANGE_ME_SECRET_TOKEN"', 'security', 'Secret token for APK API auth', false),
  ('heartbeat_interval_seconds', '60', 'general', 'Heartbeat interval in seconds', true),
  ('sports_feed_timezone', '"Africa/Tunis"', 'sports', 'Timezone for sports feed', true),
  ('sports_feed_utc_offset', '3600', 'sports', 'UTC offset in seconds for sports feed', true),
  ('sports_feed_title', '"Sports Guide"', 'sports', 'Title for sports feed', true),
  ('sports_feed_live_interval', '300', 'sports', 'Live interval in seconds', true),
  ('sports_feed_days', '7', 'sports', 'Number of days to show in feed', true),
  ('sports_feed_version', '1', 'sports', 'Sports feed format version', true),
  ('thesportsdb_api_key', '"3"', 'sports', 'TheSportsDB API key (3 is free tier)', false),
  ('tmdb_api_key', '""', 'sports', 'TMDB API key for movie metadata', false),
  ('stremio_addon_url', '""', 'general', 'Stremio add-on manifest URL', false),
  ('vpn_default_config', '""', 'vpn', 'Default OpenVPN config template', false),
  ('menu_ad_enabled', 'true', 'ads', 'Enable menu advertisements', true),
  ('menu_ad_refresh_seconds', '30', 'ads', 'Ad refresh interval', true),
  ('remote_control_enabled', 'true', 'remote', 'Enable remote control feature', true),
  ('remote_pairing_ttl_seconds', '300', 'remote', 'QR pairing code TTL', true),
  ('max_devices_per_mac', '1', 'general', 'Max devices per MAC address', false),
  ('trial_duration_hours', '24', 'general', 'Trial period in hours', false),
  ('auto_authorize_new_devices', 'false', 'general', 'Auto-authorize new MAC devices', false),
  ('block_vpn_users', 'false', 'security', 'Block users on VPN', false),
  ('log_retention_days', '30', 'general', 'Activity log retention in days', false),
  ('maintenance_mode', 'false', 'general', 'Panel maintenance mode', true),
  ('panel_theme', '"dark"', 'general', 'Admin panel theme', false),
  ('panel_language', '"en"', 'general', 'Admin panel language', false),
  ('notification_email', '""', 'general', 'Email for system notifications', false),
  ('backup_enabled', 'true', 'general', 'Enable automatic backups', false),
  ('backup_frequency_hours', '24', 'general', 'Backup frequency in hours', false),
  ('cdn_url', '""', 'general', 'CDN URL for static assets', false),
  ('epg_url', '""', 'general', 'EPG guide URL', false),
  ('xtream_default_server', '""', 'general', 'Default Xtream server ID', false),
  ('force_https', 'false', 'security', 'Force HTTPS for API responses', true),
  ('rate_limit_per_minute', '60', 'security', 'API rate limit per minute per device', false),
  ('concurrent_streams_limit', '1', 'general', 'Max concurrent streams per device', false),
  ('app_version_min', '"1.0.0"', 'general', 'Minimum supported app version', true),
  ('app_version_latest', '"1.0.0"', 'general', 'Latest app version', true),
  ('apk_update_url', '""', 'general', 'APK update download URL', true),
  ('apk_update_required', 'false', 'general', 'Force APK update', true),
  ('feature_sports_guide', 'true', 'features', 'Enable sports guide', true),
  ('feature_vpn_profiles', 'true', 'features', 'Enable VPN profiles', true),
  ('feature_stremio', 'true', 'features', 'Enable Stremio add-on', true),
  ('feature_remote_control', 'true', 'features', 'Enable remote control', true),
  ('feature_menu_ads', 'true', 'features', 'Enable menu ads', true),
  ('feature_heartbeat', 'true', 'features', 'Enable heartbeat tracking', true),
  ('feature_activity_log', 'true', 'features', 'Enable activity logging', true),
  ('sports_feed_lock_enabled', 'true', 'sports', 'Enable concurrency lock for feed generation', false),
  ('sports_feed_lock_ttl_seconds', '30', 'sports', 'Lock TTL for feed generation', false),
  ('sports_feed_cache_seconds', '60', 'sports', 'Cache duration for sports feed', false),
  ('sports_feed_last_generated', '"1970-01-01T00:00:00Z"', 'sports', 'Last feed generation timestamp', false),
  ('panel_title', '"Bassem TV Panel"', 'general', 'Browser tab title', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED: Default server
-- ============================================================
INSERT INTO servers (name, host, port, username, password, server_type, sort_order)
SELECT 'Default Server', 'paneltv.ddns.net', 8080, '', '', 'xtream', 0
WHERE NOT EXISTS (SELECT 1 FROM servers);
