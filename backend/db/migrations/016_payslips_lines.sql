CREATE TABLE payslip_lines (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payslip_id  UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    rule_id     UUID REFERENCES salary_rules(id),
    rule_name   VARCHAR(120) NOT NULL,
    category    salary_category NOT NULL,
    sequence    INTEGER NOT NULL,
    amount      NUMERIC(12,2) NOT NULL
);