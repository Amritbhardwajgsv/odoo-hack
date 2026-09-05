DROP INDEX IF EXISTS idx_payslip_warnings_payslip;
DROP INDEX IF EXISTS idx_payruns_period;

ALTER TABLE payruns
    DROP COLUMN IF EXISTS paid_at,
    DROP COLUMN IF EXISTS validated_at,
    DROP COLUMN IF EXISTS computed_at;
