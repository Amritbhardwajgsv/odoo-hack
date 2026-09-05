const pool = require('../../db/pool');

async function listJobPositions() {
  const { rows } = await pool.query(
    'SELECT id, title, department FROM job_positions ORDER BY title'
  );
  return rows.map((row) => ({ id: row.id, title: row.title, department: row.department }));
}

async function listSalaryStructures() {
  const { rows } = await pool.query(
    'SELECT id, name, description, is_active FROM salary_structures WHERE is_active ORDER BY name'
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
  }));
}

// Headline numbers for the workspace landing page.
async function overview() {
  const { rows } = await pool.query(`
    SELECT (SELECT count(*) FROM employees WHERE status = 'active')::int  AS active_employees,
           (SELECT count(*) FROM employees)::int                          AS total_employees,
           (SELECT count(*) FROM contracts WHERE status = 'active')::int   AS running_contracts,
           (SELECT count(*) FROM contracts)::int                           AS total_contracts,
           (SELECT count(*) FROM users WHERE is_active)::int               AS active_accounts,
           (SELECT count(*) FROM employees e
              WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.employee_id = e.id))::int
                                                                           AS employees_without_login,
           (SELECT count(*) FROM employees e
              WHERE NOT EXISTS (SELECT 1 FROM contracts c
                                 WHERE c.employee_id = e.id AND c.status = 'active'))::int
                                                                           AS employees_without_contract,
           (SELECT coalesce(sum(wage), 0) FROM contracts WHERE status = 'active') AS monthly_wage_total
  `);
  const row = rows[0];

  const { rows: departments } = await pool.query(`
    SELECT e.department,
           count(*)::int AS headcount,
           coalesce(sum(c.wage), 0) AS wage_total
      FROM employees e
      LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'active'
     WHERE e.status = 'active'
     GROUP BY e.department
     ORDER BY count(*) DESC
  `);

  return {
    activeEmployees: row.active_employees,
    totalEmployees: row.total_employees,
    runningContracts: row.running_contracts,
    totalContracts: row.total_contracts,
    activeAccounts: row.active_accounts,
    employeesWithoutLogin: row.employees_without_login,
    employeesWithoutContract: row.employees_without_contract,
    monthlyWageTotal: Number(row.monthly_wage_total),
    departments: departments.map((d) => ({
      department: d.department,
      headcount: d.headcount,
      wageTotal: Number(d.wage_total),
    })),
  };
}

module.exports = { listJobPositions, listSalaryStructures, overview };
