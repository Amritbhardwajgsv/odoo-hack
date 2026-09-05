const pool = require('../../db/pool');

const OVERTIME_THRESHOLD_HOURS = 8;

// The dashboard's Period filter is a calendar month ("Sep 2026"), not a
// specific payrun - it has to keep working for a month nothing has been
// run for yet, and payslip periods don't have to be calendar-aligned. Every
// query below matches rows whose own period *overlaps* this month instead
// of requiring an exact payrun match.
function monthBounds(period) {
  const [year, month] = (period || '').split('-').map(Number);
  if (!year || !month) return null;
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  // day 0 of next month = last day of this one; handles leap years for free.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end, weekdays: countWeekdays(year, month) };
}

function countWeekdays(year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

function shiftMonth(period, delta) {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Falls back to the most recent month that actually has payslips, so a
// fresh install doesn't land on this month (empty) or a newer draft payrun
// nobody has computed yet, and show an empty dashboard by default.
async function defaultPeriod() {
  const { rows } = await pool.query(
    `SELECT p.period_start FROM payruns p
      WHERE EXISTS (SELECT 1 FROM payslips ps WHERE ps.payrun_id = p.id)
      ORDER BY p.period_start DESC LIMIT 1`
  );
  if (rows[0]) {
    const d = new Date(rows[0].period_start);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

// Shared employee-side filters (department / employeeType / company),
// applied through whichever alias the query joined employees under.
function employeeFilters({ department, employeeType, company }, alias, params) {
  const conditions = [];
  if (department) {
    params.push(department);
    conditions.push(`${alias}.department = $${params.length}`);
  }
  if (employeeType) {
    params.push(employeeType);
    conditions.push(`${alias}.employee_type = $${params.length}`);
  }
  if (company) {
    params.push(company);
    conditions.push(`${alias}.company = $${params.length}`);
  }
  return conditions;
}

// -------------------------------------------------------------- headline cards
async function headlineMetrics({ start, end }, filters) {
  const params = [start, end];
  const conditions = [`ps.period_start <= $2`, `ps.period_end >= $1`];
  conditions.push(...employeeFilters(filters, 'e', params));
  const where = conditions.join(' AND ');

  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(ps.net_amount), 0)                          AS net,
            COUNT(*)::int                                             AS payslip_count,
            COUNT(*) FILTER (WHERE ps.status = 'paid')::int           AS paid_count,
            COUNT(DISTINCT ps.employee_id)::int                       AS employee_count
       FROM payslips ps
       JOIN employees e ON e.id = ps.employee_id
      WHERE ${where}`,
    params
  );
  return rows[0];
}

async function totalNetSalaryPaid(period, filters) {
  const current = monthBounds(period);
  const previous = monthBounds(shiftMonth(period, -1));

  const [currentRow, previousRow] = await Promise.all([
    headlineMetrics(current, filters),
    headlineMetrics(previous, filters),
  ]);

  const net = Number(currentRow.net);
  const previousNet = Number(previousRow.net);
  // No prior-month figure to compare against (e.g. the very first payroll
  // period) reads as "no change" rather than a misleading +/-100%.
  const deltaPct = previousNet > 0 ? Math.round(((net - previousNet) / previousNet) * 1000) / 10 : 0;

  return {
    net,
    deltaPct,
    payslipCount: currentRow.payslip_count,
    paidCount: currentRow.paid_count,
    pendingCount: currentRow.payslip_count - currentRow.paid_count,
    employeeCount: currentRow.employee_count,
  };
}

// -------------------------------------------------------- salary by department
// Ignores the Department filter on purpose - selecting one department here
// would leave the comparison chart with a single bar.
async function salaryByDepartment({ start, end }, { employeeType, company }) {
  const params = [start, end];
  const conditions = [`ps.period_start <= $2`, `ps.period_end >= $1`];
  conditions.push(...employeeFilters({ employeeType, company }, 'e', params));

  const { rows } = await pool.query(
    `SELECT e.department, COALESCE(SUM(ps.net_amount), 0) AS net
       FROM payslips ps
       JOIN employees e ON e.id = ps.employee_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY e.department
      ORDER BY net DESC`,
    params
  );
  return rows.map((row) => ({ department: row.department, net: Number(row.net) }));
}

// ------------------------------------------------------------------ trend
// Always the 6 months ending at the selected period, regardless of which
// single month is picked - a trend needs several points to mean anything.
async function salaryTrend(period, { department, employeeType, company }) {
  const months = [];
  for (let i = 5; i >= 0; i -= 1) months.push(shiftMonth(period, -i));

  const results = [];
  for (const month of months) {
    const bounds = monthBounds(month);
    const params = [bounds.start, bounds.end];
    const conditions = [`ps.period_start <= $2`, `ps.period_end >= $1`];
    conditions.push(...employeeFilters({ department, employeeType, company }, 'e', params));

    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(ps.net_amount), 0) AS net
         FROM payslips ps
         JOIN employees e ON e.id = ps.employee_id
        WHERE ${conditions.join(' AND ')}`,
      params
    );
    results.push({ month, net: Number(rows[0].net) });
  }
  return results;
}

// ------------------------------------------------------ status split + alerts
// Each payslip lands in exactly one bucket so the stacked bar sums to 100%:
// an unresolved warning wins regardless of status (that IS the thing worth
// flagging), otherwise it buckets by where it sits in the payroll lifecycle.
async function payslipStatusSplit({ start, end }, filters) {
  const params = [start, end];
  const conditions = [`ps.period_start <= $2`, `ps.period_end >= $1`];
  conditions.push(...employeeFilters(filters, 'e', params));

  const { rows } = await pool.query(
    `SELECT ps.id, ps.status,
            EXISTS (SELECT 1 FROM payslip_warnings w WHERE w.payslip_id = ps.id AND w.is_resolved = false) AS has_warning
       FROM payslips ps
       JOIN employees e ON e.id = ps.employee_id
      WHERE ${conditions.join(' AND ')}`,
    params
  );

  let paid = 0;
  let done = 0;
  let pending = 0;
  let warning = 0;
  for (const row of rows) {
    if (row.has_warning) warning += 1;
    else if (row.status === 'paid') paid += 1;
    else if (row.status === 'validated') done += 1;
    else pending += 1; // draft or computed
  }
  const total = rows.length;
  return {
    total,
    segments: [
      { key: 'paid', label: 'Paid', count: paid, pct: pct(paid, total) },
      { key: 'done', label: 'Done', count: done, pct: pct(done, total) },
      { key: 'pending', label: 'Pending', count: pending, pct: pct(pending, total) },
      { key: 'warning', label: 'Warning', count: warning, pct: pct(warning, total) },
    ],
  };
}

async function alerts({ start, end }, filters) {
  const params = [start, end];
  const conditions = [`ps.period_start <= $2`, `ps.period_end >= $1`, `w.is_resolved = false`];
  conditions.push(...employeeFilters(filters, 'e', params));

  const { rows: warningRows } = await pool.query(
    `SELECT w.code, COUNT(DISTINCT e.id)::int AS employees, COUNT(*)::int AS occurrences
       FROM payslip_warnings w
       JOIN payslips ps ON ps.id = w.payslip_id
       JOIN employees e ON e.id = ps.employee_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY w.code`,
    params
  );
  const byCode = Object.fromEntries(warningRows.map((row) => [row.code, row]));

  // Payruns still not signed off, scoped the same way as everything else on
  // the dashboard (a department/type/company filter narrows this too, via
  // whether any of their payslips match).
  const payrunParams = [start, end];
  const payrunConditions = [`p.period_start <= $2`, `p.period_end >= $1`, `p.status IN ('draft', 'computed')`];
  if (filters.department || filters.employeeType || filters.company) {
    const empConds = employeeFilters(filters, 'e', payrunParams);
    payrunConditions.push(
      `EXISTS (SELECT 1 FROM payrun_employees pe JOIN employees e ON e.id = pe.employee_id
                WHERE pe.payrun_id = p.id AND ${empConds.join(' AND ')})`
    );
  }
  const { rows: draftRows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM payruns p WHERE ${payrunConditions.join(' AND ')}`,
    payrunParams
  );

  // "This month" for an expiring contract means the real current month, not
  // whichever historical period the dashboard happens to be showing.
  const now = new Date();
  const realMonth = monthBounds(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`);
  const contractParams = [realMonth.start, realMonth.end];
  const contractConditions = [
    `c.status = 'active'`,
    `c.end_date IS NOT NULL`,
    `c.end_date BETWEEN $1 AND $2`,
  ];
  contractConditions.push(...employeeFilters(filters, 'e', contractParams));
  const { rows: expiringRows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM contracts c
       JOIN employees e ON e.id = c.employee_id
      WHERE ${contractConditions.join(' AND ')}`,
    contractParams
  );

  const items = [];
  const missingAccount = byCode.no_account;
  if (missingAccount) {
    items.push({
      severity: 'blocking',
      message: `${missingAccount.employees} employee${missingAccount.employees === 1 ? '' : 's'} missing bank account`,
    });
  }
  const duplicate = byCode.duplicate;
  if (duplicate) {
    items.push({
      severity: 'advisory',
      message: `${duplicate.occurrences} duplicate payslip warning${duplicate.occurrences === 1 ? '' : 's'}`,
    });
  }
  if (draftRows[0].count > 0) {
    items.push({
      severity: 'advisory',
      message: `${draftRows[0].count} payrun${draftRows[0].count === 1 ? '' : 's'} still not validated`,
    });
  }
  if (expiringRows[0].count > 0) {
    items.push({
      severity: 'advisory',
      message: `${expiringRows[0].count} contract${expiringRows[0].count === 1 ? '' : 's'} expiring this month`,
    });
  }
  return items;
}

// -------------------------------------------------------------- attendance
async function attendanceOverview({ start, end, weekdays }, filters) {
  const params = [start, end];
  const conditions = [`a.attendance_date BETWEEN $1 AND $2`];
  conditions.push(...employeeFilters(filters, 'e', params));

  const { rows } = await pool.query(
    `SELECT a.status,
            COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE a.check_in IS NOT NULL AND a.check_out IS NULL)::int AS missing_checkout,
            COUNT(*) FILTER (WHERE a.is_manual_correction)::int AS manual_edits,
            COUNT(*) FILTER (WHERE a.worked_hours > ${OVERTIME_THRESHOLD_HOURS})::int AS overtime,
            COUNT(DISTINCT a.employee_id)::int AS employees_with_records
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY a.status`,
    params
  );

  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.count]));
  const totalRecords = rows.reduce((sum, row) => sum + row.count, 0);
  const missingCheckouts = rows.reduce((sum, row) => sum + row.missing_checkout, 0);
  const manualEdits = rows.reduce((sum, row) => sum + row.manual_edits, 0);
  const overtime = rows.reduce((sum, row) => sum + row.overtime, 0);

  // Coverage = what fraction of the "employee x weekday" grid actually got
  // an attendance record - only meaningful against employees in scope, so
  // it needs their headcount rather than the count of people who happened
  // to already have a record (which would make coverage trivially ~100%).
  const empParams = [];
  const empConditions = employeeFilters(filters, 'e', empParams);
  const { rows: empRows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM employees e
      WHERE e.status = 'active' ${empConditions.length ? 'AND ' + empConditions.join(' AND ') : ''}`,
    empParams
  );
  const expected = empRows[0].count * weekdays;

  return {
    present: byStatus.present || 0,
    late: byStatus.late || 0,
    absent: byStatus.absent || 0,
    onLeave: byStatus.on_leave || 0,
    exception: byStatus.exception || 0,
    overtime,
    missingCheckouts,
    manualEdits,
    coveragePct: pct(totalRecords, expected),
    healthPct: pct((byStatus.present || 0), totalRecords),
  };
}

