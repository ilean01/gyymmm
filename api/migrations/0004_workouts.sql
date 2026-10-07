PRAGMA foreign_keys = ON;

-- Estas columnas son NULL por ahora para conservar los datos del prototipo
-- creados antes de que exista autenticación. Cuando activemos auth,
-- las nuevas sesiones usarán siempre user_id.
ALTER TABLE workout_sessions
  ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE workout_sessions
  ADD COLUMN routine_id TEXT REFERENCES routines(id) ON DELETE SET NULL;

ALTER TABLE workout_sessions
  ADD COLUMN notes TEXT;

ALTER TABLE workout_sessions
  ADD COLUMN rev INTEGER NOT NULL DEFAULT 1 CHECK (rev > 0);

ALTER TABLE workout_sessions
  ADD COLUMN deleted_at TEXT;

CREATE INDEX idx_workout_sessions_user_started
  ON workout_sessions (user_id, started_at DESC);

CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  source_routine_exercise_id TEXT,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
  notes TEXT,
  rest_seconds INTEGER CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
  replaced_exercise_id TEXT,
  rev INTEGER NOT NULL DEFAULT 1 CHECK (rev > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_routine_exercise_id)
    REFERENCES routine_exercises(id)
    ON DELETE SET NULL
);

CREATE INDEX idx_workout_exercises_session_order
  ON workout_exercises (session_id, position);

ALTER TABLE workout_sets
  ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE workout_sets
  ADD COLUMN workout_exercise_id TEXT
    REFERENCES workout_exercises(id) ON DELETE CASCADE;

ALTER TABLE workout_sets
  ADD COLUMN target_weight_kg REAL
    CHECK (target_weight_kg IS NULL OR target_weight_kg >= 0);

ALTER TABLE workout_sets
  ADD COLUMN target_reps INTEGER
    CHECK (target_reps IS NULL OR target_reps > 0);

ALTER TABLE workout_sets
  ADD COLUMN duration_seconds INTEGER
    CHECK (duration_seconds IS NULL OR duration_seconds > 0);

ALTER TABLE workout_sets
  ADD COLUMN rev INTEGER NOT NULL DEFAULT 1 CHECK (rev > 0);

ALTER TABLE workout_sets
  ADD COLUMN deleted_at TEXT;

CREATE INDEX idx_workout_sets_user_completed
  ON workout_sets (user_id, completed_at DESC);

CREATE INDEX idx_workout_sets_workout_exercise
  ON workout_sets (workout_exercise_id, set_number);
