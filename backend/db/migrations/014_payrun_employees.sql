CREATE TABLE payrun_employees (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payrun_id   UUID NOT NULL REFERENCES payruns(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE (payrun_id, employee_id)
);