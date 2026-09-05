const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../../db/pool');
const { primaryRole, landingPathFor } = require('../constants');

// Accounts are created by an admin only - there is no self-registration,
// so this just verifies credentials against existing rows.
//
// Roles are read from the database on every login, so if an admin changes
// someone's roles the next token they get is signed with the new set.
async function authenticate(email, password) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.roles::text[] AS roles, u.is_active,
            u.employee_id, e.full_name AS employee_name
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.email = $1`,
    [email]
  );
  const user = rows[0];

  if (!user || !user.is_active) return null;
  if (!(await bcrypt.compare(password, user.password_hash))) return null;

  return {
    id: user.id,
    email: user.email,
    roles: user.roles,
    primaryRole: primaryRole(user.roles),
    landingPath: landingPathFor(user.roles),
    employeeId: user.employee_id,
    employeeName: user.employee_name,
  };
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, roles: user.roles, employeeId: user.employeeId },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

module.exports = { authenticate, issueToken };
