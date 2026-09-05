const { Parser } = require('expr-eval');

const pool = require('../../db/pool');

// Warning counts drive the "1 warning / No warnings" line on every payrun
// card, so they are read back with the payrun rather than in a second trip.
const PAYRUN_SELECT = `
  SELECT p.*,
         s.name AS salary_structure_name,
         creator_emp.full_name AS created_by_name,
         (SELECT COUNT(*) FROM payrun_employees pe WHERE pe.payrun_id = p.id) AS employee_count,
         (SELECT COUNT(*) FROM payslips ps WHERE ps.payrun_id = p.id)         AS payslip_count,
         (SELECT COALESCE(SUM(ps.gross_amount), 0) FROM payslips ps WHERE ps.payrun_id = p.id) AS gross_total,
         (SELECT COALESCE(SUM(ps.net_amount), 0)   FROM payslips ps WHERE ps.payrun_id = p.id) AS net_total,
         (SELECT COUNT(*)
            FROM payslip_warnings w
            JOIN payslips ps ON ps.id = w.payslip_id
           WHERE ps.payrun_id = p.id AND w.is_resolved = false) AS warning_count,
         (SELECT COUNT(*)
            FROM payslip_warnings w
            JOIN payslips ps ON ps.id = w.payslip_id
           WHERE ps.payrun_id = p.id AND w.is_resolved = false
             AND w.severity = 'blocking') AS blocking_count,
         (SELECT COUNT(*)
            FROM payrun_employees pe
           WHERE pe.payrun_id = p.id
             AND NOT EXISTS (
                   SELECT 1 FROM payslips ps
                    WHERE ps.payrun_id = p.id AND ps.employee_id = pe.employee_id
                 )) AS uncomputed_count
    FROM payruns p
    JOIN salary_structures s ON s.id = p.salary_structure_id
    LEFT JOIN users creator ON creator.id = p.created_by
    LEFT JOIN employees creator_emp ON creator_emp.id = creator.employee_id
`;

