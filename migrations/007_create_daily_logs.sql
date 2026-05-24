CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  log_type VARCHAR(50) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_child_id ON daily_logs(child_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_log_type ON daily_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_daily_logs_occurred_at ON daily_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_child_occurred ON daily_logs(child_id, occurred_at DESC);

CREATE OR REPLACE TRIGGER trg_daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
