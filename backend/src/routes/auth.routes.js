const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../../db/pool');

const router = Router();

// Accounts are created by an admin only - there is no self-registration route.
router.post('/login', async (request, response) => {
  const { email, password } = request.body || {};

  if (!email || !password) {
    return response.status(400).json({ message: 'email and password are required' });
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.roles::text[] AS roles, u.is_active,
            u.employee_id, e.full_name AS employee_name
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.email = $1`,
    [email]
  );
  const user = rows[0];

  if (!user || !user.is_active) {
    return response.status(401).json({ message: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return response.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { sub: user.id, roles: user.roles, employeeId: user.employee_id },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  response.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      roles: user.roles,
      employeeId: user.employee_id,
      employeeName: user.employee_name,
    },
  });
});

module.exports = router;
