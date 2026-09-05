DROP INDEX IF EXISTS idx_schedule_lines_schedule;

ALTER TABLE working_schedule_lines
    DROP CONSTRAINT IF EXISTS working_schedule_lines_unique_day;

ALTER TABLE working_schedules
    DROP COLUMN IF EXISTS company,
    DROP COLUMN IF EXISTS timezone,
    DROP COLUMN IF EXISTS is_active;
