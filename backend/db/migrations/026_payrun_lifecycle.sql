-- A payrun moves draft -> computed -> validated -> paid, and the UI shows
-- when each step happened. The status column alone can't answer "when was
-- this validated", so each transition gets its own timestamp.
ALTER TABLE payruns
    ADD COLUMN computed_at  TIMESTAMPTZ,
    ADD COLUMN validated_at TIMESTAMPTZ,
    ADD COLUMN paid_at      TIMESTAMPTZ;

-- The list screen orders by period and filters by year, and every payslip
-- card needs its unresolved warning count.
CREATE INDEX idx_payruns_period ON payruns (period_start DESC);
CREATE INDEX idx_payslip_warnings_payslip ON payslip_warnings (payslip_id, is_resolved);
