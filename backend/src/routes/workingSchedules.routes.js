const { Router } = require('express');

const pool = require('../../db/pool');

const router = Router();

router.get('/', async (_request, response) => {
  const { rows } = await pool.query(
    'SELECT id, name, type, total_weekly_hours FROM working_schedules ORDER BY name'
  );
  response.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      totalWeeklyHours: Number(row.total_weekly_hours),
    }))
  );
});

module.exports = router;
