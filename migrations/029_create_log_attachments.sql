-- Photo attachments on a daily log (e.g. documenting a meltdown, a rash, a
-- meal). Actual bytes never touch the backend — same presigned-URL S3 flow
-- as documents (see documents table), but attachments are 1:many per log.
--
-- Uses its own storage prefix (log-attachments/... vs documents/...) rather
-- than reusing the documents table/flow, so these photos — which can be
-- more sensitive than a routine clinical document (e.g. a meltdown photo)
-- — can be governed by a distinct S3 bucket policy/lifecycle rule later
-- without disturbing the documents flow.
CREATE TABLE log_attachments (
  id           UUID PRIMARY KEY,
  log_id       UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  storage_key  TEXT NOT NULL UNIQUE,
  mime_type    VARCHAR(150) NOT NULL,
  size_bytes   BIGINT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_log_attachments_log_id ON log_attachments(log_id);
