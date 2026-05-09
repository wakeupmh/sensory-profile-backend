-- Auto-update updated_at on row modification for tables that carry the column.
-- Tables without updated_at (sensory_responses, section_comments) are excluded.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_children_updated_at
  BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_examiners_updated_at
  BEFORE UPDATE ON examiners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_caregivers_updated_at
  BEFORE UPDATE ON caregivers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_sensory_assessments_updated_at
  BEFORE UPDATE ON sensory_assessments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_anamneses_updated_at
  BEFORE UPDATE ON anamneses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
