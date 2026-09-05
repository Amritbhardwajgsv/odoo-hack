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

-- ------------------------------------------------- working schedule pattern
-- Mon-Fri 09:00-18:00 with a 60 minute break = 8h a day, 40h a week.
-- day_of_week: 0 = Monday ... 6 = Sunday.
INSERT INTO working_schedule_lines (schedule_id, day_of_week, start_time, end_time, break_minutes)
SELECT ws.id, d.day, TIME '09:00', TIME '18:00', 60
  FROM working_schedules ws
  CROSS JOIN (VALUES (0), (1), (2), (3), (4)) AS d(day)
 WHERE ws.name = 'Standard 9-to-5'
   AND NOT EXISTS (
     SELECT 1 FROM working_schedule_lines l
      WHERE l.schedule_id = ws.id AND l.day_of_week = d.day
   );

-- Four-day week: Mon-Thu 09:00-18:00, same break = 32h.
INSERT INTO working_schedule_lines (schedule_id, day_of_week, start_time, end_time, break_minutes)
SELECT ws.id, d.day, TIME '09:00', TIME '18:00', 60
  FROM working_schedules ws
  CROSS JOIN (VALUES (0), (1), (2), (3)) AS d(day)
 WHERE ws.name = 'Four-day week'
   AND NOT EXISTS (
     SELECT 1 FROM working_schedule_lines l
      WHERE l.schedule_id = ws.id AND l.day_of_week = d.day
   );

UPDATE working_schedules ws
   SET company = COALESCE(ws.company, 'PeoplePay360 Pvt Ltd'),
       total_weekly_hours = COALESCE((
         SELECT SUM((EXTRACT(EPOCH FROM (l.end_time - l.start_time)) / 3600.0)
                    - (l.break_minutes / 60.0))
           FROM working_schedule_lines l
          WHERE l.schedule_id = ws.id
       ), 0);

-- ------------------------------------------------------- salary structures
-- contracts.salary_structure_id is NOT NULL, so at least one structure has
-- to exist before any contract can be created.
INSERT INTO salary_structures (name, description, is_active)
SELECT v.name, v.description, true
  FROM (VALUES
    ('Employee Salary', 'Standard monthly salary structure used for payroll runs.'),
    ('Contractor Payout', 'Flat payout structure for contract staff.')
  ) AS v(name, description)
 WHERE NOT EXISTS (SELECT 1 FROM salary_structures s WHERE s.name = v.name);

-- --------------------------------------------------------------- contracts
-- Each employee gets one running contract; Karan also keeps an expired one so
-- the list shows real contract history alongside the active row.
INSERT INTO contracts
  (employee_id, department, job_position_id, working_schedule_id,
   salary_structure_id, wage, start_date, end_date, status, notes, contract_number)
SELECT e.id, e.department, e.job_position_id, e.working_schedule_id,
       (SELECT id FROM salary_structures WHERE name = 'Employee Salary' LIMIT 1),
       v.wage, v.start_date, v.end_date, v.status::contract_status,
       'This running contract is the source for payroll calculation in the active period.',
       -- numbered by the contract's own year, not the year it was inserted
       'CON/' || to_char(v.start_date, 'YYYY') || '/' ||
         lpad(nextval('contract_number_seq')::text, 4, '0')
  FROM (VALUES
    ('rhea@peoplepay360.com',   85000.00, DATE '2026-01-01', NULL::date,             'active'),
    ('neha@peoplepay360.com',   95000.00, DATE '2026-01-01', NULL::date,             'active'),
    ('karan@peoplepay360.com',  78000.00, DATE '2025-07-01', DATE '2025-12-31',      'expired'),
    ('karan@peoplepay360.com',  85000.00, DATE '2026-01-01', NULL::date,             'active'),
    ('arjun@peoplepay360.com',  65000.00, DATE '2026-01-01', NULL::date,             'active'),
    ('vikram@peoplepay360.com', 55000.00, DATE '2026-01-01', DATE '2026-12-31',      'active')
  ) AS v(email, wage, start_date, end_date, status)
  JOIN employees e ON e.email = v.email
 WHERE NOT EXISTS (
   SELECT 1 FROM contracts c
    WHERE c.employee_id = e.id AND c.start_date = v.start_date
 );

-- realign any contract numbered with the insert year rather than its own
UPDATE contracts
   SET contract_number = 'CON/' || to_char(start_date, 'YYYY') || '/' ||
                         split_part(contract_number, '/', 3)
 WHERE contract_number IS NOT NULL
   AND split_part(contract_number, '/', 2) <> to_char(start_date, 'YYYY');

-- ---------------------------------------------------------------- time off
INSERT INTO time_off_types (name, unit, requires_allocation, requires_approval, affects_payroll)
SELECT v.name, v.unit::time_off_unit, v.needs_alloc, true, v.payroll
  FROM (VALUES
    ('Paid Time Off', 'days', true,  true),
    ('Sick Leave',    'days', true,  true),
    ('Comp Off',      'days', false, false)
  ) AS v(name, unit, needs_alloc, payroll)
 WHERE NOT EXISTS (SELECT 1 FROM time_off_types t WHERE t.name = v.name);

-- A balance per employee for the allocation-backed types, valid this year.
INSERT INTO time_off_allocations
  (employee_id, time_off_type_id, allocated_amount, taken_amount, valid_from, valid_to, status)
SELECT e.id, t.id, v.amount, 0, DATE '2026-01-01', DATE '2026-12-31', 'approved'
  FROM employees e
  CROSS JOIN (VALUES ('Paid Time Off', 18.0), ('Sick Leave', 10.0)) AS v(type_name, amount)
  JOIN time_off_types t ON t.name = v.type_name
 WHERE e.email LIKE '%@peoplepay360.com'
   AND NOT EXISTS (
     SELECT 1 FROM time_off_allocations a
      WHERE a.employee_id = e.id AND a.time_off_type_id = t.id
   );

-- Requests across the lifecycle: one waiting on a decision, one already
-- taken, one that needs no balance at all.
INSERT INTO time_off_requests
  (employee_id, time_off_type_id, date_from, date_to, duration, status, reason)
SELECT e.id, t.id, v.date_from, v.date_to,
       (v.date_to - v.date_from) + 1, v.status::time_off_request_status, v.reason
  FROM (VALUES
    ('arjun@peoplepay360.com',  'Paid Time Off', DATE '2026-09-12', DATE '2026-09-14', 'submitted', 'Family vacation'),
    ('vikram@peoplepay360.com', 'Sick Leave',    DATE '2026-09-18', DATE '2026-09-18', 'submitted', 'Fever'),
    ('karan@peoplepay360.com',  'Comp Off',      DATE '2026-09-27', DATE '2026-09-27', 'submitted', 'Worked the weekend release')
  ) AS v(email, type_name, date_from, date_to, status, reason)
  JOIN employees e ON e.email = v.email
  JOIN time_off_types t ON t.name = v.type_name
 WHERE NOT EXISTS (
   SELECT 1 FROM time_off_requests r
    WHERE r.employee_id = e.id AND r.date_from = v.date_from
 );

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
