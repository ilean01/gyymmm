ALTER TABLE workout_sets
ADD COLUMN target_seconds INTEGER
CHECK (target_seconds IS NULL OR target_seconds > 0);
