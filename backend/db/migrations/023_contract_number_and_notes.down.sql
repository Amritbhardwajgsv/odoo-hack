DROP INDEX IF EXISTS idx_contracts_status;

ALTER TABLE contracts
    DROP COLUMN IF EXISTS contract_number,
    DROP COLUMN IF EXISTS notes;

DROP SEQUENCE IF EXISTS contract_number_seq;
