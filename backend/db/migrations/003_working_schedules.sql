CREATE TABLE working_schedules (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name               VARCHAR(120) NOT NULL,
    type               VARCHAR(50)  NOT NULL DEFAULT 'fixed',
    total_weekly_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);