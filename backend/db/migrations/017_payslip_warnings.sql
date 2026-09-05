CREATE TABLE payslip_warnings (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payslip_id  UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    severity    warning_severity NOT NULL,
    message     TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);