CREATE TABLE payruns (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(150) NOT NULL,
    salary_structure_id UUID NOT NULL REFERENCES salary_structures(id),
    department          department_type,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    status              payrun_status NOT NULL DEFAULT 'draft',
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_period CHECK (period_end >= period_start)
);