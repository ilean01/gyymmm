PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL DEFAULT 'default',
  routine_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_profile_started
  ON workout_sessions (profile_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_updated
  ON workout_sessions (updated_at);

CREATE TABLE IF NOT EXISTS workout_sets (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL DEFAULT 'default',
  session_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  weight_kg REAL NOT NULL CHECK (weight_kg >= 0),
  reps INTEGER NOT NULL CHECK (reps > 0),
  completed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workout_sets_session
  ON workout_sets (session_id, set_number);

CREATE INDEX IF NOT EXISTS idx_workout_sets_profile_completed
  ON workout_sets (profile_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_sets_updated
  ON workout_sets (updated_at);
