CREATE TABLE working_schedule_lines (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id    UUID NOT NULL REFERENCES working_schedules(id) ON DELETE CASCADE,
    day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    break_minutes  INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);