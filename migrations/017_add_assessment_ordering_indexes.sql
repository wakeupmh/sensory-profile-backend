-- Composite indexes for the two heaviest sensory_assessments queries
-- findByChildId: WHERE user_id = $1 AND child_id = $2 ORDER BY assessment_date DESC
-- findAll:       WHERE user_id = $1 ORDER BY created_at DESC
--
-- Note: idx_sensory_assessments_user_child_date subsumes the simpler
-- idx_sensory_assessments_user_child from migration 016 (PostgreSQL can use
-- a prefix of a composite index). Both are kept for safety — dropping
-- existing indexes during a live migration is risky.

CREATE INDEX IF NOT EXISTS idx_sensory_assessments_user_child_date
  ON sensory_assessments(user_id, child_id, assessment_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_sensory_assessments_user_created
  ON sensory_assessments(user_id, created_at DESC);
