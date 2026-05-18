-- One open draft per user per form type.
CREATE TABLE form_drafts (
  id           UUID        PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  form_type    TEXT        NOT NULL CHECK (form_type IN ('sensory_assessment', 'anamnese')),
  payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  current_step INT         NOT NULL DEFAULT 0,
  instrument_id TEXT       NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, form_type)
);

CREATE TRIGGER trg_form_drafts_updated_at
  BEFORE UPDATE ON form_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
