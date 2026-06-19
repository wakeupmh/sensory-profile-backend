-- Professional directory + per-resource sharing.
--
-- A professional row represents a third party (therapist, doctor, etc.) that
-- the owner wants to share specific anamneses or assessments with.
--
-- Lifecycle:
--   1. Owner creates a row with name/email/profession and gets back a
--      one-shot invitation_token.
--   2. Owner shares that token with the recipient (link, email, etc.).
--   3. Recipient signs into Clerk and calls POST /api/professional-invites/accept
--      with the token. The backend sets accepted_user_id to the recipient's
--      Clerk userId and clears the token.
--   4. Owner can now reference professional_id when sharing records.
--   5. Professional sees records via /api/shared/* scoped to accepted_user_id.

CREATE TABLE IF NOT EXISTS professionals (
  id                 UUID PRIMARY KEY,
  owner_user_id      TEXT NOT NULL,
  name               TEXT NOT NULL,
  email              TEXT,
  profession         TEXT,
  invitation_token   TEXT,
  accepted_user_id   TEXT,
  accepted_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_professionals_owner
  ON professionals(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_professionals_accepted_user
  ON professionals(accepted_user_id) WHERE accepted_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_professionals_invitation_token
  ON professionals(invitation_token) WHERE invitation_token IS NOT NULL;


CREATE TABLE IF NOT EXISTS anamnese_shares (
  id                  UUID PRIMARY KEY,
  anamnese_id         UUID NOT NULL REFERENCES anamneses(id) ON DELETE CASCADE,
  professional_id     UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  granted_by_user_id  TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (anamnese_id, professional_id)
);

CREATE INDEX IF NOT EXISTS idx_anamnese_shares_professional
  ON anamnese_shares(professional_id);


CREATE TABLE IF NOT EXISTS assessment_shares (
  id                  UUID PRIMARY KEY,
  assessment_id       UUID NOT NULL REFERENCES sensory_assessments(id) ON DELETE CASCADE,
  professional_id     UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  granted_by_user_id  TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (assessment_id, professional_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_shares_professional
  ON assessment_shares(professional_id);
