ALTER TABLE users
    ADD COLUMN roles user_role[] NOT NULL DEFAULT ARRAY['employee']::user_role[];

UPDATE users SET roles = ARRAY[role]::user_role[];

ALTER TABLE users DROP COLUMN role;

ALTER TABLE users
    ADD CONSTRAINT users_roles_not_empty CHECK (array_length(roles, 1) > 0);

CREATE INDEX idx_users_roles ON users USING GIN (roles);
