-- Payroll demo data. Re-runnable: every statement checks for what it is
-- about to insert. The payruns land as drafts here; seed.js then computes
-- them through the real service so the payslips, totals and warnings are
-- produced by the same code path the UI uses, never hand-written.

-- ------------------------------------------------------------ salary rules
-- Nothing can be computed without these: a payrun with no active rules is
-- refused rather than silently producing empty payslips.
--
-- The allowances are tuned so gross lands exactly on the contract wage:
-- Basic 60% + HRA (40% of basic) + fixed transport + whatever is left over.
INSERT INTO salary_rules
  (structure_id, name, code, category, sequence, computation_method, value, formula, is_active)
SELECT s.id, v.name, v.code, v.category::salary_category, v.sequence,
       v.method::computation_method, v.value, v.formula, true
  FROM (VALUES
    ('Employee Salary', 'Basic Salary',         'BASIC', 'basic',     10, 'percentage_of_contract_wage', 60.0::numeric, NULL::text),
    ('Employee Salary', 'House Rent Allowance', 'HRA',   'allowance', 20, 'percentage_of_basic',         40.0,          NULL),
    ('Employee Salary', 'Transport Allowance',  'TA',    'allowance', 30, 'fixed',                       1600.0,        NULL),
    -- Balancing line, so the payslip always adds up to the agreed wage.
    ('Employee Salary', 'Special Allowance',    'SPL',   'allowance', 40, 'formula',                     NULL,          'wage - basic - HRA - TA'),
    ('Employee Salary', 'Provident Fund',       'PF',    'deduction', 50, 'percentage_of_basic',         12.0,          NULL),
    ('Employee Salary', 'Professional Tax',     'PT',    'deduction', 60, 'fixed',                       200.0,         NULL),
    ('Employee Salary', 'Income Tax (TDS)',     'TDS',   'deduction', 70, 'formula',                     NULL,          'gross * 0.10'),

    ('Contractor Payout', 'Contract Fee',       'FEE',   'basic',     10, 'percentage_of_contract_wage', 100.0,         NULL),
    ('Contractor Payout', 'Withholding Tax',    'WHT',   'deduction', 20, 'percentage_of_gross',         10.0,          NULL)
  ) AS v(structure_name, name, code, category, sequence, method, value, formula)
  JOIN salary_structures s ON s.name = v.structure_name
 WHERE NOT EXISTS (
   SELECT 1 FROM salary_rules r WHERE r.structure_id = s.id AND r.code = v.code
 );

-- -------------------------------------------------------------- attendance
-- Payroll reads worked days from attendance, so without this every payslip
-- would carry a "no attendance recorded" warning. Weekdays only.
INSERT INTO attendance
  (employee_id, attendance_date, check_in, check_out, worked_hours, status)
SELECT e.id,
       d::date,
       (d + TIME '09:30')::timestamptz,
       (d + TIME '18:30')::timestamptz,
       8.0,
       'present'
  FROM employees e
  CROSS JOIN generate_series(DATE '2026-01-01', DATE '2026-02-28', INTERVAL '1 day') AS d
 WHERE e.email LIKE '%@peoplepay360.com'
   AND EXTRACT(ISODOW FROM d) < 6
   AND NOT EXISTS (
     SELECT 1 FROM attendance a
      WHERE a.employee_id = e.id AND a.attendance_date = d::date
   );

-- ------------------------------------------------------------------ payruns
-- One period per month. Every payrun starts as a draft; seed.js walks them
-- forward so the list shows a paid, a validated and a draft run side by side.
INSERT INTO payruns (name, salary_structure_id, department, period_start, period_end, status)
SELECT v.name,
       (SELECT id FROM salary_structures WHERE name = 'Employee Salary' LIMIT 1),
       NULL,
       v.period_start,
       v.period_end,
       'draft'
  FROM (VALUES
    ('January 2026',  DATE '2026-01-01', DATE '2026-01-31'),
    ('February 2026', DATE '2026-02-01', DATE '2026-02-28'),
    ('March 2026',    DATE '2026-03-01', DATE '2026-03-31')
  ) AS v(name, period_start, period_end)
 WHERE NOT EXISTS (SELECT 1 FROM payruns p WHERE p.name = v.name);

-- Fill each payrun with everyone holding a running contract over its period,
-- which is the same rule the API applies when a payrun is created by hand.
INSERT INTO payrun_employees (payrun_id, employee_id)
SELECT DISTINCT p.id, c.employee_id
  FROM payruns p
  JOIN contracts c ON c.status = 'active'
                  AND c.start_date <= p.period_end
                  AND (c.end_date IS NULL OR c.end_date >= p.period_start)
  JOIN employees e ON e.id = c.employee_id AND e.status = 'active'
 WHERE (p.department IS NULL OR e.department = p.department)
ON CONFLICT (payrun_id, employee_id) DO NOTHING;
