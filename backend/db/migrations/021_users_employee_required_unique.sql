ALTER TABLE users ALTER COLUMN employee_id SET NOT NULL;

ALTER TABLE users ADD CONSTRAINT users_employee_id_unique UNIQUE (employee_id);
