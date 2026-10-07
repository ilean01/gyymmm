PRAGMA foreign_keys = ON;

ALTER TABLE workout_sets RENAME TO workout_sets_legacy;

CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL DEFAULT 'default',
  session_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg >= 0),
  reps INTEGER CHECK (reps IS NULL OR reps > 0),
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  workout_exercise_id TEXT
    REFERENCES workout_exercises(id) ON DELETE CASCADE,
  target_weight_kg REAL
    CHECK (target_weight_kg IS NULL OR target_weight_kg >= 0),
  target_reps INTEGER
    CHECK (target_reps IS NULL OR target_reps > 0),
  duration_seconds INTEGER
    CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  rev INTEGER NOT NULL DEFAULT 1 CHECK (rev > 0),
  deleted_at TEXT,
  FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
);

INSERT INTO workout_sets (
  id,
  profile_id,
  session_id,
  exercise_id,
  exercise_name,
  set_number,
  weight_kg,
  reps,
  completed_at,
  updated_at,
  created_at,
  user_id,
  workout_exercise_id,
  target_weight_kg,
  target_reps,
  duration_seconds,
  rev,
  deleted_at
)
SELECT
  id,
  profile_id,
  session_id,
  exercise_id,
  exercise_name,
  set_number,
  weight_kg,
  reps,
  completed_at,
  updated_at,
  created_at,
  user_id,
  workout_exercise_id,
  target_weight_kg,
  target_reps,
  duration_seconds,
  rev,
  deleted_at
FROM workout_sets_legacy;

DROP TABLE workout_sets_legacy;

CREATE INDEX idx_workout_sets_session
  ON workout_sets (session_id, set_number);

CREATE INDEX idx_workout_sets_profile_completed
  ON workout_sets (profile_id, completed_at DESC);

CREATE INDEX idx_workout_sets_updated
  ON workout_sets (updated_at);

CREATE INDEX idx_workout_sets_user_completed
  ON workout_sets (user_id, completed_at DESC);

CREATE INDEX idx_workout_sets_workout_exercise
  ON workout_sets (workout_exercise_id, set_number);
