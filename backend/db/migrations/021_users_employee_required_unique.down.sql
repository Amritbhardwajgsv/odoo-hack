ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_id_unique;

ALTER TABLE users ALTER COLUMN employee_id DROP NOT NULL;
