-- Persisted AI-generated summaries. Previously AISummaryService generated
-- text on demand and threw it away; this gives the care team a history to
-- compare quarter over quarter instead of re-running the same prompt.
-- Append-only (no updated_at/trigger) — a summary is a point-in-time
-- snapshot, not something edited in place.

CREATE TABLE ai_summaries (
  id           UUID PRIMARY KEY,
  user_id      TEXT NOT NULL,
  child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  period_from  TIMESTAMPTZ NOT NULL,
  period_to    TIMESTAMPTZ NOT NULL,
  model_id     TEXT NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_summaries_user_child ON ai_summaries(user_id, child_id, created_at DESC);