function mapPayrun(row) {
  return {
    id: row.id,
    name: row.name,
    salaryStructureId: row.salary_structure_id,
    salaryStructureName: row.salary_structure_name,
    department: row.department,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    employeeCount: Number(row.employee_count),
    payslipCount: Number(row.payslip_count),
    // A draft has never been computed, so it has nothing to warn about yet.
    warningCount: Number(row.warning_count),
    blockingCount: Number(row.blocking_count),
    // Employees on the payrun that produced no payslip - almost always a
    // missing contract. Only meaningful once the run has been computed.
    uncomputedCount: row.status === 'draft' ? 0 : Number(row.uncomputed_count),
    grossTotal: Number(row.gross_total),
    netTotal: Number(row.net_total),
    createdByName: row.created_by_name,
    computedAt: row.computed_at,
    validatedAt: row.validated_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

async function listPayruns({ search, year, status } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`p.name ILIKE $${params.length}`);
  }
  // The year chip filters on the period the payrun pays for, not on when
  // somebody happened to create it.
  if (year) {
    params.push(Number(year));
    conditions.push(`EXTRACT(YEAR FROM p.period_start) = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `${PAYRUN_SELECT} ${where} ORDER BY p.period_start DESC, p.created_at DESC`,
    params
  );
  return rows.map(mapPayrun);
}

// Which years the chip can offer, taken from the data instead of a hardcoded
// range, so an old or future period never becomes unreachable.
async function listYears() {
  const { rows } = await pool.query(
    `SELECT DISTINCT EXTRACT(YEAR FROM period_start)::int AS year
       FROM payruns ORDER BY year DESC`
  );
  return rows.map((row) => row.year);
}

async function findById(id, client = pool) {
  const { rows } = await client.query(`${PAYRUN_SELECT} WHERE p.id = $1`, [id]);
  return rows[0] ? mapPayrun(rows[0]) : null;
}

// Everyone holding a running contract that overlaps the period. Kept as one
// statement so a payrun is filled atomically with its own creation.
// Every parameter is cast explicitly: in a bare SELECT list Postgres has no
// column to infer $1 from and would type it as text, which the uuid column
// then rejects.
const FILL_EMPLOYEES_SQL = `
  INSERT INTO payrun_employees (payrun_id, employee_id)
  SELECT DISTINCT $1::uuid, c.employee_id
    FROM contracts c
    JOIN employees e ON e.id = c.employee_id
   WHERE c.status = 'active'
     AND e.status = 'active'
     AND c.start_date <= $3::date
     AND (c.end_date IS NULL OR c.end_date >= $2::date)
     AND ($4::department_type IS NULL OR e.department = $4::department_type)
  ON CONFLICT (payrun_id, employee_id) DO NOTHING
`;

async function createPayrun({ name, salaryStructureId, department, periodStart, periodEnd }, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO payruns (name, salary_structure_id, department, period_start, period_end, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, salaryStructureId, department || null, periodStart, periodEnd, userId]
    );
    const payrunId = rows[0].id;
    await client.query(FILL_EMPLOYEES_SQL, [payrunId, periodStart, periodEnd, department || null]);
    await client.query('COMMIT');
    return findById(payrunId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updatePayrun(id, { name, department, periodStart, periodEnd, salaryStructureId }) {
  const existing = await findById(id);
  if (!existing) return { error: 'not_found' };
  // Editing the period after payslips exist would leave them describing a
  // period they were never computed for.
  if (existing.status !== 'draft') return { error: 'locked' };

  await pool.query(
    `UPDATE payruns
        SET name = COALESCE($1, name),
            department = $2,
            period_start = COALESCE($3, period_start),
            period_end = COALESCE($4, period_end),
            salary_structure_id = COALESCE($5, salary_structure_id)
      WHERE id = $6`,
    [
      name ?? null,
      department === undefined ? existing.department : department,
      periodStart ?? null,
      periodEnd ?? null,
      salaryStructureId ?? null,
      id,
    ]
  );

  // The headcount follows the period, so refill whenever a draft is edited.
  const refreshed = await findById(id);
  await pool.query('DELETE FROM payrun_employees WHERE payrun_id = $1', [id]);
  await pool.query(FILL_EMPLOYEES_SQL, [
    id,
    refreshed.periodStart,
    refreshed.periodEnd,
    refreshed.department,
  ]);
  return { payrun: await findById(id) };
}

// --------------------------------------------------------------- computing

const parser = new Parser();

// Categories that build the gross, versus the ones taken back off it.
const ADDS_TO_GROSS = ['basic', 'allowance'];
const REDUCES_NET = ['deduction', 'contribution'];

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// One employee's payslip lines, in rule sequence. Each rule can see the
// wage, the running basic/gross, the worked days, and every rule code that
// has already been computed - which is what makes formula rules useful.
function computeLines(rules, { wage, workedDays }) {
  const scope = { wage, worked_days: workedDays, basic: 0, gross: 0, net: 0 };
  const lines = [];
  const problems = [];
  let basic = 0;
  let gross = 0;
  let deducted = 0;

  for (const rule of rules) {
    const value = rule.value === null ? 0 : Number(rule.value);
    let amount = 0;

    switch (rule.computation_method) {
      case 'fixed':
        amount = value;
        break;
      case 'percentage_of_contract_wage':
        amount = (wage * value) / 100;
        break;
      case 'percentage_of_basic':
        amount = (basic * value) / 100;
        break;
      case 'percentage_of_gross':
        amount = (gross * value) / 100;
        break;
      case 'formula':
        try {
          amount = Number(parser.evaluate(rule.formula || '0', scope));
          if (!Number.isFinite(amount)) throw new Error('not a finite number');
        } catch (error) {
          // A broken formula must not abort the whole run - the payslip is
          // still produced and the problem is raised as a warning.
          amount = 0;
          problems.push(`Rule "${rule.name}" could not be computed: ${error.message}`);
        }
        break;
      default:
        amount = 0;
    }

    amount = round(amount);
    lines.push({
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      sequence: rule.sequence,
      amount,
    });

    if (rule.category === 'basic') basic = round(basic + amount);
    if (ADDS_TO_GROSS.includes(rule.category)) gross = round(gross + amount);
    if (REDUCES_NET.includes(rule.category)) deducted = round(deducted + amount);

    scope[rule.code] = amount;
    scope.basic = basic;
    scope.gross = gross;
    scope.net = round(gross - deducted);
  }

  return { lines, gross, net: round(gross - deducted), problems };
}

const PAYRUN_EMPLOYEES_SQL = `
  SELECT pe.employee_id,
         e.full_name,
         c.id        AS contract_id,
         c.wage      AS wage,
         c.end_date  AS contract_end,
         (SELECT COUNT(*) FROM attendance a
           WHERE a.employee_id = pe.employee_id
             AND a.attendance_date BETWEEN $2 AND $3
             AND a.status IN ('present', 'late')) AS worked_days
    FROM payrun_employees pe
    JOIN employees e ON e.id = pe.employee_id
    LEFT JOIN LATERAL (
         SELECT c.id, c.wage, c.end_date
           FROM contracts c
          WHERE c.employee_id = pe.employee_id
            AND c.status = 'active'
            AND c.start_date <= $3
            AND (c.end_date IS NULL OR c.end_date >= $2)
          ORDER BY c.start_date DESC
          LIMIT 1
    ) c ON true
   WHERE pe.payrun_id = $1
   ORDER BY e.full_name
`;

function warningsFor(row, net, problems, periodEnd) {
  const warnings = problems.map((message) => ({ severity: 'advisory', message }));

  if (Number(row.wage) <= 0) {
    warnings.push({
      severity: 'blocking',
      message: 'Contract wage is zero, so there is nothing to pay',
    });
  } else if (net <= 0) {
    // Only worth raising separately when a real wage still nets out to nothing,
    // which means the rules are taking back everything they gave.
    warnings.push({ severity: 'blocking', message: 'Net pay came out zero or negative' });
  }

  if (Number(row.worked_days) === 0) {
    warnings.push({
      severity: 'advisory',
      message: 'No attendance was recorded for this employee in this period',
    });
  }
  // Only a contract actually running out inside the period matters here.
  if (row.contract_end && new Date(row.contract_end) <= new Date(periodEnd)) {
    warnings.push({
      severity: 'advisory',
      message: `Contract ends ${String(row.contract_end).slice(0, 10)}, inside this payroll period`,
    });
  }
  return warnings;
}

// Recomputing throws the previous payslips away rather than patching them,
// so the result always reflects the rules and contracts as they are now.
async function compute(id) {
  const payrun = await findById(id);
  if (!payrun) return { error: 'not_found' };
  if (payrun.status === 'paid') return { error: 'locked' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: rules } = await client.query(
      `SELECT id, name, code, category, sequence, computation_method, value, formula
         FROM salary_rules
        WHERE structure_id = $1 AND is_active = true
        ORDER BY sequence, name`,
      [payrun.salaryStructureId]
    );
    if (rules.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'no_rules', structure: payrun.salaryStructureName };
    }

    await client.query('DELETE FROM payslips WHERE payrun_id = $1', [id]);

    const { rows: staff } = await client.query(PAYRUN_EMPLOYEES_SQL, [
      id,
      payrun.periodStart,
      payrun.periodEnd,
    ]);

    let computed = 0;
    const skipped = [];

    for (const row of staff) {
      // payslips.contract_id is NOT NULL, so somebody without a running
      // contract cannot get a payslip at all. They stay on the payrun and
      // are reported instead of being silently dropped.
      if (!row.contract_id) {
        skipped.push(row.full_name);
        continue;
      }

      const workedDays = Number(row.worked_days);
      const { lines, gross, net, problems } = computeLines(rules, {
        wage: Number(row.wage),
        workedDays,
      });

      const { rows: inserted } = await client.query(
        `INSERT INTO payslips
           (payrun_id, employee_id, contract_id, period_start, period_end,
            worked_days, gross_amount, net_amount, status, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'computed', now())
         RETURNING id`,
        [id, row.employee_id, row.contract_id, payrun.periodStart, payrun.periodEnd,
         workedDays, gross, net]
      );
      const payslipId = inserted[0].id;

      for (const line of lines) {
        await client.query(
          `INSERT INTO payslip_lines (payslip_id, rule_id, rule_name, category, sequence, amount)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [payslipId, line.ruleId, line.ruleName, line.category, line.sequence, line.amount]
        );
      }

      for (const warning of warningsFor(row, net, problems, payrun.periodEnd)) {
        await client.query(
          `INSERT INTO payslip_warnings (payslip_id, severity, message) VALUES ($1, $2, $3)`,
          [payslipId, warning.severity, warning.message]
        );
      }
      computed += 1;
    }

    await client.query(
      `UPDATE payruns SET status = 'computed', computed_at = now(),
              validated_at = NULL, paid_at = NULL
        WHERE id = $1`,
      [id]
    );
    await client.query('COMMIT');
    return { payrun: await findById(id), computed, skipped };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// --------------------------------------------------------------- lifecycle

