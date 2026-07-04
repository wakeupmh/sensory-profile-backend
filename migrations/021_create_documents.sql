-- Attachment/document metadata per child. Actual file bytes live in S3;
-- the backend only issues presigned upload/download URLs and stores the
-- resulting object key + basic metadata. Optionally links to a resource
-- elsewhere in the hub (e.g. the medical appointment a lab report came from).

CREATE TABLE documents (
  id             UUID PRIMARY KEY,
  user_id        TEXT NOT NULL,
  child_id       UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  description    TEXT NULL,
  storage_key    TEXT NOT NULL UNIQUE,
  mime_type      VARCHAR(150) NOT NULL,
  size_bytes     BIGINT NULL,
  resource_type  VARCHAR(50) NULL,
  resource_id    UUID NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_child_id ON documents(child_id);
CREATE INDEX idx_documents_resource ON documents(resource_type, resource_id) WHERE resource_type IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
