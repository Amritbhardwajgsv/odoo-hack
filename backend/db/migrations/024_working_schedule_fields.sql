-- Fields the working schedule list and form need beyond name/hours.
ALTER TABLE working_schedules
    ADD COLUMN company   VARCHAR(120),
    ADD COLUMN timezone  VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- A schedule should not list the same weekday twice.
ALTER TABLE working_schedule_lines
    ADD CONSTRAINT working_schedule_lines_unique_day UNIQUE (schedule_id, day_of_week);

CREATE INDEX idx_schedule_lines_schedule ON working_schedule_lines (schedule_id);
