CREATE TABLE contracts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    department          department_type NOT NULL,
    job_position_id     UUID REFERENCES job_positions(id) ON DELETE SET NULL,
    working_schedule_id UUID REFERENCES working_schedules(id) ON DELETE SET NULL,
    salary_structure_id UUID NOT NULL REFERENCES salary_structures(id),
    wage                NUMERIC(12,2) NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE,
    status              contract_status NOT NULL DEFAULT 'draft',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

ALTER TABLE contracts ADD COLUMN date_range daterange
    GENERATED ALWAYS AS (daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]')) STORED;

ALTER TABLE contracts ADD CONSTRAINT no_overlapping_active_contracts
    EXCLUDE USING gist (
        employee_id WITH =,
        date_range WITH &&
    ) WHERE (status = 'active');
    