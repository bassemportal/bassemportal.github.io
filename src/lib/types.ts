export interface Admin {
  id: string;
  auth_id: string | null;
  email: string;
  role: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  server_type: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MacDevice {
  id: string;
  mac_address: string;
  device_name: string | null;
  server_id: string | null;
  xtream_username: string | null;
  xtream_password: string | null;
  is_authorized: boolean;
  is_blocked: boolean;
  expires_at: string | null;
  last_seen_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AppSetDevice {
  id: string;
  device_token: string;
  device_name: string | null;
  server_id: string | null;
  xtream_username: string | null;
  xtream_password: string | null;
  is_authorized: boolean;
  is_blocked: boolean;
  expires_at: string | null;
  last_seen_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  device_type: string;
  device_identifier: string;
  mac_address: string | null;
  device_token: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: any;
  category: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface SportsLeague {
  id: string;
  thesportsdb_league_id: string | null;
  name: string;
  sport: string;
  country: string | null;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MenuAd {
  id: string;
  title: string;
  image_url: string;
  click_url: string | null;
  position: string;
  is_active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Remote {
  id: string;
  pairing_code: string;
  device_mac: string | null;
  device_name: string | null;
  phone_id: string | null;
  phone_name: string | null;
  status: string;
  qr_data: Record<string, any>;
  is_active: boolean;
  paired_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SportsFixtureOverride {
  id: string;
  league_id: string;
  fixture_id: string;
  home_team: string;
  away_team: string;
  original_event: string | null;
  override_data: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SportsManualEvent {
  id: string;
  league_id: string | null;
  sport: string;
  home_team: string;
  away_team: string;
  event_time: string;
  stream_url: string | null;
  logo_home_url: string | null;
  logo_away_url: string | null;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type Page =
  | 'dashboard'
  | 'devices'
  | 'servers'
  | 'settings'
  | 'sports'
  | 'ads'
  | 'remotes'
  | 'activity';
