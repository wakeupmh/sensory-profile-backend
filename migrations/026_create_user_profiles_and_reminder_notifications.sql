-- Active reminder delivery: turns the pull-based /api/reminders/upcoming
-- feed into a push (email) notification.
--
-- user_profiles caches the email claim from the caller's Supabase JWT.
-- There is no local "users" table in this app (auth lives entirely in
-- Supabase) and no service-role Supabase Admin API credentials are
-- configured, so authMiddleware opportunistically upserts this row on every
-- authenticated request (see authMiddleware.ts) — a user's email becomes
-- known to us the first time they use the app after this migration, not
-- necessarily immediately.
CREATE TABLE user_profiles (
  user_id                    TEXT PRIMARY KEY,
  email                      TEXT NULL,
  reminder_emails_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only send log, keyed so a reminder is never emailed twice even if
-- the digest job runs concurrently or retries. reminder_key is a composite
-- string ("source:type:id") built from the same UpcomingReminderItem shape
-- served by GET /api/reminders/upcoming, so it works uniformly for both
-- custom (persisted) and derived (computed-on-read) reminders.
CREATE TABLE reminder_notifications (
  id            UUID PRIMARY KEY,
  user_id       TEXT NOT NULL,
  reminder_key  TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, reminder_key)
);

CREATE INDEX idx_reminder_notifications_user ON reminder_notifications(user_id);
