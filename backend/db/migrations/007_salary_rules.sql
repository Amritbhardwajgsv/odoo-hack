CREATE TABLE salary_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    structure_id        UUID NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
    name                VARCHAR(120) NOT NULL,
    code                VARCHAR(30) NOT NULL,
    category            salary_category NOT NULL,
    sequence            INTEGER NOT NULL,
    computation_method  computation_method NOT NULL,
    value               NUMERIC(10,4),
    formula             TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (structure_id, code)
);