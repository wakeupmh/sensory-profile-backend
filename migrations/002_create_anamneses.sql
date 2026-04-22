-- Anamnese (clinical intake) records
-- Self-contained, user-scoped, optionally shareable via public token.

CREATE TABLE IF NOT EXISTS anamneses (
  id                UUID PRIMARY KEY,
  user_id           TEXT NOT NULL,
  child             JSONB NOT NULL,
  caregiver         JSONB NOT NULL,
  clinical_history  JSONB NOT NULL,
  share_token       TEXT,
  shared_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anamneses_user_id
  ON anamneses(user_id);

CREATE INDEX IF NOT EXISTS idx_anamneses_user_created_at
  ON anamneses(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_anamneses_share_token
  ON anamneses(share_token) WHERE share_token IS NOT NULL;
