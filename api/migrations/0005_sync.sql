PRAGMA foreign_keys = ON;

CREATE TABLE processed_mutations (
  mutation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL
    CHECK (operation IN ('upsert', 'delete')),
  resulting_rev INTEGER,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_processed_mutations_user_processed
  ON processed_mutations (user_id, processed_at DESC);

CREATE TABLE sync_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL
    CHECK (operation IN ('upsert', 'delete')),
  rev INTEGER NOT NULL CHECK (rev > 0),
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sync_changes_user_seq
  ON sync_changes (user_id, seq);

CREATE INDEX idx_sync_changes_entity
  ON sync_changes (user_id, entity_type, entity_id, seq DESC);
