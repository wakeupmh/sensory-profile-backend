-- Composite indexes for (user_id, child_id) query patterns with ordering columns
-- These cover the common WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at DESC queries

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_child_occurred
  ON daily_logs(user_id, child_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_therapy_sessions_user_child_occurred
  ON therapy_sessions(user_id, child_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_medications_user_child
  ON medications(user_id, child_id);

CREATE INDEX IF NOT EXISTS idx_developmental_milestones_user_child_status
  ON developmental_milestones(user_id, child_id, status);

CREATE INDEX IF NOT EXISTS idx_communication_logs_user_child_occurred
  ON communication_logs(user_id, child_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_school_communications_user_child_occurred
  ON school_communications(user_id, child_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_education_plans_user_child
  ON education_plans(user_id, child_id);

CREATE INDEX IF NOT EXISTS idx_sensory_assessments_user_child
  ON sensory_assessments(user_id, child_id);
