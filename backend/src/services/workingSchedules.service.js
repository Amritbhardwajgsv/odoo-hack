const pool = require('../../db/pool');

// day_of_week: 0 = Monday ... 6 = Sunday.
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Hours are always derived from the pattern rather than typed in, so the
// total on the list can never drift from the days below it.
const LINE_HOURS_SQL = `
  (EXTRACT(EPOCH FROM (l.end_time - l.start_time)) / 3600.0) - (l.break_minutes / 60.0)
`;

function mapSchedule(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    company: row.company,
    timezone: row.timezone,
    isActive: row.is_active,
    daysPerWeek: Number(row.days_per_week ?? 0),
    totalWeeklyHours: Number(row.total_weekly_hours ?? 0),
    createdAt: row.created_at,
  };
}

function mapLine(row) {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    dayName: DAY_NAMES[row.day_of_week],
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    breakMinutes: row.break_minutes,
    hours: Number(row.hours),
  };
}

const SELECT_BASE = `
  SELECT ws.*,
         COALESCE(agg.days_per_week, 0) AS days_per_week
    FROM working_schedules ws
    LEFT JOIN (
      SELECT l.schedule_id, count(*)::int AS days_per_week
        FROM working_schedule_lines l
       GROUP BY l.schedule_id
    ) agg ON agg.schedule_id = ws.id
`;

async function list({ search, isActive } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(ws.name ILIKE $${params.length} OR ws.company ILIKE $${params.length})`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    conditions.push(`ws.is_active = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`${SELECT_BASE} ${where} ORDER BY ws.name`, params);
  return rows.map(mapSchedule);
}

async function listLines(scheduleId, client = pool) {
  const { rows } = await client.query(
    `SELECT l.*, ${LINE_HOURS_SQL} AS hours
       FROM working_schedule_lines l
      WHERE l.schedule_id = $1
      ORDER BY l.day_of_week`,
    [scheduleId]
  );
  return rows.map(mapLine);
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE ws.id = $1`, [id]);
  if (!rows[0]) return null;
  return { ...mapSchedule(rows[0]), lines: await listLines(id) };
}

// total_weekly_hours is a stored summary of the lines, refreshed whenever
// the pattern changes so the list view never shows a stale figure.
async function recalculateTotal(scheduleId, client) {
  await client.query(
    `UPDATE working_schedules
        SET total_weekly_hours = COALESCE((
              SELECT SUM(${LINE_HOURS_SQL})
                FROM working_schedule_lines l
               WHERE l.schedule_id = $1
            ), 0)
      WHERE id = $1`,
    [scheduleId]
  );
}

async function create({ name, type, company, timezone, isActive, lines }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO working_schedules (name, type, company, timezone, is_active, total_weekly_hours)
       VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
      [name, type || 'fixed', company || null, timezone || 'Asia/Kolkata', isActive ?? true]
    );
    const id = rows[0].id;

    if (lines?.length) await insertLines(id, lines, client);
    await recalculateTotal(id, client);
    await client.query('COMMIT');
    return findById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertLines(scheduleId, lines, client) {
  for (const line of lines) {
    await client.query(
      `INSERT INTO working_schedule_lines (schedule_id, day_of_week, start_time, end_time, break_minutes)
       VALUES ($1, $2, $3, $4, $5)`,
      [scheduleId, line.dayOfWeek, line.startTime, line.endTime, line.breakMinutes ?? 0]
    );
  }
}

// The form edits the week as a whole, so the pattern is replaced in one
// transaction rather than diffed row by row.
async function update(id, { name, type, company, timezone, isActive, lines }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sets = [];
    const params = [];
    const assign = (column, value) => {
      if (value !== undefined) {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      }
    };
    assign('name', name);
    assign('type', type);
    assign('company', company);
    assign('timezone', timezone);
    assign('is_active', isActive);

    if (sets.length > 0) {
      params.push(id);
      const { rows } = await client.query(
        `UPDATE working_schedules SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
        params
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    } else {
      const { rows } = await client.query('SELECT id FROM working_schedules WHERE id = $1', [id]);
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    }

    if (lines !== undefined) {
      await client.query('DELETE FROM working_schedule_lines WHERE schedule_id = $1', [id]);
      if (lines.length) await insertLines(id, lines, client);
    }

    await recalculateTotal(id, client);
    await client.query('COMMIT');
    return findById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function remove(id) {
  // Employees and contracts point at schedules with ON DELETE SET NULL, so
  // removing one clears the reference rather than failing.
  const { rowCount } = await pool.query('DELETE FROM working_schedules WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { list, findById, create, update, remove, DAY_NAMES };
