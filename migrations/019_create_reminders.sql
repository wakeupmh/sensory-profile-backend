-- Custom (manually created) reminders per child. Derived reminders (from
-- medical_appointments.follow_up_date, education_plans.review_date/end_date,
-- school_communications.follow_up_date, developmental_milestones.target_date,
-- medications.end_date) are computed on read by UpcomingReminderService and
-- are not persisted here.

CREATE TABLE reminders (
  id             UUID PRIMARY KEY,
  user_id        TEXT NOT NULL,
  child_id       UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  due_at         TIMESTAMPTZ NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'dismissed')),
  resource_type  VARCHAR(50) NULL,
  resource_id    UUID NULL,
  notes          TEXT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_child_id ON reminders(child_id);
CREATE INDEX idx_reminders_due_at ON reminders(user_id, due_at) WHERE status = 'pending';

CREATE OR REPLACE TRIGGER trg_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