const NEXT_STATUS = {
  validated: { from: ['computed'], column: 'validated_at' },
  paid: { from: ['validated'], column: 'paid_at' },
  draft: { from: ['computed', 'validated'], column: null },
};

async function setStatus(id, status) {
  const payrun = await findById(id);
  if (!payrun) return { error: 'not_found' };

  const transition = NEXT_STATUS[status];
  if (!transition) return { error: 'bad_status' };
  if (!transition.from.includes(payrun.status)) {
    return { error: 'bad_transition', from: payrun.status, to: status };
  }
  // A blocking warning is exactly the thing validation is supposed to stop.
  if (status === 'validated' && payrun.blockingCount > 0) {
    return { error: 'blocked', count: payrun.blockingCount };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (status === 'draft') {
      // Going back to draft discards the computation entirely; leaving stale
      // payslips behind would misreport what the run currently contains.
      await client.query('DELETE FROM payslips WHERE payrun_id = $1', [id]);
      await client.query(
        `UPDATE payruns SET status = 'draft', computed_at = NULL,
                validated_at = NULL, paid_at = NULL WHERE id = $1`,
        [id]
      );
    } else {
      await client.query(
        `UPDATE payruns SET status = $1, ${transition.column} = now() WHERE id = $2`,
        [status, id]
      );
      await client.query(
        `UPDATE payslips SET status = $1${status === 'paid' ? ', paid_at = now()' : ''}
          WHERE payrun_id = $2`,
        [status, id]
      );
    }

    await client.query('COMMIT');
    return { payrun: await findById(id) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deletePayrun(id) {
  const payrun = await findById(id);
  if (!payrun) return { error: 'not_found' };
  if (payrun.status === 'paid') return { error: 'locked' };
  await pool.query('DELETE FROM payruns WHERE id = $1', [id]);
  return { deleted: true };
}

// ---------------------------------------------------------------- payslips

function mapPayslip(row) {
  return {
    id: row.id,
    payrunId: row.payrun_id,
    payrunName: row.payrun_name,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    jobTitle: row.job_title,
    contractId: row.contract_id,
    contractNumber: row.contract_number,
    wage: row.wage === null ? null : Number(row.wage),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    workedDays: row.worked_days === null ? null : Number(row.worked_days),
    grossAmount: row.gross_amount === null ? null : Number(row.gross_amount),
    netAmount: row.net_amount === null ? null : Number(row.net_amount),
    status: row.status,
    warningCount: Number(row.warning_count ?? 0),
    blockingCount: Number(row.blocking_count ?? 0),
    computedAt: row.computed_at,
    paidAt: row.paid_at,
  };
}

const PAYSLIP_SELECT = `
  SELECT ps.*,
         e.full_name  AS employee_name,
         e.department AS department,
         jp.title     AS job_title,
         c.contract_number,
         c.wage,
         p.name       AS payrun_name,
         (SELECT COUNT(*) FROM payslip_warnings w
           WHERE w.payslip_id = ps.id AND w.is_resolved = false) AS warning_count,
         (SELECT COUNT(*) FROM payslip_warnings w
           WHERE w.payslip_id = ps.id AND w.is_resolved = false
             AND w.severity = 'blocking') AS blocking_count
    FROM payslips ps
    JOIN employees e   ON e.id = ps.employee_id
    JOIN contracts c   ON c.id = ps.contract_id
    JOIN payruns p     ON p.id = ps.payrun_id
    LEFT JOIN job_positions jp ON jp.id = e.job_position_id
`;

async function listPayslips({ payrunId, employeeId, status, search } = {}) {
  const conditions = [];
  const params = [];

  if (payrunId) {
    params.push(payrunId);
    conditions.push(`ps.payrun_id = $${params.length}`);
  }
  if (employeeId) {
    params.push(employeeId);
    conditions.push(`ps.employee_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`ps.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`e.full_name ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `${PAYSLIP_SELECT} ${where} ORDER BY e.full_name`,
    params
  );
  return rows.map(mapPayslip);
}

async function findPayslipById(id) {
  const { rows } = await pool.query(`${PAYSLIP_SELECT} WHERE ps.id = $1`, [id]);
  if (!rows[0]) return null;

  const [lines, warnings] = await Promise.all([
    pool.query(
      `SELECT id, rule_name, category, sequence, amount
         FROM payslip_lines WHERE payslip_id = $1 ORDER BY sequence, rule_name`,
      [id]
    ),
    pool.query(
      `SELECT id, severity, message, is_resolved
         FROM payslip_warnings WHERE payslip_id = $1
        ORDER BY severity, created_at`,
      [id]
    ),
  ]);

  return {
    ...mapPayslip(rows[0]),
    lines: lines.rows.map((line) => ({
      id: line.id,
      ruleName: line.rule_name,
      category: line.category,
      sequence: line.sequence,
      amount: Number(line.amount),
    })),
    warnings: warnings.rows.map((warning) => ({
      id: warning.id,
      severity: warning.severity,
      message: warning.message,
      isResolved: warning.is_resolved,
    })),
  };
}

// Employees carried by the payrun that produced no payslip - surfaced so a
// missing contract is visible instead of just a smaller headcount.
async function listUncomputed(payrunId) {
  const { rows } = await pool.query(
    `SELECT e.id, e.full_name, e.department
       FROM payrun_employees pe
       JOIN employees e ON e.id = pe.employee_id
      WHERE pe.payrun_id = $1
        AND NOT EXISTS (
              SELECT 1 FROM payslips ps
               WHERE ps.payrun_id = $1 AND ps.employee_id = e.id
            )
      ORDER BY e.full_name`,
    [payrunId]
  );
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    department: row.department,
  }));
}

module.exports = {
  listPayruns,
  listYears,
  findById,
  createPayrun,
  updatePayrun,
  compute,
  setStatus,
  deletePayrun,
  listPayslips,
  findPayslipById,
  listUncomputed,
};
