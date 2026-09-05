const pool = require('../../db/pool');
const usersService = require('./users.service');

const SELECT_BASE = `
  SELECT e.*,
         jp.title AS job_position_title,
         m.full_name AS manager_name,
         ws.name AS working_schedule_name,
         u.id AS account_id,
         u.roles::text[] AS account_roles,
         u.is_active AS account_is_active
    FROM employees e
    LEFT JOIN job_positions jp ON jp.id = e.job_position_id
    LEFT JOIN employees m ON m.id = e.manager_id
    LEFT JOIN working_schedules ws ON ws.id = e.working_schedule_id
    LEFT JOIN users u ON u.employee_id = e.id
`;

function mapEmployee(row) {
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
    hasAccount: row.account_id !== null,
    // The password itself is a one-way bcrypt hash and is never returned.
    account: row.account_id
      ? { id: row.account_id, roles: row.account_roles, isActive: row.account_is_active }
      : null,
    createdAt: row.created_at,
  };
}

const COLUMN_MAP = {
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

async function list({ search, department, status } = {}) {
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
  return rows.map(mapEmployee);
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE e.id = $1`, [id]);
  return rows[0] ? mapEmployee(rows[0]) : null;
}

async function insertEmployee(data, client) {
  const { rows } = await client.query(
    `INSERT INTO employees
       (full_name, email, phone, department, job_position_id, manager_id,
        working_schedule_id, employee_type, status, date_joined)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      data.fullName,
      data.email,
      data.phone || null,
      data.department,
      data.jobPositionId || null,
      data.managerId || null,
      data.workingScheduleId || null,
      data.employeeType,
      data.status,
      data.dateJoined,
    ]
  );
  return rows[0].id;
}

// Creating the employee and their login account together has to be atomic,
// otherwise a failed account insert leaves an employee nobody can sign in as.
async function create(employeeData, accountData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const employeeId = await insertEmployee(employeeData, client);

    if (accountData) {
      await usersService.create(
        {
          employeeId,
          email: employeeData.email,
          password: accountData.password,
          roles: accountData.roles,
          isActive: accountData.isActive,
        },
        client
      );
    }

    await client.query('COMMIT');
    return findById(employeeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function update(id, employeeData, accountData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(COLUMN_MAP)) {
      if (employeeData[key] !== undefined) {
        params.push(employeeData[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }

    if (sets.length > 0) {
      sets.push('updated_at = now()');
      params.push(id);
      const { rows } = await client.query(
        `UPDATE employees SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
        params
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    }

    if (accountData) {
      const { rows: existing } = await client.query(
        'SELECT id, email FROM users WHERE employee_id = $1',
        [id]
      );

      if (existing.length > 0) {
        await usersService.update(existing[0].id, accountData, client);
      } else {
        const { rows: employeeRows } = await client.query(
          'SELECT email FROM employees WHERE id = $1',
          [id]
        );
        if (employeeRows.length === 0) {
          await client.query('ROLLBACK');
          return null;
        }
        await usersService.create(
          {
            employeeId: id,
            email: employeeRows[0].email,
            password: accountData.password,
            roles: accountData.roles,
            isActive: accountData.isActive,
          },
          client
        );
      }
    }

    await client.query('COMMIT');
    return findById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { list, findById, create, update };
