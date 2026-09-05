const { Router } = require('express');
const { z } = require('zod');

const pool = require('../../db/pool');

const router = Router();

const DEPARTMENTS = [
  'engineering',
  'sales',
  'hr',
  'finance',
  'marketing',
  'operations',
  'customer_support',
  'admin',
];
const STATUSES = ['active', 'terminated'];

const employeeSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  department: z.enum(DEPARTMENTS),
  jobPositionId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  workingScheduleId: z.string().uuid().optional().nullable(),
  employeeType: z.string().min(1).optional().default('full_time'),
  status: z.enum(STATUSES).optional().default('active'),
  dateJoined: z.string().min(1),
});

const updateEmployeeSchema = employeeSchema.partial();

function serialize(row) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    department: row.department,
    jobPositionId: row.job_position_id,
    jobPositionTitle: row.job_position_title,
    managerId: row.manager_id,
    managerName: row.manager_name,
    workingScheduleId: row.working_schedule_id,
    workingScheduleName: row.working_schedule_name,
    employeeType: row.employee_type,
    status: row.status,
    dateJoined: row.date_joined,
    hasAccount: row.has_account,
    createdAt: row.created_at,
  };
}

const SELECT_BASE = `
  SELECT e.*,
         jp.title AS job_position_title,
         m.full_name AS manager_name,
         ws.name AS working_schedule_name,
         (u.id IS NOT NULL) AS has_account
    FROM employees e
    LEFT JOIN job_positions jp ON jp.id = e.job_position_id
    LEFT JOIN employees m ON m.id = e.manager_id
    LEFT JOIN working_schedules ws ON ws.id = e.working_schedule_id
    LEFT JOIN users u ON u.employee_id = e.id
`;

router.get('/', async (request, response) => {
  const { search, department, status } = request.query;
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.full_name ILIKE $${params.length} OR e.email ILIKE $${params.length})`);
  }
  if (department) {
    params.push(department);
    conditions.push(`e.department = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`${SELECT_BASE} ${where} ORDER BY e.full_name`, params);
  response.json(rows.map(serialize));
});

router.get('/:id', async (request, response) => {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE e.id = $1`, [request.params.id]);
  if (rows.length === 0) return response.status(404).json({ message: 'Employee not found' });
  response.json(serialize(rows[0]));
});

router.post('/', async (request, response) => {
  const parsed = employeeSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  const d = parsed.data;

  try {
    const { rows } = await pool.query(
      `INSERT INTO employees
         (full_name, email, phone, department, job_position_id, manager_id,
          working_schedule_id, employee_type, status, date_joined)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        d.fullName,
        d.email,
        d.phone || null,
        d.department,
        d.jobPositionId || null,
        d.managerId || null,
        d.workingScheduleId || null,
        d.employeeType,
        d.status,
        d.dateJoined,
      ]
    );
    const { rows: full } = await pool.query(`${SELECT_BASE} WHERE e.id = $1`, [rows[0].id]);
    response.status(201).json(serialize(full[0]));
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({ message: 'An employee with that email already exists' });
    }
    throw error;
  }
});

router.patch('/:id', async (request, response) => {
  const parsed = updateEmployeeSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  const fieldMap = {
    fullName: 'full_name',
    email: 'email',
    phone: 'phone',
    department: 'department',
    jobPositionId: 'job_position_id',
    managerId: 'manager_id',
    workingScheduleId: 'working_schedule_id',
    employeeType: 'employee_type',
    status: 'status',
    dateJoined: 'date_joined',
  };

  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(fieldMap)) {
    if (parsed.data[key] !== undefined) {
      params.push(parsed.data[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }

  if (sets.length === 0) {
    return response.status(400).json({ message: 'No fields to update' });
  }
  sets.push('updated_at = now()');

  params.push(request.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE employees SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
      params
    );
    if (rows.length === 0) return response.status(404).json({ message: 'Employee not found' });

    const { rows: full } = await pool.query(`${SELECT_BASE} WHERE e.id = $1`, [rows[0].id]);
    response.json(serialize(full[0]));
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({ message: 'An employee with that email already exists' });
    }
    throw error;
  }
});

module.exports = router;
