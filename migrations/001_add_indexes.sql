-- Add indexes for query performance
-- Run this migration against your PostgreSQL database

-- Assessment lookups by user and child
CREATE INDEX IF NOT EXISTS idx_sensory_assessments_user_id ON sensory_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_sensory_assessments_child_id ON sensory_assessments(child_id);

-- Children scoped by user
CREATE INDEX IF NOT EXISTS idx_children_user_id ON children(user_id);

-- Responses by assessment (for joins and deletes)
CREATE INDEX IF NOT EXISTS idx_sensory_responses_assessment_id ON sensory_responses(assessment_id);

-- Section comments by assessment
CREATE INDEX IF NOT EXISTS idx_section_comments_assessment_id ON section_comments(assessment_id);

-- Unique constraints for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_examiners_name_profession ON examiners(name, profession);
CREATE UNIQUE INDEX IF NOT EXISTS idx_caregivers_name_relationship ON caregivers(name, relationship);
CREATE UNIQUE INDEX IF NOT EXISTS idx_children_national_identity_user_id ON children(national_identity, user_id) WHERE national_identity IS NOT NULL;
