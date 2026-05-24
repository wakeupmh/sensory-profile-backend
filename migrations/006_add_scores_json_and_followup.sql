-- Migration 006: Add scores_json JSONB column and parent_assessment_id self-referential FK
-- Purpose: (1) store computed scoring data as JSON alongside raw score columns;
--          (2) support linked secondary assessments (e.g. M-CHAT-R/F follow-up linked
--              to a parent M-CHAT-R screen) via a self-referential parent_assessment_id.
-- Purely additive — no existing columns dropped, no NOT NULL constraints added.

ALTER TABLE sensory_assessments
  ADD COLUMN scores_json JSONB NULL;

ALTER TABLE sensory_assessments
  ADD COLUMN parent_assessment_id UUID NULL
    REFERENCES sensory_assessments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sensory_assessments_parent_assessment_id
  ON sensory_assessments (parent_assessment_id)
  WHERE parent_assessment_id IS NOT NULL;
