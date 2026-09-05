CREATE TABLE time_off_requests (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    time_off_type_id UUID NOT NULL REFERENCES time_off_types(id),
    allocation_id    UUID REFERENCES time_off_allocations(id),
    date_from        DATE NOT NULL,
    date_to          DATE NOT NULL,
    duration         NUMERIC(6,2) NOT NULL,
    status           time_off_request_status NOT NULL DEFAULT 'draft',
    reason           TEXT,
    approved_by      UUID REFERENCES users(id),
    approved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_request_range CHECK (date_to >= date_from)
);