const pool = require('../../db/pool');

async function listJobPositions() {
  const { rows } = await pool.query(
    'SELECT id, title, department FROM job_positions ORDER BY title'
  );
  return rows.map((row) => ({ id: row.id, title: row.title, department: row.department }));
}

async function listWorkingSchedules() {
  const { rows } = await pool.query(
    'SELECT id, name, type, total_weekly_hours FROM working_schedules ORDER BY name'
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    totalWeeklyHours: Number(row.total_weekly_hours),
  }));
}

module.exports = { listJobPositions, listWorkingSchedules };
