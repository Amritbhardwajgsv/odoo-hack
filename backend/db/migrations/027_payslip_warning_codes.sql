-- The payslip table shows a short warning label per row ("A/C missing",
-- "Duplicate"), which a free-text message can't drive. The code names the
-- kind of problem; the message stays the human explanation.
ALTER TABLE payslip_warnings ADD COLUMN code VARCHAR(40);

CREATE INDEX idx_payslip_warnings_code ON payslip_warnings (code);
