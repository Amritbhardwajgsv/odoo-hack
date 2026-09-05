const bcrypt = require('bcryptjs');

const pool = require('../../db/pool');
const userCache = require('./userCache');
const { PASSWORD_SALT_ROUNDS } = require('../constants');

const SELECT_BASE = `
  SELECT u.id, u.email, u.roles::text[] AS roles, u.is_active, u.employee_id, u.created_at,
         e.full_name AS employee_name
    FROM users u
    LEFT JOIN employees e ON e.id = u.employee_id
`;

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    roles: row.roles,
    isActive: row.is_active,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    createdAt: row.created_at,
  };
}

function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

async function list({ search, role } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.email ILIKE $${params.length} OR e.full_name ILIKE $${params.length})`);
  }
  if (role) {
    params.push(role);
    conditions.push(`$${params.length} = ANY(u.roles)`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`${SELECT_BASE} ${where} ORDER BY u.created_at DESC`, params);
  return rows.map(mapUser);
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE u.id = $1`, [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

// `client` lets this run inside a caller's transaction (employee + account together).
async function create({ employeeId, email, password, roles, isActive = true }, client = pool) {
  const passwordHash = await hashPassword(password);
  const { rows } = await client.query(
    `INSERT INTO users (employee_id, email, password_hash, roles, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [employeeId, email, passwordHash, roles, isActive]
  );
  return rows[0].id;
}

async function update(id, { roles, isActive, password }, client = pool) {
  const sets = [];
  const params = [];

  if (roles) {
    params.push(roles);
    sets.push(`roles = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    sets.push(`is_active = $${params.length}`);
  }
  if (password) {
    params.push(await hashPassword(password));
    sets.push(`password_hash = $${params.length}`);
  }
  if (sets.length === 0) return null;

  params.push(id);
  const { rows } = await client.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
    params
  );

  // Drop the cached copy so a role change or deactivation applies to the
  // very next request rather than waiting for the TTL.
  userCache.invalidate(id);
  return rows[0] ? rows[0].id : null;
}

async function findByEmployeeId(employeeId) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE u.employee_id = $1`, [employeeId]);
  return rows[0] ? mapUser(rows[0]) : null;
}

module.exports = { list, findById, findByEmployeeId, create, update, hashPassword };
