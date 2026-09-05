const { Router } = require('express');

const pool = require('../../db/pool');

const router = Router();

router.get('/', async (_request, response) => {
  const { rows } = await pool.query(
    'SELECT id, title, department FROM job_positions ORDER BY title'
  );
  response.json(rows.map((row) => ({ id: row.id, title: row.title, department: row.department })));
});

module.exports = router;
