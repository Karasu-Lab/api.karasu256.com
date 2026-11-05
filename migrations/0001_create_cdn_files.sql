CREATE TABLE IF NOT EXISTS cdn_files (
  path TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploader_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS cdn_files_uploader_id_idx ON cdn_files (uploader_id);

CREATE TABLE IF NOT EXISTS cdn_migrations (
  name TEXT PRIMARY KEY,
  cursor TEXT,
  lease_until INTEGER,
  completed_at TEXT
);
