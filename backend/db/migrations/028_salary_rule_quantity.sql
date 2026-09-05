-- The Salary Rule form has a Quantity field (wireframe: Basic Salary,
-- Quantity = 1) that multiplies whatever the computation method produces -
-- the same role "quantity" plays in Odoo's payroll rules, useful for
-- per-unit rules (e.g. a fixed per-day allowance x days worked). Defaulting
-- to 1 keeps every existing rule's computed amount unchanged.
ALTER TABLE salary_rules ADD COLUMN quantity NUMERIC(10,4) NOT NULL DEFAULT 1;