// -------------------------------------------------------------- time off
async function timeOffOverview({ start, end }, filters) {
  const params = [start, end];
  const empConditions = employeeFilters(filters, 'e', params);
  // The employee filter has to live inside the join to (requests + their
  // employee), not as an outer WHERE - a WHERE on e.department would turn
  // this LEFT JOIN into an inner join and make a leave type with zero
  // matching requests disappear instead of showing zero days.
  const empClause = empConditions.length ? `AND ${empConditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.requires_allocation,
            COALESCE(SUM(r.duration) FILTER (WHERE r.status = 'approved'), 0) AS approved_days,
            COUNT(*) FILTER (WHERE r.status = 'submitted')::int AS pending
       FROM time_off_types t
       LEFT JOIN (
              time_off_requests r
              JOIN employees e ON e.id = r.employee_id ${empClause}
            ) ON r.time_off_type_id = t.id AND r.date_from <= $2 AND r.date_to >= $1
      WHERE t.is_active = true
      GROUP BY t.id, t.name, t.requires_allocation
      ORDER BY t.name`,
    params
  );

  // Remaining balance is a point-in-time fact (as of the period end), not
  // itself scoped to the request window above.
  const balanceParams = [end];
  const balanceConditions = [
    `a.status = 'approved'`,
    `a.valid_from <= $1`,
    `(a.valid_to IS NULL OR a.valid_to >= $1)`,
  ];
  balanceConditions.push(...employeeFilters(filters, 'e', balanceParams));
  const { rows: balanceRows } = await pool.query(
    `SELECT a.time_off_type_id, COALESCE(SUM(a.allocated_amount - a.taken_amount), 0) AS remaining
       FROM time_off_allocations a
       JOIN employees e ON e.id = a.employee_id
      WHERE ${balanceConditions.join(' AND ')}
      GROUP BY a.time_off_type_id`,
    balanceParams
  );
  const remainingByType = Object.fromEntries(balanceRows.map((row) => [row.time_off_type_id, Number(row.remaining)]));

  return rows.map((row) => ({
    typeId: row.id,
    typeName: row.name,
    approvedDays: Number(row.approved_days),
    pending: row.pending,
    // A type with no allocation model (e.g. unpaid leave) has no balance to
    // report - "N/A" says that plainly instead of showing a misleading 0.
    remainingBalance: row.requires_allocation ? (remainingByType[row.id] ?? 0) : null,
  }));
}

