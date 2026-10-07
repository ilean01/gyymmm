PRAGMA foreign_keys = ON;

CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  rev INTEGER NOT NULL DEFAULT 1 CHECK (rev > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_routines_user_status
  ON routines (user_id, status, updated_at DESC);

CREATE TABLE routine_schedule (
  routine_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  PRIMARY KEY (routine_id, weekday),
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);

CREATE TABLE routine_exercises (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  notes TEXT,
  rest_seconds INTEGER CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
  rev INTEGER NOT NULL DEFAULT 1 CHECK (rev > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT
);

CREATE INDEX idx_routine_exercises_order
  ON routine_exercises (routine_id, position);

CREATE TABLE routine_sets (
  id TEXT PRIMARY KEY,
  routine_exercise_id TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  set_type TEXT NOT NULL DEFAULT 'normal'
    CHECK (set_type IN ('warmup', 'normal', 'drop')),
  target_reps_min INTEGER
    CHECK (target_reps_min IS NULL OR target_reps_min > 0),
  target_reps_max INTEGER
    CHECK (target_reps_max IS NULL OR target_reps_max > 0),
  target_seconds INTEGER
    CHECK (target_seconds IS NULL OR target_seconds > 0),
  target_weight_kg REAL
    CHECK (target_weight_kg IS NULL OR target_weight_kg >= 0),
  notes TEXT,
  rev INTEGER NOT NULL DEFAULT 1 CHECK (rev > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (routine_exercise_id)
    REFERENCES routine_exercises(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_routine_sets_number
  ON routine_sets (routine_exercise_id, set_number);
