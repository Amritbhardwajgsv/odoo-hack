const pool = require('../../db/pool');

// Shared WHERE fragment: every dashboard query is scoped by the same three
// filters (Period = one payrun, Department, Employee Type), applied against
// whichever table the query is built from. `employeeAlias` and
// `payrunAlias` let the same builder serve queries that do or don't join
// both tables.
function buildFilters({ department, employeeType, payrunId }, { employeeAlias, payrunAlias }) {
  const conditions = [];
  const params = [];

  if (department && employeeAlias) {
    params.push(department);
    conditions.push(`${employeeAlias}.department = $${params.length}`);
  }
  if (employeeType && employeeAlias) {
    params.push(employeeType);
    conditions.push(`${employeeAlias}.employee_type = $${params.length}`);
  }
  if (payrunId && payrunAlias) {
    params.push(payrunId);
    conditions.push(`${payrunAlias}.id = $${params.length}`);
  }

  return { where: conditions.length ? `AND ${conditions.join(' AND ')}` : '', params };
}

// Gross/net/count for the payslips in scope. With no period selected this
// aggregates every payslip ever produced, which is the sensible "all time"
// default rather than an empty dashboard.
async function salaryTotals(filters) {
  const { where, params } = buildFilters(filters, { employeeAlias: 'e', payrunAlias: 'p' });
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(ps.gross_amount), 0) AS gross,
            COALESCE(SUM(ps.net_amount), 0)   AS net,
            COUNT(*)::int                      AS payslip_count,
            COUNT(DISTINCT ps.employee_id)::int AS employee_count
       FROM payslips ps
       JOIN employees e ON e.id = ps.employee_id
       JOIN payruns p   ON p.id = ps.payrun_id
      WHERE true ${where}`,
    params
  );
  const row = rows[0];
  return {
    gross: Number(row.gross),
    net: Number(row.net),
    payslipCount: row.payslip_count,
    employeeCount: row.employee_count,
  };
}

async function payslipStatusBreakdown(filters) {
  const { where, params } = buildFilters(filters, { employeeAlias: 'e', payrunAlias: 'p' });
  const { rows } = await pool.query(
    `SELECT ps.status, COUNT(*)::int AS count
       FROM payslips ps
       JOIN employees e ON e.id = ps.employee_id
       JOIN payruns p   ON p.id = ps.payrun_id
      WHERE true ${where}
      GROUP BY ps.status`,
    params
  );
  return rows.map((row) => ({ status: row.status, count: row.count }));
}

// Department filter is deliberately excluded here - the point of this
// breakdown is to compare departments against each other, so selecting one
// department would collapse the table to a single row.
async function salaryByDepartment({ employeeType, payrunId }) {
  const { where, params } = buildFilters(
    { employeeType, payrunId },
    { employeeAlias: 'e', payrunAlias: 'p' }
  );
  const { rows } = await pool.query(
    `SELECT e.department,
            COALESCE(SUM(ps.gross_amount), 0) AS gross,
            COALESCE(SUM(ps.net_amount), 0)   AS net,
            COUNT(DISTINCT ps.employee_id)::int AS headcount
       FROM payslips ps
       JOIN employees e ON e.id = ps.employee_id
       JOIN payruns p   ON p.id = ps.payrun_id
      WHERE true ${where}
      GROUP BY e.department
      ORDER BY gross DESC`,
    params
  );
  return rows.map((row) => ({
    department: row.department,
    gross: Number(row.gross),
    net: Number(row.net),
    headcount: row.headcount,
  }));
}

// Trend needs several periods to mean anything, so it always spans the
// last 6 payruns regardless of which single period is selected - only
// department/employee type narrow it.
async function salaryTrend({ department, employeeType }) {
  const { where, params } = buildFilters(
    { department, employeeType },
    { employeeAlias: 'e', payrunAlias: null }
  );
  params.push(6);
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.period_start, p.status,
            COALESCE(SUM(ps.gross_amount), 0) AS gross,
            COALESCE(SUM(ps.net_amount), 0)   AS net
       FROM payruns p
       LEFT JOIN payslips ps  ON ps.payrun_id = p.id
       LEFT JOIN employees e ON e.id = ps.employee_id
      WHERE true ${where}
      GROUP BY p.id, p.name, p.period_start, p.status
      ORDER BY p.period_start DESC
      LIMIT $${params.length}`,
    params
  );
  return rows
    .map((row) => ({
      payrunId: row.id,
      payrunName: row.name,
      periodStart: row.period_start,
      status: row.status,
      gross: Number(row.gross),
      net: Number(row.net),
    }))
    .reverse();
}

// Attendance is scoped to the selected payrun's own period when one is
// picked (matching what payroll actually paid for); otherwise the trailing
// 30 days, which is the same "recent activity" window the rest of the app
// uses when there is no explicit period.
async function attendanceOverview({ department, employeeType, payrunId }) {
  const params = [];
  let periodClause;
  if (payrunId) {
    params.push(payrunId);
    periodClause = `a.attendance_date BETWEEN (SELECT period_start FROM payruns WHERE id = $${params.length})
                                           AND (SELECT period_end   FROM payruns WHERE id = $${params.length})`;
  } else {
    periodClause = `a.attendance_date >= CURRENT_DATE - INTERVAL '30 days'`;
  }

  const conditions = [periodClause];
  if (department) {
    params.push(department);
    conditions.push(`e.department = $${params.length}`);
  }
  if (employeeType) {
    params.push(employeeType);
    conditions.push(`e.employee_type = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT a.status, COUNT(*)::int AS count
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY a.status`,
    params
  );

  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.count]));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    present: byStatus.present || 0,
    late: byStatus.late || 0,
    absent: byStatus.absent || 0,
    onLeave: byStatus.on_leave || 0,
    exception: byStatus.exception || 0,
    total,
  };
}