// ---------------------------------------------------------- department overview
// A standing snapshot (who is on payroll right now and what they cost),
// not tied to the selected period's payslips - that history lives in the
// Salary by Department chart above. Ignores the Department filter for the
// same reason that chart does.
async function departmentOverview({ employeeType, company }) {
  const params = [];
  const conditions = [`e.status = 'active'`];
  conditions.push(...employeeFilters({ employeeType, company }, 'e', params));

  const { rows } = await pool.query(
    `SELECT e.department,
            COUNT(DISTINCT e.id)::int AS headcount,
            COALESCE(SUM(c.wage), 0) AS monthly_salary
       FROM employees e
       LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'active'
      WHERE ${conditions.join(' AND ')}
      GROUP BY e.department
      ORDER BY monthly_salary DESC`,
    params
  );
  return rows.map((row) => ({
    department: row.department,
    headcount: row.headcount,
    monthlySalary: Number(row.monthly_salary),
  }));
}

// -------------------------------------------------------------------- options
async function filterOptions() {
  const [departments, employeeTypes, companies, periods] = await Promise.all([
    pool.query(`SELECT DISTINCT department FROM employees ORDER BY department`),
    pool.query(`SELECT DISTINCT employee_type FROM employees ORDER BY employee_type`),
    pool.query(`SELECT DISTINCT company FROM employees WHERE company IS NOT NULL ORDER BY company`),
    pool.query(`
      SELECT DISTINCT to_char(period_start, 'YYYY-MM') AS period
        FROM payruns
       UNION
      SELECT DISTINCT to_char(attendance_date, 'YYYY-MM') FROM attendance
       ORDER BY 1 DESC
       LIMIT 12
    `),
  ]);
  return {
    departments: departments.rows.map((row) => row.department),
    employeeTypes: employeeTypes.rows.map((row) => row.employee_type),
    companies: companies.rows.map((row) => row.company),
    periods: periods.rows.map((row) => row.period),
  };
}

