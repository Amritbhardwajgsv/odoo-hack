CREATE TABLE time_off_allocations (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    time_off_type_id UUID NOT NULL REFERENCES time_off_types(id),
    allocated_amount NUMERIC(6,2) NOT NULL,
    taken_amount     NUMERIC(6,2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(6,2) GENERATED ALWAYS AS (allocated_amount - taken_amount) STORED,
    valid_from       DATE NOT NULL,
    valid_to         DATE,
    status           allocation_status NOT NULL DEFAULT 'draft',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);