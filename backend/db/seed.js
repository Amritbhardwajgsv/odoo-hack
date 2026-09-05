const fs = require('fs');
const path = require('path');
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

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (employee_id, email, password_hash, roles, is_active)
     VALUES ($1, $2, $3, ARRAY['admin']::user_role[], true)`,
    [employeeRows[0].id, email, passwordHash]
  );

  console.log(`Seeded admin user: ${email}`);
}

// Demo employees + accounts covering every role. The SQL is kept as a file
// so it can also be run directly against the database without Node.
async function seedDemoData() {
  const sql = fs.readFileSync(path.join(__dirname, 'seeds', 'demo_data.sql'), 'utf8');
  await pool.query(sql);

  const { rows } = await pool.query('SELECT count(*)::int AS count FROM employees');
  console.log(`Seeded demo data. Employees in database: ${rows[0].count}`);
}

// Salary rules, attendance and three payroll periods. The payslips are not
// written by the seed - it calls the same service the API calls, so the
// amounts and warnings on screen are produced by the real engine.
async function seedPayroll() {
  const sql = fs.readFileSync(path.join(__dirname, 'seeds', 'payroll_demo.sql'), 'utf8');
  await pool.query(sql);

  const payruns = require('../src/services/payruns.service');
  // January is fully paid, February is validated and waiting, March stays a
  // draft - one payrun in each state the list screen can show.
  const WALK_TO = { 'January 2026': 'paid', 'February 2026': 'validated' };

  for (const [name, target] of Object.entries(WALK_TO)) {
    const { rows } = await pool.query('SELECT id, status FROM payruns WHERE name = $1', [name]);
    // Already advanced on a previous run; leave real work alone.
    if (!rows[0] || rows[0].status !== 'draft') continue;

    const computed = await payruns.compute(rows[0].id);
    if (computed.error) {
      console.log(`Could not compute ${name}: ${computed.error}`);
      continue;
    }
    const validated = await payruns.setStatus(rows[0].id, 'validated');
    if (validated.error) {
      console.log(`Could not validate ${name}: ${validated.error}`);
      continue;
    }
    if (target === 'paid') await payruns.setStatus(rows[0].id, 'paid');
    console.log(`Payrun ${name}: ${computed.computed} payslips, now ${target}.`);
  }

  const { rows: summary } = await pool.query(
    `SELECT p.name, p.status, count(ps.id)::int AS payslips,
            COALESCE(sum(ps.net_amount), 0)::numeric AS net
       FROM payruns p LEFT JOIN payslips ps ON ps.payrun_id = p.id
      GROUP BY p.id, p.name, p.status ORDER BY p.period_start`
  );
  for (const row of summary) {
    console.log(`  ${row.name} - ${row.status}, ${row.payslips} payslips, net ${row.net}`);
  }
}

seedAdmin()
  .then(seedDemoData)
  .then(seedPayroll)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