// ------------------------------------------------------------------ assembly
async function getDashboard({ period, department, employeeType, company } = {}) {
  const resolvedPeriod = period || (await defaultPeriod());
  const bounds = monthBounds(resolvedPeriod);
  const filters = { department: department || null, employeeType: employeeType || null, company: company || null };

  const [totals, byDepartment, trend, statusSplit, alertItems, attendance, timeOff, deptOverview, options] =
    await Promise.all([
      totalNetSalaryPaid(resolvedPeriod, filters),
      salaryByDepartment(bounds, filters),
      salaryTrend(resolvedPeriod, filters),
      payslipStatusSplit(bounds, filters),
      alerts(bounds, filters),
      attendanceOverview(bounds, filters),
      timeOffOverview(bounds, filters),
      departmentOverview(filters),
      filterOptions(),
    ]);

  const approvedTimeOffDays = timeOff.reduce((sum, row) => sum + row.approvedDays, 0);
  const avgSalaryPerEmployee = totals.employeeCount > 0 ? Math.round(totals.net / totals.employeeCount) : 0;

  return {
    filters: { period: resolvedPeriod, ...filters },
    options,
    metrics: {
      totalNetPaid: { value: totals.net, deltaPct: totals.deltaPct },
      payslipsGenerated: { total: totals.payslipCount, paid: totals.paidCount, pending: totals.pendingCount },
      avgSalaryPerEmployee: { value: avgSalaryPerEmployee },
      approvedTimeOffDays: { value: approvedTimeOffDays },
      attendanceHealth: { pct: attendance.healthPct },
    },
    salaryByDepartment: byDepartment,
    salaryTrend: trend,
    payslipStatus: statusSplit,
    alerts: alertItems,
    attendance,
    timeOff,
    departmentOverview: deptOverview,
  };
}

module.exports = { getDashboard };
