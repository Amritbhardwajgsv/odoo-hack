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
    workLocation: row.work_location,
    company: row.company,
    personalEmail: row.personal_email,
    personalPhone: row.personal_phone,
    address: row.address,
    dateOfBirth: row.date_of_birth,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    bankAccount: row.bank_account,
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
  workLocation: 'work_location',
  company: 'company',
  personalEmail: 'personal_email',
  personalPhone: 'personal_phone',
  address: 'address',
  dateOfBirth: 'date_of_birth',
  emergencyContactName: 'emergency_contact_name',
  emergencyContactPhone: 'emergency_contact_phone',
  bankAccount: 'bank_account',
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

// Counts behind the employee form's smart buttons.
async function relatedCounts(id) {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM contracts         WHERE employee_id = $1)::int AS contracts,
            (SELECT count(*) FROM attendance        WHERE employee_id = $1)::int AS attendance,
            (SELECT count(*) FROM time_off_requests WHERE employee_id = $1)::int AS time_off,
            (SELECT count(*) FROM time_off_allocations WHERE employee_id = $1)::int AS allocations`,
    [id]
  );
  return {
    contracts: rows[0].contracts,
    attendance: rows[0].attendance,
    timeOff: rows[0].time_off,
    allocations: rows[0].allocations,
  };
}

async function findByIdWithCounts(id) {
  const employee = await findById(id);
  if (!employee) return null;
  return { ...employee, counts: await relatedCounts(id) };
}

// Driven by COLUMN_MAP so adding a form field in one place is enough.
async function insertEmployee(data, client) {
  const columns = [];
  const values = [];

  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (data[key] !== undefined) {
      columns.push(column);
      values.push(data[key] === '' ? null : data[key]);
    }
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const { rows } = await client.query(
    `INSERT INTO employees (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    values
  );
  return rows[0].id;
}

// Creating the employee and their login account together has to be atomic,
// otherwise a failed account insert leaves an employee nobody can sye sign in as.
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

module.exports = { list, findById, findByIdWithCounts, create, update };
