const pool = require('../../db/pool');

// List view needs "number of rules" and "number of employees" per structure
// (A5: "display associated details like the number of rules, employees, and
// active status") without a round trip per row.
const STRUCTURE_SELECT = `
  SELECT s.*,
         (SELECT COUNT(*) FROM salary_rules r WHERE r.structure_id = s.id) AS rule_count,
         (SELECT COUNT(DISTINCT c.employee_id) FROM contracts c
           WHERE c.salary_structure_id = s.id AND c.status = 'active') AS employee_count
    FROM salary_structures s
`;

function mapStructure(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    ruleCount: Number(row.rule_count),
    employeeCount: Number(row.employee_count),
    createdAt: row.created_at,
  };
}

async function listStructures({ search, activeOnly } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`s.name ILIKE $${params.length}`);
  }
  if (activeOnly) conditions.push('s.is_active = true');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`${STRUCTURE_SELECT} ${where} ORDER BY s.name`, params);
  return rows.map(mapStructure);
}

async function findStructureById(id) {
  const { rows } = await pool.query(`${STRUCTURE_SELECT} WHERE s.id = $1`, [id]);
  return rows[0] ? mapStructure(rows[0]) : null;
}

async function createStructure({ name, description, isActive }) {
  const { rows } = await pool.query(
    `INSERT INTO salary_structures (name, description, is_active)
     VALUES ($1, $2, $3) RETURNING id`,
    [name, description || null, isActive ?? true]
  );
  return findStructureById(rows[0].id);
}

async function updateStructure(id, { name, description, isActive }) {
  const { rows } = await pool.query(
    `UPDATE salary_structures
        SET name = COALESCE($1, name),
            description = CASE WHEN $2::text IS NOT NULL THEN NULLIF($2, '') ELSE description END,
            is_active = COALESCE($3, is_active)
      WHERE id = $4 RETURNING id`,
    [name ?? null, description === undefined ? null : description ?? '', isActive ?? null, id]
  );
  if (!rows[0]) return null;
  return findStructureById(id);
}

// A structure that a contract or payrun already references cannot be
// deleted out from under them - deactivating it is the safe equivalent.
async function deleteStructure(id) {
  const inUse = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM contracts WHERE salary_structure_id = $1)::int AS contracts,
       (SELECT COUNT(*) FROM payruns   WHERE salary_structure_id = $1)::int AS payruns`,
    [id]
  );
  const { contracts, payruns } = inUse.rows[0];
  if (contracts > 0 || payruns > 0) {
    return { error: 'in_use', contracts, payruns };
  }
  const { rowCount } = await pool.query('DELETE FROM salary_structures WHERE id = $1', [id]);
  return rowCount > 0 ? { deleted: true } : { error: 'not_found' };
}

module.exports = {
  listStructures,
  findStructureById,
  createStructure,
  updateStructure,
  deleteStructure,
};
