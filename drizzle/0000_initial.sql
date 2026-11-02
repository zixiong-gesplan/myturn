CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS queues (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  is_paused INTEGER NOT NULL DEFAULT 0 CHECK (is_paused IN (0, 1)),
  current_ticket_id TEXT,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  created_by TEXT REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_queue ON queues(is_open) WHERE is_open = 1;
CREATE INDEX IF NOT EXISTS idx_queues_opened ON queues(opened_at);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY NOT NULL,
  queue_id TEXT NOT NULL REFERENCES queues(id),
  number INTEGER NOT NULL,
  display_number TEXT NOT NULL,
  name TEXT,
  phone_normalized TEXT,
  phone_lookup_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'called', 'in_service', 'completed', 'absent', 'cancelled')),
  source TEXT NOT NULL CHECK (source IN ('web', 'manual')),
  created_at INTEGER NOT NULL,
  called_at INTEGER,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL,
  personal_data_cleared INTEGER NOT NULL DEFAULT 0 CHECK (personal_data_cleared IN (0, 1)),
  UNIQUE (queue_id, number)
);
CREATE INDEX IF NOT EXISTS idx_tickets_queue_status_number ON tickets(queue_id, status, number);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_phone_hash ON tickets(phone_lookup_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_active_phone
  ON tickets(queue_id, phone_lookup_hash)
  WHERE status IN ('waiting', 'called', 'in_service')
    AND phone_lookup_hash IS NOT NULL
    AND personal_data_cleared = 0;

CREATE TABLE IF NOT EXISTS ticket_events (
  id TEXT PRIMARY KEY NOT NULL,
  queue_id TEXT REFERENCES queues(id),
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  operator_id TEXT REFERENCES users(id),
  event_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON ticket_events(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS tracking_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tracking_expires ON tracking_tokens(expires_at);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  consent_given INTEGER NOT NULL CHECK (consent_given IN (0, 1)),
  privacy_policy_version TEXT NOT NULL,
  consent_timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_consents_ticket ON consents(ticket_id);

CREATE TABLE IF NOT EXISTS notification_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp')),
  status TEXT NOT NULL,
  provider_message_id TEXT,
  attempted_at INTEGER NOT NULL,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_notification_ticket ON notification_attempts(ticket_id, attempted_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES
  ('establishment_name', 'MiTurno', unixepoch()),
  ('public_base_url', '', unixepoch()),
  ('contact_email', '', unixepoch()),
  ('contact_postal_address', '', unixepoch()),
  ('data_controller_name', '', unixepoch()),
  ('privacy_policy_version', '1.0', unixepoch()),
  ('retention_days', '7', unixepoch());
