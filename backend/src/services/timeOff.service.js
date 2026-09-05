const pool = require('../../db/pool');

const REQUEST_SELECT = `
  SELECT r.*,
         e.full_name  AS employee_name,
         e.manager_id AS employee_manager_id,
         t.name       AS type_name,
         t.unit       AS type_unit,
         t.requires_allocation,
         t.requires_approval,
         approver_emp.full_name AS approver_name,
         alloc.valid_from        AS allocation_valid_from,
         alloc_type.name         AS allocation_type_name,
         alloc.allocated_amount  AS allocation_allocated,
         alloc.taken_amount      AS allocation_taken
    FROM time_off_requests r
    JOIN employees e        ON e.id = r.employee_id
    JOIN time_off_types t   ON t.id = r.time_off_type_id
    LEFT JOIN users approver          ON approver.id = r.approved_by
    LEFT JOIN employees approver_emp  ON approver_emp.id = approver.employee_id
    LEFT JOIN time_off_allocations alloc ON alloc.id = r.allocation_id
    LEFT JOIN time_off_types alloc_type  ON alloc_type.id = alloc.time_off_type_id
`;

function mapRequest(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    timeOffTypeId: row.time_off_type_id,
    typeName: row.type_name,
    typeUnit: row.type_unit,
    requiresAllocation: row.requires_allocation,
    requiresApproval: row.requires_approval,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    duration: Number(row.duration),
    status: row.status,
    reason: row.reason,
    approverName: row.approver_name,
    approvedAt: row.approved_at,
    allocationId: row.allocation_id,
    // "Paid Time Off 2026" - the balance the approval actually drew from.
    allocationLabel: row.allocation_id
      ? `${row.allocation_type_name} ${new Date(row.allocation_valid_from).getFullYear()}`
      : null,
    allocationRemaining:
      row.allocation_id === null
        ? null
        : Number(row.allocation_allocated) - Number(row.allocation_taken),
    createdAt: row.created_at,
  };
}

// Duration is derived from the dates rather than trusted from the client,
// so what is shown can never disagree with what is deducted.
function durationBetween(dateFrom, dateTo) {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : 0;
}

