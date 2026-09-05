-- The wireframes give allocations an approval trail and a description, and
-- give types the policy settings that drive request behaviour.
ALTER TYPE allocation_status ADD VALUE IF NOT EXISTS 'refused';

ALTER TABLE time_off_allocations
    ADD COLUMN approved_by UUID REFERENCES users(id),
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN description TEXT;

ALTER TABLE time_off_types
    ADD COLUMN approval_by   VARCHAR(30) NOT NULL DEFAULT 'Manager',
    ADD COLUMN display_color VARCHAR(20) NOT NULL DEFAULT 'Blue',
    ADD COLUMN is_active     BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN work_entry    VARCHAR(60),
    ADD COLUMN notes         TEXT;

CREATE INDEX idx_allocations_employee_type
    ON time_off_allocations (employee_id, time_off_type_id, status);