// Same period logic as attendance: the selected payrun's own dates, or a
// trailing 30-day window when no period is selected.
async function timeOffOverview({ department, employeeType, payrunId }) {
  const params = [];
  let periodClause;
  if (payrunId) {
    params.push(payrunId);
    periodClause = `r.date_from <= (SELECT period_end FROM payruns WHERE id = $${params.length})
                 AND r.date_to   >= (SELECT period_start FROM payruns WHERE id = $${params.length})`;
  } else {
    periodClause = `r.date_to >= CURRENT_DATE - INTERVAL '30 days'`;
  }

  const conditions = [periodClause];
  if (department) {
    params.push(department);
    conditions.push(`e.department = $${params.length}`);
  }
  if (employeeType) {
    params.push(employeeType);
    conditions.push(`e.employee_type = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT r.status, COUNT(*)::int AS count
       FROM time_off_requests r
       JOIN employees e ON e.id = r.employee_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY r.status`,
    params
  );
  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.count]));

  // Remaining balance is a point-in-time fact (today), not scoped to a
  // payroll period - it answers "what could still be taken", not history.
  const balanceConditions = [`a.status = 'approved'`, `a.valid_from <= CURRENT_DATE`, `(a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)`];
  const balanceParams = [];
  if (department) {
    balanceParams.push(department);
    balanceConditions.push(`e.department = $${balanceParams.length}`);
  }
  if (employeeType) {
    balanceParams.push(employeeType);
    balanceConditions.push(`e.employee_type = $${balanceParams.length}`);
  }
  const { rows: balanceRows } = await pool.query(
    `SELECT COALESCE(SUM(a.allocated_amount - a.taken_amount), 0) AS remaining
       FROM time_off_allocations a
       JOIN employees e ON e.id = a.employee_id
      WHERE ${balanceConditions.join(' AND ')}`,
    balanceParams
  );

  return {
    pending: byStatus.submitted || 0,
    approved: byStatus.approved || 0,
    refused: byStatus.refused || 0,
    allocatedRemaining: Number(balanceRows[0].remaining),
  };
}

// Blocking warnings are what stop a payrun from validating; advisory ones
// are worth a look. Listing the messages (not just counts) is what makes
// "Payroll warnings or items requiring attention" actually actionable from
// the dashboard instead of just a number with nowhere to click.
async function payrollWarnings(filters) {
  const { where, params } = buildFilters(filters, { employeeAlias: 'e', payrunAlias: 'p' });
  const { rows } = await pool.query(
    `SELECT w.severity, w.message, e.full_name, p.name AS payrun_name, ps.id AS payslip_id
       FROM payslip_warnings w
       JOIN payslips ps  ON ps.id = w.payslip_id
       JOIN employees e  ON e.id = ps.employee_id
       JOIN payruns p    ON p.id = ps.payrun_id
      WHERE w.is_resolved = false ${where}
      ORDER BY (w.severity = 'blocking') DESC, w.created_at DESC
      LIMIT 10`,
    params
  );
  const counts = await pool.query(
    `SELECT w.severity, COUNT(*)::int AS count
       FROM payslip_warnings w
       JOIN payslips ps  ON ps.id = w.payslip_id
       JOIN employees e  ON e.id = ps.employee_id
       JOIN payruns p    ON p.id = ps.payrun_id
      WHERE w.is_resolved = false ${where}
      GROUP BY w.severity`,
    params
  );
  const byStatus = Object.fromEntries(counts.rows.map((row) => [row.severity, row.count]));

  return {
    blocking: byStatus.blocking || 0,
    advisory: byStatus.advisory || 0,
    items: rows.map((row) => ({
      severity: row.severity,
      message: row.message,
      employeeName: row.full_name,
      payrunName: row.payrun_name,
      payslipId: row.payslip_id,
    })),
  };
}

async function filterOptions() {
  const [payruns, employeeTypes] = await Promise.all([
    pool.query(
      `SELECT id, name, period_start, period_end, status
         FROM payruns ORDER BY period_start DESC`
    ),
    pool.query(`SELECT DISTINCT employee_type FROM employees ORDER BY employee_type`),
  ]);
  return {
    payruns: payruns.rows.map((row) => ({
      id: row.id,
      name: row.name,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
    })),
    employeeTypes: employeeTypes.rows.map((row) => row.employee_type),
  };
}

// One call assembles the whole dashboard so the page loads with a single
// request rather than six round trips.
async function getDashboard({ department, employeeType, payrunId } = {}) {
  const filters = { department: department || null, employeeType: employeeType || null, payrunId: payrunId || null };

  const [totals, statusBreakdown, byDepartment, trend, attendance, timeOff, warnings, options] =
    await Promise.all([
      salaryTotals(filters),
      payslipStatusBreakdown(filters),
      salaryByDepartment(filters),
      salaryTrend(filters),
      attendanceOverview(filters),
      timeOffOverview(filters),
      payrollWarnings(filters),
      filterOptions(),
    ]);

  return {
    filters: { department: filters.department, employeeType: filters.employeeType, payrunId: filters.payrunId },
    options,
    salaryTotals: totals,
    payslipStatus: statusBreakdown,
    salaryByDepartment: byDepartment,
    salaryTrend: trend,
    attendance,
    timeOff,
    warnings,
  };
}

module.exports = { getDashboard };
