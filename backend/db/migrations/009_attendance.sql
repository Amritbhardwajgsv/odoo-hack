CREATE TABLE attendance (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id          UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date      DATE NOT NULL,
    check_in             TIMESTAMPTZ,
    check_out            TIMESTAMPTZ,
    worked_hours         NUMERIC(5,2),
    status               attendance_status NOT NULL DEFAULT 'present',
    is_manual_correction BOOLEAN NOT NULL DEFAULT false,
    corrected_by         UUID REFERENCES users(id),
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, attendance_date)
);