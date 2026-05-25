BEGIN;

CREATE TABLE report_shares (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE,
  period_days INT NOT NULL DEFAULT 90,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX report_shares_user_id_child_id_idx ON report_shares(user_id, child_id);

COMMIT;
