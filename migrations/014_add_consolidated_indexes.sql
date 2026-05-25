BEGIN;

CREATE INDEX IF NOT EXISTS idx_daily_logs_child_occurred ON daily_logs(child_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_logs_child_occurred ON communication_logs(child_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_communications_child_occurred ON school_communications(child_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_developmental_milestones_child_status ON developmental_milestones(child_id, status, achieved_date DESC);
CREATE INDEX IF NOT EXISTS idx_medications_child_active ON medications(child_id, active);

COMMIT;
