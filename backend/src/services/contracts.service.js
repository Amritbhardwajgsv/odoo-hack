const pool = require('../../db/pool');

const SELECT_BASE = `
  SELECT c.*,
         e.full_name  AS employee_name,
         jp.title     AS job_position_title,
         ws.name      AS working_schedule_name,
         ws.total_weekly_hours AS working_schedule_hours,
         ss.name      AS salary_structure_name
    FROM contracts c
    JOIN employees e ON e.id = c.employee_id
    LEFT JOIN job_positions jp ON jp.id = c.job_position_id
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    LEFT JOIN salary_structures ss ON ss.id = c.salary_structure_id
`;

function mapContract(row) {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    jobPositionId: row.job_position_id,
    jobPositionTitle: row.job_position_title,
    workingScheduleId: row.working_schedule_id,
    workingScheduleName: row.working_schedule_name,
    workingScheduleHours: row.working_schedule_hours ? Number(row.working_schedule_hours) : null,
    salaryStructureId: row.salary_structure_id,
    salaryStructureName: row.salary_structure_name,
    wage: Number(row.wage),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const COLUMN_MAP = {
  employeeId: 'employee_id',
  department: 'department',
  jobPositionId: 'job_position_id',
  workingScheduleId: 'working_schedule_id',
  salaryStructureId: 'salary_structure_id',
  wage: 'wage',
  startDate: 'start_date',
  endDate: 'end_date',
  status: 'status',
  notes: 'notes',
};

async function list({ search, status, employeeId } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(c.contract_number ILIKE $${params.length} OR e.full_name ILIKE $${params.length})`
    );
  }
  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }
  if (employeeId) {
    params.push(employeeId);
    conditions.push(`c.employee_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  // Running contracts first, then most recent history - payroll cares about
  // the active one, so it should never be buried.
  const { rows } = await pool.query(
    `${SELECT_BASE} ${where}
     ORDER BY (c.status = 'active') DESC, c.start_date DESC`,
    params
  );
  return rows.map(mapContract);
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE c.id = $1`, [id]);
  return rows[0] ? mapContract(rows[0]) : null;
}

async function create(data) {
  const columns = [];
  const values = [];

  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (data[key] !== undefined) {
      columns.push(column);
      values.push(data[key] === '' ? null : data[key]);
    }
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO contracts (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    values
  );
  return findById(rows[0].id);
}

async function update(id, data) {
  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (data[key] !== undefined) {
      params.push(data[key] === '' ? null : data[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return findById(id);

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE contracts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
    params
  );
  return rows[0] ? findById(rows[0].id) : null;
}

module.exports = { list, findById, create, update };
