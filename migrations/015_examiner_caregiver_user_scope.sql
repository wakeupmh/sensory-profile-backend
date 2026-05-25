-- Migration 015: Add user_id to examiners and caregivers for user-scoped isolation
-- Previously these tables were globally shared, which is a security/isolation problem.
--
-- WARNING: If an examiner/caregiver is referenced by assessments from multiple users,
-- the backfill arbitrarily assigns it to one user (LIMIT 1). Run the following check
-- BEFORE applying this migration to identify affected rows:
--   SELECT e.id, e.name, array_agg(DISTINCT sa.user_id)
--   FROM examiners e JOIN sensory_assessments sa ON sa.examiner_id = e.id
--   GROUP BY e.id, e.name HAVING COUNT(DISTINCT sa.user_id) > 1;
-- Manually resolve multi-user rows before running, or accept the arbitrary assignment.

-- 1. Add user_id columns
ALTER TABLE examiners ADD COLUMN user_id TEXT;
ALTER TABLE caregivers ADD COLUMN user_id TEXT;

-- 2. Backfill from assessments
UPDATE examiners SET user_id = (
  SELECT DISTINCT user_id FROM sensory_assessments WHERE examiner_id = examiners.id LIMIT 1
);
UPDATE caregivers SET user_id = (
  SELECT DISTINCT user_id FROM sensory_assessments WHERE caregiver_id = caregivers.id LIMIT 1
);

-- 3. Handle orphans (examiners/caregivers not referenced by any assessment)
UPDATE examiners SET user_id = 'orphan' WHERE user_id IS NULL;
UPDATE caregivers SET user_id = 'orphan' WHERE user_id IS NULL;

-- 4. Add NOT NULL constraint
ALTER TABLE examiners ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE caregivers ALTER COLUMN user_id SET NOT NULL;

-- 5. Drop old unique constraints and recreate with user_id
DROP INDEX IF EXISTS examiners_name_profession_key;
CREATE UNIQUE INDEX examiners_name_profession_user ON examiners (name, profession, user_id);

DROP INDEX IF EXISTS caregivers_name_relationship_key;
CREATE UNIQUE INDEX caregivers_name_relationship_user ON caregivers (name, relationship, user_id);
