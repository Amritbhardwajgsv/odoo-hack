-- Demo HR data: job positions, schedules, employees and their login accounts.
-- Safe to re-run: every statement is guarded, so nothing is duplicated.
--
-- Every seeded account uses the password: Password123!
-- (stored below as its bcrypt hash - the plaintext is never stored anywhere)

-- ---------------------------------------------------------------- lookups
INSERT INTO job_positions (title, department)
SELECT v.title, v.department
  FROM (VALUES
    ('Software Engineer',  'engineering'::department_type),
    ('HR Generalist',      'hr'::department_type),
    ('Payroll Specialist', 'finance'::department_type),
    ('Sales Executive',    'sales'::department_type)
  ) AS v(title, department)
 WHERE NOT EXISTS (SELECT 1 FROM job_positions jp WHERE jp.title = v.title);

INSERT INTO working_schedules (name, type, total_weekly_hours)
SELECT v.name, v.type, v.hours
  FROM (VALUES
    ('Standard 9-to-5', 'fixed',    40.0),
    ('Four-day week',   'flexible', 32.0)
  ) AS v(name, type, hours)
 WHERE NOT EXISTS (SELECT 1 FROM working_schedules ws WHERE ws.name = v.name);

-- -------------------------------------------------------------- employees
INSERT INTO employees
  (full_name, email, phone, department, job_position_id, working_schedule_id,
   employee_type, status, date_joined)
VALUES
  ('Rhea Kapoor', 'rhea@peoplepay360.com', '+91 98100 11001', 'hr',
   (SELECT id FROM job_positions WHERE title = 'HR Generalist' LIMIT 1),
   (SELECT id FROM working_schedules WHERE name = 'Standard 9-to-5' LIMIT 1),
   'full_time', 'active', DATE '2023-04-03'),

  ('Neha Verma', 'neha@peoplepay360.com', '+91 98100 11002', 'finance',
   (SELECT id FROM job_positions WHERE title = 'Payroll Specialist' LIMIT 1),
   (SELECT id FROM working_schedules WHERE name = 'Standard 9-to-5' LIMIT 1),
   'full_time', 'active', DATE '2022-11-14'),

  ('Karan Malhotra', 'karan@peoplepay360.com', '+91 98100 11003', 'finance',
   (SELECT id FROM job_positions WHERE title = 'Payroll Specialist' LIMIT 1),
   (SELECT id FROM working_schedules WHERE name = 'Standard 9-to-5' LIMIT 1),
   'full_time', 'active', DATE '2024-01-08'),

  ('Arjun Singh', 'arjun@peoplepay360.com', '+91 98100 11004', 'engineering',
   (SELECT id FROM job_positions WHERE title = 'Software Engineer' LIMIT 1),
   (SELECT id FROM working_schedules WHERE name = 'Standard 9-to-5' LIMIT 1),
   'full_time', 'active', DATE '2024-06-17'),

  ('Ishita Rao', 'ishita@peoplepay360.com', '+91 98100 11005', 'engineering',
   (SELECT id FROM job_positions WHERE title = 'Software Engineer' LIMIT 1),
   (SELECT id FROM working_schedules WHERE name = 'Four-day week' LIMIT 1),
   'part_time', 'active', DATE '2025-02-03'),

  ('Vikram Nair', 'vikram@peoplepay360.com', '+91 98100 11006', 'sales',
   (SELECT id FROM job_positions WHERE title = 'Sales Executive' LIMIT 1),
   (SELECT id FROM working_schedules WHERE name = 'Standard 9-to-5' LIMIT 1),
   'contract', 'active', DATE '2025-07-21')
ON CONFLICT (email) DO NOTHING;

-- work details shown on the employee form
UPDATE employees e SET work_location = v.location, company = 'PeoplePay360 Pvt Ltd'
  FROM (VALUES
    ('rhea@peoplepay360.com',   'Bengaluru'),
    ('neha@peoplepay360.com',   'Mumbai'),
    ('karan@peoplepay360.com',  'Mumbai'),
    ('arjun@peoplepay360.com',  'Bengaluru'),
    ('ishita@peoplepay360.com', 'Remote'),
    ('vikram@peoplepay360.com', 'Delhi')
  ) AS v(email, location)
 WHERE e.email = v.email AND e.work_location IS NULL;

-- reporting lines
UPDATE employees SET manager_id = (SELECT id FROM employees WHERE email = 'rhea@peoplepay360.com')
 WHERE email IN ('arjun@peoplepay360.com', 'ishita@peoplepay360.com', 'vikram@peoplepay360.com')
   AND manager_id IS NULL;

UPDATE employees SET manager_id = (SELECT id FROM employees WHERE email = 'neha@peoplepay360.com')
 WHERE email = 'karan@peoplepay360.com'
   AND manager_id IS NULL;

-- --------------------------------------------------------------- accounts
-- Ishita Rao is deliberately left without a login, to exercise the
-- "employee exists but cannot sign in" case.
INSERT INTO users (employee_id, email, password_hash, roles, is_active)
SELECT e.id, e.email,
       '$2a$10$2mt5FRkv96wVc4VTwE5fwen1HHBoSlX2asWrL8yugAvpuhfU0biZ2',
       v.roles, true
  FROM (VALUES
    ('rhea@peoplepay360.com',   ARRAY['hr_manager']::user_role[]),
    ('neha@peoplepay360.com',   ARRAY['hr_payroll_manager']::user_role[]),
    ('karan@peoplepay360.com',  ARRAY['hr_payroll_user']::user_role[]),
    ('arjun@peoplepay360.com',  ARRAY['employee']::user_role[]),
    ('vikram@peoplepay360.com', ARRAY['employee']::user_role[])
  ) AS v(email, roles)
  JOIN employees e ON e.email = v.email
ON CONFLICT (email) DO NOTHING;
