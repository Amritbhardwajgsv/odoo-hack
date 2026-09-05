const bcrypt = require('bcryptjs');
const pool = require('./pool');

// Only admins can create user accounts, so there is no signup route -
// this script bootstraps the first admin so someone can log in at all.
async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) {
    console.log(`Admin user ${email} already exists, skipping.`);
    return;
  }

  const { rows: employeeRows } = await pool.query(
    `INSERT INTO employees (full_name, email, department, employee_type, status, date_joined)
     VALUES ($1, $2, 'admin', 'full_time', 'active', CURRENT_DATE)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    ['System Administrator', email]
  );
  const employeeId = employeeRows[0].id;

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (employee_id, email, password_hash, roles, is_active)
     VALUES ($1, $2, $3, ARRAY['admin']::user_role[], true)`,
    [employeeId, email, passwordHash]
  );

  console.log(`Seeded admin user: ${email}`);
}

// Gives the Employee form's Job Position / Working Schedule dropdowns
// something to show instead of being empty on a fresh database.
async function seedLookups() {
  const { rows: positions } = await pool.query('SELECT id FROM job_positions LIMIT 1');
  if (positions.length === 0) {
    await pool.query(
      `INSERT INTO job_positions (title, department) VALUES
         ('Software Engineer', 'engineering'),
         ('HR Generalist', 'hr'),
         ('Payroll Specialist', 'finance')`
    );
    console.log('Seeded job positions.');
  }

  const { rows: schedules } = await pool.query('SELECT id FROM working_schedules LIMIT 1');
  if (schedules.length === 0) {
    await pool.query(
      `INSERT INTO working_schedules (name, type, total_weekly_hours) VALUES
         ('Standard 9-to-5', 'fixed', 40)`
    );
    console.log('Seeded working schedules.');
  }
}

seedAdmin()
  .then(seedLookups)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
