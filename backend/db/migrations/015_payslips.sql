CREATE TABLE payslips (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payrun_id     UUID NOT NULL REFERENCES payruns(id) ON DELETE CASCADE,
    employee_id   UUID NOT NULL REFERENCES employees(id),
    contract_id   UUID NOT NULL REFERENCES contracts(id),
    period_start  DATE NOT NULL,
    period_end    DATE NOT NULL,
    worked_days   NUMERIC(5,2),
    gross_amount  NUMERIC(12,2),
    net_amount    NUMERIC(12,2),
    status        payslip_status NOT NULL DEFAULT 'draft',
    pdf_url       TEXT,
    computed_at   TIMESTAMPTZ,
    paid_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payrun_id, employee_id)
);