async function listRequests({ search, status, employeeId, managerEmployeeId } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.full_name ILIKE $${params.length} OR t.name ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (employeeId) {
    params.push(employeeId);
    conditions.push(`r.employee_id = $${params.length}`);
  }
  // "My Team": requests raised by people who report to the viewer.
  if (managerEmployeeId) {
    params.push(managerEmployeeId);
    conditions.push(`e.manager_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `${REQUEST_SELECT} ${where}
      ORDER BY (r.status = 'submitted') DESC, r.date_from DESC`,
    params
  );
  return rows.map(mapRequest);
}

async function findRequestById(id, client = pool) {
  const { rows } = await client.query(`${REQUEST_SELECT} WHERE r.id = $1`, [id]);
  return rows[0] ? mapRequest(rows[0]) : null;
}

async function createRequest({ employeeId, timeOffTypeId, dateFrom, dateTo, reason, status }) {
  const duration = durationBetween(dateFrom, dateTo);
  const { rows } = await pool.query(
    `INSERT INTO time_off_requests
       (employee_id, time_off_type_id, date_from, date_to, duration, status, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [employeeId, timeOffTypeId, dateFrom, dateTo, duration, status || 'submitted', reason || null]
  );
  return findRequestById(rows[0].id);
}

async function updateRequest(id, { timeOffTypeId, dateFrom, dateTo, reason }) {
  const existing = await findRequestById(id);
  if (!existing) return null;

  const nextFrom = dateFrom ?? existing.dateFrom;
  const nextTo = dateTo ?? existing.dateTo;

  const { rows } = await pool.query(
    `UPDATE time_off_requests
        SET time_off_type_id = COALESCE($1, time_off_type_id),
            date_from = $2,
            date_to = $3,
            duration = $4,
            reason = COALESCE($5, reason)
      WHERE id = $6
      RETURNING id`,
    [timeOffTypeId ?? null, nextFrom, nextTo, durationBetween(nextFrom, nextTo), reason ?? null, id]
  );
  return rows[0] ? findRequestById(id) : null;
}

// Approving consumes balance, so it runs in one transaction with the request
// row locked. The status guard makes a second approval a no-op rather than a
// second deduction.
async function approveRequest(id, approverUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: locked } = await client.query(
      'SELECT * FROM time_off_requests WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (locked.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'not_found' };
    }
    if (locked[0].status === 'approved') {
      await client.query('ROLLBACK');
      return { error: 'already_approved' };
    }

    const request = locked[0];
    const { rows: typeRows } = await client.query(
      'SELECT * FROM time_off_types WHERE id = $1',
      [request.time_off_type_id]
    );
    const type = typeRows[0];

    let allocationId = null;

    if (type.requires_allocation) {
      // Pick an approved allocation that covers the dates and still has
      // enough left, oldest first so balances expire in order.
      const { rows: allocations } = await client.query(
        `SELECT id, allocated_amount - taken_amount AS remaining
           FROM time_off_allocations
          WHERE employee_id = $1
            AND time_off_type_id = $2
            AND status = 'approved'
            AND valid_from <= $3
            AND (valid_to IS NULL OR valid_to >= $4)
          ORDER BY valid_from
          FOR UPDATE`,
        [request.employee_id, request.time_off_type_id, request.date_from, request.date_to]
      );

      const usable = allocations.find((a) => Number(a.remaining) >= Number(request.duration));
      if (!usable) {
        await client.query('ROLLBACK');
        const available = allocations.reduce((sum, a) => sum + Number(a.remaining), 0);
        return {
          error: 'insufficient_allocation',
          needed: Number(request.duration),
          available: allocations.length ? available : 0,
          hasAllocation: allocations.length > 0,
        };
      }

      await client.query(
        'UPDATE time_off_allocations SET taken_amount = taken_amount + $1 WHERE id = $2',
        [request.duration, usable.id]
      );
      allocationId = usable.id;
    }

    await client.query(
      `UPDATE time_off_requests
          SET status = 'approved', approved_by = $1, approved_at = now(), allocation_id = $2
        WHERE id = $3`,
      [approverUserId, allocationId, id]
    );

    await client.query('COMMIT');
    return { request: await findRequestById(id) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Refusing an already-approved request returns the balance it consumed.
async function refuseRequest(id, approverUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: locked } = await client.query(
      'SELECT * FROM time_off_requests WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (locked.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'not_found' };
    }

    const request = locked[0];
    if (request.status === 'approved' && request.allocation_id) {
      await client.query(
        'UPDATE time_off_allocations SET taken_amount = GREATEST(taken_amount - $1, 0) WHERE id = $2',
        [request.duration, request.allocation_id]
      );
    }

    await client.query(
      `UPDATE time_off_requests
          SET status = 'refused', approved_by = $1, approved_at = now(), allocation_id = NULL
        WHERE id = $2`,
      [approverUserId, id]
    );

    await client.query('COMMIT');
    return { request: await findRequestById(id) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function mapType(row) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    requiresAllocation: row.requires_allocation,
    requiresApproval: row.requires_approval,
    affectsPayroll: row.affects_payroll,
    approvalBy: row.approval_by,
    displayColor: row.display_color,
    isActive: row.is_active,
    workEntry: row.work_entry,
    notes: row.notes,
  };
}

async function listTypes({ search } = {}) {
  const params = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE name ILIKE $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM time_off_types ${where} ORDER BY name`,
    params
  );
  return rows.map(mapType);
}

async function findTypeById(id) {
  const { rows } = await pool.query('SELECT * FROM time_off_types WHERE id = $1', [id]);
  return rows[0] ? mapType(rows[0]) : null;
}

const TYPE_COLUMNS = {
  name: 'name',
  unit: 'unit',
  requiresAllocation: 'requires_allocation',
  requiresApproval: 'requires_approval',
  affectsPayroll: 'affects_payroll',
  approvalBy: 'approval_by',
  displayColor: 'display_color',
  isActive: 'is_active',
  workEntry: 'work_entry',
  notes: 'notes',
};

async function createType(data) {
  const columns = [];
  const values = [];
  for (const [key, column] of Object.entries(TYPE_COLUMNS)) {
    if (data[key] !== undefined) {
      columns.push(column);
      values.push(data[key] === '' ? null : data[key]);
    }
  }
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO time_off_types (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    values
  );
  return findTypeById(rows[0].id);
}

async function updateType(id, data) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(TYPE_COLUMNS)) {
    if (data[key] !== undefined) {
      params.push(data[key] === '' ? null : data[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return findTypeById(id);

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE time_off_types SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
    params
  );
  return rows[0] ? findTypeById(id) : null;
}

const ALLOCATION_SELECT = `
  SELECT a.*, e.full_name AS employee_name, t.name AS type_name, t.unit,
         approver_emp.full_name AS approver_name
    FROM time_off_allocations a
    JOIN employees e ON e.id = a.employee_id
    JOIN time_off_types t ON t.id = a.time_off_type_id
    LEFT JOIN users approver ON approver.id = a.approved_by
    LEFT JOIN employees approver_emp ON approver_emp.id = approver.employee_id
`;

function mapAllocation(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    timeOffTypeId: row.time_off_type_id,
    typeName: row.type_name,
    unit: row.unit,
    allocated: Number(row.allocated_amount),
    taken: Number(row.taken_amount),
    // remaining_amount is a generated column, so the arithmetic is the
    // database's, not something the app can get out of step with.
    remaining: Number(row.remaining_amount),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    // "2026 Annual Balance"
    validityLabel: row.valid_from
      ? `${new Date(row.valid_from).getFullYear()} Annual Balance`
      : null,
    status: row.status,
    approverName: row.approver_name,
    approvedAt: row.approved_at,
    description: row.description,
  };
}

async function listAllocations({ employeeId, search, status } = {}) {
  const conditions = [];
  const params = [];

  if (employeeId) {
    params.push(employeeId);
    conditions.push(`a.employee_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.full_name ILIKE $${params.length} OR t.name ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `${ALLOCATION_SELECT} ${where}
      ORDER BY (a.status = 'draft') DESC, e.full_name, t.name`,
    params
  );
  return rows.map(mapAllocation);
}

async function findAllocationById(id) {
  const { rows } = await pool.query(`${ALLOCATION_SELECT} WHERE a.id = $1`, [id]);
  return rows[0] ? mapAllocation(rows[0]) : null;
}

async function createAllocation(data) {
  const { rows } = await pool.query(
    `INSERT INTO time_off_allocations
       (employee_id, time_off_type_id, allocated_amount, taken_amount,
        valid_from, valid_to, status, description)
     VALUES ($1, $2, $3, 0, $4, $5, $6, $7) RETURNING id`,
    [
      data.employeeId,
      data.timeOffTypeId,
      data.allocated,
      data.validFrom,
      data.validTo || null,
      data.status || 'draft',
      data.description || null,
    ]
  );
  return findAllocationById(rows[0].id);
}

async function updateAllocation(id, data) {
  const sets = [];
  const params = [];
  const assign = (column, value) => {
    if (value !== undefined) {
      params.push(value === '' ? null : value);
      sets.push(`${column} = $${params.length}`);
    }
  };
  assign('allocated_amount', data.allocated);
  assign('valid_from', data.validFrom);
  assign('valid_to', data.validTo);
  assign('description', data.description);
  if (sets.length === 0) return findAllocationById(id);

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE time_off_allocations SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
    params
  );
  return rows[0] ? findAllocationById(id) : null;
}

// Approving an allocation is what makes the balance usable by requests.
async function decideAllocation(id, status, approverUserId) {
  const { rows: existing } = await pool.query(
    'SELECT taken_amount FROM time_off_allocations WHERE id = $1',
    [id]
  );
  if (existing.length === 0) return { error: 'not_found' };

  // Withdrawing a balance that leave has already been taken from would
  // leave approved requests pointing at days nobody granted.
  if (status !== 'approved' && Number(existing[0].taken_amount) > 0) {
    return { error: 'already_consumed', taken: Number(existing[0].taken_amount) };
  }

  await pool.query(
    `UPDATE time_off_allocations
        SET status = $1, approved_by = $2, approved_at = now()
      WHERE id = $3`,
    [status, approverUserId, id]
  );
  return { allocation: await findAllocationById(id) };
}

module.exports = {
  listRequests,
  findRequestById,
  createRequest,
  updateRequest,
  approveRequest,
  refuseRequest,
  listTypes,
  findTypeById,
  createType,
  updateType,
  listAllocations,
  findAllocationById,
  createAllocation,
  updateAllocation,
  decideAllocation,
  durationBetween,
};
