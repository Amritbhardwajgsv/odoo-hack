DROP INDEX IF EXISTS idx_allocations_employee_type;

ALTER TABLE time_off_types
    DROP COLUMN IF EXISTS approval_by,
    DROP COLUMN IF EXISTS display_color,
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS work_entry,
    DROP COLUMN IF EXISTS notes;

ALTER TABLE time_off_allocations
    DROP COLUMN IF EXISTS approved_by,
    DROP COLUMN IF EXISTS approved_at,
    DROP COLUMN IF EXISTS description;

-- Postgres cannot remove a value from an enum, so 'refused' stays.
