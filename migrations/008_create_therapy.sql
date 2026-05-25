-- Migration 008: Create therapy tables (SP-3 Therapy Session Tracker)

-- Therapists table
CREATE TABLE therapists (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(50) NOT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_therapists_user_id ON therapists(user_id);
CREATE INDEX idx_therapists_user_name ON therapists(user_id, name);

CREATE OR REPLACE TRIGGER trg_therapists_updated_at
  BEFORE UPDATE ON therapists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Therapy sessions table
CREATE TABLE therapy_sessions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL,
  therapy_type VARCHAR(50) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_therapy_sessions_user_id ON therapy_sessions(user_id);
CREATE INDEX idx_therapy_sessions_child_id ON therapy_sessions(child_id);
CREATE INDEX idx_therapy_sessions_therapy_type ON therapy_sessions(therapy_type);
CREATE INDEX idx_therapy_sessions_occurred_at ON therapy_sessions(occurred_at DESC);
CREATE INDEX idx_therapy_sessions_child_occurred ON therapy_sessions(child_id, occurred_at DESC);

CREATE OR REPLACE TRIGGER trg_therapy_sessions_updated_at
  BEFORE UPDATE ON therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
