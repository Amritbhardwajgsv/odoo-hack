DROP INDEX IF EXISTS idx_users_roles;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_roles_not_empty;

ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'employee';

UPDATE users SET role = roles[1];

ALTER TABLE users DROP COLUMN roles;
