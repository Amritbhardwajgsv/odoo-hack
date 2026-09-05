ALTER TABLE employees
    DROP COLUMN IF EXISTS work_location,
    DROP COLUMN IF EXISTS company,
    DROP COLUMN IF EXISTS personal_email,
    DROP COLUMN IF EXISTS personal_phone,
    DROP COLUMN IF EXISTS address,
    DROP COLUMN IF EXISTS date_of_birth,
    DROP COLUMN IF EXISTS emergency_contact_name,
    DROP COLUMN IF EXISTS emergency_contact_phone,
    DROP COLUMN IF EXISTS bank_account;
