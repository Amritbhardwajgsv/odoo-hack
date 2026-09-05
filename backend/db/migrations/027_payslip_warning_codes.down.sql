DROP INDEX IF EXISTS idx_payslip_warnings_code;

ALTER TABLE payslip_warnings DROP COLUMN IF EXISTS code;
