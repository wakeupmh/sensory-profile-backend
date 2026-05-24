CREATE TABLE developmental_milestones (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('motor_gross','motor_fine','language','communication','social','cognitive','self_care','other')),
  status VARCHAR(50) NOT NULL DEFAULT 'not_yet' CHECK (status IN ('not_yet','in_progress','achieved','regressed')),
  achieved_date DATE NULL,
  target_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communication_logs (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('vocabulary','aac_usage','verbal_speech','signs','other')),
  description VARCHAR(1000) NULL,
  words_count INTEGER NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_developmental_milestones_user_id ON developmental_milestones(user_id);
CREATE INDEX idx_developmental_milestones_child_id ON developmental_milestones(child_id);
CREATE INDEX idx_developmental_milestones_category ON developmental_milestones(category);
CREATE INDEX idx_developmental_milestones_status ON developmental_milestones(status);
CREATE INDEX idx_communication_logs_user_id ON communication_logs(user_id);
CREATE INDEX idx_communication_logs_child_id ON communication_logs(child_id);
CREATE INDEX idx_communication_logs_occurred_at ON communication_logs(occurred_at);

CREATE TRIGGER set_updated_at_developmental_milestones
  BEFORE UPDATE ON developmental_milestones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_communication_logs
  BEFORE UPDATE ON communication_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
