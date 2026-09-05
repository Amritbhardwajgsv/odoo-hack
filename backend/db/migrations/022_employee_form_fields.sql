-- Fields shown on the employee form: work details not already stored, plus
-- the Private Information tab. bank_account also feeds the payroll warning
-- for "missing bank details" later on.
ALTER TABLE employees
    ADD COLUMN work_location           VARCHAR(120),
    ADD COLUMN company                 VARCHAR(120),
    ADD COLUMN personal_email          VARCHAR(150),
    ADD COLUMN personal_phone          VARCHAR(30),
    ADD COLUMN address                 TEXT,
    ADD COLUMN date_of_birth           DATE,
    ADD COLUMN emergency_contact_name  VARCHAR(150),
    ADD COLUMN emergency_contact_phone VARCHAR(30),
    ADD COLUMN bank_account            VARCHAR(64);
