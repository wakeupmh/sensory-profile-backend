-- Limited write access for professionals (session notes attached to a
-- shared child, never mutating the owner's own records) + an append-only
-- access log so an owner can see who viewed or wrote to their child's data
-- and when (LGPD accountability).

CREATE TABLE professional_notes (
  id               UUID PRIMARY KEY,
  professional_id  UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  author_user_id   TEXT NOT NULL,
  child_id         UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  resource_type    VARCHAR(50) NULL,
  resource_id      UUID NULL,
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_professional_notes_child ON professional_notes(child_id, created_at DESC);
CREATE INDEX idx_professional_notes_professional ON professional_notes(professional_id);

CREATE OR REPLACE TRIGGER trg_professional_notes_updated_at
  BEFORE UPDATE ON professional_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Append-only — an access log entry is a historical fact, never edited.
-- child_id is nullable because anamneses store child data as embedded JSONB
-- (no FK to `children`), so an anamnese read/write cannot resolve one.
CREATE TABLE access_logs (
  id               UUID PRIMARY KEY,
  actor_user_id    TEXT NOT NULL,
  professional_id  UUID NULL REFERENCES professionals(id) ON DELETE SET NULL,
  child_id         UUID NULL REFERENCES children(id) ON DELETE CASCADE,
  resource_type    VARCHAR(50) NOT NULL,
  resource_id      UUID NULL,
  action           VARCHAR(20) NOT NULL CHECK (action IN ('read', 'write')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_access_logs_child ON access_logs(child_id, created_at DESC);
CREATE INDEX idx_access_logs_actor ON access_logs(actor_user_id, created_at DESC);
