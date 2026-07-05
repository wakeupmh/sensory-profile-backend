-- Co-caregiver delegation: unlike professionals (scoped, read-only),
-- a caregiver is a full read-write co-manager of a specific child's
-- records (e.g. separated parents, grandparents raising a child together).
-- Invitation lifecycle mirrors `professionals` (one-shot token, 14-day
-- expiry, accept while authenticated) but grants are all-or-nothing per
-- child — no scopes.

CREATE TABLE caregiver_shares (
  id                     UUID PRIMARY KEY,
  child_id               UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  owner_user_id          TEXT NOT NULL,
  caregiver_name         TEXT NOT NULL,
  caregiver_user_id      TEXT NULL,
  invitation_token       TEXT NULL,
  invitation_expires_at  TIMESTAMPTZ NULL,
  accepted_at            TIMESTAMPTZ NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (child_id, caregiver_user_id)
);

CREATE INDEX idx_caregiver_shares_child ON caregiver_shares(child_id);
CREATE INDEX idx_caregiver_shares_caregiver_user ON caregiver_shares(caregiver_user_id)
  WHERE caregiver_user_id IS NOT NULL;

CREATE UNIQUE INDEX idx_caregiver_shares_invitation_token
  ON caregiver_shares(invitation_token) WHERE invitation_token IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_caregiver_shares_updated_at
  BEFORE UPDATE ON caregiver_shares
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
