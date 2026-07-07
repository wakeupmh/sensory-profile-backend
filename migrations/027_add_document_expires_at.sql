-- Lets a document (e.g. a medical certificate, a therapy authorization, an
-- IEP/PEI approval) carry an expiry date, so the hub can proactively surface
-- "this is about to expire" instead of it only being found by chance during
-- a records review. Nullable — most documents (photos, session notes) never
-- expire and simply omit it.

ALTER TABLE documents ADD COLUMN expires_at DATE NULL;

-- Supports UpcomingReminderService's "documents expiring within N days" query
-- (WHERE user_id = $1 AND expires_at BETWEEN $2 AND $3), mirroring the partial
-- indexes other domains use for the same derived-reminder pattern.
CREATE INDEX idx_documents_expires_at ON documents(expires_at) WHERE expires_at IS NOT NULL;
