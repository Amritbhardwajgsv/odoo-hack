const pool = require('../../db/pool');

const RULE_SELECT = `
  SELECT r.*, s.name AS structure_name
    FROM salary_rules r
    JOIN salary_structures s ON s.id = r.structure_id
`;

function mapRule(row) {
  return {
    id: row.id,
    structureId: row.structure_id,
    structureName: row.structure_name,
    name: row.name,
    code: row.code,
    category: row.category,
    sequence: row.sequence,
    computationMethod: row.computation_method,
    value: row.value === null ? null : Number(row.value),
    formula: row.formula,
    quantity: Number(row.quantity),
    isActive: row.is_active,
  };
}

// The rules table on a Salary Structure's form, and the global Salary Rules
// list both read from here - the global list adds the structure filter.
async function listRules({ structureId, search } = {}) {
  const conditions = [];
  const params = [];

  if (structureId) {
    params.push(structureId);
    conditions.push(`r.structure_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(r.name ILIKE $${params.length} OR r.code ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  // Sequence order is the point - it is how the computation actually runs,
  // so the list has to read the same way the engine processes it.
  const { rows } = await pool.query(
    `${RULE_SELECT} ${where} ORDER BY s.name, r.sequence, r.name`,
    params
  );
  return rows.map(mapRule);
}

async function findRuleById(id) {
  const { rows } = await pool.query(`${RULE_SELECT} WHERE r.id = $1`, [id]);
  return rows[0] ? mapRule(rows[0]) : null;
}

// value only means something for fixed/percentage methods; formula rules
// carry their logic in `formula` instead. Whichever the method doesn't use
// is stored as null so the form can't show a stale number from a previous
// computation method.
function normalizeByMethod({ computationMethod, value, formula }) {
  if (computationMethod === 'formula') {
    return { value: null, formula: formula || null };
  }
  return { value: value ?? 0, formula: null };
}

async function createRule({
  structureId,
  name,
  code,
  category,
  sequence,
  computationMethod,
  value,
  formula,
  quantity,
  isActive,
}) {
  const normalized = normalizeByMethod({ computationMethod, value, formula });
  const { rows } = await pool.query(
    `INSERT INTO salary_rules
       (structure_id, name, code, category, sequence, computation_method, value, formula, quantity, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      structureId,
      name,
      code.toUpperCase(),
      category,
      sequence,
      computationMethod,
      normalized.value,
      normalized.formula,
      quantity ?? 1,
      isActive ?? true,
    ]
  );
  return findRuleById(rows[0].id);
}

async function updateRule(id, patch) {
  const existing = await findRuleById(id);
  if (!existing) return null;

  const computationMethod = patch.computationMethod ?? existing.computationMethod;
  const normalized = normalizeByMethod({
    computationMethod,
    value: patch.value !== undefined ? patch.value : existing.value,
    formula: patch.formula !== undefined ? patch.formula : existing.formula,
  });

  await pool.query(
    `UPDATE salary_rules
        SET structure_id       = COALESCE($1, structure_id),
            name               = COALESCE($2, name),
            code               = COALESCE($3, code),
            category           = COALESCE($4, category),
            sequence           = COALESCE($5, sequence),
            computation_method = $6,
            value              = $7,
            formula            = $8,
            quantity           = COALESCE($9, quantity),
            is_active          = COALESCE($10, is_active)
      WHERE id = $11`,
    [
      patch.structureId ?? null,
      patch.name ?? null,
      patch.code ? patch.code.toUpperCase() : null,
      patch.category ?? null,
      patch.sequence ?? null,
      computationMethod,
      normalized.value,
      normalized.formula,
      patch.quantity ?? null,
      patch.isActive ?? null,
      id,
    ]
  );
  return findRuleById(id);
}

// A rule that has already produced payslip lines is history, not
// configuration - deleting it would strand payslip_lines.rule_id references
// (the column is nullable and ON DELETE would need to be considered, but
// simplest and safest is to refuse rather than silently orphan the line).
async function deleteRule(id) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS used FROM payslip_lines WHERE rule_id = $1',
    [id]
  );
  if (rows[0].used > 0) {
    return { error: 'in_use', count: rows[0].used };
  }
  const { rowCount } = await pool.query('DELETE FROM salary_rules WHERE id = $1', [id]);
  return rowCount > 0 ? { deleted: true } : { error: 'not_found' };
}

module.exports = { listRules, findRuleById, createRule, updateRule, deleteRule };
