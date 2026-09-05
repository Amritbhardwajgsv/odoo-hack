CREATE TABLE employees (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code       VARCHAR(30) UNIQUE,
    full_name           VARCHAR(150) NOT NULL,
    email               VARCHAR(150) UNIQUE NOT NULL,
    phone               VARCHAR(30),
    department          department_type NOT NULL,
    job_position_id     UUID REFERENCES job_positions(id) ON DELETE SET NULL,
    manager_id          UUID REFERENCES employees(id) ON DELETE SET NULL,
    working_schedule_id UUID REFERENCES working_schedules(id) ON DELETE SET NULL,
    employee_type       VARCHAR(30) NOT NULL DEFAULT 'full_time',
    status              status_type NOT NULL DEFAULT 'active',
    date_joined         DATE NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);