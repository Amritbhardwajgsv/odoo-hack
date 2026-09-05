-- Quick-login QA accounts, one per role plus one multi-role account, all
-- sharing the same short password for fast manual testing. These are
-- separate from the "real" demo accounts (Rhea/Neha/Karan/Arjun/Vikram,
-- password Password123!) handed to reviewers - those stay untouched.
--
-- Password for every account below: qwe123
-- That is shorter than the 8-character minimum POST/PATCH /api/users
-- enforces, so it only exists here, seeded directly - trying to set this
-- password through the product's own "create employee with login" form
-- will be rejected by that validation.
--
-- Idempotent like the rest of this file: safe to run again.

INSERT INTO employees
  (full_name, email, phone, department, job_position_id, working_schedule_id,
   employee_type, status, date_joined)
SELECT v.full_name, v.email, v.phone, v.department::department_type,
       (SELECT id FROM job_positions WHERE department = v.department::department_type LIMIT 1),
       (SELECT id FROM working_schedules WHERE name = 'Standard 9-to-5' LIMIT 1),
       'full_time', 'active', CURRENT_DATE
  FROM (VALUES
    ('Test Employee',         'test.employee@peoplepay360.com',        '+91 90000 00001', 'engineering'),
    ('Test HR Manager',       'test.hrmanager@peoplepay360.com',       '+91 90000 00002', 'hr'),
    ('Test Payroll User',     'test.payrolluser@peoplepay360.com',     '+91 90000 00003', 'finance'),
    ('Test Payroll Manager',  'test.payrollmanager@peoplepay360.com',  '+91 90000 00004', 'finance'),
    ('Test Admin',            'test.admin@peoplepay360.com',           '+91 90000 00005', 'admin'),
    ('Test Multi Role',       'test.multirole@peoplepay360.com',       '+91 90000 00006', 'hr')
  ) AS v(full_name, email, phone, department)
 WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.email = v.email);

-- test.multirole holds both hr_manager and hr_payroll_user, so logging in
-- with it is the fastest way to see the union-of-permissions behaviour
-- (People/Contracts/Time Off from the first role, Payroll from the second)
-- without juggling two separate logins.
INSERT INTO users (employee_id, email, password_hash, roles, is_active)
SELECT e.id, e.email, '$2a$10$syonoFj3Jed3dh.8uVmDAeVbZb3RBsC25ps98dGYJRGyqzZK1nSL6', v.roles, true
  FROM (VALUES
    ('test.employee@peoplepay360.com',       ARRAY['employee']::user_role[]),
    ('test.hrmanager@peoplepay360.com',      ARRAY['hr_manager']::user_role[]),
    ('test.payrolluser@peoplepay360.com',    ARRAY['hr_payroll_user']::user_role[]),
    ('test.payrollmanager@peoplepay360.com', ARRAY['hr_payroll_manager']::user_role[]),
    ('test.admin@peoplepay360.com',          ARRAY['admin']::user_role[]),
    ('test.multirole@peoplepay360.com',      ARRAY['hr_manager', 'hr_payroll_user']::user_role[])
  ) AS v(email, roles)
  JOIN employees e ON e.email = v.email
ON CONFLICT (email) DO NOTHING;
