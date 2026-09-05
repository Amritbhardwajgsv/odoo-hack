const { Router } = require('express');

const pool = require('../../db/pool');

const router = Router();

router.get('/', async (_request, response) => {
  const { rows } = await pool.query(`
    SELECT e.id, e.full_name, e.email, e.department,
           (u.id IS NOT NULL) AS has_account
      FROM employees e
      LEFT JOIN users u ON u.employee_id = e.id
     ORDER BY e.full_name
  `);

  response.json(
    rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      department: row.department,
      hasAccount: row.has_account,
    }))
  );
});

module.exports = router;
