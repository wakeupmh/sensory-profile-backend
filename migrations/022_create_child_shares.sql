-- Child-level sharing: grants a professional read access to entire domains
-- of a child's data (assessments, daily logs, therapy, medical, development)
-- in one grant, instead of sharing individual anamneses/assessments one by
-- one via anamnese_shares/assessment_shares. Complements — does not
-- replace — the existing per-resource share tables.
--
-- `scopes` is a Postgres TEXT[] rather than a normalized join table because
-- the set of resource-domain names is small, stable, and only ever compared
-- with `= ANY(...)`; it is validated against a fixed enum at the application
-- layer (see childShareValidation.ts), mirroring how daily_logs.data is
-- validated in application code rather than via DB constraints.

CREATE TABLE child_shares (
  id                  UUID PRIMARY KEY,
  child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  professional_id     UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  granted_by_user_id  TEXT NOT NULL,
  scopes              TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (child_id, professional_id)
);

CREATE INDEX idx_child_shares_professional ON child_shares(professional_id);
CREATE INDEX idx_child_shares_child ON child_shares(child_id);

CREATE OR REPLACE TRIGGER trg_child_shares_updated_at
  BEFORE UPDATE ON child_shares
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
