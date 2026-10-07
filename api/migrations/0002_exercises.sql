PRAGMA foreign_keys = ON;

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  name TEXT NOT NULL,
  muscle_group TEXT,
  equipment TEXT,
  instructions TEXT,
  image_path TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1)),
  archived_at TEXT,
  rev INTEGER NOT NULL DEFAULT 1 CHECK (rev > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_exercises_owner_name
  ON exercises (owner_user_id, name);

CREATE INDEX idx_exercises_builtin_name
  ON exercises (is_builtin, name);

CREATE INDEX idx_exercises_updated
  ON exercises (updated_at);
