BEGIN;

-- The children table already has birth_date. We add notes as a new column.
-- date_of_birth is NOT added because the column is already birth_date.
ALTER TABLE children ADD COLUMN IF NOT EXISTS notes TEXT NULL;

COMMIT;
