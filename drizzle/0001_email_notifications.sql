ALTER TABLE tickets ADD COLUMN email TEXT;
ALTER TABLE tickets ADD COLUMN email_lookup_hash TEXT;

DROP INDEX IF EXISTS idx_tickets_active_phone;
CREATE INDEX IF NOT EXISTS idx_tickets_email_hash ON tickets(email_lookup_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_active_email
  ON tickets(queue_id, email_lookup_hash)
  WHERE status IN ('waiting', 'called', 'in_service')
    AND email_lookup_hash IS NOT NULL
    AND personal_data_cleared = 0;

CREATE TABLE notification_attempts_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  event_type TEXT NOT NULL DEFAULT 'legacy',
  status TEXT NOT NULL,
  provider_message_id TEXT,
  attempted_at INTEGER NOT NULL,
  error_code TEXT
);
INSERT INTO notification_attempts_v2
  (id, ticket_id, channel, event_type, status, provider_message_id, attempted_at, error_code)
SELECT id, ticket_id, channel, 'legacy', status, provider_message_id, attempted_at, error_code
FROM notification_attempts;
DROP TABLE notification_attempts;
ALTER TABLE notification_attempts_v2 RENAME TO notification_attempts;
CREATE INDEX idx_notification_ticket ON notification_attempts(ticket_id, attempted_at);
