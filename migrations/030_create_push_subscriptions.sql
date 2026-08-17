-- Web Push subscriptions, one row per browser/device registration. Existence
-- of a row IS the "enabled" signal (no separate boolean like
-- reminder_emails_enabled) — unsubscribing just deletes the row.
CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY,
  user_id     TEXT NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh_key  TEXT NOT NULL,
  auth_key    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Scope reminder_notifications per delivery channel so email and push track
-- independently. Without this, whichever channel's digest pass reserves a
-- reminder key first "consumes" it and the other channel never fires for a
-- user who opted into both.
ALTER TABLE reminder_notifications ADD COLUMN channel TEXT NOT NULL DEFAULT 'email';
ALTER TABLE reminder_notifications DROP CONSTRAINT reminder_notifications_user_id_reminder_key_key;
ALTER TABLE reminder_notifications ADD CONSTRAINT reminder_notifications_user_id_reminder_key_channel_key UNIQUE (user_id, reminder_key, channel);
