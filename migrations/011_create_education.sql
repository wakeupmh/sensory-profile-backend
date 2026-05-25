BEGIN;

CREATE TABLE education_plans (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  school_name VARCHAR(255) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('pei', 'pei_simplificado', 'adaptacao_curricular', 'plano_aee', 'outro')),
  start_date DATE NOT NULL,
  review_date DATE NULL,
  end_date DATE NULL,
  goals TEXT NULL,
  accommodations TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE school_communications (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  comm_type VARCHAR(50) NOT NULL CHECK (comm_type IN ('reuniao', 'bilhete', 'email', 'telefone', 'incidente', 'relatorio', 'outro')),
  subject VARCHAR(255) NOT NULL,
  description TEXT NULL,
  attendees VARCHAR(500) NULL,
  follow_up_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_education_plans_user_id ON education_plans(user_id);
CREATE INDEX idx_education_plans_child_id ON education_plans(child_id);
CREATE INDEX idx_education_plans_user_academic_year ON education_plans(user_id, academic_year);
CREATE INDEX idx_school_comms_user_id ON school_communications(user_id);
CREATE INDEX idx_school_comms_child_id ON school_communications(child_id);
CREATE INDEX idx_school_comms_occurred_at ON school_communications(user_id, occurred_at DESC);

CREATE TRIGGER set_education_plans_updated_at
  BEFORE UPDATE ON education_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_school_communications_updated_at
  BEFORE UPDATE ON school_communications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
