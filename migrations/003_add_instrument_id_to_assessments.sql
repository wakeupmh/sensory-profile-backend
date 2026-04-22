-- Add instrument_id so assessments can belong to different clinical instruments
-- (Criança 3-14, Criança Pequena 7-36, etc). Defaults to the legacy instrument
-- so existing rows remain valid after the migration.

ALTER TABLE sensory_assessments
  ADD COLUMN IF NOT EXISTS instrument_id TEXT NOT NULL DEFAULT 'crianca-3-14';

CREATE INDEX IF NOT EXISTS idx_sensory_assessments_instrument_id
  ON sensory_assessments(instrument_id);
