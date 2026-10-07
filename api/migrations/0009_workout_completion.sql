PRAGMA foreign_keys = ON;

ALTER TABLE workout_sessions
ADD COLUMN abandoned_at TEXT;

ALTER TABLE workout_sets
ADD COLUMN is_extra INTEGER NOT NULL DEFAULT 0
CHECK (is_extra IN (0, 1));
