-- Migration 009: Create medical tables (SP-4 Medical Hub)

-- Medications per child
CREATE TABLE medications (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  start_date DATE,
  end_date DATE,
  prescribing_doctor VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medications_user_id ON medications(user_id);
CREATE INDEX idx_medications_child_id ON medications(child_id);
CREATE INDEX idx_medications_child_active ON medications(child_id, active);

CREATE OR REPLACE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON medications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Comorbidities / diagnoses per child
CREATE TABLE comorbidities (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  condition_name VARCHAR(255) NOT NULL,
  icd_code VARCHAR(20),
  diagnosis_date DATE,
  diagnosing_doctor VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comorbidities_user_id ON comorbidities(user_id);
CREATE INDEX idx_comorbidities_child_id ON comorbidities(child_id);

CREATE OR REPLACE TRIGGER trg_comorbidities_updated_at
  BEFORE UPDATE ON comorbidities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Medical appointments per child
CREATE TABLE medical_appointments (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  doctor_name VARCHAR(255),
  specialty VARCHAR(100),
  clinic_name VARCHAR(255),
  occurred_at TIMESTAMPTZ NOT NULL,
  summary TEXT,
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medical_appointments_user_id ON medical_appointments(user_id);
CREATE INDEX idx_medical_appointments_child_id ON medical_appointments(child_id);
CREATE INDEX idx_medical_appointments_occurred_at ON medical_appointments(child_id, occurred_at DESC);

CREATE OR REPLACE TRIGGER trg_medical_appointments_updated_at
  BEFORE UPDATE ON medical_appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
