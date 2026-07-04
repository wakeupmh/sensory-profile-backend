-- Structured therapeutic/educational goals with progress tracking.
-- Fills the gap left by education_plans.goals being a single free-text
-- field: each goal is a trackable entity with a baseline, target, and a
-- timeline of progress entries (optionally tied to a therapy session).

CREATE TABLE goals (
  id                       UUID PRIMARY KEY,
  user_id                  TEXT NOT NULL,
  child_id                 UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  domain                   VARCHAR(50) NOT NULL CHECK (domain IN (
                              'comunicacao', 'social', 'motor', 'autocuidado',
                              'academico', 'comportamental', 'outro'
                            )),
  title                    VARCHAR(255) NOT NULL,
  description              TEXT NULL,
  mastery_criteria         TEXT NULL,
  baseline_value           NUMERIC NULL,
  target_value             NUMERIC NULL,
  unit                     VARCHAR(50) NULL,
  status                   VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
                              'active', 'achieved', 'paused', 'discontinued'
                            )),
  target_date              DATE NULL,
  source_education_plan_id UUID NULL REFERENCES education_plans(id) ON DELETE SET NULL,
  notes                    TEXT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE goal_progress_entries (
  id                 UUID PRIMARY KEY,
  user_id            TEXT NOT NULL,
  goal_id            UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  recorded_at        TIMESTAMPTZ NOT NULL,
  value              NUMERIC NULL,
  status_snapshot    VARCHAR(20) NULL CHECK (status_snapshot IN (
                        'active', 'achieved', 'paused', 'discontinued'
                      )),
  notes              TEXT NULL,
  therapy_session_id UUID NULL REFERENCES therapy_sessions(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_child_id ON goals(child_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_goal_progress_entries_goal_id ON goal_progress_entries(goal_id);
CREATE INDEX idx_goal_progress_entries_recorded_at ON goal_progress_entries(goal_id, recorded_at DESC);

CREATE OR REPLACE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
