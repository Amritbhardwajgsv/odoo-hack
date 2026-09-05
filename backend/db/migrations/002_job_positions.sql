CREATE TABLE job_positions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       VARCHAR(120) NOT NULL,
    department  department_type NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);