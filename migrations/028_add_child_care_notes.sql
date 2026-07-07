-- Quick-reference care notes for a child: sensory triggers, calming
-- strategies, and an emergency contact. These were previously localStorage-only
-- on the frontend (explicitly device-local) because there was no backend
-- field for them; moving them here enables cross-device sync.

ALTER TABLE children ADD COLUMN sensory_triggers TEXT NULL;
ALTER TABLE children ADD COLUMN calming_strategies TEXT NULL;
ALTER TABLE children ADD COLUMN emergency_contact TEXT NULL;
